# Configuración de dominio en Resend

Cómo dejar las notificaciones por email listas para producción una vez compres
`clubpadellescoves.com`.

## Estado actual

- Cuenta Resend: `clubpadelvinroma@gmail.com`.
- Remitente actual: `onboarding@resend.dev` (sandbox de Resend).
- **Limitación**: en modo sandbox Resend solo entrega emails al correo con el
  que creaste la cuenta (es decir, `clubpadelvinroma@gmail.com`). Si la app
  intenta enviar a un capitán con `marc@gmail.com` o similar, Resend lo
  rechaza silenciosamente.
- Consecuencia práctica:
  - ✅ Emails de **disputa** (admin) llegan, porque `ADMIN_NOTIFICATION_EMAIL`
    es `clubpadelvinroma@gmail.com` (mismo email que la cuenta Resend).
  - ❌ Emails de **reschedule** al rival y **validated** a capitanes no llegan
    en sandbox.

## Pasos cuando ya tengas el dominio

### 1. Compra el dominio

Recomendado: comprar `clubpadellescoves.com` en un registrar moderno con DNS
integrado.

| Registrar            | Coste aprox.                 | Notas                                                            |
| -------------------- | ---------------------------- | ---------------------------------------------------------------- |
| Cloudflare Registrar | ~$10/año (a precio de coste) | Excelente DNS gratis y panel rápido. Requiere cuenta Cloudflare. |
| Namecheap            | ~$8-12/año                   | Sencillo, panel decente.                                         |
| Porkbun              | ~$10/año                     | Barato, fiable.                                                  |

### 2. Añade el dominio en Resend

1. Entra en https://resend.com/domains con la cuenta `clubpadelvinroma@gmail.com`.
2. Click **Add Domain** → introduce `clubpadellescoves.com`.
3. Selecciona la región **EU (Frankfurt)** para cumplir con RGPD.
4. Resend te muestra 3 registros DNS que tienes que añadir. Tendrán esta forma
   (los valores exactos te los dará Resend, NO uses estos):

   ```
   TYPE: TXT
   NAME: send.clubpadellescoves.com
   VALUE: v=spf1 include:amazonses.com ~all

   TYPE: CNAME
   NAME: resend._domainkey.clubpadellescoves.com
   VALUE: resend._domainkey.amazonses.com

   TYPE: TXT (opcional pero recomendado, DMARC)
   NAME: _dmarc.clubpadellescoves.com
   VALUE: v=DMARC1; p=none; rua=mailto:clubpadelvinroma@gmail.com
   ```

### 3. Añade los registros DNS en tu registrar

Entra en el panel DNS del registrar donde compraste el dominio y añade los 3
registros tal cual te los dio Resend. **No traduzcas los valores, cópialos
exactos.**

- Si usas Cloudflare como DNS: activa el toggle "Proxy" en gris (DNS only) para
  los registros de email, NO en naranja.

### 4. Verifica en Resend

Vuelve a https://resend.com/domains y pulsa **Verify**. Pueden tardar entre 1
minuto y 1 hora en propagarse. Si no verifica:

- Comprueba que escribiste el `name` sin el dominio al final si el panel del
  registrar lo añade automáticamente (errores típicos: ponerlo como
  `send.clubpadellescoves.com.clubpadellescoves.com`).
- Espera 30 min más. Algunos registrars son lentos.

### 5. Configura variables de entorno en Vercel

Una vez `clubpadellescoves.com` aparezca como **verified** en Resend:

| Variable                   | Valor                                                                         |
| -------------------------- | ----------------------------------------------------------------------------- |
| `RESEND_FROM_EMAIL`        | `Torneig Pàdel Les Coves <noreply@clubpadellescoves.com>`                     |
| `ADMIN_NOTIFICATION_EMAIL` | `clubpadelvinroma@gmail.com` (sigue igual)                                    |
| `NEXT_PUBLIC_SITE_URL`     | `https://clubpadellescoves.com` (cuando tengas la web pública en ese dominio) |

Aplica en **Vercel → Project → Settings → Environment Variables**. Marca el
scope `Production`. Después haz un redeploy desde Deployments.

### 6. Prueba

1. Login como capitán A.
2. Propón un cambio de fecha al capitán B (otro player con email distinto).
3. El capitán B debería recibir email en su bandeja **desde
   `noreply@clubpadellescoves.com`**.
4. Si va a spam la primera vez, marca "no es spam" y los siguientes deberían
   llegar a la bandeja principal. Con DMARC + DKIM + SPF Gmail/Outlook lo
   aceptan rápido.

## Migrar la web a clubpadellescoves.com

Cuando tengas el dominio y la web esté lista:

1. En Vercel → Settings → Domains → Add `clubpadellescoves.com`.
2. Vercel te indica si añadir un registro `A` o `CNAME` en tu DNS. Lo añades.
3. Vercel emite un certificado SSL automáticamente (Let's Encrypt).
4. Actualiza `NEXT_PUBLIC_SITE_URL` en Vercel a `https://clubpadellescoves.com`
   para que los CTA buttons de los emails apunten ahí.
5. En Supabase Dashboard → Authentication → URL Configuration, cambia
   "Site URL" a `https://clubpadellescoves.com` para que los magic links
   redirijan correctamente. Añade también la URL antigua de Vercel a las
   "Redirect URLs" allow-list por si acaso.

## Coste total

- Dominio: ~$10/año
- Resend free tier: 3.000 emails/mes, 100/día. Para 30 parejas con ~5 partidos
  cada una es de sobra.
- Vercel custom domain: gratis.
- Supabase free tier: ya cubierto.
