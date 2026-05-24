import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { LegalPage } from '@/components/legal/legal-page';

type Props = { params: Promise<{ locale: Locale }> };

const TEXTS = {
  ca: {
    title: 'Política de privacitat',
    updated: 'Actualitzada el 16 de maig de 2026',
    sections: [
      {
        h: '1. Responsable del tractament',
        p: `Club Pàdel Les Coves de Vinromà és el responsable del tractament de les teves dades personals en el marc del V Torneig de Pàdel les Coves de Vinromà (edició 2026). Pots contactar-nos a clubpadelvinroma@gmail.com.`,
      },
      {
        h: '2. Dades que recollim',
        p: `Per inscriure't al torneig recollim: nom i cognoms, data de naixement (per determinar minoria d'edat), correu electrònic, telèfon mòbil, nivell declarat i, si correspon, dades del tutor legal (nom, DNI, telèfon i correu). També emmagatzemem el teu consentiment exprés a aquesta política i a la publicació de resultats.`,
      },
      {
        h: '3. Finalitats',
        p: `Les teves dades s'utilitzen per: (a) gestionar la inscripció i la cobertura asseguradora del torneig; (b) comunicar-te calendari, resultats i incidències; (c) publicar resultats i classificacions amb el teu nom (consentible per separat); (d) emetre justificants i conciliar pagaments (transferència o ingrés en compte).`,
      },
      {
        h: '4. Base legal',
        p: `Tractem les dades amb base en el teu consentiment exprés (art. 6.1.a RGPD) i en la necessitat contractual de gestionar la teva participació al torneig (art. 6.1.b). El consentiment per a la publicació de resultats és revocable en qualsevol moment.`,
      },
      {
        h: '5. Cessions',
        p: `No cedim les teves dades a tercers excepte: (a) Supabase Inc. com a encarregat del tractament del nostre proveïdor de base de dades (servidors a la UE); (b) Resend Inc. per a l'enviament de correus transaccionals; (c) Vercel Inc. per a l'allotjament. Tots compleixen amb el RGPD via clàusules contractuals tipus.`,
      },
      {
        h: '6. Conservació',
        p: `Les dades personals identificables s'anonimitzen 30 dies després de la final del torneig (§30 de les bases). Els resultats i classificacions es conserven indefinidament en forma agregada/pseudonimitzada per a fins històrics i estadístics.`,
      },
      {
        h: '7. Drets',
        p: `Pots exercir els drets d'accés, rectificació, supressió, oposició, limitació i portabilitat enviant un correu a clubpadelvinroma@gmail.com indicant el dret que vols exercir. També tens dret a presentar una reclamació davant l'Agència Espanyola de Protecció de Dades (www.aepd.es).`,
      },
      {
        h: `8. Menors d'edat`,
        p: `Si el jugador té menys de 18 anys, la inscripció requereix el consentiment exprés del tutor legal, identificat amb nom complet, DNI/NIE, telèfon i correu electrònic (§32 de les bases).`,
      },
      {
        h: '9. Mesures de seguretat',
        p: `Apliquem xifrat en trànsit (HTTPS/TLS) i en repòs (Supabase PostgreSQL), control d'accés basat en rols (RLS), registre d'auditoria de canvis crítics i còpies de seguretat regulars.`,
      },
      {
        h: '10. Canvis',
        p: `Aquesta política pot actualitzar-se. Et notificarem els canvis substancials per correu electrònic abans que entrin en vigor.`,
      },
    ],
  },
  es: {
    title: 'Política de privacidad',
    updated: 'Actualizada el 16 de mayo de 2026',
    sections: [
      {
        h: '1. Responsable del tratamiento',
        p: `Club Pádel Les Coves de Vinromà es el responsable del tratamiento de tus datos personales en el marco del V Torneo de Pádel les Coves de Vinromà (edición 2026). Puedes contactarnos en clubpadelvinroma@gmail.com.`,
      },
      {
        h: '2. Datos que recogemos',
        p: `Para inscribirte al torneo recogemos: nombre y apellidos, fecha de nacimiento (para determinar minoría de edad), correo electrónico, teléfono móvil, nivel declarado y, si procede, datos del tutor legal (nombre, DNI, teléfono y correo). También almacenamos tu consentimiento expreso a esta política y a la publicación de resultados.`,
      },
      {
        h: '3. Finalidades',
        p: `Tus datos se usan para: (a) gestionar la inscripción y la cobertura aseguradora del torneo; (b) comunicarte calendario, resultados e incidencias; (c) publicar resultados y clasificaciones con tu nombre (consentible por separado); (d) emitir justificantes y conciliar pagos (transferencia o ingreso en cuenta).`,
      },
      {
        h: '4. Base legal',
        p: `Tratamos los datos con base en tu consentimiento expreso (art. 6.1.a RGPD) y en la necesidad contractual de gestionar tu participación en el torneo (art. 6.1.b). El consentimiento para la publicación de resultados es revocable en cualquier momento.`,
      },
      {
        h: '5. Cesiones',
        p: `No cedemos tus datos a terceros salvo: (a) Supabase Inc. como encargado del tratamiento de nuestro proveedor de base de datos (servidores en la UE); (b) Resend Inc. para envío de correos transaccionales; (c) Vercel Inc. para alojamiento. Todos cumplen con el RGPD vía cláusulas contractuales tipo.`,
      },
      {
        h: '6. Conservación',
        p: `Los datos personales identificables se anonimizan 30 días después de la final del torneo (§30 de las bases). Los resultados y clasificaciones se conservan indefinidamente en forma agregada/seudonimizada con fines históricos y estadísticos.`,
      },
      {
        h: '7. Derechos',
        p: `Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad enviando un correo a clubpadelvinroma@gmail.com indicando el derecho que quieres ejercer. También tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es).`,
      },
      {
        h: '8. Menores de edad',
        p: `Si el jugador tiene menos de 18 años, la inscripción requiere el consentimiento expreso del tutor legal, identificado con nombre completo, DNI/NIE, teléfono y correo electrónico (§32 de las bases).`,
      },
      {
        h: '9. Medidas de seguridad',
        p: `Aplicamos cifrado en tránsito (HTTPS/TLS) y en reposo (Supabase PostgreSQL), control de acceso basado en roles (RLS), registro de auditoría de cambios críticos y copias de seguridad regulares.`,
      },
      {
        h: '10. Cambios',
        p: `Esta política puede actualizarse. Te notificaremos los cambios sustanciales por correo electrónico antes de su entrada en vigor.`,
      },
    ],
  },
} as const;

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const data = TEXTS[locale];

  return (
    <LegalPage locale={locale} title={data.title} updatedAt={data.updated}>
      {data.sections.map((s) => (
        <section key={s.h}>
          <h2 className="font-display text-xl font-semibold text-white">{s.h}</h2>
          <p className="mt-2 text-sm leading-relaxed">{s.p}</p>
        </section>
      ))}
    </LegalPage>
  );
}
