#!/usr/bin/env bash
# =========================================================================
# evolution-watchdog.sh — auto-recuperació de la sessió zombie d'Evolution
#
# PROBLEMA QUE RESOL
#   Evolution/Baileys entra periòdicament en estat "zombie": la instància
#   diu state:"open" però el socket real amb WhatsApp és mort, i TOT retorna
#   "Connection Closed" (DMs 500, grup 400, findGroupInfos 404). Ni
#   /instance/restart ni /instance/logout ni delete+create la desencallen
#   (delete 400, create 403 "already in use"). L'ÚNIC remei fiable comprovat
#   és reiniciar el CONTENIDOR Docker: en arrencar de nou, Evolution rellegeix
#   les credencials de la BD i es reconnecta sol, sense re-escanejar el QR.
#
# QUÈ FA
#   1. Prova una operació REAL contra WhatsApp (findGroupInfos del grup del
#      torneig — read-only, no envia res). /instance/connectionState no
#      serveix perquè menteix (retorna "open" amb el socket mort).
#   2. Si respon "Connection Closed" DUES comprovacions seguides (evita
#      reiniciar per un tall puntual de xarxa), fa `docker restart` del
#      contenidor i ho apunta al log.
#
# INSTAL·LACIÓ (al VPS, com a root — veure docs/OPS_WHATSAPP.md)
#   1. Copia aquest fitxer a /root/evolution-watchdog.sh
#   2. Edita les 4 variables de CONFIG de sota
#   3. chmod +x /root/evolution-watchdog.sh
#   4. Prova'l a mà:  /root/evolution-watchdog.sh && cat /var/log/evolution-watchdog.log
#   5. Programa'l cada 2 minuts:
#        (crontab -l 2>/dev/null; echo "*/2 * * * * /root/evolution-watchdog.sh") | crontab -
# =========================================================================

set -u

# ----- CONFIG (edita això) ------------------------------------------------
APIKEY="POSA_AQUI_EVOLUTION_API_KEY"
INSTANCE="GESTIO-TORNEIG-VINROMA"
GROUP_JID="120363043943785701@g.us"
CONTAINER="evolution-evolution-api-1"
# URL d'Evolution DES DEL VPS. Si el contenidor publica el port en local,
# http://localhost:8080 és més robust (no depèn del reverse proxy).
BASE_URL="https://evo.neonexai.com"
# ---------------------------------------------------------------------------

FAILS_FILE="/tmp/evolution-watchdog-fails"
LOG_FILE="/var/log/evolution-watchdog.log"
THRESHOLD=2 # comprovacions consecutives fallides abans de reiniciar

log() { echo "$(date -Is) $*" >> "$LOG_FILE"; }

resp=$(curl -sS -m 20 -H "apikey: $APIKEY" \
  "$BASE_URL/group/findGroupInfos/$INSTANCE?groupJid=$GROUP_JID" 2>&1)
curl_rc=$?

if [ $curl_rc -ne 0 ]; then
  # Evolution no respon gens (contenidor caigut/penjat) → també compta com a fallada.
  state="unreachable (curl rc=$curl_rc)"
  failed=1
elif echo "$resp" | grep -q "Connection Closed"; then
  state="zombie (Connection Closed)"
  failed=1
elif echo "$resp" | grep -q '"subject"'; then
  state="healthy"
  failed=0
else
  # Resposta inesperada (p.ex. 401 apikey incorrecta): loguem però NO reiniciem,
  # perquè reiniciar no arreglaria una mala configuració.
  log "unexpected response (no restart): $(echo "$resp" | head -c 300)"
  exit 0
fi

if [ $failed -eq 0 ]; then
  # Sa: reseteja el comptador (només escrivim si calia, per no desgastar disc).
  if [ -s "$FAILS_FILE" ] && [ "$(cat "$FAILS_FILE")" != "0" ]; then
    log "recovered: $state"
    echo 0 > "$FAILS_FILE"
  fi
  exit 0
fi

fails=$(( $(cat "$FAILS_FILE" 2>/dev/null || echo 0) + 1 ))
echo "$fails" > "$FAILS_FILE"
log "check failed ($fails/$THRESHOLD): $state"

if [ "$fails" -ge "$THRESHOLD" ]; then
  log "RESTARTING container $CONTAINER"
  docker restart "$CONTAINER" >> "$LOG_FILE" 2>&1
  echo 0 > "$FAILS_FILE"
  log "restart issued; Evolution es reconnectarà sol amb les credencials guardades"
fi
