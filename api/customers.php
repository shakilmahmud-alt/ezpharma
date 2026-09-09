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

// Auto-create customers, customer_sales, and customer_due_payments tables
$pdo->exec("
    CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pharmacy_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(150) NULL,
        address TEXT NULL,
        credit_limit DECIMAL(12,2) DEFAULT 1000.00,
        credit_used DECIMAL(12,2) DEFAULT 0.00,
        tier VARCHAR(50) DEFAULT 'Silver',
        total_spend DECIMAL(12,2) DEFAULT 0.00,
        orders_count INT DEFAULT 0,
        last_visit DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX (pharmacy_id),
        INDEX (phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS customer_sales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pharmacy_id INT NOT NULL,
        customer_id INT NOT NULL,
        invoice_number VARCHAR(100) NOT NULL,
        subtotal DECIMAL(12,2) DEFAULT 0.00,
        discount_amount DECIMAL(12,2) DEFAULT 0.00,
        tax_amount DECIMAL(12,2) DEFAULT 0.00,
        total_amount DECIMAL(12,2) DEFAULT 0.00,
        payment_method VARCHAR(50) DEFAULT 'Cash',
        items_summary TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX (pharmacy_id),
        INDEX (customer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

// Column migrations if customers table already exists
try {
    $cols = $pdo->query("SHOW COLUMNS FROM customers LIKE 'credit_limit'")->fetchAll();
    if (empty($cols)) {
        $pdo->exec("ALTER TABLE customers ADD COLUMN credit_limit DECIMAL(12,2) DEFAULT 1000.00 AFTER address");
    }
    $colsUsed = $pdo->query("SHOW COLUMNS FROM customers LIKE 'credit_used'")->fetchAll();
    if (empty($colsUsed)) {
        $pdo->exec("ALTER TABLE customers ADD COLUMN credit_used DECIMAL(12,2) DEFAULT 0.00 AFTER credit_limit");
    }
} catch (Exception $e) {}

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

// Tier recalculation helper function based on user tier rules
function computeCustomerTier($totalSpend, $monthlySpend, $ordersCount) {
    if ($monthlySpend >= 4000 || $totalSpend >= 8000) {
        return 'Platinum'; // Family Member
    } elseif ($monthlySpend >= 1500 || $totalSpend >= 3000 || $ordersCount >= 3) {
        return 'Gold'; // Regular Patient
    }
    return 'Silver'; // Neighborhood Member
}

// 1. List Customers with search & sort
if ($action === 'list' || ($method === 'GET' && empty($action))) {
    $search = trim($_GET['search'] ?? '');
    $sort = $_GET['sort'] ?? 'created_at';
    $order = strtoupper($_GET['order'] ?? 'DESC');
    if ($order !== 'ASC') $order = 'DESC';

    $where = ["c.pharmacy_id = ?"];
    $params = [$pharmacy_id];

    if (!empty($search)) {
        $where[] = "(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.address LIKE ?)";
        $sTerm = "%$search%";
        $params[] = $sTerm;
        $params[] = $sTerm;
        $params[] = $sTerm;
        $params[] = $sTerm;
    }

    $whereClause = implode(" AND ", $where);

    $allowedSorts = [
        'created_at' => 'c.created_at',
        'name' => 'c.name',
        'phone' => 'c.phone',
        'total_spend' => 'c.total_spend',
        'orders_count' => 'c.orders_count',
        'last_visit' => 'c.last_visit'
    ];
    $sortCol = $allowedSorts[$sort] ?? 'c.created_at';

    $sql = "
        SELECT c.*,
               COALESCE((
                   SELECT SUM(total_amount) 
                   FROM customer_sales 
                   WHERE customer_id = c.id AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
               ), 0) AS monthly_spend
        FROM customers c
        WHERE $whereClause
        ORDER BY $sortCol $order
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $customers = $stmt->fetchAll();

    // Dynamically evaluate tiers
    foreach ($customers as &$cust) {
        $cust['total_spend'] = floatval($cust['total_spend'] ?? 0);
        $cust['orders_count'] = intval($cust['orders_count'] ?? 0);
        $cust['monthly_spend'] = floatval($cust['monthly_spend'] ?? 0);
        $cust['tier'] = computeCustomerTier($cust['total_spend'], $cust['monthly_spend'], $cust['orders_count']);
    }

    echo json_encode([
        'success' => true,
        'customers' => $customers,
        'total_count' => count($customers)
    ]);
    exit;
}

// 2. Get Single Customer Details
if ($action === 'get') {
    $id = intval($_GET['id'] ?? ($data['id'] ?? 0));
    $stmt = $pdo->prepare("SELECT * FROM customers WHERE id = ? AND pharmacy_id = ?");
    $stmt->execute([$id, $pharmacy_id]);
    $customer = $stmt->fetch();

    if (!$customer) {
        echo json_encode(['success' => false, 'error' => 'Customer not found']);
        exit;
    }

    $salesStmt = $pdo->prepare("SELECT * FROM customer_sales WHERE customer_id = ? AND pharmacy_id = ? ORDER BY created_at DESC");
    $salesStmt->execute([$id, $pharmacy_id]);
    $customer['sales_history'] = $salesStmt->fetchAll();

    echo json_encode(['success' => true, 'customer' => $customer]);
    exit;
}

// 3. Create Customer
if ($action === 'create' || $action === 'add') {
    $name = trim($data['name'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $email = trim($data['email'] ?? '');
    $address = trim($data['address'] ?? '');
    $credit_limit = isset($data['credit_limit']) ? max(0.00, floatval($data['credit_limit'])) : 0.00;

    if (empty($name)) {
        echo json_encode(['success' => false, 'error' => 'Customer name is required']);
        exit;
    }
    if (empty($phone)) {
        echo json_encode(['success' => false, 'error' => 'Customer phone is required']);
        exit;
    }

    // Default tier is Silver on phone registration
    $tier = 'Silver';

    $stmt = $pdo->prepare("
        INSERT INTO customers (pharmacy_id, name, phone, email, address, credit_limit, credit_used, tier, total_spend, orders_count)
        VALUES (?, ?, ?, ?, ?, ?, 0.00, ?, 0.00, 0)
    ");
    $stmt->execute([$pharmacy_id, $name, $phone, $email, $address, $credit_limit, $tier]);
    $customer_id = $pdo->lastInsertId();

    echo json_encode([
        'success' => true,
        'id' => $customer_id,
        'message' => 'Customer added successfully'
    ]);
    exit;
}

// 4. Update Customer
if ($action === 'update' || $action === 'edit') {
    $id = intval($data['id'] ?? 0);
    $name = trim($data['name'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $email = trim($data['email'] ?? '');
    $address = trim($data['address'] ?? '');
    $credit_limit = isset($data['credit_limit']) ? max(0.00, floatval($data['credit_limit'])) : 0.00;

    if (empty($id)) {
        echo json_encode(['success' => false, 'error' => 'Invalid customer ID']);
        exit;
    }

    $stmt = $pdo->prepare("
        UPDATE customers 
        SET name = ?, phone = ?, email = ?, credit_limit = ?, address = ?
        WHERE id = ? AND pharmacy_id = ?
    ");
    $stmt->execute([$name, $phone, $email, $credit_limit, $address, $id, $pharmacy_id]);

    echo json_encode(['success' => true, 'message' => 'Customer updated successfully']);
    exit;
}

// 5. Delete Customer
if ($action === 'delete') {
    $id = intval($data['id'] ?? 0);
    if (empty($id)) {
        echo json_encode(['success' => false, 'error' => 'Invalid customer ID']);
        exit;
    }

    $stmt = $pdo->prepare("DELETE FROM customers WHERE id = ? AND pharmacy_id = ?");
    $stmt->execute([$id, $pharmacy_id]);

    $pdo->prepare("DELETE FROM customer_sales WHERE customer_id = ? AND pharmacy_id = ?")->execute([$id, $pharmacy_id]);

    echo json_encode(['success' => true, 'message' => 'Customer deleted successfully']);
    exit;
}

// 6. View Sales History for Customer
if ($action === 'sales_history') {
    $customer_id = intval($_GET['customer_id'] ?? ($data['customer_id'] ?? 0));
    if (empty($customer_id)) {
        echo json_encode(['success' => false, 'error' => 'Customer ID required']);
        exit;
    }

    $cStmt = $pdo->prepare("SELECT * FROM customers WHERE id = ? AND pharmacy_id = ?");
    $cStmt->execute([$customer_id, $pharmacy_id]);
    $cust = $cStmt->fetch();

    $stmt = $pdo->prepare("
        SELECT * FROM customer_sales 
        WHERE customer_id = ? AND pharmacy_id = ?
        ORDER BY created_at DESC
    ");
    $stmt->execute([$customer_id, $pharmacy_id]);
    $history = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'customer' => $cust,
        'sales' => $history
    ]);
    exit;
}

// 7. Customer Insights Analytics (Image 3)
if ($action === 'insights') {
    // 1. Fetch all customers for this pharmacy
    $stmt = $pdo->prepare("
        SELECT c.*,
               COALESCE((
                   SELECT SUM(total_amount) 
                   FROM customer_sales 
                   WHERE customer_id = c.id AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
               ), 0) AS monthly_spend,
               COALESCE((
                   SELECT COUNT(*) 
                   FROM customer_sales 
                   WHERE customer_id = c.id AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
               ), 0) AS purchases_90d
        FROM customers c
        WHERE c.pharmacy_id = ?
        ORDER BY c.total_spend DESC
    ");
    $stmt->execute([$pharmacy_id]);
    $allCust = $stmt->fetchAll();

    $totalCustomers = count($allCust);
    $newCustomers = 0;
    $regularCustomers = 0;
    $vipCustomers = 0;
    $atRiskCustomers = 0;

    $totalSpendSum = 0;
    $totalOrdersSum = 0;

    $now = new DateTime();
    $vipThresholdIndex = max(1, intval(ceil($totalCustomers * 0.10)));

    foreach ($allCust as $idx => &$c) {
        $c['total_spend'] = floatval($c['total_spend'] ?? 0);
        $c['orders_count'] = intval($c['orders_count'] ?? 0);
        $c['monthly_spend'] = floatval($c['monthly_spend'] ?? 0);
        $c['purchases_90d'] = intval($c['purchases_90d'] ?? 0);
        $c['tier'] = computeCustomerTier($c['total_spend'], $c['monthly_spend'], $c['orders_count']);

        $totalSpendSum += $c['total_spend'];
        $totalOrdersSum += $c['orders_count'];

        // New Customer (Joined in last 30 days)
        if (!empty($c['created_at'])) {
            $created = new DateTime($c['created_at']);
            if ($now->diff($created)->days <= 30) {
                $newCustomers++;
            }
        }

        // Regular (3+ purchases in 90 days or orders_count >= 3)
        if ($c['purchases_90d'] >= 3 || $c['orders_count'] >= 3) {
            $regularCustomers++;
        }

        // VIP (Top 10% by spend)
        if ($totalCustomers > 0 && $idx < $vipThresholdIndex && $c['total_spend'] > 0) {
            $vipCustomers++;
        }

        // At Risk (No purchase in 60+ days)
        if (!empty($c['last_visit'])) {
            $last = new DateTime($c['last_visit']);
            if ($now->diff($last)->days >= 60) {
                $atRiskCustomers++;
            }
        } elseif (!empty($c['created_at'])) {
            $created = new DateTime($c['created_at']);
            if ($now->diff($created)->days >= 60 && $c['orders_count'] === 0) {
                $atRiskCustomers++;
            }
        }
    }

    $avgLifetimeValue = $totalCustomers > 0 ? ($totalSpendSum / $totalCustomers) : 0.00;
    $avgBasketSize = $totalOrdersSum > 0 ? ($totalSpendSum / $totalOrdersSum) : 0.00;
    $avgVisitFrequency = $totalCustomers > 0 ? ($totalOrdersSum / $totalCustomers / 3) : 1.0;

    echo json_encode([
        'success' => true,
        'metrics' => [
            'total_customers' => $totalCustomers,
            'new_customers' => $newCustomers,
            'regular_customers' => $regularCustomers,
            'vip_customers' => $vipCustomers,
            'at_risk_customers' => $atRiskCustomers,
            'avg_lifetime_value' => round($avgLifetimeValue, 2),
            'avg_visit_frequency' => round(max(1.0, $avgVisitFrequency), 2),
            'avg_basket_size' => round($avgBasketSize, 2)
        ],
        'top_customers' => array_slice($allCust, 0, 50)
    ]);
    exit;
}

// 8. Record a Sale / Purchase for Customer
if ($action === 'record_sale') {
    $customer_id = intval($data['customer_id'] ?? 0);
    $total_amount = floatval($data['total_amount'] ?? 0);
    $invoice_number = trim($data['invoice_number'] ?? ('INV-' . date('Ymd') . rand(1000, 9999)));
    $payment_method = trim($data['payment_method'] ?? 'Cash');
    $items_summary = trim($data['items_summary'] ?? 'Prescription Medicine');

    if (empty($customer_id)) {
        echo json_encode(['success' => false, 'error' => 'Customer ID is required']);
        exit;
    }
    if ($total_amount <= 0) {
        echo json_encode(['success' => false, 'error' => 'Sale amount must be greater than 0']);
        exit;
    }

    $stmt = $pdo->prepare("
        INSERT INTO customer_sales (pharmacy_id, customer_id, invoice_number, subtotal, total_amount, payment_method, items_summary)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$pharmacy_id, $customer_id, $invoice_number, $total_amount, $total_amount, $payment_method, $items_summary]);

    // Update customer total_spend, orders_count, last_visit
    $upStmt = $pdo->prepare("
        UPDATE customers 
        SET total_spend = total_spend + ?,
            orders_count = orders_count + 1,
            last_visit = NOW()
        WHERE id = ? AND pharmacy_id = ?
    ");
    $upStmt->execute([$total_amount, $customer_id, $pharmacy_id]);

    // Check new calculated tier
    $cStmt = $pdo->prepare("
        SELECT c.*,
               COALESCE((
                   SELECT SUM(total_amount) 
                   FROM customer_sales 
                   WHERE customer_id = c.id AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
               ), 0) AS monthly_spend
        FROM customers c
        WHERE c.id = ? AND c.pharmacy_id = ?
    ");
    $cStmt->execute([$customer_id, $pharmacy_id]);
    $updatedCust = $cStmt->fetch();

    $newTier = computeCustomerTier(
        floatval($updatedCust['total_spend']),
        floatval($updatedCust['monthly_spend']),
        intval($updatedCust['orders_count'])
    );

    $pdo->prepare("UPDATE customers SET tier = ? WHERE id = ?")->execute([$newTier, $customer_id]);

    echo json_encode([
        'success' => true,
        'message' => 'Sale recorded successfully',
        'tier' => $newTier,
        'customer' => $updatedCust
    ]);
    exit;
}

// 8. Receive Customer Due Payment (বকেয়া পরিশোধ ও ক্যাশ ড্রয়ারে জমা)
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

    // Calculate remaining due
    $newDue = max(0.00, $prevDue - $amount);
    $actualPaid = min($amount, $prevDue);

    // Update customer credit_used
    $upStmt = $pdo->prepare("UPDATE customers SET credit_used = ? WHERE id = ? AND pharmacy_id = ?");
    $upStmt->execute([$newDue, $customer_id, $pharmacy_id]);

    // Insert record in customer_due_payments
    $pStmt = $pdo->prepare("
        INSERT INTO customer_due_payments (pharmacy_id, customer_id, amount, previous_due, remaining_due, payment_method, note, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ");
    $pStmt->execute([$pharmacy_id, $customer_id, $actualPaid, $prevDue, $newDue, $payment_method, $note, $user_name]);
    $paymentId = $pdo->lastInsertId();

    // If payment method is Cash, also record cash in active drawer session if open
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

    // Fetch updated customer
    $cStmt->execute([$customer_id, $pharmacy_id]);
    $updatedCust = $cStmt->fetch();

    echo json_encode([
        'success' => true,
        'message' => sprintf('Due payment of Tk %.2f received successfully!', $actualPaid),
        'payment_id' => $paymentId,
        'paid_amount' => $actualPaid,
        'previous_due' => $prevDue,
        'remaining_due' => $newDue,
        'customer' => $updatedCust
    ]);
    exit;
}

// 9. Due Payment History for Customer
if ($action === 'due_history' || $action === 'customer_due_payments') {
    $customer_id = intval($_GET['customer_id'] ?? ($data['customer_id'] ?? 0));
    $where = ["pharmacy_id = ?"];
    $params = [$pharmacy_id];

    if ($customer_id > 0) {
        $where[] = "customer_id = ?";
        $params[] = $customer_id;
    }

    $whereSql = implode(" AND ", $where);
    $stmt = $pdo->prepare("
        SELECT p.*, c.name AS customer_name, c.phone AS customer_phone
        FROM customer_due_payments p
        LEFT JOIN customers c ON p.customer_id = c.id
        WHERE $whereSql
        ORDER BY p.id DESC
        LIMIT 100
    ");
    $stmt->execute($params);
    $history = $stmt->fetchAll() ?: [];

    echo json_encode([
        'success' => true,
        'history' => $history
    ]);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Invalid action']);

