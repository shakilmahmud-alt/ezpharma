<?php
/**
 * EZ Pharma - Payment Methods & Gateways API Endpoint
 * Database: holidaym_ezpharma
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db.php';

// Auto-create table if not exists
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS payment_methods (
            id INT AUTO_INCREMENT PRIMARY KEY,
            provider VARCHAR(50) NOT NULL UNIQUE,
            title VARCHAR(100) NOT NULL,
            mode ENUM('sandbox', 'live') DEFAULT 'sandbox',
            is_active TINYINT(1) DEFAULT 0,
            public_key VARCHAR(255) NULL,
            secret_key VARCHAR(255) NULL,
            merchant_id VARCHAR(255) NULL,
            webhook_secret VARCHAR(255) NULL,
            instructions TEXT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
} catch (Exception $e) {
    // Continue even if table exists
}

// ----------------------------------------------------
// GET: Fetch configured payment methods
// ----------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM payment_methods ORDER BY id ASC");
        $methods = $stmt->fetchAll();

        // Default list if empty in DB
        if (empty($methods)) {
            $defaultMethods = [
                ['provider' => 'cash', 'title' => 'Cash & Offline Payment', 'mode' => 'live', 'is_active' => 1, 'public_key' => '', 'secret_key' => '', 'merchant_id' => '', 'webhook_secret' => '', 'instructions' => 'Collect cash on premise or bank transfer.'],
                ['provider' => 'bkash', 'title' => 'bKash Merchant Gateway', 'mode' => 'sandbox', 'is_active' => 0, 'public_key' => '', 'secret_key' => '', 'merchant_id' => '', 'webhook_secret' => '', 'instructions' => ''],
                ['provider' => 'nagad', 'title' => 'Nagad Payment Gateway', 'mode' => 'sandbox', 'is_active' => 0, 'public_key' => '', 'secret_key' => '', 'merchant_id' => '', 'webhook_secret' => '', 'instructions' => ''],
                ['provider' => 'online_gateway', 'title' => 'Debit / Credit Card Gateway', 'mode' => 'sandbox', 'is_active' => 0, 'public_key' => '', 'secret_key' => '', 'merchant_id' => '', 'webhook_secret' => '', 'instructions' => ''],
                ['provider' => 'sslcommerz', 'title' => 'SSLCommerz Hosted Gateway', 'mode' => 'sandbox', 'is_active' => 0, 'public_key' => '', 'secret_key' => '', 'merchant_id' => '', 'webhook_secret' => '', 'instructions' => '']
            ];

            foreach ($defaultMethods as $dm) {
                $ins = $pdo->prepare("
                    INSERT INTO payment_methods (provider, title, mode, is_active, public_key, secret_key, merchant_id, webhook_secret, instructions, updated_at)
                    VALUES (:provider, :title, :mode, :is_active, :public_key, :secret_key, :merchant_id, :webhook_secret, :instructions, NOW())
                    ON DUPLICATE KEY UPDATE title = :title
                ");
                $ins->execute($dm);
            }

            $stmt = $pdo->query("SELECT * FROM payment_methods ORDER BY id ASC");
            $methods = $stmt->fetchAll();
        }

        echo json_encode([
            'success' => true,
            'data' => $methods
        ]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
        exit;
    }
}

// ----------------------------------------------------
// POST: Save or Update a Payment Method
// ----------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw_input = file_get_contents('php://input');
    $data = json_decode($raw_input, true);

    if (!$data || empty($data['provider'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid payment method data.']);
        exit;
    }

    $provider = strtolower(trim($data['provider']));
    $title = trim($data['title'] ?? ucfirst($provider));
    $mode = in_array(strtolower($data['mode'] ?? ''), ['live', 'sandbox']) ? strtolower($data['mode']) : 'sandbox';
    $is_active = !empty($data['is_active']) ? 1 : 0;
    $public_key = trim($data['public_key'] ?? '');
    $secret_key = trim($data['secret_key'] ?? '');
    $merchant_id = trim($data['merchant_id'] ?? '');
    $webhook_secret = trim($data['webhook_secret'] ?? '');
    $instructions = trim($data['instructions'] ?? '');

    try {
        $stmt = $pdo->prepare("
            INSERT INTO payment_methods (provider, title, mode, is_active, public_key, secret_key, merchant_id, webhook_secret, instructions, updated_at)
            VALUES (:provider, :title, :mode, :is_active, :public_key, :secret_key, :merchant_id, :webhook_secret, :instructions, NOW())
            ON DUPLICATE KEY UPDATE
                title = :title,
                mode = :mode,
                is_active = :is_active,
                public_key = :public_key,
                secret_key = :secret_key,
                merchant_id = :merchant_id,
                webhook_secret = :webhook_secret,
                instructions = :instructions,
                updated_at = NOW()
        ");

        $stmt->execute([
            ':provider' => $provider,
            ':title' => $title,
            ':mode' => $mode,
            ':is_active' => $is_active,
            ':public_key' => $public_key,
            ':secret_key' => $secret_key,
            ':merchant_id' => $merchant_id,
            ':webhook_secret' => $webhook_secret,
            ':instructions' => $instructions
        ]);

        echo json_encode([
            'success' => true,
            'message' => "Payment method '{$title}' updated successfully in database.",
            'data' => [
                'provider' => $provider,
                'title' => $title,
                'mode' => $mode,
                'is_active' => $is_active
            ]
        ]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database save error: ' . $e->getMessage()]);
        exit;
    }
}
