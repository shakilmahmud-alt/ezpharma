$scratch = "C:\Users\Shakil Mahmud\.gemini\antigravity-ide\scratch"
$dest = "D:\Softwares\Program Files (x86)\EZ Pharma"

# 1. Clean extra scripts
$extraFiles = @(
  "build_routes.ps1",
  "cleanup_platform_admin.ps1",
  "fix_all_assets.ps1",
  "serve.json"
)
foreach ($f in $extraFiles) {
  if (Test-Path "$dest\$f") { Remove-Item "$dest\$f" -Force -Recurse }
  if (Test-Path "$scratch\$f") { Remove-Item "$scratch\$f" -Force -Recurse }
}

# 2. Copy main files from scratch to dest
Copy-Item -Path "$scratch\admin.html" -Destination "$dest\admin.html" -Force
Copy-Item -Path "$scratch\admin.css" -Destination "$dest\admin.css" -Force
Copy-Item -Path "$scratch\admin.js" -Destination "$dest\admin.js" -Force
Copy-Item -Path "$scratch\index.html" -Destination "$dest\index.html" -Force
Copy-Item -Path "$scratch\style.css" -Destination "$dest\style.css" -Force
Copy-Item -Path "$scratch\app.js" -Destination "$dest\app.js" -Force
Copy-Item -Path "$scratch\landing-page.html" -Destination "$dest\landing-page.html" -Force
Copy-Item -Path "$scratch\landing-page.css" -Destination "$dest\landing-page.css" -Force
Copy-Item -Path "$scratch\signin.html" -Destination "$dest\signin.html" -Force
Copy-Item -Path "$scratch\signin.css" -Destination "$dest\signin.css" -Force
Copy-Item -Path "$scratch\signin.js" -Destination "$dest\signin.js" -Force
Copy-Item -Path "$scratch\signup.html" -Destination "$dest\signup.html" -Force
Copy-Item -Path "$scratch\signup.css" -Destination "$dest\signup.css" -Force
Copy-Item -Path "$scratch\signup.js" -Destination "$dest\signup.js" -Force
Copy-Item -Path "$scratch\dashboard.html" -Destination "$dest\dashboard.html" -Force
Copy-Item -Path "$scratch\dashboard.css" -Destination "$dest\dashboard.css" -Force
Copy-Item -Path "$scratch\dashboard.js" -Destination "$dest\dashboard.js" -Force

if (Test-Path "$scratch\api") {
  Copy-Item -Path "$scratch\api\*" -Destination "$dest\api\" -Recurse -Force
}

# 3. Create route folders with index.html for clean URLs
$routes = @{
  "admin" = "$dest\admin.html"
  "signin" = "$dest\signin.html"
  "signup" = "$dest\signup.html"
  "dashboard" = "$dest\dashboard.html"
  "landing-page" = "$dest\landing-page.html"
}

foreach ($key in $routes.Keys) {
  $dir = Join-Path $dest $key
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $content = Get-Content $routes[$key] -Raw
  Set-Content -Path (Join-Path $dir "index.html") -Value $content
}

# Clean any leftover admin subdirectories (e.g. admin\pharmacies, admin\overview)
$adminSubdirs = @("overview", "pharmacies", "payments", "pricing", "payment-method", "profile")
foreach ($sub in $adminSubdirs) {
  $subPath = Join-Path "$dest\admin" $sub
  if (Test-Path $subPath) { Remove-Item $subPath -Recurse -Force }
}

Write-Host "Project successfully restored to clean original state!"
