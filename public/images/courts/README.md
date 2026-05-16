# Fotos de las pistas para el carrusel del landing

Las imágenes del carrusel usan formato PNG:

- `1.png`
- `2.png`
- `3.png`

Si las cambias a JPG/WebP/AVIF, edita `SLIDES` en `app/[locale]/page.tsx` para
que coincidan las extensiones.

Recomendaciones técnicas:

- **Dimensiones**: 1600×1200 px o superior (aspecto 4:3 o 16:10).
- **Peso**: ≤ 300 KB cada una. Usa una herramienta tipo squoosh.app o `cwebp -q 80`.
- **Contenido**: solo instalaciones (pistas, vallado, entorno). Sin personas reconocibles — §21.6 política RGPD de la edición.

El componente `CourtCarousel` (`components/brand/court-carousel.tsx`) hace un fundido
cruzado de ~1.8 s con cada slide visible ~6 s. Si añades más imágenes, edita
`SLIDES` en `app/[locale]/page.tsx`.

Mientras no estén los ficheros, el contenedor muestra un degradado granate→negro
en su lugar (no rompe nada, solo se ve apagado).
