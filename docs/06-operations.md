# Operación de Fase 1

La aplicación ya es ejecutable localmente. La [guía de inicio](../README.md) y el [informe de verificación](09-phase1.md) reemplazan los comandos propuestos de Fase 0.

## Servicios y datos

- Web React/Vite: http://127.0.0.1:5173.
- API Express: http://127.0.0.1:3001; el navegador consume /api por proxy Vite del mismo origen.
- MySQL 8.4: 127.0.0.1:3307, contenedor nexora-local-mysql-1, con una única base: nexora_principal.
- Pruebas: MySQL temporal aparte, contenedor nexora-test-mysql-1 en 127.0.0.1:3308, con la base nexora_test en memoria. Se crea con test:db:up y desaparece con test:db:down. El guard de pruebas rechaza cualquier otro nombre o un host remoto, así que nunca escriben en nexora_principal.
- Datos persistentes: volumen Docker nexora-local_nexora-mysql. Los scripts de pruebas no lo usan.
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
| npm run test:db:up | Crea el MySQL temporal de pruebas y le aplica las migraciones |
| npm run test:db:down | Elimina el MySQL temporal de pruebas y sus datos |
| npm run test:integration:local | Crea el MySQL temporal, ejecuta la integración y lo elimina |
| npm run db:prepare:test | Aplica migraciones solo a nexora_test en localhost |
| npm run test:integration | Integración contra MySQL real; requiere el MySQL temporal activo |
| npm run dev:test:api | API de pruebas aislada, para E2E; requiere el MySQL temporal activo |
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
| TEST_DATABASE_URL | nexora_test del MySQL temporal, en el puerto 3308; sus claves son fijas y desechables, definidas en compose.test.yaml |
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

## Copias de seguridad

Base y fotos de productos se copian por separado: las imágenes están en .data/uploads, fuera de MySQL. Con Docker Desktop iniciado, en PowerShell desde la carpeta del proyecto, cambiando la fecha y la base si corresponde:

    New-Item -ItemType Directory -Force "$HOME\Documents\Nexora-copias"
    docker exec nexora-local-mysql-1 sh -c 'MYSQL_PWD=$MYSQL_PASSWORD mysqldump -unexora -h127.0.0.1 --single-transaction --routines --triggers --no-tablespaces --result-file=/tmp/copia.sql nexora_principal'
    docker cp nexora-local-mysql-1:/tmp/copia.sql "$HOME\Documents\Nexora-copias\nexora-2026-11-10.sql"
    docker exec nexora-local-mysql-1 rm -f /tmp/copia.sql
    Copy-Item -Recurse .data\uploads "$HOME\Documents\Nexora-copias\fotos-2026-11-10"

La copia se genera dentro del contenedor y se extrae con docker cp, porque redirigir la salida con > en Windows PowerShell puede cambiar la codificación del archivo. Nunca guardar copias dentro del repositorio: contienen datos de clientes y hashes de contraseñas, y Git no las excluye. Conservar también una copia fuera del equipo.

Restaurar en una base vacía, nunca sobre la que está en uso, y solo con copias tomadas después de la migración 202611100002_trigger_body_backup_fix. Las anteriores contienen dos triggers con un punto y coma final que MySQL rechaza al restaurar.

## Migraciones y CI

La migración inicial incluye FK compuestas y CHECK de stock/precios. Solo se aplicó a bases locales identificadas, nunca datos de producción. db:migrate:dev usa DATABASE_URL: revisar el entorno antes de ejecutarlo; el guard estricto de localhost se aplica al script de pruebas.

La migración 202611090001_stock_movement_immutable crea triggers. Con el registro binario activo, MySQL exige log_bin_trust_function_creators=1 si la cuenta que migra no tiene privilegios elevados. compose.yaml lo activa en local y el workflow de CI lo fija antes de migrar. Un MySQL administrado en producción requerirá ese parámetro o una cuenta de migración con más privilegios.

El workflow de GitHub define MySQL efímero, tipos/lint, unitarias, integración, build, auditoría y E2E. Se activa al subir a GitHub; su resultado aún no se ha verificado. El código está en un repositorio privado y no hay despliegue. Las claves de CI incluidas son exclusivamente de su contenedor efímero, no credenciales de este equipo.
