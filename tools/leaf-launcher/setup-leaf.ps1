# setup-leaf.ps1 - Compiles LeafLauncher and registers it as the default .md viewer for Herdr

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BinDir = Join-Path $HOME "bin"
$SourceFile = Join-Path $ScriptDir "LeafLauncher.cs"
$TargetExe = Join-Path $BinDir "LeafLauncher.exe"

Write-Host "=== Setting up Leaf Markdown Viewer for Herdr ===" -ForegroundColor Cyan

# 1. Ensure target bin directory exists
if (-not (Test-Path $BinDir)) {
    Write-Host "[1/5] Creating user bin directory at $BinDir..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
} else {
    Write-Host "[1/5] User bin directory exists ($BinDir)." -ForegroundColor Green
}

# 2. Compile LeafLauncher.cs
Write-Host "[2/5] Compiling LeafLauncher.cs..." -ForegroundColor Yellow
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) {
    $cscCmd = Get-Command csc.exe -ErrorAction SilentlyContinue
    if ($cscCmd) { $csc = $cscCmd.Source }
}
if (-not $csc -or -not (Test-Path $csc)) {
    throw "C# compiler (csc.exe) not found at standard .NET Framework path or in PATH."
}

& $csc /target:winexe /out:"$TargetExe" "$SourceFile"
if ($LASTEXITCODE -ne 0) {
    throw "Compilation failed with exit code $LASTEXITCODE."
}
Write-Host "      Successfully built: $TargetExe" -ForegroundColor Green

# 3. Register .md file association in HKCU
Write-Host "[3/5] Registering .md file association in HKCU..." -ForegroundColor Yellow
$extPath = "HKCU:\Software\Classes\.md"
$progPath = "HKCU:\Software\Classes\Leaf.md\shell\open\command"

if (-not (Test-Path $extPath)) { New-Item -Path $extPath -Force | Out-Null }
Set-ItemProperty -Path $extPath -Name "(default)" -Value "Leaf.md"

if (-not (Test-Path $progPath)) { New-Item -Path $progPath -Force | Out-Null }
$cmdValue = "`"$TargetExe`" `"%1`""
Set-ItemProperty -Path $progPath -Name "(default)" -Value $cmdValue

Write-Host "      Registered .md -> Leaf.md -> $cmdValue" -ForegroundColor Green

# 4. Check for leaf binary
Write-Host "[4/5] Checking for leaf viewer binary..." -ForegroundColor Yellow
$leafWindows = $null
$leafCmd = Get-Command leaf.exe -ErrorAction SilentlyContinue
if ($leafCmd) {
    $leafWindows = $leafCmd.Source
} else {
    $appDataLeaf = Join-Path $env:LOCALAPPDATA "Programs\leaf\leaf.exe"
    if (Test-Path $appDataLeaf) { $leafWindows = $appDataLeaf }
}

if ($leafWindows) {
    Write-Host "      Windows leaf: Found at $leafWindows" -ForegroundColor Green
} else {
    Write-Host "      Windows leaf: Not found in PATH or AppData. Install via 'cargo install leaf' or place leaf.exe in $BinDir." -ForegroundColor DarkYellow
}

# 5. Check WSL integration
Write-Host "[5/5] Checking WSL integration..." -ForegroundColor Yellow
$rawDistros = (wsl.exe -l -q 2>$null) -replace "`0", ""
$wslDistro = $null
if ($rawDistros) {
    $lines = $rawDistros -split "\r?\n" | Where-Object { $_.Trim() -and $_ -notmatch "docker" }
    if ($lines) {
        $wslDistro = ($lines | Select-Object -First 1).Trim()
    }
}

if ($wslDistro) {
    Write-Host "      Detected WSL distro: $wslDistro" -ForegroundColor Gray
    
    # Check if leaf is installed in WSL
    $wslLeaf = wsl.exe -d $wslDistro -e which leaf 2>$null
    if ($wslLeaf) {
        Write-Host "      WSL leaf: Found at $wslLeaf" -ForegroundColor Green
    } else {
        Write-Host "      WSL leaf: Not found in WSL. Install in WSL with 'cargo install leaf' or place in /usr/local/bin/leaf." -ForegroundColor DarkYellow
    }

    # Check C:\home symlink
    if (-not (Test-Path "C:\home")) {
        Write-Host "      Note: To enable direct C:\home path resolution for WSL, run PowerShell as Administrator:" -ForegroundColor DarkYellow
        Write-Host "            New-Item -ItemType SymbolicLink -Path 'C:\home' -Target '\\wsl.localhost\$wslDistro\home'" -ForegroundColor DarkYellow
    } else {
        Write-Host "      C:\home symlink is active." -ForegroundColor Green
    }
} else {
    Write-Host "      No WSL installation detected (skipping WSL checks)." -ForegroundColor Gray
}

Write-Host "`n=== Setup Complete! Clicking .md links in Herdr will now open in Leaf ===" -ForegroundColor Cyan
