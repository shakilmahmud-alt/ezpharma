<?php
/**
 * EZ Pharma - Notifications API
 * Handles real-time notifications, low-stock scanning, and alerts
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

// Auto-create notifications table
$pdo->exec("
    CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pharmacy_id INT NOT NULL,
        user_id INT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'low_stock',
        reference_id INT NULL,
        is_read TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notif_pharm (pharmacy_id),
        INDEX idx_notif_read (is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$pharmacy_id = intval($_GET['pharmacy_id'] ?? 1);

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?? [];
    $action = $data['action'] ?? $action;
    $pharmacy_id = intval($data['pharmacy_id'] ?? $pharmacy_id);
}

if ($pharmacy_id <= 0) $pharmacy_id = 1;

// 1. GET: List Notifications
if ($action === 'list' || ($method === 'GET' && empty($action))) {
    $filter = $_GET['filter'] ?? 'all';
    
    $sql = "SELECT * FROM notifications WHERE pharmacy_id = ?";
    $params = [$pharmacy_id];
    
    if ($filter === 'unread') {
        $sql .= " AND is_read = 0";
    }
    
    $sql .= " ORDER BY created_at DESC, id DESC LIMIT 100";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Count unread
    $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE pharmacy_id = ? AND is_read = 0");
    $stmtCount->execute([$pharmacy_id]);
    $unreadCount = intval($stmtCount->fetchColumn() ?: 0);
    
    // Total count
    $stmtTotal = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE pharmacy_id = ?");
    $stmtTotal->execute([$pharmacy_id]);
    $totalCount = intval($stmtTotal->fetchColumn() ?: 0);
    
    echo json_encode([
        'success' => true,
        'data' => $notifications,
        'notifications' => $notifications,
        'unread_count' => $unreadCount,
        'total_count' => $totalCount
    ]);
    exit;
}

// 2. POST: Scan for Low Stock & Expiring Batches
if ($action === 'scan') {
    $createdCount = 0;
    
    // Scan inventory batches with low stock (quantity <= 2 or product alert)
    try {
        $stmtScan = $pdo->prepare("
            SELECT b.id as batch_id, b.batch_number, b.quantity, b.expiry_date,
                   p.id as product_id, p.name as product_name, p.min_stock_alert
            FROM inventory_batches b
            INNER JOIN products p ON b.product_id = p.id
            WHERE b.pharmacy_id = ?
            ORDER BY b.quantity ASC
        ");
        $stmtScan->execute([$pharmacy_id]);
        $batches = $stmtScan->fetchAll(PDO::FETCH_ASSOC);
        
        $insertStmt = $pdo->prepare("
            INSERT INTO notifications (pharmacy_id, title, message, type, reference_id, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, 0, NOW())
        ");
        
        // Check if recent notification already exists in last 24 hours for this batch
        $checkStmt = $pdo->prepare("
            SELECT COUNT(*) FROM notifications 
            WHERE pharmacy_id = ? AND reference_id = ? AND type = ? AND created_at >= (NOW() - INTERVAL 1 DAY)
        ");
        
        foreach ($batches as $b) {
            $qty = intval($b['quantity']);
            $reorderLevel = intval($b['min_stock_alert'] ?? 0);
            
            // Check if low stock
            if ($qty <= max(2, $reorderLevel)) {
                $checkStmt->execute([$pharmacy_id, $b['batch_id'], 'low_stock']);
                if ($checkStmt->fetchColumn() == 0) {
                    $title = "Low Stock: " . $b['product_name'];
                    $batchStr = !empty($b['batch_number']) ? $b['batch_number'] : 'Default';
                    $message = "{$b['product_name']} (Batch: {$batchStr}) has only {$qty} units left. Reorder level is {$reorderLevel}.";
                    $insertStmt->execute([$pharmacy_id, $title, $message, 'low_stock', $b['batch_id']]);
                    $createdCount++;
                }
            }
        }
    } catch (Exception $e) {}
    
    // Also scan products with 0 or low overall stock
    try {
        $stmtProdScan = $pdo->prepare("
            SELECT p.id, p.name, p.min_stock_alert,
                   COALESCE((SELECT SUM(quantity) FROM inventory_batches WHERE product_id = p.id AND pharmacy_id = p.pharmacy_id), 0) as total_stock
            FROM products p
            WHERE p.pharmacy_id = ?
        ");
        $stmtProdScan->execute([$pharmacy_id]);
        $prods = $stmtProdScan->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($prods as $p) {
            $stock = intval($p['total_stock']);
            $reorder = intval($p['min_stock_alert'] ?? 0);
            if ($stock <= max(1, $reorder)) {
                $checkStmt->execute([$pharmacy_id, $p['id'], 'product_low_stock']);
                if ($checkStmt->fetchColumn() == 0) {
                    $title = "Low Stock: " . $p['name'];
                    $message = "{$p['name']} has only {$stock} units left in total stock. Reorder level is {$reorder}.";
                    $insertStmt->execute([$pharmacy_id, $title, $message, 'product_low_stock', $p['id']]);
                    $createdCount++;
                }
            }
        }
    } catch (Exception $e) {}
    
    // Fetch refreshed list
    $stmtRef = $pdo->prepare("SELECT * FROM notifications WHERE pharmacy_id = ? ORDER BY created_at DESC, id DESC LIMIT 100");
    $stmtRef->execute([$pharmacy_id]);
    $notifications = $stmtRef->fetchAll(PDO::FETCH_ASSOC);
    
    $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE pharmacy_id = ? AND is_read = 0");
    $stmtCount->execute([$pharmacy_id]);
    $unreadCount = intval($stmtCount->fetchColumn() ?: 0);
    
    echo json_encode([
        'success' => true,
        'message' => "Scan completed. {$createdCount} new alerts detected.",
        'new_alerts' => $createdCount,
        'notifications' => $notifications,
        'unread_count' => $unreadCount
    ]);
    exit;
}

// 3. POST: Mark Single Notification as Read
if ($action === 'mark_read') {
    $id = intval($data['id'] ?? $_GET['id'] ?? 0);
    if ($id > 0) {
        $stmt = $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND pharmacy_id = ?");
        $stmt->execute([$id, $pharmacy_id]);
    }
    
    $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE pharmacy_id = ? AND is_read = 0");
    $stmtCount->execute([$pharmacy_id]);
    $unreadCount = intval($stmtCount->fetchColumn() ?: 0);
    
    echo json_encode([
        'success' => true,
        'message' => 'Notification marked as read',
        'unread_count' => $unreadCount
    ]);
    exit;
}

// 4. POST: Mark All Notifications as Read
if ($action === 'mark_all_read') {
    $stmt = $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE pharmacy_id = ?");
    $stmt->execute([$pharmacy_id]);
    
    echo json_encode([
        'success' => true,
        'message' => 'All notifications marked as read',
        'unread_count' => 0
    ]);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Invalid action']);
