# NEXORA — reglas de trabajo

Las Fases 1 y 2 están autorizadas por el usuario. La Fase 3 es la tienda en línea (ver docs/05-roadmap.md); no implementarla sin autorización explícita.

- Leer PROJECT_STATUS.md y documentación pertinente; preservar trabajo existente.
- Mantener React/TypeScript, Express y MySQL/Prisma. Justificar dependencias y cambios.
- Derivar tenant desde sesión; autorizar acción y recurso en backend. Probar accesos cruzados.
- Stock transaccional, idempotente y auditado, nunca negativo. No editar movimientos históricos.
- Secretos fuera de repositorio, frontend y logs; mantener .env.example sin credenciales.
- Preservar el logo original y tokens visuales. No inventar datos reales ni controles decorativos.
- Separar validación, servicios y persistencia; TypeScript estricto y sin any injustificado.
- Ejecutar lint, tipos, build y pruebas pertinentes; registrar resultados reales y limitaciones.
- Revisar diff y actualizar PROJECT_STATUS.md. No publicar, cobrar o migrar datos reales sin autorización.
- Tienda en línea, pagos, Flutter, seguimiento y suscripciones quedan fuera de las Fases 1 y 2.
- No integrar bots de WhatsApp ni automatizaciones de WhatsApp Web: el usuario los eliminó del roadmap. Solo se permite el enlace wa.me de contacto de la tienda.
