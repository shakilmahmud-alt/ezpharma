<?php
/**
 * EZ Pharma - Pharmacy System Settings API
 * Handles per-pharmacy system settings (Business, Localization, Invoice, Tax)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db.php';

    // Ensure pharmacy_settings table exists
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `pharmacy_settings` (
            `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
            `pharmacy_id` INT(11) UNSIGNED NOT NULL UNIQUE,
            `business_name` VARCHAR(191) DEFAULT NULL,
            `email` VARCHAR(191) DEFAULT NULL,
            `address` TEXT DEFAULT NULL,
            `phone` VARCHAR(50) DEFAULT NULL,
            `registration_number` VARCHAR(100) DEFAULT NULL,
            `tax_id` VARCHAR(100) DEFAULT NULL,
            `currency` VARCHAR(50) DEFAULT 'US Dollar ($)',
            `date_format` VARCHAR(50) DEFAULT 'DD/MM/YYYY',
            `timezone` VARCHAR(50) DEFAULT 'UTC',
            `invoice_prefix` VARCHAR(20) DEFAULT 'INV',
            `invoice_footer` TEXT DEFAULT NULL,
            `payment_terms` TEXT DEFAULT NULL,
            `tax_enabled` TINYINT(1) DEFAULT 1,
            `tax_label` VARCHAR(50) DEFAULT 'VAT',
            `tax_rate` DECIMAL(5,2) DEFAULT 16.00,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            CONSTRAINT `fk_settings_pharmacy_id` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    $method = $_SERVER['REQUEST_METHOD'];

    // 1. GET: Fetch settings for a specific pharmacy
    if ($method === 'GET') {
        $pharmacy_id = isset($_GET['pharmacy_id']) ? intval($_GET['pharmacy_id']) : 1;

        $stmt = $pdo->prepare("SELECT * FROM pharmacy_settings WHERE pharmacy_id = :pharmacy_id LIMIT 1");
        $stmt->execute(['pharmacy_id' => $pharmacy_id]);
        $settings = $stmt->fetch();

        // If no settings exist yet, fetch pharmacy basics from pharmacies table as default
        if (!$settings) {
            $pStmt = $pdo->prepare("
                SELECT p.id, p.name, p.address, p.phone, u.email as owner_email 
                FROM pharmacies p 
                LEFT JOIN users u ON u.pharmacy_id = p.id AND u.role = 'pharmacy_admin'
                WHERE p.id = :pharmacy_id LIMIT 1
            ");
            $pStmt->execute(['pharmacy_id' => $pharmacy_id]);
            $pharm = $pStmt->fetch();

            $settings = [
                'pharmacy_id' => $pharmacy_id,
                'business_name' => $pharm ? $pharm['name'] : 'Demo Pharmacy',
                'email' => $pharm ? ($pharm['owner_email'] ?: 'admin@pharmacy.com') : 'admin@pharmacy.com',
                'address' => $pharm ? ($pharm['address'] ?: '') : '',
                'phone' => $pharm ? ($pharm['phone'] ?: '') : '',
                'registration_number' => '',
                'tax_id' => '',
                'currency' => 'US Dollar ($)',
                'date_format' => 'DD/MM/YYYY',
                'timezone' => 'UTC',
                'invoice_prefix' => 'INV',
                'invoice_footer' => 'Thank you for your business!',
                'payment_terms' => 'Payment is due within 30 days',
                'tax_enabled' => 1,
                'tax_label' => 'VAT',
                'tax_rate' => 16.00
            ];
        }

        echo json_encode([
            'success' => true,
            'data' => $settings
        ]);
        exit;
    }

    // 2. POST: Save / Update settings for a specific pharmacy
    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true) ?: $_POST;

        $pharmacy_id = isset($input['pharmacy_id']) ? intval($input['pharmacy_id']) : 1;
        $business_name = trim($input['business_name'] ?? '');
        $email = trim($input['email'] ?? '');
        $address = trim($input['address'] ?? '');
        $phone = trim($input['phone'] ?? '');
        $registration_number = trim($input['registration_number'] ?? '');
        $tax_id = trim($input['tax_id'] ?? '');
        $currency = trim($input['currency'] ?? 'US Dollar ($)');
        $date_format = trim($input['date_format'] ?? 'DD/MM/YYYY');
        $timezone = trim($input['timezone'] ?? 'UTC');
        $invoice_prefix = trim($input['invoice_prefix'] ?? 'INV');
        $invoice_footer = trim($input['invoice_footer'] ?? 'Thank you for your business!');
        $payment_terms = trim($input['payment_terms'] ?? 'Payment is due within 30 days');
        $tax_enabled = isset($input['tax_enabled']) ? intval($input['tax_enabled']) : 1;
        $tax_label = trim($input['tax_label'] ?? 'VAT');
        $tax_rate = floatval($input['tax_rate'] ?? 16.00);

        $upsert = $pdo->prepare("
            INSERT INTO pharmacy_settings (
                pharmacy_id, business_name, email, address, phone, registration_number, tax_id,
                currency, date_format, timezone, invoice_prefix, invoice_footer, payment_terms,
                tax_enabled, tax_label, tax_rate, updated_at
            ) VALUES (
                :pharmacy_id, :business_name, :email, :address, :phone, :registration_number, :tax_id,
                :currency, :date_format, :timezone, :invoice_prefix, :invoice_footer, :payment_terms,
                :tax_enabled, :tax_label, :tax_rate, NOW()
            ) ON DUPLICATE KEY UPDATE
                business_name = :business_name,
                email = :email,
                address = :address,
                phone = :phone,
                registration_number = :registration_number,
                tax_id = :tax_id,
                currency = :currency,
                date_format = :date_format,
                timezone = :timezone,
                invoice_prefix = :invoice_prefix,
                invoice_footer = :invoice_footer,
                payment_terms = :payment_terms,
                tax_enabled = :tax_enabled,
                tax_label = :tax_label,
                tax_rate = :tax_rate,
                updated_at = NOW()
        ");

        $upsert->execute([
            'pharmacy_id' => $pharmacy_id,
            'business_name' => $business_name,
            'email' => $email,
            'address' => $address,
            'phone' => $phone,
            'registration_number' => $registration_number,
            'tax_id' => $tax_id,
            'currency' => $currency,
            'date_format' => $date_format,
            'timezone' => $timezone,
            'invoice_prefix' => $invoice_prefix,
            'invoice_footer' => $invoice_footer,
            'payment_terms' => $payment_terms,
            'tax_enabled' => $tax_enabled,
            'tax_label' => $tax_label,
            'tax_rate' => $tax_rate
        ]);

        // Also sync business name, address, phone to main pharmacies table
        if ($business_name) {
            $upPharm = $pdo->prepare("UPDATE pharmacies SET name = :name, address = :address, phone = :phone, updated_at = NOW() WHERE id = :id");
            $upPharm->execute([
                'name' => $business_name,
                'address' => $address,
                'phone' => $phone,
                'id' => $pharmacy_id
            ]);
        }

        echo json_encode([
            'success' => true,
            'message' => 'Settings saved successfully to MySQL database',
            'pharmacy_id' => $pharmacy_id
        ]);
        exit;
    }

} catch (Exception $e) {
    http_response_code(200);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
