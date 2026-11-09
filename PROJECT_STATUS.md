# NEXORA — Estado del proyecto

Última actualización: 2026-11-09, America/Bogota.

## Estado y autorización

**Fase 1 completada y verificada para ejecución local. Fase 2 no iniciada ni autorizada.**

El usuario autorizó Fase 1 después de revisar la planificación. Se implementó la aplicación local con persistencia real MySQL. Git tiene en la rama master el commit local de la Fase 1 (79515d6) y el de identidad y ajustes previos a Fase 2 (fa07a9b), sin remoto. No se publicó ni desplegó el producto.

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
| Migraciones en MySQL local | Dos aplicadas a nexora y nexora_test; sin migraciones pendientes |
| TypeScript | Aprobado |
| ESLint | Aprobado |
| Prettier | Aprobado |
| Build shared/API/web | Aprobado |
| Unitarias | 6 aprobadas |
| Integración contra MySQL real | 21 aprobadas con Prisma 7.10.1 |
| E2E Chrome | Recorrido completo aprobado: registro, categoría, producto, stock, recarga, historial, dashboard, logout/login |
| Responsive | Revisado en escritorio y móvil; comprobación de ancho en 320, 390, 768, 1024 y 1440 px |
| npm audit | 0 vulnerabilidades reportadas |
| Base de desarrollo | Conteo del 2026-11-09: 1 usuario, 1 comercio, 0 productos y 0 movimientos, sin cambios tras las pruebas; fixtures únicamente en nexora_test |
| Secretos y datos locales | .env, .data, node_modules y dist excluidos por Git; contenido del commit revisado sin valores de .env |
| Git | Commits locales 79515d6 (Fase 1, 88 archivos) y fa07a9b (identidad y ajustes, 21 archivos) en master; sin remoto |

Revalidación del 2026-11-09 en este equipo, con Node 24.19.0: TypeScript en los tres workspaces, ESLint, Prettier, 6 unitarias, build web con salida temporal fuera del repositorio, npm audit con 0 vulnerabilidades, migraciones sin pendientes en nexora_test, 18 de integración contra MySQL real y E2E en Chrome aprobados. Ese día API y shared se comprobaron solo con tipos; su build corresponde a la evidencia del 2026-11-08. No se repitió la comprobación de anchos responsive, y las capturas regeneradas por E2E no se revisaron visualmente.

Identidad visual, 2026-11-09, commit fa07a9b: favicon e iconos de aplicación añadidos; Outfit e Inter servidas localmente con licencia OFL-1.1; tipografía e interletraje de títulos en tokens. En Chrome se comprobaron los iconos, la carga de fuentes desde el propio origen y la ausencia de desbordamiento en las siete rutas del panel a 320, 390, 768, 1024 y 1440 px. TypeScript, ESLint, Prettier, 6 unitarias, 18 de integración, E2E, build web y npm audit aprobados con estos cambios.

Ajustes previos a Fase 2, 2026-11-09, commit fa07a9b: aceptar invitaciones usa el límite estricto de credenciales y valida el token antes de calcular Argon2; dos triggers impiden modificar o borrar movimientos de stock en MySQL; nueva prueba de solicitudes simultáneas con la misma clave de idempotencia, que pasó sin necesidad de corregir código. La migración se aplicó a nexora y nexora_test, y los conteos de nexora no cambiaron. Las 21 pruebas de integración aprobaron en cuatro ejecuciones seguidas. TypeScript, ESLint, Prettier, 6 unitarias, E2E, build de API y web con salida fuera del repositorio y npm audit también aprobados. El paso de CI añadido para permitir triggers no se ha ejecutado.

Los tests usan datos TEST aislados. Capturas: test-results/dashboard-desktop.png y test-results/dashboard-mobile.png, revisadas visualmente. La verificación no equivale a una auditoría de producción, carga o accesibilidad exhaustiva. CI está definido pero no se ejecutó en GitHub.

## Límites y pendientes

- Correo configurado como buzón local en .data/mailbox: invitaciones y recuperación funcionan con enlaces locales; no se envió correo real. SMTP preparado, sin proveedor verificado.
- Una ubicación por comercio, cantidades enteras, una imagen por producto y roles predefinidos. Variantes existentes se conservan por trazabilidad.
- Almacenamiento privado local; limpieza de imágenes sustituidas y almacenamiento cloud pendientes antes de producción.
- Logo original usado mediante encuadre CSS, sin rediseño ni SVG inventado. Favicon e iconos de aplicación son recortes PNG de la lámina, autorizados por el usuario. Maestro vectorial pendiente: los recortes no sirven por encima de 250 px.
- No hay ventas, pedidos, WhatsApp, Flutter, seguimiento, suscripciones, pagos o facturación fiscal.
- MySQL necesita log_bin_trust_function_creators=1 para que el usuario de la aplicación cree triggers con el registro binario activo; compose.yaml lo configura en local. En producción habrá que activarlo o migrar con una cuenta con más privilegios.
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
