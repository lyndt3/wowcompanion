#!/bin/bash
cd "$(dirname "$0")"
echo "==============================================="
echo "   Iniciando WoW Companion Bridge no Mac..."
echo "==============================================="

if [ ! -d ".venv" ]; then
    echo "[SETUP] Criando ambiente virtual..."
    python3 -m venv .venv
    ./.venv/bin/pip install --upgrade pip
    ./.venv/bin/pip install -r requirements.txt
fi

./.venv/bin/python3 bridge.py "$@"
