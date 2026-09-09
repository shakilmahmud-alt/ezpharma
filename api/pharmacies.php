<?php
/**
 * EZ Pharma - Pharmacies Management API (Full CRUD, Suspension, Payment Recording)
 * Database: holidaym_ezpharma
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db.php';

// Auto-create payments history table if not exists
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS payment_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            pharmacy_id INT NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            currency VARCHAR(10) DEFAULT 'BDT',
            payment_method VARCHAR(50) NOT NULL,
            package_name VARCHAR(100) NOT NULL,
            status VARCHAR(50) DEFAULT 'Succeeded',
            notes TEXT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
} catch (Exception $e) {}

// ----------------------------------------------------
// GET: Fetch all pharmacies OR single pharmacy by ID
// ----------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $pharmacy_id = isset($_GET['id']) ? intval($_GET['id']) : 0;

    try {
        if ($pharmacy_id > 0) {
            // Fetch single pharmacy details
            $stmt = $pdo->prepare("
                SELECT 
                    p.id,
                    p.tenant_uuid,
                    p.name,
                    p.slug,
                    p.address,
                    p.phone,
                    p.plan,
                    p.status,
                    p.created_at,
                    u.id AS user_id,
                    u.full_name AS owner_name,
                    u.email AS owner_email,
                    s.amount,
                    s.payment_provider,
                    s.payment_status,
                    s.starts_at,
                    s.expires_at
                FROM pharmacies p
                LEFT JOIN users u ON p.id = u.pharmacy_id AND u.role = 'pharmacy_admin'
                LEFT JOIN subscriptions s ON p.id = s.pharmacy_id
                WHERE p.id = :id
                LIMIT 1
            ");
            $stmt->execute([':id' => $pharmacy_id]);
            $pharmacy = $stmt->fetch();

            if (!$pharmacy) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Pharmacy not found.']);
                exit;
            }

            // Fetch payment history
            $stmtPay = $pdo->prepare("
                SELECT * FROM payment_history WHERE pharmacy_id = :id ORDER BY id DESC
            ");
            $stmtPay->execute([':id' => $pharmacy_id]);
            $history = $stmtPay->fetchAll();

            // Fallback initial payment if history is empty
            $startDate = !empty($pharmacy['starts_at']) ? $pharmacy['starts_at'] : (!empty($pharmacy['created_at']) ? $pharmacy['created_at'] : date('Y-m-d H:i:s'));
            $isYearly = ($pharmacy['plan'] === 'yearly');
            $calcExpiry = date('Y-m-d H:i:s', strtotime($isYearly ? '+1 year' : '+1 month', strtotime($startDate)));
            
            if (empty($pharmacy['starts_at'])) {
                $pharmacy['starts_at'] = $startDate;
            }
            if (empty($pharmacy['expires_at'])) {
                $pharmacy['expires_at'] = $calcExpiry;
            }

            if (empty($history)) {
                $history = [
                    [
                        'id' => 1,
                        'pharmacy_id' => $pharmacy['id'],
                        'amount' => !empty($pharmacy['amount']) ? $pharmacy['amount'] : ($isYearly ? 4500.00 : 400.00),
                        'currency' => 'BDT',
                        'payment_method' => ucfirst($pharmacy['payment_provider'] ?? 'Cash'),
                        'package_name' => ucfirst($pharmacy['plan'] ?? 'Monthly'),
                        'status' => 'Succeeded',
                        'notes' => 'Initial subscription registration',
                        'created_at' => $startDate
                    ]
                ];
            }

            echo json_encode([
                'success' => true,
                'data' => $pharmacy,
                'payment_history' => $history
            ]);
            exit;
        }

        // Fetch all pharmacies
        $stmt = $pdo->query("
            SELECT 
                p.id,
                p.tenant_uuid,
                p.name,
                p.slug,
                p.address,
                p.phone,
                p.plan,
                p.status,
                p.created_at,
                u.id AS user_id,
                u.full_name AS owner_name,
                u.email AS owner_email,
                s.amount,
                s.payment_provider,
                s.payment_status,
                s.starts_at,
                s.expires_at
            FROM pharmacies p
            LEFT JOIN users u ON p.id = u.pharmacy_id AND u.role = 'pharmacy_admin'
            LEFT JOIN subscriptions s ON p.id = s.pharmacy_id
            ORDER BY p.id DESC
        ");
        $pharmacies = $stmt->fetchAll();

        $total = count($pharmacies);
        $active = 0;
        $expired = 0;
        $suspended = 0;

        foreach ($pharmacies as $item) {
            if ($item['status'] === 'active') $active++;
            elseif ($item['status'] === 'suspended') $suspended++;
            else $expired++;
        }

        echo json_encode([
            'success' => true,
            'summary' => [
                'total' => $total,
                'active' => $active,
                'expired' => $expired,
                'suspended' => $suspended
            ],
            'data' => $pharmacies
        ]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database query error: ' . $e->getMessage()]);
        exit;
    }
}

// ----------------------------------------------------
// POST: Actions (create, edit, suspend, record_payment, delete)
// ----------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw_input = file_get_contents('php://input');
    $data = json_decode($raw_input, true);

    if (!$data) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON input.']);
        exit;
    }

    $action = trim($data['action'] ?? 'create');

    // 1. SUSPEND / ACTIVATE PHARMACY
    if ($action === 'suspend' || $action === 'toggle_status') {
        $pharmacy_id = intval($data['pharmacy_id'] ?? 0);
        $new_status = trim($data['status'] ?? 'suspended'); // 'suspended' or 'active'

        if ($pharmacy_id <= 0) {
            http_response_code(422);
            echo json_encode(['success' => false, 'message' => 'Valid pharmacy ID required.']);
            exit;
        }

        try {
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("UPDATE pharmacies SET status = :status WHERE id = :id");
            $stmt->execute([':status' => $new_status, ':id' => $pharmacy_id]);

            $stmt2 = $pdo->prepare("UPDATE users SET status = :status WHERE pharmacy_id = :id");
            $stmt2->execute([':status' => $new_status, ':id' => $pharmacy_id]);

            $pdo->commit();

            echo json_encode([
                'success' => true,
                'message' => "Pharmacy status updated to {$new_status}.",
                'status' => $new_status
            ]);
            exit;
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
            exit;
        }
    }

    // 2. EDIT PHARMACY DETAILS & PASSWORD
    if ($action === 'edit') {
        $pharmacy_id = intval($data['pharmacy_id'] ?? 0);
        $name = trim($data['pharmacy_name'] ?? '');
        $address = trim($data['address'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $full_name = trim($data['full_name'] ?? '');
        $email = filter_var(trim($data['email'] ?? ''), FILTER_VALIDATE_EMAIL);
        $password = trim($data['password'] ?? '');

        if ($pharmacy_id <= 0 || empty($name) || empty($full_name) || !$email) {
            http_response_code(422);
            echo json_encode(['success' => false, 'message' => 'Please fill required fields properly.']);
            exit;
        }

        try {
            $pdo->beginTransaction();

            // Update pharmacy
            $stmt = $pdo->prepare("
                UPDATE pharmacies 
                SET name = :name, address = :address, phone = :phone 
                WHERE id = :id
            ");
            $stmt->execute([
                ':name' => $name,
                ':address' => $address,
                ':phone' => $phone,
                ':id' => $pharmacy_id
            ]);

            // Update user details
            if (!empty($password)) {
                $password_hash = password_hash($password, PASSWORD_BCRYPT);
                $stmtU = $pdo->prepare("
                    UPDATE users 
                    SET full_name = :full_name, email = :email, password = :password 
                    WHERE pharmacy_id = :pharmacy_id AND role = 'pharmacy_admin'
                ");
                $stmtU->execute([
                    ':full_name' => $full_name,
                    ':email' => $email,
                    ':password' => $password_hash,
                    ':pharmacy_id' => $pharmacy_id
                ]);
            } else {
                $stmtU = $pdo->prepare("
                    UPDATE users 
                    SET full_name = :full_name, email = :email 
                    WHERE pharmacy_id = :pharmacy_id AND role = 'pharmacy_admin'
                ");
                $stmtU->execute([
                    ':full_name' => $full_name,
                    ':email' => $email,
                    ':pharmacy_id' => $pharmacy_id
                ]);
            }

            $pdo->commit();

            echo json_encode([
                'success' => true,
                'message' => 'Pharmacy and admin credentials updated successfully.',
                'data' => [
                    'id' => $pharmacy_id,
                    'name' => $name,
                    'address' => $address,
                    'phone' => $phone,
                    'owner_name' => $full_name,
                    'owner_email' => $email
                ]
            ]);
            exit;
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
            exit;
        }
    }

    // 3. RECORD PAYMENT
    if ($action === 'record_payment') {
        $pharmacy_id = intval($data['pharmacy_id'] ?? 0);
        $payment_method = trim($data['payment_method'] ?? 'Cash');
        $package_name = trim($data['package_name'] ?? 'Monthly');
        $amount = floatval($data['amount'] ?? 400.00);
        $notes = trim($data['notes'] ?? '');

        if ($pharmacy_id <= 0) {
            http_response_code(422);
            echo json_encode(['success' => false, 'message' => 'Valid pharmacy ID required.']);
            exit;
        }

        try {
            $pdo->beginTransaction();

            // Insert into payment_history
            $stmtPay = $pdo->prepare("
                INSERT INTO payment_history (pharmacy_id, amount, currency, payment_method, package_name, status, notes, created_at)
                VALUES (:pharmacy_id, :amount, 'BDT', :payment_method, :package_name, 'Succeeded', :notes, NOW())
            ");
            $stmtPay->execute([
                ':pharmacy_id' => $pharmacy_id,
                ':amount' => $amount,
                ':payment_method' => $payment_method,
                ':package_name' => $package_name,
                ':notes' => $notes
            ]);
            $payment_id = $pdo->lastInsertId();

            // Extend subscription expiry date
            $is_yearly = (stripos($package_name, 'yearly') !== false || $amount >= 4000);
            $extension = $is_yearly ? '+1 year' : '+1 month';
            $new_expires_at = date('Y-m-d H:i:s', strtotime($extension));

            $stmtSub = $pdo->prepare("
                UPDATE subscriptions 
                SET plan = :plan, amount = :amount, payment_provider = :provider, payment_status = 'paid', expires_at = :expires_at 
                WHERE pharmacy_id = :pharmacy_id
            ");
            $stmtSub->execute([
                ':plan' => $is_yearly ? 'yearly' : 'monthly',
                ':amount' => $amount,
                ':provider' => strtolower($payment_method),
                ':expires_at' => $new_expires_at,
                ':pharmacy_id' => $pharmacy_id
            ]);

            // Update pharmacy status to active (unlocks write permissions)
            $stmtPharm = $pdo->prepare("UPDATE pharmacies SET status = 'active' WHERE id = :id");
            $stmtPharm->execute([':id' => $pharmacy_id]);

            $pdo->commit();

            echo json_encode([
                'success' => true,
                'message' => "Payment of BDT {$amount} recorded successfully.",
                'data' => [
                    'id' => $payment_id,
                    'pharmacy_id' => $pharmacy_id,
                    'amount' => $amount,
                    'payment_method' => $payment_method,
                    'package_name' => $package_name,
                    'status' => 'Succeeded',
                    'notes' => $notes,
                    'created_at' => date('Y-m-d H:i:s'),
                    'expires_at' => $new_expires_at
                ]
            ]);
            exit;
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
            exit;
        }
    }

    // 4. DELETE PHARMACY
    if ($action === 'delete') {
        $pharmacy_id = intval($data['pharmacy_id'] ?? 0);

        if ($pharmacy_id <= 0) {
            http_response_code(422);
            echo json_encode(['success' => false, 'message' => 'Valid pharmacy ID required.']);
            exit;
        }

        try {
            $pdo->beginTransaction();
            $pdo->prepare("DELETE FROM subscriptions WHERE pharmacy_id = :id")->execute([':id' => $pharmacy_id]);
            $pdo->prepare("DELETE FROM users WHERE pharmacy_id = :id")->execute([':id' => $pharmacy_id]);
            $pdo->prepare("DELETE FROM payment_history WHERE pharmacy_id = :id")->execute([':id' => $pharmacy_id]);
            $pdo->prepare("DELETE FROM pharmacies WHERE id = :id")->execute([':id' => $pharmacy_id]);
            $pdo->commit();

            echo json_encode(['success' => true, 'message' => 'Pharmacy deleted successfully.']);
            exit;
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
            exit;
        }
    }

    // 5. DEFAULT: CREATE PHARMACY
    $pharmacy_name = trim($data['pharmacy_name'] ?? '');
    $address = trim($data['address'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $full_name = trim($data['full_name'] ?? '');
    $email = filter_var(trim($data['email'] ?? ''), FILTER_VALIDATE_EMAIL);
    $password = $data['password'] ?? '';
    $plan = strtolower(trim($data['plan'] ?? 'monthly'));
    $payment_method = trim($data['payment_method'] ?? 'cash');
    $notes = trim($data['notes'] ?? '');

    if (empty($pharmacy_name) || empty($full_name) || !$email || strlen($password) < 6) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Please fill all required fields properly.']);
        exit;
    }

    try {
        $checkUser = $pdo->prepare("SELECT id FROM users WHERE email = :email LIMIT 1");
        $checkUser->execute([':email' => $email]);
        if ($checkUser->fetch()) {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'An account with this email already exists.']);
            exit;
        }

        $slug_base = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $pharmacy_name), '-'));
        if (empty($slug_base)) $slug_base = 'pharmacy';
        $slug = $slug_base . '-' . substr(md5(uniqid(mt_rand(), true)), 0, 5);
        $tenant_uuid = 'tenant_' . bin2hex(random_bytes(12));

        $password_hash = password_hash($password, PASSWORD_BCRYPT);
        $amount = ($plan === 'yearly') ? 4500.00 : 400.00;
        $status = 'active';

        $pdo->beginTransaction();

        $stmtPharm = $pdo->prepare("
            INSERT INTO pharmacies (tenant_uuid, name, slug, address, phone, plan, status, created_at)
            VALUES (:tenant_uuid, :name, :slug, :address, :phone, :plan, :status, NOW())
        ");
        $stmtPharm->execute([
            ':tenant_uuid' => $tenant_uuid,
            ':name' => $pharmacy_name,
            ':slug' => $slug,
            ':address' => $address,
            ':phone' => $phone,
            ':plan' => $plan,
            ':status' => $status
        ]);
        $pharmacy_id = $pdo->lastInsertId();

        $stmtUser = $pdo->prepare("
            INSERT INTO users (pharmacy_id, full_name, email, password, role, status, created_at)
            VALUES (:pharmacy_id, :full_name, :email, :password, 'pharmacy_admin', 'active', NOW())
        ");
        $stmtUser->execute([
            ':pharmacy_id' => $pharmacy_id,
            ':full_name' => $full_name,
            ':email' => $email,
            ':password' => $password_hash
        ]);

        $expires_at = ($plan === 'yearly') ? date('Y-m-d H:i:s', strtotime('+1 year')) : date('Y-m-d H:i:s', strtotime('+1 month'));
        $stmtSub = $pdo->prepare("
            INSERT INTO subscriptions (pharmacy_id, plan, amount, currency, payment_provider, payment_status, starts_at, expires_at, created_at)
            VALUES (:pharmacy_id, :plan, :amount, 'BDT', :provider, 'paid', NOW(), :expires_at, NOW())
        ");
        $stmtSub->execute([
            ':pharmacy_id' => $pharmacy_id,
            ':plan' => $plan,
            ':amount' => $amount,
            ':provider' => $payment_method,
            ':expires_at' => $expires_at
        ]);

        // Insert into payment_history
        $pdo->prepare("
            INSERT INTO payment_history (pharmacy_id, amount, currency, payment_method, package_name, status, notes, created_at)
            VALUES (:pharmacy_id, :amount, 'BDT', :payment_method, :package_name, 'Succeeded', :notes, NOW())
        ")->execute([
            ':pharmacy_id' => $pharmacy_id,
            ':amount' => $amount,
            ':payment_method' => ucfirst($payment_method),
            ':package_name' => ucfirst($plan),
            ':notes' => 'Initial subscription payment'
        ]);

        $pdo->commit();

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Pharmacy registered successfully.',
            'data' => [
                'id' => $pharmacy_id,
                'name' => $pharmacy_name,
                'slug' => $slug,
                'owner_email' => $email,
                'plan' => $plan,
                'status' => 'active',
                'created_at' => date('Y-m-d H:i:s')
            ]
        ]);
        exit;
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
        exit;
    }
}
