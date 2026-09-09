<?php
// ==============================================
// EZ Pharma - POS, Sales History & Cash Drawer API
// ==============================================

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db.php';

// Auto Schema Creation & Migration
try {
    // 1. pos_sales table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS pos_sales (
            id INT AUTO_INCREMENT PRIMARY KEY,
            pharmacy_id INT NOT NULL,
            invoice_number VARCHAR(100) NOT NULL,
            customer_id INT NULL,
            customer_name VARCHAR(255) DEFAULT 'Walk-in Customer',
            customer_phone VARCHAR(50) NULL,
            subtotal DECIMAL(12,2) DEFAULT 0.00,
            discount_amount DECIMAL(12,2) DEFAULT 0.00,
            discount_percent DECIMAL(5,2) DEFAULT 0.00,
            tax_amount DECIMAL(12,2) DEFAULT 0.00,
            total_amount DECIMAL(12,2) DEFAULT 0.00,
            payment_method VARCHAR(50) DEFAULT 'Cash',
            cash_received DECIMAL(12,2) DEFAULT 0.00,
            change_due DECIMAL(12,2) DEFAULT 0.00,
            notes TEXT NULL,
            status VARCHAR(50) DEFAULT 'completed',
            created_by INT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX (pharmacy_id),
            INDEX (customer_id),
            INDEX (invoice_number),
            INDEX (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    // 2. pos_sale_items table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS pos_sale_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sale_id INT NOT NULL,
            product_id INT NOT NULL,
            product_name VARCHAR(255) NOT NULL,
            sku VARCHAR(100) NULL,
            unit_price DECIMAL(12,2) NOT NULL,
            quantity INT NOT NULL,
            discount_percent DECIMAL(5,2) DEFAULT 0.00,
            discount_amount DECIMAL(12,2) DEFAULT 0.00,
            total_price DECIMAL(12,2) NOT NULL,
            batch_number VARCHAR(100) NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX (sale_id),
            INDEX (product_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    // 3. pos_held_carts table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS pos_held_carts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            pharmacy_id INT NOT NULL,
            hold_token VARCHAR(100) NOT NULL,
            customer_id INT NULL,
            customer_name VARCHAR(255) DEFAULT 'Walk-in Customer',
            customer_phone VARCHAR(50) NULL,
            cart_items_json LONGTEXT NOT NULL,
            total_amount DECIMAL(12,2) DEFAULT 0.00,
            notes TEXT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX (pharmacy_id),
            INDEX (hold_token)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    // 4. cash_drawer table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS cash_drawer (
            id INT AUTO_INCREMENT PRIMARY KEY,
            pharmacy_id INT NOT NULL,
            user_id INT NULL,
            user_name VARCHAR(150) NULL,
            status VARCHAR(50) DEFAULT 'open',
            starting_cash DECIMAL(12,2) DEFAULT 0.00,
            cash_sales DECIMAL(12,2) DEFAULT 0.00,
            cash_in DECIMAL(12,2) DEFAULT 0.00,
            cash_out DECIMAL(12,2) DEFAULT 0.00,
            expected_cash DECIMAL(12,2) DEFAULT 0.00,
            closing_cash DECIMAL(12,2) DEFAULT 0.00,
            difference DECIMAL(12,2) DEFAULT 0.00,
            notes TEXT NULL,
            opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            closed_at DATETIME NULL,
            INDEX (pharmacy_id),
            INDEX (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    // 5. cash_drawer_transactions table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS cash_drawer_transactions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            drawer_id INT NOT NULL,
            pharmacy_id INT NOT NULL,
            type ENUM('cash_in', 'cash_out', 'sale', 'refund') NOT NULL,
            amount DECIMAL(12,2) NOT NULL,
            reason VARCHAR(255) NULL,
            reference_id VARCHAR(100) NULL,
            created_by VARCHAR(150) NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX (drawer_id),
            INDEX (pharmacy_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    // 6. Ensure customers table has credit_limit and credit_used columns
    $cols = $pdo->query("SHOW COLUMNS FROM customers LIKE 'credit_limit'")->fetchAll();
    if (empty($cols)) {
        $pdo->exec("ALTER TABLE customers ADD COLUMN credit_limit DECIMAL(12,2) DEFAULT 1000.00 AFTER address");
    }
    $colsUsed = $pdo->query("SHOW COLUMNS FROM customers LIKE 'credit_used'")->fetchAll();
    if (empty($colsUsed)) {
        $pdo->exec("ALTER TABLE customers ADD COLUMN credit_used DECIMAL(12,2) DEFAULT 0.00 AFTER credit_limit");
    }
} catch (Exception $e) {
    // Ignore migration warnings
}

$data = [];
$rawInput = file_get_contents('php://input');
if (!empty($rawInput)) {
    $data = json_decode($rawInput, true) ?? [];
}

$action = $_GET['action'] ?? ($data['action'] ?? 'list_sales');
$pharmacy_id = intval($_GET['pharmacy_id'] ?? ($data['pharmacy_id'] ?? 1));

if (empty($pharmacy_id)) {
    $pharmacy_id = 1;
}

// ----------------------------------------------------
// 1. Complete POS Sale (Cash, Card, Mobile, Credit)
// ----------------------------------------------------
if ($action === 'complete_sale') {
    $customer_id = !empty($data['customer_id']) ? intval($data['customer_id']) : null;
    $customer_name = trim($data['customer_name'] ?? 'Walk-in Customer');
    $customer_phone = trim($data['customer_phone'] ?? '');
    $items = $data['items'] ?? [];
    $subtotal = floatval($data['subtotal'] ?? 0);
    $discount_percent = floatval($data['discount_percent'] ?? 0);
    $discount_amount = floatval($data['discount_amount'] ?? 0);
    $tax_amount = floatval($data['tax_amount'] ?? 0);
    $total_amount = floatval($data['total_amount'] ?? 0);
    $payment_method = trim($data['payment_method'] ?? 'Cash');
    $cash_received = floatval($data['cash_received'] ?? $total_amount);
    $change_due = floatval($data['change_due'] ?? 0);
    $notes = trim($data['notes'] ?? '');

    if (empty($items) || $total_amount <= 0) {
        echo json_encode(['success' => false, 'error' => 'Cart is empty or total is invalid']);
        exit;
    }

    // Generate Invoice Number: INV-YYYYMMDD-XXXX
    $datePart = date('Ymd');
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM pos_sales WHERE pharmacy_id = ? AND DATE(created_at) = CURDATE()");
    $countStmt->execute([$pharmacy_id]);
    $seq = intval($countStmt->fetchColumn()) + 1;
    $invoice_number = sprintf("INV-%s%04d", $datePart, $seq);

    // Credit Sale Validation (বাকিতে ওষুধ বিক্রি)
    if ($payment_method === 'Credit') {
        if (empty($customer_id)) {
            echo json_encode(['success' => false, 'error' => 'Customer is required for Credit sale. Please select or register a customer first.']);
            exit;
        }

        $cStmt = $pdo->prepare("SELECT credit_limit, credit_used, name, phone FROM customers WHERE id = ? AND pharmacy_id = ?");
        $cStmt->execute([$customer_id, $pharmacy_id]);
        $cust = $cStmt->fetch();

        if (!$cust) {
            echo json_encode(['success' => false, 'error' => 'Customer not found']);
            exit;
        }

        $creditLimit = floatval($cust['credit_limit'] ?? 1000.00);
        $creditUsed = floatval($cust['credit_used'] ?? 0.00);
        $availableCredit = $creditLimit - $creditUsed;

        if ($total_amount > $availableCredit) {
            echo json_encode([
                'success' => false,
                'error' => sprintf("Credit limit exceeded. Available: Tk %.2f, Requested: Tk %.2f", $availableCredit, $total_amount)
            ]);
            exit;
        }

        // Deduct/Increase credit used
        $pdo->prepare("UPDATE customers SET credit_used = credit_used + ? WHERE id = ? AND pharmacy_id = ?")
            ->execute([$total_amount, $customer_id, $pharmacy_id]);
    }

    // Strict Inventory Stock Verification (Cannot sell more than available stock)
    foreach ($items as $item) {
        $pId = intval($item['product_id'] ?? ($item['id'] ?? 0));
        $reqQty = intval($item['quantity'] ?? 1);
        $pName = trim($item['name'] ?? 'Product');

        if ($pId > 0) {
            $stockCheckStmt = $pdo->prepare("SELECT COALESCE(SUM(quantity), 0) FROM inventory_batches WHERE product_id = ? AND pharmacy_id = ?");
            $stockCheckStmt->execute([$pId, $pharmacy_id]);
            $availableStock = intval($stockCheckStmt->fetchColumn());

            if ($reqQty > $availableStock) {
                echo json_encode([
                    'success' => false,
                    'error' => sprintf("Insufficient stock for '%s'. Available: %d, Requested: %d. Cannot sell more than available inventory.", $pName, $availableStock, $reqQty)
                ]);
                exit;
            }
        }
    }

    // Insert pos_sales
    $stmt = $pdo->prepare("
        INSERT INTO pos_sales (
            pharmacy_id, invoice_number, customer_id, customer_name, customer_phone,
            subtotal, discount_amount, discount_percent, tax_amount, total_amount,
            payment_method, cash_received, change_due, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
    ");
    $stmt->execute([
        $pharmacy_id, $invoice_number, $customer_id, $customer_name, $customer_phone,
        $subtotal, $discount_amount, $discount_percent, $tax_amount, $total_amount,
        $payment_method, $cash_received, $change_due, $notes
    ]);
    $sale_id = $pdo->lastInsertId();

    // Insert sale items & deduct inventory batches
    $itemStmt = $pdo->prepare("
        INSERT INTO pos_sale_items (
            sale_id, product_id, product_name, sku, unit_price, quantity,
            discount_percent, discount_amount, total_price, batch_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $itemsSummaryList = [];
    foreach ($items as $item) {
        $pId = intval($item['product_id'] ?? ($item['id'] ?? 0));
        $pName = trim($item['name'] ?? 'Product');
        $sku = trim($item['sku'] ?? '');
        $price = floatval($item['price'] ?? 0);
        $qty = intval($item['quantity'] ?? 1);
        $discPercent = floatval($item['discount_percent'] ?? 0);
        $discAmt = floatval($item['discount_amount'] ?? 0);
        $lineTotal = floatval($item['line_total'] ?? ($price * $qty - $discAmt));
        $batch = trim($item['batch_number'] ?? '');

        $itemStmt->execute([
            $sale_id, $pId, $pName, $sku, $price, $qty, $discPercent, $discAmt, $lineTotal, $batch
        ]);

        $itemsSummaryList[] = sprintf("%s x%d", $pName, $qty);

        // Deduct from inventory_batches using FIFO (earliest expiry first)
        try {
            $remainToDeduct = $qty;
            $batchRowsStmt = $pdo->prepare("SELECT id, quantity FROM inventory_batches WHERE product_id = ? AND pharmacy_id = ? AND quantity > 0 ORDER BY expiry_date ASC, id ASC");
            $batchRowsStmt->execute([$pId, $pharmacy_id]);
            $batchRows = $batchRowsStmt->fetchAll();
            foreach ($batchRows as $bRow) {
                if ($remainToDeduct <= 0) break;
                $deductNow = min($remainToDeduct, intval($bRow['quantity']));
                $pdo->prepare("UPDATE inventory_batches SET quantity = quantity - ? WHERE id = ?")->execute([$deductNow, $bRow['id']]);
                $remainToDeduct -= $deductNow;
            }
        } catch (Exception $e) {}
    }

    // Sync with customer record (total spend, orders count, last visit)
    if (!empty($customer_id)) {
        try {
            $pdo->prepare("
                UPDATE customers 
                SET total_spend = total_spend + ?,
                    orders_count = orders_count + 1,
                    last_visit = NOW()
                WHERE id = ? AND pharmacy_id = ?
            ")->execute([$total_amount, $customer_id, $pharmacy_id]);

            // Sync with customer_sales table
            $pdo->prepare("
                INSERT INTO customer_sales (
                    pharmacy_id, customer_id, invoice_number, subtotal, discount_amount, tax_amount, total_amount, payment_method, items_summary
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ")->execute([
                $pharmacy_id, $customer_id, $invoice_number, $subtotal, $discount_amount, $tax_amount, $total_amount, $payment_method, implode(', ', $itemsSummaryList)
            ]);
        } catch (Exception $e) {}
    }

    // Record cash in cash drawer if cash sale
    if ($payment_method === 'Cash') {
        try {
            $drawerStmt = $pdo->prepare("SELECT id FROM cash_drawer WHERE pharmacy_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1");
            $drawerStmt->execute([$pharmacy_id]);
            $drawerId = $drawerStmt->fetchColumn();
            if ($drawerId) {
                $pdo->prepare("UPDATE cash_drawer SET cash_sales = cash_sales + ?, expected_cash = expected_cash + ? WHERE id = ?")
                    ->execute([$total_amount, $total_amount, $drawerId]);
                $pdo->prepare("INSERT INTO cash_drawer_transactions (drawer_id, pharmacy_id, type, amount, reason, reference_id) VALUES (?, ?, 'sale', ?, 'POS Cash Sale', ?)")
                    ->execute([$drawerId, $pharmacy_id, $total_amount, $invoice_number]);
            }
        } catch (Exception $e) {}
    }

    echo json_encode([
        'success' => true,
        'message' => 'Sale completed successfully',
        'sale_id' => $sale_id,
        'invoice_number' => $invoice_number,
        'total_amount' => $total_amount,
        'change_due' => $change_due,
        'created_at' => date('Y-m-d H:i:s')
    ]);
    exit;
}

// ----------------------------------------------------
// 2. Sales History (Invoices list with search & filters)
// ----------------------------------------------------
if ($action === 'list_sales' || $action === 'sales_history') {
    $search = trim($_GET['search'] ?? '');
    $dateFrom = trim($_GET['from'] ?? '');
    $dateTo = trim($_GET['to'] ?? '');
    $paymentMethod = trim($_GET['payment_method'] ?? '');
    $page = max(1, intval($_GET['page'] ?? 1));
    $perPage = min(100, max(10, intval($_GET['per_page'] ?? 20)));
    $offset = ($page - 1) * $perPage;

    $where = ["s.pharmacy_id = ?"];
    $params = [$pharmacy_id];

    if (!empty($search)) {
        $where[] = "(s.invoice_number LIKE ? OR s.customer_name LIKE ? OR s.customer_phone LIKE ?)";
        $term = "%{$search}%";
        $params[] = $term;
        $params[] = $term;
        $params[] = $term;
    }

    if (!empty($dateFrom)) {
        $where[] = "DATE(s.created_at) >= ?";
        $params[] = $dateFrom;
    }
    if (!empty($dateTo)) {
        $where[] = "DATE(s.created_at) <= ?";
        $params[] = $dateTo;
    }
    if (!empty($paymentMethod) && $paymentMethod !== 'all') {
        $where[] = "s.payment_method = ?";
        $params[] = $paymentMethod;
    }

    $whereSql = implode(' AND ', $where);

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM pos_sales s WHERE {$whereSql}");
    $countStmt->execute($params);
    $totalRecords = intval($countStmt->fetchColumn());

    $sql = "
        SELECT s.*
        FROM pos_sales s
        WHERE {$whereSql}
        ORDER BY s.created_at DESC
        LIMIT {$perPage} OFFSET {$offset}
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $sales = $stmt->fetchAll();

    // Fetch items for each sale in this page
    if (!empty($sales)) {
        $saleIds = array_column($sales, 'id');
        $inClause = implode(',', array_fill(0, count($saleIds), '?'));
        $itemStmt = $pdo->prepare("SELECT * FROM pos_sale_items WHERE sale_id IN ({$inClause}) ORDER BY id ASC");
        $itemStmt->execute($saleIds);
        $allItems = $itemStmt->fetchAll();

        $itemsBySale = [];
        foreach ($allItems as $it) {
            $itemsBySale[$it['sale_id']][] = $it;
        }

        foreach ($sales as &$s) {
            $s['items'] = $itemsBySale[$s['id']] ?? [];
            $s['total_items_count'] = count($s['items']);
        }
        unset($s);
    }

    echo json_encode([
        'success' => true,
        'sales' => $sales,
        'total' => $totalRecords,
        'page' => $page,
        'per_page' => $perPage,
        'total_pages' => ceil($totalRecords / $perPage)
    ]);
    exit;
}

// ----------------------------------------------------
// 2.1 Process Return (Image 5 & Stock Restock)
// ----------------------------------------------------
if ($action === 'process_return') {
    $sale_id = intval($data['sale_id'] ?? 0);
    $returns = $data['returns'] ?? []; // [{ item_id, product_id, quantity, unit_price }]
    $reason = trim($data['reason'] ?? 'Customer Return');

    if (empty($sale_id) || empty($returns)) {
        echo json_encode(['success' => false, 'error' => 'Sale ID and return items required']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT * FROM pos_sales WHERE id = ? AND pharmacy_id = ?");
    $stmt->execute([$sale_id, $pharmacy_id]);
    $sale = $stmt->fetch();
    if (!$sale) {
        echo json_encode(['success' => false, 'error' => 'Sale not found']);
        exit;
    }

    $totalRefund = 0;
    foreach ($returns as $ret) {
        $pId = intval($ret['product_id'] ?? 0);
        $qty = intval($ret['quantity'] ?? 0);
        $unitPrice = floatval($ret['unit_price'] ?? 0);
        $refundAmount = $qty * $unitPrice;
        $totalRefund += $refundAmount;

        if ($qty > 0) {
            // 1. Restock to products table
            try {
                $pdo->prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ? AND pharmacy_id = ?")
                    ->execute([$qty, $pId, $pharmacy_id]);
            } catch (Exception $e) {}

            // 2. Restock to stock_batches / inventory_batches
            try {
                $pdo->prepare("UPDATE stock_batches SET quantity = quantity + ? WHERE product_id = ? AND pharmacy_id = ? ORDER BY id DESC LIMIT 1")
                    ->execute([$qty, $pId, $pharmacy_id]);
            } catch (Exception $e) {}
            try {
                $pdo->prepare("UPDATE inventory_batches SET quantity = quantity + ? WHERE product_id = ? AND pharmacy_id = ? ORDER BY id DESC LIMIT 1")
                    ->execute([$qty, $pId, $pharmacy_id]);
            } catch (Exception $e) {}
        }
    }

    // If Credit sale, reduce customer credit_used
    if ($sale['payment_method'] === 'Credit' && !empty($sale['customer_id'])) {
        try {
            $pdo->prepare("UPDATE customers SET credit_used = GREATEST(0, credit_used - ?) WHERE id = ? AND pharmacy_id = ?")
                ->execute([$totalRefund, $sale['customer_id'], $pharmacy_id]);
        } catch (Exception $e) {}
    }

    // If Cash sale and active drawer, record refund in drawer
    if ($sale['payment_method'] === 'Cash') {
        try {
            $drawerStmt = $pdo->prepare("SELECT id FROM cash_drawer WHERE pharmacy_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1");
            $drawerStmt->execute([$pharmacy_id]);
            $drawerId = $drawerStmt->fetchColumn();
            if ($drawerId) {
                $pdo->prepare("UPDATE cash_drawer SET expected_cash = GREATEST(0, expected_cash - ?) WHERE id = ?")
                    ->execute([$totalRefund, $drawerId]);
                $pdo->prepare("INSERT INTO cash_drawer_transactions (drawer_id, pharmacy_id, type, amount, reason, reference_id) VALUES (?, ?, 'refund', ?, 'POS Sale Return', ?)")
                    ->execute([$drawerId, $pharmacy_id, $totalRefund, $sale['invoice_number']]);
            }
        } catch (Exception $e) {}
    }

    echo json_encode([
        'success' => true,
        'message' => 'Return processed successfully and stock restored',
        'refund_amount' => $totalRefund
    ]);
    exit;
}

// ----------------------------------------------------
// 3. Get Sale Details & Items for Invoice View/Print
// ----------------------------------------------------
if ($action === 'get_sale' || $action === 'sale_details') {
    $sale_id = intval($_GET['id'] ?? ($data['id'] ?? 0));
    $invoice_number = trim($_GET['invoice'] ?? ($data['invoice'] ?? ''));

    if (empty($sale_id) && empty($invoice_number)) {
        echo json_encode(['success' => false, 'error' => 'Sale ID or Invoice Number required']);
        exit;
    }

    if (!empty($sale_id)) {
        $stmt = $pdo->prepare("SELECT * FROM pos_sales WHERE id = ? AND pharmacy_id = ?");
        $stmt->execute([$sale_id, $pharmacy_id]);
    } else {
        $stmt = $pdo->prepare("SELECT * FROM pos_sales WHERE invoice_number = ? AND pharmacy_id = ?");
        $stmt->execute([$invoice_number, $pharmacy_id]);
    }
    $sale = $stmt->fetch();

    if (!$sale) {
        echo json_encode(['success' => false, 'error' => 'Invoice not found']);
        exit;
    }

    $itemStmt = $pdo->prepare("SELECT * FROM pos_sale_items WHERE sale_id = ? ORDER BY id ASC");
    $itemStmt->execute([$sale['id']]);
    $items = $itemStmt->fetchAll();

    echo json_encode([
        'success' => true,
        'sale' => $sale,
        'items' => $items
    ]);
    exit;
}

// ----------------------------------------------------
// 4. Hold & Recall Transaction Engine (Image 5)
// ----------------------------------------------------
if ($action === 'hold_cart') {
    $token = uniqid('hold_', true);
    $customer_id = !empty($data['customer_id']) ? intval($data['customer_id']) : null;
    $customer_name = trim($data['customer_name'] ?? 'Walk-in Customer');
    $customer_phone = trim($data['customer_phone'] ?? '');
    $cart_json = json_encode($data['cart_items'] ?? []);
    $total_amount = floatval($data['total_amount'] ?? 0);
    $notes = trim($data['notes'] ?? '');

    $stmt = $pdo->prepare("
        INSERT INTO pos_held_carts (pharmacy_id, hold_token, customer_id, customer_name, customer_phone, cart_items_json, total_amount, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$pharmacy_id, $token, $customer_id, $customer_name, $customer_phone, $cart_json, $total_amount, $notes]);

    echo json_encode([
        'success' => true,
        'message' => 'Cart held successfully',
        'token' => $token,
        'held_id' => $pdo->lastInsertId()
    ]);
    exit;
}

if ($action === 'list_held_carts') {
    $stmt = $pdo->prepare("SELECT * FROM pos_held_carts WHERE pharmacy_id = ? ORDER BY created_at DESC");
    $stmt->execute([$pharmacy_id]);
    $held = $stmt->fetchAll();

    foreach ($held as &$h) {
        $h['cart_items'] = json_decode($h['cart_items_json'], true) ?? [];
    }

    echo json_encode([
        'success' => true,
        'held_carts' => $held,
        'count' => count($held)
    ]);
    exit;
}

if ($action === 'delete_held_cart') {
    $id = intval($data['id'] ?? 0);
    $token = trim($data['token'] ?? '');

    if (!empty($id)) {
        $pdo->prepare("DELETE FROM pos_held_carts WHERE id = ? AND pharmacy_id = ?")->execute([$id, $pharmacy_id]);
    } elseif (!empty($token)) {
        $pdo->prepare("DELETE FROM pos_held_carts WHERE hold_token = ? AND pharmacy_id = ?")->execute([$token, $pharmacy_id]);
    }

    echo json_encode(['success' => true, 'message' => 'Held cart removed']);
    exit;
}

// ----------------------------------------------------
// 5. Cash Drawer Management
// ----------------------------------------------------
if ($action === 'get_current_drawer' || $action === 'current_drawer') {
    // Ensure type column in cash_drawer_transactions allows expense
    try {
        $pdo->exec("ALTER TABLE cash_drawer_transactions MODIFY COLUMN type VARCHAR(50) NOT NULL");
    } catch (Exception $e) {}

    $chkOpen = $pdo->prepare("SELECT * FROM cash_drawer WHERE pharmacy_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1");
    $chkOpen->execute([$pharmacy_id]);
    $drawer = $chkOpen->fetch(PDO::FETCH_ASSOC);

    if (!$drawer) {
        echo json_encode([
            'success' => true,
            'is_open' => false,
            'drawer' => null,
            'transactions' => []
        ]);
        exit;
    }

    $openId = intval($drawer['id']);

    // Auto-sync any cash expenses recorded in 'expenses' table that occurred during this open drawer session
    try {
        $expCheck = $pdo->prepare("
            SELECT e.* 
            FROM expenses e
            WHERE e.pharmacy_id = ? 
              AND (LOWER(e.payment_method) = 'cash' OR e.payment_method IS NULL OR e.payment_method = '')
              AND (e.created_at >= ? OR e.expense_date >= DATE(?))
              AND NOT EXISTS (
                  SELECT 1 FROM cash_drawer_transactions cdt 
                  WHERE cdt.drawer_id = ? AND cdt.reference_id = CONCAT('EXP-', e.id)
              )
        ");
        $expCheck->execute([$pharmacy_id, $drawer['opened_at'], $drawer['opened_at'], $openId]);
        $unloggedExpenses = $expCheck->fetchAll(PDO::FETCH_ASSOC);

        if (!empty($unloggedExpenses)) {
            $addCashOut = 0;
            foreach ($unloggedExpenses as $unExp) {
                $expAmt = floatval($unExp['amount']);
                $addCashOut += $expAmt;
                $logReason = "Expense: " . $unExp['title'] . ($unExp['category'] ? " (" . $unExp['category'] . ")" : "");
                $createdAt = !empty($unExp['created_at']) ? $unExp['created_at'] : date('Y-m-d H:i:s');
                
                $pdo->prepare("
                    INSERT INTO cash_drawer_transactions (drawer_id, pharmacy_id, type, amount, reason, reference_id, created_by, created_at)
                    VALUES (?, ?, 'expense', ?, ?, ?, ?, ?)
                ")->execute([$openId, $pharmacy_id, $expAmt, $logReason, 'EXP-' . $unExp['id'], 'Admin', $createdAt]);
            }

            if ($addCashOut > 0) {
                $pdo->prepare("
                    UPDATE cash_drawer 
                    SET cash_out = cash_out + ?, expected_cash = GREATEST(0, expected_cash - ?)
                    WHERE id = ?
                ")->execute([$addCashOut, $addCashOut, $openId]);

                // Reload drawer data
                $chkOpen->execute([$pharmacy_id]);
                $drawer = $chkOpen->fetch(PDO::FETCH_ASSOC);
            }
        }
    } catch (Exception $e) {}

    // Calculate current balance: starting_cash + cash_sales + cash_in - cash_out
    $startingCash = floatval($drawer['starting_cash'] ?? 0);
    $cashSales = floatval($drawer['cash_sales'] ?? 0);
    $cashIn = floatval($drawer['cash_in'] ?? 0);
    $cashOut = floatval($drawer['cash_out'] ?? 0);
    $currentBalance = $startingCash + $cashSales + $cashIn - $cashOut;

    // Fetch transactions
    $txStmt = $pdo->prepare("SELECT * FROM cash_drawer_transactions WHERE drawer_id = ? ORDER BY id DESC");
    $txStmt->execute([$openId]);
    $transactions = $txStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    echo json_encode([
        'success' => true,
        'is_open' => true,
        'drawer' => [
            'id' => $openId,
            'pharmacy_id' => intval($drawer['pharmacy_id']),
            'status' => $drawer['status'],
            'opening_balance' => $startingCash,
            'current_balance' => $currentBalance,
            'expected_balance' => $currentBalance,
            'cash_sales' => $cashSales,
            'cash_in' => $cashIn,
            'cash_out' => $cashOut,
            'transactions_count' => count($transactions),
            'opened_at' => $drawer['opened_at'],
            'user_name' => $drawer['user_name'] ?? 'Pharmacy Admin'
        ],
        'transactions' => $transactions
    ]);
    exit;
}

if ($action === 'open_drawer') {
    $opening_balance = floatval($data['opening_balance'] ?? $data['starting_cash'] ?? 0);
    $user_name = trim($data['user_name'] ?? 'Pharmacy Admin');

    // Close any previous open drawer
    $pdo->prepare("UPDATE cash_drawer SET status = 'closed', closed_at = NOW() WHERE pharmacy_id = ? AND status = 'open'")
        ->execute([$pharmacy_id]);

    $stmt = $pdo->prepare("
        INSERT INTO cash_drawer (pharmacy_id, user_name, status, starting_cash, cash_sales, cash_in, cash_out, expected_cash, opened_at)
        VALUES (?, ?, 'open', ?, 0.00, 0.00, 0.00, ?, NOW())
    ");
    $stmt->execute([$pharmacy_id, $user_name, $opening_balance, $opening_balance]);
    $newDrawerId = $pdo->lastInsertId();

    try {
        $pdo->prepare("
            INSERT INTO cash_drawer_transactions (drawer_id, pharmacy_id, type, amount, reason, created_by, created_at)
            VALUES (?, ?, 'opening_balance', ?, 'Initial opening balance', ?, NOW())
        ")->execute([$newDrawerId, $pharmacy_id, $opening_balance, $user_name]);
    } catch (Exception $e) {}

    echo json_encode([
        'success' => true,
        'is_open' => true,
        'message' => 'Cash drawer opened successfully',
        'drawer' => [
            'id' => intval($newDrawerId),
            'pharmacy_id' => $pharmacy_id,
            'status' => 'open',
            'opening_balance' => $opening_balance,
            'current_balance' => $opening_balance,
            'expected_balance' => $opening_balance,
            'cash_sales' => 0.00,
            'cash_in' => 0.00,
            'cash_out' => 0.00,
            'transactions_count' => 0,
            'opened_at' => date('Y-m-d H:i:s'),
            'user_name' => $user_name
        ],
        'transactions' => []
    ]);
    exit;
}

if ($action === 'add_drawer_transaction' || $action === 'drawer_cash_in_out') {
    $drawer_id = intval($data['drawer_id'] ?? 0);
    $type = strtolower(trim($data['type'] ?? 'cash_in'));
    $amount = floatval($data['amount'] ?? 0);
    $note = trim($data['note'] ?? $data['reason'] ?? '');
    $user_name = trim($data['user_name'] ?? 'Pharmacy Admin');

    if ($amount <= 0) {
        echo json_encode(['success' => false, 'error' => 'Valid transaction amount is required']);
        exit;
    }

    if ($drawer_id <= 0) {
        $chkOpen = $pdo->prepare("SELECT id FROM cash_drawer WHERE pharmacy_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1");
        $chkOpen->execute([$pharmacy_id]);
        $drawer_id = intval($chkOpen->fetchColumn() ?: 0);
    }

    if ($type === 'cash_in') {
        $pdo->prepare("UPDATE cash_drawer SET cash_in = cash_in + ?, expected_cash = expected_cash + ? WHERE id = ? AND pharmacy_id = ?")
            ->execute([$amount, $amount, $drawer_id, $pharmacy_id]);
    } else {
        // cash_out or expense
        $pdo->prepare("UPDATE cash_drawer SET cash_out = cash_out + ?, expected_cash = expected_cash - ? WHERE id = ? AND pharmacy_id = ?")
            ->execute([$amount, $amount, $drawer_id, $pharmacy_id]);
    }

    $pdo->prepare("
        INSERT INTO cash_drawer_transactions (drawer_id, pharmacy_id, type, amount, reason, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    ")->execute([$drawer_id, $pharmacy_id, $type, $amount, $note, $user_name]);

    echo json_encode([
        'success' => true,
        'message' => 'Transaction recorded successfully'
    ]);
    exit;
}

if ($action === 'close_drawer') {
    $drawer_id = intval($data['drawer_id'] ?? 0);
    $actual_closing_balance = floatval($data['closing_cash'] ?? $data['actual_closing_balance'] ?? 0);
    $notes = trim($data['notes'] ?? 'Drawer closed at shift end');

    if ($drawer_id <= 0) {
        $chkOpen = $pdo->prepare("SELECT id FROM cash_drawer WHERE pharmacy_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1");
        $chkOpen->execute([$pharmacy_id]);
        $drawer_id = intval($chkOpen->fetchColumn() ?: 0);
    }

    $dStmt = $pdo->prepare("SELECT * FROM cash_drawer WHERE id = ? AND pharmacy_id = ?");
    $dStmt->execute([$drawer_id, $pharmacy_id]);
    $drawer = $dStmt->fetch(PDO::FETCH_ASSOC);

    if (!$drawer) {
        // Fallback to any open drawer for this pharmacy
        $dStmt = $pdo->prepare("SELECT * FROM cash_drawer WHERE pharmacy_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1");
        $dStmt->execute([$pharmacy_id]);
        $drawer = $dStmt->fetch(PDO::FETCH_ASSOC);
        if ($drawer) {
            $drawer_id = intval($drawer['id']);
        }
    }

    if (!$drawer) {
        echo json_encode(['success' => false, 'error' => 'Drawer session not found']);
        exit;
    }

    $startingCash = floatval($drawer['starting_cash'] ?? 0);
    $cashSales = floatval($drawer['cash_sales'] ?? 0);
    $cashIn = floatval($drawer['cash_in'] ?? 0);
    $cashOut = floatval($drawer['cash_out'] ?? 0);
    $expected = $startingCash + $cashSales + $cashIn - $cashOut;
    $diff = $actual_closing_balance - $expected;

    $stmt = $pdo->prepare("
        UPDATE cash_drawer 
        SET status = 'closed', closing_cash = ?, expected_cash = ?, difference = ?, notes = ?, closed_at = NOW()
        WHERE id = ? AND pharmacy_id = ?
    ");
    $stmt->execute([$actual_closing_balance, $expected, $diff, $notes, $drawer_id, $pharmacy_id]);

    try {
        $pdo->prepare("
            INSERT INTO cash_drawer_transactions (drawer_id, pharmacy_id, type, amount, reason, created_by, created_at)
            VALUES (?, ?, 'closing_balance', ?, ?, 'Pharmacy Admin', NOW())
        ")->execute([$drawer_id, $pharmacy_id, $actual_closing_balance, 'Shift closed. Discrepancy: ' . number_format($diff, 2)]);
    } catch (Exception $e) {}

    echo json_encode([
        'success' => true,
        'is_open' => false,
        'message' => 'Cash drawer closed successfully',
        'difference' => $diff,
        'expected' => $expected,
        'actual' => $actual_closing_balance
    ]);
    exit;
}

if ($action === 'get_drawer_history' || $action === 'drawer_history') {
    $stmt = $pdo->prepare("
        SELECT 
            id,
            pharmacy_id,
            user_name,
            starting_cash AS opening_balance,
            closing_cash AS closing_balance,
            (starting_cash + cash_sales + cash_in - cash_out) AS expected_balance,
            difference,
            cash_sales,
            cash_in,
            cash_out,
            opened_at,
            closed_at,
            status
        FROM cash_drawer
        WHERE pharmacy_id = ?
        ORDER BY id DESC
        LIMIT 100
    ");
    $stmt->execute([$pharmacy_id]);
    $rawHistory = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $entries = [];
    foreach ($rawHistory as $h) {
        // If the drawer was closed, generate BOTH a Closing Entry (top event) and an Opening Entry (base event)
        if ($h['status'] === 'closed' && !empty($h['closed_at'])) {
            // 1. Closing Entry
            $entries[] = [
                'id' => $h['id'] . '_close',
                'drawer_id' => intval($h['id']),
                'entry_type' => 'closing',
                'user_name' => $h['user_name'] ?? 'Pharmacy Admin',
                'opening_balance' => floatval($h['opening_balance']),
                'closing_balance' => floatval($h['closing_balance']),
                'expected_balance' => floatval($h['expected_balance']),
                'difference' => floatval($h['difference']),
                'opened_at' => $h['opened_at'],
                'closed_at' => $h['closed_at'],
                'status' => 'closed'
            ];

            // 2. Opening Entry
            $entries[] = [
                'id' => $h['id'] . '_open',
                'drawer_id' => intval($h['id']),
                'entry_type' => 'opening',
                'user_name' => $h['user_name'] ?? 'Pharmacy Admin',
                'opening_balance' => floatval($h['opening_balance']),
                'closing_balance' => null,
                'expected_balance' => floatval($h['opening_balance']),
                'difference' => 0.00,
                'opened_at' => $h['opened_at'],
                'closed_at' => null,
                'status' => 'opened_record'
            ];
        } else {
            // 3. Active Shift Opening Entry
            $entries[] = [
                'id' => $h['id'] . '_active',
                'drawer_id' => intval($h['id']),
                'entry_type' => 'active_opening',
                'user_name' => $h['user_name'] ?? 'Pharmacy Admin',
                'opening_balance' => floatval($h['opening_balance']),
                'closing_balance' => null,
                'expected_balance' => floatval($h['expected_balance']),
                'difference' => 0.00,
                'opened_at' => $h['opened_at'],
                'closed_at' => null,
                'status' => 'open'
            ];
        }
    }

    echo json_encode([
        'success' => true,
        'history' => $entries
    ]);
    exit;
}

// 6. Receive Customer Due Payment in POS
if ($action === 'receive_due_payment' || $action === 'pay_due') {
    $customer_id = intval($data['customer_id'] ?? 0);
    $amount = floatval($data['amount'] ?? 0);
    $payment_method = trim($data['payment_method'] ?? 'Cash');
    $note = trim($data['note'] ?? 'Customer Due Payment');
    $user_name = trim($data['user_name'] ?? 'Pharmacy Admin');

    if ($customer_id <= 0) {
        echo json_encode(['success' => false, 'error' => 'Valid customer ID is required']);
        exit;
    }
    if ($amount <= 0) {
        echo json_encode(['success' => false, 'error' => 'Payment amount must be greater than 0']);
        exit;
    }

    $cStmt = $pdo->prepare("SELECT * FROM customers WHERE id = ? AND pharmacy_id = ?");
    $cStmt->execute([$customer_id, $pharmacy_id]);
    $customer = $cStmt->fetch();

    if (!$customer) {
        echo json_encode(['success' => false, 'error' => 'Customer not found']);
        exit;
    }

    $prevDue = floatval($customer['credit_used'] ?? 0);
    if ($prevDue <= 0) {
        echo json_encode(['success' => false, 'error' => 'This customer currently has no outstanding due.']);
        exit;
    }

    $actualPaid = min($amount, $prevDue);
    $newDue = max(0.00, $prevDue - $actualPaid);

    $pdo->prepare("UPDATE customers SET credit_used = ? WHERE id = ? AND pharmacy_id = ?")
        ->execute([$newDue, $customer_id, $pharmacy_id]);

    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS customer_due_payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pharmacy_id INT NOT NULL,
                customer_id INT NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                previous_due DECIMAL(12,2) DEFAULT 0.00,
                remaining_due DECIMAL(12,2) DEFAULT 0.00,
                payment_method VARCHAR(50) DEFAULT 'Cash',
                note VARCHAR(255) NULL,
                created_by VARCHAR(150) DEFAULT 'Pharmacy Admin',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX (pharmacy_id),
                INDEX (customer_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        $pdo->prepare("
            INSERT INTO customer_due_payments (pharmacy_id, customer_id, amount, previous_due, remaining_due, payment_method, note, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ")->execute([$pharmacy_id, $customer_id, $actualPaid, $prevDue, $newDue, $payment_method, $note, $user_name]);
    } catch (Exception $e) {}

    // If Cash, update active drawer
    if (strtolower($payment_method) === 'cash') {
        try {
            $chkOpen = $pdo->prepare("SELECT id FROM cash_drawer WHERE pharmacy_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1");
            $chkOpen->execute([$pharmacy_id]);
            $drawer_id = intval($chkOpen->fetchColumn() ?: 0);

            if ($drawer_id > 0) {
                $pdo->prepare("UPDATE cash_drawer SET cash_in = cash_in + ?, expected_cash = expected_cash + ? WHERE id = ? AND pharmacy_id = ?")
                    ->execute([$actualPaid, $actualPaid, $drawer_id, $pharmacy_id]);

                $pdo->prepare("
                    INSERT INTO cash_drawer_transactions (drawer_id, pharmacy_id, type, amount, reason, created_by, created_at)
                    VALUES (?, ?, 'cash_in', ?, ?, ?, NOW())
                ")->execute([$drawer_id, $pharmacy_id, $actualPaid, 'Due payment from customer: ' . $customer['name'], $user_name]);
            }
        } catch (Exception $e) {}
    }

    $cStmt->execute([$customer_id, $pharmacy_id]);
    $updatedCust = $cStmt->fetch();

    echo json_encode([
        'success' => true,
        'message' => sprintf('Due payment of Tk %.2f received successfully!', $actualPaid),
        'paid_amount' => $actualPaid,
        'previous_due' => $prevDue,
        'remaining_due' => $newDue,
        'customer' => $updatedCust
    ]);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Invalid action']);

