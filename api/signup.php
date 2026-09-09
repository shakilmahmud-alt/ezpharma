<?php
/**
 * EZ Pharma - Tenant Registration & Query API Endpoint
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

// ----------------------------------------------------
// GET: Fetch all pharmacies
// ----------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
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
                u.full_name AS owner_name,
                u.email AS owner_email,
                s.amount,
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
        echo json_encode(['success' => false, 'message' => 'Database query failed: ' . $e->getMessage()]);
        exit;
    }
}

// ----------------------------------------------------
// POST: Pharmacy Sign Up
// ----------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$raw_input = file_get_contents('php://input');
$data = json_decode($raw_input, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON input.']);
    exit;
}

$full_name = trim($data['full_name'] ?? '');
$email = filter_var(trim($data['email'] ?? ''), FILTER_VALIDATE_EMAIL);
$password = $data['password'] ?? '';
$pharmacy_name = trim($data['pharmacy_name'] ?? '');
$phone = trim($data['phone'] ?? '');
$address = trim($data['address'] ?? '');
$plan = strtolower(trim($data['plan'] ?? 'monthly'));

if (empty($full_name)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Admin full name is required.']);
    exit;
}
if (!$email) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'A valid email address is required.']);
    exit;
}
if (strlen($password) < 6) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Password must be at least 6 characters long.']);
    exit;
}
if (empty($pharmacy_name)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Pharmacy name is required.']);
    exit;
}

try {
    $checkUser = $pdo->prepare("SELECT id FROM users WHERE email = :email LIMIT 1");
    $checkUser->execute([':email' => $email]);
    if ($checkUser->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'An account with this email already exists. Please sign in.']);
        exit;
    }

    $slug_base = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $pharmacy_name), '-'));
    if (empty($slug_base)) $slug_base = 'pharmacy';
    $slug = $slug_base . '-' . substr(md5(uniqid(mt_rand(), true)), 0, 5);
    $tenant_uuid = 'tenant_' . bin2hex(random_bytes(12));

    $password_hash = password_hash($password, PASSWORD_BCRYPT);
    $amount = ($plan === 'yearly') ? 4500.00 : 400.00;
    
    // User registrations start as pending_payment until payment is recorded
    $status = 'pending_payment';

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
    $user_id = $pdo->lastInsertId();

    $expires_at = ($plan === 'yearly') ? date('Y-m-d H:i:s', strtotime('+1 year')) : date('Y-m-d H:i:s', strtotime('+1 month'));
    $stmtSub = $pdo->prepare("
        INSERT INTO subscriptions (pharmacy_id, plan, amount, currency, payment_provider, payment_status, starts_at, expires_at, created_at)
        VALUES (:pharmacy_id, :plan, :amount, 'BDT', 'cash', 'pending', NOW(), :expires_at, NOW())
    ");
    $stmtSub->execute([
        ':pharmacy_id' => $pharmacy_id,
        ':plan' => $plan,
        ':amount' => $amount,
        ':expires_at' => $expires_at
    ]);

    $pdo->commit();

    http_response_code(201);
    echo json_encode([
        'success' => true,
        'message' => 'Pharmacy registered successfully!',
        'data' => [
            'id' => $pharmacy_id,
            'pharmacy_id' => $pharmacy_id,
            'user_id' => $user_id,
            'tenant_uuid' => $tenant_uuid,
            'pharmacy_name' => $pharmacy_name,
            'full_name' => $full_name,
            'owner_email' => $email,
            'slug' => $slug,
            'plan' => $plan,
            'amount' => $amount,
            'status' => $status,
            'payment_status' => 'pending_payment'
        ]
    ]);
    exit;

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    exit;
}
