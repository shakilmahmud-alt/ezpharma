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

// Auto-create purchase_orders table
$pdo->exec("
    CREATE TABLE IF NOT EXISTS purchase_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        po_number VARCHAR(100) NOT NULL,
        pharmacy_id INT NOT NULL,
        supplier_id INT NOT NULL,
        status ENUM('Ordered', 'Received', 'Cancelled') DEFAULT 'Ordered',
        notes TEXT NULL,
        total_amount DECIMAL(12,2) DEFAULT 0.00,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX (pharmacy_id),
        INDEX (supplier_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

// Auto-create purchase_order_items table
$pdo->exec("
    CREATE TABLE IF NOT EXISTS purchase_order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        po_id INT NOT NULL,
        product_id INT NULL,
        product_name VARCHAR(255) NOT NULL,
        sku VARCHAR(100) NULL,
        qty INT NOT NULL DEFAULT 1,
        received_qty INT NOT NULL DEFAULT 0,
        unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        INDEX (po_id)
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
    $stmt = $pdo->prepare("
        SELECT po.*, s.name AS supplier_name, s.phone AS supplier_phone, s.email AS supplier_email, s.address AS supplier_address,
               (SELECT COUNT(*) FROM purchase_order_items WHERE po_id = po.id) AS total_items
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        WHERE po.pharmacy_id = ?
        ORDER BY po.id DESC
    ");
    $stmt->execute([$pharmacy_id]);
    $orders = $stmt->fetchAll();
    echo json_encode(['success' => true, 'purchase_orders' => $orders]);
    exit;
}

if ($action === 'get') {
    $id = $_GET['id'] ?? ($data['id'] ?? 0);
    $stmt = $pdo->prepare("
        SELECT po.*, s.name AS supplier_name, s.phone AS supplier_phone, s.email AS supplier_email, s.address AS supplier_address
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        WHERE po.id = ? AND po.pharmacy_id = ?
    ");
    $stmt->execute([$id, $pharmacy_id]);
    $po = $stmt->fetch();

    if (!$po) {
        echo json_encode(['success' => false, 'error' => 'Purchase order not found']);
        exit;
    }

    $itemsStmt = $pdo->prepare("SELECT * FROM purchase_order_items WHERE po_id = ? ORDER BY id ASC");
    $itemsStmt->execute([$id]);
    $po['items'] = $itemsStmt->fetchAll();

    echo json_encode(['success' => true, 'purchase_order' => $po]);
    exit;
}

if ($action === 'create') {
    $supplier_id = intval($data['supplier_id'] ?? 0);
    $notes = trim($data['notes'] ?? '');
    $items = $data['items'] ?? [];

    if (empty($supplier_id)) {
        echo json_encode(['success' => false, 'error' => 'Please select a supplier']);
        exit;
    }

    if (empty($items) || !is_array($items)) {
        echo json_encode(['success' => false, 'error' => 'At least one line item is required']);
        exit;
    }

    // Generate PO-YYYYMMDD001 sequence
    $datePrefix = 'PO-' . date('Ymd');
    $seqStmt = $pdo->prepare("SELECT COUNT(*) as total_today FROM purchase_orders WHERE pharmacy_id = ? AND po_number LIKE ?");
    $seqStmt->execute([$pharmacy_id, $datePrefix . '%']);
    $countToday = intval($seqStmt->fetch()['total_today'] ?? 0) + 1;
    $po_number = $datePrefix . str_pad($countToday, 3, '0', STR_PAD_LEFT);
    $total_amount = 0.00;

    foreach ($items as $item) {
        $qty = intval($item['qty'] ?? 1);
        $cost = floatval($item['unit_cost'] ?? 0);
        $total_amount += ($qty * $cost);
    }

    $stmt = $pdo->prepare("INSERT INTO purchase_orders (po_number, pharmacy_id, supplier_id, status, notes, total_amount) VALUES (?, ?, ?, 'Ordered', ?, ?)");
    $stmt->execute([$po_number, $pharmacy_id, $supplier_id, $notes, $total_amount]);
    $po_id = $pdo->lastInsertId();

    $itemStmt = $pdo->prepare("INSERT INTO purchase_order_items (po_id, product_id, product_name, sku, qty, received_qty, unit_cost, total_cost) VALUES (?, ?, ?, ?, ?, 0, ?, ?)");
    foreach ($items as $item) {
        $pid = !empty($item['product_id']) ? intval($item['product_id']) : null;
        $pname = trim($item['product_name'] ?? 'Item');
        $sku = trim($item['sku'] ?? '');
        $qty = max(1, intval($item['qty'] ?? 1));
        $cost = floatval($item['unit_cost'] ?? 0);
        $lineTotal = $qty * $cost;

        $itemStmt->execute([$po_id, $pid, $pname, $sku, $qty, $cost, $lineTotal]);
    }

    echo json_encode(['success' => true, 'po_id' => $po_id, 'po_number' => $po_number, 'message' => 'Purchase order created successfully']);
    exit;
}

// Auto-create inventory_batches table
$pdo->exec("
    CREATE TABLE IF NOT EXISTS inventory_batches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pharmacy_id INT NOT NULL,
        product_id INT NULL,
        po_id INT NULL,
        batch_number VARCHAR(100) NOT NULL,
        quantity INT NOT NULL DEFAULT 0,
        expiry_date DATE NULL,
        location VARCHAR(100) DEFAULT 'Main',
        reorder_level INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX (pharmacy_id),
        INDEX (product_id),
        INDEX (batch_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

if ($action === 'receive_stock') {
    $id = intval($data['id'] ?? 0);
    $items = $data['items'] ?? [];

    if (empty($id)) {
        echo json_encode(['success' => false, 'error' => 'Invalid purchase order ID']);
        exit;
    }

    $batchStmt = $pdo->prepare("
        INSERT INTO inventory_batches (pharmacy_id, product_id, po_id, batch_number, quantity, expiry_date, location, reorder_level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $itemUpdateStmt = $pdo->prepare("
        UPDATE purchase_order_items SET received_qty = received_qty + ? WHERE id = ? AND po_id = ?
    ");

    foreach ($items as $item) {
        $itemId = intval($item['item_id'] ?? 0);
        $productId = !empty($item['product_id']) ? intval($item['product_id']) : null;
        $qty = intval($item['qty'] ?? 1);
        $batch = trim($item['batch_number'] ?? 'BATCH-' . time());
        $expiry = !empty($item['expiry_date']) ? $item['expiry_date'] : null;
        $location = trim($item['location'] ?? 'Main');
        $reorder = intval($item['reorder_level'] ?? 0);

        // Insert batch
        $batchStmt->execute([$pharmacy_id, $productId, $id, $batch, $qty, $expiry, $location, $reorder]);

        // Update item received qty
        if ($itemId > 0) {
            $itemUpdateStmt->execute([$qty, $itemId, $id]);
        }
    }

    // Update PO status to Received
    $pdo->prepare("UPDATE purchase_orders SET status = 'Received' WHERE id = ? AND pharmacy_id = ?")->execute([$id, $pharmacy_id]);

    echo json_encode(['success' => true, 'message' => 'Stock successfully received and added to inventory!']);
    exit;
}

if ($action === 'update_status') {
    $id = intval($data['id'] ?? 0);
    $status = trim($data['status'] ?? 'Ordered');

    if (!in_array($status, ['Ordered', 'Received', 'Cancelled'])) {
        echo json_encode(['success' => false, 'error' => 'Invalid status']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE purchase_orders SET status = ? WHERE id = ? AND pharmacy_id = ?");
    $stmt->execute([$status, $id, $pharmacy_id]);

    if ($status === 'Received') {
        $pdo->prepare("UPDATE purchase_order_items SET received_qty = qty WHERE po_id = ?")->execute([$id]);
    }

    echo json_encode(['success' => true, 'message' => "Purchase order status updated to $status"]);
    exit;
}

if ($action === 'delete') {
    $id = intval($data['id'] ?? 0);
    $stmt = $pdo->prepare("DELETE FROM purchase_orders WHERE id = ? AND pharmacy_id = ?");
    $stmt->execute([$id, $pharmacy_id]);

    $pdo->prepare("DELETE FROM purchase_order_items WHERE po_id = ?")->execute([$id]);

    echo json_encode(['success' => true, 'message' => 'Purchase order deleted successfully']);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Invalid action']);
