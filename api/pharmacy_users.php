<?php
/**
 * EZ Pharma - Pharmacy User Management API
 * Handles per-pharmacy users with roles (pharmacy_admin, staff, cashier) and custom permissions in MySQL
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Database Connection
$db_host = 'localhost';
$db_name = 'holidaym_ezpharma';
$db_user = 'holidaym_admin';
$db_pass = 'msm039raqeeb';

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    // Ensure permissions column exists in users table
    try {
        $pdo->exec("ALTER TABLE `users` ADD COLUMN `permissions` TEXT NULL AFTER `role`");
    } catch (Exception $e) {
        // Column already exists
    }

    $method = $_SERVER['REQUEST_METHOD'];

    // 1. GET: Fetch all users for a specific pharmacy
    if ($method === 'GET') {
        $pharmacy_id = isset($_GET['pharmacy_id']) ? intval($_GET['pharmacy_id']) : 1;

        $stmt = $pdo->prepare("
            SELECT id, pharmacy_id, full_name, email, role, permissions, status, created_at, updated_at
            FROM users
            WHERE pharmacy_id = :pharmacy_id
            ORDER BY id ASC
        ");
        $stmt->execute(['pharmacy_id' => $pharmacy_id]);
        $users = $stmt->fetchAll();

        // If no users found for this pharmacy, ensure primary pharmacy admin exists
        if (empty($users)) {
            $pStmt = $pdo->prepare("SELECT name FROM pharmacies WHERE id = :id LIMIT 1");
            $pStmt->execute(['id' => $pharmacy_id]);
            $pharm = $pStmt->fetch();
            $pharmName = $pharm ? $pharm['name'] : 'Demo Pharmacy';

            $defaultHash = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'; // 123456
            $ins = $pdo->prepare("
                INSERT INTO users (pharmacy_id, full_name, email, password, role, status, created_at)
                VALUES (:pharmacy_id, 'Pharmacy Admin', 'admin@pharmacy.com', :pwd, 'pharmacy_admin', 'active', NOW())
            ");
            $ins->execute([
                'pharmacy_id' => $pharmacy_id,
                'pwd' => $defaultHash
            ]);

            $stmt->execute(['pharmacy_id' => $pharmacy_id]);
            $users = $stmt->fetchAll();
        }

        echo json_encode([
            'success' => true,
            'users' => $users
        ]);
        exit;
    }

    // 2. POST: Create, Update, or Delete user
    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true) ?: $_POST;

        $action = isset($input['action']) ? trim($input['action']) : 'create';
        $pharmacy_id = isset($input['pharmacy_id']) ? intval($input['pharmacy_id']) : 1;

        if ($action === 'create') {
            $full_name = trim($input['full_name'] ?? $input['name'] ?? '');
            $email = trim($input['email'] ?? '');
            $password = trim($input['password'] ?? '');
            $role = trim($input['role'] ?? 'staff');
            $permissions = isset($input['permissions']) ? (is_array($input['permissions']) ? json_encode($input['permissions']) : $input['permissions']) : '[]';

            if (empty($full_name) || empty($email) || empty($password)) {
                echo json_encode(['success' => false, 'message' => 'Please fill in Name, Email and Password.']);
                exit;
            }

            // Check email uniqueness
            $chk = $pdo->prepare("SELECT id FROM users WHERE email = :email LIMIT 1");
            $chk->execute(['email' => $email]);
            if ($chk->fetch()) {
                echo json_encode(['success' => false, 'message' => 'A user with this email address already exists.']);
                exit;
            }

            $pwdHash = password_hash($password, PASSWORD_BCRYPT);

            $ins = $pdo->prepare("
                INSERT INTO users (pharmacy_id, full_name, email, password, role, permissions, status, created_at)
                VALUES (:pharmacy_id, :full_name, :email, :password, :role, :permissions, 'active', NOW())
            ");
            $ins->execute([
                'pharmacy_id' => $pharmacy_id,
                'full_name' => $full_name,
                'email' => $email,
                'password' => $pwdHash,
                'role' => $role,
                'permissions' => $permissions
            ]);

            $newId = $pdo->lastInsertId();

            echo json_encode([
                'success' => true,
                'message' => 'User created successfully',
                'user' => [
                    'id' => $newId,
                    'pharmacy_id' => $pharmacy_id,
                    'full_name' => $full_name,
                    'email' => $email,
                    'role' => $role,
                    'permissions' => $permissions,
                    'created_at' => date('Y-m-d H:i:s')
                ]
            ]);
            exit;
        }

        if ($action === 'update') {
            $user_id = isset($input['id']) ? intval($input['id']) : 0;
            $full_name = trim($input['full_name'] ?? $input['name'] ?? '');
            $email = trim($input['email'] ?? '');
            $password = trim($input['password'] ?? '');
            $role = trim($input['role'] ?? 'staff');
            $permissions = isset($input['permissions']) ? (is_array($input['permissions']) ? json_encode($input['permissions']) : $input['permissions']) : '[]';

            if ($user_id <= 0) {
                echo json_encode(['success' => false, 'message' => 'Invalid user ID.']);
                exit;
            }

            // Check email uniqueness among other users
            $chk = $pdo->prepare("SELECT id FROM users WHERE email = :email AND id != :id LIMIT 1");
            $chk->execute(['email' => $email, 'id' => $user_id]);
            if ($chk->fetch()) {
                echo json_encode(['success' => false, 'message' => 'Another user with this email address already exists.']);
                exit;
            }

            if (!empty($password)) {
                $pwdHash = password_hash($password, PASSWORD_BCRYPT);
                $up = $pdo->prepare("
                    UPDATE users 
                    SET full_name = :full_name, email = :email, password = :password, role = :role, permissions = :permissions, updated_at = NOW()
                    WHERE id = :id AND pharmacy_id = :pharmacy_id
                ");
                $up->execute([
                    'full_name' => $full_name,
                    'email' => $email,
                    'password' => $pwdHash,
                    'role' => $role,
                    'permissions' => $permissions,
                    'id' => $user_id,
                    'pharmacy_id' => $pharmacy_id
                ]);
            } else {
                $up = $pdo->prepare("
                    UPDATE users 
                    SET full_name = :full_name, email = :email, role = :role, permissions = :permissions, updated_at = NOW()
                    WHERE id = :id AND pharmacy_id = :pharmacy_id
                ");
                $up->execute([
                    'full_name' => $full_name,
                    'email' => $email,
                    'role' => $role,
                    'permissions' => $permissions,
                    'id' => $user_id,
                    'pharmacy_id' => $pharmacy_id
                ]);
            }

            echo json_encode([
                'success' => true,
                'message' => 'User updated successfully'
            ]);
            exit;
        }

        if ($action === 'delete') {
            $user_id = isset($input['id']) ? intval($input['id']) : 0;

            if ($user_id <= 0) {
                echo json_encode(['success' => false, 'message' => 'Invalid user ID.']);
                exit;
            }

            // Check if user is primary admin
            $chk = $pdo->prepare("SELECT role FROM users WHERE id = :id AND pharmacy_id = :pharmacy_id LIMIT 1");
            $chk->execute(['id' => $user_id, 'pharmacy_id' => $pharmacy_id]);
            $u = $chk->fetch();

            if ($u && $u['role'] === 'super_admin') {
                echo json_encode(['success' => false, 'message' => 'Super admin cannot be deleted.']);
                exit;
            }

            $del = $pdo->prepare("DELETE FROM users WHERE id = :id AND pharmacy_id = :pharmacy_id LIMIT 1");
            $del->execute(['id' => $user_id, 'pharmacy_id' => $pharmacy_id]);

            echo json_encode([
                'success' => true,
                'message' => 'User deleted successfully'
            ]);
            exit;
        }

        echo json_encode(['success' => false, 'message' => 'Unknown action.']);
        exit;
    }

} catch (Exception $e) {
    http_response_code(200);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
