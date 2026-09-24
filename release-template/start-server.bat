@echo off
rem ==========================================================================
rem  start-server.bat - chay server CO CUA SO (xem loi truc tiep). Dung de chan doan.
rem  Dung hang ngay: chay install-autostart.bat 1 lan - server tu chay nen cung Windows.
rem ==========================================================================
setlocal EnableExtensions
title He thong bat so - Server (dong cua so nay la server dung)
cd /d "%~dp0"
set "ROOT=%~dp0"

if not exist ".env" if exist ".env.example" copy /y ".env.example" ".env" >nul
if not exist ".env" goto :ENV_OK
echo Cau hinh: .env (doi mat khau STAFF_PASSWORD, ten don vi... trong file nay)
:ENV_OK

rem Da co server chay nen (tu khoi dong cung Windows) -> khong chay them ban thu 2 tranh nhau cong
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%tools\service.ps1" -Action ping >nul 2>&1
if errorlevel 1 goto :NOT_RUNNING
echo.
echo Server DANG CHAY NEN roi - khong can mo them. Xem trang thai: status-server.bat
echo Muon chay che do co cua so de xem loi: chay stop-server.bat truoc, roi mo lai file nay.
echo.
pause
exit /b 0
:NOT_RUNNING

set "NODE_BIN=node"
if exist "%ROOT%node\node.exe" set "NODE_BIN=%ROOT%node\node.exe"
"%NODE_BIN%" -v >nul 2>nul
if errorlevel 1 goto :NO_NODE

"%NODE_BIN%" "%ROOT%src\server.js"
echo.
echo Server da dung.
pause
exit /b 0

:NO_NODE
echo [LOI] Khong tim thay Node.js. Cai Node.js tu ban 22.5 tro len, hoac dung goi co kem thu muc node\
pause
exit /b 1
