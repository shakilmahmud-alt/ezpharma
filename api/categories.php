<?php
/**
 * EZ Pharma - Product Categories API
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
            SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id OR p.category_name = c.name) as product_count
            FROM product_categories c
            WHERE c.pharmacy_id = :pharmacy_id
            ORDER BY c.name ASC
        ");
        $stmt->execute(['pharmacy_id' => $pharmacy_id]);
        $categories = $stmt->fetchAll();

        echo json_encode(['success' => true, 'categories' => $categories]);
        exit;
    }

    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true) ?: $_POST;

        $action = isset($input['action']) ? trim($input['action']) : 'create';
        $pharmacy_id = isset($input['pharmacy_id']) ? intval($input['pharmacy_id']) : 1;
        $name = trim($input['name'] ?? '');
        $description = trim($input['description'] ?? '');

        if ($action === 'create') {
            if (empty($name)) {
                echo json_encode(['success' => false, 'message' => 'Category name is required.']);
                exit;
            }
            $ins = $pdo->prepare("INSERT INTO product_categories (pharmacy_id, name, description, created_at) VALUES (:pharmacy_id, :name, :description, NOW())");
            $ins->execute(['pharmacy_id' => $pharmacy_id, 'name' => $name, 'description' => $description]);
            echo json_encode(['success' => true, 'message' => 'Category created successfully', 'id' => $pdo->lastInsertId()]);
            exit;
        }

        if ($action === 'update') {
            $id = isset($input['id']) ? intval($input['id']) : 0;
            if ($id <= 0 || empty($name)) {
                echo json_encode(['success' => false, 'message' => 'Category ID and Name are required.']);
                exit;
            }
            $up = $pdo->prepare("UPDATE product_categories SET name = :name, description = :description WHERE id = :id AND pharmacy_id = :pharmacy_id");
            $up->execute(['name' => $name, 'description' => $description, 'id' => $id, 'pharmacy_id' => $pharmacy_id]);
            echo json_encode(['success' => true, 'message' => 'Category updated successfully']);
            exit;
        }

        if ($action === 'delete') {
            $id = isset($input['id']) ? intval($input['id']) : 0;
            $del = $pdo->prepare("DELETE FROM product_categories WHERE id = :id AND pharmacy_id = :pharmacy_id LIMIT 1");
            $del->execute(['id' => $id, 'pharmacy_id' => $pharmacy_id]);
            echo json_encode(['success' => true, 'message' => 'Category deleted successfully']);
            exit;
        }
    }
} catch (Exception $e) {
    http_response_code(200);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
