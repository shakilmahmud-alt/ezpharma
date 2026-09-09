<?php
// ==============================================
// EZ Pharma - Dashboard Overview Analytics API
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

$pharmacyId = isset($_GET['pharmacy_id']) ? intval($_GET['pharmacy_id']) : 1;
if ($pharmacyId <= 0) $pharmacyId = 1;

try {
    // 1. Today's Key Metrics
    $stmtToday = $pdo->prepare("
        SELECT 
            COALESCE(SUM(total_amount), 0) AS today_sales,
            COUNT(id) AS today_transactions,
            COALESCE(SUM(tax_amount), 0) AS today_tax
        FROM pos_sales 
        WHERE pharmacy_id = ? 
          AND (status IS NULL OR status = '' OR status = 'completed' OR status = 'paid')
          AND status != 'cancelled'
          AND DATE(created_at) = CURDATE()
    ");
    $stmtToday->execute([$pharmacyId]);
    $todayRow = $stmtToday->fetch(PDO::FETCH_ASSOC) ?: ['today_sales' => 0, 'today_transactions' => 0, 'today_tax' => 0];

    // Today's Units Sold & Unique Customers
    $stmtUnits = $pdo->prepare("
        SELECT 
            COALESCE(SUM(psi.quantity), 0) AS today_units,
            COUNT(DISTINCT COALESCE(ps.customer_id, ps.customer_name)) AS today_customers
        FROM pos_sales ps
        LEFT JOIN pos_sale_items psi ON ps.id = psi.sale_id
        WHERE ps.pharmacy_id = ? 
          AND (ps.status IS NULL OR ps.status = '' OR ps.status = 'completed' OR ps.status = 'paid')
          AND ps.status != 'cancelled'
          AND DATE(ps.created_at) = CURDATE()
    ");
    $stmtUnits->execute([$pharmacyId]);
    $unitsRow = $stmtUnits->fetch(PDO::FETCH_ASSOC) ?: ['today_units' => 0, 'today_customers' => 0];

    // 2. Yesterday's Sales
    $stmtYest = $pdo->prepare("
        SELECT COALESCE(SUM(total_amount), 0) AS yesterday_sales
        FROM pos_sales 
        WHERE pharmacy_id = ? 
          AND (status IS NULL OR status = '' OR status = 'completed' OR status = 'paid')
          AND status != 'cancelled'
          AND DATE(created_at) = SUBDATE(CURDATE(), 1)
    ");
    $stmtYest->execute([$pharmacyId]);
    $yesterdaySales = floatval($stmtYest->fetchColumn() ?: 0);

    // 3. Month to Date Metrics (Tax, Sales, Credit Sales)
    $stmtMonth = $pdo->prepare("
        SELECT 
            COALESCE(SUM(total_amount), 0) AS month_sales,
            COALESCE(SUM(tax_amount), 0) AS month_tax,
            COALESCE(SUM(CASE WHEN payment_method = 'Credit' THEN total_amount ELSE 0 END), 0) AS month_credit_sales,
            COUNT(id) AS month_transactions
        FROM pos_sales 
        WHERE pharmacy_id = ? 
          AND (status IS NULL OR status = '' OR status = 'completed' OR status = 'paid')
          AND status != 'cancelled'
          AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())
    ");
    $stmtMonth->execute([$pharmacyId]);
    $monthRow = $stmtMonth->fetch(PDO::FETCH_ASSOC) ?: ['month_sales' => 0, 'month_tax' => 0, 'month_credit_sales' => 0, 'month_transactions' => 0];

    // Current Month Expenses
    $monthExpenses = 0.00;
    try {
        $stmtExpMonth = $pdo->prepare("
            SELECT COALESCE(SUM(amount), 0) 
            FROM expenses 
            WHERE pharmacy_id = ? 
              AND expense_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') 
              AND expense_date <= LAST_DAY(CURDATE())
        ");
        $stmtExpMonth->execute([$pharmacyId]);
        $monthExpenses = floatval($stmtExpMonth->fetchColumn() ?: 0);
    } catch (Exception $e) {}

    // Last Month Sales (for % comparison)
    $stmtLastMonth = $pdo->prepare("
        SELECT COALESCE(SUM(total_amount), 0) AS last_month_sales
        FROM pos_sales 
        WHERE pharmacy_id = ? 
          AND (status IS NULL OR status = '' OR status = 'completed' OR status = 'paid')
          AND status != 'cancelled'
          AND created_at >= DATE_SUB(DATE_FORMAT(CURDATE() ,'%Y-%m-01'), INTERVAL 1 MONTH)
          AND created_at < DATE_FORMAT(CURDATE() ,'%Y-%m-01')
    ");
    $stmtLastMonth->execute([$pharmacyId]);
    $lastMonthSales = floatval($stmtLastMonth->fetchColumn() ?: 0);

    // Today's Credit Sales
    $stmtCreditToday = $pdo->prepare("
        SELECT 
            COALESCE(SUM(total_amount), 0) AS credit_sales_today,
            COUNT(id) AS credit_transactions_today
        FROM pos_sales 
        WHERE pharmacy_id = ? 
          AND (status IS NULL OR status = '' OR status = 'completed' OR status = 'paid')
          AND status != 'cancelled'
          AND payment_method = 'Credit' AND DATE(created_at) = CURDATE()
    ");
    $stmtCreditToday->execute([$pharmacyId]);
    $creditTodayRow = $stmtCreditToday->fetch(PDO::FETCH_ASSOC) ?: ['credit_sales_today' => 0, 'credit_transactions_today' => 0];

    // 4. Year to Date (YTD) & Last 7 Days
    $stmtYtd = $pdo->prepare("
        SELECT COALESCE(SUM(total_amount), 0) AS ytd_sales
        FROM pos_sales 
        WHERE pharmacy_id = ? 
          AND (status IS NULL OR status = '' OR status = 'completed' OR status = 'paid')
          AND status != 'cancelled'
          AND YEAR(created_at) = YEAR(CURDATE())
    ");
    $stmtYtd->execute([$pharmacyId]);
    $ytdSales = floatval($stmtYtd->fetchColumn() ?: 0);

    $stmt7Days = $pdo->prepare("
        SELECT COALESCE(SUM(total_amount), 0) AS last_7_days_sales
        FROM pos_sales 
        WHERE pharmacy_id = ? 
          AND (status IS NULL OR status = '' OR status = 'completed' OR status = 'paid')
          AND status != 'cancelled'
          AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    ");
    $stmt7Days->execute([$pharmacyId]);
    $last7DaysSales = floatval($stmt7Days->fetchColumn() ?: 0);

    // 5. Customer Statistics
    $totalCustomers = 0;
    $newCustomersMonth = 0;
    $arBalanceCount = 0;
    $arBalanceTotal = 0;
    try {
        $stmtCust = $pdo->prepare("SELECT COUNT(*) FROM customers WHERE pharmacy_id = ?");
        $stmtCust->execute([$pharmacyId]);
        $totalCustomers = intval($stmtCust->fetchColumn() ?: 0);

        $stmtCustMonth = $pdo->prepare("
            SELECT COUNT(*) FROM customers 
            WHERE pharmacy_id = ? AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())
        ");
        $stmtCustMonth->execute([$pharmacyId]);
        $newCustomersMonth = intval($stmtCustMonth->fetchColumn() ?: 0);

        $stmtAr = $pdo->prepare("
            SELECT COUNT(*), COALESCE(SUM(credit_used), 0) 
            FROM customers 
            WHERE pharmacy_id = ? AND credit_used > 0
        ");
        $stmtAr->execute([$pharmacyId]);
        $arRow = $stmtAr->fetch(PDO::FETCH_NUM);
        if ($arRow) {
            $arBalanceCount = intval($arRow[0]);
            $arBalanceTotal = floatval($arRow[1]);
        }
    } catch (Exception $e) {}

    // 6. Open Purchase Orders
    $openPosCount = 0;
    try {
        $stmtPo = $pdo->prepare("
            SELECT COUNT(*) FROM purchase_orders 
            WHERE pharmacy_id = ? AND (status IN ('draft', 'ordered', 'partial', 'pending', 'open') OR status IS NULL OR status = '')
        ");
        $stmtPo->execute([$pharmacyId]);
        $openPosCount = intval($stmtPo->fetchColumn() ?: 0);
    } catch (Exception $e) {}

    // 7. Inventory Value & Stock Alerts (Dynamic Real-Time Calculation)
    $inventoryValue = 0;
    $totalProductsCount = 0;
    $lowStockCount = 0;
    $expiringCount = 0;
    $expiredCount = 0;

    // Total Cataloged Products (SKUs)
    try {
        $stmtProd = $pdo->prepare("SELECT COUNT(*) FROM products WHERE pharmacy_id = ?");
        $stmtProd->execute([$pharmacyId]);
        $totalProductsCount = intval($stmtProd->fetchColumn() ?: 0);
    } catch (Exception $e) {}

    // Total Inventory Value (from inventory_batches with product selling_price)
    try {
        $stmtVal = $pdo->prepare("
            SELECT COALESCE(SUM(ib.quantity * COALESCE(p.selling_price, p.cost_price, 0)), 0)
            FROM inventory_batches ib
            LEFT JOIN products p ON ib.product_id = p.id
            WHERE ib.pharmacy_id = ? AND ib.quantity > 0
        ");
        $stmtVal->execute([$pharmacyId]);
        $inventoryValue = floatval($stmtVal->fetchColumn() ?: 0);
    } catch (Exception $e) {}

    // Stock Alerts Counts (Directly matching Stock Alerts Module)
    try {
        $stmtAlerts = $pdo->prepare("
            SELECT 
                COUNT(*) AS total_batches,
                SUM(CASE WHEN quantity <= reorder_level AND quantity > 0 THEN 1 ELSE 0 END) AS low_stock_count,
                SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) AS out_of_stock_count,
                SUM(CASE WHEN expiry_date IS NOT NULL AND expiry_date > CURDATE() AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY) AND quantity > 0 THEN 1 ELSE 0 END) AS expiring_soon_count,
                SUM(CASE WHEN expiry_date IS NOT NULL AND expiry_date <= CURDATE() AND quantity > 0 THEN 1 ELSE 0 END) AS expired_count
            FROM inventory_batches
            WHERE pharmacy_id = ?
        ");
        $stmtAlerts->execute([$pharmacyId]);
        $alertCounts = $stmtAlerts->fetch(PDO::FETCH_ASSOC);
        if ($alertCounts) {
            $lowStockCount = intval($alertCounts['low_stock_count'] ?? 0);
            $expiringCount = intval($alertCounts['expiring_soon_count'] ?? 0);
            $expiredCount = intval($alertCounts['expired_count'] ?? 0);
        }
    } catch (Exception $e) {}

    // 8. 14 Days Sales Trend
    $salesTrend = [];
    for ($i = 13; $i >= 0; $i--) {
        $d = date('Y-m-d', strtotime("-$i days"));
        $label = date('M d', strtotime($d));
        $salesTrend[$d] = [
            'date' => $d,
            'label' => $label,
            'revenue' => 0.0,
            'transactions' => 0
        ];
    }
    $stmtTrend = $pdo->prepare("
        SELECT 
            DATE(created_at) AS s_date,
            COALESCE(SUM(total_amount), 0) AS s_rev,
            COUNT(id) AS s_count
        FROM pos_sales
        WHERE pharmacy_id = ? AND status = 'completed' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
        GROUP BY DATE(created_at)
    ");
    $stmtTrend->execute([$pharmacyId]);
    while ($r = $stmtTrend->fetch(PDO::FETCH_ASSOC)) {
        $d = $r['s_date'];
        if (isset($salesTrend[$d])) {
            $salesTrend[$d]['revenue'] = floatval($r['s_rev']);
            $salesTrend[$d]['transactions'] = intval($r['s_count']);
        }
    }
    $salesTrendList = array_values($salesTrend);

    // 9. Payment Mix Today
    $stmtPayMix = $pdo->prepare("
        SELECT 
            payment_method,
            COALESCE(SUM(total_amount), 0) AS method_total,
            COUNT(id) AS method_count
        FROM pos_sales
        WHERE pharmacy_id = ? AND status = 'completed' AND DATE(created_at) = CURDATE()
        GROUP BY payment_method
    ");
    $stmtPayMix->execute([$pharmacyId]);
    $paymentMix = $stmtPayMix->fetchAll(PDO::FETCH_ASSOC) ?: [];

    // 10. Hourly Sales Today (00:00 to 23:00)
    $hourlySales = array_fill(0, 24, 0.0);
    $stmtHourly = $pdo->prepare("
        SELECT 
            HOUR(created_at) AS h,
            COALESCE(SUM(total_amount), 0) AS h_total
        FROM pos_sales
        WHERE pharmacy_id = ? AND status = 'completed' AND DATE(created_at) = CURDATE()
        GROUP BY HOUR(created_at)
    ");
    $stmtHourly->execute([$pharmacyId]);
    while ($hr = $stmtHourly->fetch(PDO::FETCH_ASSOC)) {
        $h = intval($hr['h']);
        if ($h >= 0 && $h <= 23) {
            $hourlySales[$h] = floatval($hr['h_total']);
        }
    }

    // 11. Top Sellers (Last 7 Days)
    $stmtTop = $pdo->prepare("
        SELECT 
            psi.product_name,
            psi.sku,
            SUM(psi.quantity) AS total_qty,
            SUM(psi.total_price) AS total_revenue
        FROM pos_sale_items psi
        JOIN pos_sales ps ON psi.sale_id = ps.id
        WHERE ps.pharmacy_id = ? AND ps.status = 'completed' AND ps.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY psi.product_name, psi.sku
        ORDER BY total_revenue DESC
        LIMIT 5
    ");
    $stmtTop->execute([$pharmacyId]);
    $topSellers = $stmtTop->fetchAll(PDO::FETCH_ASSOC) ?: [];

    // 12. Recent 5 Sales
    $stmtRecent = $pdo->prepare("
        SELECT 
            ps.id,
            ps.invoice_number,
            ps.customer_name,
            ps.total_amount,
            ps.payment_method,
            ps.created_at,
            (SELECT COUNT(*) FROM pos_sale_items WHERE sale_id = ps.id) AS items_count
        FROM pos_sales ps
        WHERE ps.pharmacy_id = ? AND ps.status = 'completed'
        ORDER BY ps.created_at DESC
        LIMIT 5
    ");
    $stmtRecent->execute([$pharmacyId]);
    $recentSales = $stmtRecent->fetchAll(PDO::FETCH_ASSOC) ?: [];

    // Calculations & Rates
    $todaySales = floatval($todayRow['today_sales']);
    $todayTrans = intval($todayRow['today_transactions']);
    $todayUnits = intval($unitsRow['today_units']);
    $todayCust = intval($unitsRow['today_customers']);
    $todayAvgBasket = $todayTrans > 0 ? ($todaySales / $todayTrans) : 0;
    
    // Estimated Gross Margin (e.g. 22% average pharmaceutical retail margin or calculated)
    $grossProfit = $todaySales * 0.22;
    $grossMarginPct = $todaySales > 0 ? 22.0 : 0.0;

    $vsYesterdayPct = 0;
    if ($yesterdaySales > 0) {
        $vsYesterdayPct = round((($todaySales - $yesterdaySales) / $yesterdaySales) * 100, 1);
    }

    $monthSales = floatval($monthRow['month_sales']);
    $vsMonthPct = 0;
    if ($lastMonthSales > 0) {
        $vsMonthPct = round((($monthSales - $lastMonthSales) / $lastMonthSales) * 100, 1);
    }

    echo json_encode([
        'success' => true,
        'pharmacy_id' => $pharmacyId,
        'metrics' => [
            'today_sales' => $todaySales,
            'today_transactions' => $todayTrans,
            'today_gross_profit' => $grossProfit,
            'today_margin_pct' => $grossMarginPct,
            'today_avg_basket' => $todayAvgBasket,
            'today_units' => $todayUnits,
            'today_customers' => $todayCust,
            'vs_yesterday_pct' => $vsYesterdayPct,

            'yesterday_sales' => $yesterdaySales,
            'month_tax' => floatval($monthRow['month_tax']),
            'month_expenses' => $monthExpenses,
            'month_est_net' => ($monthSales - $monthExpenses),
            'credit_sales_today' => floatval($creditTodayRow['credit_sales_today']),
            'credit_transactions_today' => intval($creditTodayRow['credit_transactions_today']),

            'total_customers' => $totalCustomers,
            'new_customers_month' => $newCustomersMonth,
            'ar_balance_count' => $arBalanceCount,
            'ar_balance_total' => $arBalanceTotal,
            'open_pos_count' => $openPosCount,

            'ytd_sales' => $ytdSales,
            'month_sales' => $monthSales,
            'vs_month_pct' => $vsMonthPct,
            'last_7_days_sales' => $last7DaysSales,
            'inventory_value' => $inventoryValue,
            'total_products_count' => $totalProductsCount,

            'low_stock_count' => $lowStockCount,
            'expiring_count' => $expiringCount,
            'expired_count' => $expiredCount
        ],
        'charts' => [
            'total_products_count' => $totalProductsCount,
            'sales_trend_14_days' => $salesTrendList,
            'payment_mix_today' => $paymentMix,
            'hourly_sales_today' => $hourlySales,
            'top_sellers_7_days' => $topSellers,
            'recent_sales' => $recentSales
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
