# Fase 1 — Implementación y verificación

Fecha: 2026-11-08, America/Bogota; pruebas repetidas el 2026-11-09. Fase 1 autorizada; Fase 2 no autorizada.

## Alcance implementado

| Área | Resultado |
| --- | --- |
| Base | npm workspaces, TypeScript estricto, Vite/React, Express modular, lint, pruebas y build; Git local con commits 79515d6 y fa07a9b en master, sin remoto |
| Datos | MySQL 8.4 en Docker, esquema Prisma, migración versionada, FK compuestas y restricciones CHECK |
| Identidad | Registro de propietario/comercio, login/logout, sesión opaca, renovación, selección validada de comercio |
| Seguridad | Argon2id, expiración por inactividad/absoluta, CSRF/origen, rate limiting, HttpOnly, roles backend, errores seguros |
| Catálogo | Productos, SKU/variantes, categorías, precios decimales, umbrales, búsqueda/paginación, archivo/restauración |
| Imágenes | Una imagen privada por producto, validación real de tipo, máximo 5 MB/16 MP, WebP y acceso autenticado |
| Inventario | Entradas, salidas y ajustes con motivo; saldos persistentes, historial, transacciones, idempotencia y auditoría |
| Equipo | Invitaciones, aceptación, roles predefinidos, desactivación/reactivación; cambios revocan sesiones, propietario protegido |
| Recuperación | Token de un solo uso con vencimiento y revocación de sesiones al cambiar contraseña |
| Panel | Métricas reales de inventario, gráfico, actividad, alertas y campana de stock |
| Reportes | Rangos diarios/semanales/mensuales/personalizados; CSV de existencias y movimientos con protección frente a fórmulas |
| Configuración | Nombre del comercio, COP, America/Bogota y un almacén principal |
| Interfaz | Carga/vacío/error, formularios, navegación por permisos, responsive y reduced motion |

Los movimientos de inventario no representan ventas. No hay cifras simuladas de ingresos o pedidos. Cada comercio nuevo empieza vacío.

## Decisiones efectivas

- Prisma, cliente y adaptador oficial @prisma/adapter-mariadb **7.10.1**, MySQL **8.4**, Node **24.19.0**. Se fijó la rama estable 7 según la [documentación oficial de versiones](https://www.prisma.io/docs/orm/release-status). No se usa latest para el ORM.
- Se descartó el candidato 6.19.3 tras detectar una alerta alta en tooling; la [versión 7.10.1](https://github.com/prisma/orm/releases) incluye correcciones de dependencias. La evidencia final corresponde a 7.10.1.
- Dependencias directas exactas y package-lock.json. Override minimatch 11.0.1 para la alerta transitiva de ESLint; validado con lint y npm audit.
- MySQL local en 127.0.0.1:3307. Obtención de clave pública RSA habilitada exclusivamente para loopback en desarrollo/pruebas. Producción y conexiones remotas requieren DATABASE_CA_PATH y TLS verificado; no se desactiva validación de certificados.
- Roles OWNER, ADMIN, INVENTORY, SELLER y COURIER predefinidos. Permisos centralizados en @nexora/shared y exigidos en backend. Roles personalizados del modelo lógico quedan como extensión futura.
- Un almacén y unidades enteras. Variantes existentes se conservan por trazabilidad. Archivar producto exige saldo cero.
- Stock con aislamiento Serializable, control de versión, CHECK, idempotencia y escritura atómica de movimiento/auditoría. No hay reservas de pedidos todavía.
- Una imagen por producto bajo .data/uploads/tenant, nombres generados, endpoint privado. Al reemplazar imágenes pueden quedar archivos previos sin referencia; limpieza y retención requieren solución antes de producción.
- Correo por archivo en .data/mailbox; pruebas en .data/test/mailbox. SMTP disponible como adaptador, sin prueba con proveedor. No se envió correo a nadie durante el desarrollo.
- Logo mediante encuadre CSS de la imagen original. No se redibujó ni se creó un SVG. La copia PNG permanece idéntica. Favicon e iconos de aplicación son recortes PNG de la lámina, autorizados por el usuario el 2026-11-09. Outfit e Inter se sirven localmente con @fontsource-variable 5.3.0 (OFL-1.1); se conservan fuentes del sistema solo como respaldo.
- La API escucha solo en loopback. Esta entrega no es una configuración definitiva de hosting.

## Verificación realizada

| Comprobación | Resultado final |
| --- | --- |
| Migración MySQL | Aplicada en nexora y nexora_test; volumen persistente |
| TypeScript | Sin errores |
| ESLint | Sin errores |
| Prettier | Sin diferencias de formato |
| Build API/web/shared | Completado |
| Unitarias | 6 aprobadas |
| Integración MySQL real | 21 aprobadas con Prisma 7.10.1 |
| E2E Chrome | Recorrido completo aprobado |
| Auditoría npm | 0 vulnerabilidades en la consulta final de dependencias |

Integración cubre persistencia entre conexiones, aislamiento, FK cruzadas, CHECK de stock, rollback, CSRF, última unidad concurrente, reintento idempotente, ajustes inválidos, edición obsoleta, archivo/restauración, imágenes privadas, reportes aislados, invitaciones/permisos, rotación/logout, cambio de comercio, expiración y recuperación.

E2E cubre registro, categoría, producto, entrada de stock, recarga con persistencia, historial, dashboard, vista móvil, logout y nuevo login. Capturas locales en test-results/dashboard-desktop.png y test-results/dashboard-mobile.png; contienen fixtures TEST. La revisión visual usa esas capturas, no una maqueta. La suite registra sus fallos y trazas cuando los hay; no se deshabilitaron comprobaciones para obtener aprobación.

Se verificó ausencia de desbordamiento horizontal de página a 320, 390, 768, 1024 y 1440 px. Las tablas permiten desplazamiento horizontal y enfoque por teclado. El diff de código pasa la comprobación de espacios. La copia literal del prompt conserva un salto Markdown de dos espacios en su línea 17, que git diff --check señala; no se alteró el documento fuente para eliminar esa advertencia. .gitattributes conserva bytes de referencias y migraciones para no modificar hashes por conversión de saltos de línea.

La recarga y desconexión/reconexión Prisma verifican persistencia. No se afirma restauración de backup, prueba de carga, auditoría de penetración, accesibilidad exhaustiva o correo SMTP real. CI está definido, pero no ejecutado en GitHub.

Revalidación del 2026-11-09: TypeScript en los tres workspaces, ESLint, Prettier, 6 unitarias, build web con salida temporal fuera del repositorio, npm audit con 0 vulnerabilidades, migraciones sin pendientes en nexora_test, 18 de integración contra MySQL real y E2E en Chrome (1 de 1) aprobados. Los conteos de la base nexora no cambiaron durante las pruebas. Ese día API y shared se comprobaron solo con tipos; su build corresponde a la verificación anterior. No se repitió la comprobación de anchos responsive, y las capturas regeneradas por E2E no se revisaron visualmente.

Identidad visual, 2026-11-09, commit fa07a9b: en Chrome, los tres iconos responden 200 como PNG, Inter y Outfit se cargan desde el propio origen y las siete rutas del panel no desbordan a 320, 390, 768, 1024 ni 1440 px. Se revisaron visualmente el registro en escritorio y el dashboard en escritorio y móvil. TypeScript, ESLint, Prettier, 6 unitarias, 18 de integración, E2E, build web y npm audit aprobados con estos cambios. El build web incluye 9 archivos WOFF2 (259 KB en total); cada navegador descarga solo los subconjuntos que usa. El maestro vectorial sigue pendiente.

Ajustes previos a Fase 2, 2026-11-09, commit fa07a9b: POST /invitations/accept usa el límite de credenciales (20 intentos cada 15 minutos) y valida el token antes de calcular Argon2. La migración 202611090001_stock_movement_immutable añade triggers que rechazan UPDATE y DELETE sobre StockMovement; las correcciones se registran como movimientos nuevos. Se añadieron tres pruebas: límite de invitaciones, inmutabilidad en MySQL y solicitudes simultáneas con la misma clave de idempotencia (5 rondas de 3). Las dos primeras fallaron antes de los cambios; la de concurrencia pasó con el código existente. Migración aplicada a nexora y nexora_test sin cambios en los conteos de nexora. 21 de integración aprobadas en cuatro ejecuciones seguidas, y TypeScript, ESLint, Prettier, unitarias, E2E, build de API y web y npm audit aprobados. El paso de CI añadido para permitir triggers no se ha ejecutado.

## Operación y límites

La guía de arranque está en [README](../README.md). Las suites usan exclusivamente nexora_test y nombres TEST. La base nexora queda para las cuentas y datos que cree el usuario.

Si MySQL no responde, abrir Docker Desktop y ejecutar npm run db:up. No borrar .env para regenerar contraseñas conservando el volumen: MySQL crea usuarios solo durante su inicialización original.

Sesión: 30 minutos de inactividad y 12 horas absolutas. La renovación no extiende la expiración absoluta. En producción, HTTPS y cookies __Host-; en desarrollo, HTTP local. Al perder autorización o salir se limpia la caché. El cambio de comercio valida una membresía propia y rota la sesión. Para unirse a otro comercio con cuenta existente, la invitación exige su contraseña actual.

Reportes: fechas de Colombia, máximo un año de movimientos; los saldos por categoría son actuales, no cortes históricos. CSV hasta 10.000 registros, con error explícito para un rango mayor.

[OpenAPI](openapi.phase1.json) describe solicitudes y seguridad de 32 operaciones. Los DTO de respuesta están en packages/shared/src/index.ts. Regenerar con npm run docs:api al cambiar esquemas. Reglas como SKU repetido dentro de una solicitud se verifican en servidor aunque JSON Schema no las exprese.

Pendientes externos: correo verificado, almacenamiento cloud y limpieza, maestro vectorial de marca, hosting y operación/recuperación. Roles personalizados, múltiples almacenes y cantidades fraccionarias no se presentan como disponibles. Ventas, pedidos, Meta, Flutter, seguimiento y planes permanecen fuera de Fase 1.

Siguiente paso propuesto: Fase 2, solo después de autorización explícita del usuario.
