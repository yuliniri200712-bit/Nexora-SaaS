# Referencia original de NEXORA

[Ver lámina de identidad](nexora-reference.png).

Archivo copiado sin modificación desde la imagen adjunta por el usuario. Contiene el símbolo N geométrico, wordmark y cuatro aplicaciones visuales; conservar como referencia de comparación.

- Nombre local: `nexora-reference.png`.
- Dimensiones de la lámina: 1600 × 1200 píxeles.
- Tamaño original: 1.132.864 bytes.
- SHA-256 esperado: `27E90EFEC8F7C2D74D72247B060463E6DDDC8419D10F05283E948AF0761E4D8E`.

No se ha redibujado ni vectorizado ningún logotipo. No usar esta lámina completa como logo reducido de la aplicación.

El 2026-11-09 el usuario autorizó extraer de la lámina el favicon y los iconos de aplicación, sin redibujar. Están en `apps/web/public/brand/` y salen del icono oficial sobre fondo oscuro, recortado en x=1141, y=184, 250 × 250 píxeles:

| Archivo | Tamaño | Fondo |
| --- | --- | --- |
| `nexora-favicon-32.png` | 32 × 32 | Esquinas transparentes |
| `nexora-icon-192.png` | 192 × 192 | Esquinas transparentes |
| `nexora-apple-touch-180.png` | 180 × 180 | Esquinas rellenas con el verde del propio icono (0, 41, 37) |

Las esquinas se enmascaran con un rectángulo redondeado inscrito (x=3, y=3, 244 × 244, radio 44) para retirar el degradado del recuadro. El resultado se comparó visualmente con la lámina. Son reducciones de un recorte de 250 píxeles, así que no sirven para tamaños mayores.

En Fase 1 se muestra el logo original mediante un encuadre CSS de la misma imagen, sin transformar el archivo. Se comparó visualmente su uso en la captura de escritorio. El maestro vectorial continúa pendiente; no se afirma haberlo reconstruido.

Colores, tokens y componentes propuestos están en [sistema de diseño](../docs/04-design-system.md). Esta copia conserva la referencia para futuras fases aunque se elimine el archivo temporal original.
