@echo off
rem Khoi dong server He thong bat so (file nay nam trong goi phat hanh GitHub Release)
setlocal
cd /d "%~dp0"

if not exist ".env" (
  if exist ".env.example" (
    copy /y ".env.example" ".env" >nul
    echo Da tao file .env tu .env.example - hay mo .env de doi mat khau STAFF_PASSWORD, ten don vi...
    echo.
  )
)

set "NODE_BIN=node"
if exist "%~dp0node\node.exe" set "NODE_BIN=%~dp0node\node.exe"
"%NODE_BIN%" -v >nul 2>nul || (
  echo [LOI] Khong tim thay Node.js. Cai Node.js ^>= 22.5 hoac dung goi co kem thu muc node\
  pause
  exit /b 1
)

"%NODE_BIN%" src\server.js
echo.
echo Server da dung.
pause
