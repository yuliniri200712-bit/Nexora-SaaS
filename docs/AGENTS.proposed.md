# Propuesta de AGENTS.md para NEXORA

Estado: texto candidato; no es todavía un AGENTS.md activo en la raíz. Se propone adoptarlo al autorizar el inicio de implementación. No duplica el documento maestro.

## Reglas propuestas

1. Leer PROJECT_STATUS.md, README y documentación del dominio antes de editar. Verificar la última fase autorizada por el usuario; al cierre de Fase 0, Fase 1 no está autorizada.
2. Trabajar solo en la fase y alcance autorizados. No borrar trabajo existente, cambiar stack de forma disruptiva, publicar, cobrar o migrar datos reales sin autorización correspondiente.
3. Inspeccionar código, convenciones y Git; hacer cambios pequeños. No introducir dependencias sin utilidad y compatibilidad justificadas.
4. Exigir contexto de tenant derivado del servidor para cualquier recurso de comercio; validar roles y recurso en backend. Agregar pruebas de acceso cruzado al incorporar módulos.
5. Todas las variaciones de stock, reservas y estados relacionados deben ser transaccionales, idempotentes y auditadas. No permitir stock negativo ni editar movimientos históricos.
6. Mantener secretos fuera de código, frontend, logs y fixtures. Crear .env.example con las variables reales, sin credenciales.
7. Usar exclusivamente WhatsApp Cloud API oficial. Mocks y datos demo se identifican; no afirmar conexión sin prueba oficial. Pagos solo confirmados por proveedor verificable.
8. Conservar la marca y sus proporciones; usar tokens compartidos. No inventar SVG/logo, testimonios, clientes ni métricas. No dejar controles decorativos que aparenten funcionar.
9. Separar UI, contratos, servicios y persistencia. TypeScript estricto; cualquier uso de any requiere justificación documentada. No exponer objetos de ORM como contrato público.
10. Ejecutar lint, tipos, build y pruebas relevantes cuando existan. No ocultar fallos ni desactivar controles para obtener resultados positivos. Distinguir prueba con mocks, MySQL, navegador, Android y servicio externo.
11. Revisar diff y actualizar PROJECT_STATUS con cambios, evidencia, pendientes y bloqueos. Si Git aún no existe, registrar archivos y validación documental.
12. Terminar cada fase con informe breve y esperar autorización explícita para la siguiente. No declarar producción lista sin integraciones esenciales y recuperación verificadas.
