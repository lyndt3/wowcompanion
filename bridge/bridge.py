#!/usr/bin/env python3
"""
WoW Companion Desktop Bridge (macOS / Windows / Linux)
Version: 2.0.0
- Auto-detects World of Warcraft window position (fullscreen or windowed)
- Captures real-time 12-cell discrete quantized telemetry (100% Display P3 immune)
- Streams live telemetry to Companion Server via WebSocket
- Automatically watches WTF SavedVariables for bags/quests/collections sync
"""

import sys
import os
import glob
import time
import json
import math
import argparse
import asyncio
import threading
import subprocess
import warnings
from typing import Optional, Tuple, Dict, Any

warnings.filterwarnings("ignore")

try:
    import mss
    import websockets
    import requests
except ImportError:
    print("[ERROR] Missing required dependencies.")
    print("Run: pip install -r requirements.txt")
    sys.exit(1)

# Platform channel order
IS_MACOS = sys.platform == "darwin"

def get_pixel_rgb(sct_img, x: int, y: int) -> Tuple[int, int, int]:
    p = sct_img.pixel(x, y)
    if IS_MACOS:
        return p[0], p[1], p[2]
    return p[2], p[1], p[0]

# Magic Sync Header Color: Pure Magenta (255, 0, 255)
NUM_CELLS = 17

GLOBAL_DECODER: Optional['TelemetryDecoder'] = None

def is_sync_color(r: int, g: int, b: int) -> bool:
    return r >= 200 and g <= 55 and b >= 200

# 4-level quantization (0, 85, 170, 255) with +-42 tolerance
def decode_channel(c: int) -> int:
    if c < 43:
        return 0
    elif c < 128:
        return 1
    elif c < 213:
        return 2
    else:
        return 3

def decode_6(r: int, g: int, b: int) -> int:
    return (decode_channel(r) << 4) | (decode_channel(g) << 2) | decode_channel(b)

def get_wow_window_pos() -> Optional[Dict[str, int]]:
    """Auto-detect WoW window position on macOS (windowed mode support)"""
    if not IS_MACOS:
        return None
    try:
        cmd = ['osascript', '-e', 'tell application "System Events" to tell process "World of Warcraft" to get {position, size} of window 1']
        out = subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL, timeout=0.3).strip()
        parts = [int(p.strip()) for p in out.split(',')]
        if len(parts) >= 4:
            return {'x': parts[0], 'y': parts[1], 'w': parts[2], 'h': parts[3]}
    except Exception:
        pass
    return None

import urllib.request

WOWHEAD_CACHE_FILE = os.path.join(os.path.dirname(__file__), "wowhead_cache.json")
WOWHEAD_SPELL_CACHE: Dict[int, dict] = {
    # Warrior
    184367: {"name": "Rampage", "icon": "ability_warrior_rampage"},
    5308: {"name": "Execute", "icon": "inv_sword_48"},
    23881: {"name": "Bloodthirst", "icon": "spell_nature_bloodlust"},
    85288: {"name": "Raging Blow", "icon": "warrior_wild_strike"},
    190411: {"name": "Whirlwind", "icon": "ability_whirlwind"},
    107574: {"name": "Avatar", "icon": "warrior_talent_icon_avatar"},
    1719: {"name": "Recklessness", "icon": "ability_criticalstrike"},
    46924: {"name": "Bladestorm", "icon": "ability_warrior_bladestorm"},
    386633: {"name": "Onslaught", "icon": "ability_warrior_charge"},
    280735: {"name": "Execute", "icon": "inv_sword_48"},
    6544: {"name": "Heroic Leap", "icon": "ability_heroicleap"},
    167105: {"name": "Colossus Smash", "icon": "inv_warbreaker"},
    262161: {"name": "Warbreaker", "icon": "ability_warrior_warbreaker"},
    163201: {"name": "Execute", "icon": "inv_sword_48"},
    12294: {"name": "Mortal Strike", "icon": "ability_warrior_savageblow"},
    7384: {"name": "Overpower", "icon": "ability_meleedamage"},
    1464: {"name": "Slam", "icon": "ability_warrior_decisivestrike"},
    23922: {"name": "Shield Slam", "icon": "inv_shield_05"},
    6343: {"name": "Thunder Clap", "icon": "spell_nature_thunderclap"},
    6572: {"name": "Revenge", "icon": "ability_warrior_revenge"},
    355: {"name": "Taunt", "icon": "spell_nature_reincarnation"},
    132404: {"name": "Shield Block", "icon": "ability_warrior_shieldblock"},
    190456: {"name": "Ignore Pain", "icon": "ability_warrior_shieldbreak"},
    871: {"name": "Shield Wall", "icon": "ability_warrior_shieldwall"},
    12975: {"name": "Last Stand", "icon": "spell_nature_shamanrage"},
    23920: {"name": "Spell Reflection", "icon": "ability_warrior_shieldreflection"},
    # Paladin
    383328: {"name": "Final Verdict", "icon": "spell_paladin_finalverdict"},
    85256: {"name": "Templar's Verdict", "icon": "spell_paladin_templarsverdict"},
    255937: {"name": "Wake of Ashes", "icon": "inv_sword_2h_artifactashbringer_d_01"},
    184575: {"name": "Blade of Justice", "icon": "ability_paladin_bladeofjustice"},
    24275: {"name": "Hammer of Wrath", "icon": "spell_paladin_hammerofwrath"},
    20271: {"name": "Judgment", "icon": "spell_holy_righteousfury"},
    35395: {"name": "Crusader Strike", "icon": "spell_holy_crusaderstrike"},
    20473: {"name": "Holy Shock", "icon": "spell_holy_searinglight"},
    85673: {"name": "Word of Glory", "icon": "spell_holy_wordofglory"},
    19750: {"name": "Flash of Light", "icon": "spell_holy_flashheal"},
    85222: {"name": "Light of Dawn", "icon": "spell_holy_lightofdawn"},
    4987: {"name": "Cleanse", "icon": "spell_holy_purifyingpower"},
    204019: {"name": "Blessed Hammer", "icon": "spell_paladin_blessedhammer"},
    53600: {"name": "Shield of the Righteous", "icon": "ability_paladin_shieldofvengeance"},
    26573: {"name": "Consecration", "icon": "spell_holy_innerfire"},
    62124: {"name": "Hand of Reckoning", "icon": "spell_holy_rekindling"},
    # Demon Hunter
    198013: {"name": "Eye Beam", "icon": "ability_demonhunter_eyebeam"},
    188499: {"name": "Blade Dance", "icon": "ability_demonhunter_bladedance"},
    162794: {"name": "Chaos Strike", "icon": "ability_demonhunter_chaosstrike"},
    258920: {"name": "Immolation Aura", "icon": "ability_demonhunter_immolation"},
    162243: {"name": "Demon's Bite", "icon": "ability_demonhunter_demonsbite"},
    247454: {"name": "Spirit Bomb", "icon": "ability_demonhunter_spiritbomb"},
    228477: {"name": "Soul Cleave", "icon": "ability_demonhunter_soulcleave"},
    204021: {"name": "Fiery Brand", "icon": "ability_demonhunter_fierybrand"},
    263642: {"name": "Fracture", "icon": "ability_demonhunter_fracture"},
    185245: {"name": "Torment", "icon": "ability_demonhunter_torment"},
    # Druid Healer
    18562: {"name": "Swiftmend", "icon": "spell_nature_healingtouch"},
    8936: {"name": "Regrowth", "icon": "spell_nature_resistnature"},
    48438: {"name": "Wild Growth", "icon": "ability_druid_flourish"},
    774: {"name": "Rejuvenation", "icon": "spell_nature_rejuvenation"},
    88423: {"name": "Nature's Cure", "icon": "spell_nature_nullifydisease"},
    197604: {"name": "Sunfire", "icon": "ability_druid_sunfire"},
    8921: {"name": "Moonfire", "icon": "spell_nature_starfall"},
    5176: {"name": "Wrath", "icon": "spell_nature_abolishmagic"}
}

DEFAULT_ROTATION_CATALOG: Dict[int, dict] = {
    1: {"id": 184367, "name": "Rampage", "reason": "Rampage! Ativa Enrage"},
    2: {"id": 5308, "name": "Execute", "reason": "Execute Proc (<20% HP)"},
    3: {"id": 23881, "name": "Bloodthirst", "reason": "Bloodthirst (Buscar Enrage)"},
    4: {"id": 85288, "name": "Raging Blow", "reason": "Raging Blow (Gerador)"},
    5: {"id": 190411, "name": "Whirlwind", "reason": "Whirlwind (Filler AoE)"},
    6: {"id": 107574, "name": "Avatar", "reason": "Avatar (Burst)"},
    7: {"id": 1719, "name": "Recklessness", "reason": "Recklessness (Cooldown)"},
    8: {"id": 46924, "name": "Bladestorm", "reason": "Bladestorm"},
    9: {"id": 386633, "name": "Onslaught", "reason": "Onslaught"},
    10: {"id": 280735, "name": "Execute", "reason": "Execute"},
    11: {"id": 6544, "name": "Heroic Leap", "reason": "Heroic Leap"},
    12: {"id": 355, "name": "Taunt", "reason": "Taunt"},
    13: {"id": 167105, "name": "Colossus Smash", "reason": "Colossus Smash (Burst Window)"},
    14: {"id": 262161, "name": "Warbreaker", "reason": "Warbreaker (Burst Window)"},
    15: {"id": 12294, "name": "Mortal Strike", "reason": "Mortal Strike (Prioridade)"},
    16: {"id": 7384, "name": "Overpower", "reason": "Overpower (Gera Raiva/Buff)"},
    17: {"id": 1464, "name": "Slam", "reason": "Slam (Gastar Raiva >50)"},
    18: {"id": 23922, "name": "Shield Slam", "reason": "Shield Slam (Raiva/Dano)"},
    19: {"id": 6343, "name": "Thunder Clap", "reason": "Thunder Clap (AoE)"},
    20: {"id": 6572, "name": "Revenge", "reason": "Revenge (Gastar Raiva)"}
}

WOWHEAD_FETCH_QUEUE = set()
WOWHEAD_LOCK = threading.Lock()

def fetch_wowhead_spell_async(spell_id: int):
    if not spell_id or spell_id <= 0:
        return
    with WOWHEAD_LOCK:
        if spell_id in WOWHEAD_SPELL_CACHE or spell_id in WOWHEAD_FETCH_QUEUE:
            return
        WOWHEAD_FETCH_QUEUE.add(spell_id)

    def _worker():
        try:
            url = f"https://nether.wowhead.com/tooltip/spell/{spell_id}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=4) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data and "icon" in data:
                    with WOWHEAD_LOCK:
                        WOWHEAD_SPELL_CACHE[spell_id] = {
                            "name": data.get("name", ""),
                            "icon": data.get("icon", "")
                        }
                        try:
                            with open(WOWHEAD_CACHE_FILE, "w", encoding="utf-8") as f:
                                json.dump(WOWHEAD_SPELL_CACHE, f)
                        except Exception:
                            pass
        except Exception:
            pass
        finally:
            with WOWHEAD_LOCK:
                WOWHEAD_FETCH_QUEUE.discard(spell_id)

    threading.Thread(target=_worker, daemon=True).start()

class TelemetryDecoder:
    def __init__(self):
        self.sync_offset: Optional[Tuple[int, int]] = None
        self.cell_w: float = 6.0
        self.fps_counter = 0
        self.fps_timer = time.time()
        self.current_fps = 0
        self.rotation_catalog: Dict[Any, dict] = {}
        self.party_members: list = []
        self.triage_data: dict = {}

    def resolve_spell(self, idx: int) -> dict:
        if not idx or idx <= 0:
            return {"id": 0, "name": "", "keybind": "", "icon": "", "reason": ""}
        
        sp = self.rotation_catalog.get(idx) or self.rotation_catalog.get(str(idx))
        if not sp or not isinstance(sp, dict):
            sp = DEFAULT_ROTATION_CATALOG.get(idx)

        if sp and isinstance(sp, dict):
            spell_id = sp.get("id", 0)
            spell_name = sp.get("name", "")
            keybind = sp.get("keybind", "")
            reason = sp.get("reason", "Habilidade de Rotação")
            
            icon_slug = ""
            if spell_id > 0:
                cached = WOWHEAD_SPELL_CACHE.get(spell_id)
                if cached:
                    icon_slug = cached.get("icon", "")
                    if cached.get("name"):
                        spell_name = cached["name"]
                else:
                    fetch_wowhead_spell_async(spell_id)
                    # If cached has icon already or fallback
                    raw_icon = sp.get("icon", 0)
                    if isinstance(raw_icon, str) and not raw_icon.isdigit():
                        icon_slug = raw_icon

            return {
                "id": spell_id,
                "name": spell_name,
                "keybind": keybind,
                "icon": icon_slug,
                "reason": reason
            }

        # Fallback to default catalog if index is in default list
        if idx in DEFAULT_ROTATION_CATALOG:
            d = DEFAULT_ROTATION_CATALOG[idx]
            sid = d["id"]
            icon_slug = WOWHEAD_SPELL_CACHE.get(sid, {}).get("icon", "")
            name = WOWHEAD_SPELL_CACHE.get(sid, {}).get("name", d["name"])
            return {
                "id": sid,
                "name": name,
                "keybind": "",
                "icon": icon_slug,
                "reason": d.get("reason", "Prioridade de Combate")
            }

        return {
            "id": 0,
            "name": f"Habilidade #{idx}",
            "keybind": "",
            "icon": "",
            "reason": "Prioridade de Combate"
        }

    def resolve_triage_target(self, idx: int) -> dict:
        if idx == 0:
            return {"name": "Equipa Saudável", "class": "", "idx": 0}
        if self.party_members and 1 <= idx <= len(self.party_members):
            m = self.party_members[idx - 1]
            return {"name": m.get("name", f"Membro #{idx}"), "class": m.get("class", ""), "idx": idx}
        lowest_name = self.triage_data.get("lowestName")
        if lowest_name and idx == self.triage_data.get("lowestIdx", 1):
            return {"name": lowest_name, "class": self.triage_data.get("lowestClass", ""), "idx": idx}
        return {"name": "Aliado em Perigo" if idx > 1 else "Jogador", "class": "", "idx": idx}

    def find_sync(self, sct_img, search_w=400, search_h=80) -> Optional[Tuple[int, int]]:
        w = min(sct_img.width, search_w)
        h = min(sct_img.height, search_h)
        for y in range(h):
            for x in range(w):
                r, g, b = get_pixel_rgb(sct_img, x, y)
                if is_sync_color(r, g, b):
                    # Measure cell width across the sync block
                    cw = 0
                    while x + cw < sct_img.width and is_sync_color(*get_pixel_rgb(sct_img, x + cw, y)):
                        cw += 1
                    # Measure cell height down the sync block
                    ch = 0
                    while y + ch < sct_img.height and is_sync_color(*get_pixel_rgb(sct_img, x, y + ch)):
                        ch += 1
                    if cw >= 4 and ch >= 4:
                        self.cell_w = float(cw)
                        self.cell_h = float(ch)
                        return (x, y)
        return None

    def decode_frame(self, sct_img) -> Optional[dict]:
        # Fast path check
        if self.sync_offset:
            ox, oy = self.sync_offset
            half_w = int(self.cell_w / 2.0)
            half_h = int(getattr(self, 'cell_h', self.cell_w) / 2.0)
            if ox + half_w < sct_img.width and oy + half_h < sct_img.height:
                r, g, b = get_pixel_rgb(sct_img, ox + half_w, oy + half_h)
                if not is_sync_color(r, g, b):
                    self.sync_offset = None

        if not self.sync_offset:
            self.sync_offset = self.find_sync(sct_img)
            if not self.sync_offset:
                return None

        ox, oy = self.sync_offset
        sample_y = oy + int(getattr(self, 'cell_h', self.cell_w) / 2.0)

        cells = []
        for i in range(NUM_CELLS):
            px = int(round(ox + (i + 0.5) * self.cell_w))
            if px >= sct_img.width or sample_y >= sct_img.height:
                self.sync_offset = None
                return None
            cells.append(get_pixel_rgb(sct_img, px, sample_y))

        # Check sync cell 0
        r0, g0, b0 = cells[0]
        if not is_sync_color(r0, g0, b0):
            self.sync_offset = None
            return None

        # Cells 1 & 2: MapID (12-bit)
        map_id = (decode_6(*cells[1]) << 6) | decode_6(*cells[2])

        # Cells 3 & 4: Player X (12-bit normalized 0..4095)
        x_raw = (decode_6(*cells[3]) << 6) | decode_6(*cells[4])
        x = round(x_raw / 4095.0, 5)

        # Cells 5 & 6: Player Y (12-bit normalized 0..4095)
        y_raw = (decode_6(*cells[5]) << 6) | decode_6(*cells[6])
        y = round(y_raw / 4095.0, 5)

        # Cells 7 & 8: Facing Angle (12-bit 0..4095)
        facing_raw = (decode_6(*cells[7]) << 6) | decode_6(*cells[8])
        facing_deg = round((facing_raw / 4095.0) * 360.0, 1)

        # Cell 9: Health Pct (0..63)
        hp_6 = decode_6(*cells[9])
        hp_pct = round(hp_6 / 63.0 * 100.0, 1)

        # Cell 10: Power Pct (0..63)
        pow_6 = decode_6(*cells[10])
        power_pct = round(pow_6 / 63.0 * 100.0, 1)

        # Cell 11: Status Flags (6-bit)
        flags = decode_6(*cells[11])
        in_combat = (flags & 1) != 0
        is_dead = (flags & 2) != 0
        is_resting = (flags & 4) != 0
        is_mounted = (flags & 8) != 0
        has_target = (flags & 16) != 0
        target_hostile = (flags & 32) != 0
        target_rel = 1 if target_hostile else (3 if has_target else 0)

        # Cell 12: Tank Threat & Mitigation (6-bit)
        tank_threat = 0
        if len(cells) >= 13:
            tank_threat = decode_6(*cells[12])

        # Cell 13: Taunt Swap & Alert (6-bit)
        tank_taunt = 0
        if len(cells) >= 14:
            tank_taunt = decode_6(*cells[13])

        # Cell 14: Live Healer Mana Pct (6-bit)
        healer_mana_pct = 100.0
        if len(cells) >= 15:
            hm_6 = decode_6(*cells[14])
            healer_mana_pct = round(hm_6 / 63.0 * 100.0, 1)

        # Cell 15: DPS Next Spell Index (6-bit 0..63)
        dps_next_idx = 0
        if len(cells) >= 16:
            dps_next_idx = decode_6(*cells[15])

        # Cell 16: DPS Queue Spell Index (6-bit 0..63)
        dps_queue_idx = 0
        if len(cells) >= 17:
            dps_queue_idx = decode_6(*cells[16])

        next_spell = self.resolve_spell(dps_next_idx)
        queue_spell = self.resolve_spell(dps_queue_idx)

        co_tank_stacks = tank_taunt & 7
        taunt_alert = (tank_taunt & 8) != 0
        taunt_ready = (tank_taunt & 16) != 0
        boss_encounter = (tank_taunt & 32) != 0

        has_threat = (tank_threat & 1) != 0
        losing_threat = (tank_threat & 2) != 0
        healer_in_danger = (tank_threat & 4) != 0
        mit1_active = (tank_threat & 8) != 0
        mit2_active = (tank_threat & 16) != 0
        major_defensive = (tank_threat & 32) != 0

        # Healer telemetry extraction
        triage_idx = tank_threat & 7
        bracket_idx = (tank_threat >> 3) & 7
        dispel_alert = (tank_taunt & 1) != 0
        aoe_spike_count = (tank_taunt >> 1) & 3
        dispel_is_curse = (tank_taunt & 8) != 0
        tank_emergency = (tank_taunt & 16) != 0
        aoe_spike_active = (tank_taunt & 32) != 0
        triage_target = self.resolve_triage_target(triage_idx)

        # FPS calculation
        self.fps_counter += 1
        now = time.time()
        if now - self.fps_timer >= 1.0:
            self.current_fps = self.fps_counter
            self.fps_counter = 0
            self.fps_timer = now

        return {
            "type": "telemetry",
            "timestamp": round(now * 1000),
            "mapId": map_id,
            "x": x,
            "y": y,
            "facing": facing_deg,
            "inCombat": in_combat,
            "isDead": is_dead,
            "healthPct": hp_pct,
            "powerPct": power_pct,
            "powerType": 1,
            "level": 90,
            "hasTarget": has_target,
            "targetHealthPct": 100 if has_target else 0,
            "targetRelation": target_rel,
            "speed": 7.0 if not is_resting else 0.0,
            "frameId": self.fps_counter,
            "resting": is_resting,
            "taxi": False,
            "mounted": is_mounted,
            "flying": False,
            "fps": self.current_fps,
            "healerManaPct": healer_mana_pct,
            "tank": {
                "hasThreat": has_threat,
                "losingThreat": losing_threat,
                "healerInDanger": healer_in_danger,
                "shieldBlockActive": mit1_active,
                "ignorePainActive": mit2_active,
                "majorDefensiveActive": major_defensive,
                "coTankStacks": co_tank_stacks,
                "tauntAlert": taunt_alert,
                "tauntReady": taunt_ready,
                "bossEncounter": boss_encounter
            },
            "dps": {
                "nextIdx": dps_next_idx,
                "nextSpellId": next_spell["id"],
                "nextSpellName": next_spell["name"],
                "nextKeybind": next_spell["keybind"],
                "nextIcon": next_spell["icon"],
                "nextReason": next_spell["reason"],
                "queueIdx": dps_queue_idx,
                "queueSpellId": queue_spell["id"],
                "queueSpellName": queue_spell["name"],
                "queueKeybind": queue_spell["keybind"],
                "queueIcon": queue_spell["icon"]
            },
            "healer": {
                "triageIdx": triage_idx,
                "bracketIdx": bracket_idx,
                "triageTarget": triage_target,
                "dispelAlert": dispel_alert,
                "dispelType": "Curse / Disease" if dispel_is_curse else "Magic / Poison",
                "tankInDanger": tank_emergency,
                "aoeSpikeActive": aoe_spike_active,
                "aoeSpikeCount": aoe_spike_count,
                "nextSpellId": next_spell["id"],
                "nextSpellName": next_spell["name"],
                "nextKeybind": next_spell["keybind"],
                "nextIcon": next_spell["icon"],
                "nextReason": next_spell["reason"],
                "queueSpellId": queue_spell["id"],
                "queueSpellName": queue_spell["name"],
                "queueKeybind": queue_spell["keybind"],
                "queueIcon": queue_spell["icon"]
            }
        }

# =========================================================================
# SavedVariables Watcher (Bags, Quests, Equipment, Collections)
# =========================================================================

def find_saved_variables() -> Optional[str]:
    search_patterns = [
        "/Applications/World of Warcraft/_retail_/WTF/Account/*/SavedVariables/WoWCompanion.lua",
        os.path.expanduser("~/Applications/World of Warcraft/_retail_/WTF/Account/*/SavedVariables/WoWCompanion.lua"),
        "C:\\Program Files (x86)\\World of Warcraft\\_retail_\\WTF\\Account\\*\\SavedVariables\\WoWCompanion.lua",
        "C:\\World of Warcraft\\_retail_\\WTF\\Account\\*\\SavedVariables\\WoWCompanion.lua"
    ]
    for pattern in search_patterns:
        matches = glob.glob(pattern)
        if matches:
            return matches[0]
    return None

def parse_lua_value(text: str, pos: int):
    while pos < len(text) and text[pos].isspace():
        pos += 1
    if pos >= len(text):
        return None, pos

    c = text[pos]
    if c == '"':
        pos += 1
        start = pos
        while pos < len(text):
            if text[pos] == '\\':
                pos += 2
            elif text[pos] == '"':
                raw = text[start:pos]
                s = raw.replace('\\"', '"').replace('\\\\', '\\').replace('\\n', '\n').replace('\\r', '\r').replace('\\t', '\t')
                pos += 1
                return s, pos
            else:
                pos += 1
        return '', pos

    if c == '{':
        pos += 1
        tbl_dict = {}
        tbl_list = []
        is_list = True

        while pos < len(text):
            while pos < len(text) and (text[pos].isspace() or text[pos] in ',;'):
                pos += 1
            if pos >= len(text) or text[pos] == '}':
                pos += 1
                break

            key = None
            if text[pos] == '[':
                pos += 1
                while pos < len(text) and text[pos].isspace():
                    pos += 1
                if text[pos] == '"':
                    key, pos = parse_lua_value(text, pos)
                else:
                    k_start = pos
                    while pos < len(text) and text[pos] != ']':
                        pos += 1
                    raw_k = text[k_start:pos].strip()
                    try:
                        key = int(raw_k)
                    except ValueError:
                        key = raw_k
                while pos < len(text) and text[pos] != ']':
                    pos += 1
                pos += 1
                while pos < len(text) and (text[pos].isspace() or text[pos] == '='):
                    pos += 1
            elif text[pos].isalpha() or text[pos] == '_':
                k_start = pos
                while pos < len(text) and (text[pos].isalnum() or text[pos] == '_'):
                    pos += 1
                pk = text[k_start:pos]
                peek = pos
                while peek < len(text) and text[peek].isspace():
                    peek += 1
                if peek < len(text) and text[peek] == '=':
                    key = pk
                    pos = peek + 1
                else:
                    pos = k_start

            val, pos = parse_lua_value(text, pos)
            if key is not None:
                is_list = False
                tbl_dict[str(key)] = val
            else:
                tbl_list.append(val)

        return (tbl_list if is_list and tbl_list else tbl_dict), pos

    for word, res in [('true', True), ('false', False), ('nil', None)]:
        if text.startswith(word, pos):
            return res, pos + len(word)

    import re
    m = re.match(r'-?\d+(\.\d+)?([eE][+-]?\d+)?', text[pos:])
    if m:
        s = m.group(0)
        pos += len(s)
        return (float(s) if '.' in s or 'e' in s or 'E' in s else int(s)), pos

    return None, pos + 1

def parse_lua_simple(lua_str: str) -> Optional[dict]:
    try:
        idx = lua_str.find("WoWCompanionDB =")
        if idx == -1:
            return None
        start = lua_str.find("{", idx)
        val, _ = parse_lua_value(lua_str, start)
        return val if isinstance(val, dict) else None
    except Exception:
        return None

def start_sv_watcher(server_host: str, sv_path: Optional[str] = None):
    target_path = sv_path or find_saved_variables()
    if not target_path:
        def wait_for_file():
            while True:
                found = find_saved_variables()
                if found:
                    run_watcher(server_host, found)
                    break
                time.sleep(10)
        t = threading.Thread(target=wait_for_file, daemon=True)
        t.start()
        return

    run_watcher(server_host, target_path)

def run_watcher(server_host: str, file_path: str):
    def watcher_thread():
        print(f"[WATCHER] Watching SavedVariables at: {file_path}")
        last_mtime = 0
        api_url = f"http://{server_host}/api/savedvariables"

        while True:
            try:
                if os.path.exists(file_path):
                    mtime = os.path.getmtime(file_path)
                    if mtime > last_mtime:
                        last_mtime = mtime
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                        data = parse_lua_simple(content)
                        if data and "character" in data:
                            requests.post(api_url, json=data, timeout=3)
                            print(f"[WATCHER] Synced character data to Companion Server ({data['character'].get('name', 'Hero')})")
                        if GLOBAL_DECODER:
                            if "rotationCatalog" in data and isinstance(data["rotationCatalog"], (dict, list)):
                                cat = data["rotationCatalog"]
                                if isinstance(cat, list):
                                    GLOBAL_DECODER.rotation_catalog = {i + 1: item for i, item in enumerate(cat) if item}
                                elif isinstance(cat, dict):
                                    GLOBAL_DECODER.rotation_catalog = cat
                            if "party" in data and isinstance(data["party"], dict):
                                GLOBAL_DECODER.party_members = data["party"].get("members", [])
                            if "triage" in data and isinstance(data["triage"], dict):
                                GLOBAL_DECODER.triage_data = data["triage"]
                            print(f"[WATCHER] Loaded {len(GLOBAL_DECODER.rotation_catalog)} abilities & {len(GLOBAL_DECODER.party_members)} party members")
            except Exception:
                pass
            time.sleep(3)

    t = threading.Thread(target=watcher_thread, daemon=True)
    t.start()

# =========================================================================
# Main Screen Grab & Telemetry Loop
# =========================================================================

def send_cmd_to_wow(command: str):
    """Execute a slash command into active World of Warcraft client"""
    if not command:
        return
    command = command.strip()
    if not command.startswith("/"):
        command = "/" + command

    try:
        p = subprocess.Popen(['pbcopy'], stdin=subprocess.PIPE, text=True)
        p.communicate(input=command)
    except Exception:
        pass

    if IS_MACOS:
        try:
            safe_cmd = command.replace('"', '\\"')
            script = f'''
            tell application "System Events"
                if (count (every process whose name is "World of Warcraft")) > 0 then
                    tell process "World of Warcraft"
                        set frontmost to true
                        delay 0.08
                        key code 36
                        delay 0.08
                        keystroke "{safe_cmd}"
                        delay 0.08
                        key code 36
                    end tell
                end if
            end tell
            '''
            subprocess.run(['osascript', '-e', script], timeout=2)
            print(f"[BRIDGE] 🎮 In-game command executed: {command}")
        except Exception as e:
            print(f"[BRIDGE] Command execution error: {e}")

def send_track_to_wow(quest_id: int, title: str = ""):
    print(f"[BRIDGE] 🎯 Tracking quest {quest_id} ({title})")
    send_cmd_to_wow(f"/wc track {quest_id}")

async def run_bridge(server_host: str):
    global GLOBAL_DECODER
    ws_uri = f"ws://{server_host}/ws/bridge"
    decoder = TelemetryDecoder()
    GLOBAL_DECODER = decoder

    # Pre-load rotation catalog from SavedVariables if available
    init_sv = find_saved_variables()
    if init_sv and os.path.exists(init_sv):
        try:
            with open(init_sv, 'r', encoding='utf-8', errors='ignore') as f:
                init_data = parse_lua_simple(f.read())
            if init_data and "rotationCatalog" in init_data:
                cat = init_data["rotationCatalog"]
                if isinstance(cat, list):
                    decoder.rotation_catalog = {i + 1: item for i, item in enumerate(cat) if item}
                elif isinstance(cat, dict):
                    decoder.rotation_catalog = cat
                print(f"[BRIDGE] ⚔️ Pre-loaded {len(decoder.rotation_catalog)} rotation abilities from SavedVariables")
            if init_data and "party" in init_data and isinstance(init_data["party"], dict):
                decoder.party_members = init_data["party"].get("members", [])
            if init_data and "triage" in init_data and isinstance(init_data["triage"], dict):
                decoder.triage_data = init_data["triage"]
        except Exception:
            pass

    print("==================================================")
    print("  WoW Companion Bridge v2.3 Starting (Discrete Quantized)")
    print(f"  Target Server: {ws_uri}")
    print("==================================================")

    # Start SavedVariables watcher
    start_sv_watcher(server_host)

    sct_cls = getattr(mss, "MSS", None) or getattr(mss, "mss")

    with sct_cls() as sct:
        monitors = sct.monitors
        print(f"[BRIDGE] Found {len(monitors)-1} active monitor(s).")

        while True:
            try:
                print(f"[BRIDGE] Connecting to Companion Server ({ws_uri})...")
                async with websockets.connect(ws_uri) as ws:
                    print(f"[BRIDGE] Connected! Locating 17-cell discrete pixel bar...")
                    last_status_print = 0

                    async def incoming_listener():
                        try:
                            async for raw_msg in ws:
                                try:
                                    msg_data = json.loads(raw_msg)
                                    mtype = msg_data.get('type')
                                    if mtype == 'trackQuest':
                                        qid = msg_data.get('questID')
                                        title = msg_data.get('title', '')
                                        if qid:
                                            send_track_to_wow(qid, title)
                                    elif mtype == 'executeCommand':
                                        cmd = msg_data.get('command')
                                        if cmd:
                                            send_cmd_to_wow(cmd)
                                except Exception:
                                    pass
                        except Exception:
                            pass

                    listener_task = asyncio.create_task(incoming_listener())

                    try:
                        while True:
                            win_pos = get_wow_window_pos()
                            telemetry = None
                            if win_pos:
                                region = {
                                    "left": win_pos["x"],
                                    "top": win_pos["y"] + 24,
                                    "width": 400,
                                    "height": 60
                                }
                                sct_img = sct.grab(region)
                                telemetry = decoder.decode_frame(sct_img)

                            if not telemetry:
                                for mon in monitors[1:]:
                                    region = {
                                        "left": mon["left"],
                                        "top": mon["top"],
                                        "width": 400,
                                        "height": 60
                                    }
                                    sct_img = sct.grab(region)
                                    telemetry = decoder.decode_frame(sct_img)
                                    if telemetry:
                                        break

                            now = time.time()
                            if telemetry:
                                await ws.send(json.dumps(telemetry))

                                if now - last_status_print >= 2.0:
                                    last_status_print = now
                                    print(f"[SYNC] Map:{telemetry['mapId']} | X:{telemetry['x']*100:.2f}% Y:{telemetry['y']*100:.2f}% | "
                                          f"Facing:{telemetry['facing']}° | HP:{telemetry['healthPct']}% | Combat:{telemetry['inCombat']} | {telemetry['fps']} FPS")
                            else:
                                if now - last_status_print >= 3.0:
                                    last_status_print = now
                                    try:
                                        await ws.send(json.dumps({"type": "bridgeHeartbeat", "status": "searching"}))
                                    except Exception:
                                        pass
                                    print("[SEARCH] Searching for 17-cell Magenta sync header... (Type /reload in WoW if needed)")

                            await asyncio.sleep(0.033)
                    finally:
                        listener_task.cancel()

            except (websockets.ConnectionClosed, ConnectionRefusedError, OSError) as e:
                print(f"[WARN] Connection lost ({e}). Reconnecting in 3s...")
                await asyncio.sleep(3.0)
            except Exception as e:
                print(f"[ERROR] Loop error: {e}")
                await asyncio.sleep(2.0)

def main():
    parser = argparse.ArgumentParser(description="WoW Companion Telemetry Bridge v2.0")
    parser.add_argument("--server", default="192.168.1.108:3300", help="Companion server host:port (default: 192.168.1.108:3300)")
    args = parser.parse_args()

    try:
        asyncio.run(run_bridge(args.server))
    except KeyboardInterrupt:
        print("\n[BRIDGE] Stopped by user.")

if __name__ == "__main__":
    main()
