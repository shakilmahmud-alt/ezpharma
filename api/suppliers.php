<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
require_once __DIR__ . '/db.php';

// Auto-create suppliers table
$pdo->exec("
    CREATE TABLE IF NOT EXISTS suppliers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pharmacy_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NULL,
        email VARCHAR(150) NULL,
        address TEXT NULL,
        notes TEXT NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX (pharmacy_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$pharmacy_id = $_GET['pharmacy_id'] ?? 1;

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if ($data) {
        $action = $data['action'] ?? $action;
        $pharmacy_id = $data['pharmacy_id'] ?? $pharmacy_id;
    }
}

if ($action === 'list' || ($method === 'GET' && empty($action))) {
    $stmt = $pdo->prepare("SELECT * FROM suppliers WHERE pharmacy_id = ? AND status != 'deleted' ORDER BY id DESC");
    $stmt->execute([$pharmacy_id]);
    $suppliers = $stmt->fetchAll();
    echo json_encode(['success' => true, 'suppliers' => $suppliers]);
    exit;
}

if ($action === 'create') {
    $name = trim($data['name'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $email = trim($data['email'] ?? '');
    $address = trim($data['address'] ?? '');
    $notes = trim($data['notes'] ?? '');

    if (empty($name)) {
        echo json_encode(['success' => false, 'error' => 'Supplier name is required']);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO suppliers (pharmacy_id, name, phone, email, address, notes, status) VALUES (?, ?, ?, ?, ?, ?, 'active')");
    $stmt->execute([$pharmacy_id, $name, $phone, $email, $address, $notes]);
    $newId = $pdo->lastInsertId();

    echo json_encode(['success' => true, 'id' => $newId, 'message' => 'Supplier created successfully']);
    exit;
}

if ($action === 'update') {
    $id = $data['id'] ?? 0;
    $name = trim($data['name'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $email = trim($data['email'] ?? '');
    $address = trim($data['address'] ?? '');
    $notes = trim($data['notes'] ?? '');

    if (empty($id) || empty($name)) {
        echo json_encode(['success' => false, 'error' => 'Supplier ID and Name are required']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE suppliers SET name = ?, phone = ?, email = ?, address = ?, notes = ? WHERE id = ? AND pharmacy_id = ?");
    $stmt->execute([$name, $phone, $email, $address, $notes, $id, $pharmacy_id]);

    echo json_encode(['success' => true, 'message' => 'Supplier updated successfully']);
    exit;
}

if ($action === 'delete') {
    $id = $data['id'] ?? 0;
    if (empty($id)) {
        echo json_encode(['success' => false, 'error' => 'Supplier ID is required']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE suppliers SET status = 'deleted' WHERE id = ? AND pharmacy_id = ?");
    $stmt->execute([$id, $pharmacy_id]);

    echo json_encode(['success' => true, 'message' => 'Supplier deleted successfully']);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Invalid action']);
