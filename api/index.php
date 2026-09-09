<?php
/**
 * EZ Pharma - Vercel Serverless Master API Router
 * Dispatches incoming /api requests to the corresponding script
 */

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
$path = trim($uri, '/');

// Extract endpoint name
$parts = explode('/', $path);
$endpoint = end($parts);

// Strip query or extension
$scriptName = pathinfo($endpoint, PATHINFO_FILENAME);

if (empty($scriptName) || $scriptName === 'index' || $scriptName === 'api') {
    header('Content-Type: application/json');
    echo json_encode([
        'status' => 'online',
        'service' => 'EZ Pharma Serverless API Engine',
        'version' => '1.0.0'
    ]);
    exit;
}

$targetFile = __DIR__ . '/' . $scriptName . '.php';

if (file_exists($targetFile) && is_file($targetFile) && $scriptName !== 'index') {
    require $targetFile;
} else {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => "API Endpoint '{$scriptName}' not found"
    ]);
    exit;
}
