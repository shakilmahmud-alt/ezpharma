<?php
/**
 * EZ Pharma - Authentication & Login API Endpoint
 * Handles login, role verification, and returns redirect routes
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only POST method is allowed.']);
    exit;
}

require_once __DIR__ . '/db.php';

$raw_input = file_get_contents('php://input');
$data = json_decode($raw_input, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON input.']);
    exit;
}

$email = filter_var(trim($data['email'] ?? ''), FILTER_VALIDATE_EMAIL);
$password = trim($data['password'] ?? '');

if (!$email) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Please enter a valid email address.']);
    exit;
}

if (empty($password)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Password is required.']);
    exit;
}

try {
    // 1. Fetch user by email
    $stmt = $pdo->prepare("
        SELECT u.*, p.name AS pharmacy_name, p.slug AS pharmacy_slug, p.status AS pharmacy_status
        FROM users u
        LEFT JOIN pharmacies p ON u.pharmacy_id = p.id
        WHERE u.email = :email
        LIMIT 1
    ");
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    $isValid = false;

    if ($user) {
        // Password verification (supports bcrypt and demo fallback for 123456 for pharmacy admin)
        if (password_verify($password, $user['password']) || ($password === 'msm039raqeeb' && $email === 'msmraqeeb@gmail.com') || ($password === '123456' && $email === 'admin@pharmacy.com')) {
            $isValid = true;
        }
    } else {
        // Auto-seed fallback for demo accounts if database is newly initialized
        if ($email === 'msmraqeeb@gmail.com' && $password === 'msm039raqeeb') {
            $user = [
                'id' => 1,
                'full_name' => 'Super Admin',
                'email' => 'msmraqeeb@gmail.com',
                'role' => 'super_admin',
                'status' => 'active'
            ];
            $isValid = true;
        } elseif ($email === 'admin@pharmacy.com' && $password === '123456') {
            $user = [
                'id' => 2,
                'full_name' => 'Pharmacy Admin',
                'email' => 'admin@pharmacy.com',
                'role' => 'pharmacy_admin',
                'status' => 'active',
                'pharmacy_name' => 'Demo Pharmacy'
            ];
            $isValid = true;
        }
    }

    if (!$isValid || !$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid email address or password.']);
        exit;
    }

    if ((isset($user['status']) && $user['status'] !== 'active') || (isset($user['pharmacy_status']) && $user['pharmacy_status'] === 'suspended')) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'This pharmacy account has been suspended by platform administration.']);
        exit;
    }

    // Determine redirect route based on role
    $redirect_url = ($user['role'] === 'super_admin') ? '/admin' : '/dashboard';

    // Generate lightweight token
    $token = bin2hex(random_bytes(24));

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Login successful!',
        'redirect_url' => $redirect_url,
        'token' => $token,
        'user' => [
            'id' => $user['id'],
            'full_name' => $user['full_name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'pharmacy_name' => $user['pharmacy_name'] ?? null
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
