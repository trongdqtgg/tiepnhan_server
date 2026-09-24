@echo off
rem Xem trang thai server: tu khoi dong da bat chua, server co dang chay khong, 15 dong log gan nhat.
rem Khong can quyen Quan tri vien.
setlocal EnableExtensions
title He thong bat so - Trang thai server
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\service.ps1" -Action status
echo.
pause
