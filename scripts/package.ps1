#requires -Version 5.1
<#
.SYNOPSIS
  CmdWindows Windows one-click packaging tool
.EXAMPLE
  .\scripts\package.ps1                 # Full flow: typecheck + build + package
  .\scripts\package.ps1 -SkipTypeCheck  # Skip typecheck, fast package
  .\scripts\package.ps1 -Arch x64       # Target arch (default x64)
#>
param(
    [string]$Arch = "x64",
    [switch]$SkipTypeCheck
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

# GitHub 不可达时，从 npmmirror 镜像下载 electron-builder 工具集（nsis / winCodeSign 等）
if (-not $env:ELECTRON_BUILDER_BINARIES_MIRROR) {
    $env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
}
# electron 本体下载走单独的镜像变量，否则会直连 GitHub 导致卡死
if (-not $env:ELECTRON_MIRROR) {
    $env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
}
# 直接用本地已安装的 electron dist，跳过下载并避免 "unpacking default Electron distribution" 卡点
if (-not $env:ELECTRON_OVERRIDE_DIST_PATH) {
    $env:ELECTRON_OVERRIDE_DIST_PATH = Join-Path $root "node_modules\electron\dist"
}

# Vite 7 要求 Node 20.19+/22.12+；本机若默认 Node 16 会让 electron-vite build 报 crypto.getRandomValues 错
$nodeVer = [version]((node -v) -replace '^v','')
if ($nodeVer -lt [version]"20.0.0") {
    Write-Host "当前 Node $(node -v)，低于 Vite 7 要求，尝试 nvm use 24 ..." -ForegroundColor Yellow
    nvm use 24 2>$null | Out-Null
    Write-Host "切换后 Node: $(node -v)"
}

function Step($msg) { Write-Host "`n==== $msg ====" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host $msg -ForegroundColor Green }

Push-Location $root
try {
    Step "1/3 Typecheck"
    if ($SkipTypeCheck) {
        Write-Host "Typecheck skipped"
    } else {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Build/typecheck failed" }
    }

    Step "2/3 Package (electron-builder --win --$Arch)"
    npx electron-vite build
    if ($LASTEXITCODE -ne 0) { throw "electron-vite build failed" }
    npx electron-builder --win --$Arch
    if ($LASTEXITCODE -ne 0) { throw "electron-builder failed" }

    Step "3/3 Artifacts (release/)"
    $artifacts = Get-ChildItem "$root\release" -File |
        Where-Object { $_.Extension -in ".exe", ".zip", ".blockmap" } |
        Sort-Object LastWriteTime
    if (-not $artifacts) { throw "No artifact found in release/" }
    $artifacts | ForEach-Object {
        Ok ("{0,-40} {1,8:N1} MB   {2}" -f $_.Name, ($_.Length / 1MB), $_.LastWriteTime)
    }
    Ok "`nDone. Installer is in: $root\release"
}
finally {
    Pop-Location
}
