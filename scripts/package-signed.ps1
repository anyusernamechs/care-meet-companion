# Build a signed CARE Meet Companion installer using the project self-sign PFX.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/package-signed.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/package-signed.ps1 -Publish
#
# Password: prompted securely, or set $env:CSC_KEY_PASSWORD before running.

param(
  [switch]$Publish,
  [string]$PfxPath = "",
  [string]$Password = ""
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $PfxPath) {
  $PfxPath = Join-Path $projectRoot "certs\care-meet-companion-selfsign.pfx"
}
$PfxPath = (Resolve-Path -LiteralPath $PfxPath).Path

if (-not (Test-Path $PfxPath)) {
  Write-Host "PFX not found: $PfxPath" -ForegroundColor Red
  Write-Host "Create it first:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/create-selfsign-cert.ps1"
  exit 1
}

if ($Password) {
  $pfxPassword = $Password
} elseif ($env:CSC_KEY_PASSWORD) {
  $pfxPassword = $env:CSC_KEY_PASSWORD
} else {
  $secure = Read-Host "PFX password" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $pfxPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

$env:CSC_LINK = $PfxPath
$env:CSC_KEY_PASSWORD = $pfxPassword

Set-Location $projectRoot

$npmScript = if ($Publish) { "package:publish" } else { "package" }

Write-Host ""
Write-Host "Signing with: $PfxPath"
Write-Host "Running: npm run $npmScript"
Write-Host ""

npm run $npmScript
exit $LASTEXITCODE
