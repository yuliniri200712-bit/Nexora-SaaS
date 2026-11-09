-- Los movimientos de inventario son historial: una corrección se registra como un movimiento nuevo.
CREATE TRIGGER `stock_movement_no_update` BEFORE UPDATE ON `StockMovement` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los movimientos de inventario no se pueden modificar.';
CREATE TRIGGER `stock_movement_no_delete` BEFORE DELETE ON `StockMovement` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los movimientos de inventario no se pueden eliminar.';
