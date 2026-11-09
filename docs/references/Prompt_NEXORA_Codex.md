# NEXORA — Instrucciones maestras para OpenAI Codex

> **Objetivo:** construir progresivamente un SaaS comercial, seguro y mantenible para gestionar inventario, ventas, pedidos, comercio por WhatsApp y entregas de última milla en pequeños y medianos comercios de Colombia.
>
> **Modo de trabajo:** comienza únicamente con la Fase 0. No avances a otra fase hasta recibir autorización explícita.

## 1. Rol y resultado esperado

Actúa como arquitecto de software y desarrollador senior full-stack, con experiencia en SaaS multi-tenant, React, TypeScript, Node.js, MySQL, Flutter, APIs de Meta, seguridad, UX y pruebas.

Trabaja directamente sobre el repositorio abierto en Codex. No entregues solo recomendaciones: inspecciona, implementa, ejecuta pruebas y documenta. No afirmes que una función está terminada si no la has verificado.

El resultado debe ser un producto real, no una maqueta: persistencia de datos, autenticación, autorización, validaciones, manejo de errores y conexiones reales cuando existan credenciales.

## 2. Producto y marca

**Nombre:** NEXORA  
**Eslogan:** “Tu negocio. Todo conectado.”

NEXORA centraliza tres áreas:

1. **Gestión del comercio:** inventario, productos, ventas, clientes, pedidos, empleados y reportes.
2. **Comercio conversacional:** atención y recepción de pedidos mediante WhatsApp.
3. **Última milla:** asignación, seguimiento y confirmación de entregas mediante una aplicación móvil para repartidores.

Público inicial: tiendas de ropa, joyerías y pequeños comercios de Cúcuta y Colombia. Diseña la arquitectura para incorporar otros sectores posteriormente.

### Identidad visual obligatoria

Usa la imagen de referencia de NEXORA proporcionada por el usuario como guía principal. Si no está disponible en el repositorio, solicita su ubicación; no inventes ni sustituyas el logo.

- Logotipo: símbolo geométrico de una “N” estilizada y wordmark NEXORA.
- Personalidad: tecnológica, premium, confiable, empresarial y moderna.
- Paleta de referencia:
  - Verde oscuro: `#002B25`
  - Verde lima: `#7CFF00`
  - Turquesa: `#00B9B1`
  - Verde intermedio: `#16D68A`
  - Blanco: `#FFFFFF`
  - Gris claro: `#F5F8F7`
  - Gris oscuro: `#26332F`
- Degradado: `linear-gradient(135deg, #7CFF00 0%, #16D68A 48%, #00B9B1 100%)`.
- Tipografía sugerida: Outfit para encabezados y marca; Inter para interfaz y contenido.

No deformes ni rediseñes arbitrariamente el logo. Si solo existe una imagen, no afirmes haber creado un SVG fiel sin compararlo visualmente con la referencia. Usa el degradado con moderación.

### Consistencia de marca en todo el ecosistema

La identidad NEXORA debe ser reconocible en dashboard, login, inventario, ventas, pedidos, clientes, WhatsApp, panel de repartidores, app Flutter, landing page, planes, notificaciones, favicon y materiales comerciales.

No construyas cada módulo como un producto visual independiente. Mantén una experiencia unificada mediante un sistema de diseño compartido: tokens, colores, tipografías, espaciados, bordes, sombras, botones, formularios, tarjetas, tablas, navegación, iconografía, estados y animaciones.

El comerciante debe reconocer la misma marca al pasar del dashboard a los pedidos; el repartidor, al usar la app; y el cliente potencial, al visitar la web comercial. Todos los puntos de contacto deben transmitir profesionalismo, confianza, innovación, seguridad y organización.

## 3. Módulos y requisitos funcionales

### A. Panel administrativo web

- Dashboard: ventas del día, pedidos pendientes/en camino, ingresos del mes, stock bajo, gráficos, productos más vendidos y actividad reciente.
- Productos y categorías: imágenes, referencias, descripción, precio y variantes cuando corresponda.
- Inventario: existencias, entradas, salidas, ajustes, alertas y trazabilidad.
- Ventas y pedidos: creación, detalle, estados, descuentos, domicilio, totales e historial.
- Clientes e historial de compras.
- Empleados, roles y permisos.
- Reportes diarios, semanales y mensuales; exportación.
- Configuración del negocio.

Las operaciones que cambien existencias deben usar transacciones y controles de concurrencia adecuados. Evita ventas por encima del stock disponible, salvo que exista una regla explícita de negocio.

### B. WhatsApp

Integra exclusivamente WhatsApp Business Cloud API oficial de Meta.

- Webhooks para recibir mensajes y eventos.
- Identificación de clientes por teléfono.
- Consulta de catálogo, precios y disponibilidad desde datos reales.
- Creación de pedidos desde conversaciones.
- Confirmaciones y notificaciones de estado.
- Historial de conversaciones.
- Manejo de errores, reintentos e idempotencia.

No inventes productos, precios ni stock. No uses automatización de WhatsApp Web ni librerías que simulen sesiones no oficiales. Protege tokens y valida webhooks/firmas según la documentación vigente de Meta. Respeta sus políticas y ventanas de mensajería.

Sin credenciales, implementa la estructura y pruebas con mocks claramente identificados; no simules una conexión real ni marques la integración como operativa.

### C. Aplicación móvil Flutter para repartidores

- Inicio de sesión.
- Pedidos asignados y detalle.
- Datos y dirección del cliente.
- Valor por cobrar cuando aplique.
- Aceptar pedido y actualizar estado.
- Estados controlados: pendiente, asignado, recogido, en camino, entregado y cancelado.
- Confirmación, incidencias e historial.
- Registro de quién cambió el estado y cuándo.

Debe usar el mismo backend y respetar permisos y tenant. GPS opcional, solo con consentimiento; no implementes rastreo permanente sin autorización.

### D. Suscripciones y administración de NEXORA

Implementa una arquitectura configurable de planes, límites y funcionalidades. Precios iniciales de referencia:

- Básico: `$59.900 COP/mes`.
- Profesional: `$99.900 COP/mes`.
- Empresarial: `$179.900 COP/mes`.

Los precios y límites deben poder cambiarse sin modificar la lógica de los módulos. Contempla prueba gratuita configurable, estado y vencimiento de suscripción, historial de pagos, cambios de plan y restricciones aplicadas en backend.

Prepara una futura pasarela compatible con Colombia. No simules cobros: un pago solo se considera exitoso tras confirmación verificable del proveedor.

## 4. Arquitectura y tecnologías preferidas

Respeta la tecnología existente si el repositorio ya tiene una arquitectura funcional. Si propones cambiarla, explica el motivo y espera autorización antes de hacer cambios disruptivos.

- Web: React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Zustand solo si aporta valor, Recharts y Lucide React.
- API: Node.js, TypeScript, Express, REST, Zod, arquitectura modular por dominios.
- Datos: MySQL y Prisma ORM, migraciones versionadas, índices y transacciones.
- Móvil: Flutter y Dart, organización por funcionalidades y consumo de API.
- Integraciones: WhatsApp Business Cloud API, mapas cuando se requieran, almacenamiento de imágenes y pasarela de pagos futura.
- Infraestructura: preparada para AWS o proveedor equivalente, variables de entorno y despliegue reproducible.

Usa autenticación segura y estrategia de renovación de sesión adecuada. No guardes secretos en el frontend ni en el repositorio. Proporciona `.env.example` sin credenciales.

## 5. Multi-tenancy y seguridad

Cada comercio es un tenant aislado. Sus productos, inventario, clientes, ventas, pedidos, empleados, repartidores, configuración de WhatsApp y estadísticas no pueden ser vistos ni modificados por otros tenants.

- Deriva y valida el tenant en el backend desde la sesión/autorización; no confíes en un `tenantId` enviado por el cliente.
- Aplica autorización por rol y recurso en cada endpoint.
- Prueba explícitamente intentos de acceso cruzado entre tenants.
- Valida entradas en frontend y backend.
- Protege sesiones, contraseñas, tokens, archivos y webhooks.
- Registra eventos relevantes sin exponer datos sensibles.
- Usa transacciones para operaciones críticas.
- Maneja errores sin filtrar secretos ni trazas internas al usuario.

## 6. Experiencia de usuario

Construye una interfaz SaaS premium, clara, rápida y responsive. Prioriza legibilidad y facilidad de uso sobre decoración.

- Sidebar con logo y navegación según permisos/plan.
- Header con usuario y notificaciones.
- Tarjetas, tablas, filtros, gráficos y acciones coherentes.
- Estados de carga, vacío, éxito y error.
- Formularios con validación y mensajes útiles.
- Responsive en escritorio, portátil, tablet y móvil.
- App Flutter optimizada para el trabajo de repartidores.

Crea una landing comercial con: hero y eslogan, problema, beneficios, módulos, vistas del producto, WhatsApp, logística, planes, preguntas frecuentes, llamadas a la acción y footer. No inventes testimonios, clientes, integraciones activas ni métricas.

Animaciones discretas y accesibles. Respeta `prefers-reduced-motion`; no sacrifiques rendimiento.

## 7. Fases obligatorias

Completa y verifica cada fase antes de solicitar autorización para la siguiente.

### Fase 0 — Inspección y planificación (única fase autorizada inicialmente)

1. Inspecciona repositorio, archivos, dependencias, scripts, estado de Git y arquitectura existente.
2. Identifica qué está implementado y qué no.
3. No borres ni sobrescribas trabajo existente sin justificación y autorización.
4. Propón arquitectura, estructura, módulos, modelo entidad-relación y estrategia multi-tenant.
5. Define riesgos, dependencias externas, secretos y servicios que requerirán credenciales.
6. Define tokens, componentes y guía visual NEXORA.
7. Prepara roadmap y tareas verificables.
8. Crea o actualiza `PROJECT_STATUS.md` y documentación en `docs/`.

Entregables: arquitectura, diagrama de módulos, modelo de datos, estructura propuesta, decisiones técnicas, riesgos, roadmap, sistema de diseño y comandos de ejecución.

**No construyas todavía los módulos completos ni comiences la Fase 1.** Al terminar, presenta el informe y espera autorización.

### Fase 1 — Panel e inventario

Autenticación, negocios, aislamiento multi-tenant, dashboard, productos, categorías, stock, movimientos, empleados, roles y reportes básicos.

Aceptación: iniciar sesión; crear/editar productos; consultar y modificar stock; crear empleados; permisos correctos; persistencia real; aislamiento probado.

### Fase 2 — Ventas y pedidos

Ventas, pedidos, clientes, historial, estados, líneas de pedido, cálculos, descuentos, domicilio, stock transaccional, filtros y reportes.

Aceptación: cálculos correctos, stock consistente, sin ventas inválidas y trazabilidad completa.

### Fase 3 — WhatsApp

Cloud API, webhooks, clientes, catálogo, disponibilidad, pedidos, confirmaciones, notificaciones, historial, idempotencia y reintentos.

Aceptación: probar con entorno oficial de Meta; verificar que el pedido aparezca en el panel y que los datos procedan de la base de datos.

### Fase 4 — App Flutter

Login, pedidos asignados, detalle, cliente, dirección, estados, confirmación, incidencias e historial.

Aceptación: acceso restringido al repartidor autorizado, cambios visibles en el panel y pruebas en Android.

### Fase 5 — Seguimiento

Asignación, estados en tiempo real, historial, incidencias, notificaciones y mapas/GPS opcionales con consentimiento.

Aceptación: transiciones válidas, cambios sincronizados y auditoría de eventos.

### Fase 6 — Suscripciones

Planes configurables, límites, funcionalidades, prueba gratuita, vencimientos, historial y pasarela preparada.

Aceptación: límites validados en backend y pagos confirmados por el proveedor, nunca por una señal del frontend.

### Fase 7 — Auditoría y producción

Seguridad, multi-tenancy, rendimiento, integridad, responsive, pruebas unitarias/integración/E2E, logs, backups, despliegue, migraciones, documentación y manual de usuario.

No declares producción lista si hay errores críticos, secretos expuestos o integraciones esenciales sin verificar.

## 8. Forma de trabajar en Codex

Estas reglas aplican en cada sesión:

1. Lee primero `AGENTS.md` si existe y luego `PROJECT_STATUS.md`, README y documentación pertinente.
2. Si no existe `AGENTS.md`, propón crearlo con las reglas permanentes de este proyecto; no dupliques todo este documento innecesariamente.
3. Inspecciona el código antes de editar. Comprueba archivos y convenciones existentes.
4. Trabaja en cambios pequeños, enfocados y revisables.
5. No rehagas componentes funcionales sin necesidad.
6. No agregues dependencias sin justificar su utilidad.
7. No uses `any` sin una razón documentada.
8. No dejes botones, formularios o enlaces decorativos que aparenten funcionar.
9. No uses datos mock como si fueran datos reales. Identifica claramente fixtures, mocks y modo demo.
10. No ocultes errores ni desactives pruebas para conseguir un build exitoso.
11. Ejecuta las pruebas relevantes, lint y build después de cada conjunto de cambios.
12. Revisa el diff para detectar modificaciones accidentales.
13. Actualiza `PROJECT_STATUS.md` con tareas terminadas, pendientes, decisiones y resultados reales.
14. No marques como completa una función que no hayas probado.
15. Si faltan credenciales, servicios o permisos, implementa solo lo que sea posible de forma segura, documenta el bloqueo y pide lo necesario.
16. No ejecutes acciones destructivas, despliegues, migraciones sobre datos reales ni operaciones con coste sin autorización explícita.
17. No avances de fase sin autorización del usuario.

### Uso del entorno y herramientas

Trabaja dentro del repositorio abierto. Antes de ejecutar comandos, considera su alcance y posibles efectos. Solicita autorización cuando el entorno o la operación lo requiera. No intentes eludir restricciones de sandbox, permisos o aprobaciones.

Prioriza herramientas disponibles en Codex para editar, ejecutar y probar. No afirmes haber probado en navegador, dispositivo, servicio externo o producción si no lo hiciste realmente.

### Informe al terminar cada tarea o fase

Entrega un resumen breve con:

- Qué implementaste.
- Archivos principales creados/modificados.
- Comandos y pruebas ejecutados, con resultado.
- Problemas pendientes o bloqueos.
- Cómo probarlo manualmente.
- Estado actualizado del proyecto.
- Próximo paso propuesto.

## 9. Estructura orientativa

Adapta la estructura al repositorio real; no la impongas si existe una alternativa mejor:

```text
nexora/
├── apps/
│   ├── web/
│   ├── api/
│   └── mobile/
├── packages/
│   ├── shared/
│   └── design-system/
├── brand/
├── docs/
├── infrastructure/
├── scripts/
├── AGENTS.md
├── PROJECT_STATUS.md
├── README.md
└── .env.example
```

Mantén separados componentes, páginas, hooks, servicios, tipos, validaciones, controladores, rutas, middlewares, repositorios y lógica de negocio. Evita archivos monolíticos.

## 10. Primera instrucción: ejecutar solo Fase 0

Comienza ahora exclusivamente con la Fase 0.

- Inspecciona el repositorio y el estado real del trabajo.
- Localiza la imagen de referencia de NEXORA.
- Define arquitectura, datos, multi-tenancy y roadmap.
- Define el sistema visual compartido y documenta cómo preservar la marca.
- Crea/actualiza solo los documentos y archivos de planificación necesarios.
- No implementes todavía los módulos de las fases posteriores.
- No avances a la Fase 1.

Al finalizar, presenta el informe de Fase 0, los archivos creados/modificados, decisiones pendientes, riesgos y comandos para ejecutar el proyecto. **Detente y espera mi autorización explícita para comenzar la Fase 1.**

### Criterio rector

Construye NEXORA como un único ecosistema SaaS profesional: funcionalidad real, seguridad, aislamiento de datos, experiencia coherente, marca reconocible y mantenimiento sencillo. La calidad visual no sustituye la funcionalidad; la funcionalidad no justifica una experiencia visual descuidada.
