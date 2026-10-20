// WoW Companion - Second Screen Web App
// Author: Daniel & Antigravity
// Version: 2.3.0

const state = {
  activeView: 'view-map',
  activeInvTab: 'gear',
  bagCategoryFilter: 'all',
  isSimulating: false,
  simSpeed: 2,
  bridgeConnected: false,
  autoCenter: true,
  showTrail: true,
  currentZoneId: 2393, // Silvermoon City (Midnight)
  activeMapImageId: null,
  mapModeSatellite: false,
  isMapHD: false,
  mapWidth: 1500,
  mapHeight: 1000,
  districtLayerGroup: null,
  poiLayerGroup: null,
  questPinLayerGroup: null,
  zones: [],
  characterData: null,
  itemIcons: {},
  trailPoints: [],
  playerPos: { x: 0.50, y: 0.50, facing: 0 },
  map: null,
  playerMarker: null,
  trailPolyline: null,
  ws: null,
  tankGuides: [],
  selectedInstanceId: null,
  selectedBossIndex: 0,
  voiceAlertsEnabled: (function() {
    try {
      return localStorage.getItem('wow_voice_alerts') === 'true'; // False by default!
    } catch(e) { return false; }
  })(),
  lastSpokenTime: 0,
  lastTauntSpoken: false,
  sessionStartMoney: null,
  combatStartTime: 0,
  damageTakenInCombat: 0,
  lastHealthPct: 100,
  mitigationActiveSec: 0,
  lastMitigationTick: 0,
  lastLowManaChime: 0
};

// UI Elements Cache
const el = {
  charAvatar: document.getElementById('char-avatar'),
  charName: document.getElementById('char-name'),
  charLevel: document.getElementById('char-level'),
  charRealm: document.getElementById('char-realm'),
  hudZone: document.getElementById('hud-zone'),
  hpFill: document.getElementById('hp-fill'),
  hpText: document.getElementById('hp-text'),
  powerFill: document.getElementById('power-fill'),
  powerText: document.getElementById('power-text'),
  combatBadge: document.getElementById('combat-badge'),
  combatOverlay: document.getElementById('combat-overlay'),
  connectionPill: document.getElementById('connection-pill'),
  connectionLabel: document.getElementById('connection-label'),
  hudCoordX: document.getElementById('hud-coord-x'),
  hudCoordY: document.getElementById('hud-coord-y'),
  hudFacing: document.getElementById('hud-facing'),
  hudSpeed: document.getElementById('hud-speed'),
  zoneSelect: document.getElementById('zone-select'),
  btnRecenter: document.getElementById('btn-recenter'),
  btnToggleTrail: document.getElementById('btn-toggle-trail'),
  btnMapMode: document.getElementById('btn-map-mode'),
  btnZoomIn: document.getElementById('btn-zoom-in'),
  btnZoomOut: document.getElementById('btn-zoom-out'),
  hudZoomBadge: document.getElementById('hud-zoom-badge'),
  targetCard: document.getElementById('target-card'),
  targetHpFill: document.getElementById('target-hp-fill'),
  targetHpText: document.getElementById('target-hp-text'),
  targetRel: document.getElementById('target-rel'),
  questsList: document.getElementById('quests-list'),
  questCount: document.getElementById('quest-count'),
  invIlvlVal: document.getElementById('inv-ilvl-val'),
  sheetCharName: document.getElementById('sheet-char-name'),
  sheetCharSubtitle: document.getElementById('sheet-char-subtitle'),
  sheetIlvlNum: document.getElementById('sheet-ilvl-num'),
  sheetIlvlSub: document.getElementById('sheet-ilvl-sub'),
  paperdollLeft: document.getElementById('paperdoll-left'),
  paperdollRight: document.getElementById('paperdoll-right'),
  paperdollWeapons: document.getElementById('paperdoll-weapons'),
  stageHpBar: document.getElementById('stage-hp-bar'),
  stageHpVal: document.getElementById('stage-hp-val'),
  stagePowerBar: document.getElementById('stage-power-bar'),
  stagePowerVal: document.getElementById('stage-power-val'),
  categoryChipsBar: document.getElementById('category-chips-bar'),
  categorizedBagWrapper: document.getElementById('categorized-bag-wrapper'),
  bagSearchInput: document.getElementById('bag-search-input'),
  bagQualityFilter: document.getElementById('bag-quality-filter'),
  freeSlotsCounter: document.getElementById('free-slots-counter'),
  goldVal: document.getElementById('gold-val'),
  silverVal: document.getElementById('silver-val'),
  copperVal: document.getElementById('copper-val'),
  statMounts: document.getElementById('stat-mounts'),
  statPets: document.getElementById('stat-pets'),
  statToys: document.getElementById('stat-toys'),
  statAchieves: document.getElementById('stat-achieves'),
  simToggle: document.getElementById('sim-toggle'),
  simSpeed: document.getElementById('sim-speed'),
  bridgeStatusTxt: document.getElementById('bridge-status-txt'),
  clientsCountTxt: document.getElementById('clients-count-txt'),
  statStr: document.getElementById('stat-str'),
  statSta: document.getElementById('stat-sta'),
  statArm: document.getElementById('stat-arm'),
  statCrit: document.getElementById('stat-crit'),
  statHaste: document.getElementById('stat-haste'),
  statMas: document.getElementById('stat-mas'),
  statVers: document.getElementById('stat-vers'),
  tankVoiceBtn: document.getElementById('tank-voice-btn'),
  tankVoiceIcon: document.getElementById('tank-voice-icon'),
  tankVoiceLabel: document.getElementById('tank-voice-label'),
  tankThreatCard: document.getElementById('tank-threat-card'),
  threatOrb: document.getElementById('threat-orb'),
  threatStatusTitle: document.getElementById('threat-status-title'),
  threatStatusSub: document.getElementById('threat-status-sub'),
  radarIndicator: document.getElementById('radar-indicator'),
  tankTauntCard: document.getElementById('tank-taunt-card'),
  tauntPulseIcon: document.getElementById('taunt-pulse-icon'),
  tauntHeadline: document.getElementById('taunt-headline'),
  tauntSubtext: document.getElementById('taunt-subtext'),
  coTankStacksNum: document.getElementById('co-tank-stacks-num'),
  mitShieldBlock: document.getElementById('mit-shield-block'),
  mitSbStatus: document.getElementById('mit-sb-status'),
  mitIgnorePain: document.getElementById('mit-ignore-pain'),
  mitIpStatus: document.getElementById('mit-ip-status'),
  mitMajorDef: document.getElementById('mit-major-def'),
  mitMajorStatus: document.getElementById('mit-major-status'),
  tankInstanceSelect: document.getElementById('tank-instance-select'),
  guideZoneTag: document.getElementById('guide-zone-tag'),
  tankTrashNotes: document.getElementById('tank-trash-notes'),
  trashNotesText: document.getElementById('trash-notes-text'),
  bossNavTabs: document.getElementById('boss-nav-tabs'),
  bossTacticalCard: document.getElementById('boss-tactical-card'),
  bossNameTitle: document.getElementById('boss-name-title'),
  bossStatusBadge: document.getElementById('boss-status-badge'),
  tacticPosDesc: document.getElementById('tactic-pos-desc'),
  tacticBusterDesc: document.getElementById('tactic-buster-desc'),
  tacticTauntDesc: document.getElementById('tactic-taunt-desc'),
  tacticDangerDesc: document.getElementById('tactic-danger-desc')
};

// =========================================================================
// Web Audio API Synthesizer & Sound Effects
// =========================================================================

let audioCtx = null;
let soundEnabled = true;

function initAudio() {
  if (!audioCtx) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    } catch (e) {}
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playTactileClick() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.04);
  } catch (e) {}
}

function playAlertChime() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(659.25, now);
    osc.frequency.setValueAtTime(880.00, now + 0.12);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {}
}

function sendGameCommand(cmd) {
  playTactileClick();
  showToast(`🎮 A enviar comando: ${cmd}`);
  const feedbackEl = document.getElementById('command-feedback');
  if (feedbackEl) {
    feedbackEl.textContent = `A enviar: ${cmd}...`;
    feedbackEl.classList.add('sending');
    setTimeout(() => {
      feedbackEl.textContent = 'Executado no WoW!';
      feedbackEl.classList.remove('sending');
      setTimeout(() => { feedbackEl.textContent = 'Pronto'; }, 2000);
    }, 450);
  }

  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({ type: 'executeCommand', command: cmd }));
  } else {
    fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd })
    }).catch(() => {});
  }
}

function setupCommandDeck() {
  document.querySelectorAll('.cmd-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cmd = btn.getAttribute('data-cmd');
      if (cmd) {
        sendGameCommand(cmd);
      }
    });
  });
}

function setupAMOLEDMode() {
  const isAmoled = localStorage.getItem('wow_companion_amoled') === 'true';
  const amoledToggle = document.getElementById('settings-amoled-toggle');
  const amoledBtn = document.getElementById('btn-toggle-amoled');

  function setAmoled(enable) {
    document.body.classList.toggle('amoled-mode', enable);
    localStorage.setItem('wow_companion_amoled', enable ? 'true' : 'false');
    if (amoledToggle) amoledToggle.checked = enable;
    if (amoledBtn) {
      amoledBtn.classList.toggle('active', enable);
      amoledBtn.textContent = enable ? '☀️ Normal' : '🌙 AMOLED';
    }
  }

  if (isAmoled) setAmoled(true);

  if (amoledBtn) {
    amoledBtn.addEventListener('click', () => {
      const active = document.body.classList.contains('amoled-mode');
      playTactileClick();
      setAmoled(!active);
    });
  }

  if (amoledToggle) {
    amoledToggle.addEventListener('change', () => {
      playTactileClick();
      setAmoled(amoledToggle.checked);
    });
  }
}

function setupSoundEffects() {
  const soundPref = localStorage.getItem('wow_companion_sound') !== 'false';
  soundEnabled = soundPref;
  const soundBtn = document.getElementById('btn-toggle-sound');
  const soundToggle = document.getElementById('settings-sound-toggle');

  function setSound(enable) {
    soundEnabled = enable;
    localStorage.setItem('wow_companion_sound', enable ? 'true' : 'false');
    if (soundToggle) soundToggle.checked = enable;
    if (soundBtn) {
      soundBtn.classList.toggle('active', enable);
      soundBtn.textContent = enable ? '🔊 Som' : '🔇 Mudo';
    }
  }

  setSound(soundPref);

  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      setSound(!soundEnabled);
      if (soundEnabled) playTactileClick();
    });
  }

  if (soundToggle) {
    soundToggle.addEventListener('change', () => {
      setSound(soundToggle.checked);
      if (soundEnabled) playTactileClick();
    });
  }
}

function formatMPlusTime(totalSec) {
  totalSec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function updateMPlusCompanion(mplus, instanceGuide) {
  const lvlEl = document.getElementById('mplus-keystone-lvl');
  const cutoff3El = document.getElementById('mplus-time-3');
  const cutoff2El = document.getElementById('mplus-time-2');
  const cutoff1El = document.getElementById('mplus-time-1');
  const deathsEl = document.getElementById('mplus-death-count');
  const penaltyEl = document.getElementById('mplus-penalty-time');
  const trashPctEl = document.getElementById('mplus-trash-pct');
  const trashFillEl = document.getElementById('mplus-trash-fill');

  const baseSec = (mplus && mplus.timeLimit > 0) ? mplus.timeLimit : 1800;
  if (cutoff1El) cutoff1El.textContent = formatMPlusTime(baseSec);
  if (cutoff2El) cutoff2El.textContent = formatMPlusTime(baseSec * 0.8);
  if (cutoff3El) cutoff3El.textContent = formatMPlusTime(baseSec * 0.6);

  const lvl = (mplus && mplus.level > 0) ? `+${mplus.level}` : '+10';
  if (lvlEl) lvlEl.textContent = lvl;

  const deaths = (mplus && mplus.deathCount) || 0;
  if (deathsEl) deathsEl.textContent = deaths;
  if (penaltyEl) penaltyEl.textContent = `(+${deaths * 5}s)`;

  const trash = (mplus && typeof mplus.trashPct === 'number') ? mplus.trashPct : 0;
  if (trashPctEl) trashPctEl.textContent = `${trash.toFixed(1)}% / 100%`;
  if (trashFillEl) trashFillEl.style.width = `${Math.min(100, trash)}%`;
}

// =========================================================================
// Initialization
// =========================================================================

async function init() {
  setupNavigation();
  setupCommandDeck();
  setupAMOLEDMode();
  setupSoundEffects();
  setupMap();
  setupSimulation();
  connectWebSocket();
  await loadIcons();
  await loadZones();
  await loadCharacterData();
  await loadTankGuides();
}

// Navigation Tabs with Touch-Optimized Handling
function setupNavigation() {
  // Role Mode Toggle (Tank vs DPS Deck)
  const roleBtn = document.getElementById('role-toggle-btn');
  if (roleBtn) {
    roleBtn.addEventListener('click', () => {
      if (currentCombatMode === 'dps') {
        currentCombatMode = 'healer';
      } else if (currentCombatMode === 'healer') {
        currentCombatMode = 'tank';
      } else if (currentCombatMode === 'tank') {
        currentCombatMode = 'dps';
      } else {
        if (state.specRole === 'TANK') currentCombatMode = 'healer';
        else if (state.specRole === 'HEALER') currentCombatMode = 'dps';
        else currentCombatMode = 'tank';
      }
      updateCombatModeDisplay(state.specRole || 'DAMAGER');
      playUiClickSound();
    });
  }
  updateCombatModeDisplay(state.specRole || 'DAMAGER');

  const switchNav = (targetView) => {
    if (!targetView) return;
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-view') === targetView);
    });
    document.querySelectorAll('.view-panel').forEach(p => {
      p.classList.toggle('active', p.id === targetView);
    });
    state.activeView = targetView;

    if (targetView === 'view-map' && state.map) {
      setTimeout(() => state.map.invalidateSize(), 150);
    }
  };

  document.querySelectorAll('.nav-btn').forEach(btn => {
    let lastTap = 0;
    const trigger = (e) => {
      const now = Date.now();
      if (now - lastTap < 300) return;
      lastTap = now;
      if (e) e.preventDefault();
      switchNav(btn.getAttribute('data-view'));
    };
    btn.addEventListener('click', trigger);
    btn.addEventListener('touchend', trigger);
  });

  // Inventory Subtabs (Equipamento vs Mochila)
  const switchInvTab = (tab) => {
    if (!tab) return;
    document.querySelectorAll('.inv-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    document.querySelectorAll('.inv-tab-content').forEach(c => {
      c.classList.toggle('active', c.id === `tab-${tab}-content`);
    });
    state.activeInvTab = tab;
  };

  document.querySelectorAll('.inv-tab-btn').forEach(btn => {
    let lastTap = 0;
    const trigger = (e) => {
      const now = Date.now();
      if (now - lastTap < 300) return;
      lastTap = now;
      if (e) e.preventDefault();
      switchInvTab(btn.getAttribute('data-tab'));
    };
    btn.addEventListener('click', trigger);
    btn.addEventListener('touchend', trigger);
  });

  // Bag search and filters
  if (el.bagSearchInput) {
    el.bagSearchInput.addEventListener('input', () => {
      if (state.characterData && state.characterData.bags) {
        renderBags(state.characterData.bags);
      }
    });
  }
  if (el.bagQualityFilter) {
    el.bagQualityFilter.addEventListener('change', () => {
      if (state.characterData && state.characterData.bags) {
        renderBags(state.characterData.bags);
      }
    });
  }

  // Recenter button
  if (el.btnRecenter) {
    el.btnRecenter.addEventListener('click', (e) => {
      e.preventDefault();
      state.autoCenter = !state.autoCenter;
      el.btnRecenter.classList.toggle('active', state.autoCenter);
      if (state.autoCenter && state.playerMarker) {
        state.map.panTo(state.playerMarker.getLatLng());
      }
    });
  }

  // Trail button
  if (el.btnToggleTrail) {
    el.btnToggleTrail.addEventListener('click', (e) => {
      e.preventDefault();
      state.showTrail = !state.showTrail;
      el.btnToggleTrail.classList.toggle('active', state.showTrail);
      if (!state.showTrail && state.trailPolyline) {
        state.trailPolyline.setLatLngs([]);
        state.trailPoints = [];
      }
    });
  }

  // Zone select
  if (el.zoneSelect) {
    el.zoneSelect.addEventListener('change', (e) => {
      state.currentZoneId = parseInt(e.target.value, 10);
      updateZoneBackground();
      state.trailPoints = [];
      if (state.trailPolyline) state.trailPolyline.setLatLngs([]);
    });
  }
}

// =========================================================================
// Real In-Game Map Metadata (Districts & Points of Interest)
// =========================================================================

const ZONE_METADATA = {
  2393: { // Silvermoon City (Midnight Revamp)
    name: "Silvermoon City",
    aspect: 1.5,
    districts: [
      { name: "Agulha Fúria do Sol", x: 0.540, y: 0.180, icon: "🏛️" },
      { name: "O Bazar", x: 0.505, y: 0.695, icon: "🎪" },
      { name: "Beco do Crime", x: 0.585, y: 0.510, icon: "🗡️" },
      { name: "A Bolsa Real", x: 0.365, y: 0.530, icon: "⚖️" },
      { name: "Alameda dos Anciãos", x: 0.380, y: 0.720, icon: "🌿" },
      { name: "Praça dos Andarilhos", x: 0.700, y: 0.720, icon: "🏹" },
      { name: "Pátio do Sol", x: 0.490, y: 0.890, icon: "☀️" },
      { name: "Portão do Pastor", x: 0.490, y: 0.050, icon: "🚪" }
    ],
    pois: [
      { type: "flight", name: "Mestre de Voo (Maelis)", desc: "Rotas aéreas de Quel'Thalas", x: 0.525, y: 0.820, icon: "🦅" },
      { type: "bank", name: "Banco da Bolsa Real", desc: "Cofre e Depósito de Guilda", x: 0.370, y: 0.505, icon: "🏦" },
      { type: "bank", name: "Banco do Bazar", desc: "Depósito Pessoal e Cofre", x: 0.485, y: 0.685, icon: "🏦" },
      { type: "auction", name: "Casa de Leilões da Bolsa", desc: "Comércio & Leilões", x: 0.355, y: 0.520, icon: "🪙" },
      { type: "auction", name: "Casa de Leilões do Bazar", desc: "Comércio Geral", x: 0.518, y: 0.670, icon: "🪙" },
      { type: "inn", name: "Estalagem da Bolsa Real", desc: "Ponto de Regresso & Descanso", x: 0.385, y: 0.540, icon: "🍺" },
      { type: "inn", name: "Estalagem Descanso do Viajante", desc: "O Bazar - Descanso & Venda", x: 0.470, y: 0.710, icon: "🍺" },
      { type: "mail", name: "Caixa de Correio (Bazar)", desc: "Envio e receção de correio", x: 0.508, y: 0.680, icon: "✉️" },
      { type: "mail", name: "Caixa de Correio (Bolsa)", desc: "Envio e receção de correio", x: 0.362, y: 0.515, icon: "✉️" },
      { type: "trainer", name: "Treinadores de Guerreiro & Paladino", desc: "Praça dos Andarilhos", x: 0.690, y: 0.710, icon: "⚔️" },
      { type: "trainer", name: "Treinadores de Ladino & Bruxo", desc: "Beco do Crime", x: 0.590, y: 0.490, icon: "🗡️" },
      { type: "trainer", name: "Treinadores de Mago & Sacerdote", desc: "Agulha Fúria do Sol", x: 0.530, y: 0.210, icon: "✨" },
      { type: "trainer", name: "Treinadores de Caçador", desc: "Praça dos Andarilhos", x: 0.720, y: 0.700, icon: "🏹" },
      { type: "repair", name: "Ferraria & Reparação", desc: "Reparação de Armadura e Equipamento", x: 0.525, y: 0.690, icon: "⚒️" },
      { type: "craft", name: "Alquimia & Ervanária", desc: "Laboratório do Bazar", x: 0.535, y: 0.655, icon: "🧪" },
      { type: "craft", name: "Alfaiataria", desc: "Tecidos do Bazar", x: 0.460, y: 0.690, icon: "🧵" },
      { type: "craft", name: "Joalharia", desc: "Lapidação de Gemas da Bolsa", x: 0.350, y: 0.540, icon: "💎" },
      { type: "portal", name: "Portal para Orgrimmar", desc: "Santuário Interior de Fúria do Sol", x: 0.540, y: 0.165, icon: "🌀" },
      { type: "portal", name: "Orbe de Translocação", desc: "Teletransporte Rápido", x: 0.535, y: 0.170, icon: "🔮" }
    ]
  },
  2400: { sameAs: 2393 },
  854: { // Atal'Dazar
    name: "Atal'Dazar",
    aspect: 1.5,
    districts: [
      { name: "Altar de Rezan", x: 0.680, y: 0.600, icon: "🦖" },
      { name: "Altar de Vol'kaal", x: 0.320, y: 0.600, icon: "💀" },
      { name: "Altar da Sacerdotisa Alun'za", x: 0.500, y: 0.250, icon: "👑" },
      { name: "Túmulo de Yazma", x: 0.500, y: 0.880, icon: "🕷️" }
    ],
    pois: [
      { type: "boss", name: "Rezan", desc: "Chefe - Loa dos Reis", x: 0.680, y: 0.600, icon: "💀" },
      { type: "boss", name: "Vol'kaal", desc: "Chefe - Guerreiro Amaldiçoado", x: 0.320, y: 0.600, icon: "💀" },
      { type: "boss", name: "Sacerdotisa Alun'za", desc: "Chefe - Sacerdotisa Dourada", x: 0.500, y: 0.250, icon: "💀" },
      { type: "boss", name: "Yazma", desc: "Chefe - Alta Sacerdotisa de Shadra", x: 0.500, y: 0.880, icon: "💀" }
    ]
  },
  934: { sameAs: 854 },
  935: { sameAs: 854 },
  2112: { // Valdrakken
    name: "Valdrakken",
    aspect: 1.5,
    districts: [
      { name: "Trono dos Aspetos", x: 0.550, y: 0.380, icon: "🐉" },
      { name: "Enclave dos Gladiadores", x: 0.420, y: 0.550, icon: "⚔️" },
      { name: "Mercado dos Artesãos", x: 0.350, y: 0.650, icon: "⚒️" }
    ],
    pois: [
      { type: "flight", name: "Mestre de Voo", desc: "Plataforma de Dragontaria", x: 0.440, y: 0.640, icon: "🦅" },
      { type: "bank", name: "Banco de Valdrakken", desc: "Cofre Central", x: 0.540, y: 0.600, icon: "🏦" },
      { type: "auction", name: "Casa de Leilões", desc: "Leilões dos Dragões", x: 0.440, y: 0.590, icon: "🪙" },
      { type: "inn", name: "Estalagem do Carneiro Assado", desc: "Descanso", x: 0.470, y: 0.470, icon: "🍺" }
    ]
  },
  2339: { // Dornogal
    name: "Dornogal",
    aspect: 1.5,
    districts: [
      { name: "Fundição dos Terranos", x: 0.480, y: 0.300, icon: "🏔️" },
      { name: "Câmara da Assembleia", x: 0.500, y: 0.500, icon: "🏛️" }
    ],
    pois: [
      { type: "flight", name: "Mestre de Voo de Dornogal", desc: "Rotas de Khaz Algar", x: 0.550, y: 0.420, icon: "🦅" },
      { type: "bank", name: "Banco de Dornogal", desc: "Cofres Subterrâneos", x: 0.490, y: 0.540, icon: "🏦" },
      { type: "auction", name: "Casa de Leilões", desc: "Comércio Terrano", x: 0.520, y: 0.560, icon: "🪙" },
      { type: "inn", name: "Estalagem da Guarda de Pedra", desc: "Descanso", x: 0.460, y: 0.480, icon: "🍺" }
    ]
  }
};

// =========================================================================
// Leaflet Map Setup with Dynamic Multi-Resolution & Level-of-Detail (LOD)
// =========================================================================

let zoneOverlay = null;

function setupMap() {
  state.map = L.map('wow-map', {
    crs: L.CRS.Simple,
    minZoom: -0.75,
    maxZoom: 3.5,
    zoomSnap: 0.1,
    zoomDelta: 0.25,
    attributionControl: false,
    zoomControl: false,
    wheelPxPerZoomLevel: 100
  });

  const bounds = [[0, 0], [1000, 1500]];
  state.map.fitBounds(bounds);
  state.map.setView([500, 750], 0);

  // Level-of-Detail Layer Groups
  state.districtLayerGroup = L.layerGroup().addTo(state.map);
  state.poiLayerGroup = L.layerGroup().addTo(state.map);
  state.questPinLayerGroup = L.layerGroup().addTo(state.map);

  updateZoneBackground();

  // Custom Player Marker Icon
  const playerIcon = L.divIcon({
    className: 'player-marker-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `
      <div id="player-arrow-wrapper" style="transform: rotate(0deg); transition: transform 0.08s linear;">
        <svg class="player-marker-svg" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="rgba(245, 179, 36, 0.25)" stroke="#f5b324" stroke-width="4"/>
          <polygon points="50,12 74,74 50,60 26,74" fill="#f5b324"/>
        </svg>
      </div>
    `
  });

  state.playerMarker = L.marker([500, 750], { icon: playerIcon }).addTo(state.map);

  // Trail Polyline
  state.trailPolyline = L.polyline([], {
    color: '#00e5ff',
    weight: 3,
    opacity: 0.75,
    dashArray: '4, 8'
  }).addTo(state.map);

  state.map.on('dragstart', () => {
    state.autoCenter = false;
    if (el.btnRecenter) el.btnRecenter.classList.remove('active');
  });

  // Dynamic Level of Detail on Zoom
  state.map.on('zoom', updateMapLOD);
  state.map.on('zoomend', updateMapLOD);

  // Zoom Control Buttons
  if (el.btnZoomIn) {
    el.btnZoomIn.addEventListener('click', (e) => {
      e.preventDefault();
      state.map.zoomIn(0.4);
    });
  }
  if (el.btnZoomOut) {
    el.btnZoomOut.addEventListener('click', (e) => {
      e.preventDefault();
      state.map.zoomOut(0.4);
    });
  }

  // Map Mode Toggle (Artistic World Map vs Satellite Minimap Terrain)
  if (el.btnMapMode) {
    el.btnMapMode.addEventListener('click', (e) => {
      e.preventDefault();
      state.mapModeSatellite = !state.mapModeSatellite;
      el.btnMapMode.classList.toggle('active', state.mapModeSatellite);
      el.btnMapMode.textContent = state.mapModeSatellite ? '🛰️ Satélite' : '🗺️ Arte';
      updateZoneBackground();
      showToast(state.mapModeSatellite ? '🛰️ Terreno Satélite Ativo' : '🗺️ Mapa Pergaminho Oficial Ativo');
    });
  }
}

function updateZoneBackground() {
  let currentZone = state.zones.find(z => z.id === state.currentZoneId);
  if (!currentZone) {
    currentZone = { id: state.currentZoneId, name: state.characterData?.character?.subZone || state.characterData?.character?.zone || `Zona #${state.currentZoneId}` };
  }
  if (el.hudZone) el.hudZone.textContent = currentZone.name;
  if (el.zoneSelect) el.zoneSelect.value = state.currentZoneId;

  const zoom = state.map ? state.map.getZoom() : 0;
  const isHD = zoom >= 0.5;
  state.isMapHD = isHD;

  let imgUrl = `/maps/${state.currentZoneId}.jpg`;
  if (state.mapModeSatellite) {
    imgUrl = currentZone.mapImageUrlSat || `/maps/${state.currentZoneId}_sat.jpg`;
  } else if (isHD) {
    imgUrl = currentZone.mapImageUrlHd || `/maps/${state.currentZoneId}_hd.jpg`;
  } else {
    imgUrl = currentZone.mapImageUrl || `/maps/${state.currentZoneId}.jpg`;
  }

  const img = new Image();
  img.onload = () => {
    const aspect = (img.naturalWidth && img.naturalHeight) ? (img.naturalWidth / img.naturalHeight) : 1.5;
    state.mapHeight = 1000;
    state.mapWidth = Math.round(1000 * aspect);
    const bounds = [[0, 0], [state.mapHeight, state.mapWidth]];

    if (zoneOverlay) state.map.removeLayer(zoneOverlay);
    zoneOverlay = L.imageOverlay(imgUrl, bounds).addTo(state.map);
    zoneOverlay.bringToBack();
    state.activeMapImageId = state.currentZoneId;

    renderZoneLayers(state.currentZoneId);
    updateMapLOD();

    if (state.playerPos && state.playerMarker) {
      const latlng = coordsToLatLng(state.playerPos.x, state.playerPos.y);
      state.playerMarker.setLatLng(latlng);
    }
  };
  img.onerror = () => {
    state.activeMapImageId = null;
    state.mapHeight = 1000;
    state.mapWidth = 1500;
    const bounds = [[0, 0], [1000, 1500]];
    loadRadarFallback(currentZone.name, bounds);
    renderZoneLayers(state.currentZoneId);
  };
  img.src = imgUrl;
}

function updateMapLOD() {
  if (!state.map) return;
  const zoom = state.map.getZoom();

  // 1. Update Zoom HUD badge
  if (el.hudZoomBadge) {
    let lodTier = "Visão Geral";
    if (zoom >= 1.0) lodTier = "Rua & POIs";
    else if (zoom >= 0.3) lodTier = "Bairros";
    el.hudZoomBadge.textContent = `${zoom.toFixed(1)}x (${lodTier})`;
  }

  // 2. Dynamic Texture Swapping (Standard <-> Ultra-HD)
  if (!state.mapModeSatellite && zoneOverlay) {
    const shouldBeHD = zoom >= 0.5;
    if (shouldBeHD !== state.isMapHD) {
      state.isMapHD = shouldBeHD;
      let currentZone = state.zones.find(z => z.id === state.currentZoneId);
      const newUrl = shouldBeHD
        ? (currentZone?.mapImageUrlHd || `/maps/${state.currentZoneId}_hd.jpg`)
        : (currentZone?.mapImageUrl || `/maps/${state.currentZoneId}.jpg`);

      const pre = new Image();
      pre.onload = () => {
        if (zoneOverlay) zoneOverlay.setUrl(newUrl);
      };
      pre.src = newUrl;
    }
  }

  // 3. District Group Visibility (Fade in at zoom >= 0.25)
  if (state.districtLayerGroup) {
    const showDistricts = zoom >= 0.25;
    if (showDistricts && !state.map.hasLayer(state.districtLayerGroup)) {
      state.districtLayerGroup.addTo(state.map);
    } else if (!showDistricts && state.map.hasLayer(state.districtLayerGroup)) {
      state.map.removeLayer(state.districtLayerGroup);
    }
  }

  // 4. Street POI Group Visibility (Fade in at zoom >= 0.9)
  if (state.poiLayerGroup) {
    const showPOIs = zoom >= 0.9;
    if (showPOIs && !state.map.hasLayer(state.poiLayerGroup)) {
      state.poiLayerGroup.addTo(state.map);
    } else if (!showPOIs && state.map.hasLayer(state.poiLayerGroup)) {
      state.map.removeLayer(state.poiLayerGroup);
    }
  }

  // 5. Active Quest Pins Visibility (Fade in at zoom >= 0.25)
  if (state.questPinLayerGroup) {
    const showQuests = zoom >= 0.25;
    if (showQuests && !state.map.hasLayer(state.questPinLayerGroup)) {
      state.questPinLayerGroup.addTo(state.map);
    } else if (!showQuests && state.map.hasLayer(state.questPinLayerGroup)) {
      state.map.removeLayer(state.questPinLayerGroup);
    }
  }
}

function renderZoneLayers(zoneId) {
  if (!state.districtLayerGroup || !state.poiLayerGroup || !state.questPinLayerGroup) return;

  state.districtLayerGroup.clearLayers();
  state.poiLayerGroup.clearLayers();
  state.questPinLayerGroup.clearLayers();

  let meta = ZONE_METADATA[zoneId];
  if (meta && meta.sameAs) meta = ZONE_METADATA[meta.sameAs];

  if (meta) {
    // 1. Districts
    if (meta.districts) {
      meta.districts.forEach(d => {
        const latlng = coordsToLatLng(d.x, d.y);
        const icon = L.divIcon({
          className: "district-label-div",
          html: `<div class="district-label-marker">${d.icon || "📍"} ${d.name}</div>`
        });
        L.marker(latlng, { icon: icon, interactive: false }).addTo(state.districtLayerGroup);
      });
    }

    // 2. Street POIs
    if (meta.pois) {
      meta.pois.forEach(p => {
        const latlng = coordsToLatLng(p.x, p.y);
        const icon = L.divIcon({
          className: "poi-marker-div",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          html: `<div class="poi-marker-badge" title="${p.name}">${p.icon || "📍"}</div>`
        });
        const popupContent = `
          <div class="wow-poi-popup">
            <div class="poi-popup-header">
              <span class="poi-popup-icon">${p.icon || "📍"}</span>
              <strong>${p.name}</strong>
            </div>
            <div class="poi-popup-desc">${p.desc || ""}</div>
            <div class="poi-popup-coords">📍 ${(p.x * 100).toFixed(1)}, ${(p.y * 100).toFixed(1)}</div>
          </div>
        `;
        L.marker(latlng, { icon: icon }).bindPopup(popupContent).addTo(state.poiLayerGroup);
      });
    }
  }

  // 3. Dynamic Quest Pins for Active Quests
  if (state.characterData && state.characterData.quests && state.characterData.quests.length > 0) {
    const questsOnThisMap = (state.characterData.mapQuests && state.characterData.mapQuests.length > 0)
      ? state.characterData.mapQuests
      : [];

    questsOnThisMap.forEach(mq => {
      const qInfo = state.characterData.quests.find(q => q.questID === mq.questID) || { title: `Missão #${mq.questID}` };
      const latlng = coordsToLatLng(mq.x, mq.y);
      const icon = L.divIcon({
        className: "quest-marker-div",
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        html: `<div class="quest-marker-badge" title="${qInfo.title}">🎯</div>`
      });
      const popup = `
        <div class="wow-poi-popup">
          <div class="poi-popup-header">
            <span>🎯</span>
            <strong>${qInfo.title}</strong>
          </div>
          <div class="poi-popup-desc">Objetivo de missão ativo nesta zona.</div>
          <button class="track-btn" onclick="trackQuest(${mq.questID})" style="width:100%;margin-top:8px;padding:6px 12px;background:#f5b324;color:#000;font-weight:700;border:none;border-radius:4px;cursor:pointer;">🎯 Seguir no WoW</button>
        </div>
      `;
      L.marker(latlng, { icon: icon }).bindPopup(popup).addTo(state.questPinLayerGroup);
    });
  }
}

function loadRadarFallback(zoneName, bounds) {
  const svgData = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1000" viewBox="0 0 1500 1000">
      <defs>
        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(43, 54, 77, 0.4)" stroke-width="1"/>
        </pattern>
        <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
          <stop offset="40%" stop-color="#0c111c" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="#06090e" stop-opacity="1"/>
        </radialGradient>
      </defs>
      <rect width="1500" height="1000" fill="url(#vignette)"/>
      <rect width="1500" height="1000" fill="url(#grid)"/>
      <circle cx="750" cy="500" r="320" fill="none" stroke="rgba(245, 179, 36, 0.25)" stroke-width="2" stroke-dasharray="10, 10"/>
      <circle cx="750" cy="500" r="140" fill="none" stroke="rgba(0, 229, 255, 0.25)" stroke-width="2"/>
      <text x="750" y="50" fill="#f5b324" font-size="24" font-weight="bold" text-anchor="middle">NORTE</text>
      <text x="750" y="970" fill="#8b9bb4" font-size="20" text-anchor="middle">SUL</text>
      <text x="1460" y="508" fill="#8b9bb4" font-size="20" text-anchor="end">ESTE</text>
      <text x="40" y="508" fill="#8b9bb4" font-size="20" text-anchor="start">OESTE</text>
      <text x="750" y="470" fill="rgba(245, 179, 36, 0.15)" font-size="52" font-weight="900" text-anchor="middle" letter-spacing="4">
        ${zoneName.toUpperCase()}
      </text>
    </svg>
  `;
  const svgUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
  if (zoneOverlay) state.map.removeLayer(zoneOverlay);
  zoneOverlay = L.imageOverlay(svgUrl, bounds).addTo(state.map);
  zoneOverlay.bringToBack();
}

function coordsToLatLng(x, y) {
  const h = state.mapHeight || 1000;
  const w = state.mapWidth || 1500;
  return [(1.0 - y) * h, x * w];
}

// =========================================================================
// Telemetry Handler
// =========================================================================

function applyTelemetry(t) {
  state.playerPos = { x: t.x, y: t.y, facing: t.facing };

  // Update HUD Coordinates
  if (el.hudCoordX) el.hudCoordX.textContent = (t.x * 100).toFixed(1);
  if (el.hudCoordY) el.hudCoordY.textContent = (t.y * 100).toFixed(1);
  if (el.hudFacing) el.hudFacing.textContent = `${Math.round(t.facing)}°`;
  if (el.hudSpeed) el.hudSpeed.textContent = `${Math.round((t.speed / 7.0) * 100)}%`;

  // Update Top HUD Vitals
  if (el.hpFill) el.hpFill.style.width = `${t.healthPct}%`;
  if (el.hpText) el.hpText.textContent = `${Math.round(t.healthPct)}%`;
  if (el.powerFill) el.powerFill.style.width = `${t.powerPct}%`;
  if (el.powerText) el.powerText.textContent = `${Math.round(t.powerPct)}%`;

  // Update Paperdoll Stage Real-time Telemetry Bars
  if (el.stageHpBar) el.stageHpBar.style.width = `${t.healthPct}%`;
  if (el.stageHpVal) el.stageHpVal.textContent = `${Math.round(t.healthPct)}% Vida`;
  if (el.stagePowerBar) el.stagePowerBar.style.width = `${t.powerPct}%`;
  if (el.stagePowerVal) el.stagePowerVal.textContent = `${Math.round(t.powerPct)} Fúria`;

  if (el.powerFill) {
    if (t.powerType === 1) { // Rage
      el.powerFill.style.background = 'linear-gradient(90deg, #c0392b, #e74c3c)';
    } else if (t.powerType === 3) { // Energy
      el.powerFill.style.background = 'linear-gradient(90deg, #f39c12, #f1c40f)';
    } else { // Mana
      el.powerFill.style.background = 'linear-gradient(90deg, #2980b9, #3498db)';
    }
  }

  // Combat status
  if (el.combatBadge && el.combatOverlay) {
    if (t.inCombat) {
      el.combatBadge.classList.remove('hidden');
      el.combatOverlay.classList.remove('hidden');
    } else {
      el.combatBadge.classList.add('hidden');
      el.combatOverlay.classList.add('hidden');
    }
  }

  // Target Status
  if (el.targetCard) {
    if (t.hasTarget) {
      el.targetCard.classList.remove('hidden');
      if (el.targetHpFill) el.targetHpFill.style.width = `${t.targetHealthPct}%`;
      if (el.targetHpText) el.targetHpText.textContent = `${Math.round(t.targetHealthPct)}%`;
      if (el.targetRel) {
        if (t.targetRelation === 1) {
          el.targetRel.textContent = 'Inimigo';
          el.targetRel.style.color = '#e74c3c';
        } else if (t.targetRelation === 3) {
          el.targetRel.textContent = 'Aliado';
          el.targetRel.style.color = '#2ecc71';
        } else {
          el.targetRel.textContent = 'Neutro';
          el.targetRel.style.color = '#f1c40f';
        }
      }
    } else {
      el.targetCard.classList.add('hidden');
    }
  }

  // Map Marker
  const latLng = coordsToLatLng(t.x, t.y);
  if (state.playerMarker) {
    state.playerMarker.setLatLng(latLng);

    const arrow = document.getElementById('player-arrow-wrapper');
    if (arrow) {
      arrow.style.transform = `rotate(${t.facing}deg)`;
    }

    if (state.autoCenter) {
      state.map.panTo(latLng, { animate: true, duration: 0.1 });
    }
  }

  // Breadcrumbs Trail
  if (state.showTrail && state.trailPolyline) {
    state.trailPoints.push(latLng);
    if (state.trailPoints.length > 80) state.trailPoints.shift();
    state.trailPolyline.setLatLngs(state.trailPoints);
  }

  // Zone Change from MapID (triggers when mapId differs or image hasn't loaded)
  if (t.mapId && (t.mapId !== state.currentZoneId || state.activeMapImageId !== t.mapId)) {
    state.currentZoneId = t.mapId;
    let found = state.zones.find(z => z.id === t.mapId);
    if (!found) {
      const zName = state.characterData?.character?.subZone || state.characterData?.character?.zone || `Zona #${t.mapId}`;
      found = { id: t.mapId, name: zName, mapImageUrl: `/maps/${t.mapId}.jpg` };
      state.zones.unshift(found);
      if (el.zoneSelect) {
        const opt = document.createElement('option');
        opt.value = t.mapId;
        opt.textContent = zName;
        opt.selected = true;
        el.zoneSelect.prepend(opt);
      }
    } else {
      if (el.zoneSelect) el.zoneSelect.value = t.mapId;
    }
    updateZoneBackground();
  }

  // Real-Time Tank Telemetry (Threat, Taunt, Active Mitigation)
  if (t.tank) {
    applyTankTelemetry(t.tank, t);
  }

  // Real-Time DPS Rotation Telemetry
  if (t.dps) {
    applyDpsTelemetry(t.dps, t);
  }

  // Real-Time Healer Telemetry (Triage, Dispel, Tank Guardian)
  if (t.healer) {
    applyHealerTelemetry(t.healer, t);
  }
}

// =========================================================================
// Simulation Engine
// =========================================================================

let simAngle = 0;
let simRadius = 0.22;
let simCenter = { x: 0.50, y: 0.50 };

function setupSimulation() {
  if (el.simToggle) {
    el.simToggle.addEventListener('change', (e) => {
      state.isSimulating = e.target.checked;
      updateStatusPill();
    });
  }

  if (el.simSpeed) {
    el.simSpeed.addEventListener('input', (e) => {
      state.simSpeed = parseInt(e.target.value, 10);
    });
  }

  setInterval(() => {
    if (!state.isSimulating || state.bridgeConnected) return;

    simAngle = (simAngle + 0.015 * state.simSpeed) % (Math.PI * 2);
    const x = simCenter.x + Math.cos(simAngle) * simRadius;
    const y = simCenter.y + Math.sin(simAngle) * (simRadius * 0.7);

    const facingRad = (simAngle + Math.PI / 2) % (Math.PI * 2);
    let facingDeg = (facingRad * 180 / Math.PI);

    applyTelemetry({
      mapId: state.currentZoneId,
      x: x,
      y: y,
      facing: facingDeg,
      inCombat: false,
      isDead: false,
      healthPct: 98,
      powerPct: 85,
      powerType: 1,
      level: 90,
      hasTarget: false,
      targetHealthPct: 0,
      targetRelation: 0,
      speed: 7.0,
      isSimulated: true
    });
  }, 100);
}

// =========================================================================
// WebSocket Client
// =========================================================================

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    console.log('Connected to companion server WS');
    updateStatusPill();
    setInterval(() => {
      if (state.ws && state.ws.readyState === 1) {
        state.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 15000);
  };

  state.ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'init') {
        state.bridgeConnected = msg.bridgeConnected;
        if (msg.characterData) {
          state.characterData = msg.characterData;
          if (msg.characterData.settings && typeof msg.characterData.settings.voiceAlerts === 'boolean') {
            setVoiceAlerts(msg.characterData.settings.voiceAlerts, true);
          }
          renderCharacterData(state.characterData);
        }
        if (msg.tankGuides && msg.tankGuides.instances) {
          initTankHUD(msg.tankGuides.instances);
        }
        if (msg.telemetry && !msg.telemetry.isSimulated) {
          state.isSimulating = false;
          if (el.simToggle) el.simToggle.checked = false;
          applyTelemetry(msg.telemetry);
        }
        updateStatusPill();
      } else if (msg.type === 'telemetry') {
        if (!msg.isSimulated) {
          state.bridgeConnected = true;
          state.isSimulating = false;
          if (el.simToggle) el.simToggle.checked = false;
        }
        applyTelemetry(msg);
        updateStatusPill();
      } else if (msg.type === 'bridgeStatus') {
        state.bridgeConnected = msg.bridgeConnected;
        updateStatusPill();
      } else if (msg.type === 'dataUpdate') {
        state.characterData = msg.data;
        if (msg.data && msg.data.settings && typeof msg.data.settings.voiceAlerts === 'boolean') {
          setVoiceAlerts(msg.data.settings.voiceAlerts, true);
        }
        renderCharacterData(state.characterData);
      } else if (msg.type === 'trackedQuestUpdate') {
        activeTrackedQuestId = Number(msg.questID);
        if (state.characterData && state.characterData.quests) {
          renderQuests(state.characterData.quests);
        }
        showToast(`🎯 A seguir no WoW: ${msg.title || 'Missão'}`);
      } else if (msg.type === 'commandFeedback') {
        const feedbackEl = document.getElementById('command-feedback');
        if (feedbackEl) {
          feedbackEl.textContent = 'Executado no WoW!';
          feedbackEl.classList.remove('sending');
          setTimeout(() => { feedbackEl.textContent = 'Pronto'; }, 2000);
        }
      }
    } catch (e) {
      console.error('Error handling WS message:', e);
    }
  };

  state.ws.onclose = () => {
    state.bridgeConnected = false;
    updateStatusPill();
    setTimeout(connectWebSocket, 2000);
  };
}

function updateStatusPill() {
  if (!el.connectionPill) return;
  el.connectionPill.className = 'status-pill';
  if (state.bridgeConnected) {
    el.connectionPill.classList.add('status-live');
    if (el.connectionLabel) el.connectionLabel.textContent = 'PC Ligado (Ao Vivo)';
    if (el.bridgeStatusTxt) {
      el.bridgeStatusTxt.textContent = 'Ligado e a transmitir';
      el.bridgeStatusTxt.style.color = '#2ecc71';
    }
  } else if (state.isSimulating) {
    el.connectionPill.classList.add('status-simulated');
    if (el.connectionLabel) el.connectionLabel.textContent = 'Simulação Ativa';
    if (el.bridgeStatusTxt) {
      el.bridgeStatusTxt.textContent = 'Desconectado (Aguardar Bridge)';
      el.bridgeStatusTxt.style.color = '#f5b324';
    }
  } else {
    el.connectionPill.classList.add('status-offline');
    if (el.connectionLabel) el.connectionLabel.textContent = 'Desconectado';
    if (el.bridgeStatusTxt) {
      el.bridgeStatusTxt.textContent = 'Desconectado';
      el.bridgeStatusTxt.style.color = '#e74c3c';
    }
  }
}

// =========================================================================
// Data Loading & Rendering
// =========================================================================

async function loadIcons() {
  try {
    const res = await fetch('/api/icons');
    if (res.ok) {
      state.itemIcons = await res.json();
    }
  } catch (e) {
    console.warn('Failed to pre-load icons:', e);
  }
}

async function loadZones() {
  try {
    const res = await fetch('/api/zones');
    state.zones = await res.json();
    if (el.zoneSelect) {
      el.zoneSelect.innerHTML = '';
      state.zones.forEach(zone => {
        const opt = document.createElement('option');
        opt.value = zone.id;
        opt.textContent = `${zone.name} (${zone.expansion})`;
        if (zone.id === state.currentZoneId) opt.selected = true;
        el.zoneSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Failed to load zones:', err);
  }
}

async function loadCharacterData() {
  try {
    const res = await fetch('/api/data');
    state.characterData = await res.json();
    renderCharacterData(state.characterData);
  } catch (err) {
    console.error('Failed to load character data:', err);
  }
}

function getItemIconUrl(item) {
  if (!item) return null;
  const iconName = item.iconName || (item.itemID && state.itemIcons[String(item.itemID)]);
  if (iconName) {
    return `https://wow.zamimg.com/images/wow/icons/large/${iconName}.jpg`;
  }
  return null;
}

function calculateAverageIlvl(equipment) {
  if (!equipment) return 314.2;
  let sum = 0, count = 0;
  for (const [slot, it] of Object.entries(equipment)) {
    if (slot === 'Shirt' || slot === 'Tabard') continue;
    if (it && it.itemLevel && it.itemLevel > 1) {
      sum += it.itemLevel;
      count++;
    }
  }
  return count > 0 ? (sum / count).toFixed(1) : 314.2;
}

function renderCharacterData(data) {
  if (!data) return;

  try {
    const avgIlvl = data.character?.equippedItemLevel || data.character?.avgItemLevel || calculateAverageIlvl(data.equipment);

    // Update Top Header HUD
    if (data.character) {
      if (el.charName) el.charName.textContent = data.character.name || 'Räzâer';
      if (el.charLevel) el.charLevel.textContent = `Nv ${data.character.level || 90}`;
      if (el.charRealm) el.charRealm.textContent = data.character.realm || 'Silvermoon';
      if (el.hudZone) el.hudZone.textContent = data.character.subZone || data.character.zone || 'Silvermoon City';

      const classIcons = {
        WARRIOR: '⚔️', PALADIN: '🛡️', HUNTER: '🏹', ROGUE: '🗡️',
        PRIEST: '✨', DEATHKNIGHT: '💀', SHAMAN: '⚡', MAGE: '🔮',
        WARLOCK: '🔥', MONK: '🥋', DRUID: '🐾', DEMONHUNTER: '👁️', EVOKER: '🐲'
      };
      if (el.charAvatar) el.charAvatar.textContent = classIcons[data.character.class] || '⚔️';

      // Money
      if (data.character.money) {
        if (el.goldVal) el.goldVal.textContent = `${(data.character.money.gold || 0).toLocaleString()}g`;
        if (el.silverVal) el.silverVal.textContent = `${data.character.money.silver || 0}s`;
        if (el.copperVal) el.copperVal.textContent = `${data.character.money.copper || 0}c`;
      }
    }

    // Prominent Item Level in Bag Header
    if (el.invIlvlVal) {
      el.invIlvlVal.textContent = avgIlvl;
    }

    // Quests
    renderQuests(data.quests || []);

    // WoW Paperdoll Character Sheet & Categorized Bags
    renderEquipment(data.equipment || {}, data.character || {});
    renderBags(data.bags || { items: [], totalSlots: 0, freeSlots: 0 }, data.equipment || {});

    // Collections
    if (data.collections) {
      if (el.statMounts) el.statMounts.textContent = (data.collections.mountsCount || 0).toLocaleString();
      if (el.statPets) el.statPets.textContent = (data.collections.petsCount || 0).toLocaleString();
      if (el.statToys) el.statToys.textContent = (data.collections.toysCount || 0).toLocaleString();
      if (el.statAchieves) el.statAchieves.textContent = (data.collections.achievementPoints || 0).toLocaleString();
    }

    // Party Vitality & Healer Status
    if (data.party) {
      const hName = document.getElementById('healer-unit-name');
      if (hName && data.party.healer && data.party.healer.name) {
        hName.textContent = data.party.healer.name;
      }
      const bResEl = document.getElementById('val-battle-res');
      if (bResEl) {
        bResEl.textContent = `${data.party.battleResCharges || 0} Disp.`;
      }
      const satedEl = document.getElementById('val-sated');
      if (satedEl) {
        if (data.party.hasSated) {
          satedEl.textContent = 'Sated / CD';
          satedEl.parentElement.classList.add('sated-active');
        } else {
          satedEl.textContent = 'Pronto';
          satedEl.parentElement.classList.remove('sated-active');
        }
      }
    }

    // Auto-detect Combat Role (Tank vs DPS)
    const activeRole = (data.character && data.character.role) || (data.tank && data.tank.role) || '';
    if (activeRole) {
      state.specRole = activeRole;
      updateCombatModeDisplay(activeRole);
    }

    // Mythic+ Keystone Status
    if (data.mplus) {
      updateMPlusCompanion(data.mplus, state.selectedInstanceGuide);
    }
  } catch (err) {
    console.error('Error in renderCharacterData:', err);
  }
}

// =========================================================================
// WoW Character Sheet Paperdoll Renderer
// =========================================================================

const LEFT_SLOTS = ['Head', 'Neck', 'Shoulder', 'Back', 'Chest', 'Shirt', 'Tabard', 'Wrist'];
const RIGHT_SLOTS = ['Hands', 'Waist', 'Legs', 'Feet', 'Finger1', 'Finger2', 'Trinket1', 'Trinket2'];
const BOTTOM_SLOTS = ['MainHand', 'SecondaryHand', 'Ranged'];

const SLOT_LABELS = {
  Head: 'Cabeça', Neck: 'Pescoço', Shoulder: 'Ombros', Back: 'Costas',
  Chest: 'Peito', Shirt: 'Camisa', Tabard: 'Tabardo', Wrist: 'Pulsos',
  Hands: 'Mãos', Waist: 'Cinto', Legs: 'Pernas', Feet: 'Pés',
  Finger1: 'Anel 1', Finger2: 'Anel 2', Trinket1: 'Berloque 1', Trinket2: 'Berloque 2',
  MainHand: 'Arma Principal', SecondaryHand: 'Mão Secundária', Ranged: 'À Distância'
};

const SLOT_ICONS = {
  Head: "👑", Neck: "📿", Shoulder: "🛡️", Shirt: "👔",
  Chest: "🥋", Waist: "🎗️", Legs: "👖", Feet: "🥾",
  Wrist: "⌚", Hands: "🧤", Finger1: "💍", Finger2: "💍",
  Trinket1: "🔮", Trinket2: "💎", Back: "🧣", MainHand: "⚔️",
  SecondaryHand: "🛡️", Ranged: "🏹", Tabard: "📜"
};


function buildWowheadItemParams(item) {
  if (!item) return '';
  const itemId = item.itemID || (item.link && parseInt((item.link.match(/item:(\d+)/) || [])[1], 10));
  if (!itemId) return '';

  const params = [`item=${itemId}`];
  if (item.itemLevel && item.itemLevel > 1) {
    params.push(`ilvl=${item.itemLevel}`);
  }

  if (item.link) {
    const raw = item.link.replace(/\|c[0-9a-fA-F]{8}/g, '').replace(/\|r/g, '');
    const m = raw.match(/item:(\d+):([0-9]*):([0-9]*):([0-9]*):([0-9]*):([0-9]*):(-?[0-9]*):([0-9]*):([0-9]*):([0-9]*):([0-9]*):([0-9]*):(\d+):([0-9:]+)/);
    if (m) {
      const ench = m[2];
      if (ench && ench !== '0') params.push(`ench=${ench}`);
      const gems = [m[3], m[4], m[5], m[6]].filter(g => g && g !== '0');
      if (gems.length > 0) params.push(`gems=${gems.join(':')}`);
      const numBonus = parseInt(m[13], 10);
      const bonusStr = m[14];
      if (numBonus > 0 && bonusStr) {
        const bonuses = bonusStr.split(':').slice(0, numBonus).filter(Boolean).join(':');
        if (bonuses) params.push(`bonus=${bonuses}`);
      }
    }
  }

  return params.join('&');
}

let activeTrackedQuestId = null;

function trackQuest(questId, title) {
  activeTrackedQuestId = Number(questId);
  if (state.characterData && state.characterData.quests) {
    renderQuests(state.characterData.quests);
  }
  showToast(`🎯 A seguir no WoW: ${title}`);

  if (state.ws && state.ws.readyState === 1) {
    state.ws.send(JSON.stringify({
      type: 'trackQuest',
      questID: Number(questId),
      title: title
    }));
  }

  fetch('/api/track-quest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questID: Number(questId), title: title })
  }).catch(() => {});
}

function showToast(msg) {
  let toast = document.getElementById('wc-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'wc-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'wc-toast show';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => { toast.className = 'wc-toast'; }, 3200);
}

function createPaperdollSlotCard(slotName, item, side = 'left') {
  const card = document.createElement('a');
  card.className = `paperdoll-slot-card side-${side} ${item ? `q-${item.quality || 1}` : 'empty-slot'}`;

  const itemId = item ? (item.itemID || (item.link && parseInt((item.link.match(/item:(\d+)/) || [])[1], 10))) : null;
  const iconUrl = item ? getItemIconUrl(item) : null;

  const whParams = buildWowheadItemParams(item);
  if (whParams) {
    card.href = `https://www.wowhead.com/${whParams}`;
    card.setAttribute('data-wowhead', whParams);
    card.setAttribute('data-wh-rename-link', 'false');
    card.addEventListener('click', (e) => { e.preventDefault(); });
  }

  const iconBoxHtml = `
    <div class="slot-icon-box ${item ? `q-${item.quality || 1}` : 'q-0'}">
      <img class="item-icon-img" src="${iconUrl || ''}" alt="" style="${iconUrl ? '' : 'display:none;'}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
      <span class="slot-fallback" style="${iconUrl ? 'display:none;' : ''}">${SLOT_ICONS[slotName] || '🛡️'}</span>
      ${item && item.itemLevel ? `<span class="slot-corner-ilvl">${item.itemLevel}</span>` : ''}
    </div>
  `;

  const infoBoxHtml = `
    <div class="slot-details">
      <div class="slot-details-top">
        <span class="slot-type-lbl">${SLOT_LABELS[slotName] || slotName}</span>
        ${item && item.upgradeTrack ? `<span class="slot-upgrade-track">${item.upgradeTrack}</span>` : ''}
      </div>
      <span class="slot-item-name ${item ? `q-${item.quality || 1}` : 'unassigned'}">${item ? item.name : 'Vazio'}</span>
      ${item && item.itemLevel ? `<span class="slot-ilvl-tag">ilvl ${item.itemLevel}</span>` : ''}
    </div>
  `;

  // Left side: icon first, then text. Right side: text first, then icon (mirror layout)
  if (side === 'right') {
    card.innerHTML = infoBoxHtml + iconBoxHtml;
  } else {
    card.innerHTML = iconBoxHtml + infoBoxHtml;
  }

  return card;
}

function renderEquipment(equipment, char) {
  const avgIlvl = char.equippedItemLevel || char.avgItemLevel || calculateAverageIlvl(equipment);

  // Update Sheet Summary Top
  if (el.sheetCharName) el.sheetCharName.textContent = (char.name || 'Räzâer').toUpperCase();
  if (el.sheetCharSubtitle) el.sheetCharSubtitle.textContent = `${char.class || 'Guerreiro'} Nível ${char.level || 90} • ${char.realm || 'Silvermoon'}`;
  if (el.sheetIlvlNum) el.sheetIlvlNum.textContent = avgIlvl;
  if (el.sheetIlvlSub) el.sheetIlvlSub.textContent = `Equipado: ${avgIlvl}`;

  // Populate Left Column
  if (el.paperdollLeft) {
    el.paperdollLeft.innerHTML = '';
    LEFT_SLOTS.forEach(slot => {
      const card = createPaperdollSlotCard(slot, equipment[slot], 'left');
      el.paperdollLeft.appendChild(card);
    });
  }

  // Populate Right Column
  if (el.paperdollRight) {
    el.paperdollRight.innerHTML = '';
    RIGHT_SLOTS.forEach(slot => {
      const card = createPaperdollSlotCard(slot, equipment[slot], 'right');
      el.paperdollRight.appendChild(card);
    });
  }

  // Populate Bottom Weapon Slots
  if (el.paperdollWeapons) {
    el.paperdollWeapons.innerHTML = '';
    BOTTOM_SLOTS.forEach(slot => {
      const item = equipment[slot];
      if (item || slot !== 'Ranged') {
        const card = createPaperdollSlotCard(slot, item, 'bottom');
        el.paperdollWeapons.appendChild(card);
      }
    });
  }

  // Attributes Panel
  const stats = char.stats || {};
  if (el.statStr) el.statStr.textContent = (stats.strength || 2450).toLocaleString();
  if (el.statSta) el.statSta.textContent = (stats.stamina || 3890).toLocaleString();
  if (el.statArm) el.statArm.textContent = (stats.armor || 8120).toLocaleString();
  if (el.statCrit) el.statCrit.textContent = `${(stats.crit || 18.4).toFixed(1)}%`;
  if (el.statHaste) el.statHaste.textContent = `${(stats.haste || 14.2).toFixed(1)}%`;
  if (el.statMas) el.statMas.textContent = `${(stats.mastery || 32.8).toFixed(1)}%`;
  if (el.statVers) el.statVers.textContent = `${(stats.versatility || 6.5).toFixed(1)}%`;

  if (window.$WowheadPower && window.$WowheadPower.refreshLinks) {
    setTimeout(() => window.$WowheadPower.refreshLinks(), 60);
  }
}

// =========================================================================
// Categorized Bags & Upgrade Comparison Engine
// =========================================================================

const EQUIP_LOC_TO_SLOTS = {
  INVTYPE_HEAD: ['Head'],
  INVTYPE_NECK: ['Neck'],
  INVTYPE_SHOULDER: ['Shoulder'],
  INVTYPE_CLOAK: ['Back'],
  INVTYPE_CHEST: ['Chest'],
  INVTYPE_ROBE: ['Chest'],
  INVTYPE_BODY: ['Shirt'],
  INVTYPE_TABARD: ['Tabard'],
  INVTYPE_WRIST: ['Wrist'],
  INVTYPE_HAND: ['Hands'],
  INVTYPE_WAIST: ['Waist'],
  INVTYPE_LEGS: ['Legs'],
  INVTYPE_FEET: ['Feet'],
  INVTYPE_FINGER: ['Finger1', 'Finger2'],
  INVTYPE_TRINKET: ['Trinket1', 'Trinket2'],
  INVTYPE_WEAPON: ['MainHand', 'SecondaryHand'],
  INVTYPE_2HWEAPON: ['MainHand'],
  INVTYPE_WEAPONMAINHAND: ['MainHand'],
  INVTYPE_WEAPONOFFHAND: ['SecondaryHand'],
  INVTYPE_SHIELD: ['SecondaryHand'],
  INVTYPE_HOLDABLE: ['SecondaryHand'],
  INVTYPE_RANGED: ['Ranged'],
  INVTYPE_THROWN: ['Ranged']
};

function getSlotComparison(bagItem, equipment) {
  if (!bagItem || !equipment) return null;

  let equipLoc = bagItem.equipLoc;
  if (!equipLoc) {
    const n = (bagItem.name || '').toLowerCase();
    if (n.includes('mask') || n.includes('helm') || n.includes('crown') || n.includes('cap') || n.includes('goggles')) equipLoc = 'INVTYPE_HEAD';
    else if (n.includes('cuirass') || n.includes('breastplate') || n.includes('vest') || n.includes('robe') || n.includes('tunic')) equipLoc = 'INVTYPE_CHEST';
    else if (n.includes('greaves') || n.includes('leggings') || n.includes('pants') || n.includes('breeches')) equipLoc = 'INVTYPE_LEGS';
    else if (n.includes('pauldrons') || n.includes('spaulders') || n.includes('shoulder')) equipLoc = 'INVTYPE_SHOULDER';
    else if (n.includes('gauntlets') || n.includes('gloves') || n.includes('handguards')) equipLoc = 'INVTYPE_HAND';
    else if (n.includes('boots') || n.includes('sabatons') || n.includes('greatboots') || n.includes('treads')) equipLoc = 'INVTYPE_FEET';
    else if (n.includes('greatbelt') || n.includes('belt') || n.includes('girdle') || n.includes('cinch')) equipLoc = 'INVTYPE_WAIST';
    else if (n.includes('bracers') || n.includes('wristguards') || n.includes('cuffs')) equipLoc = 'INVTYPE_WRIST';
    else if (n.includes('band') || n.includes('ring') || n.includes('signet') || n.includes('loop')) equipLoc = 'INVTYPE_FINGER';
    else if (n.includes('trinket') || n.includes('shell') || n.includes('keepsake') || n.includes('charm') || n.includes('sapling') || n.includes('venomstone')) equipLoc = 'INVTYPE_TRINKET';
    else if (n.includes('cloak') || n.includes('burnous') || n.includes('cape') || n.includes('drape')) equipLoc = 'INVTYPE_CLOAK';
    else if (n.includes('necklace') || n.includes('amulet') || n.includes('graft') || n.includes('choker') || n.includes('pendant')) equipLoc = 'INVTYPE_NECK';
    else if (n.includes('cleaver') || n.includes('sword') || n.includes('axe') || n.includes('mace') || n.includes('dagger')) equipLoc = 'INVTYPE_WEAPON';
    else if (n.includes('stecktarge') || n.includes('shield') || n.includes('buckler')) equipLoc = 'INVTYPE_SHIELD';
  }

  const candidateSlots = EQUIP_LOC_TO_SLOTS[equipLoc];
  if (!candidateSlots || candidateSlots.length === 0) return null;

  let bagIlvl = bagItem.itemLevel || 0;
  if (!bagIlvl) {
    if (bagItem.quality === 4) bagIlvl = 321;
    else if (bagItem.quality === 3) bagIlvl = 295;
    else if (bagItem.quality === 2) bagIlvl = 275;
  }
  if (bagIlvl <= 1) return null;

  let bestSlot = null;
  let lowestEquippedIlvl = 99999;
  let targetEquippedItem = null;

  for (const slot of candidateSlots) {
    const eqItem = equipment[slot];
    const eqIlvl = eqItem ? (eqItem.itemLevel || 0) : 0;
    if (eqIlvl < lowestEquippedIlvl) {
      lowestEquippedIlvl = eqIlvl;
      bestSlot = slot;
      targetEquippedItem = eqItem;
    }
  }

  if (!bestSlot) return null;

  const diff = bagIlvl - lowestEquippedIlvl;
  const isUpgrade = diff > 0;
  const slotLabel = SLOT_LABELS[bestSlot] || bestSlot;

  return {
    slot: bestSlot,
    slotLabel: slotLabel,
    equippedItem: targetEquippedItem,
    equippedIlvl: lowestEquippedIlvl,
    bagIlvl: bagIlvl,
    diff: diff,
    isUpgrade: isUpgrade
  };
}

function getItemCategory(item) {
  if (!item) return 'util';
  if (item.quality === 0) return 'junk';

  // Check if equipment
  if (item.classID === 2 || item.classID === 4 || item.equipLoc) {
    return 'gear';
  }
  const n = (item.name || '').toLowerCase();
  const gearKeywords = ['helm', 'mask', 'cuirass', 'greaves', 'pauldrons', 'gauntlets', 'sabatons', 'greatboots', 'bracers', 'signet', 'ring', 'band', 'venomstone', 'cleaver', 'shield', 'stecktarge', 'burnous', 'graft', 'amulet'];
  for (const kw of gearKeywords) {
    if (n.includes(kw) && item.quality >= 2) return 'gear';
  }

  if (item.classID === 12 || n.includes('quest') || n.includes('tome of')) return 'quest';
  if (item.classID === 0 || n.includes('potion') || n.includes('elixir') || n.includes('flask') || n.includes('water') || n.includes('delight') || n.includes('juice') || n.includes('jerky') || n.includes('keg') || n.includes('shark')) return 'consumable';
  if (item.classID === 8 || n.includes('gem') || n.includes('rune') || n.includes('enchant')) return 'gem';
  if (item.classID === 7 || n.includes('ore') || n.includes('leather') || n.includes('root') || n.includes('slab') || n.includes('cloth') || n.includes('herb') || n.includes('slime')) return 'reagent';
  if (n.includes('hearthstone') || n.includes('torch') || n.includes('key') || n.includes('charm') || n.includes('keepsake') || n.includes('mark of honor')) return 'util';

  return 'util';
}

const BAG_CATEGORIES = [
  { id: 'gear', label: 'Equipamento & Armas', icon: '⚔️' },
  { id: 'consumable', label: 'Consumíveis & Poções', icon: '🧪' },
  { id: 'reagent', label: 'Profissões & Reagentes', icon: '⛏️' },
  { id: 'gem', label: 'Gemas & Melhorias', icon: '💎' },
  { id: 'quest', label: 'Missões', icon: '📜' },
  { id: 'util', label: 'Utilidades & Diversos', icon: '🧰' },
  { id: 'junk', label: 'Lixo / Vender ao Comerciante', icon: '🪙' }
];

function renderBags(bags, equipment) {
  if (!el.categorizedBagWrapper) return;

  const totalSlots = bags.totalSlots || 0;
  const freeSlots = bags.freeSlots || 0;
  if (el.freeSlotsCounter) {
    el.freeSlotsCounter.textContent = `${freeSlots}/${totalSlots}`;
  }

  let items = bags.items || [];
  if (!Array.isArray(items)) items = Object.values(items);

  // Economy & Junk Calculation
  const allBagItems = Array.isArray(bags.items) ? bags.items : Object.values(bags.items || {});
  let totalJunkCount = 0;
  let totalJunkValue = 0;
  allBagItems.forEach(it => {
    if ((it.quality === 0) || it.isJunk) {
      const c = it.count || 1;
      totalJunkCount += c;
      totalJunkValue += (it.sellPrice || 0) * c;
    }
  });

  const junkEl = document.getElementById('junk-total-val');
  if (junkEl) {
    const jGold = Math.floor(totalJunkValue / 10000);
    const jSilver = Math.floor((totalJunkValue % 10000) / 100);
    const jCopper = totalJunkValue % 100;
    junkEl.textContent = `${totalJunkCount} itens • ${jGold}g ${jSilver}s ${jCopper}c`;
  }

  // Session Gold Profit
  if (state.characterData && state.characterData.character && state.characterData.character.money) {
    const curMoney = state.characterData.character.money.total || 0;
    if (state.sessionStartMoney === undefined || state.sessionStartMoney === null) {
      state.sessionStartMoney = curMoney;
    }
    const diff = curMoney - state.sessionStartMoney;
    const profitEl = document.getElementById('session-profit-val');
    const profitSub = document.getElementById('session-profit-sub');
    if (profitEl) {
      const sign = diff >= 0 ? '+' : '-';
      const absDiff = Math.abs(diff);
      const pGold = Math.floor(absDiff / 10000);
      const pSilver = Math.floor((absDiff % 10000) / 100);
      profitEl.textContent = `${sign}${pGold}g ${pSilver}s`;
      profitEl.className = `econ-val ${diff >= 0 ? 'profit-positive' : 'profit-negative'}`;
    }
    if (profitSub) {
      const sGold = Math.floor(state.sessionStartMoney / 10000);
      profitSub.textContent = `Início da sessão: ${sGold}g`;
    }
  }

  const highlightJunkBtn = document.getElementById('btn-highlight-junk');
  if (highlightJunkBtn && !highlightJunkBtn._bound) {
    highlightJunkBtn._bound = true;
    highlightJunkBtn.addEventListener('click', () => {
      playTactileClick();
      if (el.bagQualityFilter) {
        el.bagQualityFilter.value = '0';
        el.bagQualityFilter.dispatchEvent(new Event('change'));
      }
      showToast('🗑️ Filtro de lixo (itens cinzentos) ativo!');
    });
  }

  // Filter by search query
  const query = (el.bagSearchInput ? el.bagSearchInput.value : '').trim().toLowerCase();
  if (query) {
    items = items.filter(it => it.name && it.name.toLowerCase().includes(query));
  }

  // Filter by quality dropdown
  const qFilter = el.bagQualityFilter ? el.bagQualityFilter.value : 'all';
  if (qFilter !== 'all') {
    const qNum = parseInt(qFilter, 10);
    items = items.filter(it => (it.quality || 1) === qNum);
  }

  // Analyze all items, attach category and comparison info
  const categorized = {
    gear: [], consumable: [], reagent: [], gem: [], quest: [], util: [], junk: []
  };

  let totalUpgrades = 0;
  const upgradeItems = [];

  items.forEach(it => {
    const cat = getItemCategory(it);
    const comparison = (cat === 'gear') ? getSlotComparison(it, equipment) : null;
    it._comparison = comparison;
    it._category = cat;

    if (comparison && comparison.isUpgrade) {
      totalUpgrades++;
      upgradeItems.push(it);
    }

    if (categorized[cat]) {
      categorized[cat].push(it);
    } else {
      categorized.util.push(it);
    }
  });

  // Render Filter Chips
  if (el.categoryChipsBar) {
    el.categoryChipsBar.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = `cat-chip ${state.bagCategoryFilter === 'all' ? 'active' : ''}`;
    allBtn.innerHTML = `🎒 Todos <span class="chip-count">${items.length}</span>`;
    allBtn.addEventListener('click', () => { state.bagCategoryFilter = 'all'; renderBags(bags, equipment); });
    el.categoryChipsBar.appendChild(allBtn);

    if (totalUpgrades > 0) {
      const upBtn = document.createElement('button');
      upBtn.className = `cat-chip upgrade-chip ${state.bagCategoryFilter === 'upgrades' ? 'active' : ''}`;
      upBtn.innerHTML = `⭐ Melhorias <span class="chip-count glow">${totalUpgrades}</span>`;
      upBtn.addEventListener('click', () => { state.bagCategoryFilter = 'upgrades'; renderBags(bags, equipment); });
      el.categoryChipsBar.appendChild(upBtn);
    }

    BAG_CATEGORIES.forEach(catDef => {
      const count = categorized[catDef.id]?.length || 0;
      if (count > 0) {
        const btn = document.createElement('button');
        btn.className = `cat-chip ${state.bagCategoryFilter === catDef.id ? 'active' : ''}`;
        btn.innerHTML = `${catDef.icon} ${catDef.label.split(' ')[0]} <span class="chip-count">${count}</span>`;
        btn.addEventListener('click', () => { state.bagCategoryFilter = catDef.id; renderBags(bags, equipment); });
        el.categoryChipsBar.appendChild(btn);
      }
    });
  }

  // Populate Categorized List
  el.categorizedBagWrapper.innerHTML = '';

  if (items.length === 0) {
    el.categorizedBagWrapper.innerHTML = '<div class="empty-bag-notice">Mochila vazia ou nenhum item corresponde ao filtro.</div>';
    return;
  }

  // View: Only Upgrades
  if (state.bagCategoryFilter === 'upgrades') {
    renderCategorySection({ id: 'upgrades', label: '⭐ Peças com Melhoria de Item Level (Prontas a Equipar)', icon: '⭐' }, upgradeItems);
    return;
  }

  // View: Single Category
  if (state.bagCategoryFilter !== 'all') {
    const catDef = BAG_CATEGORIES.find(c => c.id === state.bagCategoryFilter) || { id: state.bagCategoryFilter, label: 'Itens', icon: '📦' };
    renderCategorySection(catDef, categorized[state.bagCategoryFilter] || []);
    return;
  }

  // View: All (Render sections in order)
  BAG_CATEGORIES.forEach(catDef => {
    const list = categorized[catDef.id] || [];
    if (list.length > 0) {
      renderCategorySection(catDef, list);
    }
  });

  function renderCategorySection(catDef, list) {
    // Sort items: Upgrades first, then quality desc, then ilvl desc
    list.sort((a, b) => {
      const aUp = a._comparison?.isUpgrade ? 1 : 0;
      const bUp = b._comparison?.isUpgrade ? 1 : 0;
      if (aUp !== bUp) return bUp - aUp;
      if ((b.quality || 1) !== (a.quality || 1)) return (b.quality || 1) - (a.quality || 1);
      return (b.itemLevel || 0) - (a.itemLevel || 0);
    });

    const section = document.createElement('div');
    section.className = 'bag-cat-section';

    const header = document.createElement('div');
    header.className = 'bag-cat-header';
    header.innerHTML = `
      <div class="cat-header-title">
        <span class="cat-h-icon">${catDef.icon}</span>
        <span class="cat-h-label">${catDef.label}</span>
        <span class="cat-h-badge">${list.length}</span>
      </div>
    `;
    section.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'bag-cat-grid';

    list.forEach(item => {
      const iconUrl = getItemIconUrl(item);
      const comparison = item._comparison;

      const card = document.createElement('a');
      card.className = `categorized-item-card q-${item.quality || 1} ${comparison?.isUpgrade ? 'upgrade-shimmer' : ''}`;

      const whParams = buildWowheadItemParams(item);
      if (whParams) {
        card.href = `https://www.wowhead.com/${whParams}`;
        card.setAttribute('data-wowhead', whParams);
        card.setAttribute('data-wh-rename-link', 'false');
        card.addEventListener('click', (e) => { e.preventDefault(); });
      }

      let comparisonHtml = '';
      if (comparison) {
        if (comparison.isUpgrade) {
          comparisonHtml = `
            <div class="card-comp-row upgrade">
              <span class="comp-tag-badge upgrade-tag">▲ +${comparison.diff} ilvl (Melhoria!)</span>
              <span class="comp-sub-lbl">Substitui: ${comparison.equippedItem ? comparison.equippedItem.name : 'Vazio'} (${comparison.equippedIlvl} ➔ ${comparison.bagIlvl})</span>
            </div>
          `;
        } else if (comparison.diff < 0) {
          comparisonHtml = `
            <div class="card-comp-row downgrade">
              <span class="comp-tag-badge downgrade-tag">▼ ${comparison.diff} ilvl</span>
              <span class="comp-sub-lbl">Inferior a ${comparison.equippedItem ? comparison.equippedItem.name : 'Equipado'} (${comparison.equippedIlvl})</span>
            </div>
          `;
        } else {
          comparisonHtml = `
            <div class="card-comp-row equal">
              <span class="comp-tag-badge equal-tag">= Mesmo ilvl</span>
              <span class="comp-sub-lbl">Igual a ${comparison.equippedItem ? comparison.equippedItem.name : 'Equipado'} (${comparison.bagIlvl})</span>
            </div>
          `;
        }
      }

      card.innerHTML = `
        <div class="card-icon-box q-${item.quality || 1}">
          <img class="item-icon-img" src="${iconUrl || ''}" alt="" style="${iconUrl ? '' : 'display:none;'}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
          <span class="icon-fallback" style="${iconUrl ? 'display:none;' : ''}">📦</span>
          ${item.count > 1 ? `<span class="bag-stack">x${item.count}</span>` : ''}
          ${comparison?.isUpgrade ? '<span class="upgrade-corner-star">⭐</span>' : ''}
        </div>
        <div class="card-info-box">
          <div class="card-title-line">
            <span class="card-item-name q-${item.quality || 1}">${item.name}</span>
            ${item.itemLevel && item.itemLevel > 1 ? `<span class="card-item-ilvl">ilvl ${item.itemLevel}</span>` : ''}
          </div>
          ${comparisonHtml ? comparisonHtml : `
            <div class="card-meta-line">
              <span class="card-bag-slot">Bolsa ${item.bag} • Slot ${item.slot}</span>
            </div>
          `}
        </div>
      `;

      grid.appendChild(card);
    });

    section.appendChild(grid);
    el.categorizedBagWrapper.appendChild(section);
  }

  if (window.$WowheadPower && window.$WowheadPower.refreshLinks) {
    setTimeout(() => window.$WowheadPower.refreshLinks(), 60);
  }
}

// =========================================================================
// Quests Renderer
// =========================================================================

function renderQuests(quests) {
  if (!el.questsList) return;
  const list = Array.isArray(quests) ? quests : Object.values(quests || {});
  if (el.questCount) el.questCount.textContent = `${list.length} ativas`;
  el.questsList.innerHTML = '';

  if (list.length === 0) {
    el.questsList.innerHTML = '<div style="color: #8b9bb4; text-align: center; padding: 30px; font-size: 15px;">📜 Nenhuma missão ativa registada.<br><span style="font-size: 13px; color: #5a6e85; margin-top: 8px; display: inline-block;">(Quando aceitares missões no WoW, escreve <code>/wc save</code> ou faz <code>/reload</code>)</span></div>';
    return;
  }

  list.forEach(q => {
    const isTracked = (activeTrackedQuestId && Number(q.questID) === Number(activeTrackedQuestId));
    const card = document.createElement('div');
    card.className = `quest-card ${q.isComplete ? 'completed' : ''} ${isTracked ? 'is-tracked-active' : ''}`;

    let objectivesHtml = '';
    if (q.objectives && q.objectives.length > 0) {
      objectivesHtml = q.objectives.map(obj => `
        <div class="quest-obj-item ${obj.finished ? 'done' : ''}">
          <span class="quest-obj-check">${obj.finished ? '✓' : '○'}</span>
          <span class="quest-obj-text">${obj.text}</span>
          ${obj.numRequired && obj.numRequired > 1 ? `<span class="quest-obj-count">(${obj.numFulfilled || 0}/${obj.numRequired})</span>` : ''}
        </div>
      `).join('');
    }

    const safeTitle = (q.title || `Missão #${q.questID}`).replace(/'/g, "\\'");

    card.innerHTML = `
      <div class="quest-header">
        <div class="quest-title-wrap">
          <a href="https://www.wowhead.com/quest=${q.questID}" target="_blank" data-wowhead="quest=${q.questID}" class="quest-title-link">
            ${q.title}
          </a>
          ${q.level ? `<span class="quest-lvl-badge">Nvl ${q.level}</span>` : ''}
        </div>
        <div class="quest-header-badges">
          ${isTracked ? '<span class="badge badge-tracked">🎯 A Seguir</span>' : ''}
          ${q.isComplete ? '<span class="badge" style="background:#27ae60; color:#fff;">✓ Pronta</span>' : ''}
        </div>
      </div>
      
      ${objectivesHtml ? `<div class="quest-objectives">${objectivesHtml}</div>` : ''}
      
      <div class="quest-action-bar">
        <button class="btn-quest-action btn-track-quest ${isTracked ? 'active' : ''}" onclick="trackQuest(${q.questID}, '${safeTitle}')">
          ${isTracked ? '🎯 A Seguir no WoW' : '📍 Seguir no WoW'}
        </button>
        <a href="https://www.wowhead.com/quest=${q.questID}#comments" target="_blank" class="btn-quest-action btn-wowhead-guide" title="Ver soluções, coordenadas e dicas no Wowhead">
          📖 Guia & Dicas (Wowhead) ↗
        </a>
      </div>
    `;

    el.questsList.appendChild(card);
  });

  if (window.$WowheadPower && window.$WowheadPower.refreshLinks) {
    window.$WowheadPower.refreshLinks();
  }
}

// =========================================================================
// Tank Assistant & Dungeon/Raid Companion
// =========================================================================

const alertTimestamps = {};
let lastGlobalSpokenTime = 0;

function setVoiceAlerts(enabled, persist = true) {
  state.voiceAlertsEnabled = Boolean(enabled);
  if (persist) {
    try { localStorage.setItem('wow_voice_alerts', state.voiceAlertsEnabled ? 'true' : 'false'); } catch(e) {}
  }
  if (!state.voiceAlertsEnabled && 'speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch(e) {}
  }
  if (el.tankVoiceBtn) {
    el.tankVoiceBtn.classList.toggle('active', state.voiceAlertsEnabled);
  }
  if (el.tankVoiceIcon) {
    el.tankVoiceIcon.textContent = state.voiceAlertsEnabled ? '🔊' : '🔇';
  }
  if (el.tankVoiceLabel) {
    el.tankVoiceLabel.textContent = state.voiceAlertsEnabled ? 'Voz Ativa' : 'Voz Silenciada';
  }
  const settingsVoiceToggle = document.getElementById('settings-voice-toggle');
  if (settingsVoiceToggle) {
    settingsVoiceToggle.checked = state.voiceAlertsEnabled;
  }
}

function speakAlert(text, alertKey = 'general', minCooldownMs = 45000) {
  if (!state.voiceAlertsEnabled) {
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch(e) {}
    }
    return;
  }
  const now = Date.now();
  // Global cooldown: prevent talking more than once every 12 seconds
  if (now - lastGlobalSpokenTime < 12000) return;
  // Per-alert cooldown: never repeat the same alert type in under minCooldownMs (default 45s)
  const lastThisAlert = alertTimestamps[alertKey] || 0;
  if (now - lastThisAlert < minCooldownMs) return;

  lastGlobalSpokenTime = now;
  alertTimestamps[alertKey] = now;

  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'pt-PT';
      utter.rate = 1.0;
      utter.pitch = 1.0;
      window.speechSynthesis.speak(utter);
    } catch(e) {}
  }
}


// =========================================================================
// Real-Time DPS Rotation & Combat Deck Logic
// =========================================================================

let currentCombatMode = 'auto'; // 'auto', 'tank', 'dps'

function updateCombatModeDisplay(role) {
  let effectiveMode = currentCombatMode;
  if (effectiveMode === 'auto') {
    if (role === 'TANK') effectiveMode = 'tank';
    else if (role === 'HEALER') effectiveMode = 'healer';
    else effectiveMode = 'dps';
  }

  const tankGrid = document.querySelector('.tank-realtime-grid');
  const dpsDeck = document.getElementById('dps-rotation-deck');
  const healerDeck = document.getElementById('healer-command-deck');
  const panelTitle = document.getElementById('combat-panel-title');
  const roleToggleLabel = document.getElementById('role-toggle-label');
  const roleToggleIcon = document.getElementById('role-toggle-icon');
  const combatNavIcon = document.getElementById('combat-nav-icon');
  const combatNavLabel = document.getElementById('combat-nav-label');

  if (effectiveMode === 'tank') {
    if (tankGrid) tankGrid.style.display = 'grid';
    if (dpsDeck) dpsDeck.style.display = 'none';
    if (healerDeck) healerDeck.style.display = 'none';
    if (panelTitle) panelTitle.textContent = '🛡️ Tank Assistant & Masmorras';
    if (roleToggleLabel) roleToggleLabel.textContent = 'Modo: Tank';
    if (roleToggleIcon) roleToggleIcon.textContent = '🛡️';
    if (combatNavIcon) combatNavIcon.textContent = '🛡️';
    if (combatNavLabel) combatNavLabel.textContent = 'Tank HUD';
  } else if (effectiveMode === 'healer') {
    if (tankGrid) tankGrid.style.display = 'none';
    if (dpsDeck) dpsDeck.style.display = 'none';
    if (healerDeck) healerDeck.style.display = 'grid';
    if (panelTitle) panelTitle.textContent = '💚 Healer Deck: Triage & Curas Live';
    if (roleToggleLabel) roleToggleLabel.textContent = 'Modo: Healer';
    if (roleToggleIcon) roleToggleIcon.textContent = '💚';
    if (combatNavIcon) combatNavIcon.textContent = '💚';
    if (combatNavLabel) combatNavLabel.textContent = 'Healer Deck';
  } else {
    if (tankGrid) tankGrid.style.display = 'none';
    if (dpsDeck) dpsDeck.style.display = 'grid';
    if (healerDeck) healerDeck.style.display = 'none';
    if (panelTitle) panelTitle.textContent = '⚔️ Combat Deck: Rotação DPS ao Vivo';
    if (roleToggleLabel) roleToggleLabel.textContent = 'Modo: DPS Live';
    if (roleToggleIcon) roleToggleIcon.textContent = '⚔️';
    if (combatNavIcon) combatNavIcon.textContent = '⚔️';
    if (combatNavLabel) combatNavLabel.textContent = 'DPS Rotação';
  }
}



// --- Wowhead Spell Icon Resolver & Dynamic Cache ---
const clientSpellCache = {};

function getSpellIconUrl(iconVal, spellId) {
  if (typeof iconVal === 'string' && iconVal.length > 0 && isNaN(Number(iconVal))) {
    return `https://wow.zamimg.com/images/wow/icons/large/${iconVal}.jpg`;
  }
  if (spellId && clientSpellCache[String(spellId)] && clientSpellCache[String(spellId)].icon) {
    return `https://wow.zamimg.com/images/wow/icons/large/${clientSpellCache[String(spellId)].icon}.jpg`;
  }
  return null;
}

function resolveWowheadSpell(spellId, callback) {
  if (!spellId || spellId <= 0) return;
  if (clientSpellCache[String(spellId)]) {
    if (!clientSpellCache[String(spellId)].pending && callback) {
      callback(clientSpellCache[String(spellId)]);
    }
    return;
  }
  clientSpellCache[String(spellId)] = { pending: true };
  
  fetch(`/api/wowhead/spell/${spellId}`)
    .then(r => r.ok ? r.json() : Promise.reject())
    .catch(() => fetch(`https://nether.wowhead.com/tooltip/spell/${spellId}`).then(r => r.json()))
    .then(data => {
      if (data && data.icon) {
        clientSpellCache[String(spellId)] = { name: data.name || '', icon: data.icon };
        if (callback) callback(clientSpellCache[String(spellId)]);
      }
    })
    .catch(() => {});
}

function applyHealerTelemetry(healer, telemetry) {
  if (!healer) return;

  const mainCard = document.getElementById('healer-main-card');
  const triageName = document.getElementById('healer-triage-name');
  const triageBadge = document.getElementById('healer-triage-class-badge');
  const triageHpPct = document.getElementById('healer-triage-hp-pct');
  const triageHpFill = document.getElementById('healer-triage-hp-fill');

  const spellNameEl = document.getElementById('healer-spell-name');
  const keybindEl = document.getElementById('healer-keybind');
  const rationaleEl = document.getElementById('healer-rationale');
  const iconImg = document.getElementById('healer-spell-icon-img');
  const iconFallback = document.getElementById('healer-spell-fallback');

  const dispelCard = document.getElementById('healer-dispel-card');
  const dispelTitle = document.getElementById('healer-dispel-title');
  const dispelDesc = document.getElementById('healer-dispel-desc');
  const dispelBtnBox = document.getElementById('healer-dispel-btn-box');
  const dispelKeybind = document.getElementById('healer-dispel-keybind');

  const tankCard = document.getElementById('healer-tank-card');
  const tankPill = document.getElementById('healer-tank-status-pill');
  const tankTxt = document.getElementById('healer-tank-status-txt');
  const tankGuidance = document.getElementById('healer-tank-guidance');

  const aoeCount = document.getElementById('healer-aoe-count');
  const aoeSpell = document.getElementById('healer-aoe-spell');

  // 1. Triage Target & Severity
  const target = healer.triageTarget || { name: 'Equipa Saudável', class: '', idx: 0 };
  const bracket = typeof healer.bracketIdx === 'number' ? healer.bracketIdx : 0;

  if (triageName) triageName.textContent = target.name || 'Aliado';
  if (triageBadge) triageBadge.textContent = target.class || 'PRIORIDADE';

  let hpEst = 100;
  if (bracket === 4) hpEst = 18;
  else if (bracket === 3) hpEst = 32;
  else if (bracket === 2) hpEst = 50;
  else if (bracket === 1) hpEst = 72;
  else hpEst = 100;

  if (triageHpPct) triageHpPct.textContent = `${hpEst}%`;
  if (triageHpFill) triageHpFill.style.width = `${hpEst}%`;

  if (mainCard) {
    if (bracket >= 3) {
      mainCard.classList.add('triage-critical');
    } else {
      mainCard.classList.remove('triage-critical');
    }
  }

  // 2. Recommended Healing Spell & Keybind
  if (healer.nextSpellName || healer.nextKeybind) {
    if (spellNameEl) spellNameEl.textContent = healer.nextSpellName || 'Cura Prioritária';
    if (keybindEl) keybindEl.textContent = healer.nextKeybind || '—';
    if (rationaleEl) rationaleEl.textContent = healer.nextReason || 'Prioridade Triage';

    if (iconImg && iconFallback) {
      const hUrl = getSpellIconUrl(healer.nextIcon, healer.nextSpellId);
      if (hUrl) {
        if (iconImg.src !== hUrl) iconImg.src = hUrl;
        iconImg.style.display = 'block';
        iconFallback.style.display = 'none';
      } else {
        iconImg.style.display = 'none';
        iconFallback.style.display = 'flex';
        if (healer.nextSpellId && healer.nextSpellId > 0) {
          resolveWowheadSpell(healer.nextSpellId, (info) => {
            if (info && info.icon) {
              iconImg.src = `https://wow.zamimg.com/images/wow/icons/large/${info.icon}.jpg`;
              iconImg.style.display = 'block';
              iconFallback.style.display = 'none';
              if (spellNameEl && (spellNameEl.textContent.startsWith('Habilidade #') || !spellNameEl.textContent)) {
                spellNameEl.textContent = info.name || healer.nextSpellName;
              }
            }
          });
        }
      }
    }
  } else {
    if (spellNameEl) spellNameEl.textContent = telemetry.inCombat ? 'Aguardar dano...' : 'Fora de Combate';
    if (keybindEl) keybindEl.textContent = '—';
    if (rationaleEl) rationaleEl.textContent = '✨ Grupo seguro - faz downtime DPS';
  }

  // 3. Dispel Alert
  if (dispelCard) {
    if (healer.dispelAlert) {
      dispelCard.classList.add('alert-active');
      if (dispelTitle) dispelTitle.textContent = '⚡ DISPEL REQUERIDO!';
      if (dispelDesc) dispelDesc.textContent = `${target.name} com ${healer.dispelType || 'Debuff'}`;
      if (dispelBtnBox) dispelBtnBox.classList.remove('hidden');
      if (dispelKeybind) dispelKeybind.textContent = healer.nextKeybind || 'F';
      if (!lastHealerDispelAlert) {
        speakAlert(`Dispel em ${target.name}!`, 'dispel', 45000);
      }
    } else {
      dispelCard.classList.remove('alert-active');
      if (dispelTitle) dispelTitle.textContent = 'SEM DEBUFFS NOCIVOS';
      if (dispelDesc) dispelDesc.textContent = 'Nenhum aliado com debuff nocivo.';
      if (dispelBtnBox) dispelBtnBox.classList.add('hidden');
    }
    lastHealerDispelAlert = Boolean(healer.dispelAlert);
  }

  // 4. Tank Guardian
  if (tankCard && tankPill && tankTxt && tankGuidance) {
    if (healer.tankInDanger) {
      tankCard.classList.add('danger');
      tankPill.className = 'tank-status-pill danger';
      tankTxt.textContent = 'TANK EM PERIGO (<40% HP)!';
      tankGuidance.textContent = '🚨 USA DEFENSIVO EXTERNO AGORA!';
      if (!lastHealerTankDanger) {
        speakAlert('Tank em perigo! Usa defensivo externo!', 'tankDanger', 45000);
      }
    } else {
      tankCard.classList.remove('danger');
      tankPill.className = 'tank-status-pill safe';
      tankTxt.textContent = 'Tank Saudável';
      tankGuidance.textContent = 'Guarda Ironbark / Pain Suppression / Sac para picos de dano (<40% HP).';
    }
    lastHealerTankDanger = Boolean(healer.tankInDanger);
  }

  // 5. AoE Spikes
  if (aoeCount) aoeCount.textContent = healer.aoeSpikeCount || 0;
  if (aoeSpell) {
    if (healer.aoeSpikeActive) {
      aoeSpell.textContent = healer.nextSpellName || 'Cura de Área Recomendada';
      aoeSpell.style.color = '#00e5ff';
    } else {
      aoeSpell.textContent = 'Dano em Grupo Estável';
      aoeSpell.style.color = '#ffffff';
    }
  }
}

function applyDpsTelemetry(dps, telemetry) {
  if (!dps) return;

  const spellNameEl = document.getElementById('dps-spell-name');
  const keybindEl = document.getElementById('dps-keybind');
  const rationaleEl = document.getElementById('dps-rationale');
  const iconImg = document.getElementById('dps-spell-icon-img');
  const iconFallback = document.getElementById('dps-spell-fallback');
  const mainCard = document.getElementById('dps-main-card');

  const queueNameEl = document.getElementById('dps-queue-name');
  const queueKeybindEl = document.getElementById('dps-queue-keybind');
  const queueIconImg = document.getElementById('dps-queue-icon-img');
  const queueFallback = document.getElementById('dps-queue-fallback');
  const queueCard = document.getElementById('dps-queue-card');

  const tarHpFill = document.getElementById('dps-target-hp-fill');
  const tarHpText = document.getElementById('dps-target-hp-text');
  const executeBanner = document.getElementById('dps-execute-alert');

  // 1. Primary Next Spell to cast
  if (dps.nextSpellName || dps.nextKeybind) {
    if (spellNameEl) spellNameEl.textContent = dps.nextSpellName || 'Ataque Prioritário';
    if (keybindEl) keybindEl.textContent = dps.nextKeybind || '—';
    if (rationaleEl) rationaleEl.textContent = dps.nextReason || 'Prioridade Ótima';

    if (spellNameEl && dps.nextSpellName) {
      let resolvedName = dps.nextSpellName;
      if (resolvedName.startsWith('Habilidade #') && dps.nextSpellId && clientSpellCache[String(dps.nextSpellId)]?.name) {
        resolvedName = clientSpellCache[String(dps.nextSpellId)].name;
      }
      spellNameEl.textContent = resolvedName;
    }

    if (iconImg && iconFallback) {
      const dUrl = getSpellIconUrl(dps.nextIcon, dps.nextSpellId);
      if (dUrl) {
        if (iconImg.src !== dUrl) iconImg.src = dUrl;
        iconImg.style.display = 'block';
        iconFallback.style.display = 'none';
      } else {
        iconImg.style.display = 'none';
        iconFallback.style.display = 'flex';
        if (dps.nextSpellId && dps.nextSpellId > 0) {
          resolveWowheadSpell(dps.nextSpellId, (info) => {
            if (info && info.icon) {
              iconImg.src = `https://wow.zamimg.com/images/wow/icons/large/${info.icon}.jpg`;
              iconImg.style.display = 'block';
              iconFallback.style.display = 'none';
              if (spellNameEl && (spellNameEl.textContent.startsWith('Habilidade #') || !spellNameEl.textContent)) {
                spellNameEl.textContent = info.name || dps.nextSpellName;
              }
            }
          });
        }
      }
    }

    if (mainCard) {
      mainCard.classList.add('has-spell');
      const isExec = dps.nextReason && dps.nextReason.toLowerCase().includes('execute');
      mainCard.classList.toggle('execute-proc', Boolean(isExec));
    }
  } else {
    if (spellNameEl) spellNameEl.textContent = telemetry.inCombat ? 'A aguardar GCD...' : 'Fora de Combate';
    if (keybindEl) keybindEl.textContent = '—';
    if (rationaleEl) rationaleEl.textContent = 'Seleciona um alvo e ataca para ver a rotação';
    if (mainCard) {
      mainCard.classList.remove('has-spell', 'execute-proc');
    }
  }

  // 2. Queue Spell Preview (+1)
  if (dps.queueSpellName || dps.queueKeybind) {
    if (queueNameEl) queueNameEl.textContent = dps.queueSpellName || '';
    if (queueKeybindEl) queueKeybindEl.textContent = dps.queueKeybind || '—';
    if (queueNameEl && dps.queueSpellName) {
      let resolvedQ = dps.queueSpellName;
      if (resolvedQ.startsWith('Habilidade #') && dps.queueSpellId && clientSpellCache[String(dps.queueSpellId)]?.name) {
        resolvedQ = clientSpellCache[String(dps.queueSpellId)].name;
      }
      queueNameEl.textContent = resolvedQ;
    }

    if (queueIconImg && queueFallback) {
      const qUrl = getSpellIconUrl(dps.queueIcon, dps.queueSpellId);
      if (qUrl) {
        if (queueIconImg.src !== qUrl) queueIconImg.src = qUrl;
        queueIconImg.style.display = 'block';
        queueFallback.style.display = 'none';
      } else {
        queueIconImg.style.display = 'none';
        queueFallback.style.display = 'flex';
        if (dps.queueSpellId && dps.queueSpellId > 0) {
          resolveWowheadSpell(dps.queueSpellId, (info) => {
            if (info && info.icon) {
              queueIconImg.src = `https://wow.zamimg.com/images/wow/icons/large/${info.icon}.jpg`;
              queueIconImg.style.display = 'block';
              queueFallback.style.display = 'none';
              if (queueNameEl && (queueNameEl.textContent.startsWith('Habilidade #') || !queueNameEl.textContent)) {
                queueNameEl.textContent = info.name || dps.queueSpellName;
              }
            }
          });
        }
      }
    }
    if (queueCard) queueCard.style.opacity = '1';
  } else if (queueCard) {
    if (queueNameEl) queueNameEl.textContent = 'A aguardar fila';
    if (queueKeybindEl) queueKeybindEl.textContent = '—';
    queueCard.style.opacity = '0.6';
  }

  // 3. Target Health & Execute Window Alert (<20%)
  if (telemetry && telemetry.hasTarget) {
    const thp = (typeof telemetry.targetHealthPct === 'number') ? telemetry.targetHealthPct : 100;
    if (tarHpFill) tarHpFill.style.width = `${Math.min(100, Math.max(0, thp))}%`;
    if (tarHpText) tarHpText.textContent = `${Math.round(thp)}%`;
    if (executeBanner) {
      if (thp <= 20) {
        executeBanner.classList.remove('hidden');
      } else {
        executeBanner.classList.add('hidden');
      }
    }
  } else {
    if (tarHpFill) tarHpFill.style.width = '0%';
    if (tarHpText) tarHpText.textContent = 'Sem Alvo';
    if (executeBanner) executeBanner.classList.add('hidden');
  }

  // 4. Healer Mana Mirror in DPS Deck
  const hmFill = document.getElementById('dps-healer-fill');
  const hmNum = document.getElementById('dps-healer-num');
  const healerManaPct = (typeof telemetry.healerManaPct === 'number') ? telemetry.healerManaPct : 100;
  if (hmFill) hmFill.style.width = `${Math.max(0, Math.min(100, healerManaPct))}%`;
  if (hmNum) hmNum.textContent = `${Math.round(healerManaPct)}%`;
}

let lastTankHealerInDanger = false;
let lastTankTauntNeeded = false;
let lastLowManaAlertSpoken = false;

function applyTankTelemetry(tank, telemetry) {
  if (!tank) return;

  // 1. Threat Status
  if (el.threatOrb && el.threatStatusTitle && el.threatStatusSub) {
    if (tank.healerInDanger) {
      el.threatOrb.className = 'threat-orb danger';
      el.threatStatusTitle.textContent = 'PERIGO: AGRO NO HEALER/DPS!';
      el.threatStatusTitle.style.color = '#ff4d4d';
      el.threatStatusSub.textContent = 'Inimigo solto a bater num aliado! Usa Taunt ou Thunder Clap!';
      if (el.radarIndicator) el.radarIndicator.textContent = '🚨 Alerta: Perda de agro na equipa';
      if (!lastTankHealerInDanger) {
        speakAlert('Cuidado! Agro no Healer!', 'agro', 45000);
      }
    } else if (tank.losingThreat) {
      el.threatOrb.className = 'threat-orb warning';
      el.threatStatusTitle.textContent = 'AGRO INSTÁVEL';
      el.threatStatusTitle.style.color = '#f1c40f';
      el.threatStatusSub.textContent = 'A perder ameaça no alvo atual. Gera mais raiva e usa Revenge!';
      if (el.radarIndicator) el.radarIndicator.textContent = '⚠️ Alvo atual: Ameaça a descer';
    } else if (tank.hasThreat) {
      el.threatOrb.className = 'threat-orb safe';
      el.threatStatusTitle.textContent = 'AGRO SEGURO';
      el.threatStatusTitle.style.color = '#2ecc71';
      el.threatStatusSub.textContent = 'Tens o controlo total da ameaça do alvo.';
      if (el.radarIndicator) el.radarIndicator.textContent = '🟢 Alvo atual: Seguro (Tanking)';
    } else {
      el.threatOrb.className = 'threat-orb safe';
      el.threatStatusTitle.textContent = 'SEM AGRO / FORA DE COMBATE';
      el.threatStatusTitle.style.color = '#a4b3ca';
      el.threatStatusSub.textContent = 'Nenhum alvo hostil com ameaça ativa.';
      if (el.radarIndicator) el.radarIndicator.textContent = 'Alvo atual: Neutro';
    }
    lastTankHealerInDanger = Boolean(tank.healerInDanger);
  }

  // 2. Taunt Alert & Co-Tank Stacks
  if (el.tankTauntCard && el.tauntHeadline && el.tauntSubtext && el.coTankStacksNum) {
    el.coTankStacksNum.textContent = tank.coTankStacks || 0;

    if (tank.tauntAlert || (tank.coTankStacks >= 2)) {
      el.tankTauntCard.classList.add('alert-active');
      el.tauntHeadline.textContent = '⚡ FAZ TAUNT AGORA!';
      el.tauntHeadline.style.color = '#ffffff';
      el.tauntSubtext.textContent = `Co-Tank com ${tank.coTankStacks || 2} stacks de debuff / Boss desvirado!`;
      if (!lastTankTauntNeeded) {
        speakAlert('Faz taunt agora!', 'taunt', 45000);
      }
    } else {
      el.tankTauntCard.classList.remove('alert-active');
      if (tank.coTankStacks > 0) {
        el.tauntHeadline.textContent = `CO-TANK: ${tank.coTankStacks}x STACKS`;
        el.tauntHeadline.style.color = '#f1c40f';
        el.tauntSubtext.textContent = 'Vigia os stacks do teu colega tank.';
      } else {
        el.tauntHeadline.textContent = 'CO-TANK NORMAL';
        el.tauntHeadline.style.color = '#ffffff';
        el.tauntSubtext.textContent = 'Sem necessidade de troca imediata.';
      }
      lastTankTauntNeeded = Boolean(tank.tauntAlert || (tank.coTankStacks >= 2));
    }
  }

  // 3. Active Mitigation Tracking (Protection Warrior)
  if (el.mitShieldBlock && el.mitSbStatus) {
    if (tank.shieldBlockActive) {
      el.mitShieldBlock.classList.add('active');
      el.mitSbStatus.textContent = 'ATIVO (Bloqueio 100%)';
    } else {
      el.mitShieldBlock.classList.remove('active');
      el.mitSbStatus.textContent = telemetry.inCombat ? '⚠️ Em falta!' : 'Inativo';
    }
  }

  if (el.mitIgnorePain && el.mitIpStatus) {
    if (tank.ignorePainActive) {
      el.mitIgnorePain.classList.add('active');
      el.mitIpStatus.textContent = 'ATIVO (Absorção)';
    } else {
      el.mitIgnorePain.classList.remove('active');
      el.mitIpStatus.textContent = 'Inativo';
    }
  }

  if (el.mitMajorDef && el.mitMajorStatus) {
    if (tank.majorDefensiveActive) {
      el.mitMajorDef.classList.add('active');
      el.mitMajorStatus.textContent = 'ATIVO (Defesa Máxima)';
    } else {
      el.mitMajorDef.classList.remove('active');
      el.mitMajorStatus.textContent = 'Disponível';
    }
  }

  // 4. Live Healer Mana & Party Vitality Matrix
  const now = Date.now();
  const healerManaPct = (telemetry && typeof telemetry.healerManaPct === 'number') ? telemetry.healerManaPct : 100;
  const healerFill = document.getElementById('healer-mana-fill');
  const healerPctText = document.getElementById('healer-mana-pct');
  const healerWarn = document.getElementById('healer-mana-warning');

  if (healerFill) {
    healerFill.style.width = `${Math.max(0, Math.min(100, healerManaPct))}%`;
    if (healerManaPct < 20) {
      healerFill.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
      if (healerWarn) healerWarn.classList.remove('hidden');
      if (!lastLowManaAlertSpoken) {
        lastLowManaAlertSpoken = true;
        playAlertChime();
        speakAlert('Healer com pouca mana! Espera antes de puxar.', 'mana', 60000);
      }
    } else if (healerManaPct < 40) {
      healerFill.style.background = 'linear-gradient(90deg, #f39c12, #e67e22)';
      if (healerWarn) healerWarn.classList.add('hidden');
    } else {
      if (healerManaPct >= 35) lastLowManaAlertSpoken = false;
      healerFill.style.background = 'linear-gradient(90deg, #1abc9c, #3498db)';
      if (healerWarn) healerWarn.classList.add('hidden');
    }
  }
  if (healerPctText) healerPctText.textContent = `${Math.round(healerManaPct)}%`;

  // 5. Mini-Details: DTPS & Mitigation Uptime
  if (telemetry.inCombat) {
    if (!state.combatStartTime) {
      state.combatStartTime = now;
      state.damageTakenInCombat = 0;
      state.mitigationActiveSec = 0;
      state.lastMitigationTick = now;
      state.lastHealthPct = telemetry.healthPct;
    }
    const elapsedSec = (now - state.combatStartTime) / 1000;
    if (telemetry.healthPct < state.lastHealthPct) {
      state.damageTakenInCombat += (state.lastHealthPct - telemetry.healthPct);
    }
    state.lastHealthPct = telemetry.healthPct;

    const tickDelta = (now - (state.lastMitigationTick || now)) / 1000;
    state.lastMitigationTick = now;
    if (tank.shieldBlockActive || tank.ignorePainActive || tank.majorDefensiveActive) {
      state.mitigationActiveSec += tickDelta;
    }

    if (elapsedSec > 1) {
      const dtpsEst = Math.round((state.damageTakenInCombat / elapsedSec) * 1250);
      const dtpsEl = document.getElementById('live-dtps-val');
      if (dtpsEl) dtpsEl.textContent = `${(dtpsEst / 1000).toFixed(1)}k /s`;

      const mitUptime = Math.min(100, Math.round((state.mitigationActiveSec / elapsedSec) * 100));
      const mitUpEl = document.getElementById('mitigation-uptime-val');
      if (mitUpEl) mitUpEl.textContent = `${mitUptime}%`;
    }
  } else {
    state.combatStartTime = 0;
    state.lastMitigationTick = 0;
  }

  // 6. Auto-detect dungeon from MapID
  if (telemetry && telemetry.mapId && state.tankGuides && state.tankGuides.length > 0) {
    const matched = state.tankGuides.find(inst => inst.mapId === telemetry.mapId);
    if (matched && matched.id !== state.selectedInstanceId) {
      selectTankInstance(matched.id, true);
    }
  }
}

async function loadTankGuides() {
  try {
    const res = await fetch('/api/tank-guides');
    if (res.ok) {
      const data = await res.json();
      if (data && data.instances) {
        initTankHUD(data.instances);
      }
    }
  } catch(e) {
    console.warn('Could not load tank guides:', e);
  }
}

function initTankHUD(instances) {
  if (!instances || instances.length === 0) return;
  state.tankGuides = instances;
  renderTankInstanceSelector();

  // Voice toggle button handler
  if (el.tankVoiceBtn) {
    el.tankVoiceBtn.addEventListener('click', () => {
      setVoiceAlerts(!state.voiceAlertsEnabled, true);
    });
  }
  const settingsVoiceToggle = document.getElementById('settings-voice-toggle');
  if (settingsVoiceToggle) {
    settingsVoiceToggle.checked = state.voiceAlertsEnabled;
    settingsVoiceToggle.addEventListener('change', (e) => {
      setVoiceAlerts(e.target.checked, true);
    });
  }
  // Initialize UI state
  setVoiceAlerts(state.voiceAlertsEnabled, false);

  // Default selection: City of Threads, or first instance
  if (!state.selectedInstanceId) {
    selectTankInstance(instances[0].id, false);
  }
}

function renderTankInstanceSelector() {
  if (!el.tankInstanceSelect || !state.tankGuides) return;
  el.tankInstanceSelect.innerHTML = '';
  state.tankGuides.forEach(inst => {
    const opt = document.createElement('option');
    opt.value = inst.id;
    opt.textContent = `[${inst.type}] ${inst.name} (${inst.expansion})`;
    el.tankInstanceSelect.appendChild(opt);
  });

  el.tankInstanceSelect.addEventListener('change', (e) => {
    selectTankInstance(e.target.value, false);
  });
}

function selectTankInstance(instId, isAutoDetected = false) {
  state.selectedInstanceId = instId;
  state.selectedBossIndex = 0;
  if (el.tankInstanceSelect) el.tankInstanceSelect.value = instId;
  if (el.guideZoneTag) {
    el.guideZoneTag.textContent = isAutoDetected ? '⚡ Auto-Detetada por GPS' : 'Seleção Manual';
    el.guideZoneTag.style.color = isAutoDetected ? '#2ecc71' : '#d4af37';
  }

  const inst = state.tankGuides.find(i => i.id === instId);
  if (!inst) return;

  // Render Trash Notes
  if (el.trashNotesText) {
    el.trashNotesText.textContent = inst.trashNotes || 'Sem notas especiais de trash.';
  }

  // Render Boss Navigation Tabs
  if (el.bossNavTabs) {
    el.bossNavTabs.innerHTML = '';
    (inst.bosses || []).forEach((boss, idx) => {
      const btn = document.createElement('button');
      btn.className = `boss-tab-btn ${idx === 0 ? 'active' : ''}`;
      btn.textContent = `${idx + 1}. ${boss.name}`;
      btn.addEventListener('click', () => selectBoss(idx));
      el.bossNavTabs.appendChild(btn);
    });
  }

  renderBossTactics(0);
  updateMPlusCompanion(state.characterData?.mplus, inst);
}

function selectBoss(idx) {
  state.selectedBossIndex = idx;
  if (el.bossNavTabs) {
    const btns = el.bossNavTabs.querySelectorAll('.boss-tab-btn');
    btns.forEach((b, i) => b.classList.toggle('active', i === idx));
  }
  renderBossTactics(idx);
}

function renderBossTactics(idx) {
  const inst = state.tankGuides.find(i => i.id === state.selectedInstanceId);
  if (!inst || !inst.bosses || !inst.bosses[idx]) return;
  const b = inst.bosses[idx];

  if (el.bossNameTitle) el.bossNameTitle.textContent = b.name;
  if (el.tacticPosDesc) el.tacticPosDesc.textContent = b.position || '-';
  if (el.tacticBusterDesc) el.tacticBusterDesc.textContent = b.tankBuster || '-';
  if (el.tacticTauntDesc) el.tacticTauntDesc.textContent = b.tauntSwap || '-';
  if (el.tacticDangerDesc) el.tacticDangerDesc.textContent = `${b.interrupts ? '⚡ ' + b.interrupts + ' | ' : ''}${b.danger || ''}`;
}

window.addEventListener('DOMContentLoaded', init);
