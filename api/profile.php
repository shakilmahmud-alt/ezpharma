<?php
/**
 * EZ Pharma - User Profile API
 * Handles viewing and updating current user profile and password in MySQL
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

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$user_id = intval($_GET['user_id'] ?? 0);
$pharmacy_id = intval($_GET['pharmacy_id'] ?? 1);

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?? [];
    $action = $data['action'] ?? $action;
    $user_id = intval($data['user_id'] ?? $user_id);
    $pharmacy_id = intval($data['pharmacy_id'] ?? $pharmacy_id);
}

// 1. GET: Fetch Profile Details
if ($action === 'get' || ($method === 'GET' && empty($action))) {
    $emailParam = trim($_GET['email'] ?? '');
    
    if ($user_id > 0) {
        $stmt = $pdo->prepare("SELECT id, pharmacy_id, full_name, email, role, status, created_at FROM users WHERE id = ?");
        $stmt->execute([$user_id]);
    } else if (!empty($emailParam)) {
        $stmt = $pdo->prepare("SELECT id, pharmacy_id, full_name, email, role, status, created_at FROM users WHERE email = ?");
        $stmt->execute([$emailParam]);
    } else {
        // Default to pharmacy user of this pharmacy (EXCLUDE super_admin)
        $stmt = $pdo->prepare("SELECT id, pharmacy_id, full_name, email, role, status, created_at FROM users WHERE pharmacy_id = ? AND role != 'super_admin' ORDER BY id ASC LIMIT 1");
        $stmt->execute([$pharmacy_id]);
    }
    
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        // Try to find any user with role pharmacy_admin
        $stmt = $pdo->prepare("SELECT id, pharmacy_id, full_name, email, role, status, created_at FROM users WHERE role = 'pharmacy_admin' LIMIT 1");
        $stmt->execute();
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    if (!$user) {
        $user = [
            'id' => 2,
            'pharmacy_id' => $pharmacy_id,
            'full_name' => 'Pharmacy Admin',
            'email' => 'admin@pharmacy.com',
            'role' => 'pharmacy_admin',
            'status' => 'active'
        ];
    }
    
    echo json_encode(['success' => true, 'data' => $user, 'user' => $user]);
    exit;
}

// 2. POST: Update Profile
if ($action === 'update') {
    $name = trim($data['name'] ?? $data['full_name'] ?? '');
    $email = trim($data['email'] ?? '');
    $password = trim($data['password'] ?? '');
    $currentEmail = trim($data['current_email'] ?? '');
    
    if (empty($name)) {
        echo json_encode(['success' => false, 'error' => 'Name is required']);
        exit;
    }
    
    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'error' => 'A valid email is required']);
        exit;
    }
    
    // If user_id is 0 or not found, locate by current_email or pharmacy_id
    if ($user_id <= 0) {
        if (!empty($currentEmail)) {
            $stmtFind = $pdo->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
            $stmtFind->execute([$currentEmail]);
            $user_id = intval($stmtFind->fetchColumn() ?: 0);
        }
        if ($user_id <= 0) {
            $stmtFind = $pdo->prepare("SELECT id FROM users WHERE pharmacy_id = ? AND role != 'super_admin' ORDER BY id ASC LIMIT 1");
            $stmtFind->execute([$pharmacy_id]);
            $user_id = intval($stmtFind->fetchColumn() ?: 0);
        }
        if ($user_id <= 0) {
            $stmtFind = $pdo->prepare("SELECT id FROM users WHERE role = 'pharmacy_admin' ORDER BY id ASC LIMIT 1");
            $stmtFind->execute();
            $user_id = intval($stmtFind->fetchColumn() ?: 2);
        }
    }
    
    // Check if email already used by another user
    $stmtChk = $pdo->prepare("SELECT id FROM users WHERE email = ? AND id != ?");
    $stmtChk->execute([$email, $user_id]);
    if ($stmtChk->fetch()) {
        echo json_encode(['success' => false, 'error' => 'This email is already in use by another user account']);
        exit;
    }
    
    if (!empty($password)) {
        if (strlen($password) < 6) {
            echo json_encode(['success' => false, 'error' => 'Password must be at least 6 characters']);
            exit;
        }
        $hashed = password_hash($password, PASSWORD_BCRYPT);
        $stmtUp = $pdo->prepare("UPDATE users SET full_name = ?, email = ?, password = ?, updated_at = NOW() WHERE id = ?");
        $stmtUp->execute([$name, $email, $hashed, $user_id]);
    } else {
        $stmtUp = $pdo->prepare("UPDATE users SET full_name = ?, email = ?, updated_at = NOW() WHERE id = ?");
        $stmtUp->execute([$name, $email, $user_id]);
    }
    
    // Return updated user
    $stmtGet = $pdo->prepare("SELECT id, pharmacy_id, full_name, email, role, status FROM users WHERE id = ?");
    $stmtGet->execute([$user_id]);
    $updatedUser = $stmtGet->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'message' => 'Profile updated successfully',
        'data' => $updatedUser,
        'user' => $updatedUser
    ]);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Invalid action']);
