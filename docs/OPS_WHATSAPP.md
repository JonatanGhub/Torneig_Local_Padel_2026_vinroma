# Operativa de WhatsApp (Evolution API)

## El problema recurrent: sessió "zombie"

Cada 1–2 dies, la sessió de Baileys (el motor de WhatsApp d'Evolution) d'una
instància es cau amb `Connection Closed` (error 428 "Precondition Required"
als logs del contenidor). Quan passa:

- `connectionState` segueix dient `state: "open"` (MENTEIX — és estat en memòria)
- Tots els enviaments d'aquella instància fallen: DMs (500), grup (400)
- Els endpoints de recuperació de l'API **no** ho arreglen: `restart` retorna
  200 però no revifa el socket; `logout` falla amb 500; `delete` falla amb
  400 i `create` amb 403 "already in use"
- **L'únic remei fiable és `docker restart` del contenidor.** En arrencar,
  Evolution rellegeix les credencials de la seva BD i TOTES les instàncies
  es reconnecten soles, sense re-escanejar cap QR (~1 min de tall).

Als logs no hi ha `loggedOut` ni `conflict` ni indicis de baneig: les
credencials segueixen vàlides. És un bug d'estabilitat conegut
d'Evolution/Baileys (client no oficial de WhatsApp Web). L'única solució
definitiva seria l'API oficial de WhatsApp Business (Meta Cloud API);
mentrestant, el watchdog de sota fa que qualsevol caiguda es recuperi sola
en ~4–6 minuts i t'avisa al mòbil.

## Watchdog multi-instància al VPS (auto-recuperació + avisos push)

Script: [`scripts/vps/evolution-watchdog.sh`](../scripts/vps/evolution-watchdog.sh)

Cada 3 minuts:

1. **Descobreix TOTES les instàncies** d'Evolution automàticament
   (`fetchInstances`) — les noves instàncies de clients queden cobertes
   sense tocar res.
2. Per a cada instància "open", fa una **prova REAL del socket** (consulta
   read-only "aquest número té WhatsApp?" — no envia res a ningú). El
   `connectionState` no serveix perquè menteix quan la sessió és zombie.
3. Actua segons el cas:
   - **API no respon** (contenidor penjat) → `docker restart` + push
   - **Instància zombie** (open però Connection Closed) → `docker restart` + push
   - **Instància desconnectada de debò** (close/connecting: QR desvinculat)
     → push d'avís (una vegada); el restart NO arregla això, cal re-vincular
   - **Recuperació** → push de confirmació
4. Proteccions: llindar de 2 fallades seguides (no reinicia per un microtall),
   cooldown de 10 min entre restarts (mai bucles), fitxer de pausa per a
   manteniments, `flock` contra execucions solapades, log amb rotació.

### Instal·lació pas a pas (al VPS, com a root)

```bash
# 0. Dependència
apt-get update && apt-get install -y jq

# 1. Copia l'script del repo a /root/evolution-watchdog.sh
#    (repo privat: el més senzill és copiar-lo a mà)
nano /root/evolution-watchdog.sh
#    → enganxa el contingut de scripts/vps/evolution-watchdog.sh

# 2. Edita el bloc CONFIG de l'script:
#    APIKEY        → la AUTHENTICATION_API_KEY global del docker-compose
#    CONTAINER     → docker ps  (p.ex. evolution-evolution-api-1)
#    NTFY_TOPIC    → un nom PRIVAT i impredictible, p.ex. evo-vinroma-x7k2m9q4
#    PROBE_NUMBER  → qualsevol número amb WhatsApp (per defecte el del club)

# 3. Permisos i prova manual
chmod +x /root/evolution-watchdog.sh
/root/evolution-watchdog.sh
cat /var/log/evolution-watchdog.log   # buit o sense errors = tot sa

# 4. Programa'l cada 3 minuts
(crontab -l 2>/dev/null; echo "*/3 * * * * /root/evolution-watchdog.sh") | crontab -
crontab -l   # verifica

# 5. Avisos al mòbil: instal·la l'app "ntfy" (Android/iOS o https://ntfy.sh)
#    i subscriu-te al tema que has posat a NTFY_TOPIC. Fes una prova:
curl -d "Prova del watchdog" https://ntfy.sh/EL_TEU_TOPIC
```

### Prova de foc (opcional però recomanada)

```bash
docker stop evolution-evolution-api-1
# Espera ~6-7 min: el watchdog ha de detectar-ho, arrencar-lo sol i
# enviar-te el push "Evolution: reinici automàtic".
tail -f /var/log/evolution-watchdog.log
```

### Manteniments (evitar que el watchdog interfereixi)

```bash
touch /tmp/evolution-watchdog-pause    # pausa el watchdog
# ... fes el manteniment ...
rm /tmp/evolution-watchdog-pause       # reactiva'l
```

## Recuperació manual (si mai cal)

1. `/admin/whatsapp-debug` → "Comprovar connexió" + "Llegir info del grup"
2. Si tot falla amb Connection Closed → SSH al VPS:
   `docker restart evolution-evolution-api-1`
3. Espera ~30 s → prova "Enviar DM" des del panell
4. Re-envia les notificacions perdudes amb "Re-enviar WA" + l'UUID del partit

## Nota històrica

Hi havia una capa d'alertes per email via GitHub Actions
(`.github/workflows/wa-health.yml` → `/api/cron/wa-health`), retirada el
2026-07-02 en favor del watchdog del VPS amb push ntfy (més directe i sense
dependre de secrets de GitHub). L'endpoint `/api/cron/wa-health` segueix
existint per si es vol reactivar.
