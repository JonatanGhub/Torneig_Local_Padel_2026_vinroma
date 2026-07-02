# Operativa de WhatsApp (Evolution API)

## El problema recurrent: sessió "zombie"

Cada 1–2 dies, la sessió de Baileys (el motor de WhatsApp d'Evolution) es cau
amb `Connection Closed` (error 428 "Precondition Required" als logs del
contenidor). Quan passa:

- `connectionState` segueix dient `state: "open"` (MENTEIX — és estat en memòria)
- Tots els enviaments fallen: DMs (500), grup (400), `findGroupInfos` (404)
- Els endpoints de recuperació de l'API **no** ho arreglen:
  `restart` retorna 200 però no revifa el socket; `logout` falla amb 500;
  `delete` falla amb 400 i `create` amb 403 "already in use"
- **L'únic remei fiable és `docker restart` del contenidor.** En arrencar,
  Evolution rellegeix les credencials de la seva BD i es reconnecta sol,
  sense re-escanejar el QR.

Als logs no hi ha `loggedOut` ni `conflict` ni cap indici de baneig: les
credencials segueixen vàlides. És un bug d'estabilitat conegut de
Evolution/Baileys (el client no oficial de WhatsApp Web). L'única solució
definitiva seria migrar a l'API oficial de WhatsApp Business (Meta Cloud
API); mentrestant, l'automatització de sota fa que la caiguda es recuperi
sola en ~4 minuts.

## Capa 1 — Watchdog al VPS (auto-recuperació)

Script: [`scripts/vps/evolution-watchdog.sh`](../scripts/vps/evolution-watchdog.sh)

Cada 2 minuts fa una prova REAL contra WhatsApp (llegir la info del grup del
torneig, read-only). Si falla amb "Connection Closed" dues comprovacions
seguides, reinicia el contenidor automàticament i ho apunta a
`/var/log/evolution-watchdog.log`.

### Instal·lació (una sola vegada, al VPS com a root)

```bash
# 1. Baixa l'script del repo (o copia'l a mà)
curl -fsSL https://raw.githubusercontent.com/JonatanGhub/Torneig_Local_Padel_2026_vinroma/main/scripts/vps/evolution-watchdog.sh \
  -o /root/evolution-watchdog.sh

# 2. Edita les variables de CONFIG (sobretot APIKEY)
nano /root/evolution-watchdog.sh

# 3. Fes-lo executable i prova'l
chmod +x /root/evolution-watchdog.sh
/root/evolution-watchdog.sh
cat /var/log/evolution-watchdog.log   # hauria de dir "healthy" o res

# 4. Programa'l cada 2 minuts
(crontab -l 2>/dev/null; echo "*/2 * * * * /root/evolution-watchdog.sh") | crontab -

# 5. Verifica que el cron ha quedat
crontab -l
```

Nota: el repo és privat, així que el `curl` del pas 1 pot demanar credencials;
si és més fàcil, copia el contingut del fitxer a mà amb `nano`.

### Com saber que funciona

- `cat /var/log/evolution-watchdog.log` — cada reinici hi queda apuntat
- La propera vegada que Evolution es mori, hauria de recuperar-se sol en
  ~2–4 minuts sense que ningú faci res

## Capa 2 — Alertes per email (Vercel + GitHub Actions)

El workflow `.github/workflows/wa-health.yml` crida `/api/cron/wa-health`
cada 30 min: fa la mateixa prova real i, si falla, envia un email d'alerta
a l'admin (via Resend, independent de WhatsApp) i re-avisa cada 3h com a
màxim mentre duri la caiguda.

**⚠️ Pendent de configurar:** el workflow es salta silenciosament si el
secret no hi és. Cal afegir a GitHub:

1. Repo → Settings → Secrets and variables → Actions → New repository secret
2. Nom: `CRON_SECRET` — Valor: el mateix que a Vercel (Project Settings →
   Environment Variables → `CRON_SECRET`)

## Capa 3 — Recuperació manual (si tot lo demés falla)

1. `/admin/whatsapp-debug` → "Comprovar connexió" + "Llegir info del grup"
2. Si tot falla amb Connection Closed → SSH al VPS:
   `docker restart evolution-evolution-api-1`
3. Espera ~30 s → torna a provar "Enviar DM" des del panell
4. Re-envia les notificacions perdudes amb "Re-enviar WA" + l'UUID del partit
   (les trobaràs a `/admin/matches` o demanant-los a l'assistent)
