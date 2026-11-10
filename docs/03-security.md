# Multi-tenancy y seguridad

Especificación del ecosistema elaborada en Fase 0. Los controles implementados y probados en Fase 1 se detallan en [el informe de implementación](09-phase1.md). Los controles de tienda en línea, pagos, móvil y producción siguen pendientes de sus fases.

## Aislamiento por comercio

Base y esquema compartidos con `tenant_id` obligatorio en recursos del comercio. El aislamiento se aplica en autorización, servicios, repositorios, relaciones, almacenamiento y trabajos. No se presume un filtro automático de filas en MySQL ni se confía únicamente en middleware de ORM.

1. Autenticar sesión y cargar la membresía activa desde el servidor.
2. Validar estado de usuario, membresía y comercio; obtener permisos vigentes.
3. Construir TenantContext interno. Rechazar campos tenantId en mutaciones de negocio.
4. Consultar por tenant e ID, incluyendo joins, conteos, búsquedas, agregados, exportaciones y actualizaciones masivas.
5. Autorizar acción y recurso concreto; luego validar plan cuando corresponda.
6. Escribir datos, auditoría y eventos con ese contexto. Una referencia a recurso de otro tenant debe fallar también por FK compuesta.

Un usuario puede pertenecer a varios comercios. El endpoint específico de cambio de comercio recibe una selección, valida una membresía activa, rota la sesión y crea contexto nuevo. La selección nunca concede acceso por sí misma. Vaciar caché del cliente y desconectar canales en tiempo real al cambiar de comercio o cerrar sesión.

La caché incluye tenant y ámbito de autorización en sus claves. Jobs llevan una identidad de servicio limitada y un tenant resuelto desde registros confiables; los trabajos globales recorren tenants de forma explícita. Webhooks resuelven tenant mediante conexión de proveedor registrada tras verificar autenticidad. Archivos usan claves generadas por servidor bajo tenant y URLs firmadas de duración limitada; un prefijo por sí solo no autoriza acceso.

## Autenticación web y móvil

Propuesta web: sesión opaca aleatoria de 256 bits, verificador almacenado como hash, cookie `__Host-nexora_session` con Secure, HttpOnly, Path=/ y SameSite=Lax en HTTPS; sin Domain. Rotar al iniciar sesión, cambiar tenant/privilegios y renovar. Validar expiración y revocación en servidor. Protección CSRF con token y verificación de origen para mutaciones; SameSite es una capa adicional. Estos principios se apoyan en [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet) y [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

Política inicial propuesta para web: inactividad de 30 minutos, duración absoluta de 12 horas y renovación antes de expirar sin superar el límite absoluto. Ajustable tras probar jornadas reales de comercio. Usar HTTPS local o un modo de cookie local explícito y separado; prohibir configuración insegura en producción. No guardar tokens web en localStorage.

Contraseñas con Argon2id y parámetros fijados tras medir el servidor; sin criptografía propia. Recuperación e invitaciones con token de un solo uso, hash persistido, expiración y respuestas que no revelen si existe la cuenta. Limitar intentos por cuenta y origen, con errores uniformes. Desactivar usuario/membresía o cambiar contraseña revoca sesiones afectadas. Evitar que un administrador quite al último propietario activo del comercio.

Móvil, desde Fase 4: access token opaco breve (15 minutos propuestos), refresh token rotatorio (máximo 30 días propuestos), familia revocable, hashes en servidor y almacenamiento seguro del sistema operativo. Reutilización de refresh invalida la familia. Un único refresh en vuelo y pruebas de recuperación ante pérdida de conexión. No trasladar cookies web al móvil ni confiar en un tenant del cuerpo de la solicitud.

## Autorización inicial

Los roles son conjuntos de permisos del backend; ocultar navegación no protege un endpoint. La matriz siguiente propone perfiles iniciales. Permisos personalizados y cambios se auditan.

| Capacidad | Propietario | Administrador comercio | Inventario | Vendedor | Repartidor |
| --- | --- | --- | --- | --- | --- |
| Configuración y empleados | Sí | Sí, sin transferir propiedad | No | No | No |
| Catálogo / precios | Sí | Sí | Sí | Lectura | Solo líneas asignadas |
| Ajustes de stock | Sí | Sí | Sí | No | No |
| Crear ventas/pedidos | Sí | Sí | No | Sí | No |
| Descuentos / cancelación | Sí | Sí | No | Dentro de política autorizada | No |
| Clientes | Sí | Sí | No | Datos necesarios para venta | Solo contacto/dirección de asignación activa |
| Reportes / costos | Sí | Sí | Existencias, sin costos por defecto | Resumen de sus ventas | Su historial mínimo |
| Asignar entregas | Sí | Sí | No | No por defecto | No |
| Actualizar entrega | Sí, con motivo si interviene | Sí, con motivo | No | No | Solo asignación activa y transición válida |
| Suscripción y pagos SaaS | Sí | No por defecto | No | No | No |

Administrador de plataforma es una identidad de NEXORA separada. Acceso de soporte a datos de clientes requiere capacidad explícita, motivo, límite temporal y registro; no se incluye un bypass de tenant en rutas habituales. MFA para administradores de plataforma antes de operar producción; planificarlo para propietarios.

## Superficies de riesgo

- Entrada: Zod, límites de longitud/tamaño, lista permitida de filtros/orden, parámetros SQL y rechazo de propiedades privilegiadas. Escapar contenido mostrado; no renderizar HTML de clientes o mensajes sin sanitización.
- Subidas: validar tipo por contenido, tamaño, extensión y dimensiones; generar nombre, almacenar privado y servir con tipo seguro. No descargar URLs arbitrarias para evitar SSRF.
- CSV: neutralizar fórmulas de celdas que comiencen con caracteres peligrosos; permisos y tenant también se aplican a exportación.
- HTTP: HTTPS, CORS de orígenes explícitos cuando sea necesario, CSP, cabeceras seguras, límites de body, rate limiting y errores sin stack del servidor.
- Secretos: fuera del repositorio y frontend; Secret Manager/KMS o equivalente para producción, cuentas con mínimo privilegio. Credenciales de pasarela cifradas con claves separadas de la base o referencias al gestor de secretos. Variables públicas VITE solo contienen datos públicos.
- Logs: requestId, acción, tenant/actor internos y resultado; excluir cookies, Authorization, contraseñas, tokens, mensajes completos, direcciones y coordenadas. Auditoría append-only con permisos DB restringidos y retención definida.
- Reportes y notificaciones: no incluir datos privados en enlaces públicos, notificaciones de pantalla bloqueada o mensajes a destinatarios sin verificar.

## Tienda en línea y pagos: diseño, no implementado

La integración con WhatsApp se eliminó del roadmap el 2026-11-10. No adoptar automatizaciones de WhatsApp Web; el enlace wa.me de la tienda solo abre un chat con el comercio y no envía datos a NEXORA.

Tienda: rutas públicas sin sesión y separadas de la API privada. El comercio se resuelve por su dirección pública y solo se exponen productos activos de una tienda publicada; nunca identificadores internos de otros comercios, costos ni datos de clientes. Crear pedido exige validación estricta, límites por visitante y por comercio, tamaño de body acotado e Idempotency-Key, y crea solo borradores sin reserva. Precios y totales siempre se recalculan en el servidor. El seguimiento usa un token aleatorio largo, guardado como hash y comparado en tiempo constante, y muestra datos mínimos. Datos personales solo con autorización expresa del cliente, conforme a la ley colombiana de protección de datos. Antes de implementar, revalidar contra la documentación vigente del proveedor de pagos elegido.

Pagos: persistir intento con importe/moneda/tenant esperados; verificar webhook del proveedor, referencia, importe y moneda, y consultar proveedor si es necesario. Deduplicar y procesar estados fuera de orden, reembolsos y contracargos. La redirección del navegador nunca confirma un pago. Un cobro manual del comercio queda identificado como registro manual; no se presenta como confirmación bancaria.

## Plan de pruebas obligatorias

| Prueba | Evidencia esperada | Fase |
| --- | --- | --- |
| Tenant A intenta listar/leer/editar/borrar/exportar recursos B | Sin datos ni cambios; respuesta uniforme para recurso no accesible | 1 y cada módulo |
| ID padre B en recurso nuevo de A, también con consulta directa DB | Servicio rechaza y FK compuesta impide relación | 1/2 |
| body/header/query con tenantId o rol falsificado | Ninguna elevación de privilegios | 1 |
| Usuario desactivado, sesión vencida/revocada y cambio de tenant | Acceso denegado y caché anterior eliminada | 1 |
| Vendedor intenta administrar permisos o ajustar stock | 403 y ninguna mutación | 1 |
| CSRF, fijación de sesión, login abusivo y reset reutilizado | Solicitudes rechazadas con pruebas de controles reales | 1 |
| Dos ventas por última unidad / doble cancelación | Saldo correcto y un único efecto | 2 |
| Mensaje/evento repetido o firma alterada | Sin pedido duplicado; evento falso no procesado | 3 |
| Repartidor intenta otra asignación, tenant o estado imposible | Denegado; historial intacto | 4 |
| Canal en tiempo real / URL de archivo de otro tenant | No suscripción ni acceso a contenido privado | 5 |
| Pago falso, importe distinto, evento repetido o fuera de orden | Sin activación indebida de suscripción | 6 |
| Backups restaurados y permisos de acceso | Recuperación comprobada sin exponer otros tenants | 7 |

Usar dos tenants, usuarios con varios roles y MySQL real para integridad/concurrencia. Mocks solo para proveedores en pruebas claramente identificadas; no sustituyen aceptación oficial. Privacidad, retención y consentimientos requieren revisión específica antes de operar con datos reales; esta documentación no constituye un análisis jurídico.
