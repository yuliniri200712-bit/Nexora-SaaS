# Decisiones, dependencias y riesgos

Fecha: 2026-11-08. Todo es propuesta salvo las observaciones de inspección. Las decisiones pendientes no bloquean la entrega de Fase 0.

Actualización Fase 1: compatibilidad resuelta con Node 24, Prisma 7.10.1 y MySQL 8.4, migraciones y pruebas reales. El estado efectivo y los límites reemplazan las propuestas cuando corresponda; ver [informe de Fase 1](09-phase1.md). El resto del documento conserva el registro de decisiones iniciales.

## Registro de decisiones

| ID | Propuesta | Razón y alternativa |
| --- | --- | --- |
| D01 | Monorepo npm y monolito modular | Un único núcleo transaccional; separar servicios solo con necesidad operativa medida |
| D02 | React/TypeScript + Express/Zod + MySQL/Prisma compatible | Respeta preferencias del encargo; no hay arquitectura previa que migrar |
| D03 | Schema compartido y tenant_id obligatorio | Menor coste inicial; alternativa de DB por tenant si requisitos futuros justifican mayor operación |
| D04 | Sesión web opaca y cookies; tokens rotatorios móviles | Revocación central y políticas específicas por cliente; no guardar tokens web en localStorage |
| D05 | Un SKU predeterminado y stock por variante/ubicación | Evita dos modelos de stock para productos simples y con opciones |
| D06 | Unidades enteras, una ubicación visible al inicio | Alcance manejable para ropa/comercio; confirmar peso, seriales y múltiples sedes antes de ampliar |
| D07 | DECIMAL y snapshots en pedidos | Evita errores de float e historia cambiante por edición del catálogo |
| D08 | Reservar al confirmar, consumir al salir físicamente | Evita sobreventa y doble descuento entre pedido y entrega |
| D09 | Inbox/outbox persistentes y worker del backend | Reintentos trazables sin introducir broker antes de necesitarlo |
| D10 | Planes versionados y límites en backend desde Fase 6 | No codificar precios/funciones en componentes; definir interfaz de política al crecer |
| D11 | Tokens visuales compartidos; conservar referencia original | Una marca coherente sin inventar assets; SVG maestro pendiente |
| D12 | Landing en Fase 6 y auditoría en Fase 7 | Mostrar capacidades comprobadas junto con planes; cambios de calendario requieren autorización |

## Compatibilidad técnica que debe resolverse primero

No se instala una versión de Prisma ni se genera schema en Fase 0. La [referencia actual consultada de transacciones/runtime](https://www.prisma.io/docs/orm/reference/transactions-and-runtime) describe una API distinta de ejemplos versionados y presenta PostgreSQL/MongoDB en esa página. La [referencia versionada v6](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions) documenta otra API de transacciones. Esta diferencia exige comprobar explícitamente soporte MySQL, versión de Node, migraciones y tratamiento de conflictos en la versión elegida; no permite concluir por sí sola que MySQL esté soportado o descartado en toda versión actual.

Criterio de salida al comenzar Fase 1: combinación soportada documentada, versiones exactas fijadas, migración sobre MySQL desechable, FK compuesta rechazada ante cruce de tenant, transacción con rollback y prueba de última unidad concurrente. Si no se obtiene una combinación mantenida compatible, presentar alternativa y obtener autorización antes de cambiar ORM o motor.

## Servicios y credenciales por fase

| Servicio | Cuándo | Qué se necesitará | Estado |
| --- | --- | --- | --- |
| MySQL local/test | 1 | Motor disponible y usuario limitado | CLI no detectada; servidor no comprobado |
| Almacenamiento de imágenes | 1 | Bucket privado o adaptador local de desarrollo; identidad/credenciales | Sin proveedor elegido |
| Correo transaccional | 1 | Remitente verificado, dominio y credencial; buzón local para pruebas | Sin conexión |
| Meta Cloud API | 3 | App, WABA, número, permisos, app secret, token y endpoint HTTPS | Sin credenciales inspeccionadas ni conexión |
| Android/Flutter | 4 | SDK, emulador/dispositivo; claves de firma antes de distribución | Ejecutables detectados, entorno móvil no validado |
| Mapas/GPS opcional | 5 | Proveedor/API key restringida, presupuesto y consentimiento | Fuera de alcance inicial |
| Pasarela colombiana | 6 | Cuenta comercial, credenciales de pruebas, firma webhook y reglas de conciliación | Sin proveedor seleccionado |
| Hosting/DB/objetos/secretos | 7 | Cuenta, región, dominio, TLS, identidades y presupuesto | Sin recursos creados |
| Monitoreo y backups | 7 | Destinos, retención, alertas y responsables | Pendiente de diseño operativo detallado |

## Riesgos y mitigación verificable

| Riesgo | Impacto | Mitigación / evidencia requerida |
| --- | --- | --- |
| Cruce de tenant por consulta olvidada | Crítico | Repositorios con contexto obligatorio, FK compuesta y pruebas negativas por endpoint/job/exportación |
| Sobreventa o doble ajuste | Crítico | Bloqueos/actualización condicional, idempotencia, ledger y pruebas simultáneas sobre MySQL |
| Sesión o token robado | Alto | Cookies seguras, rotación, revocación, hashes y acceso mínimo a secretos |
| Divergencia entre saldo y movimientos | Alto | Escritura atómica y conciliación periódica; alertar, no corregir silenciosamente |
| Meta sin aprobación o políticas cambiantes | Alto | Validación oficial en Fase 3; mocks identificados mientras falten condiciones |
| Cobro falso/duplicado | Crítico | Firma y conciliación del proveedor, importe/moneda y deduplicación; ningún éxito por frontend |
| Uso excesivo por carrera en límites | Alto | Transacción de consumo y política por tenant en todas las entradas |
| Pérdida de datos | Alto | Backups y restauración ensayada; definir RPO/RTO antes de lanzamiento |
| Mala conectividad del repartidor | Alto | Idempotencia, reintento visible y conciliación; no afirmar entrega offline sin sincronizar |
| Exposición de teléfonos/direcciones/GPS | Alto | Datos mínimos, alcance por asignación, retención y consentimiento; revisión previa a producción |
| Logo de baja calidad al extraerlo | Medio | Obtener maestro o comparar extracción autorizada; no reconstrucción arbitraria |
| Carpeta de trabajo sincronizada por OneDrive | Medio | Vigilar conflictos y archivos generados; usar Git y excluir artefactos de build; valorar ubicación local cuando exista proyecto |
| Ampliación prematura del alcance | Alto | Fases autorizadas y criterios de aceptación; no disfrazar placeholders como funciones |
| Falta de historial Git | Medio | Adoptar repositorio local antes de código; no hay commit o diff disponible en Fase 0 |

## Decisiones del negocio pendientes

Resolver al inicio de la fase que las necesita, sin solicitar secretos por chat:

1. Fase 1: maestro del logo, venta por unidades o peso/seriales, sedes iniciales, política de permisos, correo y almacenamiento.
2. Fase 2: impuestos, facturación requerida, devoluciones, descuentos autorizados, expiración de reservas, pagos parciales, contraentrega y redondeo de cobro. No se asume integración DIAN.
3. Fase 3: onboarding de números por comercio, responsables de Meta, plantillas, consentimiento y atención humana.
4. Fases 4–5: quién asigna/reasigna, prueba de entrega, tratamiento de incidencias y necesidad real de GPS.
5. Fase 6: límites por plan, trial, gracia, suspensión/degradación, prorrateo, pasarela y condiciones públicas.
6. Fase 7: volumen esperado, presupuesto, región, dominio, RPO/RTO, retención de datos y responsables operativos.

## Fuentes técnicas y límite de revisión

Se consultaron fuentes oficiales para orientar la propuesta, sin instalar librerías ni certificar compatibilidad:

- [MySQL 8.4: claves foráneas](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html).
- [Prisma: transacciones y runtime](https://www.prisma.io/docs/orm/reference/transactions-and-runtime) y [documentación versionada v6](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions).
- [OWASP: sesiones](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet) y [CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
- [Meta: webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/): consulta no completada por HTTP 429. Revalidación obligatoria antes de implementar.

Las elecciones de arquitectura, tiempos de sesión y políticas de stock son propuestas para NEXORA, no afirmaciones de requisitos impuestos por estas fuentes.
