<?php
// ==============================================
// EZ Pharma - Reports, Insights & Analytics API
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

$method = $_SERVER['REQUEST_METHOD'];
$data = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $_GET['action'] ?? $data['action'] ?? 'summary';
$pharmacy_id = intval($_GET['pharmacy_id'] ?? $data['pharmacy_id'] ?? 1);

if ($pharmacy_id <= 0) {
    $pharmacy_id = 1;
}

$startDate = trim($_GET['start_date'] ?? date('Y-m-d', strtotime('-30 days')));
$endDate = trim($_GET['end_date'] ?? date('Y-m-d'));

// Date formats
$startDateTime = $startDate . ' 00:00:00';
$endDateTime = $endDate . ' 23:59:59';

// Auto-create expenses table if missing
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS expenses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            pharmacy_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            category VARCHAR(100) DEFAULT 'General',
            amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            expense_date DATE NOT NULL,
            payment_method VARCHAR(50) DEFAULT 'Cash',
            reference_number VARCHAR(100) NULL,
            notes TEXT NULL,
            created_by INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_pharm_date (pharmacy_id, expense_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
} catch (Exception $e) {}

// ----------------------------------------------
// Action: Export Full Raw CSV
// ----------------------------------------------
if ($action === 'export_full_csv' || $action === 'export_csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=EZPharma_SalesReport_' . $startDate . '_to_' . $endDate . '.csv');

    $output = fopen('php://output', 'w');
    fputcsv($output, ['Invoice Number', 'Date', 'Customer', 'Phone', 'Payment Method', 'Subtotal (BDT)', 'Discount (BDT)', 'Tax (BDT)', 'Total (BDT)', 'Items Count', 'Status']);

    try {
        $stmt = $pdo->prepare("
            SELECT s.*, 
                   (SELECT COUNT(*) FROM pos_sale_items psi WHERE psi.sale_id = s.id) AS items_count
            FROM pos_sales s
            WHERE s.pharmacy_id = ? 
              AND s.created_at BETWEEN ? AND ?
              AND (s.status IS NULL OR s.status = '' OR s.status = 'completed' OR s.status = 'paid')
              AND s.status != 'cancelled'
            ORDER BY s.created_at DESC
        ");
        $stmt->execute([$pharmacy_id, $startDateTime, $endDateTime]);
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            fputcsv($output, [
                $row['invoice_number'],
                $row['created_at'],
                $row['customer_name'] ?: 'Walk-in Customer',
                $row['customer_phone'] ?: '—',
                $row['payment_method'] ?: 'Cash',
                number_format($row['subtotal'], 2, '.', ''),
                number_format($row['discount_amount'], 2, '.', ''),
                number_format($row['tax_amount'], 2, '.', ''),
                number_format($row['total_amount'], 2, '.', ''),
                $row['items_count'],
                $row['status'] ?: 'completed'
            ]);
        }
    } catch (Exception $e) {}

    fclose($output);
    exit;
}

// ----------------------------------------------
// Action: Main Reports & Insights Summary
// ----------------------------------------------

try {
    // 1. Sales KPI Metrics
    $stmtKpi = $pdo->prepare("
        SELECT 
            COUNT(*) AS transactions,
            COALESCE(SUM(total_amount), 0) AS revenue,
            COALESCE(SUM(subtotal), 0) AS subtotal,
            COALESCE(SUM(tax_amount), 0) AS tax,
            COALESCE(SUM(discount_amount), 0) AS discount,
            COALESCE(AVG(total_amount), 0) AS avg_order
        FROM pos_sales
        WHERE pharmacy_id = ? 
          AND created_at BETWEEN ? AND ?
          AND (status IS NULL OR status = '' OR status = 'completed' OR status = 'paid')
          AND status != 'cancelled'
    ");
    $stmtKpi->execute([$pharmacy_id, $startDateTime, $endDateTime]);
    $kpi = $stmtKpi->fetch(PDO::FETCH_ASSOC) ?: [];

    $transactions = intval($kpi['transactions'] ?? 0);
    $revenue = floatval($kpi['revenue'] ?? 0);
    $subtotal = floatval($kpi['subtotal'] ?? 0);
    $tax = floatval($kpi['tax'] ?? 0);
    $discount = floatval($kpi['discount'] ?? 0);
    $avgOrder = floatval($kpi['avg_order'] ?? 0);

    // 2. Sub-KPI Breakdown (Customer Record vs Walk-in)
    $stmtSubKpis = $pdo->prepare("
        SELECT 
            SUM(CASE WHEN customer_id IS NOT NULL AND customer_id > 0 THEN 1 ELSE 0 END) AS with_customer,
            SUM(CASE WHEN customer_id IS NULL OR customer_id = 0 THEN 1 ELSE 0 END) AS walk_in
        FROM pos_sales
        WHERE pharmacy_id = ? 
          AND created_at BETWEEN ? AND ?
          AND (status IS NULL OR status = '' OR status = 'completed' OR status = 'paid')
          AND status != 'cancelled'
    ");
    $stmtSubKpis->execute([$pharmacy_id, $startDateTime, $endDateTime]);
    $subKpiRow = $stmtSubKpis->fetch(PDO::FETCH_ASSOC);

    // Prescription Sales Count (Sales containing at least one Rx product)
    $rxSalesCount = 0;
    try {
        $stmtRx = $pdo->prepare("
            SELECT COUNT(DISTINCT s.id)
            FROM pos_sales s
            INNER JOIN pos_sale_items psi ON psi.sale_id = s.id
            INNER JOIN products p ON psi.product_id = p.id
            WHERE s.pharmacy_id = ?
              AND s.created_at BETWEEN ? AND ?
              AND (s.status IS NULL OR s.status = '' OR s.status = 'completed' OR s.status = 'paid')
              AND s.status != 'cancelled'
              AND p.requires_rx = 1
        ");
        $stmtRx->execute([$pharmacy_id, $startDateTime, $endDateTime]);
        $rxSalesCount = intval($stmtRx->fetchColumn() ?: 0);
    } catch (Exception $e) {}

    // 3. Expenses in Range
    $totalExpenses = 0.00;
    $expensesCount = 0;
    try {
        $stmtExp = $pdo->prepare("
            SELECT 
                COUNT(*) AS entries,
                COALESCE(SUM(amount), 0) AS total_expenses
            FROM expenses
            WHERE pharmacy_id = ? 
              AND expense_date BETWEEN ? AND ?
        ");
        $stmtExp->execute([$pharmacy_id, $startDate, $endDate]);
        $expRow = $stmtExp->fetch(PDO::FETCH_ASSOC);
        $totalExpenses = floatval($expRow['total_expenses'] ?? 0);
        $expensesCount = intval($expRow['entries'] ?? 0);
    } catch (Exception $e) {}

    $netProfit = $revenue - $totalExpenses;

    // 4. Daily Revenue & Transactions Trend (Dual-Axis Chart Data)
    $stmtDaily = $pdo->prepare("
        SELECT 
            DATE(created_at) AS sale_date,
            COALESCE(SUM(total_amount), 0) AS daily_revenue,
            COUNT(*) AS daily_transactions
        FROM pos_sales
        WHERE pharmacy_id = ? 
          AND created_at BETWEEN ? AND ?
          AND (status IS NULL OR status = '' OR status = 'completed' OR status = 'paid')
          AND status != 'cancelled'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) ASC
    ");
    $stmtDaily->execute([$pharmacy_id, $startDateTime, $endDateTime]);
    $dailyResults = $stmtDaily->fetchAll(PDO::FETCH_ASSOC);

    $dailyMap = [];
    foreach ($dailyResults as $dr) {
        $dailyMap[$dr['sale_date']] = [
            'revenue' => floatval($dr['daily_revenue']),
            'transactions' => intval($dr['daily_transactions'])
        ];
    }

    // Fill all dates in range
    $dailyTrend = [];
    $curr = new DateTime($startDate);
    $endDt = new DateTime($endDate);
    while ($curr <= $endDt) {
        $dStr = $curr->format('Y-m-d');
        $label = $curr->format('m-d');
        $dailyTrend[] = [
            'date' => $dStr,
            'label' => $label,
            'revenue' => $dailyMap[$dStr]['revenue'] ?? 0,
            'transactions' => $dailyMap[$dStr]['transactions'] ?? 0
        ];
        $curr->modify('+1 day');
    }

    // 5. Payment Mix (Donut Chart & Detailed Table)
    $stmtPay = $pdo->prepare("
        SELECT 
            COALESCE(payment_method, 'Cash') AS method,
            COUNT(*) AS transactions,
            COALESCE(SUM(total_amount), 0) AS revenue,
            COALESCE(AVG(total_amount), 0) AS avg_ticket
        FROM pos_sales
        WHERE pharmacy_id = ? 
          AND created_at BETWEEN ? AND ?
          AND (status IS NULL OR status = '' OR status = 'completed' OR status = 'paid')
          AND status != 'cancelled'
        GROUP BY COALESCE(payment_method, 'Cash')
        ORDER BY revenue DESC
    ");
    $stmtPay->execute([$pharmacy_id, $startDateTime, $endDateTime]);
    $paymentMethodsDetail = $stmtPay->fetchAll(PDO::FETCH_ASSOC);

    $paymentMix = [];
    foreach ($paymentMethodsDetail as $pm) {
        $paymentMix[] = [
            'method' => $pm['method'],
            'transactions' => intval($pm['transactions']),
            'revenue' => floatval($pm['revenue']),
            'avg_ticket' => floatval($pm['avg_ticket'])
        ];
    }

    // 6. Revenue by Category (Horizontal Bar Chart)
    $categoryRevenue = [];
    try {
        $stmtCat = $pdo->prepare("
            SELECT 
                COALESCE(p.category_name, 'General') AS category,
                COALESCE(SUM(psi.total_price), 0) AS revenue,
                SUM(psi.quantity) AS total_qty
            FROM pos_sale_items psi
            INNER JOIN pos_sales s ON psi.sale_id = s.id
            LEFT JOIN products p ON psi.product_id = p.id
            WHERE s.pharmacy_id = ? 
              AND s.created_at BETWEEN ? AND ?
              AND (s.status IS NULL OR s.status = '' OR s.status = 'completed' OR s.status = 'paid')
              AND s.status != 'cancelled'
            GROUP BY COALESCE(p.category_name, 'General')
            ORDER BY revenue DESC
            LIMIT 10
        ");
        $stmtCat->execute([$pharmacy_id, $startDateTime, $endDateTime]);
        $categoryRevenue = $stmtCat->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {}

    // 7. Top Selling Products
    $topProducts = [];
    try {
        $stmtTop = $pdo->prepare("
            SELECT 
                COALESCE(psi.product_name, p.name, 'Product') AS name,
                psi.sku,
                SUM(psi.quantity) AS quantity,
                COALESCE(SUM(psi.total_price), 0) AS revenue
            FROM pos_sale_items psi
            INNER JOIN pos_sales s ON psi.sale_id = s.id
            LEFT JOIN products p ON psi.product_id = p.id
            WHERE s.pharmacy_id = ? 
              AND s.created_at BETWEEN ? AND ?
              AND (s.status IS NULL OR s.status = '' OR s.status = 'completed' OR s.status = 'paid')
              AND s.status != 'cancelled'
            GROUP BY psi.product_id, psi.product_name, psi.sku
            ORDER BY revenue DESC
            LIMIT 10
        ");
        $stmtTop->execute([$pharmacy_id, $startDateTime, $endDateTime]);
        $topProducts = $stmtTop->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {}

    // 8. Inventory Snapshot (Current Real-Time State)
    $totalSkus = 0;
    $retailStockVal = 0.00;
    try {
        $stmtSkus = $pdo->prepare("SELECT COUNT(*) FROM products WHERE pharmacy_id = ?");
        $stmtSkus->execute([$pharmacy_id]);
        $totalSkus = intval($stmtSkus->fetchColumn() ?: 0);
    } catch (Exception $e) {}

    try {
        $stmtVal = $pdo->prepare("
            SELECT COALESCE(SUM(ib.quantity * p.selling_price), 0)
            FROM inventory_batches ib
            INNER JOIN products p ON ib.product_id = p.id
            WHERE ib.pharmacy_id = ? AND ib.quantity > 0
        ");
        $stmtVal->execute([$pharmacy_id]);
        $retailStockVal = floatval($stmtVal->fetchColumn() ?: 0);
    } catch (Exception $e) {}

    $lowStockBatches = 0;
    try {
        $stmtLowB = $pdo->prepare("
            SELECT COUNT(*) 
            FROM inventory_batches 
            WHERE pharmacy_id = ? 
              AND quantity > 0 
              AND quantity <= COALESCE(reorder_level, 10)
        ");
        $stmtLowB->execute([$pharmacy_id]);
        $lowStockBatches = intval($stmtLowB->fetchColumn() ?: 0);
    } catch (Exception $e) {}

    $expiringBatches = 0;
    try {
        $stmtExpB = $pdo->prepare("
            SELECT COUNT(*) 
            FROM inventory_batches 
            WHERE pharmacy_id = ? 
              AND expiry_date IS NOT NULL 
              AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY) 
              AND expiry_date >= CURDATE() 
              AND quantity > 0
        ");
        $stmtExpB->execute([$pharmacy_id]);
        $expiringBatches = intval($stmtExpB->fetchColumn() ?: 0);
    } catch (Exception $e) {}

    echo json_encode([
        'success' => true,
        'date_range' => [
            'start_date' => $startDate,
            'end_date' => $endDate
        ],
        'kpis' => [
            'transactions' => $transactions,
            'revenue' => $revenue,
            'avg_order' => $avgOrder,
            'tax' => $tax,
            'discount' => $discount,
            'subtotal' => $subtotal,
            'expenses' => $totalExpenses,
            'expense_entries' => $expensesCount,
            'net_profit' => $netProfit
        ],
        'sub_kpis' => [
            'prescription_sales' => $rxSalesCount,
            'with_customer' => intval($subKpiRow['with_customer'] ?? 0),
            'walk_in' => intval($subKpiRow['walk_in'] ?? 0),
            'subtotal_pre_tax' => $subtotal
        ],
        'daily_trend' => $dailyTrend,
        'payment_mix' => $paymentMix,
        'category_revenue' => $categoryRevenue,
        'top_products' => $topProducts,
        'inventory_snapshot' => [
            'total_skus' => $totalSkus,
            'retail_stock_value' => $retailStockVal,
            'stock_value_retail' => $retailStockVal,
            'low_stock_count' => $lowStockBatches,
            'expiring_count' => $expiringBatches
        ],
        'payment_methods_detail' => $paymentMethodsDetail
    ]);
    exit;

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Database error: ' . $e->getMessage()
    ]);
    exit;
}
?>
