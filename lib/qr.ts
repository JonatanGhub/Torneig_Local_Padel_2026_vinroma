import QRCode from 'qrcode';

export async function generateBizumQrSvg(params: {
  phone: string;
  amountCents: number;
  concept: string;
}) {
  // Bizum no tiene un esquema URI estandarizado oficial; el formato más
  // ampliamente reconocido por apps bancarias españolas es texto plano
  // con teléfono, importe y concepto separados. Las apps más modernas
  // soportan deeplinks tipo `bizum://...`. Hasta que haya estándar, el
  // QR contiene texto legible que el usuario copia manualmente si su app
  // no lo entiende.
  const payload = [
    `Bizum a ${params.phone}`,
    `Importe: ${(params.amountCents / 100).toFixed(2)} €`,
    `Concepto: ${params.concept}`,
  ].join('\n');

  return QRCode.toString(payload, {
    type: 'svg',
    margin: 1,
    width: 240,
    errorCorrectionLevel: 'M',
  });
}

export async function generateConceptQrSvg(text: string) {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 1,
    width: 160,
    errorCorrectionLevel: 'L',
  });
}
