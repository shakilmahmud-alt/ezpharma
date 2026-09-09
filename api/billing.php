<?php
/**
 * EZ Pharma - Pharmacy Billing & Payment History API
 * Handles subscription status, dynamic renewal dates, and payment history per pharmacy in MySQL
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

    // Ensure subscriptions table exists with correct schema
    $pdo->exec("
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
            CONSTRAINT `fk_subscriptions_pharmacy_id` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    $method = $_SERVER['REQUEST_METHOD'];

    // 1. GET: Fetch current plan & payment history for a pharmacy
    if ($method === 'GET') {
        $pharmacy_id = isset($_GET['pharmacy_id']) ? intval($_GET['pharmacy_id']) : 1;

        // Fetch pharmacy details
        $pStmt = $pdo->prepare("SELECT * FROM pharmacies WHERE id = :id LIMIT 1");
        $pStmt->execute(['id' => $pharmacy_id]);
        $pharm = $pStmt->fetch();

        if (!$pharm) {
            echo json_encode([
                'success' => false,
                'message' => 'Pharmacy not found'
            ]);
            exit;
        }

        // Fetch subscription / payment records
        $sStmt = $pdo->prepare("
            SELECT id, pharmacy_id, plan, amount, currency, payment_provider as method, payment_status as status,
                   transaction_id, starts_at, expires_at, notes, created_at
            FROM subscriptions
            WHERE pharmacy_id = :id
            ORDER BY created_at DESC
        ");
        $sStmt->execute(['id' => $pharmacy_id]);
        $payments = $sStmt->fetchAll();

        // If no records in subscriptions yet, insert the initial registration payment automatically
        if (empty($payments)) {
            $isYearly = ($pharm['plan'] === 'yearly');
            $initAmount = $isYearly ? 4500.00 : 400.00;
            $startDate = $pharm['created_at'] ?: date('Y-m-d H:i:s');
            $expireDate = $isYearly ? date('Y-m-d H:i:s', strtotime('+1 year', strtotime($startDate))) : date('Y-m-d H:i:s', strtotime('+1 month', strtotime($startDate)));
            $status = ($pharm['status'] === 'pending_payment') ? 'Pending' : 'Succeeded';

            $ins = $pdo->prepare("
                INSERT INTO subscriptions (pharmacy_id, plan, amount, currency, payment_provider, payment_status, starts_at, expires_at, created_at)
                VALUES (:pharmacy_id, :plan, :amount, 'BDT', 'Cash', :status, :starts_at, :expires_at, :created_at)
            ");
            $ins->execute([
                'pharmacy_id' => $pharmacy_id,
                'plan' => $pharm['plan'] ?: 'monthly',
                'amount' => $initAmount,
                'status' => $status,
                'starts_at' => $startDate,
                'expires_at' => $expireDate,
                'created_at' => $startDate
            ]);

            // Re-fetch
            $sStmt->execute(['id' => $pharmacy_id]);
            $payments = $sStmt->fetchAll();
        }

        // Calculate latest renew date
        $latestPayment = !empty($payments) ? $payments[0] : null;
        $isYearly = ($pharm['plan'] === 'yearly');
        $regDate = $pharm['created_at'] ?: date('Y-m-d H:i:s');
        $renewDate = $latestPayment && $latestPayment['expires_at'] ? $latestPayment['expires_at'] : ($isYearly ? date('Y-m-d H:i:s', strtotime('+1 year', strtotime($regDate))) : date('Y-m-d H:i:s', strtotime('+1 month', strtotime($regDate))));

        echo json_encode([
            'success' => true,
            'pharmacy' => [
                'id' => $pharm['id'],
                'name' => $pharm['name'],
                'plan' => $pharm['plan'],
                'status' => $pharm['status'],
                'renew_date' => $renewDate,
                'created_at' => $pharm['created_at']
            ],
            'payments' => $payments
        ]);
        exit;
    }

    // 2. POST: Record / Process Payment for pharmacy
    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true) ?: $_POST;

        $pharmacy_id = isset($input['pharmacy_id']) ? intval($input['pharmacy_id']) : 1;
        $plan = (isset($input['plan']) && strtolower($input['plan']) === 'yearly') ? 'yearly' : 'monthly';
        $amount = isset($input['amount']) ? floatval($input['amount']) : ($plan === 'yearly' ? 4500.00 : 400.00);
        $method = trim($input['method'] ?? $input['payment_method'] ?? 'Online Gateway');
        $notes = trim($input['notes'] ?? 'Subscription payment processed');

        $now = date('Y-m-d H:i:s');
        $expires_at = ($plan === 'yearly') ? date('Y-m-d H:i:s', strtotime('+1 year')) : date('Y-m-d H:i:s', strtotime('+1 month'));

        // Insert new payment record
        $ins = $pdo->prepare("
            INSERT INTO subscriptions (pharmacy_id, plan, amount, currency, payment_provider, payment_status, starts_at, expires_at, notes, created_at)
            VALUES (:pharmacy_id, :plan, :amount, 'BDT', :method, 'Succeeded', :starts_at, :expires_at, :notes, :created_at)
        ");
        $ins->execute([
            'pharmacy_id' => $pharmacy_id,
            'plan' => $plan,
            'amount' => $amount,
            'method' => $method,
            'starts_at' => $now,
            'expires_at' => $expires_at,
            'notes' => $notes,
            'created_at' => $now
        ]);

        // Update pharmacy plan and status to active
        $upPharm = $pdo->prepare("
            UPDATE pharmacies 
            SET plan = :plan, status = 'active', updated_at = NOW() 
            WHERE id = :id
        ");
        $upPharm->execute([
            'plan' => $plan,
            'id' => $pharmacy_id
        ]);

        echo json_encode([
            'success' => true,
            'message' => 'Payment recorded and subscription updated successfully in MySQL database',
            'pharmacy_id' => $pharmacy_id,
            'plan' => $plan,
            'expires_at' => $expires_at
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
