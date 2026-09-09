<?php
/**
 * EZ Pharma - Database Connection
 * Supports Environment Variables for Vercel / Cloud Deployments
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$db_host = getenv('DB_HOST') ?: (isset($_ENV['DB_HOST']) ? $_ENV['DB_HOST'] : '127.0.0.1');
$db_port = getenv('DB_PORT') ?: (isset($_ENV['DB_PORT']) ? $_ENV['DB_PORT'] : '3306');
$db_name = getenv('DB_NAME') ?: (isset($_ENV['DB_NAME']) ? $_ENV['DB_NAME'] : 'holidaym_ezpharma');
$db_user = getenv('DB_USER') ?: (isset($_ENV['DB_USER']) ? $_ENV['DB_USER'] : 'holidaym_admin');
$db_pass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : (isset($_ENV['DB_PASS']) ? $_ENV['DB_PASS'] : 'msm039raqeeb');

// If host is explicitly localhost, convert to 127.0.0.1 to enforce TCP connection
if ($db_host === 'localhost') {
    $db_host = '127.0.0.1';
}

$pdo_options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
    PDO::ATTR_TIMEOUT => 10,
];

// If SSL is enabled or required for cloud MySQL (e.g. Aiven, TiDB)
if (getenv('DB_SSL') === 'true' || getenv('MYSQL_ATTR_SSL_CA')) {
    $pdo_options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
}

try {
    $dsn = "mysql:host={$db_host};port={$db_port};dbname={$db_name};charset=utf8mb4";
    $pdo = new PDO($dsn, $db_user, $db_pass, $pdo_options);
} catch (PDOException $e) {
    // Fallback to local root without password for localhost development
    try {
        $pdo = new PDO("mysql:host=127.0.0.1;port=3306;dbname=holidaym_ezpharma;charset=utf8mb4", 'root', '', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e2) {
        http_response_code(500);
        header('Content-Type: application/json');
        
        $isVercel = isset($_ENV['VERCEL']) || isset($_SERVER['VERCEL']) || getenv('VERCEL');
        $msg = $e->getMessage();
        if ($isVercel && ($db_host === '127.0.0.1' || $db_host === 'localhost')) {
            $msg = "Vercel Deployment requires Cloud MySQL. Please configure DB_HOST, DB_NAME, DB_USER, DB_PASS in Vercel Project Settings -> Environment Variables.";
        }
        
        echo json_encode([
            'success' => false,
            'message' => 'Database connection failed: ' . $msg
        ]);
        exit;
    }
}


