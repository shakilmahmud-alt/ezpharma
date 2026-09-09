<?php
/**
 * EZ Pharma - Products, Categories & Manufacturers API
 * Handles database operations for pharmacy inventory catalog in MySQL
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

    // 1. Ensure categories table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `product_categories` (
            `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
            `pharmacy_id` INT(11) UNSIGNED NOT NULL,
            `name` VARCHAR(191) NOT NULL,
            `description` TEXT DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            INDEX (`pharmacy_id`),
            CONSTRAINT `fk_prod_cat_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 2. Ensure manufacturers table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `product_manufacturers` (
            `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
            `pharmacy_id` INT(11) UNSIGNED NOT NULL,
            `name` VARCHAR(191) NOT NULL,
            `contact_person` VARCHAR(191) DEFAULT NULL,
            `email` VARCHAR(191) DEFAULT NULL,
            `phone` VARCHAR(50) DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            INDEX (`pharmacy_id`),
            CONSTRAINT `fk_prod_mfr_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 3. Ensure products table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `products` (
            `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
            `pharmacy_id` INT(11) UNSIGNED NOT NULL,
            `name` VARCHAR(191) NOT NULL,
            `generic_name` VARCHAR(191) DEFAULT NULL,
            `description` TEXT DEFAULT NULL,
            `category_id` INT(11) UNSIGNED DEFAULT NULL,
            `category_name` VARCHAR(191) DEFAULT NULL,
            `manufacturer_id` INT(11) UNSIGNED DEFAULT NULL,
            `manufacturer_name` VARCHAR(191) DEFAULT NULL,
            `sku` VARCHAR(100) DEFAULT NULL,
            `selling_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            `cost_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            `requires_rx` TINYINT(1) NOT NULL DEFAULT 0,
            `track_expiry` TINYINT(1) NOT NULL DEFAULT 1,
            `status` ENUM('active', 'inactive', 'archived') NOT NULL DEFAULT 'active',
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            INDEX (`pharmacy_id`),
            INDEX (`category_id`),
            INDEX (`manufacturer_id`),
            INDEX (`sku`),
            CONSTRAINT `fk_products_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    $method = $_SERVER['REQUEST_METHOD'];

    // GET: Fetch products list with search & category filter
    if ($method === 'GET') {
        $pharmacy_id = isset($_GET['pharmacy_id']) ? intval($_GET['pharmacy_id']) : 1;
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $category = isset($_GET['category']) ? trim($_GET['category']) : '';
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
        $per_page = isset($_GET['per_page']) ? max(5, intval($_GET['per_page'])) : 20;
        $offset = ($page - 1) * $per_page;

        $where = ["pharmacy_id = :pharmacy_id"];
        $params = ['pharmacy_id' => $pharmacy_id];

        if (!empty($search)) {
            $where[] = "(name LIKE :s1 OR generic_name LIKE :s2 OR sku LIKE :s3 OR manufacturer_name LIKE :s4)";
            $params['s1'] = "%$search%";
            $params['s2'] = "%$search%";
            $params['s3'] = "%$search%";
            $params['s4'] = "%$search%";
        }

        if (!empty($category) && $category !== 'All Categories') {
            $where[] = "category_name = :category";
            $params['category'] = $category;
        }

        $whereClause = implode(" AND ", $where);

        // Count total
        $countStmt = $pdo->prepare("SELECT COUNT(*) as total FROM products WHERE $whereClause");
        $countStmt->execute($params);
        $total = intval($countStmt->fetchColumn());

        $allowed_sorts = [
            'created_at' => 'created_at',
            'name' => 'name',
            'selling_price' => 'selling_price',
            'sku' => 'sku'
        ];
        $sort = isset($_GET['sort']) && isset($allowed_sorts[$_GET['sort']]) ? $allowed_sorts[$_GET['sort']] : 'created_at';
        $order = isset($_GET['order']) && strtoupper($_GET['order']) === 'ASC' ? 'ASC' : 'DESC';

        // Fetch products with real-time stock_quantity from inventory_batches
        $stmt = $pdo->prepare("
            SELECT id, pharmacy_id, name, generic_name, description, category_id, category_name,
                   manufacturer_id, manufacturer_name, sku, selling_price, cost_price,
                   requires_rx, track_expiry, status, created_at, updated_at,
                   COALESCE((SELECT SUM(ib.quantity) FROM inventory_batches ib WHERE ib.product_id = products.id AND ib.pharmacy_id = products.pharmacy_id), 0) AS stock_quantity
            FROM products
            WHERE $whereClause
            ORDER BY $sort $order, id $order
            LIMIT $offset, $per_page
        ");
        $stmt->execute($params);
        $products = $stmt->fetchAll();

        // Also fetch categories list for dropdown
        $catStmt = $pdo->prepare("SELECT id, name FROM product_categories WHERE pharmacy_id = :pharmacy_id ORDER BY name ASC");
        $catStmt->execute(['pharmacy_id' => $pharmacy_id]);
        $categories = $catStmt->fetchAll();

        // Also fetch manufacturers list for dropdown
        $mfrStmt = $pdo->prepare("SELECT id, name FROM product_manufacturers WHERE pharmacy_id = :pharmacy_id ORDER BY name ASC");
        $mfrStmt->execute(['pharmacy_id' => $pharmacy_id]);
        $manufacturers = $mfrStmt->fetchAll();

        echo json_encode([
            'success' => true,
            'products' => $products,
            'categories' => $categories,
            'manufacturers' => $manufacturers,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $per_page,
                'total_pages' => ceil($total / $per_page)
            ]
        ]);
        exit;
    }

    // POST: Create, Update, or Delete product
    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true) ?: $_POST;

        $action = isset($input['action']) ? trim($input['action']) : 'create';
        $pharmacy_id = isset($input['pharmacy_id']) ? intval($input['pharmacy_id']) : 1;

        if ($action === 'bulk_import') {
            $products = isset($input['products']) && is_array($input['products']) ? $input['products'] : [];
            if (empty($products)) {
                echo json_encode(['success' => false, 'message' => 'No products provided for bulk import.']);
                exit;
            }

            $imported = 0;
            $updated = 0;

            // Pre-load existing categories and manufacturers for pharmacy
            $catStmt = $pdo->prepare("SELECT id, name FROM product_categories WHERE pharmacy_id = :pharmacy_id");
            $catStmt->execute(['pharmacy_id' => $pharmacy_id]);
            $categoryMap = [];
            foreach ($catStmt->fetchAll() as $c) {
                $categoryMap[strtolower(trim($c['name']))] = $c['id'];
            }

            $mfrStmt = $pdo->prepare("SELECT id, name FROM product_manufacturers WHERE pharmacy_id = :pharmacy_id");
            $mfrStmt->execute(['pharmacy_id' => $pharmacy_id]);
            $manufacturerMap = [];
            foreach ($mfrStmt->fetchAll() as $m) {
                $manufacturerMap[strtolower(trim($m['name']))] = $m['id'];
            }

            $insProdStmt = $pdo->prepare("
                INSERT INTO products (
                    pharmacy_id, name, generic_name, description, category_id, category_name,
                    manufacturer_id, manufacturer_name, sku, selling_price, cost_price,
                    requires_rx, track_expiry, status, created_at
                ) VALUES (
                    :pharmacy_id, :name, :generic_name, :description, :category_id, :category_name,
                    :manufacturer_id, :manufacturer_name, :sku, :selling_price, :cost_price,
                    :requires_rx, :track_expiry, 'active', NOW()
                )
            ");

            $updProdStmt = $pdo->prepare("
                UPDATE products SET
                    generic_name = :generic_name,
                    description = :description,
                    category_id = :category_id,
                    category_name = :category_name,
                    manufacturer_id = :manufacturer_id,
                    manufacturer_name = :manufacturer_name,
                    sku = :sku,
                    selling_price = :selling_price,
                    cost_price = :cost_price,
                    requires_rx = :requires_rx,
                    track_expiry = :track_expiry,
                    status = 'active'
                WHERE pharmacy_id = :pharmacy_id AND name = :name
            ");

            $chkProdStmt = $pdo->prepare("SELECT id FROM products WHERE pharmacy_id = :pharmacy_id AND (name = :name OR (sku != '' AND sku = :sku)) LIMIT 1");

            foreach ($products as $idx => $p) {
                $name = trim($p['name'] ?? $p['Name'] ?? '');
                if (empty($name)) continue;

                $generic_name = trim($p['generic_name'] ?? $p['genericName'] ?? $p['GenericName'] ?? '');
                $description = trim($p['description'] ?? $p['Description'] ?? '');
                $category_name = trim($p['category_name'] ?? $p['category'] ?? $p['Category'] ?? 'General');
                $manufacturer_name = trim($p['manufacturer_name'] ?? $p['manufacturer'] ?? $p['Manufacturer'] ?? '');
                $sku = trim($p['sku'] ?? $p['SKU'] ?? '');
                $selling_price = floatval($p['selling_price'] ?? $p['price'] ?? $p['Price'] ?? 0);
                $cost_price = floatval($p['cost_price'] ?? $p['costPrice'] ?? $p['CostPrice'] ?? 0);

                // Rx boolean check
                $rxRaw = $p['requires_rx'] ?? $p['requiresPrescription'] ?? $p['RequiresPrescription'] ?? false;
                $requires_rx = ($rxRaw === true || $rxRaw === 1 || $rxRaw === '1' || strtolower(trim((string)$rxRaw)) === 'true' || strtolower(trim((string)$rxRaw)) === 'yes') ? 1 : 0;

                // Track expiry check
                $expRaw = $p['track_expiry'] ?? $p['expiryDateRequired'] ?? $p['ExpiryDateRequired'] ?? true;
                $track_expiry = ($expRaw === false || $expRaw === 0 || $expRaw === '0' || strtolower(trim((string)$expRaw)) === 'false' || strtolower(trim((string)$expRaw)) === 'no') ? 0 : 1;

                // Category ID resolve / auto-create
                $category_id = null;
                if (!empty($category_name)) {
                    $catKey = strtolower($category_name);
                    if (isset($categoryMap[$catKey])) {
                        $category_id = $categoryMap[$catKey];
                    } else {
                        $insCat = $pdo->prepare("INSERT INTO product_categories (pharmacy_id, name) VALUES (:pharmacy_id, :name)");
                        $insCat->execute(['pharmacy_id' => $pharmacy_id, 'name' => $category_name]);
                        $category_id = $pdo->lastInsertId();
                        $categoryMap[$catKey] = $category_id;
                    }
                }

                // Manufacturer ID resolve / auto-create
                $manufacturer_id = null;
                if (!empty($manufacturer_name)) {
                    $mfrKey = strtolower($manufacturer_name);
                    if (isset($manufacturerMap[$mfrKey])) {
                        $manufacturer_id = $manufacturerMap[$mfrKey];
                    } else {
                        $insMfr = $pdo->prepare("INSERT INTO product_manufacturers (pharmacy_id, name) VALUES (:pharmacy_id, :name)");
                        $insMfr->execute(['pharmacy_id' => $pharmacy_id, 'name' => $manufacturer_name]);
                        $manufacturer_id = $pdo->lastInsertId();
                        $manufacturerMap[$mfrKey] = $manufacturer_id;
                    }
                }

                if (empty($sku)) {
                    $sku = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $name), 0, 4)) . '-' . strtoupper(bin2hex(random_bytes(2)));
                }

                // Check if product already exists
                $chkProdStmt->execute(['pharmacy_id' => $pharmacy_id, 'name' => $name, 'sku' => $sku]);
                $existing = $chkProdStmt->fetch();

                if ($existing) {
                    $updProdStmt->execute([
                        'pharmacy_id' => $pharmacy_id,
                        'name' => $name,
                        'generic_name' => $generic_name,
                        'description' => $description,
                        'category_id' => $category_id,
                        'category_name' => $category_name,
                        'manufacturer_id' => $manufacturer_id,
                        'manufacturer_name' => $manufacturer_name,
                        'sku' => $sku,
                        'selling_price' => $selling_price,
                        'cost_price' => $cost_price,
                        'requires_rx' => $requires_rx,
                        'track_expiry' => $track_expiry
                    ]);
                    $updated++;
                } else {
                    $insProdStmt->execute([
                        'pharmacy_id' => $pharmacy_id,
                        'name' => $name,
                        'generic_name' => $generic_name,
                        'description' => $description,
                        'category_id' => $category_id,
                        'category_name' => $category_name,
                        'manufacturer_id' => $manufacturer_id,
                        'manufacturer_name' => $manufacturer_name,
                        'sku' => $sku,
                        'selling_price' => $selling_price,
                        'cost_price' => $cost_price,
                        'requires_rx' => $requires_rx,
                        'track_expiry' => $track_expiry
                    ]);
                    $imported++;
                }
            }

            echo json_encode([
                'success' => true,
                'message' => "Bulk import completed: $imported added, $updated updated.",
                'imported_count' => $imported,
                'updated_count' => $updated,
                'total_processed' => $imported + $updated
            ]);
            exit;
        }

        if ($action === 'create') {
            $name = trim($input['name'] ?? '');
            $generic_name = trim($input['generic_name'] ?? '');
            $description = trim($input['description'] ?? '');
            $category_name = trim($input['category_name'] ?? $input['category'] ?? '');
            $manufacturer_name = trim($input['manufacturer_name'] ?? $input['manufacturer'] ?? '');
            $sku = trim($input['sku'] ?? '');
            $selling_price = floatval($input['selling_price'] ?? 0);
            $cost_price = floatval($input['cost_price'] ?? 0);
            $requires_rx = !empty($input['requires_rx']) ? 1 : 0;
            $track_expiry = isset($input['track_expiry']) ? (!empty($input['track_expiry']) ? 1 : 0) : 1;

            if (empty($name)) {
                echo json_encode(['success' => false, 'message' => 'Product name is required.']);
                exit;
            }

            // Auto-create category in product_categories if new
            $category_id = null;
            if (!empty($category_name)) {
                $chkCat = $pdo->prepare("SELECT id FROM product_categories WHERE pharmacy_id = :pharmacy_id AND name = :name LIMIT 1");
                $chkCat->execute(['pharmacy_id' => $pharmacy_id, 'name' => $category_name]);
                $cRow = $chkCat->fetch();
                if ($cRow) {
                    $category_id = $cRow['id'];
                } else {
                    $insCat = $pdo->prepare("INSERT INTO product_categories (pharmacy_id, name) VALUES (:pharmacy_id, :name)");
                    $insCat->execute(['pharmacy_id' => $pharmacy_id, 'name' => $category_name]);
                    $category_id = $pdo->lastInsertId();
                }
            }

            // Auto-create manufacturer in product_manufacturers if new
            $manufacturer_id = null;
            if (!empty($manufacturer_name)) {
                $chkMfr = $pdo->prepare("SELECT id FROM product_manufacturers WHERE pharmacy_id = :pharmacy_id AND name = :name LIMIT 1");
                $chkMfr->execute(['pharmacy_id' => $pharmacy_id, 'name' => $manufacturer_name]);
                $mRow = $chkMfr->fetch();
                if ($mRow) {
                    $manufacturer_id = $mRow['id'];
                } else {
                    $insMfr = $pdo->prepare("INSERT INTO product_manufacturers (pharmacy_id, name) VALUES (:pharmacy_id, :name)");
                    $insMfr->execute(['pharmacy_id' => $pharmacy_id, 'name' => $manufacturer_name]);
                    $manufacturer_id = $pdo->lastInsertId();
                }
            }

            // Generate SKU if empty
            if (empty($sku)) {
                $sku = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $name), 0, 4)) . '-' . strtoupper(bin2hex(random_bytes(2)));
            }

            $ins = $pdo->prepare("
                INSERT INTO products (
                    pharmacy_id, name, generic_name, description, category_id, category_name,
                    manufacturer_id, manufacturer_name, sku, selling_price, cost_price,
                    requires_rx, track_expiry, status, created_at
                ) VALUES (
                    :pharmacy_id, :name, :generic_name, :description, :category_id, :category_name,
                    :manufacturer_id, :manufacturer_name, :sku, :selling_price, :cost_price,
                    :requires_rx, :track_expiry, 'active', NOW()
                )
            ");
            $ins->execute([
                'pharmacy_id' => $pharmacy_id,
                'name' => $name,
                'generic_name' => $generic_name,
                'description' => $description,
                'category_id' => $category_id,
                'category_name' => $category_name,
                'manufacturer_id' => $manufacturer_id,
                'manufacturer_name' => $manufacturer_name,
                'sku' => $sku,
                'selling_price' => $selling_price,
                'cost_price' => $cost_price,
                'requires_rx' => $requires_rx,
                'track_expiry' => $track_expiry
            ]);

            $newId = $pdo->lastInsertId();

            echo json_encode([
                'success' => true,
                'message' => 'Product created successfully',
                'id' => $newId
            ]);
            exit;
        }

        if ($action === 'update') {
            $id = isset($input['id']) ? intval($input['id']) : 0;
            $name = trim($input['name'] ?? '');
            $generic_name = trim($input['generic_name'] ?? '');
            $description = trim($input['description'] ?? '');
            $category_name = trim($input['category_name'] ?? $input['category'] ?? '');
            $manufacturer_name = trim($input['manufacturer_name'] ?? $input['manufacturer'] ?? '');
            $sku = trim($input['sku'] ?? '');
            $selling_price = floatval($input['selling_price'] ?? 0);
            $cost_price = floatval($input['cost_price'] ?? 0);
            $requires_rx = !empty($input['requires_rx']) ? 1 : 0;
            $track_expiry = isset($input['track_expiry']) ? (!empty($input['track_expiry']) ? 1 : 0) : 1;

            if ($id <= 0 || empty($name)) {
                echo json_encode(['success' => false, 'message' => 'Product ID and Name are required.']);
                exit;
            }

            $up = $pdo->prepare("
                UPDATE products SET
                    name = :name,
                    generic_name = :generic_name,
                    description = :description,
                    category_name = :category_name,
                    manufacturer_name = :manufacturer_name,
                    sku = :sku,
                    selling_price = :selling_price,
                    cost_price = :cost_price,
                    requires_rx = :requires_rx,
                    track_expiry = :track_expiry,
                    updated_at = NOW()
                WHERE id = :id AND pharmacy_id = :pharmacy_id
            ");
            $up->execute([
                'name' => $name,
                'generic_name' => $generic_name,
                'description' => $description,
                'category_name' => $category_name,
                'manufacturer_name' => $manufacturer_name,
                'sku' => $sku,
                'selling_price' => $selling_price,
                'cost_price' => $cost_price,
                'requires_rx' => $requires_rx,
                'track_expiry' => $track_expiry,
                'id' => $id,
                'pharmacy_id' => $pharmacy_id
            ]);

            echo json_encode([
                'success' => true,
                'message' => 'Product updated successfully'
            ]);
            exit;
        }

        if ($action === 'delete') {
            $id = isset($input['id']) ? intval($input['id']) : 0;
            if ($id <= 0) {
                echo json_encode(['success' => false, 'message' => 'Invalid product ID.']);
                exit;
            }

            $del = $pdo->prepare("DELETE FROM products WHERE id = :id AND pharmacy_id = :pharmacy_id LIMIT 1");
            $del->execute(['id' => $id, 'pharmacy_id' => $pharmacy_id]);

            echo json_encode([
                'success' => true,
                'message' => 'Product deleted successfully'
            ]);
            exit;
        }

        echo json_encode(['success' => false, 'message' => 'Unknown action.']);
        exit;
    }

} catch (Exception $e) {
    http_response_code(200);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
