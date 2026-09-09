<?php
/**
 * EZ Pharma - Product Manufacturers API
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

    if ($method === 'GET') {
        $pharmacy_id = isset($_GET['pharmacy_id']) ? intval($_GET['pharmacy_id']) : 1;
        $stmt = $pdo->prepare("
            SELECT m.*, (SELECT COUNT(*) FROM products p WHERE p.manufacturer_id = m.id OR p.manufacturer_name = m.name) as product_count
            FROM product_manufacturers m
            WHERE m.pharmacy_id = :pharmacy_id
            ORDER BY m.name ASC
        ");
        $stmt->execute(['pharmacy_id' => $pharmacy_id]);
        $manufacturers = $stmt->fetchAll();

        echo json_encode(['success' => true, 'manufacturers' => $manufacturers]);
        exit;
    }

    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true) ?: $_POST;

        $action = isset($input['action']) ? trim($input['action']) : 'create';
        $pharmacy_id = isset($input['pharmacy_id']) ? intval($input['pharmacy_id']) : 1;
        $name = trim($input['name'] ?? '');
        $contact_person = trim($input['contact_person'] ?? '');
        $email = trim($input['email'] ?? '');
        $phone = trim($input['phone'] ?? '');

        if ($action === 'create') {
            if (empty($name)) {
                echo json_encode(['success' => false, 'message' => 'Manufacturer name is required.']);
                exit;
            }
            $ins = $pdo->prepare("INSERT INTO product_manufacturers (pharmacy_id, name, contact_person, email, phone, created_at) VALUES (:pharmacy_id, :name, :contact_person, :email, :phone, NOW())");
            $ins->execute(['pharmacy_id' => $pharmacy_id, 'name' => $name, 'contact_person' => $contact_person, 'email' => $email, 'phone' => $phone]);
            echo json_encode(['success' => true, 'message' => 'Manufacturer created successfully', 'id' => $pdo->lastInsertId()]);
            exit;
        }

        if ($action === 'update') {
            $id = isset($input['id']) ? intval($input['id']) : 0;
            if ($id <= 0 || empty($name)) {
                echo json_encode(['success' => false, 'message' => 'Manufacturer ID and Name are required.']);
                exit;
            }
            $up = $pdo->prepare("UPDATE product_manufacturers SET name = :name, contact_person = :contact_person, email = :email, phone = :phone WHERE id = :id AND pharmacy_id = :pharmacy_id");
            $up->execute(['name' => $name, 'contact_person' => $contact_person, 'email' => $email, 'phone' => $phone, 'id' => $id, 'pharmacy_id' => $pharmacy_id]);
            echo json_encode(['success' => true, 'message' => 'Manufacturer updated successfully']);
            exit;
        }

        if ($action === 'delete') {
            $id = isset($input['id']) ? intval($input['id']) : 0;
            $del = $pdo->prepare("DELETE FROM product_manufacturers WHERE id = :id AND pharmacy_id = :pharmacy_id LIMIT 1");
            $del->execute(['id' => $id, 'pharmacy_id' => $pharmacy_id]);
            echo json_encode(['success' => true, 'message' => 'Manufacturer deleted successfully']);
            exit;
        }
    }
} catch (Exception $e) {
    http_response_code(200);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
