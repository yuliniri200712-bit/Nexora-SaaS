# Operación de Fase 1

La aplicación ya es ejecutable localmente. La [guía de inicio](../README.md) y el [informe de verificación](09-phase1.md) reemplazan los comandos propuestos de Fase 0.

## Servicios y datos

- Web React/Vite: http://127.0.0.1:5173.
- API Express: http://127.0.0.1:3001; el navegador consume /api por proxy Vite del mismo origen.
- MySQL 8.4: 127.0.0.1:3307, contenedor nexora-local-mysql-1.
- Desarrollo: base nexora; integración/E2E: nexora_test. El guard de pruebas rechaza cualquier otro nombre o un host remoto.
- Datos persistentes: volumen Docker nexora-local_nexora-mysql. Los scripts de pruebas no lo eliminan ni resetean las bases.
- Archivos privados: .data/uploads; buzón de desarrollo: .data/mailbox. Los tests usan .data/test.
- /health/live comprueba proceso; /health/ready verifica acceso a la DB. La API no expone secretos en esos endpoints.

## Scripts disponibles

| Comando | Resultado |
| --- | --- |
| npm ci | Instalación desde lockfile |
| npm run setup:local | Genera .env local aleatorio si no existe |
| npm run db:up | Inicia MySQL y espera healthcheck |
| npm run db:generate | Genera cliente Prisma fijado |
| npm run db:migrate:dev | Aplica migraciones a DATABASE_URL configurada |
| npm run dev | Compila contratos y arranca API/web |
| npm run typecheck | Comprueba tipos en paquetes y apps |
| npm run lint | ESLint |
| npm run format:check | Prettier, sin modificar archivos |
| npm run test:unit | Reglas puras |
| npm run db:prepare:test | Aplica migración solo a nexora_test en localhost |
| npm run test:integration | Prueba MySQL real; requiere la DB anterior |
| npm run dev:test:api | API de pruebas aislada, para E2E |
| npm run test:e2e | Chrome; requiere API de pruebas y Vite activos |
| npm run build | Genera dist de shared, API y web |
| npm run docs:api | Regenera solicitudes/seguridad OpenAPI |

No hay seed de demostración para desarrollo. Registro de cuenta desde la interfaz crea comercio real en la base local. Fixtures TEST se generan únicamente en las suites. E2E usa Google Chrome instalado; no se instaló un navegador en este equipo para la prueba.

## Configuración

| Variable | Uso |
| --- | --- |
| NODE_ENV | development, test o production |
| PORT | Puerto de API, 3001 por defecto |
| APP_ORIGIN | Origen permitido para CSRF; debe coincidir con la URL de navegador |
| DATABASE_URL | Conexión privada MySQL; nunca frontend/logs |
| TEST_DATABASE_URL | Base local nexora_test; guardada también en .env |
| DATABASE_CA_PATH | CA para verificar TLS; obligatoria si DB es remota o entorno producción |
| MYSQL_PASSWORD / MYSQL_ROOT_PASSWORD | Inicialización del contenedor local |
| SESSION_IDLE_MINUTES / SESSION_ABSOLUTE_HOURS | 30 minutos / 12 horas por defecto |
| MAIL_TRANSPORT | file local o smtp |
| MAIL_FROM / SMTP_URL | Remitente y transporte SMTP; secretos solo backend |

Producción exige HTTPS, SMTP y TLS de base verificado, pero esas comprobaciones de configuración no constituyen aceptación de producción. Aún se debe diseñar y probar proxy/TLS, hosting, límites distribuidos, almacenamiento, backups, monitorización y recuperación en Fase 7.

## Diagnóstico local

- Datos no disponibles: iniciar Docker Desktop y ejecutar npm run db:up. No cambiar contraseñas a ciegas: los usuarios MySQL se inicializan solo al crear el volumen.
- Error CSRF: usar exactamente el origen configurado, normalmente 127.0.0.1:5173, y recargar la página.
- Puerto ocupado: detener el servidor de desarrollo/pruebas anterior con Ctrl+C. No ejecutar simultáneamente dos API en 3001.
- Token de invitación/recuperación: leer el último JSON en .data/mailbox; es un mensaje local, no un correo enviado.
- Imagen privada: requiere sesión y permiso de catálogo. No servir .data mediante un directorio estático.
- El reemplazo de imágenes puede dejar archivos antiguos; política de limpieza y almacenamiento administrado pendiente.

## Migraciones y CI

La migración inicial incluye FK compuestas y CHECK de stock/precios. Solo se aplicó a bases locales identificadas, nunca datos de producción. db:migrate:dev usa DATABASE_URL: revisar el entorno antes de ejecutarlo; el guard estricto de localhost se aplica al script de pruebas.

El workflow de GitHub define MySQL efímero, tipos/lint, unitarias, integración, build, auditoría y E2E. Está escrito, no ejecutado en GitHub. No hay remoto ni despliegue. Las claves de CI incluidas son exclusivamente de su contenedor efímero, no credenciales de este equipo.
