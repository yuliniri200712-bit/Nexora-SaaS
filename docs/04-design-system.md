# Sistema de diseño NEXORA

Guía compartida definida en Fase 0 para web, landing y Flutter. La web de Fase 1 ya tiene componentes y pantallas verificadas; ver [informe y evidencia](09-phase1.md). Landing y Flutter siguen pendientes.

## Identidad y preservación

Nombre: NEXORA. Eslogan: «Tu negocio. Todo conectado.». Personalidad: tecnológica, premium, confiable y empresarial; priorizar claridad para operaciones frecuentes de comercio.

La [lámina original](../brand/nexora-reference.png) es la fuente visual principal. Se conserva completa y sin modificar. No es un SVG ni un conjunto de assets transparentes. No se ha reconstruido la N ni sustituido el wordmark por una fuente. Favicon e iconos de aplicación se extrajeron de la lámina con autorización del usuario; el método está en el [README de marca](../brand/README.md).

Antes de integrar el logo en Fase 1: solicitar archivo maestro SVG/PDF o PNG transparente y reglas de uso, si existen. Si no existe maestro, acordar extracción desde la referencia y comparar visualmente el resultado antes de aceptarlo. No inventar trazados ni afirmar fidelidad vectorial. Esta necesidad no bloquea la planificación.

Usar logo claro sobre verde oscuro y versión oscura sobre superficie clara solo cuando esas variantes estén disponibles. Conservar proporción, no estirar, rotar, recolorear arbitrariamente ni añadir sombras al símbolo. Área de seguridad provisional: al menos 25% de la altura del símbolo a cada lado; validarla con el maestro. Tamaño mínimo se decide con pruebas de legibilidad, no reduciendo toda la lámina a un icono.

## Tokens de color

| Token propuesto | Valor | Uso |
| --- | --- | --- |
| brand.dark | #002B25 | Sidebar, hero y superficies de marca |
| brand.lime | #7CFF00 | Acento, indicador activo y detalle de CTA |
| brand.teal | #00B9B1 | Acento secundario y datos |
| brand.green | #16D68A | Acento intermedio |
| surface.base | #FFFFFF | Tarjetas, formularios y tablas |
| surface.canvas | #F5F8F7 | Fondo de aplicación |
| text.primary | #26332F | Texto principal sobre superficies claras |
| text.muted | #56665F | Texto secundario legible |
| border.subtle | #DCE5E1 | Separadores decorativos |
| border.control | #73857D | Controles que necesitan borde visible |
| focus.ring | #006D68 | Foco sobre fondo claro; sobre oscuro usar lime |
| status.success | #087448 / #E6F7EE | Texto/fondo de éxito |
| status.warning | #805500 / #FFF5D6 | Texto/fondo de advertencia |
| status.error | #B42318 / #FEF3F2 | Texto/fondo de error |

Degradado de marca: `linear-gradient(135deg, #7CFF00 0%, #16D68A 48%, #00B9B1 100%)`. Reservarlo para detalles de marca y acentos; evitar fondos de tablas o grandes áreas de lectura. No usar blanco sobre lima/turquesa para texto normal. Botón primario: fondo dark y texto blanco; variante de campaña: fondo lima y texto dark. Los badges llevan texto e icono/etiqueta, no solo color.

Objetivo de contraste: al menos 4,5:1 para texto normal y 3:1 para texto grande/controles relevantes. El contraste de tokens planos se verifica por cálculo; la accesibilidad de pantallas, estados y degradados requiere pruebas en la implementación.

La comprobación de diez pares planos pasó en Fase 0; ratios y método en [verificación](08-validation.md). No equivale a validar pantallas inexistentes.

## Tipografía, espacio y forma

- Outfit para encabezados; Inter para contenido e interfaz, con fallback sans-serif. No reemplazan el wordmark. Se empaquetan localmente con @fontsource-variable (licencia OFL-1.1), sin peticiones a servicios externos. Tokens: `--font-body`, `--font-display` y `--tracking-display`.
- Escala propuesta: 12 px metadatos, 14 px tablas, 16 px cuerpo, 20/24/32 px títulos; altura de línea 1,5 para cuerpo y 1,2 para títulos. Importes con cifras tabulares. Soportar zoom 200% y escalado de texto móvil.
- Espaciado: 4, 8, 12, 16, 24, 32 y 48 px. Grid de 8 px con ajustes de 4 px.
- Radios: 8 px inputs/botones, 12 px tarjetas, 16 px diálogos; pill solo en estados. Sombra sutil `0 4px 20px rgba(0,43,37,0.06)`.
- Controles táctiles de al menos 44 × 44 px como objetivo de producto; acciones destructivas separadas de las de uso frecuente.
- Animaciones de 120–180 ms, sin movimiento esencial; respetar prefers-reduced-motion y la preferencia equivalente en Flutter.

## Componentes y comportamiento

| Componente | Contrato de UX |
| --- | --- |
| AppShell / Sidebar / Header | Logo autorizado, comercio activo, navegación por permisos, usuario y notificaciones reales |
| Button / IconButton | primary, secondary, danger; default, hover, focus, disabled y loading; etiqueta accesible |
| Field / Select / MoneyInput / QuantityInput | Label persistente, ayuda, error asociado, requerido explícito y validación sin perder valores |
| Card / StatCard | Etiqueta, periodo, dato real y estado; no mostrar cero cuando la API falla |
| DataTable / Filters / Pagination | Encabezados, ordenación anunciada, filtros persistentes, límite de página y selección accesible |
| Badge / Alert / Toast | Estado textual, mensajes útiles; errores importantes no desaparecen solo en toast |
| Dialog / Drawer | Foco inicial y retorno, bloqueo de fondo, cierre por teclado cuando corresponda |
| Skeleton / EmptyState / ErrorState | Carga, ausencia de registros y fallo se distinguen; reintento funcional |
| Charts | Leyenda, etiquetas, valores/formato COP y resumen tabular; no depender solo del color |
| OrderTimeline / DeliveryStatus | Transiciones permitidas por API, actor/fecha y estado en curso; evitar doble envío |

Las confirmaciones se reservan para acciones irreversibles o relevantes, como cancelar un pedido o ajustar stock. Guardar muestra progreso y resultado real del servidor. Ningún botón, enlace o formulario debe aparentar una capacidad aún no implementada.

## Layout y adaptación

Escritorio desde 1024 px: sidebar de aproximadamente 248 px, header de 64 px y contenido con márgenes de 24–32 px. Tablet 768–1023 px: navegación colapsada y tarjetas en dos columnas cuando quepan. Móvil inferior a 768 px: drawer, una columna y acciones principales accesibles. Probar también 320 px, 390 px, 768 px, 1024 px y 1440 px; estos puntos son objetivos, no resultados observados.

Tablas: priorizar columnas, detalle expandible y desplazamiento horizontal etiquetado cuando sea necesario; no ocultar precios/estados críticos. Formularios no deben requerir scroll horizontal. Flutter comparte tokens y vocabulario, con controles nativos y flujo de entrega de una mano; no replica el dashboard de escritorio.

## Consistencia entre productos

La futura fuente de tokens residirá en packages/design-system con exportación CSS y Dart. Componentes React se comparten entre panel y landing; Flutter comparte valores, estados y reglas, no código de componentes web. Evitar duplicaciones manuales sin control de versión.

Landing propuesta: hero/eslogan, problema, beneficios, módulos, capturas verificadas, WhatsApp, logística, planes, FAQ, CTA y footer. Hasta tener producto, cualquier imagen conceptual se etiqueta como tal. No inventar clientes, testimonios, métricas ni conexiones activas. Publicar precios solo después de aprobar condiciones comerciales.

## Revisión visual futura

Comparar logo contra referencia; comprobar los cinco tamaños de viewport; teclado, foco y lector de pantalla; carga/vacío/error/éxito; contraste real; textos largos y COP; reduced motion y zoom; coherencia panel/landing/móvil. Guardar evidencia de navegador y Android antes de marcar esos criterios completos.
