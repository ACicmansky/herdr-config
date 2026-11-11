Start-Transcript -Path "C:\Users\Andrej\.config\herdr-app\setup-ssh.log" -Append

Write-Host "Installing OpenSSH Server Windows Capability..." -ForegroundColor Cyan
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0

Write-Host "Configuring sshd and ssh-agent services..." -ForegroundColor Cyan
Set-Service -Name sshd -StartupType Automatic
Start-Service sshd
Set-Service -Name "ssh-agent" -StartupType Automatic
Start-Service "ssh-agent"

Write-Host "Configuring Firewall..." -ForegroundColor Cyan
if (-not (Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22
}

Write-Host "Ensuring hc is accessible system-wide..." -ForegroundColor Cyan
$hcSrc = "C:\Users\Andrej\AppData\Local\Programs\herdr-core\hc.exe"
if (Test-Path $hcSrc) {
    Copy-Item -Path $hcSrc -Destination "C:\Windows\System32\hc.exe" -Force
}
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$hcDir = "C:\Users\Andrej\AppData\Local\Programs\herdr-core"
if ($machinePath -notlike "*$hcDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$machinePath;$hcDir", "Machine")
}

Write-Host "Configuring sshd_config..." -ForegroundColor Cyan
$sshdConfig = "$env:ProgramData\ssh\sshd_config"
if (Test-Path $sshdConfig) {
    $content = Get-Content $sshdConfig -Raw
    $content = $content -replace '(?m)^(Match Group administrators)', '#$1'
    $content = $content -replace '(?m)^(\s*AuthorizedKeysFile __PROGRAMDATA__/ssh/administrators_authorized_keys)', '#$1'
    if ($content -match '(?m)^#?PasswordAuthentication') {
        $content = $content -replace '(?m)^#?PasswordAuthentication\s+\w+', 'PasswordAuthentication yes'
    } else {
        $content += "`nPasswordAuthentication yes`n"
    }
    Set-Content -Path $sshdConfig -Value $content -Force
    Restart-Service sshd
}

Write-Host "OpenSSH Server setup complete!" -ForegroundColor Green
Stop-Transcript
