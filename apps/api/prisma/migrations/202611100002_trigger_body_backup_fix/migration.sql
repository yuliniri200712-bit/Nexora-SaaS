-- Prisma ejecuta cada migración como un único script. MySQL guardó el cuerpo de los triggers
-- que no eran la última instrucción con el ";" final, y mysqldump genera entonces copias que no
-- se pueden restaurar. Con BEGIN ... END el cuerpo se guarda completo y sin ese carácter.
-- Usar BEGIN ... END en cualquier trigger nuevo. El comportamiento no cambia.
DROP TRIGGER `stock_movement_no_update`;
CREATE TRIGGER `stock_movement_no_update` BEFORE UPDATE ON `StockMovement` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los movimientos de inventario no se pueden modificar.'; END;
DROP TRIGGER `order_event_no_update`;
CREATE TRIGGER `order_event_no_update` BEFORE UPDATE ON `OrderEvent` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El historial de pedidos no se puede modificar.'; END;
