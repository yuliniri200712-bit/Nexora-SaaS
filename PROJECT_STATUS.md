# NEXORA — Estado del proyecto

Última actualización: 2026-11-08, America/Bogota.

## Estado y autorización

**Fase 1 completada y verificada para ejecución local. Fase 2 no iniciada ni autorizada.**

El usuario autorizó Fase 1 después de revisar la planificación. Se implementó la aplicación local con persistencia real MySQL. Git está inicializado; archivos preparados como intención de añadir para revisión de diff, sin commit ni remoto. No se publicó ni desplegó el producto.

## Implementado

- Monorepo React/TypeScript/Vite, Express, Prisma 7.10.1 y MySQL 8.4.
- Registro de usuario/comercio, login/logout, renovación, expiración, recuperación y cambio validado de comercio.
- Aislamiento por tenant, roles backend, CSRF/origen, Argon2id, limitación de solicitudes y errores seguros.
- Categorías, productos, variantes/SKU, precios decimales, imágenes privadas, archivo/restauración y búsqueda.
- Entradas, salidas y ajustes con motivo, auditoría, transacciones, idempotencia y protección de stock.
- Empleados mediante invitaciones; roles y desactivación con revocación de sesiones.
- Dashboard, alertas, gráficos, historial, reportes por periodo y CSV reales.
- Interfaz responsive con identidad original; configuración del comercio.
- Migración SQL, configuración local aleatoria, scripts, workflow CI y OpenAPI de 32 operaciones.

## Evidencia

| Comprobación | Resultado |
| --- | --- |
| Migración en MySQL local | Aplicada a nexora y nexora_test; sin migraciones pendientes |
| TypeScript | Aprobado |
| ESLint | Aprobado |
| Prettier | Aprobado |
| Build shared/API/web | Aprobado |
| Unitarias | 6 aprobadas |
| Integración contra MySQL real | 18 aprobadas con Prisma 7.10.1 |
| E2E Chrome | Recorrido completo aprobado: registro, categoría, producto, stock, recarga, historial, dashboard, logout/login |
| Responsive | Revisado en escritorio y móvil; comprobación de ancho en 320, 390, 768, 1024 y 1440 px |
| npm audit | 0 vulnerabilidades reportadas |
| Base de desarrollo | Conteo verificado: 0 usuarios y 0 productos; fixtures únicamente en nexora_test |
| Secretos y datos locales | .env, .data, node_modules y dist excluidos por Git |
| Git diff | Revisión de archivos nuevos y comprobación de espacios; no se creó commit |

Los tests usan datos TEST aislados. Capturas: test-results/dashboard-desktop.png y test-results/dashboard-mobile.png, revisadas visualmente. La verificación no equivale a una auditoría de producción, carga o accesibilidad exhaustiva. CI está definido pero no se ejecutó en GitHub.

## Límites y pendientes

- Correo configurado como buzón local en .data/mailbox: invitaciones y recuperación funcionan con enlaces locales; no se envió correo real. SMTP preparado, sin proveedor verificado.
- Una ubicación por comercio, cantidades enteras, una imagen por producto y roles predefinidos. Variantes existentes se conservan por trazabilidad.
- Almacenamiento privado local; limpieza de imágenes sustituidas y almacenamiento cloud pendientes antes de producción.
- Logo original usado mediante encuadre CSS, sin rediseño ni SVG inventado. Maestro vectorial pendiente.
- No hay ventas, pedidos, WhatsApp, Flutter, seguimiento, suscripciones, pagos o facturación fiscal.
- Sin hosting público, monitoreo productivo, backup/restore ensayado ni certificación de producción.
- No se ejecutaron operaciones sobre datos reales de producción ni acciones con coste.

## Archivos y ejecución

Empezar por [README](README.md). Informe detallado: [Fase 1](docs/09-phase1.md). Contrato: [OpenAPI](docs/openapi.phase1.json). Código principal: [API](apps/api/src/app.ts), [modelo](apps/api/prisma/schema.prisma), [web](apps/web/src/main.tsx) y [contratos](packages/shared/src/index.ts).

Con Docker Desktop iniciado, en la carpeta del proyecto:

    npm.cmd run db:up
    npm.cmd run dev

Abrir http://127.0.0.1:5173 y crear la cuenta propia. No hay cuenta demo. Los pasos de instalación desde cero y de pruebas están en README.

## Próximo paso

Esperar autorización explícita para Fase 2: clientes, ventas, pedidos y reservas/consumo de stock vinculados a esas operaciones. No continuar automáticamente.

La planificación de Fase 0 y su evidencia se conservan en docs; el informe de Fase 1 identifica las decisiones implementadas y sustituye su estado inicial.
