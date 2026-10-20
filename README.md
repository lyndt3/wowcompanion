# 🛡️ WoW Companion

> **Painel de Telemetria em Tempo Real, Rotação DPS ao Vivo, Assistente de Tank, Triage de Healer e Guias de Mítica+ para World of Warcraft (Midnight & Retail).**

O **WoW Companion** é um sistema completo de segundo ecrã (otimizado para iPad, tablets ou monitores secundários) que transmite dados do jogo a 30 FPS com zero latência, sem recorrer a APIs bloqueadas nem causar *taint* no cliente do jogo.

---

## 🏗️ Arquitetura do Sistema

O projeto é dividido em três módulos independentes e modulares:

```text
wowcompanion/
├── addon/                      # AddOn oficial para World of Warcraft
│   └── WoWCompanion/
│       ├── core.lua            # Telemetria 17 células, rotação DPS ao vivo, HUD de mitigação
│       └── WoWCompanion.toc    # Metadados do AddOn para WoW 12.x
├── bridge/                     # Ponte Desktop em Python (leitor de ecrã a 30 FPS)
│   ├── bridge.py               # Captura e descodificação ótica da barra de telemetria
│   ├── requirements.txt        # Dependências Python (mss, websockets, Pillow, requests)
│   ├── start.bat               # Lançador automático para Windows (criação de venv automática)
│   ├── start.command           # Lançador automático para macOS
│   └── README.md
├── public/                     # Frontend Web SPA (otimizado para iPad Pro / Air / Mobile)
│   ├── app.js                  # Motor reativo, WebSocket, sintetizador e decks de combate
│   ├── index.html              # Interface táti com HUD de Tank, DPS e Healer
│   ├── style.css               # Design moderno dark mode com suporte AMOLED
│   └── maps/                   # Mapas de alta resolução das zonas
├── src/                        # Dados estáticos e guias
│   └── data/
│       ├── tankGuides.json     # Guias táteis das 8 M+ da Season 2 e Raids de Midnight
│       └── spellIcons.json     # Cache oficial de ícones de feitiços do Wowhead
├── server.js                   # Servidor Node.js + WebSocket Hub + endpoints de download
├── package.json
├── Dockerfile                  # Containerização Docker
└── docker-compose.yml
```

---

## ⚡ Principais Funcionalidades

### 1. ⚔️ Rotação DPS ao Vivo
- Analisa a especialização atual (ex: Warrior Fury/Arms, Paladin Ret, etc.) e mostra no iPad o **próximo feitiço a lançar** e a **habilidade seguinte (+1)**.
- Deteção automática das teclas de atalho (*keybinds*) associadas a cada feitiço nas tuas barras de ação.
- Ícones de alta resolução e nomes oficiais obtidos diretamente da CDN do **Wowhead**.
- Destaque dinâmico de procs e fases de execução (*Execute Proc <20% HP*).

### 2. 🛡️ Assistente de Tank & Taunt Swap
- Indicador visual e alertas de **Ameaça / Agro** (Seguro, Instável, Agro no Healer/DPS).
- Monitorização de **Mitigação Ativa** (ex: *Shield Block*, *Ignore Pain*, *Ironfur*, *Bone Shield*).
- Deteção automática de **Taunt Swap**:
  - Lê os stacks de debuff do Co-Tank (marca como Foco ou deteta via Raid).
  - Alerta imediato quando o boss virar para um curador ou DPS.

### 3. 💚 HUD de Triage para Healers
- Identifica o aliado com menor vida na party e a respetiva faixa de perigo (*Bracket*).
- Deteção de **Dispel de Emergência** (Curse, Poison, Disease, Magic) com o nome do feitiço de cura.
- Alerta visual quando o Tank estiver abaixo de 40% de vida para uso de defensivo externo.

### 4. 🗺️ Guias Integrados de Mítica+ (Season 2 de Midnight)
Inclui táticas completas de Tank Buster, Taunts, interrupções e perigos para todas as **8 Míticas+ da Season 2**:
1. `[M+ S2] Altar of Fangs` (Midnight Patch 12.1)
2. `[M+ S2] Murder Row` (Silvermoon / Midnight)
3. `[M+ S2] Den of Nalorakk` (Midnight)
4. `[M+ S2] The Blinding Vale` (Midnight)
5. `[M+ S2] Voidscar Arena` (Midnight)
6. `[M+ S2] Kings' Rest` (Battle for Azeroth)
7. `[M+ S2] Temple of Sethraliss` (Battle for Azeroth)
8. `[M+ S2] Ruby Life Pools` (Dragonflight)

E para a nova raid:
* **`The Unbinding of Kith'ix` (Patch 12.1.5)**: Táticas completas para a Fase 1 (*Dark Devastation* e Barreira de Liadrin) e Fase 2 (*Mecânica de Negation & Null Gates*).

### 5. ⚙️ Janela de Definições Dentro do Jogo (In-Game)
- Digita **`/wc`** no chat para abrir a janela de definições nativa do WoW.
- Permite silenciar ou ativar a voz sintetizada, sons táteis e visibilidade da barra de telemetria.
- Comando rápido: **`/wc voice`** para silenciar a voz instantaneamente.
- Integração nas Opções do WoW: **ESC -> Opções -> AddOns -> WoW Companion**.

---

## 🚀 Como Executar

### 1. Servidor Web (Host / Docker / NAS)
```bash
docker compose up -d
```
O servidor ficará disponível em `http://<IP_DO_SERVIDOR>:3300`.

### 2. AddOn no World of Warcraft
Copia a pasta `addon/WoWCompanion` para a pasta de addons do WoW:
- **Windows:** `World of Warcraft\_retail_\Interface\AddOns\WoWCompanion`
- **macOS:** `/Applications/World of Warcraft/_retail_/Interface/AddOns/WoWCompanion`

Depois entra no jogo e faz `/reload`.

### 3. Desktop Bridge
- **No Windows:** Dá duplo clique no ficheiro `bridge/start.bat`.
- **No macOS:** Dá duplo clique no ficheiro `bridge/start.command`.
- **Manualmente:**
  ```bash
  cd bridge
  pip install -r requirements.txt
  python bridge.py --server <IP_DO_SERVIDOR>:3300
  ```

---

## 🔒 Segurança e Imunidade a Taint
O addon utiliza uma barra ótica de 17 células no canto superior esquerdo com quantização discreta de 4 níveis (0, 85, 170, 255) e tolerância a desvios cromáticos Display P3. Toda a recolha de unidades e papéis utiliza rotinas com provas dinâmicas em `pcall` (`SafeGetUnitRole`, `SafeGetPlayerRole`), garantindo que **valores secretos de segurança da Blizzard (Secret Values / Taint) nunca provocam erros de execução**.
