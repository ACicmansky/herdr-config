@echo off
echo Starting OpenSSH installation for Herdr Android connection...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"\"%~dp0setup-ssh.ps1\"\"' -Wait"
echo Installation finished!
pause
