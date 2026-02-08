# Refresh PATH so npm is found (e.g. after installing Node)
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

Set-Location $PSScriptRoot\..

Write-Host "Starting API and frontend..." -ForegroundColor Cyan
& npm run dev:all
