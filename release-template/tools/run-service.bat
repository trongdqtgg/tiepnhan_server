@echo off
rem ==========================================================================
rem  run-service.bat - chay server NEN (goi boi tac vu Task Scheduler HeThongBatSo_AutoStart,
rem  tai khoan SYSTEM, khong co cua so). Ghi log vao logs\server.log (tu xoay vong khi > 5 MB)
rem  va TU CHAY LAI sau 10 giay neu server bi tat/loi. Dung han: stop-server.bat.
rem  KHONG chay tay file nay - dung start-server.bat (co cua so) hoac install-autostart.bat.
rem  Luu y cu phap: bien duong dan chi dung NGOAI khoi ( ) - thu muc co dau ngoac nhu
rem  "Program Files (x86)" khong lam hong lenh (xem README muc 35).
rem ==========================================================================
setlocal EnableExtensions
set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
cd /d "%ROOT%"

if not exist "logs" mkdir "logs"
if not exist ".env" if exist ".env.example" copy /y ".env.example" ".env" >nul

set "NODE_BIN=node"
if exist "%ROOT%\tools\node-path.cmd" call "%ROOT%\tools\node-path.cmd"
if exist "%ROOT%\node\node.exe" set "NODE_BIN=%ROOT%\node\node.exe"

:loop
if exist "logs\server.log" for %%A in ("logs\server.log") do if %%~zA GTR 5242880 move /y "logs\server.log" "logs\server.old.log" >nul
>>"logs\server.log" echo [%date% %time%] ===== Khoi dong server =====
"%NODE_BIN%" "%ROOT%\src\server.js" >>"logs\server.log" 2>&1
>>"logs\server.log" echo [%date% %time%] Server da dung - ma %errorlevel%. Tu khoi dong lai sau 10 giay...
rem ping thay cho timeout: timeout loi ngay lap tuc khi khong co cua so console - tac vu nen
ping -n 11 127.0.0.1 >nul
goto loop
