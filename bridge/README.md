# WoW Companion - Desktop Bridge

Este script liga o jogo (World of Warcraft) ao servidor do Companion a correr na rede local (`192.168.1.108:3300`) ou remotamente via Tailscale.

## 🚀 Como Iniciar

### No Windows:
- Basta dar duplo clique no ficheiro `start.bat`.
- O script cria automaticamente o ambiente virtual, instala as dependências (`requirements.txt`) e inicia a ponte.

### No Mac:
- Basta dar duplo clique no ficheiro `start.command`.
- (Ou abrir o Terminal e correr `./start.command`).

### Manualmente (Linha de Comandos):
1. Instala as dependências necessárias:
   ```bash
   pip install -r requirements.txt
   ```
2. Executa a ponte:
   ```bash
   python bridge.py
   ```

---

## ⚙️ Opções Avançadas

- **Servidor Remoto / Tailscale:**
  Se estiveres fora de casa via Tailscale:
  ```bash
  python bridge.py --server 100.121.114.9:3300
  ```

- **Múltiplos Monitores:**
  O Bridge deteta automaticamente o WoW em qualquer monitor. Se quiseres forçar um monitor específico:
  ```bash
  python bridge.py --monitor 2
  ```
