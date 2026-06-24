# Creates a self-signed Windows code-signing certificate for internal CARE builds.
# IT should deploy the exported .cer to Trusted Publishers on staff machines (GPO/Intune).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/create-selfsign-cert.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/create-selfsign-cert.ps1 -Password "your-export-password"

param(
  [string]$Subject = "CN=CARE Meet Companion, O=CARE Helps Society",
  [int]$YearsValid = 3,
  [string]$OutDir = "",
  [string]$Password = ""
)

$ErrorActionPreference = "Stop"

if (-not $OutDir) {
  $OutDir = Join-Path (Join-Path $PSScriptRoot "..") "certs"
}

if (-not $Password) {
  $secure = Read-Host "PFX export password" -AsSecureString
} else {
  $secure = ConvertTo-SecureString $Password -AsPlainText -Force
}

$resolvedOut = Resolve-Path -LiteralPath (New-Item -ItemType Directory -Force -Path $OutDir) | Select-Object -ExpandProperty Path
$pfxPath = Join-Path $resolvedOut "care-meet-companion-selfsign.pfx"
$cerPath = Join-Path $resolvedOut "care-meet-companion-selfsign.cer"

if (Test-Path $pfxPath) {
  throw "Already exists: $pfxPath - delete it first or choose another folder."
}

$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject $Subject `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -KeyExportPolicy Exportable `
  -KeySpec Signature `
  -KeyLength 2048 `
  -HashAlgorithm SHA256 `
  -NotAfter (Get-Date).AddYears($YearsValid)

Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $secure | Out-Null
Export-Certificate -Cert $cert -FilePath $cerPath -Type CERT | Out-Null

Write-Host ""
Write-Host "Created self-signed code signing certificate:"
Write-Host "  PFX (keep secret): $pfxPath"
Write-Host "  CER (give to IT):  $cerPath"
Write-Host "  Thumbprint:        $($cert.Thumbprint)"
Write-Host ""
Write-Host "Local signed build:"
Write-Host ('  $env:CSC_LINK = "' + $pfxPath + '"')
Write-Host '  $env:CSC_KEY_PASSWORD = "<your-export-password>"'
Write-Host "  npm run package"
Write-Host ""
Write-Host "GitHub Actions WIN_CSC_LINK (base64 PFX):"
Write-Host "  [Convert]::ToBase64String([IO.File]::ReadAllBytes('$pfxPath')) | Set-Clipboard"
Write-Host ""
Write-Host "IT: deploy $cerPath to Trusted Publishers on staff PCs before they run the installer."
