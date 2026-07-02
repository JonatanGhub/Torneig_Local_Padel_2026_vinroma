#!/usr/bin/env bash
# =========================================================================
# evolution-watchdog.sh — vigilància i auto-recuperació de TOTES les
# instàncies d'Evolution API (multi-instància, per a WhatsApps de clients).
#
# QUÈ DETECTA I QUÈ FA
#   A) L'API d'Evolution no respon (contenidor caigut/penjat)
#        → docker restart + avís push
#   B) Una instància "open" però amb el socket MORT (sessió zombie: tot
#      retorna "Connection Closed"; connectionState menteix)
#        → docker restart + avís push
#        (el restart del contenidor és l'únic remei comprovat; reconnecta
#        TOTES les instàncies amb les credencials guardades, sense QR)
#   C) Una instància desconnectada de debò (close/connecting — p.ex. un
#      client ha desvinculat el dispositiu)
#        → avís push (una sola vegada per transició; el restart NO ho
#        arregla, cal re-escanejar el QR d'aquella instància)
#   D) Recuperació → avís push de "tornem a estar bé"
#
# PROTECCIONS
#   - Llindar de 2 comprovacions fallides seguides (evita reiniciar per un
#     microtall de xarxa)
#   - Cooldown de 10 min entre restarts (mai bucles de reinici)
#   - Fitxer de pausa per a manteniments: touch /tmp/evolution-watchdog-pause
#   - flock: mai dues execucions solapades
#
# REQUISITS: jq, curl, docker (apt-get install -y jq)
# INSTAL·LACIÓ: veure docs/OPS_WHATSAPP.md (pas a pas)
# =========================================================================

set -u

# ----- CONFIG (edita això) ------------------------------------------------
# API key GLOBAL d'Evolution (AUTHENTICATION_API_KEY del docker-compose).
APIKEY="POSA_AQUI_EVOLUTION_API_KEY_GLOBAL"
# URL d'Evolution DES DEL VPS (localhost:PORT si publiques el port, més robust
# que passar pel reverse proxy; https://evo.neonexai.com també val).
BASE_URL="https://evo.neonexai.com"
# Nom del contenidor Docker (docker ps per confirmar-lo).
CONTAINER="evolution-evolution-api-1"
# Número de prova per al probe real (consulta read-only "aquest número té
# WhatsApp?"; no envia cap missatge a ningú). Qualsevol número vàlid serveix.
PROBE_NUMBER="34620033053"
# Tema de ntfy.sh per als avisos push (buit = només log, sense push).
# Tria'n un de PRIVAT i impredictible, p.ex.: evo-vinroma-x7k2m9q4
NTFY_TOPIC=""
# Instàncies a IGNORAR (separades per espais), p.ex. proves abandonades.
IGNORE_INSTANCES=""
# ---------------------------------------------------------------------------

STATE_DIR="/var/lib/evolution-watchdog"
LOG_FILE="/var/log/evolution-watchdog.log"
PAUSE_FILE="/tmp/evolution-watchdog-pause"
LOCK_FILE="/tmp/evolution-watchdog.lock"
THRESHOLD=2          # comprovacions fallides seguides abans d'actuar
RESTART_COOLDOWN=600 # segons mínims entre docker restart

mkdir -p "$STATE_DIR"

log() { echo "$(date -Is) $*" >> "$LOG_FILE"; }

notify() {
  # Avís push via ntfy.sh (independent de WhatsApp). Sempre queda al log.
  local title="$1" body="$2" prio="${3:-default}"
  log "NOTIFY [$title] $body"
  if [ -n "$NTFY_TOPIC" ]; then
    curl -sS -m 10 \
      -H "Title: $title" -H "Priority: $prio" -H "Tags: rotating_light" \
      -d "$body" "https://ntfy.sh/$NTFY_TOPIC" > /dev/null 2>&1 || true
  fi
}

# Rotació de log casolana: si passa d'1 MB, conserva només el final.
if [ -f "$LOG_FILE" ] && [ "$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)" -gt 1048576 ]; then
  tail -n 500 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

# Pausa per a manteniments.
if [ -f "$PAUSE_FILE" ]; then
  exit 0
fi

# Mai dues execucions alhora.
exec 9> "$LOCK_FILE"
flock -n 9 || exit 0

do_restart() {
  local reason="$1"
  local now last
  now=$(date +%s)
  last=$(cat "$STATE_DIR/last-restart" 2>/dev/null || echo 0)
  if [ $((now - last)) -lt "$RESTART_COOLDOWN" ]; then
    # Ja hem reiniciat fa poc i segueix malament: no bucles; avisa fort un cop.
    if [ ! -f "$STATE_DIR/cooldown-alerted" ]; then
      notify "Evolution SEGUEIX caigut" "Reinici fet fa <10 min i el problema persisteix: $reason. Cal mirar-ho a mà (docker logs $CONTAINER)." high
      touch "$STATE_DIR/cooldown-alerted"
    fi
    return
  fi
  echo "$now" > "$STATE_DIR/last-restart"
  rm -f "$STATE_DIR/cooldown-alerted"
  notify "Evolution: reinici automàtic" "$reason — reiniciant el contenidor $CONTAINER. Totes les instàncies es reconnectaran soles en ~1 min." high
  docker restart "$CONTAINER" >> "$LOG_FILE" 2>&1
  # Després d'un restart, neteja tots els comptadors de fallades.
  rm -f "$STATE_DIR"/fails-* "$STATE_DIR"/global-fails
}

# --- 1) L'API respon? ------------------------------------------------------
instances_json=$(curl -sS -m 20 -H "apikey: $APIKEY" "$BASE_URL/instance/fetchInstances" 2>/dev/null)
if [ -z "$instances_json" ] || ! echo "$instances_json" | jq -e 'type == "array"' > /dev/null 2>&1; then
  fails=$(( $(cat "$STATE_DIR/global-fails" 2>/dev/null || echo 0) + 1 ))
  echo "$fails" > "$STATE_DIR/global-fails"
  log "API unreachable or bad JSON ($fails/$THRESHOLD): $(echo "$instances_json" | head -c 200)"
  if [ "$fails" -ge "$THRESHOLD" ]; then
    do_restart "l'API d'Evolution no respon"
  fi
  exit 0
fi
echo 0 > "$STATE_DIR/global-fails"

# --- 2) Recorre TOTES les instàncies ----------------------------------------
# fetchInstances (v2): array d'objectes; el nom pot venir com .name o
# .instance.instanceName i l'estat com .connectionStatus o .instance.state.
echo "$instances_json" | jq -r '.[] | [(.name // .instance.instanceName // "?"), (.connectionStatus // .instance.state // .instance.status // "?")] | @tsv' |
while IFS=$'\t' read -r name status; do
  [ "$name" = "?" ] && continue
  case " $IGNORE_INSTANCES " in *" $name "*) continue ;; esac

  state_file="$STATE_DIR/state-$name"
  fails_file="$STATE_DIR/fails-$name"
  prev_state=$(cat "$state_file" 2>/dev/null || echo "healthy")

  if [ "$status" != "open" ]; then
    # C) Desconnectada de debò (probable QR desvinculat): restart no ajuda.
    if [ "$prev_state" != "disconnected" ]; then
      notify "WhatsApp desconnectat: $name" "La instància '$name' està en estat '$status'. Un reinici NO ho arregla: segurament cal tornar a vincular el QR d'aquesta instància al manager." high
      echo "disconnected" > "$state_file"
    fi
    continue
  fi

  # B) Diu "open": comprova que el socket sigui VIU amb una operació real
  #    (onWhatsApp lookup — read-only, no envia res).
  probe=$(curl -sS -m 20 -X POST \
    -H "apikey: $APIKEY" -H "Content-Type: application/json" \
    -d "{\"numbers\":[\"$PROBE_NUMBER\"]}" \
    "$BASE_URL/chat/whatsappNumbers/$name" 2>/dev/null)

  if echo "$probe" | grep -q "Connection Closed"; then
    fails=$(( $(cat "$fails_file" 2>/dev/null || echo 0) + 1 ))
    echo "$fails" > "$fails_file"
    log "[$name] zombie ($fails/$THRESHOLD): open però Connection Closed"
    if [ "$fails" -ge "$THRESHOLD" ]; then
      echo "zombie" > "$state_file"
      do_restart "la instància '$name' està zombie (open però Connection Closed)"
    fi
  elif echo "$probe" | jq -e 'type == "array"' > /dev/null 2>&1; then
    # Sana. Si veníem d'un estat dolent, avisa de la recuperació.
    echo 0 > "$fails_file"
    if [ "$prev_state" != "healthy" ]; then
      notify "WhatsApp recuperat: $name" "La instància '$name' torna a funcionar amb normalitat." default
      echo "healthy" > "$state_file"
      rm -f "$STATE_DIR/cooldown-alerted"
    fi
  else
    # Resposta inesperada (401, canvi d'API...): log sense reiniciar — un
    # restart no arregla una mala configuració.
    log "[$name] unexpected probe response (no restart): $(echo "$probe" | head -c 200)"
  fi
done
