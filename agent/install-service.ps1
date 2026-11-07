# Installs the Print Anywhere agent as a Windows service that starts on boot.
# Run in an *Administrator* PowerShell from this folder:
#   powershell -ExecutionPolicy Bypass -File .\install-service.ps1
# Requires NSSM (https://nssm.cc) — e.g. `winget install nssm` — and Node.js 20+.

param(
  [string]$ServiceName = "PrintAnywhereAgent",
  [string]$Nssm = "nssm"
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = (Get-Command node -ErrorAction Stop).Source
$config = Join-Path $here "agent.config.json"

if (-not (Test-Path $config)) {
  throw "agent.config.json not found. Copy agent.config.example.json to agent.config.json and fill it in first."
}

New-Item -ItemType Directory -Force -Path (Join-Path $here "logs") | Out-Null

& $Nssm install $ServiceName $node (Join-Path $here "agent.mjs")
& $Nssm set $ServiceName AppDirectory $here
& $Nssm set $ServiceName DisplayName "Print Anywhere Agent"
& $Nssm set $ServiceName Description "Prints paid Print Anywhere orders automatically."
& $Nssm set $ServiceName Start SERVICE_AUTO_START
& $Nssm set $ServiceName AppStdout (Join-Path $here "logs\agent.log")
& $Nssm set $ServiceName AppStderr (Join-Path $here "logs\agent.log")
& $Nssm set $ServiceName AppRotateFiles 1
& $Nssm set $ServiceName AppRotateBytes 5000000
& $Nssm set $ServiceName AppExit Default Restart

Write-Host ""
Write-Host "IMPORTANT: services run as LocalSystem by default, which may not see printers that were"
Write-Host "added for a specific Windows user. If the log says 'printer not found', run:"
Write-Host "  nssm set $ServiceName ObjectName .\<WindowsUser> <password>"
Write-Host ""

& $Nssm start $ServiceName
Write-Host "Started. Logs: $here\logs\agent.log"
