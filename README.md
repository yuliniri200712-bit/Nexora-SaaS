# NEXORA

**Tu negocio. Todo conectado.**

Aplicación local para comercios, con las Fases 1 y 2 implementadas y persistencia MySQL. Incluye cuentas, sesiones, roles, aislamiento entre comercios, categorías, variantes/SKU, imágenes privadas, movimientos de stock, empleados, clientes, ventas, pedidos con reserva de stock, dashboard y reportes CSV.

Tienda en línea con pagos, Flutter, seguimiento y suscripciones pertenecen a fases posteriores. No hay despliegue público, cobros ni facturación.

## Ejecutar en Windows

Requisitos comprobados: Node.js 24.19.0, npm 11.17.0 y Docker Desktop con motor Linux. Se requiere Node 24.11 o superior dentro de la versión 24. MySQL usa el puerto local 3307, con una única base, nexora_principal; API 3001; web 5173.

Para una instalación nueva, desde PowerShell en esta carpeta:

    npm.cmd ci
    npm.cmd run setup:local
    npm.cmd run db:up
    npm.cmd run db:generate
    npm.cmd run db:migrate:dev
    npm.cmd run dev

En este equipo ya se generó la configuración y se aplicó la migración. Para volver a trabajar basta abrir Docker Desktop, ejecutar npm.cmd run db:up y npm.cmd run dev.

Abrir [NEXORA local](http://127.0.0.1:5173). Usar **Crea tu cuenta** para registrar al propietario y su comercio. No hay credenciales predeterminadas ni datos demo en la base de desarrollo. Usar 127.0.0.1 para coincidir con APP_ORIGIN y la protección CSRF.

setup:local genera contraseñas aleatorias en .env y conserva un archivo existente. No publicar .env. La base persiste en el volumen Docker nexora-local_nexora-mysql; no ejecutar docker compose down -v salvo que se quiera eliminar expresamente sus datos.

## Probar manualmente

1. Crear cuenta y comercio; entrar al dashboard inicialmente vacío.
2. Crear categoría y producto con SKU, precio y umbral de stock. Agregar variantes si se necesitan.
3. En Inventario, registrar una entrada con motivo; comprobar existencias, historial y dashboard.
4. Registrar una salida o ajuste. Los cambios que produzcan stock negativo se rechazan.
5. Editar producto, subir imagen y consultar reportes por fecha; exportar CSV.
6. Invitar una persona en Mi equipo y comprobar los permisos de su rol.
7. Cerrar sesión y volver a entrar; los datos deben permanecer.
8. En Clientes, registrar un cliente con una dirección.
9. En Pedidos, crear un borrador y confirmarlo; en Inventario, su disponible debe bajar. Completarlo o cancelarlo.
10. En Ventas, registrar una venta directa; comprobar existencias, dashboard y reportes.

Invitaciones y recuperación usan un **buzón local de desarrollo** en .data/mailbox. No envían correos reales. Para leer el mensaje que acabas de solicitar:

    Get-ChildItem -LiteralPath .\.data\mailbox -Filter *.json |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1 |
      Get-Content

Abrir el enlace contenido en el mensaje. Esa carpeta contiene enlaces sensibles y está excluida de Git. El adaptador SMTP está preparado, pero no conectado ni verificado con un proveedor externo.

## Verificaciones

    npm.cmd run typecheck
    npm.cmd run lint
    npm.cmd run format:check
    npm.cmd run test:unit
    npm.cmd run test:integration:local
    npm.cmd run build

Las pruebas nunca usan nexora_principal. test:integration:local arranca un MySQL temporal aparte (compose.test.yaml, puerto 3308, datos en memoria), aplica las migraciones a su base nexora_test, ejecuta la integración y lo elimina al terminar, aunque las pruebas fallen. Si se interrumpe con Ctrl+C, eliminarlo con npm.cmd run test:db:down.

Para E2E, detener primero npm run dev y usar terminales separadas:

    # Terminal 1: MySQL temporal de pruebas
    npm.cmd run test:db:up

    # Terminal 1, después: API apuntando únicamente al MySQL temporal
    npm.cmd run dev:test:api

    # Terminal 2: interfaz
    npm.cmd run dev -w @nexora/web

    # Terminal 3: requiere Google Chrome instalado
    npm.cmd run test:e2e

    # Al terminar, detener las terminales 1 y 2 y eliminar el MySQL temporal
    npm.cmd run test:db:down

La suite crea comercios identificados como TEST, solo en el MySQL temporal. Capturas y límites de verificación se describen en el [informe de Fase 1](docs/09-phase1.md). El workflow CI se activa al subir a GitHub; su resultado se consulta en la pestaña Actions del repositorio.

## Documentación y código

| Ubicación | Contenido |
| --- | --- |
| [Estado del proyecto](PROJECT_STATUS.md) | Resultados y siguiente fase pendiente |
| [Informe de Fase 1](docs/09-phase1.md) | Alcance, decisiones y evidencia |
| [Informe de Fase 2](docs/10-phase2.md) | Ventas y pedidos, decisiones pendientes y evidencia |
| [OpenAPI](docs/openapi.json) | 48 operaciones: solicitudes y seguridad |
| [API](apps/api/src/app.ts) | Express, sesiones, permisos y rutas |
| [Datos](apps/api/prisma/schema.prisma) | Modelo y migración MySQL |
| [Web](apps/web/src/main.tsx) | React, Router, Query y pantallas |
| [Contratos](packages/shared/src/index.ts) | Validaciones, roles y DTO |
| [Tokens](packages/design-system/tokens.css) | Base visual compartida |
| [Arquitectura](docs/01-architecture.md) / [Modelo lógico](docs/02-data-model.md) | Diseño del ecosistema |
| [Seguridad](docs/03-security.md) / [Diseño](docs/04-design-system.md) | Requisitos y guía de marca |
| [Roadmap](docs/05-roadmap.md) / [Operación](docs/06-operations.md) | Fases y guía técnica |
| [Decisiones](docs/07-decisions-risks.md) / [Verificación Fase 0](docs/08-validation.md) | Antecedentes |
| [Marca](brand/README.md) | Referencia original preservada |

No está certificado para producción: faltan despliegue, correo externo, almacenamiento administrado, operación/recuperación y auditoría global de Fase 7. Los controles de Fase 1 se verifican según la evidencia registrada; no se prometen integraciones no probadas.
