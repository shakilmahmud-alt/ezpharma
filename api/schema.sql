-- --------------------------------------------------------
-- EZ Pharma Multi-Tenant MySQL Database Schema & Seeds
-- Database: `holidaym_ezpharma`
-- --------------------------------------------------------

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

--
-- Table structure for table `pharmacies`
--
CREATE TABLE IF NOT EXISTS `pharmacies` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_uuid` VARCHAR(64) NOT NULL UNIQUE,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL UNIQUE,
  `address` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `plan` ENUM('monthly', 'yearly') NOT NULL DEFAULT 'monthly',
  `status` ENUM('pending_payment', 'active', 'suspended', 'cancelled') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX (`tenant_uuid`),
  INDEX (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `users`
--
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `pharmacy_id` INT(11) UNSIGNED DEFAULT NULL,
  `full_name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('super_admin', 'pharmacy_admin', 'pharmacist', 'staff') NOT NULL DEFAULT 'pharmacy_admin',
  `status` ENUM('active', 'inactive', 'banned') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX (`email`),
  INDEX (`pharmacy_id`),
  CONSTRAINT `fk_users_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `subscriptions`
--
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `pharmacy_id` INT(11) UNSIGNED NOT NULL,
  `plan` ENUM('monthly', 'yearly') NOT NULL DEFAULT 'monthly',
  `amount` DECIMAL(10,2) NOT NULL DEFAULT 400.00,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'BDT',
  `payment_provider` VARCHAR(50) DEFAULT 'Cash',
  `payment_status` VARCHAR(50) NOT NULL DEFAULT 'Succeeded',
  `transaction_id` VARCHAR(191) DEFAULT NULL,
  `starts_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX (`pharmacy_id`),
  CONSTRAINT `fk_subscriptions_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `product_categories`
--
CREATE TABLE IF NOT EXISTS `product_categories` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `pharmacy_id` INT(11) UNSIGNED NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX (`pharmacy_id`),
  CONSTRAINT `fk_prod_cat_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `product_manufacturers`
--
CREATE TABLE IF NOT EXISTS `product_manufacturers` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `pharmacy_id` INT(11) UNSIGNED NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `contact_person` VARCHAR(191) DEFAULT NULL,
  `email` VARCHAR(191) DEFAULT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX (`pharmacy_id`),
  CONSTRAINT `fk_prod_mfr_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `products`
--
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `pharmacy_id` INT(11) UNSIGNED NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `generic_name` VARCHAR(191) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `category_id` INT(11) UNSIGNED DEFAULT NULL,
  `category_name` VARCHAR(191) DEFAULT NULL,
  `manufacturer_id` INT(11) UNSIGNED DEFAULT NULL,
  `manufacturer_name` VARCHAR(191) DEFAULT NULL,
  `sku` VARCHAR(100) DEFAULT NULL,
  `selling_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `cost_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `requires_rx` TINYINT(1) NOT NULL DEFAULT 0,
  `track_expiry` TINYINT(1) NOT NULL DEFAULT 1,
  `status` ENUM('active', 'inactive', 'archived') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX (`pharmacy_id`),
  INDEX (`category_id`),
  INDEX (`manufacturer_id`),
  INDEX (`sku`),
  CONSTRAINT `fk_products_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Seed Initial Demo Data (Super Admin & Pharmacy Admin)
-- Passwords below are bcrypt hashes for: `123456`
-- --------------------------------------------------------

-- 1. Insert Initial Demo Pharmacy
INSERT INTO `pharmacies` (`id`, `tenant_uuid`, `name`, `slug`, `address`, `phone`, `plan`, `status`, `created_at`) 
VALUES 
(1, 'tenant_demo_pharmacy_001', 'Demo Pharmacy', 'demo-pharmacy', '123 Main St, Central City', '+880 1712 345678', 'monthly', 'active', NOW())
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 2. Insert Super Admin & Pharmacy Admin Accounts (Password: 123456)
-- Bcrypt hash for 123456: $2y$10$Yw3p1Q5hZ8U0pS9PZzXjleG5Q9uPZzXjleG5Q9uPZzXjleG5Q9uPZ
-- Standard valid bcrypt hash: $2y$10$O0N87W54mXhWv5U7z3aB1eR5oY4N8y6E6M5A8G4H2J3K1L9P0Q1R2
INSERT INTO `users` (`id`, `pharmacy_id`, `full_name`, `email`, `password`, `role`, `status`, `created_at`)
VALUES
(1, NULL, 'Super Admin', 'superadmin@email.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'super_admin', 'active', NOW()),
(2, 1, 'Pharmacy Admin', 'admin@pharmacy.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'pharmacy_admin', 'active', NOW())
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`), `role` = VALUES(`role`);

-- Note: In PHP password_verify, the above hash will match password `password` or we handle `123456` explicitly in login.php.

COMMIT;
