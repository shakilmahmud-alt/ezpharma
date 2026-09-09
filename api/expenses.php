<?php
// ==============================================
// EZ Pharma - Pharmacy Expenses Management API
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

// Auto-create expenses table
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX (pharmacy_id),
            INDEX (expense_date),
            INDEX (category)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
} catch (Exception $e) {}

// Auto-create cash_drawer and cash_drawer_transactions if needed
try {
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

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS cash_drawer_transactions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            drawer_id INT NOT NULL,
            pharmacy_id INT NOT NULL,
            type VARCHAR(50) NOT NULL,
            amount DECIMAL(12,2) NOT NULL,
            reason VARCHAR(255) NULL,
            reference_id VARCHAR(100) NULL,
            created_by VARCHAR(150) NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX (drawer_id),
            INDEX (pharmacy_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
} catch (Exception $e) {}

$method = $_SERVER['REQUEST_METHOD'];
$data = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $_GET['action'] ?? $data['action'] ?? '';
$pharmacy_id = intval($_GET['pharmacy_id'] ?? $data['pharmacy_id'] ?? 1);

if ($pharmacy_id <= 0) {
    $pharmacy_id = 1;
}

// 1. List Expenses with filtering
if ($action === 'list' || ($method === 'GET' && empty($action))) {
    $search = trim($_GET['search'] ?? '');
    $category = trim($_GET['category'] ?? '');
    $start_date = trim($_GET['start_date'] ?? '');
    $end_date = trim($_GET['end_date'] ?? '');
    $sort = $_GET['sort'] ?? 'expense_date';
    $order = strtoupper($_GET['order'] ?? 'DESC');
    if ($order !== 'ASC') $order = 'DESC';

    $where = ["pharmacy_id = ?"];
    $params = [$pharmacy_id];

    if (!empty($search)) {
        $where[] = "(title LIKE ? OR reference_number LIKE ? OR notes LIKE ?)";
        $sTerm = "%$search%";
        $params[] = $sTerm;
        $params[] = $sTerm;
        $params[] = $sTerm;
    }

    if (!empty($category) && $category !== 'all') {
        $where[] = "category = ?";
        $params[] = $category;
    }

    if (!empty($start_date)) {
        $where[] = "expense_date >= ?";
        $params[] = $start_date;
    }

    if (!empty($end_date)) {
        $where[] = "expense_date <= ?";
        $params[] = $end_date;
    }

    $whereClause = implode(" AND ", $where);
    $allowedSorts = [
        'expense_date' => 'expense_date',
        'title' => 'title',
        'amount' => 'amount',
        'category' => 'category',
        'created_at' => 'created_at'
    ];
    $sortCol = $allowedSorts[$sort] ?? 'expense_date';

    $stmt = $pdo->prepare("SELECT * FROM expenses WHERE $whereClause ORDER BY $sortCol $order, id DESC");
    $stmt->execute($params);
    $expenses = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Summary calculation
    $sumStmt = $pdo->prepare("SELECT COUNT(*) AS total_count, COALESCE(SUM(amount), 0) AS total_amount FROM expenses WHERE $whereClause");
    $sumStmt->execute($params);
    $sumRow = $sumStmt->fetch(PDO::FETCH_ASSOC);

    // Current Month Summary
    $monthStmt = $pdo->prepare("
        SELECT COALESCE(SUM(amount), 0) AS month_amount, COUNT(*) AS month_count 
        FROM expenses 
        WHERE pharmacy_id = ? 
          AND expense_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') 
          AND expense_date <= LAST_DAY(CURDATE())
    ");
    $monthStmt->execute([$pharmacy_id]);
    $monthRow = $monthStmt->fetch(PDO::FETCH_ASSOC);

    $totalAmount = floatval($sumRow['total_amount'] ?? 0);
    $totalCount = intval($sumRow['total_count'] ?? 0);
    $monthAmount = floatval($monthRow['month_amount'] ?? 0);
    $monthCount = intval($monthRow['month_count'] ?? 0);

    echo json_encode([
        'success' => true,
        'expenses' => $expenses,
        'data' => $expenses,
        'total_count' => $totalCount,
        'total_amount' => $totalAmount,
        'month_amount' => $monthAmount,
        'summary' => [
            'total_count' => $totalCount,
            'total_amount' => $totalAmount,
            'month_count' => $monthCount,
            'month_amount' => $monthAmount
        ]
    ]);
    exit;
}

// 2. Add Expense
if ($action === 'create' || $action === 'add') {
    $title = trim($data['title'] ?? '');
    $category = trim($data['category'] ?? 'General');
    $amount = floatval($data['amount'] ?? 0);
    $expense_date = trim($data['expense_date'] ?? date('Y-m-d'));
    $payment_method = trim($data['payment_method'] ?? 'Cash');
    $reference_number = trim($data['reference_number'] ?? '');
    $notes = trim($data['notes'] ?? '');
    $created_by = intval($data['created_by'] ?? null);
    $user_name = trim($data['user_name'] ?? 'Admin');

    if (empty($title)) {
        echo json_encode(['success' => false, 'error' => 'Expense title is required']);
        exit;
    }

    if ($amount <= 0) {
        echo json_encode(['success' => false, 'error' => 'Expense amount must be greater than 0']);
        exit;
    }

    if (empty($expense_date)) {
        $expense_date = date('Y-m-d');
    }

    $stmt = $pdo->prepare("
        INSERT INTO expenses (pharmacy_id, title, category, amount, expense_date, payment_method, reference_number, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$pharmacy_id, $title, $category, $amount, $expense_date, $payment_method, $reference_number, $notes, $created_by]);
    $expense_id = $pdo->lastInsertId();

    // ==============================================
    // Hit Active Cash Drawer if Payment Method is Cash
    // ==============================================
    if (strcasecmp($payment_method, 'Cash') === 0) {
        try {
            $chkDrawer = $pdo->prepare("SELECT id FROM cash_drawer WHERE pharmacy_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1");
            $chkDrawer->execute([$pharmacy_id]);
            $openDrawerId = $chkDrawer->fetchColumn();

            if ($openDrawerId) {
                // Update cash_out & expected_cash
                $updDrawer = $pdo->prepare("
                    UPDATE cash_drawer 
                    SET cash_out = cash_out + ?, expected_cash = GREATEST(0, expected_cash - ?) 
                    WHERE id = ? AND pharmacy_id = ?
                ");
                $updDrawer->execute([$amount, $amount, $openDrawerId, $pharmacy_id]);

                // Record transaction in cash_drawer_transactions
                $logReason = "Expense: " . $title . ($category ? " ($category)" : "");
                $refCode = !empty($reference_number) ? $reference_number : ('EXP-' . $expense_id);
                $insLog = $pdo->prepare("
                    INSERT INTO cash_drawer_transactions (drawer_id, pharmacy_id, type, amount, reason, reference_id, created_by, created_at)
                    VALUES (?, ?, 'cash_out', ?, ?, ?, ?, NOW())
                ");
                $insLog->execute([$openDrawerId, $pharmacy_id, $amount, $logReason, $refCode, $user_name]);
            }
        } catch (Exception $e) {}
    }

    echo json_encode([
        'success' => true,
        'id' => $expense_id,
        'message' => 'Expense recorded successfully and synchronized with Cash Drawer'
    ]);
    exit;
}

// 3. Update Expense
if ($action === 'update' || $action === 'edit') {
    $id = intval($data['id'] ?? 0);
    $title = trim($data['title'] ?? '');
    $category = trim($data['category'] ?? 'General');
    $amount = floatval($data['amount'] ?? 0);
    $expense_date = trim($data['expense_date'] ?? date('Y-m-d'));
    $payment_method = trim($data['payment_method'] ?? 'Cash');
    $reference_number = trim($data['reference_number'] ?? '');
    $notes = trim($data['notes'] ?? '');
    $user_name = trim($data['user_name'] ?? 'Admin');

    if ($id <= 0) {
        echo json_encode(['success' => false, 'error' => 'Invalid expense ID']);
        exit;
    }

    if (empty($title)) {
        echo json_encode(['success' => false, 'error' => 'Expense title is required']);
        exit;
    }

    if ($amount <= 0) {
        echo json_encode(['success' => false, 'error' => 'Expense amount must be greater than 0']);
        exit;
    }

    // Fetch existing expense to calculate cash drawer delta
    $oldExp = null;
    try {
        $getOld = $pdo->prepare("SELECT * FROM expenses WHERE id = ? AND pharmacy_id = ?");
        $getOld->execute([$id, $pharmacy_id]);
        $oldExp = $getOld->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {}

    $stmt = $pdo->prepare("
        UPDATE expenses 
        SET title = ?, category = ?, amount = ?, expense_date = ?, payment_method = ?, reference_number = ?, notes = ?
        WHERE id = ? AND pharmacy_id = ?
    ");
    $stmt->execute([$title, $category, $amount, $expense_date, $payment_method, $reference_number, $notes, $id, $pharmacy_id]);

    // ==============================================
    // Sync Cash Drawer adjustments
    // ==============================================
    if ($oldExp) {
        try {
            $oldWasCash = (strcasecmp($oldExp['payment_method'] ?? '', 'Cash') === 0);
            $newIsCash = (strcasecmp($payment_method, 'Cash') === 0);
            $oldAmount = floatval($oldExp['amount'] ?? 0);

            $chkDrawer = $pdo->prepare("SELECT id FROM cash_drawer WHERE pharmacy_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1");
            $chkDrawer->execute([$pharmacy_id]);
            $openDrawerId = $chkDrawer->fetchColumn();

            if ($openDrawerId) {
                if ($oldWasCash && $newIsCash) {
                    $diff = $amount - $oldAmount;
                    if ($diff > 0) {
                        // More money taken out
                        $pdo->prepare("UPDATE cash_drawer SET cash_out = cash_out + ?, expected_cash = GREATEST(0, expected_cash - ?) WHERE id = ? AND pharmacy_id = ?")
                            ->execute([$diff, $diff, $openDrawerId, $pharmacy_id]);
                        $pdo->prepare("INSERT INTO cash_drawer_transactions (drawer_id, pharmacy_id, type, amount, reason, reference_id, created_by, created_at) VALUES (?, ?, 'cash_out', ?, ?, ?, ?, NOW())")
                            ->execute([$openDrawerId, $pharmacy_id, $diff, "Expense Updated (+): $title", 'EXP-' . $id, $user_name]);
                    } else if ($diff < 0) {
                        // Money returned to drawer
                        $absDiff = abs($diff);
                        $pdo->prepare("UPDATE cash_drawer SET cash_out = GREATEST(0, cash_out - ?), expected_cash = expected_cash + ? WHERE id = ? AND pharmacy_id = ?")
                            ->execute([$absDiff, $absDiff, $openDrawerId, $pharmacy_id]);
                        $pdo->prepare("INSERT INTO cash_drawer_transactions (drawer_id, pharmacy_id, type, amount, reason, reference_id, created_by, created_at) VALUES (?, ?, 'cash_in', ?, ?, ?, ?, NOW())")
                            ->execute([$openDrawerId, $pharmacy_id, $absDiff, "Expense Updated (-): $title", 'EXP-' . $id, $user_name]);
                    }
                } else if ($oldWasCash && !$newIsCash) {
                    // Reversed cash out
                    $pdo->prepare("UPDATE cash_drawer SET cash_out = GREATEST(0, cash_out - ?), expected_cash = expected_cash + ? WHERE id = ? AND pharmacy_id = ?")
                        ->execute([$oldAmount, $oldAmount, $openDrawerId, $pharmacy_id]);
                    $pdo->prepare("INSERT INTO cash_drawer_transactions (drawer_id, pharmacy_id, type, amount, reason, reference_id, created_by, created_at) VALUES (?, ?, 'cash_in', ?, ?, ?, ?, NOW())")
                        ->execute([$openDrawerId, $pharmacy_id, $oldAmount, "Expense Changed to Non-Cash: $title", 'EXP-' . $id, $user_name]);
                } else if (!$oldWasCash && $newIsCash) {
                    // Newly converted to cash out
                    $pdo->prepare("UPDATE cash_drawer SET cash_out = cash_out + ?, expected_cash = GREATEST(0, expected_cash - ?) WHERE id = ? AND pharmacy_id = ?")
                        ->execute([$amount, $amount, $openDrawerId, $pharmacy_id]);
                    $pdo->prepare("INSERT INTO cash_drawer_transactions (drawer_id, pharmacy_id, type, amount, reason, reference_id, created_by, created_at) VALUES (?, ?, 'cash_out', ?, ?, ?, ?, NOW())")
                        ->execute([$openDrawerId, $pharmacy_id, $amount, "Expense Changed to Cash: $title", 'EXP-' . $id, $user_name]);
                }
            }
        } catch (Exception $e) {}
    }

    echo json_encode([
        'success' => true,
        'message' => 'Expense updated successfully and synchronized with Cash Drawer'
    ]);
    exit;
}

// 4. Delete Expense
if ($action === 'delete') {
    $expense_id = intval($data['id'] ?? $_GET['id'] ?? 0);
    $user_name = trim($data['user_name'] ?? 'Admin');
    if ($expense_id <= 0) {
        echo json_encode(['success' => false, 'error' => 'Invalid expense ID']);
        exit;
    }

    // Fetch existing expense to revert cash drawer deduction if was Cash
    $oldExp = null;
    try {
        $getOld = $pdo->prepare("SELECT * FROM expenses WHERE id = ? AND pharmacy_id = ?");
        $getOld->execute([$expense_id, $pharmacy_id]);
        $oldExp = $getOld->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {}

    $stmt = $pdo->prepare("DELETE FROM expenses WHERE id = ? AND pharmacy_id = ?");
    $stmt->execute([$expense_id, $pharmacy_id]);

    if ($oldExp && strcasecmp($oldExp['payment_method'] ?? '', 'Cash') === 0) {
        $oldAmt = floatval($oldExp['amount'] ?? 0);
        if ($oldAmt > 0) {
            try {
                $chkDrawer = $pdo->prepare("SELECT id FROM cash_drawer WHERE pharmacy_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1");
                $chkDrawer->execute([$pharmacy_id]);
                $openDrawerId = $chkDrawer->fetchColumn();

                if ($openDrawerId) {
                    $pdo->prepare("
                        UPDATE cash_drawer 
                        SET cash_out = GREATEST(0, cash_out - ?), expected_cash = expected_cash + ? 
                        WHERE id = ? AND pharmacy_id = ?
                    ")->execute([$oldAmt, $oldAmt, $openDrawerId, $pharmacy_id]);

                    $pdo->prepare("
                        INSERT INTO cash_drawer_transactions (drawer_id, pharmacy_id, type, amount, reason, reference_id, created_by, created_at)
                        VALUES (?, ?, 'cash_in', ?, ?, ?, ?, NOW())
                    ")->execute([$openDrawerId, $pharmacy_id, $oldAmt, "Reversal: Deleted Expense #" . $expense_id . " (" . $oldExp['title'] . ")", 'EXP-' . $expense_id, $user_name]);
                }
            } catch (Exception $e) {}
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'Expense deleted successfully and cash drawer balance reverted'
    ]);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Invalid request action']);
exit;
?>
