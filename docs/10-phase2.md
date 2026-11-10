# Fase 2 — Ventas, clientes y pedidos

Fecha: 2026-11-09, America/Bogota. Fase 2 autorizada por el usuario; Fase 3 no autorizada. Verificación local; sin despliegue ni datos de producción.

## Alcance implementado

| Área | Resultado |
| --- | --- |
| Clientes | Datos de contacto, teléfono único por comercio, direcciones e historial de compras |
| Ventas directas | Se registran completadas y descuentan existencias en la misma transacción |
| Pedidos | Borrador → confirmado → completado, y cancelación desde borrador o confirmado |
| Stock | Confirmar reserva, completar consume, cancelar libera; cada efecto ocurre una sola vez |
| Importes | Subtotal, descuento por línea, descuento general, domicilio y total en centavos enteros |
| Trazabilidad | Numeración por comercio, historial append-only con actor y fecha, movimientos ligados al pedido, snapshots de precio, producto, cliente y dirección |
| Consulta | Filtros por estado, canal, cliente, número y fecha |
| Reportes | Ventas por día, productos más vendidos, ticket promedio, exportación CSV; métricas y gráfico de ventas de los últimos 7 días en el dashboard |
| Permisos | Vendedor: clientes, pedidos y ventas, sin reportes. Inventario: consulta de pedidos. Repartidor: sin acceso hasta Fase 4 |

## Decisiones de negocio pendientes de confirmar

Son valores por defecto seguros; ninguna está cerrada comercialmente.

| Tema | Comportamiento actual |
| --- | --- |
| Impuestos y facturación | No se calculan impuestos. El precio del catálogo se trata como precio final. No hay facturación electrónica DIAN |
| Pagos | No se registran pagos ni contraentrega. «Completado» no implica cobro verificado |
| Devoluciones | Un pedido completado no se cancela. La devolución se registra como ajuste de inventario con motivo |
| Descuentos | Cualquier rol con `orders:write` puede aplicarlos, hasta el valor de la línea o del pedido |
| Reservas | No vencen. Un pedido confirmado retiene stock hasta completarse o cancelarse |
| Domicilios | Se registran costo y dirección, y el pedido se completa manualmente. Repartidores y seguimiento son Fases 4 y 5 |
| Redondeo | Centavos exactos, sin redondeo de cobro a pesos |

## Decisiones técnicas

- Importes en centavos con BigInt en `@nexora/shared`, compartidos por web y API. El descuento general se reparte en proporción al neto de cada línea, con residuo determinista.
- `applyOrderStock` es el único punto donde un pedido cambia saldos. Recorre líneas en orden estable de variante.
- Altas serializadas por comercio con `SELECT … FOR UPDATE` sobre la fila del tenant, para numeración sin repetición y sin interbloqueos entre altas.
- Transiciones atómicas por versión y estado. Repetir una transición ya aplicada devuelve el pedido sin efectos.
- Confirmar un borrador con un precio desactualizado devuelve conflicto: hay que revisarlo y guardarlo de nuevo.
- MySQL protege `OrderEvent` con triggers y valida importes con CHECK. El saldo reservado se contrasta con las reservas activas en una prueba de invariantes.
- `MovementType` añade RESERVE, RELEASE y SALE. Las reservas tienen `quantity` 0 y `reservedDelta` distinto de 0, por lo que no alteran entradas y salidas.

- Las contraseñas usan Argon2id integrado en Node (`crypto.argon2`, disponible en la versión exigida por el proyecto), con los mismos parámetros y formato PHC. Sustituye al paquete `argon2`, cuyo binario sin firmar bloqueaba el Control inteligente de aplicaciones de Windows e impedía arrancar la API. Una prueba verifica un hash real generado por el paquete anterior.

## Verificación

| Comprobación | Resultado |
| --- | --- |
| TypeScript, ESLint, Prettier | Aprobados |
| Unitarias | 17 aprobadas |
| Integración MySQL real | 44 aprobadas (21 anteriores y 23 de Fase 2); las 43 previas a la corrección de triggers, en ejecuciones repetidas |
| E2E Chrome | 2 recorridos aprobados, con puertos alternativos |
| Prueba manual | El usuario informó el 2026-11-09 que el flujo funciona en Chrome y en su servidor local |
| Build API y web | Completado, con salida fuera del repositorio |
| npm audit | 0 vulnerabilidades |
| Contraste AA | 0 textos por debajo del mínimo en 26 capturas con datos, sin evaluar texto sobre degradados |
| Responsive | Sin desbordamiento en ventas, pedidos, clientes, reportes y dashboard a 320, 390, 768, 1024 y 1440 px |

Integración cubre: totales y reparto, idempotencia secuencial y simultánea, última unidad concurrente, numeración concurrente, reserva sin sobreventa, consumo y liberación únicos, cancelar contra completar, confirmación doble, edición de borradores, snapshots históricos, aislamiento entre comercios, filtros, reportes aislados, neutralización de fórmulas CSV, permisos por rol e inmutabilidad en MySQL.

E2E cubre: cliente y dirección, pedido a domicilio, confirmación con reserva visible en inventario, completado, venta directa con descuento, métricas en dashboard y reportes, y vista móvil.

No se afirma: prueba de carga, auditoría de penetración, accesibilidad exhaustiva ni un resultado verificado de GitHub CI.

## Operación

La migración `202611100001_sales_orders` añade columnas y tablas sin modificar datos existentes. Requiere `log_bin_trust_function_creators=1` por sus triggers, como la anterior.

La migración `202611100002_trigger_body_backup_fix` recrea con `BEGIN ... END` los triggers de modificación de movimientos y del historial de pedidos. Sin ella, MySQL los guardaba con un punto y coma final y las copias de mysqldump no se podían restaurar. No cambia datos ni comportamiento. Cualquier trigger nuevo debe usar `BEGIN ... END`.

Para E2E, detener `npm run dev`: si sigue activo, las pruebas llegan a ese servidor y a la base de desarrollo en lugar de `nexora_test`. Durante esta fase varios intentos llegaron así a la base de desarrollo antes de aplicar la migración y fallaron sin escribir datos. La verificación final usó puertos alternativos y `nexora_test`.

[OpenAPI](openapi.json) describe 48 operaciones.
