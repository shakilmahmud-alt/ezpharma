$scratch = "C:\Users\Shakil Mahmud\.gemini\antigravity-ide\scratch"
$dest = "D:\Softwares\Program Files (x86)\EZ Pharma"

# 1. Copy root level files & API
Copy-Item -Path "$scratch\*.html" -Destination "$dest\" -Force
Copy-Item -Path "$scratch\*.css" -Destination "$dest\" -Force
Copy-Item -Path "$scratch\*.js" -Destination "$dest\" -Force
Copy-Item -Path "$scratch\package.json" -Destination "$dest\package.json" -Force
Copy-Item -Path "$scratch\api\*" -Destination "$dest\api\" -Recurse -Force

# 2. Build Sub-route directories with index.html
$routes = @{
  "landing-page" = "$scratch\landing-page.html";
  "signin" = "$scratch\signin.html";
  "signup" = "$scratch\signup.html";
  "dashboard" = "$scratch\dashboard.html";
  "dashboard\users" = "$scratch\dashboard.html";
  "dashboard\billing" = "$scratch\dashboard.html";
  "dashboard\settings" = "$scratch\dashboard.html";
  "dashboard\pos" = "$scratch\dashboard.html";
  "dashboard\pos\sales-history" = "$scratch\dashboard.html";
  "dashboard\pos\cash-drawer" = "$scratch\dashboard.html";
  "dashboard\sales-history" = "$scratch\dashboard.html";
  "dashboard\cash-drawer" = "$scratch\dashboard.html";
  "dashboard\products" = "$scratch\dashboard.html";
  "dashboard\categories" = "$scratch\dashboard.html";
  "dashboard\manufacturers" = "$scratch\dashboard.html";
  "dashboard\stock" = "$scratch\dashboard.html";
  "dashboard\stock\bulk-import" = "$scratch\dashboard.html";
  "dashboard\stock-import" = "$scratch\dashboard.html";
  "dashboard\stock-alerts" = "$scratch\dashboard.html";
  "dashboard\bulk-import" = "$scratch\dashboard.html";
  "dashboard\inventory" = "$scratch\dashboard.html";
  "dashboard\inventory\bulk-import" = "$scratch\dashboard.html";
  "dashboard\procurement" = "$scratch\dashboard.html";
  "dashboard\purchase-orders" = "$scratch\dashboard.html";
  "dashboard\suppliers" = "$scratch\dashboard.html";
  "dashboard\customers" = "$scratch\dashboard.html";
  "dashboard\customers\insights" = "$scratch\dashboard.html";
  "dashboard\customers\tiers" = "$scratch\dashboard.html";
  "dashboard\customer-insights" = "$scratch\dashboard.html";
  "dashboard\customer-tiers" = "$scratch\dashboard.html";
  "dashboard\reports" = "$scratch\dashboard.html";
  "dashboard\expenses" = "$scratch\dashboard.html";
  "dashboard\ai-insights" = "$scratch\dashboard.html";
  "dashboard\account" = "$scratch\dashboard.html";
  "admin" = "$scratch\admin.html";
  "admin\overview" = "$scratch\admin.html";
  "admin\pharmacies" = "$scratch\admin.html";
  "admin\pharmacies\new" = "$scratch\admin.html";
  "admin\pharmacies\1" = "$scratch\admin.html";
  "admin\pharmacies\demo" = "$scratch\admin.html";
  "admin\payments" = "$scratch\admin.html";
  "admin\pricing" = "$scratch\admin.html";
  "admin\payment-method" = "$scratch\admin.html";
  "admin\profile" = "$scratch\admin.html"
}

foreach ($key in $routes.Keys) {
  $targetDir = Join-Path $dest $key
  if (!(Test-Path $targetDir)) { New-Item -ItemType Directory -Force -Path $targetDir | Out-Null }
  Copy-Item -Path $routes[$key] -Destination (Join-Path $targetDir "index.html") -Force
}

Write-Host "All routes and updated files deployed successfully!"
