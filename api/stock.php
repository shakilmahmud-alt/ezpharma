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
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX (pharmacy_id),
        INDEX (product_id),
        INDEX (batch_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$pharmacy_id = intval($_GET['pharmacy_id'] ?? 1);

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if ($data) {
        $action = $data['action'] ?? $action;
        $pharmacy_id = intval($data['pharmacy_id'] ?? $pharmacy_id);
    }
}

// 1. List inventory batches with joined product info & counts
if ($action === 'list' || ($method === 'GET' && empty($action))) {
    $search = trim($_GET['search'] ?? '');
    $low_stock = isset($_GET['low_stock']) && $_GET['low_stock'] === '1';
    $expiring_soon = isset($_GET['expiring_soon']) && $_GET['expiring_soon'] === '1';
    $out_of_stock = isset($_GET['out_of_stock']) && $_GET['out_of_stock'] === '1';
    $sort = $_GET['sort'] ?? 'created_at';
    $order = strtoupper($_GET['order'] ?? 'DESC');
    if ($order !== 'ASC') $order = 'DESC';

    $where = ["ib.pharmacy_id = ?"];
    $params = [$pharmacy_id];

    if (!empty($search)) {
        $where[] = "(p.name LIKE ? OR p.sku LIKE ? OR ib.batch_number LIKE ? OR ib.location LIKE ?)";
        $sTerm = "%$search%";
        $params[] = $sTerm;
        $params[] = $sTerm;
        $params[] = $sTerm;
        $params[] = $sTerm;
    }

    if ($low_stock) {
        $where[] = "ib.quantity <= ib.reorder_level";
    }

    if ($out_of_stock) {
        $where[] = "ib.quantity = 0";
    }

    if ($expiring_soon) {
        // Expiring within 90 days or already expired
        $where[] = "(ib.expiry_date IS NOT NULL AND ib.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY))";
    }

    $whereClause = implode(" AND ", $where);

    $allowedSorts = [
        'created_at' => 'ib.created_at',
        'product_name' => 'p.name',
        'quantity' => 'ib.quantity',
        'expiry_date' => 'ib.expiry_date',
        'batch_number' => 'ib.batch_number'
    ];
    $sortCol = $allowedSorts[$sort] ?? 'ib.created_at';

    $sql = "
        SELECT ib.*,
               COALESCE(p.name, 'Unknown Product') AS product_name,
               p.sku AS product_sku,
               p.generic_name,
               p.manufacturer_name,
               p.selling_price,
               p.cost_price,
               COALESCE((SELECT SUM(ib2.quantity) FROM inventory_batches ib2 WHERE ib2.product_id = ib.product_id AND ib2.pharmacy_id = ib.pharmacy_id), ib.quantity) AS total_product_stock
        FROM inventory_batches ib
        LEFT JOIN products p ON ib.product_id = p.id
        WHERE $whereClause
        ORDER BY $sortCol $order
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $batches = $stmt->fetchAll();

    // Summary counts for Alerts & Filter badges (Tracks individual batch inventory)
    $totalBatchesStmt = $pdo->prepare("SELECT COUNT(*) FROM inventory_batches WHERE pharmacy_id = ?");
    $totalBatchesStmt->execute([$pharmacy_id]);
    $totalBatchesCount = intval($totalBatchesStmt->fetchColumn() ?: 0);

    // Low Stock: Batches whose quantity is <= reorder_level and > 0
    $lowStockStmt = $pdo->prepare("
        SELECT COUNT(*) 
        FROM inventory_batches 
        WHERE pharmacy_id = ? AND quantity <= reorder_level AND quantity > 0
    ");
    $lowStockStmt->execute([$pharmacy_id]);
    $lowStockCount = intval($lowStockStmt->fetchColumn() ?: 0);

    // Out of Stock: Batches whose quantity is 0
    $outOfStockStmt = $pdo->prepare("
        SELECT COUNT(*) 
        FROM inventory_batches 
        WHERE pharmacy_id = ? AND quantity = 0
    ");
    $outOfStockStmt->execute([$pharmacy_id]);
    $outOfStockCount = intval($outOfStockStmt->fetchColumn() ?: 0);

    // Expiry counts
    $expStmt = $pdo->prepare("
        SELECT 
            COUNT(CASE WHEN expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY) AND expiry_date > CURDATE() AND quantity > 0 THEN 1 END) AS expiring_soon_count,
            COUNT(CASE WHEN expiry_date IS NOT NULL AND expiry_date <= CURDATE() AND quantity > 0 THEN 1 END) AS expired_count
        FROM inventory_batches
        WHERE pharmacy_id = ?
    ");
    $expStmt->execute([$pharmacy_id]);
    $expRow = $expStmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'batches' => $batches,
        'counts' => [
            'total' => $totalBatchesCount,
            'low_stock' => $lowStockCount,
            'out_of_stock' => $outOfStockCount,
            'expiring_soon' => intval($expRow['expiring_soon_count'] ?? 0),
            'expired' => intval($expRow['expired_count'] ?? 0)
        ]
    ]);
    exit;
}

// 2. Add new inventory batch (auto-merges if same product & batch number exists)
if ($action === 'add' || $action === 'create') {
    $product_id = intval($data['product_id'] ?? 0);
    $batch_number = trim($data['batch_number'] ?? '');
    $quantity = intval($data['quantity'] ?? 0);
    $location = trim($data['location'] ?? 'Main');
    $reorder_level = intval($data['reorder_level'] ?? 0);
    $expiry_date = !empty($data['expiry_date']) ? $data['expiry_date'] : null;

    if (empty($product_id)) {
        echo json_encode(['success' => false, 'error' => 'Please select a product']);
        exit;
    }

    if (empty($batch_number)) {
        echo json_encode(['success' => false, 'error' => 'Batch number is required']);
        exit;
    }

    // Check if existing batch with same batch_number exists for this product
    $existStmt = $pdo->prepare("SELECT id, quantity FROM inventory_batches WHERE pharmacy_id = ? AND product_id = ? AND batch_number = ?");
    $existStmt->execute([$pharmacy_id, $product_id, $batch_number]);
    $existingBatch = $existStmt->fetch();

    if ($existingBatch) {
        $batch_id = $existingBatch['id'];
        $updStmt = $pdo->prepare("
            UPDATE inventory_batches 
            SET quantity = quantity + ?, 
                location = ?, 
                reorder_level = ?, 
                expiry_date = COALESCE(?, expiry_date)
            WHERE id = ?
        ");
        $updStmt->execute([$quantity, $location, $reorder_level, $expiry_date, $batch_id]);
        echo json_encode(['success' => true, 'id' => $batch_id, 'message' => 'Existing batch quantity updated successfully']);
        exit;
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO inventory_batches (pharmacy_id, product_id, batch_number, quantity, location, reorder_level, expiry_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$pharmacy_id, $product_id, $batch_number, $quantity, $location, $reorder_level, $expiry_date]);
        $batch_id = $pdo->lastInsertId();

        echo json_encode(['success' => true, 'id' => $batch_id, 'message' => 'Inventory batch added successfully']);
        exit;
    }
}

// 2.2 Bulk Import Inventory Batches from CSV / Excel (Matching Sample Format)
if ($action === 'bulk_import') {
    $batches = $data['batches'] ?? [];
    if (empty($batches) || !is_array($batches)) {
        echo json_encode(['success' => false, 'error' => 'No inventory batches provided for import']);
        exit;
    }

    $inserted = 0;
    $errors = [];

    // Pre-fetch all products for this pharmacy mapped by SKU for fast matching
    $prodStmt = $pdo->prepare("SELECT id, sku, name FROM products WHERE pharmacy_id = ?");
    $prodStmt->execute([$pharmacy_id]);
    $skuMap = [];
    foreach ($prodStmt->fetchAll() as $p) {
        $sku = strtoupper(trim($p['sku']));
        if (!empty($sku)) {
            $skuMap[$sku] = intval($p['id']);
        }
    }

    $insertStmt = $pdo->prepare("
        INSERT INTO inventory_batches (pharmacy_id, product_id, batch_number, quantity, expiry_date, location, reorder_level)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");

    $createProdStmt = $pdo->prepare("
        INSERT INTO products (pharmacy_id, name, sku, generic_name, selling_price, cost_price)
        VALUES (?, ?, ?, ?, ?, ?)
    ");

    foreach ($batches as $idx => $b) {
        $sku = strtoupper(trim($b['product_sku'] ?? $b['sku'] ?? ''));
        $batchNum = trim($b['batch'] ?? $b['batch_number'] ?? ('BATCH-' . ($idx + 1) . '-' . time()));
        $qty = intval($b['quantity'] ?? $b['qty'] ?? 0);
        $rawExpiry = trim($b['expiryDate'] ?? $b['expiry_date'] ?? $b['expiry'] ?? '');
        $location = trim($b['location'] ?? 'Main');
        $reorder = intval($b['reorderLevel'] ?? $b['reorder_level'] ?? 10);

        if (empty($sku)) {
            continue;
        }

        // Format expiry date to YYYY-MM-DD
        $expiryDate = null;
        if (!empty($rawExpiry)) {
            $ts = strtotime($rawExpiry);
            if ($ts !== false) {
                $expiryDate = date('Y-m-d', $ts);
            }
        }

        // Resolve product_id by SKU
        $productId = $skuMap[$sku] ?? null;
        if (!$productId) {
            $prodName = trim($b['product_name'] ?? $sku);
            $createProdStmt->execute([$pharmacy_id, $prodName, $sku, $prodName, 0, 0]);
            $productId = intval($pdo->lastInsertId());
            $skuMap[$sku] = $productId;
        }

        try {
            $insertStmt->execute([$pharmacy_id, $productId, $batchNum, $qty, $expiryDate, $location, $reorder]);
            $inserted++;
        } catch (Exception $e) {
            $errors[] = "Row " . ($idx + 1) . " error: " . $e->getMessage();
        }
    }

    echo json_encode([
        'success' => true,
        'inserted_count' => $inserted,
        'errors' => $errors,
        'message' => "Successfully imported $inserted inventory batches into stock."
    ]);
    exit;
}

// 2.5 Receive stock from Purchase Order
if ($action === 'receive_stock') {
    $po_id = intval($data['id'] ?? 0);
    $items = $data['items'] ?? [];

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
        $batchStmt->execute([$pharmacy_id, $productId, $po_id, $batch, $qty, $expiry, $location, $reorder]);

        // Update item received qty if table exists
        if ($itemId > 0 && $po_id > 0) {
            try {
                $itemUpdateStmt->execute([$qty, $itemId, $po_id]);
            } catch (Exception $e) {}
        }
    }

    if ($po_id > 0) {
        try {
            $pdo->prepare("UPDATE purchase_orders SET status = 'Received' WHERE id = ? AND pharmacy_id = ?")->execute([$po_id, $pharmacy_id]);
        } catch (Exception $e) {}
    }

    echo json_encode(['success' => true, 'message' => 'Stock successfully received and added to inventory!']);
    exit;
}

// 3. Delete inventory batch
if ($action === 'delete') {
    $id = intval($data['id'] ?? 0);
    if (empty($id)) {
        echo json_encode(['success' => false, 'error' => 'Invalid inventory ID']);
        exit;
    }

    $stmt = $pdo->prepare("DELETE FROM inventory_batches WHERE id = ? AND pharmacy_id = ?");
    $stmt->execute([$id, $pharmacy_id]);

    echo json_encode(['success' => true, 'message' => 'Inventory batch deleted successfully']);
    exit;
}

// 3.5 Clear demo stock data (Burnsil, Oculip, Azmasol, etc.)
if ($action === 'clear_demo_stock' || $action === 'clean_demo_data') {
    try {
        $stmt = $pdo->prepare("
            DELETE ib FROM inventory_batches ib
            LEFT JOIN products p ON ib.product_id = p.id
            WHERE ib.pharmacy_id = ? AND (
                p.name LIKE 'Burnsil%' OR p.name LIKE 'Oculip%' OR p.name LIKE 'Azmasol%' OR
                ib.batch_number IN ('BATCH789', 'BATCH123', 'BATCH456')
            )
        ");
        $stmt->execute([$pharmacy_id]);
        $deleted = $stmt->rowCount();

        // Also clean up products table if those dummy products exist
        $pdo->prepare("
            DELETE FROM products 
            WHERE pharmacy_id = ? AND (
                name LIKE 'Burnsil%' OR name LIKE 'Oculip%' OR name LIKE 'Azmasol%' OR
                sku IN ('BRN-CRM-01', 'OCU-DRP-01', 'AZM-INH-01')
            )
        ")->execute([$pharmacy_id]);

        echo json_encode([
            'success' => true,
            'message' => "Successfully removed $deleted demo stock records.",
            'deleted_count' => $deleted
        ]);
        exit;
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        exit;
    }
}

echo json_encode(['success' => false, 'error' => 'Invalid action']);
