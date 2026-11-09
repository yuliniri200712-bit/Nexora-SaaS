-- AlterTable
ALTER TABLE `StockMovement` ADD COLUMN `orderId` CHAR(36) NULL,
    ADD COLUMN `reservedDelta` INTEGER NOT NULL DEFAULT 0,
    MODIFY `type` ENUM('IN', 'OUT', 'ADJUSTMENT', 'RESERVE', 'RELEASE', 'SALE') NOT NULL;

-- AlterTable
ALTER TABLE `Tenant` ADD COLUMN `lastOrderNumber` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `Customer` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(191) NULL,
    `notes` VARCHAR(500) NOT NULL DEFAULT '',
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Customer_tenantId_name_idx`(`tenantId`, `name`),
    UNIQUE INDEX `Customer_tenantId_id_key`(`tenantId`, `id`),
    UNIQUE INDEX `Customer_tenantId_phone_key`(`tenantId`, `phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerAddress` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `customerId` CHAR(36) NOT NULL,
    `label` VARCHAR(50) NOT NULL,
    `line` VARCHAR(200) NOT NULL,
    `city` VARCHAR(100) NOT NULL,
    `notes` VARCHAR(300) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CustomerAddress_tenantId_customerId_idx`(`tenantId`, `customerId`),
    UNIQUE INDEX `CustomerAddress_tenantId_id_key`(`tenantId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalesOrder` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `number` INTEGER NOT NULL,
    `customerId` CHAR(36) NULL,
    `channel` ENUM('COUNTER', 'DELIVERY') NOT NULL,
    `status` ENUM('DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED') NOT NULL,
    `customerName` VARCHAR(120) NOT NULL DEFAULT '',
    `customerPhone` VARCHAR(20) NULL,
    `deliveryAddress` VARCHAR(700) NULL,
    `subtotal` DECIMAL(18, 2) NOT NULL,
    `orderDiscount` DECIMAL(18, 2) NOT NULL,
    `discountTotal` DECIMAL(18, 2) NOT NULL,
    `deliveryFee` DECIMAL(18, 2) NOT NULL,
    `total` DECIMAL(18, 2) NOT NULL,
    `notes` VARCHAR(500) NOT NULL DEFAULT '',
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdById` CHAR(36) NOT NULL,
    `idempotencyKey` VARCHAR(100) NOT NULL,
    `requestHash` CHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `confirmedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,

    INDEX `SalesOrder_tenantId_createdAt_id_idx`(`tenantId`, `createdAt`, `id`),
    INDEX `SalesOrder_tenantId_status_createdAt_idx`(`tenantId`, `status`, `createdAt`),
    INDEX `SalesOrder_tenantId_completedAt_idx`(`tenantId`, `completedAt`),
    INDEX `SalesOrder_tenantId_customerId_createdAt_idx`(`tenantId`, `customerId`, `createdAt`),
    UNIQUE INDEX `SalesOrder_tenantId_id_key`(`tenantId`, `id`),
    UNIQUE INDEX `SalesOrder_tenantId_number_key`(`tenantId`, `number`),
    UNIQUE INDEX `SalesOrder_tenantId_createdById_idempotencyKey_key`(`tenantId`, `createdById`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderLine` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NOT NULL,
    `variantId` CHAR(36) NOT NULL,
    `productName` VARCHAR(150) NOT NULL,
    `variantName` VARCHAR(100) NOT NULL,
    `sku` VARCHAR(64) NOT NULL,
    `unitPrice` DECIMAL(18, 2) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `discount` DECIMAL(18, 2) NOT NULL,
    `orderDiscountShare` DECIMAL(18, 2) NOT NULL,
    `lineTotal` DECIMAL(18, 2) NOT NULL,

    UNIQUE INDEX `OrderLine_tenantId_id_key`(`tenantId`, `id`),
    UNIQUE INDEX `OrderLine_tenantId_orderId_variantId_key`(`tenantId`, `orderId`, `variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockReservation` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `lineId` CHAR(36) NOT NULL,
    `variantId` CHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'CONSUMED', 'RELEASED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StockReservation_tenantId_id_key`(`tenantId`, `id`),
    UNIQUE INDEX `StockReservation_tenantId_lineId_key`(`tenantId`, `lineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderEvent` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NOT NULL,
    `actorId` CHAR(36) NOT NULL,
    `fromStatus` ENUM('DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED') NULL,
    `toStatus` ENUM('DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED') NOT NULL,
    `reason` VARCHAR(500) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderEvent_tenantId_orderId_createdAt_idx`(`tenantId`, `orderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_tenantId_orderId_fkey` FOREIGN KEY (`tenantId`, `orderId`) REFERENCES `SalesOrder`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerAddress` ADD CONSTRAINT `CustomerAddress_tenantId_customerId_fkey` FOREIGN KEY (`tenantId`, `customerId`) REFERENCES `Customer`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalesOrder` ADD CONSTRAINT `SalesOrder_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalesOrder` ADD CONSTRAINT `SalesOrder_tenantId_customerId_fkey` FOREIGN KEY (`tenantId`, `customerId`) REFERENCES `Customer`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `SalesOrder` ADD CONSTRAINT `SalesOrder_tenantId_createdById_fkey` FOREIGN KEY (`tenantId`, `createdById`) REFERENCES `Membership`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderLine` ADD CONSTRAINT `OrderLine_tenantId_orderId_fkey` FOREIGN KEY (`tenantId`, `orderId`) REFERENCES `SalesOrder`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderLine` ADD CONSTRAINT `OrderLine_tenantId_variantId_fkey` FOREIGN KEY (`tenantId`, `variantId`) REFERENCES `ProductVariant`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_tenantId_lineId_fkey` FOREIGN KEY (`tenantId`, `lineId`) REFERENCES `OrderLine`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_tenantId_variantId_fkey` FOREIGN KEY (`tenantId`, `variantId`) REFERENCES `ProductVariant`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderEvent` ADD CONSTRAINT `OrderEvent_tenantId_orderId_fkey` FOREIGN KEY (`tenantId`, `orderId`) REFERENCES `SalesOrder`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderEvent` ADD CONSTRAINT `OrderEvent_tenantId_actorId_fkey` FOREIGN KEY (`tenantId`, `actorId`) REFERENCES `Membership`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariantes de importes y cantidades, tambiÃ©n fuera de la API.
ALTER TABLE `SalesOrder` ADD CONSTRAINT `order_amounts_valid` CHECK (`subtotal` >= 0 AND `orderDiscount` >= 0 AND `discountTotal` >= 0 AND `discountTotal` <= `subtotal` AND `deliveryFee` >= 0 AND `total` >= 0);
ALTER TABLE `OrderLine` ADD CONSTRAINT `order_line_valid` CHECK (`quantity` > 0 AND `unitPrice` >= 0 AND `discount` >= 0 AND `orderDiscountShare` >= 0 AND `lineTotal` >= 0);
ALTER TABLE `StockReservation` ADD CONSTRAINT `reservation_quantity_valid` CHECK (`quantity` > 0);

-- La historia de un pedido no se reescribe.
CREATE TRIGGER `order_event_no_update` BEFORE UPDATE ON `OrderEvent` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El historial de pedidos no se puede modificar.';
CREATE TRIGGER `order_event_no_delete` BEFORE DELETE ON `OrderEvent` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El historial de pedidos no se puede eliminar.';
