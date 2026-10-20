@echo off
cd /d "%~dp0"
title WoW Companion Bridge
echo ===================================================
echo    Iniciando WoW Companion Bridge (Windows)
echo ===================================================

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Python nao foi encontrado no PATH do sistema.
    echo Instala o Python 3.10 ou superior a partir de https://www.python.org/
    echo Certifica-te de ativar a opcao "Add Python to PATH" durante a instalacao.
    pause
    exit /b 1
)

if not exist .venv (
    echo [SETUP] A criar ambiente virtual Python...
    python -m venv .venv
    call .venv\Scripts\activate.bat
    echo [SETUP] A instalar bibliotecas necessarias...
    python -m pip install --upgrade pip
    pip install -r requirements.txt
) else (
    call .venv\Scripts\activate.bat
)

echo [OK] A ligar ao servidor Companion (192.168.1.108:3300)...
python bridge.py %*
if %errorlevel% neq 0 (
    echo [AVISO] Bridge terminado com codigo de erro.
    pause
)
