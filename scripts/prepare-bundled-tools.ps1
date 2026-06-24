$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$binRoot = Join-Path $projectRoot "resources\bin"
$ffmpegDir = Join-Path $binRoot "ffmpeg"
$whisperDir = Join-Path $binRoot "whisper"
$modelDir = Join-Path $whisperDir "models"
$tempDir = Join-Path $projectRoot ".tool-cache"

New-Item -ItemType Directory -Force -Path $ffmpegDir, $whisperDir, $modelDir, $tempDir | Out-Null

function Download-File($Url, $Destination) {
  if (Test-Path $Destination) {
    return
  }
  Write-Host "Downloading $Url"
  Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing
}

$whisperVersion = "v1.8.7"
$whisperZip = Join-Path $tempDir "whisper-bin-x64.zip"
$whisperUrl = "https://github.com/ggml-org/whisper.cpp/releases/download/$whisperVersion/whisper-bin-x64.zip"
Download-File $whisperUrl $whisperZip

$whisperExtract = Join-Path $tempDir "whisper-bin"
if (-not (Test-Path $whisperExtract)) {
  Expand-Archive -Path $whisperZip -DestinationPath $whisperExtract -Force
}

$whisperRelease = Get-ChildItem -Path $whisperExtract -Recurse -Directory -Filter "Release" | Select-Object -First 1
if (-not $whisperRelease) {
  throw "Could not find whisper Release folder in $whisperExtract"
}

$whisperArtifacts = @(
  "whisper-cli.exe",
  "whisper.dll",
  "ggml.dll",
  "ggml-base.dll",
  "ggml-cpu.dll"
)

foreach ($name in $whisperArtifacts) {
  $source = Join-Path $whisperRelease.FullName $name
  if (-not (Test-Path $source)) {
    throw "Missing whisper artifact: $name"
  }
  Copy-Item $source -Destination (Join-Path $whisperDir $name) -Force
}

$ffmpegZip = Join-Path $tempDir "ffmpeg-essentials.zip"
$ffmpegUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
Download-File $ffmpegUrl $ffmpegZip

$ffmpegExtract = Join-Path $tempDir "ffmpeg"
if (-not (Test-Path $ffmpegExtract)) {
  Expand-Archive -Path $ffmpegZip -DestinationPath $ffmpegExtract -Force
}

Get-ChildItem -Path $ffmpegExtract -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1 | ForEach-Object {
  Copy-Item $_.FullName -Destination (Join-Path $ffmpegDir "ffmpeg.exe") -Force
}

$modelPath = Join-Path $modelDir "ggml-base.en.bin"
$modelUrl = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"
Download-File $modelUrl $modelPath

if (-not (Test-Path (Join-Path $ffmpegDir "ffmpeg.exe"))) {
  throw "ffmpeg.exe was not prepared."
}

$whisperExe = Join-Path $whisperDir "whisper-cli.exe"
if (-not (Test-Path $whisperExe)) {
  throw "whisper-cli.exe was not prepared."
}

if (-not (Test-Path $modelPath)) {
  throw "Whisper model was not prepared."
}

Write-Host "Bundled tools ready:"
Write-Host "  FFmpeg: $(Join-Path $ffmpegDir 'ffmpeg.exe')"
Write-Host "  Whisper: $whisperExe"
Write-Host "  Model: $modelPath"
