@echo off
rem Tat tu khoi dong cung Windows - goi tools\service.ps1 -Action uninstall (tu xin quyen Quan tri vien neu can)
setlocal EnableExtensions
title He thong bat so - Tat tu khoi dong cung Windows
net session >nul 2>&1
if errorlevel 1 goto :ELEVATE
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\service.ps1" -Action uninstall
set "RC=%errorlevel%"
echo.
pause
exit /b %RC%

:ELEVATE
echo Can quyen Quan tri vien - dang mo lai voi quyen Administrator...
set "SELF_BAT=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath $env:SELF_BAT -Verb RunAs"
exit /b 0
