# Referencia original de NEXORA

[Ver lámina de identidad](nexora-reference.png).

Archivo copiado sin modificación desde la imagen adjunta por el usuario. Contiene el símbolo N geométrico, wordmark y cuatro aplicaciones visuales; conservar como referencia de comparación.

- Nombre local: `nexora-reference.png`.
- Dimensiones de la lámina: 1600 × 1200 píxeles.
- Tamaño original: 1.132.864 bytes.
- SHA-256 esperado: `27E90EFEC8F7C2D74D72247B060463E6DDDC8419D10F05283E948AF0761E4D8E`.

No usar esta lámina completa como logo reducido de la aplicación.

El 2026-11-09 el usuario autorizó extraer de la lámina el favicon y los iconos de aplicación, sin redibujar. Están en `apps/web/public/brand/` y salen del icono oficial sobre fondo oscuro, recortado en x=1141, y=184, 250 × 250 píxeles:

| Archivo | Tamaño | Fondo |
| --- | --- | --- |
| `nexora-favicon-32.png` | 32 × 32 | Esquinas transparentes |
| `nexora-icon-192.png` | 192 × 192 | Esquinas transparentes |
| `nexora-apple-touch-180.png` | 180 × 180 | Esquinas rellenas con el verde del propio icono (0, 41, 37) |

Las esquinas se enmascaran con un rectángulo redondeado inscrito (x=3, y=3, 244 × 244, radio 44) para retirar el degradado del recuadro. El resultado se comparó visualmente con la lámina. Son reducciones de un recorte de 250 píxeles, así que no sirven para tamaños mayores.

## Logo vectorial

`apps/web/public/brand/nexora-logo.svg` (versión para fondos oscuros) y `nexora-symbol.svg` son una **reconstrucción sobre esta lámina**, autorizada por el usuario el 2026-11-09. No son el archivo original de diseño.

- Símbolo: dos polígonos con simetría puntual, a partir de los vértices medidos. Degradado vertical muestreado de la lámina.
- Palabra: contorno trazado sobre la lámina, con rectas alineadas y esquinas ajustadas con curvas.
- Coincidencia por superposición con la lámina (intersección sobre unión): 99,4 % en el símbolo y 98,1 % en la palabra.

La lámina solo muestra el logo a unos 600 píxeles de ancho, y a gran tamaño se aprecian pequeñas irregularidades en las curvas de las letras. Para impresión o gran formato conviene usar el original del diseñador si existe. No hay versión para fondos claros: la lámina no la define y la interfaz aún no la necesita.

Colores, tokens y componentes propuestos están en [sistema de diseño](../docs/04-design-system.md). Esta copia conserva la referencia para futuras fases aunque se elimine el archivo temporal original.
