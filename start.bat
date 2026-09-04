@echo off
setlocal enabledelayedexpansion
title ClaiserBank - PWA Data Entry AI
cls

:: Posizionati nella directory corrente dello script
cd /d "%~dp0"

echo ============================================================
echo   CLAISERBANK - AGENTE DI DATA ENTRY CONTABILE (PWA)
echo ============================================================
echo.

set "NODE_CMD="

:: 1. Verifica agy-node (Antigravity Environment)
if exist "%APPDATA%\Antigravity\bin\agy-node.cmd" (
    set "NODE_CMD=%APPDATA%\Antigravity\bin\agy-node.cmd"
    goto :RUN_SERVER
)
if exist "%USERPROFILE%\AppData\Roaming\Antigravity\bin\agy-node.cmd" (
    set "NODE_CMD=%USERPROFILE%\AppData\Roaming\Antigravity\bin\agy-node.cmd"
    goto :RUN_SERVER
)

:: 2. Verifica se node e presente nel PATH
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "NODE_CMD=node"
    goto :RUN_SERVER
)

:: 3. Verifica percorsi standard di installazione di Node.js
if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_CMD=C:\Program Files\nodejs\node.exe"
    goto :RUN_SERVER
)
if exist "C:\Program Files (x86)\nodejs\node.exe" (
    set "NODE_CMD=C:\Program Files (x86)\nodejs\node.exe"
    goto :RUN_SERVER
)
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    set "NODE_CMD=%LOCALAPPDATA%\Programs\nodejs\node.exe"
    goto :RUN_SERVER
)
if exist "%APPDATA%\npm\node.exe" (
    set "NODE_CMD=%APPDATA%\npm\node.exe"
    goto :RUN_SERVER
)

:: 4. Fallback: Esegui direttamente con runtime Antigravity
if exist "%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe" (
    set "ELECTRON_RUN_AS_NODE=1"
    set "NODE_CMD=%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe"
    goto :RUN_SERVER
)

:: Errore se nessun runtime e stato trovato
echo [ERRORE] Impossibile trovare Node.js o l'ambiente Antigravity.
echo Installa Node.js da https://nodejs.org/ e riprova.
echo.
pause
exit /b 1

:RUN_SERVER
echo [OK] Runtime JavaScript rilevato: "%NODE_CMD%"
echo.

:: Verifica esistenza file .env
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [INFO] Creato file .env a partire da .env.example
    )
)

echo [INFO] Avvio del server ClaiserBank su http://localhost:3000...
echo [INFO] Apertura automatica nel browser...
echo.

:: Apri il browser
start "" "http://localhost:3000"

:: Avvia il server
call "%NODE_CMD%" server.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [AVVISO] Il server e stato terminato con codice %ERRORLEVEL%.
    pause
)
