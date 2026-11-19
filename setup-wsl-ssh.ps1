# setup-wsl-ssh.ps1 - Exposes WSL SSH (port 2223) on Tailscale/LAN port 2222 via localhostForwarding
$ErrorActionPreference = "Stop"

Write-Host "Configuring portproxy 0.0.0.0:2222 -> 127.0.0.1:2223..." -ForegroundColor Cyan
netsh interface portproxy delete v4tov4 listenport=2222 listenaddress=0.0.0.0 2>$null | Out-Null
netsh interface portproxy add v4tov4 listenport=2222 listenaddress=0.0.0.0 connectport=2223 connectaddress=127.0.0.1

Write-Host "Configuring Windows Firewall rule for port 2222..." -ForegroundColor Cyan
if (-not (Get-NetFirewallRule -Name 'WSL-SSH-2222-In-TCP' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -Name 'WSL-SSH-2222-In-TCP' -DisplayName 'WSL SSH (2222)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 2222 | Out-Null
}

Write-Host "Done! WSL is now reachable via SSH on port 2222." -ForegroundColor Green
