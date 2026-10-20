--[[
    WoW Companion - Second-Screen Telemetry Addon
    Author: Daniel & Antigravity
    Version: 2.1.0
    Encodes real-time player telemetry into a 12-cell discrete quantized pixel bar (96x8 px) in the top-left corner.
    Uses 4-level quantization (0, 85, 170, 255) with ±42 error tolerance, 100% immune to Retina Display P3 color shifts and gamma distortion.
    Frame scale is pixel-locked (1 / UIParent:GetEffectiveScale()) for exact 1:1 hardware pixel mapping.
    Also exports bags, equipment, quest log, and collections to WoWCompanionDB for sync with iPad.
--]]

local ADDON_NAME = "WoWCompanion"
WoWCompanionDB = WoWCompanionDB or {}
WoWCompanionDB.settings = WoWCompanionDB.settings or {}
if WoWCompanionDB.settings.voiceAlerts == nil then
    WoWCompanionDB.settings.voiceAlerts = false -- Desativado por defeito (evita voz repetitiva)
end
if WoWCompanionDB.settings.soundAlerts == nil then
    WoWCompanionDB.settings.soundAlerts = true
end
if WoWCompanionDB.settings.showBar == nil then
    WoWCompanionDB.settings.showBar = true
end
if WoWCompanionDB.settings.voiceCooldown == nil then
    WoWCompanionDB.settings.voiceCooldown = 45
end

-- Safeguard against Blizzard EditMode missing anchor bug (e.g. from imported layouts)
if not _G["VehicleLeaveButtonHolder"] then
    local vHolder = CreateFrame("Frame", "VehicleLeaveButtonHolder", UIParent)
    vHolder:SetSize(40, 40)
    vHolder:SetPoint("BOTTOM", UIParent, "BOTTOM", 0, 150)
end

local CELL_SIZE = 8
local NUM_CELLS = 17
local UPDATE_INTERVAL = 0.033 -- ~30 updates per second

local frame = CreateFrame("Frame", "WoWCompanionFrame", UIParent)
frame:SetSize(NUM_CELLS * CELL_SIZE, CELL_SIZE)
frame:SetPoint("TOPLEFT", UIParent, "TOPLEFT", 0, 0)
frame:SetFrameStrata("TOOLTIP")
frame:SetClampedToScreen(true)

-- Pixel-perfect scaling: 1 UI point = 1 hardware screen pixel
local function UpdatePixelScale()
    if UIParent and UIParent.GetEffectiveScale then
        local eff = UIParent:GetEffectiveScale()
        if eff and eff > 0 then
            frame:SetScale(1.0 / eff)
        end
    end
end
UpdatePixelScale()
frame:Show()

-- Black background bar to prevent bleed
local bg = frame:CreateTexture(nil, "BACKGROUND")
bg:SetAllPoints()
bg:SetColorTexture(0, 0, 0, 1.0)

local cells = {}
for i = 0, NUM_CELLS - 1 do
    local tex = frame:CreateTexture(nil, "ARTWORK")
    tex:SetSize(CELL_SIZE, CELL_SIZE)
    tex:SetPoint("TOPLEFT", frame, "TOPLEFT", i * CELL_SIZE, 0)
    tex:SetColorTexture(0, 0, 0, 1.0)
    cells[i] = tex
end

local function IsSecret(v)
    if v == nil then return false end
    if issecretvalue then
        local ok, s = pcall(issecretvalue, v)
        if ok and s then return true end
    end
    if issecrettable and type(v) == "table" then
        local ok, s = pcall(issecrettable, v)
        if ok and s then return true end
    end
    if canaccessvalue then
        local ok, can = pcall(canaccessvalue, v)
        if ok and not can then return true end
    end
    -- Dynamic probe checks: if testing comparison or boolean throws, it is a secret value
    if type(v) == "number" or type(v) == "userdata" then
        local ok = pcall(function() return v == 0 end)
        if not ok then return true end
    elseif type(v) == "string" then
        local ok = pcall(function() return v == "" end)
        if not ok then return true end
    elseif type(v) == "boolean" then
        local ok = pcall(function() return v == true end)
        if not ok then return true end
    end
    return false
end

local function SafeCompare(val, op, target)
    if val == nil or target == nil then return false end
    if IsSecret(val) or IsSecret(target) then return false end
    local ok, res = pcall(function()
        if op == "==" then return val == target
        elseif op == ">" then return val > target
        elseif op == "<" then return val < target
        elseif op == ">=" then return val >= target
        elseif op == "<=" then return val <= target
        elseif op == "~=" then return val ~= target
        end
        return false
    end)
    return ok and res == true
end

local function SafeNumber(v, default)
    local def = default or 0
    if v == nil then return def end
    if IsSecret(v) then return def end
    if type(v) ~= "number" then return def end
    return v
end

local function SafeString(v, default)
    local def = default or ""
    if v == nil then return def end
    if IsSecret(v) then return def end
    if type(v) ~= "string" then return def end
    return v
end

local function SafeGetUnitRole(unit)
    if not unit or not UnitGroupRolesAssigned then return "NONE" end
    local ok, role = pcall(UnitGroupRolesAssigned, unit)
    if ok and role and type(role) == "string" and not IsSecret(role) then
        return role
    end
    return "NONE"
end

local function SafeGetPlayerRole()
    if GetSpecialization and GetSpecializationInfo then
        local okSpec, curSpec = pcall(GetSpecialization)
        if okSpec and curSpec then
            local okInfo, _, _, _, _, role = pcall(GetSpecializationInfo, curSpec)
            if okInfo and role and type(role) == "string" and not IsSecret(role) then
                return role
            end
        end
    end
    return "DAMAGER"
end

local function SafeGetUnitHealth(unit)
    if not UnitHealth or not UnitHealthMax then return 100, 100, 100 end
    local okH, cur = pcall(UnitHealth, unit)
    local okM, max = pcall(UnitHealthMax, unit)
    if okH and okM and type(cur) == "number" and type(max) == "number" and not IsSecret(cur) and not IsSecret(max) then
        if SafeCompare(max, ">", 0) then
            local pct = math.floor((cur / max) * 100)
            return cur, max, pct
        end
    end
    return 100, 100, 100
end

local function SafeGetUnitPower(unit, powerType)
    if not UnitPower or not UnitPowerMax then return 0, 100, 0 end
    local pType = powerType or 0
    local okP, cur = pcall(UnitPower, unit, pType)
    local okM, max = pcall(UnitPowerMax, unit, pType)
    local curSafe = (okP and type(cur) == "number" and not IsSecret(cur)) and cur or 0
    local maxSafe = (okM and type(max) == "number" and not IsSecret(max)) and max or 100
    local pct = 0
    if SafeCompare(maxSafe, ">", 0) then
        pct = math.floor((curSafe / maxSafe) * 100)
    end
    return curSafe, maxSafe, pct
end

local function SetCell(index, r, g, b)
    if cells[index] then
        r = (type(r) == "number") and math.max(0, math.min(255, r)) or 0
        g = (type(g) == "number") and math.max(0, math.min(255, g)) or 0
        b = (type(b) == "number") and math.max(0, math.min(255, b)) or 0
        cells[index]:SetColorTexture(r / 255.0, g / 255.0, b / 255.0, 1.0)
    end
end

-- 4 discrete levels per channel (2 bits): 0, 85, 170, 255 (error tolerance +-42)
local PALETTE = { [0] = 0, [1] = 85, [2] = 170, [3] = 255 }

local function Encode6(val)
    if type(val) ~= "number" or IsSecret(val) then
        return 0, 0, 0
    end
    val = math.max(0, math.min(63, math.floor(val or 0)))
    local r_lvl = math.floor(val / 16) % 4
    local g_lvl = math.floor(val / 4) % 4
    local b_lvl = val % 4
    return PALETTE[r_lvl], PALETTE[g_lvl], PALETTE[b_lvl]
end

local function Encode12(val)
    if type(val) ~= "number" or IsSecret(val) then
        return 0, 0
    end
    val = math.max(0, math.min(4095, math.floor(val or 0)))
    local high = math.floor(val / 64) % 64
    local low = val % 64
    return high, low
end

local timeSinceLast = 0
local inCombatState = false
local isDeadState = false

-- Tank Helpers for Active Mitigation, Taunt and Threat
local function HasPlayerAura(spellID, nameFallback)
    if C_UnitAuras and C_UnitAuras.GetPlayerAuraBySpellID then
        local ok, aura = pcall(C_UnitAuras.GetPlayerAuraBySpellID, spellID)
        if ok and aura then return true end
    end
    if C_UnitAuras and C_UnitAuras.GetAuraDataByIndex then
        for i = 1, 32 do
            local ok, a = pcall(C_UnitAuras.GetAuraDataByIndex, "player", i, "HELPFUL")
            if not ok or not a then break end
            if a.spellId and not IsSecret(a.spellId) and a.spellId == spellID then
                return true
            end
            if nameFallback and a.name and not IsSecret(a.name) then
                local matchOk, match = pcall(function() return string.lower(a.name) == string.lower(nameFallback) end)
                if matchOk and match then return true end
            end
        end
    end
    return false
end

local function IsTauntReady()
    local spells = { 355, 62124, 6795, 56222, 185245, 115546 }
    for _, spId in ipairs(spells) do
        local okKnown = false
        if IsSpellKnownOrOverridesKnown then
            local ok, known = pcall(IsSpellKnownOrOverridesKnown, spId)
            if ok and known then okKnown = true end
        end
        if okKnown then
            if C_Spell and C_Spell.GetSpellCooldown then
                local okCd, cdInfo = pcall(C_Spell.GetSpellCooldown, spId)
                if okCd and cdInfo then
                    -- 1. Check isActive (Retail modern boolean)
                    if type(cdInfo.isActive) == "boolean" and not IsSecret(cdInfo.isActive) then
                        if cdInfo.isActive then
                            return false -- cooldown is active!
                        else
                            return true  -- taunt is ready!
                        end
                    end
                    -- 2. Check duration if accessible and not a secret number
                    if cdInfo.duration and not IsSecret(cdInfo.duration) then
                        if SafeCompare(cdInfo.duration, "==", 0) then
                            return true
                        elseif SafeCompare(cdInfo.duration, ">", 0) then
                            return false
                        end
                    end
                end
            end
            if GetSpellCooldown then
                local okCd, start, dur = pcall(GetSpellCooldown, spId)
                if okCd and dur and not IsSecret(dur) then
                    if SafeCompare(dur, ">", 0) then return false end
                    return true
                end
            end
            -- Fallback check: C_Spell.IsSpellUsable
            if C_Spell and C_Spell.IsSpellUsable then
                local okU, isUsable = pcall(C_Spell.IsSpellUsable, spId)
                if okU and type(isUsable) == "boolean" and not IsSecret(isUsable) then
                    return isUsable
                end
            end
            return true
        end
    end
    return true
end

local function GetCoTankDebuffInfo()
    local targetUnit = nil
    if UnitExists and UnitExists("focus") and not (UnitIsUnit and UnitIsUnit("focus", "player")) then
        targetUnit = "focus"
    elseif IsInRaid and IsInRaid() and GetNumGroupMembers then
        local count = GetNumGroupMembers() or 0
        for i = 1, math.min(count, 40) do
            local u = "raid" .. i
            if UnitExists(u) and not (UnitIsUnit and UnitIsUnit(u, "player")) and SafeGetUnitRole(u) == "TANK" then
                targetUnit = u
                break
            end
        end
    end
    if not targetUnit then return 0, false end

    local maxStacks = 0
    if C_UnitAuras and C_UnitAuras.GetAuraDataByIndex then
        for i = 1, 24 do
            local ok, a = pcall(C_UnitAuras.GetAuraDataByIndex, targetUnit, i, "HARMFUL")
            if not ok or not a then break end
            local st = a.applications or 1
            if type(st) == "number" and not IsSecret(st) then
                if SafeCompare(st, ">", maxStacks) then maxStacks = st end
            end
            if a.name and not IsSecret(a.name) then
                local lowerName = string.lower(a.name)
                if string.find(lowerName, "devastat") or string.find(lowerName, "negat") or string.find(lowerName, "voidscar") then
                    maxStacks = math.max(maxStacks, 2)
                end
            end
        end
    end
    return math.min(7, maxStacks), true
end

-- =========================================================================
-- DPS Live Rotation Engine & Action Bar Keybind Scanner
-- =========================================================================

local spellKeybinds = {}       -- spellID -> keybind string (e.g. "1", "Q", "E", "S-1")
local rotationCatalog = {}     -- index (1..63) -> { id, name, icon, keybind, reason }
local spellIDToIndex = {}      -- spellID -> index (1..63)
local catalogCount = 0

local function NormalizeKeybind(key)
    if not key or type(key) ~= "string" or key == "" then return nil end
    local k = string.upper(key)
    k = k:gsub("CTRL%-", "C-")
    k = k:gsub("ALT%-", "A-")
    k = k:gsub("SHIFT%-", "S-")
    k = k:gsub("META%-", "M-")
    k = k:gsub("COMMAND%-", "M-")
    k = k:gsub("BUTTON4", "M4")
    k = k:gsub("BUTTON5", "M5")
    k = k:gsub("BUTTON3", "M3")
    k = k:gsub("MOUSEWHEELUP", "MWU")
    k = k:gsub("MOUSEWHEELDOWN", "MWD")
    k = k:gsub("SPACEBAR", "SPC")
    k = k:gsub("SPACE", "SPC")
    k = k:gsub("NUMPAD", "N")
    return k
end

local ACTION_BAR_BUTTONS = {
    { prefix = "ActionButton", count = 12, binding = "ACTIONBUTTON" },
    { prefix = "MultiBarBottomLeftButton", count = 12, binding = "MULTIACTIONBAR1BUTTON" },
    { prefix = "MultiBarBottomRightButton", count = 12, binding = "MULTIACTIONBAR2BUTTON" },
    { prefix = "MultiBarRightButton", count = 12, binding = "MULTIACTIONBAR3BUTTON" },
    { prefix = "MultiBarLeftButton", count = 12, binding = "MULTIACTIONBAR4BUTTON" },
    { prefix = "MultiBar5Button", count = 12, binding = "MULTIACTIONBAR5BUTTON" },
    { prefix = "MultiBar6Button", count = 12, binding = "MULTIACTIONBAR6BUTTON" },
    { prefix = "MultiBar7Button", count = 12, binding = "MULTIACTIONBAR7BUTTON" },
}

local function ScanActionBarKeybinds()
    spellKeybinds = {}

    -- 1. Scan standard UI action buttons
    for _, bar in ipairs(ACTION_BAR_BUTTONS) do
        for i = 1, bar.count do
            local btnName = bar.prefix .. i
            local bindingAction = bar.binding .. i
            local btn = _G[btnName]
            local slot = (btn and btn.action) or 0

            local keybind = nil
            if GetBindingKey then
                local k1, k2 = GetBindingKey(bindingAction)
                keybind = NormalizeKeybind(k1 or k2)
                if not keybind and btnName then
                    local kb1, kb2 = GetBindingKey("CLICK " .. btnName .. ":LeftButton")
                    keybind = NormalizeKeybind(kb1 or kb2)
                end
            end

            if slot > 0 and HasAction and HasAction(slot) and GetActionInfo then
                local actionType, id = GetActionInfo(slot)
                local spellId = nil
                if actionType == "spell" and id and type(id) == "number" then
                    spellId = id
                elseif actionType == "macro" and id then
                    if GetMacroSpell then
                        local mSpell = GetMacroSpell(id)
                        if mSpell then spellId = mSpell end
                    end
                end

                if spellId and keybind then
                    spellKeybinds[spellId] = keybind
                end
            end
        end
    end

    -- 2. Also scan action slots 1 to 120 directly
    if HasAction and GetActionInfo and GetBindingKey then
        for slot = 1, 120 do
            if HasAction(slot) then
                local actionType, id = GetActionInfo(slot)
                local spellId = nil
                if actionType == "spell" and id and type(id) == "number" then
                    spellId = id
                elseif actionType == "macro" and id and GetMacroSpell then
                    local mSpell = GetMacroSpell(id)
                    if mSpell then spellId = mSpell end
                end

                if spellId and not spellKeybinds[spellId] then
                    local bindName = nil
                    if slot <= 12 then
                        bindName = "ACTIONBUTTON" .. slot
                    elseif slot >= 61 and slot <= 72 then
                        bindName = "MULTIACTIONBAR1BUTTON" .. (slot - 60)
                    elseif slot >= 49 and slot <= 60 then
                        bindName = "MULTIACTIONBAR2BUTTON" .. (slot - 48)
                    elseif slot >= 25 and slot <= 36 then
                        bindName = "MULTIACTIONBAR3BUTTON" .. (slot - 24)
                    elseif slot >= 37 and slot <= 48 then
                        bindName = "MULTIACTIONBAR4BUTTON" .. (slot - 36)
                    end
                    if bindName then
                        local k1, k2 = GetBindingKey(bindName)
                        local normKey = NormalizeKeybind(k1 or k2)
                        if normKey then
                            spellKeybinds[spellId] = normKey
                        end
                    end
                end
            end
        end
    end
end

local function GetSpellKeybind(spellID)
    if not spellID then return "" end
    if spellKeybinds[spellID] then return spellKeybinds[spellID] end
    if C_Spell and C_Spell.GetOverrideSpell then
        local base = C_Spell.GetOverrideSpell(spellID)
        if base and spellKeybinds[base] then return spellKeybinds[base] end
    end
    return ""
end

local function RegisterCatalogSpell(spellID, reasonFallback)
    if not spellID or type(spellID) ~= "number" or spellID <= 0 then return 0 end
    if spellIDToIndex[spellID] then
        return spellIDToIndex[spellID]
    end
    if catalogCount >= 63 then
        return 0
    end

    catalogCount = catalogCount + 1
    local idx = catalogCount
    spellIDToIndex[spellID] = idx

    local sName, sIcon = "", 0
    if C_Spell and C_Spell.GetSpellInfo then
        local okInfo, info = pcall(C_Spell.GetSpellInfo, spellID)
        if okInfo and info then
            sName = SafeString(info.name, "")
            sIcon = SafeNumber(info.iconID, 0)
        end
    elseif GetSpellInfo then
        local okInfo, n, _, icon = pcall(GetSpellInfo, spellID)
        if okInfo and n then
            sName = SafeString(n, "")
            sIcon = SafeNumber(icon, 0)
        end
    end

    local kb = GetSpellKeybind(spellID)
    rotationCatalog[idx] = {
        index = idx,
        id = spellID,
        name = sName,
        icon = sIcon,
        keybind = kb,
        reason = reasonFallback or "Habilidade de Rotação"
    }
    return idx
end

local function PrepopulateSpecCatalog()
    local _, playerClass = UnitClass("player")
    local curSpec = (GetSpecialization and GetSpecialization()) or 0

    local prioritySpells = {}
    if playerClass == "WARRIOR" then
        if curSpec == 2 then -- Fury
            prioritySpells = {
                { 184367, "Rampage! Ativa Enrage" },
                { 5308, "Execute Proc (<20% HP)" },
                { 23881, "Bloodthirst (Buscar Enrage)" },
                { 85288, "Raging Blow (Gerador)" },
                { 190411, "Whirlwind (Filler AoE)" },
                { 107574, "Avatar (Burst)" },
                { 1719, "Recklessness (Cooldown)" },
                { 46924, "Bladestorm" },
                { 386633, "Onslaught" },
                { 280735, "Execute" },
                { 6544, "Heroic Leap" },
                { 355, "Taunt" }
            }
        elseif curSpec == 1 then -- Arms
            prioritySpells = {
                { 167105, "Colossus Smash (Burst Window)" },
                { 262161, "Warbreaker (Burst Window)" },
                { 163201, "Execute Proc (<20% HP)" },
                { 12294, "Mortal Strike (Prioridade)" },
                { 7384, "Overpower (Gera Raiva/Buff)" },
                { 1464, "Slam (Gastar Raiva >50)" },
                { 280735, "Execute" }
            }
        elseif curSpec == 3 then -- Protection
            prioritySpells = {
                { 23922, "Shield Slam (Raiva/Dano)" },
                { 6343, "Thunder Clap (AoE)" },
                { 6572, "Revenge (Gastar Raiva)" },
                { 163201, "Execute" },
                { 1464, "Devastate / Slam" },
                { 355, "Taunt (Ameaça)" },
                { 132404, "Shield Block" },
                { 190456, "Ignore Pain" }
            }
        end
    elseif playerClass == "PALADIN" then
        if curSpec == 3 then -- Retribution
            prioritySpells = {
                { 383328, "Final Verdict (3+ Holy Power)" },
                { 85256, "Templar's Verdict (3+ Holy Power)" },
                { 255937, "Wake of Ashes (Gerador)" },
                { 184575, "Blade of Justice" },
                { 24275, "Hammer of Wrath (<20% HP)" },
                { 20271, "Judgment" },
                { 35395, "Crusader Strike" }
            }
        elseif curSpec == 1 then -- Holy
            prioritySpells = {
                { 20473, "Holy Shock" },
                { 85673, "Word of Glory" },
                { 19750, "Flash of Light" },
                { 85222, "Light of Dawn (AoE)" },
                { 4987, "Cleanse" }
            }
        elseif curSpec == 2 then -- Protection
            prioritySpells = {
                { 204019, "Blessed Hammer" },
                { 53600, "Shield of the Righteous" },
                { 26573, "Consecration" },
                { 20271, "Judgment" },
                { 62124, "Hand of Reckoning (Taunt)" }
            }
        end
    elseif playerClass == "DEMONHUNTER" then
        if curSpec == 1 then -- Havoc
            prioritySpells = {
                { 198013, "Eye Beam (Burst/Meta)" },
                { 188499, "Blade Dance" },
                { 162794, "Chaos Strike" },
                { 258920, "Immolation Aura" },
                { 162243, "Demon's Bite (Gerar Fúria)" }
            }
        elseif curSpec == 2 then -- Vengeance
            prioritySpells = {
                { 247454, "Spirit Bomb" },
                { 228477, "Soul Cleave" },
                { 204021, "Fiery Brand" },
                { 263642, "Fracture" },
                { 178740, "Immolation Aura" },
                { 185245, "Torment (Taunt)" }
            }
        end
    end

    for _, item in ipairs(prioritySpells) do
        local spId, reason = item[1], item[2]
        RegisterCatalogSpell(spId, reason)
    end

    for slot = 1, 120 do
        if HasAction and HasAction(slot) and GetActionInfo then
            local actionType, id = GetActionInfo(slot)
            if actionType == "spell" and id and id > 0 then
                RegisterCatalogSpell(id, "Habilidade da Barra")
            end
        end
    end
end

local function IsSpellCastable(spellID)
    if not spellID or spellID <= 0 then return false end
    local known = false
    if IsSpellKnownOrOverridesKnown then
        local ok, k = pcall(IsSpellKnownOrOverridesKnown, spellID)
        if ok and k then known = true end
    elseif IsPlayerSpell then
        local ok, k = pcall(IsPlayerSpell, spellID)
        if ok and k then known = true end
    end
    if not known then return false end

    if C_Spell and C_Spell.GetSpellCooldown then
        local okCd, cd = pcall(C_Spell.GetSpellCooldown, spellID)
        if okCd and cd then
            if type(cd.isActive) == "boolean" and not IsSecret(cd.isActive) and cd.isActive then
                return false
            end
            if cd.duration and not IsSecret(cd.duration) then
                if SafeCompare(cd.duration, ">", 1.5) then return false end
            end
        end
    elseif GetSpellCooldown then
        local okCd, start, dur = pcall(GetSpellCooldown, spellID)
        if okCd and dur and not IsSecret(dur) then
            if SafeCompare(dur, ">", 1.5) then return false end
        end
    end

    if C_Spell and C_Spell.IsSpellUsable then
        local okU, isUsable = pcall(C_Spell.IsSpellUsable, spellID)
        if okU and type(isUsable) == "boolean" and not IsSecret(isUsable) then
            if not isUsable then return false end
        end
    end

    return true
end

-- Smart SimC APL priority fallback
local function GetAPLFallbackRotation()
    local _, playerClass = UnitClass("player")
    local curSpec = (GetSpecialization and GetSpecialization()) or 0
    local targetExists = (UnitExists and UnitExists("target") and UnitCanAttack and UnitCanAttack("player", "target")) or false

    local tarHpPct = 100
    if targetExists then
        local _, _, pct = SafeGetUnitHealth("target")
        tarHpPct = pct
    end

    local rage, _, _ = SafeGetUnitPower("player", 1)

    -- WARRIOR APL
    if playerClass == "WARRIOR" then
        local hasSuddenDeath = HasPlayerAura(52437, "Sudden Death") or HasPlayerAura(280776, "Sudden Death")
        local isExecuteWindow = (tarHpPct <= 20) or hasSuddenDeath

        -- Arms Spec (spec 1)
        if curSpec == 1 then
            if IsSpellCastable(167105) and targetExists then
                return 167105, "Colossus Smash (Burst Window)", 12294, "Mortal Strike"
            end
            if IsSpellCastable(262161) and targetExists then
                return 262161, "Warbreaker (Burst Window)", 12294, "Mortal Strike"
            end
            if isExecuteWindow and (rage >= 20 or hasSuddenDeath) and (IsSpellCastable(163201) or IsSpellCastable(280735)) then
                local exId = IsSpellCastable(163201) and 163201 or 280735
                return exId, "Execute Proc (<20% HP)", 12294, "Mortal Strike"
            end
            if IsSpellCastable(12294) and rage >= 30 then
                return 12294, "Mortal Strike (Prioridade)", 7384, "Overpower"
            end
            if IsSpellCastable(7384) then
                return 7384, "Overpower (Gera Raiva/Buff)", 1464, "Slam"
            end
            if rage >= 50 and IsSpellCastable(1464) then
                return 1464, "Slam (Gastar Raiva >50)", nil, nil
            end
        end

        -- Fury Spec (spec 2)
        if curSpec == 2 then
            local isEnraged = HasPlayerAura(184362, "Enrage")
            if rage >= 80 and IsSpellCastable(184367) then
                return 184367, "Rampage! Ativa Enrage", 23881, "Bloodthirst"
            end
            if isExecuteWindow and (rage >= 20 or hasSuddenDeath) and IsSpellCastable(5308) then
                return 5308, "Execute Proc (<20% HP)", 85288, "Raging Blow"
            end
            if not isEnraged and IsSpellCastable(23881) then
                return 23881, "Bloodthirst (Buscar Enrage)", 85288, "Raging Blow"
            end
            if IsSpellCastable(85288) then
                return 85288, "Raging Blow (Gerador)", 23881, "Bloodthirst"
            end
            if IsSpellCastable(23881) then
                return 23881, "Bloodthirst", 190411, "Whirlwind"
            end
            if IsSpellCastable(190411) then
                return 190411, "Whirlwind (Filler)", nil, nil
            end
        end

        -- Protection Spec (spec 3)
        if curSpec == 3 then
            if IsSpellCastable(23922) then return 23922, "Shield Slam (Raiva/Dano)", 6343, "Thunder Clap" end
            if IsSpellCastable(6343) then return 6343, "Thunder Clap (AoE)", 6572, "Revenge" end
            if rage >= 30 and IsSpellCastable(6572) then return 6572, "Revenge (Gastar Raiva)", 163201, "Execute" end
            if isExecuteWindow and IsSpellCastable(163201) and rage >= 20 then return 163201, "Execute", nil, nil end
            if IsSpellCastable(1464) then return 1464, "Devastate / Slam", nil, nil end
        end
    end

    -- RETRIBUTION PALADIN
    if playerClass == "PALADIN" and curSpec == 3 then
        local hp, _, _ = SafeGetUnitPower("player", 9)
        if hp >= 3 and (IsSpellCastable(383328) or IsSpellCastable(85256)) then
            local sp = IsSpellCastable(383328) and 383328 or 85256
            return sp, "Final Verdict (3+ Holy Power)", 255937, "Wake of Ashes"
        end
        if IsSpellCastable(255937) then return 255937, "Wake of Ashes (Gerador)", 184575, "Blade of Justice" end
        if IsSpellCastable(184575) then return 184575, "Blade of Justice", 20271, "Judgment" end
        if IsSpellCastable(24275) and (tarHpPct <= 20 or HasPlayerAura(383328)) then return 24275, "Hammer of Wrath (<20% HP)", 20271, "Judgment" end
        if IsSpellCastable(20271) then return 20271, "Judgment", nil, nil end
    end

    -- HAVOC DEMON HUNTER
    if playerClass == "DEMONHUNTER" and curSpec == 1 then
        local fury, _, _ = SafeGetUnitPower("player", 17)
        if IsSpellCastable(198013) then return 198013, "Eye Beam (Burst/Meta)", 188499, "Blade Dance" end
        if IsSpellCastable(188499) and fury >= 35 then return 188499, "Blade Dance", 162794, "Chaos Strike" end
        if fury >= 40 and IsSpellCastable(162794) then return 162794, "Chaos Strike", 258920, "Immolation Aura" end
        if IsSpellCastable(258920) then return 258920, "Immolation Aura", 162243, "Demon's Bite" end
        if IsSpellCastable(162243) then return 162243, "Demon's Bite (Gerar Fúria)", nil, nil end
    end

    -- FROST MAGE
    if playerClass == "MAGE" and curSpec == 3 then
        if HasPlayerAura(190446, "Brain Freeze") and IsSpellCastable(44614) then return 44614, "Flurry (Brain Freeze Proc)", 30455, "Ice Lance" end
        if HasPlayerAura(44544, "Fingers of Frost") and IsSpellCastable(30455) then return 30455, "Ice Lance (Fingers of Frost)", 116, "Frostbolt" end
        if IsSpellCastable(199786) then return 199786, "Glacial Spike (5 Icicles)", 116, "Frostbolt" end
        if IsSpellCastable(116) then return 116, "Frostbolt (Builder)", nil, nil end
    end

    -- BEAST MASTERY HUNTER
    if playerClass == "HUNTER" and curSpec == 1 then
        if IsSpellCastable(217200) then return 217200, "Barbed Shot (Manter Frenzy)", 34026, "Kill Command" end
        if IsSpellCastable(34026) then return 34026, "Kill Command", 53351, "Kill Shot" end
        if tarHpPct <= 20 and IsSpellCastable(53351) then return 53351, "Kill Shot (<20% HP)", 193455, "Cobra Shot" end
        if IsSpellCastable(193455) then return 193455, "Cobra Shot (Focus Dump)", nil, nil end
    end

    -- Generic Action Bar #1 offensive spell fallback
    for slot = 1, 6 do
        if HasAction and HasAction(slot) and GetActionInfo then
            local aType, id = GetActionInfo(slot)
            if aType == "spell" and id and IsSpellCastable(id) then
                return id, "Ataque da Barra Principal", nil, nil
            end
        end
    end

    return nil, nil, nil, nil
end

local function GetLiveDPSRotation()
    -- 1. Try Blizzard Native Assisted Combat API (12.1 Midnight)
    if C_AssistedCombat and C_AssistedCombat.IsAvailable and C_AssistedCombat.IsAvailable() then
        local s1 = C_AssistedCombat.GetNextCastSpell and C_AssistedCombat.GetNextCastSpell()
        local s2 = nil
        if C_AssistedCombat.GetRotationSpells then
            local rot = C_AssistedCombat.GetRotationSpells()
            if rot and #rot > 0 then
                for _, spId in ipairs(rot) do
                    if spId ~= s1 then
                        s2 = spId
                        break
                    end
                end
            end
        end
        if s1 and s1 > 0 then
            return s1, "Assisted Combat", s2, "Em fila"
        end
    end

    -- 2. Try Blizzkili rotation addon
    local okBk, bRot = pcall(function()
        local rLib = LibStub and LibStub("Blizzkili-Rotation", true)
        if rLib and rLib.GetRotation then
            return rLib.GetRotation()
        end
        return nil
    end)
    if okBk and bRot and #bRot > 0 and bRot[1] and bRot[1] > 0 then
        return bRot[1], "Blizzkili APL", bRot[2], "Em fila"
    end

    -- 3. Try MaxDps rotation addon
    if MaxDps and MaxDps.NextSpell then
        local okMd, s1 = pcall(MaxDps.NextSpell, MaxDps)
        if okMd and s1 and type(s1) == "number" and s1 > 0 then
            return s1, "MaxDps APL", nil, nil
        end
    end

    -- 4. Native SimC APL Smart Priority
    return GetAPLFallbackRotation()
end

-- =========================================================================
-- Healer Live Triage & Priority Engine
-- =========================================================================

local function GetPartyTriageInfo()
    local lowestUnit = "player"
    local lowestHpPct = 100
    local lowestName = (UnitName and UnitName("player")) or "Eu"
    local lowestClass = (UnitClass and select(2, UnitClass("player"))) or "PRIEST"
    local lowestIdx = 1
    local aoeSpikeCount = 0
    local tankInDanger = false
    local dispelTargetName = ""
    local dispelType = ""
    local dispelSpellName = ""

    local _, playerClass = UnitClass("player")
    local canDispel = {}
    if playerClass == "PRIEST" then canDispel["Magic"] = true; canDispel["Disease"] = true
    elseif playerClass == "PALADIN" then canDispel["Magic"] = true; canDispel["Poison"] = true; canDispel["Disease"] = true
    elseif playerClass == "DRUID" then canDispel["Magic"] = true; canDispel["Curse"] = true; canDispel["Poison"] = true
    elseif playerClass == "SHAMAN" then canDispel["Magic"] = true; canDispel["Curse"] = true; canDispel["Poison"] = true
    elseif playerClass == "MONK" then canDispel["Magic"] = true; canDispel["Poison"] = true; canDispel["Disease"] = true
    elseif playerClass == "EVOKER" then canDispel["Magic"] = true; canDispel["Poison"] = true
    end

    local unitsToScan = {
        { unit = "player", idx = 1 }
    }
    if IsInGroup and IsInGroup() and GetNumGroupMembers then
        local count = GetNumGroupMembers() or 0
        local pfx = (IsInRaid and IsInRaid()) and "raid" or "party"
        local maxScan = (IsInRaid and IsInRaid()) and math.min(count, 40) or math.min(count - 1, 4)
        for i = 1, maxScan do
            table.insert(unitsToScan, { unit = pfx .. i, idx = i + 1 })
        end
    end

    for _, entry in ipairs(unitsToScan) do
        local u = entry.unit
        if UnitExists and UnitExists(u) and not (UnitIsDeadOrGhost and UnitIsDeadOrGhost(u)) then
            local _, _, pct = SafeGetUnitHealth(u)
            if pct < 75 then
                aoeSpikeCount = aoeSpikeCount + 1
            end
            if pct < lowestHpPct then
                lowestHpPct = pct
                lowestUnit = u
                lowestIdx = entry.idx
                lowestName = SafeString(UnitName and UnitName(u), u)
                lowestClass = SafeString(select(2, UnitClass(u)), "")
            end

            local role = SafeGetUnitRole(u)
            if role == "TANK" and pct < 40 then
                tankInDanger = true
            end

            if dispelTargetName == "" and C_UnitAuras and C_UnitAuras.GetAuraDataByIndex then
                for aIdx = 1, 24 do
                    local okA, aura = pcall(C_UnitAuras.GetAuraDataByIndex, u, aIdx, "HARMFUL")
                    if not okA or not aura then break end
                    if aura.dispelName and canDispel[aura.dispelName] then
                        dispelTargetName = UnitName(u) or u
                        dispelType = aura.dispelName
                        dispelSpellName = aura.name or "Debuff"
                        break
                    end
                end
            end
        end
    end

    if lowestHpPct >= 95 then
        lowestIdx = 0
    end

    return lowestUnit, lowestName, lowestClass, lowestHpPct, aoeSpikeCount, tankInDanger, dispelTargetName, dispelType, dispelSpellName, lowestIdx
end

local function GetLiveHealerRotation(lowestHpPct, aoeSpikeCount, tankInDanger, dispelTargetName, dispelType)
    local _, playerClass = UnitClass("player")
    local curSpec = (GetSpecialization and GetSpecialization()) or 0

    -- 1. Dispel priority if anyone has harmful dispel and group not in lethal danger
    if dispelTargetName and dispelTargetName ~= "" and lowestHpPct > 35 then
        local dispelSpellId = nil
        if playerClass == "PRIEST" then dispelSpellId = 527
        elseif playerClass == "PALADIN" then dispelSpellId = 4987
        elseif playerClass == "DRUID" then dispelSpellId = 88423
        elseif playerClass == "SHAMAN" then dispelSpellId = 77130
        elseif playerClass == "MONK" then dispelSpellId = 115450
        elseif playerClass == "EVOKER" then dispelSpellId = 360823
        end
        if dispelSpellId and IsSpellCastable(dispelSpellId) then
            return dispelSpellId, "Dispel: " .. dispelTargetName .. " (" .. dispelType .. ")", nil, nil
        end
    end

    -- 2. Tank in danger (<40% HP) -> External Defensive
    if tankInDanger then
        local extDefId = nil
        if playerClass == "DRUID" then extDefId = 102342
        elseif playerClass == "PRIEST" then extDefId = 33206
        elseif playerClass == "PALADIN" then extDefId = 6940
        elseif playerClass == "MONK" then extDefId = 116849
        elseif playerClass == "EVOKER" then extDefId = 357170
        end
        if extDefId and IsSpellCastable(extDefId) then
            return extDefId, "🚨 Defensivo no Tank!", nil, nil
        end
    end

    -- 3. Emergency Single-Target Heal (<35% HP)
    if lowestHpPct < 35 then
        if playerClass == "PALADIN" then
            if IsSpellCastable(20473) then return 20473, "Holy Shock Emergência", 85673, "Word of Glory" end
            if IsSpellCastable(85673) then return 85673, "Word of Glory Emergência", 19750, "Flash of Light" end
            if IsSpellCastable(19750) then return 19750, "Flash of Light", nil, nil end
        elseif playerClass == "DRUID" then
            if IsSpellCastable(18562) then return 18562, "Swiftmend Emergência!", 8936, "Regrowth" end
            if IsSpellCastable(8936) then return 8936, "Regrowth Rápido", nil, nil end
        elseif playerClass == "PRIEST" then
            if IsSpellCastable(88684) then return 88684, "Holy Word: Serenity", 2061, "Flash Heal" end
            if IsSpellCastable(2061) then return 2061, "Flash Heal Emergência", nil, nil end
            if IsSpellCastable(17) then return 17, "Power Word: Shield", 47540, "Penance" end
        elseif playerClass == "SHAMAN" then
            if IsSpellCastable(61295) then return 61295, "Riptide Emergência", 8004, "Healing Surge" end
            if IsSpellCastable(8004) then return 8004, "Healing Surge Rápido", nil, nil end
        elseif playerClass == "MONK" then
            if IsSpellCastable(116849) then return 116849, "Life Cocoon Emergência", 124682, "Enveloping Mist" end
            if IsSpellCastable(124682) then return 124682, "Enveloping Mist", 116670, "Vivify" end
            if IsSpellCastable(116670) then return 116670, "Vivify", nil, nil end
        elseif playerClass == "EVOKER" then
            if IsSpellCastable(360995) then return 360995, "Verdant Embrace", 361469, "Living Flame" end
            if IsSpellCastable(361469) then return 361469, "Living Flame Emergência", nil, nil end
        end
    end

    -- 4. AoE Damage Spike (2+ members < 75% HP)
    if aoeSpikeCount >= 2 then
        if playerClass == "DRUID" then
            if IsSpellCastable(48438) then return 48438, "Wild Growth (Cura Grupo)", 8936, "Regrowth" end
        elseif playerClass == "PRIEST" then
            if IsSpellCastable(34861) then return 34861, "Holy Word: Sanctify (AoE)", 204883, "Circle of Healing" end
            if IsSpellCastable(204883) then return 204883, "Circle of Healing", 596, "Prayer of Healing" end
            if IsSpellCastable(194509) then return 194509, "Power Word: Radiance", nil, nil end
        elseif playerClass == "PALADIN" then
            if IsSpellCastable(85222) then return 85222, "Light of Dawn (AoE)", 20473, "Holy Shock" end
        elseif playerClass == "SHAMAN" then
            if IsSpellCastable(1064) then return 1064, "Chain Heal (AoE)", 73920, "Healing Rain" end
            if IsSpellCastable(73920) then return 73920, "Healing Rain", nil, nil end
        elseif playerClass == "MONK" then
            if IsSpellCastable(115310) then return 115310, "Revival (Burst Grupo)", 116670, "Vivify" end
            if IsSpellCastable(116670) then return 116670, "Vivify (Cura Grupo)", nil, nil end
        elseif playerClass == "EVOKER" then
            if IsSpellCastable(355936) then return 355936, "Dream Breath (AoE)", 367226, "Spiritbloom" end
            if IsSpellCastable(367226) then return 367226, "Spiritbloom (AoE)", nil, nil end
        end
    end

    -- 5. Moderate Healing (35..75% HP)
    if lowestHpPct < 75 then
        if playerClass == "DRUID" then
            if IsSpellCastable(774) and not HasPlayerAura(774) then return 774, "Rejuvenation no Alvo", 8936, "Regrowth" end
            if IsSpellCastable(8936) then return 8936, "Regrowth", nil, nil end
        elseif playerClass == "PRIEST" then
            if IsSpellCastable(2060) then return 2060, "Heal (Eficiente)", 139, "Renew" end
            if IsSpellCastable(47540) then return 47540, "Penance", 17, "Power Word: Shield" end
        elseif playerClass == "PALADIN" then
            if IsSpellCastable(20473) then return 20473, "Holy Shock", 85673, "Word of Glory" end
        elseif playerClass == "SHAMAN" then
            if IsSpellCastable(61295) then return 61295, "Riptide", 77472, "Healing Wave" end
            if IsSpellCastable(77472) then return 77472, "Healing Wave", nil, nil end
        elseif playerClass == "MONK" then
            if IsSpellCastable(115151) then return 115151, "Renewing Mist", 116670, "Vivify" end
        elseif playerClass == "EVOKER" then
            if IsSpellCastable(364343) then return 364343, "Echo", 361469, "Living Flame" end
        end
    end

    -- 6. Downtime DPS / Maintenance (> 75% HP)
    if playerClass == "DRUID" then
        if IsSpellCastable(197604) then return 197604, "Sunfire (Downtime DPS)", 8921, "Moonfire" end
        if IsSpellCastable(8921) then return 8921, "Moonfire", 5176, "Wrath" end
        if IsSpellCastable(5176) then return 5176, "Wrath (Filler)", nil, nil end
    elseif playerClass == "PRIEST" then
        if IsSpellCastable(589) then return 589, "Shadow Word: Pain (DPS)", 585, "Smite" end
        if IsSpellCastable(14914) then return 14914, "Holy Fire", 585, "Smite" end
        if IsSpellCastable(585) then return 585, "Smite (Filler)", nil, nil end
    elseif playerClass == "PALADIN" then
        if IsSpellCastable(20271) then return 20271, "Judgment (Downtime DPS)", 35395, "Crusader Strike" end
        if IsSpellCastable(35395) then return 35395, "Crusader Strike", 26573, "Consecration" end
    elseif playerClass == "SHAMAN" then
        if IsSpellCastable(188389) then return 188389, "Flame Shock (DPS)", 51505, "Lava Burst" end
        if IsSpellCastable(51505) then return 51505, "Lava Burst", 188196, "Lightning Bolt" end
    elseif playerClass == "MONK" then
        if IsSpellCastable(107428) then return 107428, "Rising Sun Kick", 100784, "Blackout Kick" end
        if IsSpellCastable(100784) then return 100784, "Blackout Kick", 100780, "Tiger Palm" end
    elseif playerClass == "EVOKER" then
        if IsSpellCastable(357208) then return 357208, "Fire Breath", 361469, "Living Flame" end
        if IsSpellCastable(361469) then return 361469, "Living Flame (DPS)", nil, nil end
    end

    -- Check action bar slots 1..6 fallback
    for slot = 1, 6 do
        if HasAction and HasAction(slot) and GetActionInfo then
            local aType, id = GetActionInfo(slot)
            if aType == "spell" and id and IsSpellCastable(id) then
                return id, "Habilidade da Barra", nil, nil
            end
        end
    end

    return nil, nil, nil, nil
end

local function UpdateTelemetry()
    -- Cell 0: Header Sync -> Pure Magenta (255, 0, 255)
    SetCell(0, 255, 0, 255)

    -- Cell 1 & 2: UiMapID (12-bit, supports 0..4095)
    local mapID = 0
    if C_Map and C_Map.GetBestMapForUnit then
        local rawMap = C_Map.GetBestMapForUnit("player")
        if type(rawMap) == "number" and not IsSecret(rawMap) then
            mapID = rawMap
        end
    end
    local mapH, mapL = Encode12(mapID)
    local r1, g1, b1 = Encode6(mapH)
    local r2, g2, b2 = Encode6(mapL)
    SetCell(1, r1, g1, b1)
    SetCell(2, r2, g2, b2)

    -- Cell 3 & 4: Player X (12-bit normalized 0..4095)
    -- Cell 5 & 6: Player Y (12-bit normalized 0..4095)
    local xInt, yInt = 0, 0
    if mapID > 0 and C_Map and C_Map.GetPlayerMapPosition then
        local pos = C_Map.GetPlayerMapPosition(mapID, "player")
        if pos and pos.x and pos.y then
            local px = pos.x
            local py = pos.y
            if type(px) == "number" and not IsSecret(px) then
                xInt = math.floor(math.max(0, math.min(1, px)) * 4095)
            end
            if type(py) == "number" and not IsSecret(py) then
                yInt = math.floor(math.max(0, math.min(1, py)) * 4095)
            end
        end
    end
    local xH, xL = Encode12(xInt)
    local yH, yL = Encode12(yInt)
    local rx1, gx1, bx1 = Encode6(xH)
    local rx2, gx2, bx2 = Encode6(xL)
    local ry1, gy1, by1 = Encode6(yH)
    local ry2, gy2, by2 = Encode6(yL)
    SetCell(3, rx1, gx1, bx1)
    SetCell(4, rx2, gx2, bx2)
    SetCell(5, ry1, gy1, by1)
    SetCell(6, ry2, gy2, by2)

    -- Cell 7 & 8: Facing Angle (12-bit 0..4095)
    local facing = 0
    local rawFacing = GetPlayerFacing and GetPlayerFacing() or 0
    if type(rawFacing) == "number" and not IsSecret(rawFacing) then
        facing = rawFacing
    end
    local fInt = math.floor((facing / (math.pi * 2)) * 4095) % 4096
    local fH, fL = Encode12(fInt)
    local rf1, gf1, bf1 = Encode6(fH)
    local rf2, gf2, bf2 = Encode6(fL)
    SetCell(7, rf1, gf1, bf1)
    SetCell(8, rf2, gf2, bf2)

    -- Cell 9: Health Pct (6-bit 0..63)
    local _, _, hpPct = SafeGetUnitHealth("player")
    local hpPct6 = math.min(63, math.max(0, math.floor((hpPct / 100) * 63)))
    local rh, gh, bh = Encode6(hpPct6)
    SetCell(9, rh, gh, bh)

    -- Cell 10: Power Pct (6-bit 0..63)
    local _, _, powPct = SafeGetUnitPower("player")
    local powPct6 = math.min(63, math.max(0, math.floor((powPct / 100) * 63)))
    local rp, gp, bp = Encode6(powPct6)
    SetCell(10, rp, gp, bp)

    -- Cell 11: Status Flags (6-bit 0..63)
    local flags = 0

    -- Bit 0 (1): In Combat (safe event-driven + pcall validation)
    local inCombat = inCombatState
    local okCombat, isAff = pcall(function() return UnitAffectingCombat and UnitAffectingCombat("player") == true end)
    if okCombat and isAff == true then
        inCombat = true
    elseif okCombat and isAff == false then
        inCombat = false
    end
    if inCombat then flags = flags + 1 end

    -- Bit 1 (2): Dead or Ghost
    local isDead = isDeadState
    local okDead, isDeadVal = pcall(function() return UnitIsDeadOrGhost and UnitIsDeadOrGhost("player") == true end)
    if okDead and isDeadVal == true then
        isDead = true
    elseif okDead and isDeadVal == false then
        isDead = false
    end
    if isDead then flags = flags + 2 end

    -- Bit 2 (4): Resting
    local isResting = false
    local okRest, restVal = pcall(function() return IsResting and IsResting() == true end)
    if okRest and restVal == true then
        isResting = true
    end
    if isResting then flags = flags + 4 end

    -- Bit 3 (8): Mounted
    local isMounted = false
    local okMount, mountVal = pcall(function() return IsMounted and IsMounted() == true end)
    if okMount and mountVal == true then
        isMounted = true
    end
    if isMounted then flags = flags + 8 end

    -- Bit 4 (16): Has Target
    -- Bit 5 (32): Hostile Target
    local okTarg, targVal = pcall(function() return UnitExists and UnitExists("target") == true end)
    if okTarg and targVal == true then
        flags = flags + 16
        local okHostile, hostileVal = pcall(function() return UnitCanAttack and UnitCanAttack("player", "target") == true end)
        if okHostile and hostileVal == true then
            flags = flags + 32
        end
    end

    local rf, gf, bf = Encode6(flags)
    SetCell(11, rf, gf, bf)

    -- Cell 12: Tank Threat & Mitigation (6-bit 0..63)
    -- Bit 0 (1): Securely tanking target
    -- Bit 1 (2): Insecure threat / losing aggro on target
    -- Bit 2 (4): Party member / Healer under attack
    -- Bit 3 (8): Primary Mitigation Active (Shield Block, Ironfur, Bone Shield, etc.)
    -- Bit 4 (16): Secondary Mitigation Active (Ignore Pain, Blood Shield, etc.)
    -- Bit 5 (32): Major Defensive Active (Shield Wall, Last Stand, Spell Reflection, etc.)
    local tankThreatFlags = 0
    local okThreat, isTanking, threatStatus = pcall(function()
        if UnitExists and UnitExists("target") and UnitCanAttack and UnitCanAttack("player", "target") and UnitDetailedThreatSituation then
            return UnitDetailedThreatSituation("player", "target")
        end
        return false, 0
    end)
    if okThreat then
        local safeIsTanking = (type(isTanking) == "boolean" and not IsSecret(isTanking)) and isTanking or false
        if safeIsTanking or SafeCompare(threatStatus, "==", 3) then
            tankThreatFlags = tankThreatFlags + 1
        elseif SafeCompare(threatStatus, "==", 1) or SafeCompare(threatStatus, "==", 2) then
            tankThreatFlags = tankThreatFlags + 2
        end
    end

    -- Check if any party healer/dps is taking aggro in combat
    if inCombat then
        local healerDanger = false
        if IsInGroup and IsInGroup() and GetNumGroupMembers then
            local count = GetNumGroupMembers() or 0
            local prefix = (IsInRaid and IsInRaid()) and "raid" or "party"
            for i = 1, math.min(count, 5) do
                local u = prefix .. i
                if UnitExists and UnitExists(u) and not (UnitIsUnit and UnitIsUnit(u, "player")) then
                    local role = SafeGetUnitRole(u)
                    local okSit, sit = pcall(UnitThreatSituation, u)
                    if okSit and sit and not IsSecret(sit) and SafeCompare(sit, "==", 3) and (role == "HEALER" or role == "DAMAGER") then
                        healerDanger = true
                        break
                    end
                end
            end
        end
        if healerDanger then
            tankThreatFlags = tankThreatFlags + 4
        end
    end

    -- Primary Mitigation (Warrior Shield Block 132404 / 2565, Druid Ironfur 192081, DK Bone Shield 195181, DH Demon Spikes 203819, Monk Shuffle 322120, Paladin SotR 132403)
    local mit1 = HasPlayerAura(132404, "Shield Block") or HasPlayerAura(2565, "Shield Block") or HasPlayerAura(192081, "Ironfur") or HasPlayerAura(195181, "Bone Shield") or HasPlayerAura(203819, "Demon Spikes") or HasPlayerAura(322120, "Shuffle") or HasPlayerAura(132403, "Shield of the Righteous")
    if mit1 then tankThreatFlags = tankThreatFlags + 8 end

    -- Secondary Mitigation (Warrior Ignore Pain 190456, DK Blood Shield 77535)
    local mit2 = HasPlayerAura(190456, "Ignore Pain") or HasPlayerAura(77535, "Blood Shield")
    if mit2 then tankThreatFlags = tankThreatFlags + 16 end

    -- Major Defensive (Shield Wall 871, Last Stand 12975, Spell Reflection 23920, Demoralizing Shout 1160, Divine Protection 498, Icebound Fortitude 48792)
    local majDef = HasPlayerAura(871, "Shield Wall") or HasPlayerAura(12975, "Last Stand") or HasPlayerAura(23920, "Spell Reflection") or HasPlayerAura(1160, "Demoralizing Shout") or HasPlayerAura(498, "Divine Protection") or HasPlayerAura(642, "Divine Shield") or HasPlayerAura(48792, "Icebound Fortitude")
    if majDef then tankThreatFlags = tankThreatFlags + 32 end

    local curRole = SafeGetPlayerRole()

    if curRole == "HEALER" then
        -- Cell 12: Healer Triage Target & Health Bracket (6-bit)
        local lowestUnit, lowestName, lowestClass, lowestHpPct, aoeSpikeCount, tankInDanger, dispelTargetName, dispelType, dispelSpellName, lowestIdx = GetPartyTriageInfo()
        local bracket = 0
        if lowestHpPct < 20 then bracket = 4
        elseif lowestHpPct < 40 then bracket = 3
        elseif lowestHpPct < 60 then bracket = 2
        elseif lowestHpPct < 85 then bracket = 1
        else bracket = 0
        end
        local c12Val = (lowestIdx % 8) + (bracket * 8)
        local r12, g12, b12 = Encode6(c12Val)
        SetCell(12, r12, g12, b12)

        -- Cell 13: Emergency & Dispel Alert Flags (6-bit)
        local c13Val = 0
        if dispelTargetName and dispelTargetName ~= "" then
            c13Val = c13Val + 1
            if dispelType == "Curse" or dispelType == "Disease" then
                c13Val = c13Val + 8
            end
        end
        c13Val = c13Val + (math.min(3, aoeSpikeCount) * 2)
        if tankInDanger then c13Val = c13Val + 16 end
        if aoeSpikeCount >= 2 then c13Val = c13Val + 32 end
        local r13, g13, b13 = Encode6(c13Val)
        SetCell(13, r13, g13, b13)

        -- Cell 14: Healer Own Mana % (6-bit 0..63)
        local _, _, myManaPct = SafeGetUnitPower("player", 0)
        local myManaPct6 = math.min(63, math.max(0, math.floor((myManaPct / 100) * 63)))
        local r14, g14, b14 = Encode6(myManaPct6)
        SetCell(14, r14, g14, b14)

        -- Cell 15 & 16: Healer Priority Rotation Spell & Queue
        local nextSpellID, nextReason, queueSpellID, queueReason = GetLiveHealerRotation(lowestHpPct, aoeSpikeCount, tankInDanger, dispelTargetName, dispelType)
        local nextIdx = 0
        local queueIdx = 0
        if nextSpellID and nextSpellID > 0 then
            nextIdx = RegisterCatalogSpell(nextSpellID, nextReason)
        end
        if queueSpellID and queueSpellID > 0 then
            queueIdx = RegisterCatalogSpell(queueSpellID, queueReason)
        end
        local rn, gn, bn = Encode6(nextIdx)
        local rq, gq, bq = Encode6(queueIdx)
        SetCell(15, rn, gn, bn)
        SetCell(16, rq, gq, bq)
    else
        -- Tank Threat & Mitigation (Cell 12)
        local rt, gt, bt = Encode6(tankThreatFlags)
        SetCell(12, rt, gt, bt)

        -- Cell 13: Taunt Swap & Encounter Alert (6-bit 0..63)
        local tauntFlags = 0
        local coTankStacks, hasCoTank = GetCoTankDebuffInfo()
        tauntFlags = tauntFlags + math.min(7, coTankStacks)

        local bossActive = false
        if (UnitExists and UnitExists("boss1")) or (IsEncounterInProgress and IsEncounterInProgress()) then
            bossActive = true
            tauntFlags = tauntFlags + 32
        end

        local bossTargetingNonTank = false
        if bossActive and UnitExists and UnitExists("boss1target") then
            local bRole = SafeGetUnitRole("boss1target")
            if bRole == "HEALER" or bRole == "DAMAGER" then
                bossTargetingNonTank = true
            end
        end

        local hasNegation = HasPlayerAura(nil, "Negation") or HasPlayerAura(nil, "Negação")
        if (coTankStacks >= 2 and hasCoTank) or bossTargetingNonTank or hasNegation then
            tauntFlags = tauntFlags + 8
        end

        if IsTauntReady() then
            tauntFlags = tauntFlags + 16
        end

        local rw, gw, bw = Encode6(tauntFlags)
        SetCell(13, rw, gw, bw)

        -- Cell 14: Team Healer Mana Pct (6-bit 0..63)
        local healerManaPct6 = 63
        local healerUnit = nil
        if IsInGroup and IsInGroup() and GetNumGroupMembers then
            local count = GetNumGroupMembers() or 0
            local prefix = (IsInRaid and IsInRaid()) and "raid" or "party"
            for i = 1, math.min(count, 40) do
                local u = prefix .. i
                if UnitExists and UnitExists(u) and SafeGetUnitRole(u) == "HEALER" then
                    healerUnit = u
                    break
                end
            end
        end
        if healerUnit then
            local _, _, hManaPct = SafeGetUnitPower(healerUnit, 0)
            healerManaPct6 = math.min(63, math.max(0, math.floor((hManaPct / 100) * 63)))
        end
        local rm, gm, bm = Encode6(healerManaPct6)
        SetCell(14, rm, gm, bm)

        -- Cell 15: DPS Next Spell Index (6-bit 0..63)
        -- Cell 16: DPS Queue Spell Index (6-bit 0..63)
        local nextSpellID, nextReason, queueSpellID, queueReason = GetLiveDPSRotation()
        local nextIdx = 0
        local queueIdx = 0
        if nextSpellID and nextSpellID > 0 then
            nextIdx = RegisterCatalogSpell(nextSpellID, nextReason)
        end
        if queueSpellID and queueSpellID > 0 then
            queueIdx = RegisterCatalogSpell(queueSpellID, queueReason)
        end

        local rn, gn, bn = Encode6(nextIdx)
        local rq, gq, bq = Encode6(queueIdx)
        SetCell(15, rn, gn, bn)
        SetCell(16, rq, gq, bq)
    end
end

frame:SetScript("OnUpdate", function(self, elapsed)
    timeSinceLast = timeSinceLast + elapsed
    if timeSinceLast >= UPDATE_INTERVAL then
        timeSinceLast = 0
        UpdateTelemetry()
    end
end)

-- =========================================================================
-- Data Export: Bags, Equipment, Quests, Collections
-- =========================================================================

local function SafeGetItemInfo(linkOrID)
    if not linkOrID then return nil end
    local getItem = (C_Item and C_Item.GetItemInfo) or GetItemInfo
    if getItem then
        local ok, name, _, quality, ilvl, minLvl, itemType, itemSubType, stackCount, equipLoc, texture, classID, subclassID = pcall(getItem, linkOrID)
        if ok and name then
            return name, quality or 1, ilvl or 0, texture, equipLoc or "", itemType or "", itemSubType or "", classID or 0, subclassID or 0
        end
    end
    local getInstant = (C_Item and C_Item.GetItemInfoInstant) or GetItemInfoInstant
    if getInstant then
        local ok, _, _, quality, equipLoc, texture, classID, subclassID = pcall(getInstant, linkOrID)
        if ok then
            return nil, quality or 1, 0, texture, equipLoc or "", "", "", classID or 0, subclassID or 0
        end
    end
    return nil, 1, 0, nil, "", "", "", 0, 0
end

local function ExportFullData()
    local charName, realm = UnitFullName("player")
    local _, classFilename = UnitClass("player")
    local level = UnitLevel("player")
    local money = GetMoney() or 0
    local mapID = C_Map and C_Map.GetBestMapForUnit and C_Map.GetBestMapForUnit("player") or 0
    local zoneName = GetZoneText() or ""
    local subZone = GetSubZoneText() or ""

    local overallIlvl, equippedIlvl = 0, 0
    if GetAverageItemLevel then
        local ok, o, e = pcall(GetAverageItemLevel)
        if ok and type(o) == "number" then
            overallIlvl = math.floor(o * 10) / 10
            equippedIlvl = math.floor((e or o) * 10) / 10
        end
    end

    local raceName, raceFile = "", ""
    if UnitRace then
        local ok, rName, rFile = pcall(UnitRace, "player")
        if ok then raceName = rName or ""; raceFile = rFile or "" end
    end
    local gender = "male"
    if UnitSex then
        local ok, s = pcall(UnitSex, "player")
        if ok and s == 3 then gender = "female" end
    end

    -- Character Stats
    local stats = {
        strength = SafeNumber(UnitStat and select(2, pcall(UnitStat, "player", 1))),
        agility = SafeNumber(UnitStat and select(2, pcall(UnitStat, "player", 2))),
        stamina = SafeNumber(UnitStat and select(2, pcall(UnitStat, "player", 3))),
        intellect = SafeNumber(UnitStat and select(2, pcall(UnitStat, "player", 4))),
        armor = SafeNumber(UnitArmor and select(2, pcall(UnitArmor, "player"))),
        crit = SafeNumber(GetCritChance and select(2, pcall(GetCritChance))),
        haste = SafeNumber(GetHaste and select(2, pcall(GetHaste))),
        mastery = SafeNumber(GetMasteryEffect and select(2, pcall(GetMasteryEffect))),
        versatility = SafeNumber(GetCombatRatingBonus and select(2, pcall(GetCombatRatingBonus, 29)))
    }

    -- Instance & Tank Spec Context
    local instName, instType, diffID, diffName = "", "none", 0, ""
    if GetInstanceInfo then
        local okInst, n, t, d, dName = pcall(GetInstanceInfo)
        if okInst then
            instName = n or ""
            instType = t or "none"
            diffID = d or 0
            diffName = dName or ""
        end
    end

    local specID, specName, specRole = 0, "", ""
    if GetSpecialization and GetSpecializationInfo then
        local okSpec, curSpec = pcall(GetSpecialization)
        if okSpec and curSpec then
            local okInfo, id, name, _, _, role = pcall(GetSpecializationInfo, curSpec)
            if okInfo and id then
                specID = SafeNumber(id, 0)
                specName = SafeString(name, "")
                specRole = SafeString(role, "")
            end
        end
    end

    local bossName = ""
    if UnitExists and UnitExists("boss1") and UnitName then
        local okB, bn = pcall(UnitName, "boss1")
        if okB and bn then bossName = SafeString(bn, "") end
    end

    -- Party Vitality & Healer Summary
    local partyMembers = {}
    local healerInfo = { name = "", class = "", manaPct = 100 }
    local hasSated = HasPlayerAura(57724) or HasPlayerAura(80354) or HasPlayerAura(264689) or HasPlayerAura(57723) or HasPlayerAura(390435)
    local bResCharges = 0
    if C_Spell and C_Spell.GetSpellCharges then
        local okC, info = pcall(C_Spell.GetSpellCharges, 20484)
        if okC and info and info.currentCharges and not IsSecret(info.currentCharges) then
            bResCharges = info.currentCharges
        end
    elseif GetSpellCharges then
        local okC, cur = pcall(GetSpellCharges, 20484)
        if okC and type(cur) == "number" and not IsSecret(cur) then bResCharges = cur end
    end

    local inGroup = (IsInGroup and IsInGroup()) or false
    local isRaid = (IsInRaid and IsInRaid()) or false
    local numGrp = (GetNumGroupMembers and GetNumGroupMembers()) or 0
    if inGroup and numGrp > 0 then
        local pfx = isRaid and "raid" or "party"
        local loopCount = isRaid and math.min(numGrp, 40) or math.min(numGrp - 1, 4)
        local _, _, pHpPct = SafeGetUnitHealth("player")
        table.insert(partyMembers, {
            name = charName or UnitName("player"),
            class = classFilename,
            role = specRole,
            hpPct = pHpPct,
            manaPct = 100,
            isDead = (UnitIsDeadOrGhost and UnitIsDeadOrGhost("player")) or false,
            isPlayer = true
        })
        for i = 1, loopCount do
            local u = pfx .. i
            if UnitExists and UnitExists(u) then
                local uName = SafeString(UnitName and UnitName(u), u)
                local _, uClass = UnitClass(u)
                local uRole = SafeGetUnitRole(u)
                local _, _, uHpPct = SafeGetUnitHealth(u)
                local _, _, uManaPct = SafeGetUnitPower(u, 0)
                local isD = (UnitIsDeadOrGhost and UnitIsDeadOrGhost(u)) or false
                if uRole == "HEALER" then
                    healerInfo = { name = uName, class = SafeString(uClass, "PRIEST"), manaPct = uManaPct }
                end
                table.insert(partyMembers, {
                    name = uName,
                    class = uClass or "",
                    role = uRole,
                    hpPct = uHpPct,
                    manaPct = uManaPct,
                    isDead = isD,
                    isPlayer = false
                })
            end
        end
    end

    -- Mythic+ Keystone & Challenge Mode Info (Midnight Season 2)
    local mplusInfo = {
        isActive = false,
        level = 0,
        mapChallengeID = 0,
        mapName = "",
        timeLimit = 0,
        trashPct = 0,
        deathCount = 0,
        timeLost = 0
    }
    if C_ChallengeMode and C_ChallengeMode.IsChallengeModeActive and C_ChallengeMode.IsChallengeModeActive() then
        mplusInfo.isActive = true
        local mapChallengeID = C_ChallengeMode.GetActiveChallengeMapID and C_ChallengeMode.GetActiveChallengeMapID()
        if mapChallengeID then
            mplusInfo.mapChallengeID = mapChallengeID
            local name, _, timeLimit = C_ChallengeMode.GetMapUIInfo(mapChallengeID)
            mplusInfo.mapName = name or ""
            mplusInfo.timeLimit = timeLimit or 0
        end
        if C_ChallengeMode.GetActiveKeystoneInfo then
            local okK, lvl = pcall(C_ChallengeMode.GetActiveKeystoneInfo)
            if okK and type(lvl) == "number" then mplusInfo.level = lvl end
        end
        if C_ChallengeMode.GetDeathCount then
            local okD, dCount, tLost = pcall(C_ChallengeMode.GetDeathCount)
            if okD then
                mplusInfo.deathCount = dCount or 0
                mplusInfo.timeLost = tLost or 0
            end
        end
        if C_Scenario and C_Scenario.GetCriteriaInfo then
            for c = 1, 10 do
                local okCrit, crit = pcall(C_Scenario.GetCriteriaInfo, c)
                if okCrit and crit and crit.totalQuantity and crit.totalQuantity > 0 then
                    if crit.description and (crit.description:find("Forces") or crit.description:find("Forças") or crit.description:find("Inimigos")) then
                        mplusInfo.trashPct = math.min(100, math.floor((crit.quantity / crit.totalQuantity) * 1000) / 10)
                        break
                    end
                end
            end
        end
    end

    local data = {
        updatedAt = date("%Y-%m-%d %H:%M:%S"),
        settings = WoWCompanionDB.settings or { voiceAlerts = false, soundAlerts = true, showBar = true },
        character = {
            name = charName or UnitName("player"),
            realm = realm or GetRealmName(),
            class = classFilename,
            race = raceFile,
            raceName = raceName,
            gender = gender,
            level = level,
            activeSpec = specName,
            role = specRole,
            avgItemLevel = overallIlvl,
            equippedItemLevel = equippedIlvl,
            stats = stats,
            money = {
                gold = math.floor(money / 10000),
                silver = math.floor((money % 10000) / 100),
                copper = money % 100,
                total = money
            },
            zone = zoneName,
            subZone = subZone,
            mapID = mapID
        },
        party = {
            inGroup = inGroup,
            isRaid = isRaid,
            membersCount = numGrp,
            healer = healerInfo,
            battleResCharges = bResCharges,
            hasSated = hasSated,
            members = partyMembers
        },
        mplus = mplusInfo,
        tank = {
            specId = specID,
            specName = specName,
            role = specRole,
            isTank = (specRole == "TANK"),
            instance = {
                name = instName,
                type = instType,
                difficulty = diffName,
                inEncounter = (IsEncounterInProgress and IsEncounterInProgress() == true) or false,
                bossName = bossName
            }
        },
        equipment = {},
        bags = {
            totalSlots = 0,
            freeSlots = 0,
            items = {}
        },
        quests = {},
        collections = {
            mountsCount = (C_MountJournal and ((C_MountJournal.GetNumMounts and C_MountJournal.GetNumMounts()) or (C_MountJournal.GetNumDisplayedMounts and C_MountJournal.GetNumDisplayedMounts()) or 0)) or 0,
            petsCount = (C_PetJournal and C_PetJournal.GetNumPets and select(2, C_PetJournal.GetNumPets())) or 0,
            toysCount = (C_ToyBox and C_ToyBox.GetNumLearnedToys and C_ToyBox.GetNumLearnedToys()) or 0,
            achievementPoints = GetTotalAchievementPoints and GetTotalAchievementPoints() or 0
        },
        mapArt = {}
    }

    -- Map Art Layers and Tile FileDataIDs
    if mapID and mapID > 0 and C_Map and C_Map.GetMapArtLayers then
        local okLayers, layers = pcall(C_Map.GetMapArtLayers, mapID)
        if okLayers and layers then
            for idx, layer in ipairs(layers) do
                local texs = {}
                if C_Map.GetMapArtLayerTextures then
                    local okTex, tList = pcall(C_Map.GetMapArtLayerTextures, mapID, idx)
                    if okTex and tList then
                        texs = tList
                    end
                end
                table.insert(data.mapArt, {
                    layerIndex = idx,
                    layerWidth = layer.layerWidth,
                    layerHeight = layer.layerHeight,
                    tileWidth = layer.tileWidth,
                    tileHeight = layer.tileHeight,
                    textures = texs
                })
            end
        end
    end

    -- Equipment (Slots 1 to 19)
    local slotNames = {
        [1] = "Head", [2] = "Neck", [3] = "Shoulder", [4] = "Shirt",
        [5] = "Chest", [6] = "Waist", [7] = "Legs", [8] = "Feet",
        [9] = "Wrist", [10] = "Hands", [11] = "Finger1", [12] = "Finger2",
        [13] = "Trinket1", [14] = "Trinket2", [15] = "Back", [16] = "MainHand",
        [17] = "SecondaryHand", [18] = "Ranged", [19] = "Tabard"
    }

    for slotID = 1, 19 do
        local itemLink = GetInventoryItemLink("player", slotID)
        local slotName = slotNames[slotID] or ("Slot" .. slotID)
        if itemLink then
            local itemName, itemQuality, baseIlvl, itemTexture, equipLoc, itemType, itemSubType, classID, subclassID = SafeGetItemInfo(itemLink)
            local itemID = tonumber(itemLink:match("item:(%d+)"))

            -- Real Upgraded Item Level
            local realIlvl = 0
            if C_Item and C_Item.GetCurrentItemLevel and ItemLocation and ItemLocation.CreateFromEquipmentSlot then
                local okLoc, itemLoc = pcall(ItemLocation.CreateFromEquipmentSlot, ItemLocation, slotID)
                if okLoc and itemLoc and C_Item.DoesItemExist and C_Item.DoesItemExist(itemLoc) then
                    local okLvl, curLvl = pcall(C_Item.GetCurrentItemLevel, itemLoc)
                    if okLvl and type(curLvl) == "number" and curLvl > 0 then
                        realIlvl = curLvl
                    end
                end
            end
            if realIlvl == 0 and GetDetailedItemLevelInfo then
                local okDet, effLvl = pcall(GetDetailedItemLevelInfo, itemLink)
                if okDet and type(effLvl) == "number" and effLvl > 0 then
                    realIlvl = effLvl
                end
            end
            if realIlvl == 0 then realIlvl = baseIlvl or 0 end

            -- Upgrade Track (e.g. "Hero 2/6", "Champion 4/8", "Veteran 3/8")
            local upgradeTrack = ""
            if C_TooltipInfo and C_TooltipInfo.GetInventoryItem then
                local okTip, tip = pcall(C_TooltipInfo.GetInventoryItem, "player", slotID)
                if okTip and tip and tip.lines then
                    for _, line in ipairs(tip.lines) do
                        local txt = line.leftText or ""
                        if txt:find("Upgrade") or txt:find("Melhoria") or txt:find("Nivel") or txt:find("Nível") or txt:match("%d+/%d+") then
                            local track = txt:match("[Uu]pgrade%s*[Ll]evel:?%s*(.+)")
                                       or txt:match("[Mm]elhoria:?%s*(.+)")
                                       or txt:match("([A-Za-zÀ-ÿ]+%s+%d+/%d+)")
                            if track and not txt:find("Requires") and not txt:find("Requer") and not txt:find("Durability") then
                                upgradeTrack = track:gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|r", ""):gsub("^%s*(.-)%s*$", "%1")
                                break
                            end
                        end
                    end
                end
            end

            data.equipment[slotName] = {
                slotId = slotID,
                itemID = itemID,
                name = itemName or ("Item " .. slotID),
                quality = itemQuality or 1,
                itemLevel = realIlvl,
                upgradeTrack = upgradeTrack,
                equipLoc = equipLoc or "",
                itemType = itemType or "",
                itemSubType = itemSubType or "",
                classID = classID or 0,
                subclassID = subclassID or 0,
                icon = itemTexture,
                link = itemLink
            }
        end
    end

    -- Bags (0 = backpack, 1-4 = bags, 5 = reagent bag in Retail)
    local containerApi = C_Container or {}
    local getNumSlots = containerApi.GetContainerNumSlots or GetContainerNumSlots
    local getContainerInfo = containerApi.GetContainerItemInfo or GetContainerItemInfo
    local getFreeSlots = containerApi.GetContainerNumFreeSlots or GetContainerNumFreeSlots

    for bagID = 0, 5 do
        if getNumSlots then
            local numSlots = getNumSlots(bagID) or 0
            if numSlots > 0 then
                data.bags.totalSlots = data.bags.totalSlots + numSlots
                if getFreeSlots then
                    data.bags.freeSlots = data.bags.freeSlots + (getFreeSlots(bagID) or 0)
                end
                for slot = 1, numSlots do
                    local itemInfo = getContainerInfo(bagID, slot)
                    if itemInfo then
                        local itemLink = itemInfo.hyperlink or (GetContainerItemLink and GetContainerItemLink(bagID, slot)) or (containerApi.GetContainerItemLink and containerApi.GetContainerItemLink(bagID, slot))
                        local itemName, itemQuality, baseIlvl, itemTexture, equipLoc, itemType, itemSubType, classID, subclassID
                        if itemLink then
                            itemName, itemQuality, baseIlvl, itemTexture, equipLoc, itemType, itemSubType, classID, subclassID = SafeGetItemInfo(itemLink)
                        end
                        local itemID = itemInfo.itemID or (itemLink and tonumber(itemLink:match("item:(%d+)")))

                        -- Real Upgraded Item Level for Bag Item
                        local realIlvl = 0
                        if C_Item and C_Item.GetCurrentItemLevel and ItemLocation and ItemLocation.CreateFromBagAndSlot then
                            local okLoc, itemLoc = pcall(ItemLocation.CreateFromBagAndSlot, ItemLocation, bagID, slot)
                            if okLoc and itemLoc and C_Item.DoesItemExist and C_Item.DoesItemExist(itemLoc) then
                                local okLvl, curLvl = pcall(C_Item.GetCurrentItemLevel, itemLoc)
                                if okLvl and type(curLvl) == "number" and curLvl > 0 then
                                    realIlvl = curLvl
                                end
                            end
                        end
                        if realIlvl == 0 and GetDetailedItemLevelInfo and itemLink then
                            local okDet, effLvl = pcall(GetDetailedItemLevelInfo, itemLink)
                            if okDet and type(effLvl) == "number" and effLvl > 0 then
                                realIlvl = effLvl
                            end
                        end
                        if realIlvl == 0 then realIlvl = baseIlvl or 0 end

                        -- Upgrade Track for Bag Item
                        local upgradeTrack = ""
                        if C_TooltipInfo and C_TooltipInfo.GetBagItem then
                            local okTip, tip = pcall(C_TooltipInfo.GetBagItem, bagID, slot)
                            if okTip and tip and tip.lines then
                                for _, line in ipairs(tip.lines) do
                                    local txt = line.leftText or ""
                                    if txt:find("Upgrade") or txt:find("Melhoria") or txt:find("Nivel") or txt:find("Nível") or txt:match("%d+/%d+") then
                                        local track = txt:match("[Uu]pgrade%s*[Ll]evel:?%s*(.+)")
                                                   or txt:match("[Mm]elhoria:?%s*(.+)")
                                                   or txt:match("([A-Za-zÀ-ÿ]+%s+%d+/%d+)")
                                        if track and not txt:find("Requires") and not txt:find("Requer") and not txt:find("Durability") then
                                            upgradeTrack = track:gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|r", ""):gsub("^%s*(.-)%s*$", "%1")
                                            break
                                        end
                                    end
                                end
                            end
                        end

                        local sellPrice = 0
                        if itemLink then
                            local okP, _, _, _, _, _, _, _, _, _, sp = pcall(GetItemInfo, itemLink)
                            if okP and type(sp) == "number" then sellPrice = sp end
                        end

                        table.insert(data.bags.items, {
                            bag = bagID,
                            slot = slot,
                            itemID = itemID,
                            name = itemName or ("Item " .. (itemID or "")),
                            quality = itemQuality or itemInfo.quality or 1,
                            itemLevel = realIlvl,
                            upgradeTrack = upgradeTrack,
                            equipLoc = equipLoc or "",
                            itemType = itemType or "",
                            itemSubType = itemSubType or "",
                            classID = classID or 0,
                            subclassID = subclassID or 0,
                            count = itemInfo.stackCount or 1,
                            icon = itemTexture or itemInfo.iconFileID,
                            link = itemLink,
                            sellPrice = sellPrice,
                            isJunk = ((itemQuality or itemInfo.quality or 1) == 0)
                        })
                    end
                end
            end
        end
    end

    -- Quests (Modern Retail C_QuestLog + Classic Fallback)
    local quests = {}
    local questIDsFound = {}

    -- Expand headers if possible so all quests are visible in query
    if ExpandQuestHeader then pcall(ExpandQuestHeader, 0) end

    if C_QuestLog and C_QuestLog.GetNumQuestLogEntries then
        local numEntries = (C_QuestLog.GetNumQuestLogEntries() or 0)
        for i = 1, numEntries do
            local qid = (C_QuestLog.GetQuestIDForLogIndex and C_QuestLog.GetQuestIDForLogIndex(i)) or 0
            local info = C_QuestLog.GetInfo and C_QuestLog.GetInfo(i)
            if (not qid or qid == 0) and info and info.questID then
                qid = info.questID
            end

            local isHeader = (info and info.isHeader) or false
            local isHidden = (info and info.isHidden) or false

            if qid and qid > 0 and not isHeader and not isHidden then
                if not questIDsFound[qid] then
                    questIDsFound[qid] = true
                    local objectives = {}
                    local rawObjs = C_QuestLog.GetQuestObjectives and C_QuestLog.GetQuestObjectives(qid)
                    if rawObjs then
                        for _, obj in ipairs(rawObjs) do
                            table.insert(objectives, {
                                text = obj.text or "",
                                finished = obj.finished or false,
                                numFulfilled = obj.numFulfilled or 0,
                                numRequired = obj.numRequired or 0
                            })
                        end
                    end
                    local isCompl = false
                    if info and info.isComplete ~= nil then
                        isCompl = (info.isComplete == true or info.isComplete == 1)
                    elseif C_QuestLog.IsComplete then
                        isCompl = (C_QuestLog.IsComplete(qid) == true)
                    end
                    table.insert(quests, {
                        questID = qid,
                        title = (info and info.title) or (C_QuestLog.GetTitleForQuestID and C_QuestLog.GetTitleForQuestID(qid)) or ("Quest #" .. qid),
                        level = (info and info.level) or 90,
                        isComplete = isCompl,
                        objectives = objectives
                    })
                end
            end
        end
    end

    -- Also check Quest Watches (Tracked Quests)
    if C_QuestLog and C_QuestLog.GetNumQuestWatches then
        local numWatches = (C_QuestLog.GetNumQuestWatches() or 0)
        for w = 1, numWatches do
            local wQid = (C_QuestLog.GetQuestIDForQuestWatchIndex and C_QuestLog.GetQuestIDForQuestWatchIndex(w)) or 0
            if wQid and wQid > 0 and not questIDsFound[wQid] then
                questIDsFound[wQid] = true
                local wObjs = {}
                local rawObjs = C_QuestLog.GetQuestObjectives and C_QuestLog.GetQuestObjectives(wQid)
                if rawObjs then
                    for _, obj in ipairs(rawObjs) do
                        table.insert(wObjs, {
                            text = obj.text or "",
                            finished = obj.finished or false,
                            numFulfilled = obj.numFulfilled or 0,
                            numRequired = obj.numRequired or 0
                        })
                    end
                end
                table.insert(quests, {
                    questID = wQid,
                    title = (C_QuestLog.GetTitleForQuestID and C_QuestLog.GetTitleForQuestID(wQid)) or ("Quest #" .. wQid),
                    level = 90,
                    isComplete = (C_QuestLog.IsComplete and C_QuestLog.IsComplete(wQid) == true) or false,
                    objectives = wObjs
                })
            end
        end
    end

    if #quests == 0 and GetNumQuestLogEntries then
        local numEntries = (GetNumQuestLogEntries() or 0)
        for i = 1, numEntries do
            local title, level, tag, isHeader, isCollapsed, isComplete, freq, qid = GetQuestLogTitle(i)
            if not isHeader and qid and qid > 0 and not questIDsFound[qid] then
                questIDsFound[qid] = true
                local numLeaderBoards = (GetNumQuestLeaderBoards and GetNumQuestLeaderBoards(i)) or 0
                local objectives = {}
                for j = 1, numLeaderBoards do
                    local desc, qType, done = GetQuestLogLeaderBoard(j, i)
                    table.insert(objectives, {
                        text = desc or "",
                        finished = done or false,
                        numFulfilled = done and 1 or 0,
                        numRequired = 1
                    })
                end
                table.insert(quests, {
                    questID = qid,
                    title = title or ("Quest #" .. qid),
                    level = level or 0,
                    isComplete = (isComplete == 1 or isComplete == true),
                    objectives = objectives
                })
            end
        end
    end

    -- Current Map POIs & Quests for Companion GPS
    local curMapID = C_Map and C_Map.GetBestMapForUnit and C_Map.GetBestMapForUnit("player")
    if curMapID and curMapID > 0 then
        data.mapID = curMapID
        local poiList = C_AreaPoiInfo and C_AreaPoiInfo.GetAreaPOIForMap and C_AreaPoiInfo.GetAreaPOIForMap(curMapID)
        local mapPois = {}
        if poiList then
            for _, pid in ipairs(poiList) do
                local pinfo = C_AreaPoiInfo.GetAreaPOIInfo(curMapID, pid)
                if pinfo and pinfo.position then
                    table.insert(mapPois, {
                        id = pid,
                        name = pinfo.name or "",
                        description = pinfo.description or "",
                        x = pinfo.position.x,
                        y = pinfo.position.y,
                        atlas = pinfo.atlasName or ""
                    })
                end
            end
        end
        data.mapPOIs = mapPois

        local mapQuests = {}
        if C_QuestLog and C_QuestLog.GetQuestsOnMap then
            local mqList = C_QuestLog.GetQuestsOnMap(curMapID)
            if mqList then
                for _, qe in ipairs(mqList) do
                    table.insert(mapQuests, {
                        questID = qe.questID,
                        x = qe.x,
                        y = qe.y
                    })
                end
            end
        end
        data.mapQuests = mapQuests
    end

    -- Preserve existing equipment, bags, and quests if game cache hasn't loaded items yet
    if #quests == 0 and WoWCompanionDB and WoWCompanionDB.quests and #WoWCompanionDB.quests > 0 then
        data.quests = WoWCompanionDB.quests
    else
        data.quests = quests
    end

    if #data.bags.items == 0 and WoWCompanionDB and WoWCompanionDB.bags and WoWCompanionDB.bags.items and #WoWCompanionDB.bags.items > 0 then
        data.bags = WoWCompanionDB.bags
    end
    local equipCount = 0
    for _ in pairs(data.equipment) do equipCount = equipCount + 1 end
    if equipCount == 0 and WoWCompanionDB and WoWCompanionDB.equipment then
        data.equipment = WoWCompanionDB.equipment
    end

    -- Update and export DPS/Healer Rotation spell catalog with keybinds
    ScanActionBarKeybinds()
    for _, sp in pairs(rotationCatalog) do
        sp.keybind = GetSpellKeybind(sp.id)
    end
    data.rotationCatalog = rotationCatalog

    -- Export Live Healer Triage Data
    local lowestUnit, lowestName, lowestClass, lowestHpPct, aoeSpikeCount, tankInDanger, dispelTargetName, dispelType, dispelSpellName, lowestIdx = GetPartyTriageInfo()
    data.triage = {
        lowestUnit = lowestUnit,
        lowestName = lowestName,
        lowestClass = lowestClass,
        lowestHpPct = lowestHpPct,
        aoeSpikeCount = aoeSpikeCount,
        tankInDanger = tankInDanger,
        dispelTarget = dispelTargetName,
        dispelType = dispelType,
        dispelSpell = dispelSpellName
    }

    WoWCompanionDB = data
    return data
end

local eventFrame = CreateFrame("Frame")
eventFrame:RegisterEvent("PLAYER_LOGIN")
eventFrame:RegisterEvent("PLAYER_LOGOUT")
eventFrame:RegisterEvent("PLAYER_REGEN_DISABLED")
eventFrame:RegisterEvent("PLAYER_REGEN_ENABLED")
eventFrame:RegisterEvent("PLAYER_DEAD")
eventFrame:RegisterEvent("PLAYER_ALIVE")
eventFrame:RegisterEvent("PLAYER_UNGHOST")
eventFrame:RegisterEvent("UI_SCALE_CHANGED")
eventFrame:RegisterEvent("DISPLAY_SIZE_CHANGED")
eventFrame:RegisterEvent("BAG_UPDATE")
eventFrame:RegisterEvent("QUEST_LOG_UPDATE")
eventFrame:RegisterEvent("PLAYER_EQUIPMENT_CHANGED")
eventFrame:RegisterEvent("ACTIONBAR_SLOT_CHANGED")
eventFrame:RegisterEvent("UPDATE_BINDINGS")
eventFrame:RegisterEvent("PLAYER_SPECIALIZATION_CHANGED")
eventFrame:RegisterEvent("SPELLS_CHANGED")
eventFrame:RegisterEvent("TRAIT_CONFIG_UPDATED")

local saveCooldown = 0
eventFrame:SetScript("OnEvent", function(self, event, ...)
    if event == "PLAYER_LOGIN" then
        UpdatePixelScale()
        ScanActionBarKeybinds()
        PrepopulateSpecCatalog()
        inCombatState = (UnitAffectingCombat and UnitAffectingCombat("player") == true) or false
        isDeadState = (UnitIsDeadOrGhost and UnitIsDeadOrGhost("player") == true) or false
        if WoWCompanionDB.settings and WoWCompanionDB.settings.showBar == false then
            frame:Hide()
        end
        local vStatus = (WoWCompanionDB.settings and WoWCompanionDB.settings.voiceAlerts) and "|cff00ff00Ativa|r" or "|cffff2020Silenciada|r"
        print("|cff00e5ff[WoW Companion]|r Telemetria carregada! Voz: " .. vStatus .. " | Digita |cffffd100/wc|r para Definições.")
        ExportFullData()
        -- Re-export after 3s when bags and equipment are fully populated in client cache
        if C_Timer and C_Timer.After then
            C_Timer.After(3.0, function()
                ScanActionBarKeybinds()
                PrepopulateSpecCatalog()
                ExportFullData()
            end)
        end
    elseif event == "PLAYER_REGEN_DISABLED" then
        inCombatState = true
    elseif event == "PLAYER_REGEN_ENABLED" then
        inCombatState = false
    elseif event == "PLAYER_DEAD" then
        isDeadState = true
    elseif event == "PLAYER_ALIVE" or event == "PLAYER_UNGHOST" then
        isDeadState = false
    elseif event == "ACTIONBAR_SLOT_CHANGED" or event == "UPDATE_BINDINGS" or event == "PLAYER_SPECIALIZATION_CHANGED" or event == "SPELLS_CHANGED" or event == "TRAIT_CONFIG_UPDATED" then
        ScanActionBarKeybinds()
        PrepopulateSpecCatalog()
        for _, sp in pairs(rotationCatalog) do
            sp.keybind = GetSpellKeybind(sp.id)
        end
        ExportFullData()
    elseif event == "UI_SCALE_CHANGED" or event == "DISPLAY_SIZE_CHANGED" then
        UpdatePixelScale()
    elseif event == "PLAYER_LOGOUT" then
        ExportFullData()
    else
        local now = GetTime()
        if now - saveCooldown > 5 then
            saveCooldown = now
            ExportFullData()
        end
    end
end)

-- =========================================================================
-- In-Game Settings GUI & Configuration Frame
-- =========================================================================

local settingsFrame = nil

local function CreateOrShowSettingsFrame()
    if settingsFrame then
        if settingsFrame:IsShown() then
            settingsFrame:Hide()
        else
            settingsFrame:Show()
        end
        return
    end

    local f = CreateFrame("Frame", "WoWCompanionSettingsFrame", UIParent, "BackdropTemplate")
    f:SetSize(460, 370)
    f:SetPoint("CENTER", UIParent, "CENTER", 0, 40)
    f:SetFrameStrata("DIALOG")
    f:SetMovable(true)
    f:EnableMouse(true)
    f:RegisterForDrag("LeftButton")
    f:SetScript("OnDragStart", f.StartMoving)
    f:SetScript("OnDragStop", f.StopMovingOrSizing)
    f:SetClampedToScreen(true)

    if f.SetBackdrop then
        f:SetBackdrop({
            bgFile = "Interface\\Buttons\\WHITE8X8",
            edgeFile = "Interface\\Buttons\\WHITE8X8",
            edgeSize = 2,
            insets = { left = 2, right = 2, top = 2, bottom = 2 }
        })
        f:SetBackdropColor(0.06, 0.08, 0.12, 0.96)
        f:SetBackdropBorderColor(0.0, 0.75, 1.0, 0.85)
    end

    -- Close "X" Button
    local closeX = CreateFrame("Button", nil, f, "UIPanelCloseButton")
    closeX:SetPoint("TOPRIGHT", f, "TOPRIGHT", -4, -4)
    closeX:SetScript("OnClick", function() f:Hide() end)

    -- Title
    local title = f:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
    title:SetPoint("TOPLEFT", f, "TOPLEFT", 22, -18)
    title:SetText("|cff00e5ffWoW Companion|r — Definições")

    -- Subtitle
    local sub = f:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
    sub:SetPoint("TOPLEFT", title, "BOTTOMLEFT", 0, -4)
    sub:SetText("|cff99aabbConfiguração no jogo e sincronização com iPad / segundo ecrã|r")

    -- Separator
    local sep = f:CreateTexture(nil, "ARTWORK")
    sep:SetSize(416, 1)
    sep:SetPoint("TOPLEFT", sub, "BOTTOMLEFT", 0, -10)
    sep:SetColorTexture(0.2, 0.35, 0.5, 0.6)

    -- Checkbox Helper
    local function CreateOptionCheckbox(name, parent, labelText, descText, yOffset, defaultChecked, onClick)
        local cb = CreateFrame("CheckButton", name, parent, "UICheckButtonTemplate")
        cb:SetPoint("TOPLEFT", parent, "TOPLEFT", 24, yOffset)
        cb:SetChecked(defaultChecked)

        local lbl = cb:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
        lbl:SetPoint("LEFT", cb, "RIGHT", 6, 0)
        lbl:SetText(labelText)

        local dsc = cb:CreateFontString(nil, "OVERLAY", "GameFontDisableSmall")
        dsc:SetPoint("TOPLEFT", lbl, "BOTTOMLEFT", 0, -3)
        dsc:SetPoint("RIGHT", parent, "RIGHT", -24, 0)
        dsc:SetJustifyH("LEFT")
        dsc:SetText(descText)

        cb:SetScript("OnClick", function(self)
            local isChecked = self:GetChecked()
            onClick(isChecked)
        end)
        return cb
    end

    -- 1. Checkbox: Voice Alerts (Text-to-Speech)
    local voiceCB = CreateOptionCheckbox(
        "WoWCompanion_VoiceCheck", f,
        "|cffffd100Alertas de Voz Sintetizada (Voz / TTS)|r",
        "Ativa ou desativa a voz que fala avisos de Taunt, Agro e Dispel no iPad/Web.\n|cffff6666(Desmarca esta opção para silenciar totalmente a voz irritante)|r",
        -70,
        WoWCompanionDB.settings.voiceAlerts == true,
        function(isChecked)
            WoWCompanionDB.settings.voiceAlerts = isChecked
            ExportFullData()
            if isChecked then
                print("|cff00e5ff[WoW Companion]|r 🔊 Alertas de voz: |cff00ff00ATIVADOS|r.")
            else
                print("|cff00e5ff[WoW Companion]|r 🔇 Alertas de voz: |cffff2020DESATIVADOS|r (Voz silenciada no iPad/Web).")
            end
        end
    )

    -- 2. Checkbox: Tactical Sound Alerts / Chimes
    local soundCB = CreateOptionCheckbox(
        "WoWCompanion_SoundCheck", f,
        "Sons Táteis & Chimes de Alerta",
        "Toca sons curtos ('chimes') em emergências críticas (HP <40%, perda de agro).",
        -150,
        WoWCompanionDB.settings.soundAlerts ~= false,
        function(isChecked)
            WoWCompanionDB.settings.soundAlerts = isChecked
            ExportFullData()
            print("|cff00e5ff[WoW Companion]|r Sons táteis: " .. (isChecked and "|cff00ff00ATIVADOS|r" or "|cffff2020DESATIVADOS|r"))
        end
    )

    -- 3. Checkbox: Telemetry Pixel Bar
    local barCB = CreateOptionCheckbox(
        "WoWCompanion_BarCheck", f,
        "Barra de Pixels de Telemetria (17 Células)",
        "Mantém a barra de 17 células no topo esquerdo do ecrã para sincronização a 30 FPS.",
        -220,
        WoWCompanionDB.settings.showBar ~= false,
        function(isChecked)
            WoWCompanionDB.settings.showBar = isChecked
            if isChecked then frame:Show() else frame:Hide() end
            ExportFullData()
            print("|cff00e5ff[WoW Companion]|r Barra de telemetria: " .. (isChecked and "|cff00ff00VISÍVEL|r" or "|cffff2020OCULTA|r"))
        end
    )

    -- Info Card at Bottom
    local infoCard = CreateFrame("Frame", nil, f, "BackdropTemplate")
    infoCard:SetSize(412, 38)
    infoCard:SetPoint("BOTTOM", f, "BOTTOM", 0, 50)
    if infoCard.SetBackdrop then
        infoCard:SetBackdrop({
            bgFile = "Interface\\Buttons\\WHITE8X8",
            edgeFile = "Interface\\Buttons\\WHITE8X8",
            edgeSize = 1,
            insets = { left = 1, right = 1, top = 1, bottom = 1 }
        })
        infoCard:SetBackdropColor(0.04, 0.05, 0.08, 0.8)
        infoCard:SetBackdropBorderColor(0.2, 0.35, 0.5, 0.5)
    end
    local infoText = infoCard:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
    infoText:SetPoint("CENTER", infoCard, "CENTER", 0, 0)
    infoText:SetText("|cff00e5ffComandos rápidos:|r |cffffd100/wc voice|r (silencia voz) | |cffffd100/wc bar|r | |cffffd100/wc status|r")

    -- Close Button
    local okBtn = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
    okBtn:SetSize(130, 26)
    okBtn:SetPoint("BOTTOM", f, "BOTTOM", 0, 14)
    okBtn:SetText("Fechar")
    okBtn:SetScript("OnClick", function() f:Hide() end)

    table.insert(UISpecialFrames, "WoWCompanionSettingsFrame")

    settingsFrame = f
    settingsFrame:Show()
end

-- Registration in Blizzard AddOn Options
local optionsCategoryPanel = CreateFrame("Frame", "WoWCompanionOptionsPanel", UIParent)
optionsCategoryPanel.name = "WoW Companion"

local optTitle = optionsCategoryPanel:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
optTitle:SetPoint("TOPLEFT", 16, -16)
optTitle:SetText("|cff00e5ffWoW Companion|r — Definições")

local optDesc = optionsCategoryPanel:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
optDesc:SetPoint("TOPLEFT", optTitle, "BOTTOMLEFT", 0, -12)
optDesc:SetText("Controla os alertas sonoros, a voz repetitiva e a barra de telemetria:")

local openBtn = CreateFrame("Button", nil, optionsCategoryPanel, "UIPanelButtonTemplate")
openBtn:SetSize(220, 30)
openBtn:SetPoint("TOPLEFT", optDesc, "BOTTOMLEFT", 0, -16)
openBtn:SetText("Abrir Janela de Definições")
openBtn:SetScript("OnClick", function()
    if SettingsPanel and SettingsPanel:IsShown() then
        HideUIPanel(SettingsPanel)
    end
    CreateOrShowSettingsFrame()
end)

pcall(function()
    if Settings and Settings.RegisterCanvasLayoutCategory then
        local category = Settings.RegisterCanvasLayoutCategory(optionsCategoryPanel, "WoW Companion")
        Settings.RegisterAddOnCategory(category)
    elseif InterfaceOptions_AddCategory then
        InterfaceOptions_AddCategory(optionsCategoryPanel)
    end
end)

-- Slash Commands
SLASH_WOWCOMPANION1 = "/wc"
SLASH_WOWCOMPANION2 = "/wowcompanion"
SlashCmdList["WOWCOMPANION"] = function(msg)
    local raw = (strtrim and strtrim(msg or "")) or (string.trim and string.trim(msg or "")) or (msg or "")
    local cmd, arg = raw:match("^(%S+)%s*(.*)$")
    cmd = cmd and string.lower(cmd) or ""

    if cmd == "" or cmd == "config" or cmd == "settings" or cmd == "opcoes" or cmd == "menu" then
        CreateOrShowSettingsFrame()
    elseif cmd == "voice" or cmd == "voz" or cmd == "mute" then
        WoWCompanionDB.settings.voiceAlerts = not WoWCompanionDB.settings.voiceAlerts
        ExportFullData()
        if WoWCompanionDB.settings.voiceAlerts then
            print("|cff00e5ff[WoW Companion]|r 🔊 Alertas de voz: |cff00ff00ATIVADOS|r.")
        else
            print("|cff00e5ff[WoW Companion]|r 🔇 Alertas de voz: |cffff2020DESATIVADOS|r (Voz silenciada no iPad/Web).")
        end
    elseif cmd == "sound" or cmd == "som" then
        WoWCompanionDB.settings.soundAlerts = not WoWCompanionDB.settings.soundAlerts
        ExportFullData()
        print("|cff00e5ff[WoW Companion]|r Sons táteis: " .. (WoWCompanionDB.settings.soundAlerts and "|cff00ff00ATIVADOS|r" or "|cffff2020DESATIVADOS|r"))
    elseif cmd == "bar" or cmd == "toggle" then
        if frame:IsShown() then
            frame:Hide()
            WoWCompanionDB.settings.showBar = false
            print("|cff00e5ff[WoW Companion]|r Barra de telemetria ocultada.")
        else
            frame:Show()
            WoWCompanionDB.settings.showBar = true
            print("|cff00e5ff[WoW Companion]|r Barra de telemetria visível.")
        end
        ExportFullData()
    elseif cmd == "track" then
        local qid = tonumber(arg)
        if qid and qid > 0 then
            if C_SuperTrack and C_SuperTrack.SetSuperTrackedQuestID then
                C_SuperTrack.SetSuperTrackedQuestID(qid)
                local title = (C_QuestLog and C_QuestLog.GetTitleForQuestID and C_QuestLog.GetTitleForQuestID(qid)) or ("Quest #" .. qid)
                print("|cff00e5ff[WoW Companion]|r 🎯 A seguir missão no mapa: |cffffd100" .. title .. "|r")
                if UIErrorsFrame and UIErrorsFrame.AddMessage then
                    UIErrorsFrame:AddMessage("🎯 A seguir: " .. title, 0.2, 0.9, 1.0)
                end
            end
        end
    elseif cmd == "pull" then
        local sec = tonumber(arg) or 10
        if C_PartyInfo and C_PartyInfo.DoCountdown then
            C_PartyInfo.DoCountdown(sec)
        elseif DoCountdown then
            DoCountdown(sec)
        end
        print("|cff00e5ff[WoW Companion]|r ⏱️ Pull de " .. sec .. " segundos iniciado!")
    elseif cmd == "rc" or cmd == "readycheck" then
        if DoReadyCheck then
            DoReadyCheck()
            print("|cff00e5ff[WoW Companion]|r ✔️ Ready Check iniciado!")
        end
    elseif cmd == "mark" then
        local mid = tonumber(arg) or 0
        if SetRaidTarget and UnitExists("target") then
            SetRaidTarget("target", mid)
            print("|cff00e5ff[WoW Companion]|r 🎯 Alvo marcado com ícone " .. mid)
        end
    elseif cmd == "clear" or cmd == "clearmarks" then
        if SetRaidTarget and UnitExists("target") then
            SetRaidTarget("target", 0)
            print("|cff00e5ff[WoW Companion]|r 🧹 Marcação de alvo limpa.")
        end
    elseif cmd == "save" or cmd == "export" then
        local data = ExportFullData()
        print("|cff00e5ff[WoW Companion]|r Dados guardados! (" .. #data.quests .. " missões, " .. #data.bags.items .. " itens).")
    elseif cmd == "status" then
        print("|cff00e5ff[WoW Companion v2.3]|r Estado:")
        local vStatus = (WoWCompanionDB.settings and WoWCompanionDB.settings.voiceAlerts) and "|cff00ff00ATIVADA|r" or "|cffff2020SILENCIADA|r"
        local sStatus = (WoWCompanionDB.settings and WoWCompanionDB.settings.soundAlerts ~= false) and "|cff00ff00ATIVADOS|r" or "|cffff2020DESATIVADOS|r"
        print(" - Voz Sintetizada: " .. vStatus)
        print(" - Sons Táteis: " .. sStatus)
        print(" - Barra de Telemetria: " .. (frame:IsShown() and "|cff00ff00SIM (17 células)|r" or "|cffff0000NÃO|r"))
        local mapID = C_Map and C_Map.GetBestMapForUnit and C_Map.GetBestMapForUnit("player") or 0
        print(" - MapID Atual: " .. mapID .. " (" .. (GetZoneText() or "Desconhecido") .. ")")
        local pos = mapID > 0 and C_Map and C_Map.GetPlayerMapPosition(mapID, "player")
        if pos then
            print(string.format(" - Coordenadas: (%.2f, %.2f)", pos.x * 100, pos.y * 100))
        end
        print(" - Em Combate: " .. (inCombatState and "|cffff0000SIM|r" or "|cff00ff00NÃO|r"))
        print(" - Comandos: |cffffd100/wc|r (abre definições), |cffffd100/wc voice|r, |cffffd100/wc pull <seg>|r, |cffffd100/wc rc|r")
    else
        print("|cff00e5ff[WoW Companion]|r Comandos disponíveis:")
        print(" - |cffffd100/wc|r : Abre a janela de definições do Companion.")
        print(" - |cffffd100/wc voice|r (ou |cffffd100/wc voz|r) : Silencia ou ativa os alertas de voz.")
        print(" - |cffffd100/wc bar|r : Oculta ou mostra a barra de 17 células.")
        print(" - |cffffd100/wc status|r : Mostra o estado da ligação e definições.")
        print(" - |cffffd100/wc pull <seg>|r, |cffffd100/wc rc|r, |cffffd100/wc mark <1-8>|r, |cffffd100/wc clear|r")
    end
end
