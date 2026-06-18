@echo off
setlocal enabledelayedexpansion

echo ===========================================
echo   MapAI Server Launcher
echo ===========================================
echo.

:: ─── Detectar puerto desde .env ───
set "PORT=4560"
if exist .env (
    for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
        if /i "%%a"=="PORT" set "PORT=%%b"
    )
)
echo [INFO] Puerto configurado: %PORT%
echo.

:: ─────────────────────────────────────────
::  FASE 1 — Matar proceso en el puerto
:: ─────────────────────────────────────────
echo [1/3] Buscando procesos escuchando en puerto %PORT%...
set "PORT_CLEARED=0"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
    if not "%%a"=="0" (
        taskkill /F /PID %%a >nul 2>&1
        if !errorlevel! equ 0 (
            echo   [KILL] PID %%a — puerto %PORT% liberado
            set "PORT_CLEARED=1"
        ) else (
            echo   [WARN] No se pudo matar PID %%a
        )
    )
)
if "%PORT_CLEARED%"=="0" echo   [OK] No habia procesos en puerto %PORT%

:: ─────────────────────────────────────────
::  FASE 2 — Matar procesos Node.js zombis
:: ─────────────────────────────────────────
echo [2/3] Buscando procesos Node.js zombi de mapai...

set "KILLED_COUNT=0"

:: 2a — Matar node.exe por coincidencia en commandline (server.js)
for /f %%a in ('powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter """name='node.exe'""" ^| Where-Object { $_.CommandLine -like '*server.js*' } ^| Select-Object -ExpandProperty ProcessId" 2^>nul') do (
    set "PID=%%a"
    if not "!PID!"=="" (
        taskkill /F /PID !PID! >nul 2>&1
        if !errorlevel! equ 0 (
            echo   [KILL] Node zombie PID !PID! (server.js)
            set /a KILLED_COUNT+=1
        )
    )
)

:: 2b — Matar node.exe por path del proyecto (por si cambio el nombre del script)
for /f %%a in ('powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter """name='node.exe'""" ^| Where-Object { $_.CommandLine -like '*%CD:\=\\%*' } ^| Select-Object -ExpandProperty ProcessId" 2^>nul') do (
    set "PID=%%a"
    if not "!PID!"=="" (
        taskkill /F /PID !PID! >nul 2>&1
        if !errorlevel! equ 0 (
            echo   [KILL] Node zombie PID !PID! (%CD%)
            set /a KILLED_COUNT+=1
        )
    )
)

if "%KILLED_COUNT%"=="0" echo   [OK] No habia procesos Node zombi

:: ─────────────────────────────────────────
::  FASE 3 — Esperar y arrancar
:: ─────────────────────────────────────────
echo [3/3] Esperando liberacion de recursos...
timeout /t 2 /nobreak >nul

echo.
echo ===========================================
echo   Iniciando MapAI Server en puerto %PORT%...
echo ===========================================
echo.

node server.js

if errorlevel 1 (
    echo.
    echo [ERROR] El servidor fallo al iniciar.
    pause
)
