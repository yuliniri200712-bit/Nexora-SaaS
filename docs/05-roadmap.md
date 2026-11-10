# Roadmap y aceptación

Fases 1 y 2 autorizadas e implementadas para validación local. Fase 3 redefinida como tienda en línea el 2026-11-10; su implementación aún no está autorizada. Cada fase termina con estado actualizado, evidencia y limitaciones. No se estiman fechas sin conocer capacidad, alcance comercial y dependencias.

## Fase 0 — Inspección y planificación

- [x] Inspeccionar carpeta, Git, archivos, dependencias y herramientas accesibles.
- [x] Identificar ausencia de implementación previa.
- [x] Documentar arquitectura, diagrama de módulos, estructura y decisiones.
- [x] Definir modelo ER, invariantes e índices propuestos.
- [x] Definir aislamiento, permisos, autenticación y pruebas futuras.
- [x] Conservar referencia original y especificar sistema de diseño.
- [x] Definir servicios, secretos, riesgos, roadmap y comandos.
- [x] Crear README, PROJECT_STATUS y propuesta de AGENTS.md.
- [x] Recibir autorización explícita para Fase 1.

## Fase 1 — Base, panel e inventario

Estado: implementada y verificada en entorno local. [Informe y límites](09-phase1.md). Correo externo/hosting no se presentan como conectados; no hubo credenciales para esos servicios.

Orden recomendado de incrementos, cada uno con revisión y estado actualizado:

1. Adoptar reglas del repositorio; inicializar Git local si se autoriza al comenzar implementación. Fijar versiones compatibles y lockfile, npm workspaces, web/API, TypeScript, lint, formato, CI y configuración validada. Crear .gitignore y .env.example sin secretos. Validar MySQL + Prisma con migración y rollback de una transacción en base desechable.
2. Identidad, tenant, membresías, roles, invitaciones, recuperación y sesiones. Migraciones incrementales e integración MySQL real. Probar tenant A contra B desde la primera entidad.
3. Sistema visual, login y shell responsive usando assets de marca aprobados; formularios accesibles y estados de red.
4. Categorías, productos, SKU/variantes, imágenes y una ubicación inicial. Validar permisos y persistencia tras reiniciar API.
5. Saldos, entradas/salidas/ajustes, alertas y movimientos auditados; validación transaccional y pruebas concurrentes.
6. Empleados y roles; dashboard de inventario y reportes básicos reales. Métricas de ventas/pedidos quedan pendientes de Fase 2; no mostrar cifras inventadas ni cero como funcionalidad simulada.

Aceptación: login/logout/renovación funcionan; propietario crea empleado; usuario sin permiso es rechazado; CRUD de producto y stock persiste; intentos cruzados fallan en API y relaciones DB; balances y movimientos coinciden; lint, typecheck, unitarias, integración, build y E2E principales pasan. Capturas y pruebas manuales documentadas. Sin WhatsApp, ventas, Flutter o cobros implementados anticipadamente.

## Fase 2 — Ventas, clientes y pedidos

Estado: implementada y verificada en entorno local. [Informe, decisiones pendientes y límites](10-phase2.md).

Tareas: clientes/direcciones; precios snapshot; líneas, descuentos, domicilio y totales; venta directa; borrador/confirmación/cancelación/completado; reservas y consumo; historial; filtros; reportes y exportación segura. Incorporar métricas reales de ventas al dashboard.

Aceptación: cálculos decimales y redondeos con casos límite; última unidad concurrente con un solo éxito; idempotencia tras timeout; cancelación libera una vez; salidas no duplicadas; aislamiento en reportes/exportaciones; devolución no repone sin confirmación física. Todos los cambios dejan actor y fecha.

## Fase 3 — Tienda en línea

Decisión del usuario, 2026-11-10: la tienda en línea reemplaza la integración con WhatsApp y el bot de WhatsApp se elimina del roadmap. Meta exigió verificar el negocio y restringió la cuenta de prueba (error 131031) antes de permitir mensajes. No se usarán automatizaciones no oficiales de WhatsApp Web.

Tareas:

- Página pública por comercio con dirección propia, activable y desactivable desde Configuración. Catálogo con productos activos, fotos, precios y cantidad disponible exacta (existencias menos reservas).
- Carrito con mostrador o domicilio, dirección, datos de contacto y autorización expresa del tratamiento de datos personales.
- Resumen y confirmación explícita del cliente. El pedido entra como borrador del canal «En línea», sin reservar existencias, con número de seguimiento.
- El comercio lo revisa y confirma desde el panel; la confirmación reserva existencias con las reglas de Fase 2. Si ya no alcanzan, se rechaza sin sobreventa y el pedido puede ajustarse o cancelarse.
- Página de seguimiento con enlace no adivinable: recibido, confirmado, pagado, completado o cancelado.
- Métodos de pago: contraentrega y pago en línea. El pago en línea se habilita cuando el comercio confirma el pedido, mediante una pasarela colombiana en modo de prueba; solo el webhook verificado del proveedor marca un pago, nunca la redirección del navegador. La contraentrega se registra como cobro manual al completar el pedido.
- Enlace «Escribir por WhatsApp» con el número del pedido hacia el número que configure el comercio. Es un enlace wa.me para atención humana, no una integración.
- Protección contra abuso: límites por visitante y comercio, validación estricta, envío idempotente y sin reservas hasta la confirmación del comercio.

Dependencias: pasarela de pagos colombiana con credenciales de prueba; HTTPS público para webhooks de pago y para que los clientes accedan. Mientras no haya hosting, la validación es local, con túnel para los webhooks de prueba. Cobros reales requieren autorización separada.

Decisiones pendientes: pasarela y si cada comercio usa su propia cuenta; plazo para pagar un pedido confirmado con pago en línea antes de cancelarlo y liberar existencias; costo de domicilio en la tienda; impuestos y precio final; devoluciones y reembolsos de pagos en línea.

Aceptación: el catálogo público muestra solo productos activos y existencias reales del comercio, nunca de otro; el pedido del cliente aparece en el panel como borrador sin reservar; un reenvío no lo duplica; confirmar sin existencias no sobrevende; un pago de prueba confirmado por webhook marca el pedido pagado una sola vez; firma falsa, importe distinto o evento repetido no cambian el estado; la redirección sin webhook no marca pago; la contraentrega queda como cobro manual; el seguimiento no expone otros pedidos; E2E del recorrido completo, también en móvil.

## Fase 4 — Flutter para repartidores

Tareas: acceso móvil y renovación, asignaciones mínimas desde panel para habilitar el flujo, lista/detalle, contacto/dirección, valor por cobrar, aceptación, estados, confirmación, incidencias e historial. Sin rastreo permanente. Mostrar offline y conflictos; no afirmar sincronización antes de respuesta.

Aceptación: pruebas en Android real o emulador identificado; solo asignaciones autorizadas visibles; cambios aparecen en panel; rechazo de estados inválidos y sesiones revocadas; reenvío por mala conexión no duplica eventos. Registro del cobro de contraentrega separado de pagos de suscripción.

## Fase 5 — Seguimiento

Tareas: mejorar asignación/reasignación, actualizaciones en tiempo real, reconexión y conciliación con API, incidencias y notificaciones. SSE u otra tecnología se elige según necesidad medida. Mapas/GPS solo si se aprueba el alcance y existe consentimiento.

Aceptación: tenant y asignación protegen canales; reconexión converge al estado real; transiciones tienen auditoría; cancelación tras recogida no repone stock; permisos GPS revocables y ausencia de ubicación si se deniega.

## Fase 6 — Suscripciones y administración NEXORA

Tareas: planes/versiones/límites editables, trial configurable, vencimientos, cambios y pagos históricos del comercio a NEXORA; administración de plataforma separada y auditada; pasarela para suscripciones, reutilizando el adaptador de Fase 3 cuando aplique y sin mezclar esos cobros con los pagos de pedidos. Crear landing comercial coherente con capacidades ya verificadas, FAQ y CTA operativos.

Aceptación: límites aplicados atómicamente en backend, incluidas API y tienda en línea; prueba/vencimiento/cambio de plan verificados; pago confirmado por proveedor antes de activación; eventos repetidos o fuera de orden no causan cargos/activaciones duplicados. Si solo se prepara pasarela sin credenciales, cobros reales permanecen bloqueados y declarados pendientes. Precios/condiciones y capturas de landing revisados, sin testimonios ficticios.

## Fase 7 — Auditoría y producción

Tareas: revisión transversal de seguridad y aislamiento, carga y consultas, accesibilidad/responsive, logs/alertas, CI/CD, migraciones, backup/restore, recuperación, secretos, manual del comercio y del repartidor. Revisión de requisitos de privacidad y operación comercial antes del lanzamiento.

Aceptación: cero hallazgos críticos abiertos; pruebas de aislamiento y concurrencia pasan sobre motor objetivo; restauración comprobada; rendimiento bajo carga acordada; despliegue/rollback ensayados en staging; integraciones esenciales verificadas; manual y operación reproducibles. Producción requiere autorización separada, credenciales y aprobación del gasto.

## Definición de terminado para cada incremento

- Requisito trazado a fase y criterio de aceptación.
- Código, migraciones y documentación revisables, sin secretos ni datos reales en fixtures.
- Pruebas apropiadas ejecutadas y resultado registrado; fallos no ocultados.
- Comprobaciones manuales de UI/dispositivo cuando aplica, con evidencia real.
- PROJECT_STATUS actualizado con completado, pendiente y bloqueos.
- Ningún avance de fase sin autorización; no declarar producción lista por pasar solo build.
