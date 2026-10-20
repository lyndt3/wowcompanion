const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const archiver = require('archiver');

const PORT = process.env.PORT || 3300;
const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Load initial data
const zonesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/zones.json'), 'utf8'));
const savedDataPath = path.join(__dirname, 'src/data/savedCharacterData.json');
let characterData;
if (fs.existsSync(savedDataPath)) {
  try {
    characterData = JSON.parse(fs.readFileSync(savedDataPath, 'utf8'));
    console.log('[INIT] Loaded persisted character data for', characterData?.character?.name);
  } catch(e) {
    characterData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/defaultData.json'), 'utf8'));
  }
} else {
  characterData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/defaultData.json'), 'utf8'));
}

// Tank Guides Data (Latest Patch Dungeons & Raids)
const tankGuidesPath = path.join(__dirname, 'src/data/tankGuides.json');
let tankGuidesData = { instances: [] };
if (fs.existsSync(tankGuidesPath)) {
  try {
    tankGuidesData = JSON.parse(fs.readFileSync(tankGuidesPath, 'utf8'));
    console.log('[INIT] Loaded tank guides for', tankGuidesData?.instances?.length, 'instances');
  } catch(e) {
    console.error('[ERROR] Failed to load tank guides:', e);
  }
}

// Item Icons Cache
const iconsPath = path.join(__dirname, 'src/data/itemIcons.json');
let itemIcons = {};
if (fs.existsSync(iconsPath)) {
  try { itemIcons = JSON.parse(fs.readFileSync(iconsPath, 'utf8')); } catch(e) {}
}

const https = require('https');

function fetchMissingIcon(itemId) {
  if (!itemId || itemIcons[String(itemId)]) return;
  const url = 'https://nether.wowhead.com/tooltip/item/' + itemId;
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      try {
        const d = JSON.parse(raw);
        if (d && d.icon) {
          itemIcons[String(itemId)] = d.icon;
          fs.writeFile(iconsPath, JSON.stringify(itemIcons, null, 2), () => {});
        }
      } catch(e) {}
    });
  }).on('error', () => {});
}

// Spell Icons Cache
const spellIconsPath = path.join(__dirname, 'src/data/spellIcons.json');
let spellIcons = {};
if (fs.existsSync(spellIconsPath)) {
  try { spellIcons = JSON.parse(fs.readFileSync(spellIconsPath, 'utf8')); } catch(e) {}
}

function fetchMissingSpellIcon(spellId) {
  if (!spellId || spellIcons[String(spellId)]) return;
  const url = 'https://nether.wowhead.com/tooltip/spell/' + spellId;
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      try {
        const d = JSON.parse(raw);
        if (d && d.icon) {
          spellIcons[String(spellId)] = { name: d.name || '', icon: d.icon };
          fs.writeFile(spellIconsPath, JSON.stringify(spellIcons, null, 2), () => {});
        }
      } catch(e) {}
    });
  }).on('error', () => {});
}

function enrichTelemetrySpells(data) {
  if (!data) return data;
  if (data.dps) {
    if (data.dps.nextSpellId) {
      const sp = spellIcons[String(data.dps.nextSpellId)];
      if (sp) {
        if (!data.dps.nextIcon || !isNaN(Number(data.dps.nextIcon))) data.dps.nextIcon = sp.icon;
        if (!data.dps.nextSpellName || data.dps.nextSpellName.startsWith('Habilidade #')) data.dps.nextSpellName = sp.name;
      } else {
        fetchMissingSpellIcon(data.dps.nextSpellId);
      }
    }
    if (data.dps.queueSpellId) {
      const sp = spellIcons[String(data.dps.queueSpellId)];
      if (sp) {
        if (!data.dps.queueIcon || !isNaN(Number(data.dps.queueIcon))) data.dps.queueIcon = sp.icon;
        if (!data.dps.queueSpellName || data.dps.queueSpellName.startsWith('Habilidade #')) data.dps.queueSpellName = sp.name;
      } else {
        fetchMissingSpellIcon(data.dps.queueSpellId);
      }
    }
  }
  if (data.healer) {
    if (data.healer.nextSpellId) {
      const sp = spellIcons[String(data.healer.nextSpellId)];
      if (sp) {
        if (!data.healer.nextIcon || !isNaN(Number(data.healer.nextIcon))) data.healer.nextIcon = sp.icon;
        if (!data.healer.nextSpellName || data.healer.nextSpellName.startsWith('Habilidade #')) data.healer.nextSpellName = sp.name;
      } else {
        fetchMissingSpellIcon(data.healer.nextSpellId);
      }
    }
    if (data.healer.queueSpellId) {
      const sp = spellIcons[String(data.healer.queueSpellId)];
      if (sp) {
        if (!data.healer.queueIcon || !isNaN(Number(data.healer.queueIcon))) data.healer.queueIcon = sp.icon;
        if (!data.healer.queueSpellName || data.healer.queueSpellName.startsWith('Habilidade #')) data.healer.queueSpellName = sp.name;
      } else {
        fetchMissingSpellIcon(data.healer.queueSpellId);
      }
    }
  }
  return data;
}

function enrichCharacterData(data) {
  if (!data) return data;
  if (data.character && data.equipment) {
    let sum = 0, count = 0;
    for (const [k, it] of Object.entries(data.equipment)) {
      if (k !== 'Shirt' && k !== 'Tabard' && it && it.itemLevel > 1) {
        sum += it.itemLevel;
        count++;
      }
    }
    if (count > 0 && (!data.character.avgItemLevel || data.character.avgItemLevel === 0)) {
      const avg = Math.round((sum / count) * 10) / 10;
      data.character.avgItemLevel = avg;
      data.character.equippedItemLevel = avg;
    }
  }
  if (data.bags && Array.isArray(data.bags.items)) {
    for (const it of data.bags.items) {
      if (it.itemID) {
        if (itemIcons[String(it.itemID)]) {
          it.iconName = itemIcons[String(it.itemID)];
        } else {
          fetchMissingIcon(it.itemID);
        }
      }
    }
  }
  if (data.equipment) {
    for (const [slot, item] of Object.entries(data.equipment)) {
      if (item && item.link) {
        const m = item.link.match(/item:(\d+)/);
        if (m) {
          item.itemID = parseInt(m[1], 10);
          if (itemIcons[String(item.itemID)]) {
            item.iconName = itemIcons[String(item.itemID)];
          } else {
            fetchMissingIcon(item.itemID);
          }
        }
      }
    }
  }
  return data;
}

characterData = enrichCharacterData(characterData);

let latestTelemetry = {
  type: 'telemetry',
  timestamp: Date.now(),
  mapId: 2400, // Silvermoon City (Midnight) // Dornogal
  x: 0.4925,
  y: 0.5280,
  facing: 180.0,
  inCombat: false,
  isDead: false,
  healthPct: 100.0,
  powerPct: 100.0,
  powerType: 1, // Rage / Mana
  level: 80,
  hasTarget: false,
  targetHealthPct: 0,
  targetRelation: 0,
  speed: 0,
  frameId: 0,
  resting: true,
  taxi: false,
  mounted: false,
  flying: false,
  fps: 0,
  isSimulated: false
};

let bridgeConnected = false;
let lastTelemetryTime = 0;

// Setup WebSocket server
const wss = new WebSocketServer({ server });
const clientSockets = new Set();
let bridgeSocket = null;

wss.on('connection', (ws, req) => {
  const url = req.url || '';

  if (url.startsWith('/ws/bridge')) {
    console.log('[WS] Desktop Bridge connected from', req.socket.remoteAddress);
    bridgeSocket = ws;
    bridgeConnected = true;
    broadcastStatus();

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'telemetry') {
          latestTelemetry = { ...enrichTelemetrySpells(data), isSimulated: false };
          lastTelemetryTime = Date.now();
          broadcastTelemetry(latestTelemetry);
        } else if (data.type === 'bridgeHeartbeat') {
          bridgeConnected = true;
          broadcastStatus();
        }
      } catch (err) {
        console.error('[WS Bridge] Error parsing message:', err.message);
      }
    });

    ws.on('close', () => {
      console.log('[WS] Desktop Bridge disconnected');
      if (bridgeSocket === ws) {
        bridgeSocket = null;
        bridgeConnected = false;
        broadcastStatus();
      }
    });

  } else {
    // Client connection (iPad / Browser)
    clientSockets.add(ws);
    // Send immediate initial state
    ws.send(JSON.stringify({
      type: 'init',
      telemetry: latestTelemetry,
      bridgeConnected,
      lastTelemetryTime,
      characterData: enrichCharacterData(characterData),
      tankGuides: tankGuidesData
    }));

    ws.on('message', (msg) => {
      try {
        const payload = JSON.parse(msg.toString());
        if (payload.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        } else if (payload.type === 'simulatedTelemetry') {
          // Client or simulator sending test telemetry
          latestTelemetry = { ...payload.data, isSimulated: true };
          lastTelemetryTime = Date.now();
          broadcastTelemetry(latestTelemetry);
        } else if (payload.type === 'trackQuest') {
          console.log('[WS] Track quest requested:', payload.questID);
          if (bridgeSocket && bridgeSocket.readyState === 1) {
            bridgeSocket.send(JSON.stringify(payload));
          }
          for (const client of clientSockets) {
            if (client.readyState === 1) {
              client.send(JSON.stringify({ type: 'trackedQuestUpdate', questID: payload.questID, title: payload.title }));
            }
          }
        } else if (payload.type === 'executeCommand') {
          console.log('[WS] In-game command requested:', payload.command);
          if (bridgeSocket && bridgeSocket.readyState === 1) {
            bridgeSocket.send(JSON.stringify(payload));
          }
          ws.send(JSON.stringify({ type: 'commandFeedback', command: payload.command, status: 'sent', timestamp: Date.now() }));
        }
      } catch (e) {}
    });

    ws.on('close', () => {
      clientSockets.delete(ws);
    });
  }
});

function broadcastTelemetry(data) {
  const payload = JSON.stringify(data);
  for (const client of clientSockets) {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  }
}

function broadcastStatus() {
  const payload = JSON.stringify({
    type: 'bridgeStatus',
    bridgeConnected,
    clientCount: clientSockets.size
  });
  for (const client of clientSockets) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}

// REST API Endpoints
app.get('/api/status', (req, res) => {
  res.json({
    bridgeConnected,
    clientCount: clientSockets.size,
    lastTelemetryTime,
    hasTelemetry: (Date.now() - lastTelemetryTime) < 10000,
    serverTime: Date.now()
  });
});

app.get('/api/telemetry', (req, res) => {
  res.json(latestTelemetry);
});

app.post('/api/telemetry', (req, res) => {
  latestTelemetry = { ...req.body, isSimulated: false };
  lastTelemetryTime = Date.now();
  broadcastTelemetry(latestTelemetry);
  res.json({ success: true });
});

app.get('/api/zones', (req, res) => {
  res.json(zonesData);
});

app.get('/api/icons', (req, res) => { res.json(itemIcons); });

app.get('/api/wowhead/spell/:id', (req, res) => {
  const id = req.params.id;
  if (spellIcons[String(id)]) {
    return res.json(spellIcons[String(id)]);
  }
  const url = 'https://nether.wowhead.com/tooltip/spell/' + id;
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (resp) => {
    let raw = '';
    resp.on('data', chunk => raw += chunk);
    resp.on('end', () => {
      try {
        const d = JSON.parse(raw);
        if (d && d.icon) {
          spellIcons[String(id)] = { name: d.name || '', icon: d.icon };
          fs.writeFile(spellIconsPath, JSON.stringify(spellIcons, null, 2), () => {});
          return res.json(spellIcons[String(id)]);
        }
        res.status(404).json({ error: 'Spell not found' });
      } catch(e) {
        res.status(500).json({ error: 'Parse error' });
      }
    });
  }).on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
});

app.get('/api/tank-guides', (req, res) => {
  res.json(tankGuidesData);
});

app.get('/api/data', (req, res) => {
  res.json({ ...characterData, tankGuides: tankGuidesData });
});

app.post('/api/track-quest', (req, res) => {
  const { questID, title } = req.body || {};
  if (!questID) return res.status(400).json({ error: 'Missing questID' });
  console.log('[API] Track quest requested:', questID, title);
  const payload = { type: 'trackQuest', questID: Number(questID), title: title || '' };
  if (bridgeSocket && bridgeSocket.readyState === 1) {
    bridgeSocket.send(JSON.stringify(payload));
  }
  for (const client of clientSockets) {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: 'trackedQuestUpdate', questID: Number(questID), title }));
    }
  }
  res.json({ success: true, message: 'Tracking quest ' + questID, questID });
});

app.post('/api/command', (req, res) => {
  const { command } = req.body || {};
  if (!command) return res.status(400).json({ error: 'Missing command' });
  console.log('[API] Execute command requested:', command);
  const payload = { type: 'executeCommand', command };
  if (bridgeSocket && bridgeSocket.readyState === 1) {
    bridgeSocket.send(JSON.stringify(payload));
  }
  for (const client of clientSockets) {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: 'commandFeedback', command, status: 'sent', timestamp: Date.now() }));
    }
  }
  res.json({ success: true, command, message: 'Command sent to game' });
});

app.post('/api/savedvariables', (req, res) => {
  if (req.body && req.body.character) {
    // Preserve existing quests if incoming payload is empty
    const inQ = Array.isArray(req.body.quests) ? req.body.quests : Object.values(req.body.quests || {});
    if (inQ.length === 0 && characterData && characterData.quests && characterData.quests.length > 0) {
      req.body.quests = characterData.quests;
    }
    characterData = enrichCharacterData(req.body);
    try {
      fs.writeFileSync(savedDataPath, JSON.stringify(characterData, null, 2));
    } catch(e) {
      console.error('[API] Failed to save character data to disk:', e);
    }
    console.log(`[API] SavedVariables received for character: ${characterData.character.name} (${characterData.character.level})`);
    // Broadcast data update to iPad
    for (const client of clientSockets) {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: 'dataUpdate', data: characterData }));
      }
    }
    return res.json({ success: true, message: 'SavedVariables updated' });
  }
  res.status(400).json({ error: 'Invalid SavedVariables payload' });
});

// Download Addon ZIP
app.get('/api/addon/download', (req, res) => {
  const addonDir = path.join(__dirname, 'addon/WoWCompanion');
  res.attachment('WoWCompanion.zip');

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => res.status(500).send({ error: err.message }));
  archive.pipe(res);
  archive.directory(addonDir, 'WoWCompanion');
  archive.finalize();
});

// Download Bridge ZIP
app.get('/api/bridge/download', (req, res) => {
  const bridgeDir = path.join(__dirname, 'bridge');
  res.attachment('WoWCompanionBridge.zip');

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => res.status(500).send({ error: err.message }));
  archive.pipe(res);
  archive.directory(bridgeDir, 'WoWCompanionBridge');
  archive.finalize();
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  WoW Companion Server is running!`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  LAN:     http://192.168.1.108:${PORT}`);
  console.log(`  Tailscale: http://100.121.114.9:${PORT}`);
  console.log(`====================================================`);
});
