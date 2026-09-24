# ============================================================================
#  service.ps1 - Quan ly che do CHAY NEN + TU KHOI DONG CUNG WINDOWS cho server He thong bat so
#  (MUC 115). Duoc goi tu cac file .bat o thu muc goc:
#     install-autostart.bat   -> -Action install    (dang ky + chay ngay)
#     uninstall-autostart.bat -> -Action uninstall  (dung + go dang ky)
#     stop-server.bat         -> -Action stop
#     status-server.bat       -> -Action status
#     start-server.bat        -> -Action ping       (kiem tra da co server chay chua)
#
#  Co che: 1 tac vu Task Scheduler "HeThongBatSo_AutoStart" chay LUC WINDOWS KHOI DONG bang tai
#  khoan SYSTEM (khong can ai dang nhap, khong hien cua so), goi tools\run-service.bat - file nay
#  chay node src\server.js, ghi log vao logs\server.log va TU CHAY LAI neu server bi tat/loi.
#  Tac vu tao bang file XML (schtasks /xml) de dat duoc: khong gioi han thoi gian chay (mac dinh
#  Windows tu dung sau 72 gio), van chay khi may dung pin, chay bu neu lo lich.
#  Tuong thich PowerShell 2.0 (Windows 7) tro len. Chi dung ky tu ASCII (tranh loi ma hoa).
# ============================================================================
param(
  [ValidateSet('install', 'uninstall', 'stop', 'status', 'ping')]
  [string]$Action = 'status'
)

# 'Continue' (khong phai 'Stop'): PowerShell 5.1 bien moi dong stderr cua lenh ngoai (schtasks...)
# thanh loi nghiem trong khi de 'Stop' - tu kiem tra $LASTEXITCODE thay vao do.
$ErrorActionPreference = 'Continue'
$TaskName = 'HeThongBatSo_AutoStart'
$ToolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$Root = Split-Path -Parent $ToolsDir
$ServerJs = Join-Path $Root 'src\server.js'
$Wrapper = Join-Path $ToolsDir 'run-service.bat'
$LogFile = Join-Path $Root 'logs\server.log'

function Say([string]$msg, [string]$color = 'Gray') { Write-Host $msg -ForegroundColor $color }

function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-Port {
  $port = 4000
  $envFile = Join-Path $Root '.env'
  if (-not (Test-Path $envFile)) { $envFile = Join-Path $Root '.env.example' }
  if (Test-Path $envFile) {
    foreach ($line in (Get-Content $envFile)) {
      if ($line -match '^\s*PORT\s*=\s*(\d+)') { $port = [int]$Matches[1] }
    }
  }
  return $port
}

function Test-Health([int]$port) {
  try {
    $wc = New-Object Net.WebClient
    $txt = $wc.DownloadString("http://127.0.0.1:$port/api/health")
    return ($txt -match '"ok"\s*:\s*true')
  } catch { return $false }
}

function Get-NodeExe {
  $bundled = Join-Path $Root 'node\node.exe'
  if (Test-Path $bundled) { return $bundled }
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Definition }
  return $null
}

function Test-TaskExists {
  & schtasks.exe /query /tn $TaskName 2>$null | Out-Null
  return ($LASTEXITCODE -eq 0)
}

# Tien trinh cua DUNG ban cai dat nay: cmd.exe chay run-service.bat va node.exe chay src\server.js
# (so khop DUONG DAN DAY DU trong dong lenh - khong dung nham server/ung dung Node khac tren may).
function Get-ServerProcesses {
  $a = $ServerJs.ToLower()
  $b = $Wrapper.ToLower()
  $list = @()
  foreach ($p in (Get-WmiObject Win32_Process)) {
    if (-not $p.CommandLine) { continue }
    $c = $p.CommandLine.ToLower()
    if ($c.Contains($a) -or $c.Contains($b)) { $list += $p }
  }
  return $list
}

function Stop-Server {
  if (Test-TaskExists) { & schtasks.exe /end /tn $TaskName 2>$null | Out-Null }
  # Dung cmd.exe (vong lap tu chay lai) TRUOC, roi moi dung node.exe - tranh bi tu chay lai
  $procs = Get-ServerProcesses
  $wrappers = @($procs | Where-Object { $_.Name -ieq 'cmd.exe' })
  $nodes = @($procs | Where-Object { $_.Name -ine 'cmd.exe' })
  foreach ($p in ($wrappers + $nodes)) {
    try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch { }
  }
  return ($wrappers.Count + $nodes.Count)
}

function Require-Admin {
  if (-not (Test-Admin)) {
    Say 'LOI: Can chay voi quyen Quan tri vien (Run as administrator).' Red
    exit 2
  }
}

function Esc([string]$s) { return [Security.SecurityElement]::Escape($s) }

switch ($Action) {
  'ping' {
    if (Test-Health (Get-Port)) { exit 0 } else { exit 1 }
  }

  'status' {
    $port = Get-Port
    Say '=== Trang thai server He thong bat so ==='
    Say ("Thu muc cai dat : " + $Root)
    if (Test-TaskExists) { Say 'Tu khoi dong    : DA BAT (Task Scheduler: HeThongBatSo_AutoStart)' Green }
    else { Say 'Tu khoi dong    : CHUA BAT - chay install-autostart.bat de bat' Yellow }
    if (Test-Health $port) { Say ("Server          : DANG CHAY - http://localhost:" + $port) Green }
    else { Say ("Server          : KHONG phan hoi o cong " + $port + " - xem logs\server.log") Red }
    if (Test-Path $LogFile) {
      Say ''
      Say '--- 15 dong log gan nhat (logs\server.log) ---'
      Get-Content $LogFile | Select-Object -Last 15 | ForEach-Object { Say $_ }
    }
    exit 0
  }

  'stop' {
    Require-Admin
    $n = Stop-Server
    if ($n -gt 0) { Say ("Da dung server (" + $n + " tien trinh).") Green }
    else { Say 'Khong thay server nao cua thu muc nay dang chay.' Yellow }
    if (Test-TaskExists) { Say 'Luu y: tu khoi dong van BAT - khoi dong lai may server se tu chay lai.' Yellow }
    exit 0
  }

  'uninstall' {
    Require-Admin
    $n = Stop-Server
    if (Test-TaskExists) {
      & schtasks.exe /delete /tn $TaskName /f | Out-Null
      Say 'Da TAT tu khoi dong cung Windows.' Green
    } else {
      Say 'Tu khoi dong chua tung duoc bat.' Yellow
    }
    if ($n -gt 0) { Say ("Da dung server dang chay (" + $n + " tien trinh).") Green }
    exit 0
  }

  'install' {
    Require-Admin
    $node = Get-NodeExe
    if (-not $node) {
      Say 'LOI: Khong tim thay Node.js (thieu thu muc node\ trong goi va may chua cai Node.js >= 22.5).' Red
      exit 1
    }
    $ver = (& $node -p 'process.versions.node').Trim()
    $parts = $ver.Split('.')
    if (([int]$parts[0] -lt 22) -or (([int]$parts[0] -eq 22) -and ([int]$parts[1] -lt 5))) {
      Say ("LOI: Node.js " + $ver + " qua cu, can >= 22.5.") Red
      exit 1
    }
    Say ("Node.js         : " + $node + " (v" + $ver + ")")

    # Duong dan node tuyet doi cho tai khoan SYSTEM (PATH cua SYSTEM co the khong co node cai rieng)
    $nodePathCmd = Join-Path $ToolsDir 'node-path.cmd'
    Set-Content -Path $nodePathCmd -Value ('@set "NODE_BIN=' + $node + '"') -Encoding ASCII

    # .env + thu muc logs + quyen ghi cho nhom Users (SID S-1-5-32-545, khong phu thuoc ngon ngu
    # Windows): server chay bang SYSTEM tao file CSDL/log, sau nay chay tay bang tai khoan thuong
    # (start-server.bat) van ghi duoc.
    $envFile = Join-Path $Root '.env'
    $envExample = Join-Path $Root '.env.example'
    if ((-not (Test-Path $envFile)) -and (Test-Path $envExample)) {
      Copy-Item $envExample $envFile
      Say 'Da tao .env tu .env.example - nho doi STAFF_PASSWORD, ten don vi trong .env' Yellow
    }
    $logs = Join-Path $Root 'logs'
    if (-not (Test-Path $logs)) { New-Item -ItemType Directory -Path $logs | Out-Null }
    & icacls.exe $Root /grant '*S-1-5-32-545:(OI)(CI)M' /T /Q | Out-Null

    # Dung ban dang chay (chay tay hoac ban cu) truoc - tranh 2 server tranh nhau cong (server se
    # tu nhay sang cong PORT+1 lam lech dia chi cac man hinh da cai).
    $n = Stop-Server
    if ($n -gt 0) { Say ("Da dung server dang chay truoc do (" + $n + " tien trinh).") }

    $xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>He thong bat so - tu khoi dong server cung Windows (chay nen, khong can dang nhap)</Description>
  </RegistrationInfo>
  <Triggers>
    <BootTrigger>
      <Enabled>true</Enabled>
      <Delay>PT20S</Delay>
    </BootTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>S-1-5-18</UserId>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>5</Priority>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>999</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>$(Esc $env:ComSpec)</Command>
      <Arguments>/c ""$(Esc $Wrapper)""</Arguments>
      <WorkingDirectory>$(Esc $Root)</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@
    $xmlFile = Join-Path $env:TEMP 'HeThongBatSo_AutoStart.xml'
    Set-Content -Path $xmlFile -Value $xml -Encoding Unicode
    & schtasks.exe /create /tn $TaskName /xml $xmlFile /f | Out-Null
    $rc = $LASTEXITCODE
    Remove-Item $xmlFile -ErrorAction SilentlyContinue
    if ($rc -ne 0) {
      Say 'LOI: Khong tao duoc tac vu Task Scheduler (schtasks /create that bai).' Red
      exit 1
    }
    Say 'Da BAT tu khoi dong cung Windows (chay nen bang tai khoan SYSTEM, khong can dang nhap).' Green

    & schtasks.exe /run /tn $TaskName | Out-Null
    $port = Get-Port
    Say ("Dang khoi dong server, cho phan hoi o cong " + $port + "...")
    $ok = $false
    for ($i = 0; $i -lt 30; $i++) {
      Start-Sleep -Seconds 1
      if (Test-Health $port) { $ok = $true; break }
    }
    if ($ok) {
      Say ("SERVER DANG CHAY NEN: http://localhost:" + $port) Green
    } else {
      Say ("Chua thay server phan hoi o cong " + $port + " sau 30 giay - xem logs\server.log") Yellow
    }
    exit 0
  }
}
