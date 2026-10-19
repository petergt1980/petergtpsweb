-- ============================================================================
-- SCRIPT AUTO WORLD KHUSUS ROLE PTHT
-- Script By: @PeterGTPS
-- Tampilan: Aesthetic Dashboard UI + Cooldown 1 Detik + Wajib Remote Magplant
-- ============================================================================
-- CATATAN SISTEM ROLE (PENTING):
--   * ID role PTHT = 101 (dibuat lewat role editor in-game /managerole).
--   * Akses /auto diberikan lewat 2 jalur:
--       1) Role PTHT (id 101) kalau rolenya sudah dibuat di role editor, ATAU
--       2) Daftar PTHT yang disimpan script (permanen), dikelola Founder.
--     Jadi fitur tetap jalan walau role 101 belum dibuat.
--   * HANYA pemegang akses PTHT yang bisa /auto. VIP/staff/owner/founder
--     TIDAK bisa, kecuali mereka memang diberi akses.
--   * HANYA Founder yang bisa memberi / mencabut akses: /giveptht & /unptht.
--   * Role editor in-game dikunci founder-only (setRoleEditorRole(-1)),
--     jadi role lain tidak bisa akses /giverole / editor role.
-- ============================================================================

-- ID role PTHT (kalau dibuat di role editor in-game)
local PTHT_ROLE_ID = 101

-- Role Founder
local FOUNDER_ROLE = 1000

-- Mencegah player menjalankan 2 aksi bersamaan
local activeTasks = {}

-- ============================================================================
-- PENGATURAN PERFORMA (biar tidak lag / crash)
-- ============================================================================
-- Jumlah tile yang diolah per giliran. Makin kecil makin aman (tidak nge-lag),
-- tapi makin banyak giliran. 100 sudah aman untuk server biasa.
local BATCH_SIZE = 100
-- Laporkan progres ke console tiap berapa tile (biar chat tidak kebanjiran).
local REPORT_EVERY = 500

-- Kunci role editor ke founder-only (-1 = founder only).
pcall(function() setRoleEditorRole(-1) end)

-- ============================================================================
-- CEK APAKAH ROLE PTHT (id 101) SUDAH ADA DI SERVER
-- ============================================================================
local PTHT_ROLE_EXISTS = false

local function checkPTHTRole()
    local okRoles, roles = pcall(getServerRoles)
    if okRoles and type(roles) == "table" then
        for _, r in ipairs(roles) do
            if type(r) == "table" and r.id == PTHT_ROLE_ID then
                PTHT_ROLE_EXISTS = true
                print("[Lua] Auto PTHT: role PTHT ditemukan (id=" .. PTHT_ROLE_ID ..
                      ", nama=" .. tostring(r.name) .. ").")
                return
            end
        end
    end
    print("[Lua] Auto PTHT: role PTHT (id " .. PTHT_ROLE_ID ..
          ") belum ada di role editor. Sementara pakai daftar /giveptht (Founder).")
end

checkPTHTRole()

-- ============================================================================
-- DAFTAR PTHT TERSIMPAN (permanen, dikelola Founder)
-- Format: pthtList["userID"] = "namaPlayer"
-- ============================================================================
local pthtList = {}

local function loadPTHTList()
    local ok, data = pcall(loadDataFromServer, "ptht_whitelist")
    if ok and type(data) == "table" then
        pthtList = {}
        for k, v in pairs(data) do
            pthtList[tostring(k)] = v
        end
    end
end

local function savePTHTList()
    pcall(saveDataToServer, "ptht_whitelist", pthtList)
end

loadPTHTList()

-- Bersihkan antrean jika player disconnect agar task tidak terkunci
if type(onPlayerDisconnectCallback) == "function" then
    pcall(function()
        onPlayerDisconnectCallback(function(player)
            if player and player:getUserID() then
                activeTasks[player:getUserID()] = nil
            end
        end)
    end)
end

-- ============================================================================
-- VALIDASI ROLE & WORLD
-- ============================================================================
local function isFounder(player)
    if not player then return false end
    local okRole, role = pcall(function() return player:getRole() end)
    return okRole and type(role) == "number" and role >= FOUNDER_ROLE
end

local function isPlayerPTHT(player)
    if not player then return false end

    -- 1) Ada di daftar PTHT (script-managed, permanen)
    local uid = tostring(player:getUserID())
    if pthtList[uid] then return true end

    -- 2) Punya role PTHT (id 101) -- exact match, bukan threshold.
    --    Ini supaya VIP/staff/owner yang levelnya lebih tinggi tetap DITOLAK.
    if PTHT_ROLE_EXISTS then
        local okRole, role = pcall(function() return player:getRole() end)
        if okRole and type(role) == "number" and role == PTHT_ROLE_ID then
            return true
        end
    end

    return false
end

local function hasWorldPermission(world, player)
    if not player then return false end

    local curWorld = world or player:getWorld()
    if not curWorld then return false end

    local okAccess, access = pcall(function() return curWorld:hasAccess(player) end)
    return okAccess and access == true
end

-- ============================================================================
-- DATABASE ID SEMUA PLATFORM DI GROWTOPIA
-- ============================================================================
local KNOWN_PLATFORM_IDS = {
    [102]   = true, -- Wooden Platform
    [382]   = true, -- Cloud Platform / Cloud
    [658]   = true, -- Lattice
    [660]   = true, -- Bridge
    [1204]  = true, -- Fire Escape
    [1478]  = true, -- Rainbow Platform
    [1530]  = true, -- Metal Platform
    [1598]  = true, -- Golden Platform
    [1948]  = true, -- Carnival Platform
    [2450]  = true, -- Suspension Bridge
    [2608]  = true, -- Cyber Platform
    [3110]  = true, -- Pink Cloud Platform
    [3122]  = true, -- Candy Cane Platform
    [3388]  = true, -- Mushroom Platform
    [3794]  = true, -- Rock Platform
    [4402]  = true, -- Bone Platform
    [4474]  = true, -- Pastel Platform
    [5220]  = true, -- Rayman - Bond Land Platform
    [5222]  = true, -- Rayman Platform Varian
    [5882]  = true, -- Glass Platform
    [6366]  = true, -- Steel Platform
    [7226]  = true, -- Haunted Platform
    [7586]  = true, -- Steampunk Platform
    [7868]  = true, -- Space Platform
    [8530]  = true, -- Candy Platform
    [8878]  = true, -- Cave Platform
    [9556]  = true, -- Snowy Rocks Platform
    [10086] = true, -- Bountiful Bamboo Platform
    [11090] = true, -- Hover Platform
    [11228] = true, -- Cloud Platform V2
    [11230] = true, -- Pink Cloud Platform V2
    [12534] = true, -- U.S.S. Protostar Platform
}

-- ============================================================================
-- FUNGSI DETEKSI SEMUA PLATFORM TANPA TERKECUALI
-- ============================================================================
local function isPlatformTile(tile)
    if not tile then return false end
    local fg = tile:getTileForeground()
    if not fg or fg == 0 then return false end

    -- LAPIS 1: Cek Daftar Database ID Eksplisit
    if KNOWN_PLATFORM_IDS[fg] then
        return true
    end

    local it = getItem(fg)
    if it then
        -- LAPIS 2: Cek ActionType Engine Growtopia (ActionType 23 = ITEMTYPE_PLATFORM)
        if it.getActionType and it:getActionType() == 23 then
            return true
        end

        -- LAPIS 3: Cek Nama Item (String Match Bersih)
        local rawName = it:getName() or ""
        local cleanName = rawName:gsub("`.", ""):lower()

        if cleanName:find("platform") or
           cleanName:find("lattice") or
           cleanName:find("bridge") or
           cleanName:find("scaffold") then
            return true
        end
    end

    return false
end

-- ============================================================================
-- FUNGSI SORTING: KIRI ATAS (X=0, Y=0) KE KANAN BAWAH (X=99, Y=59)
-- ============================================================================
local function sortTopLeftToBottom(tiles)
    table.sort(tiles, function(a, b)
        local yA, yB = a:getPosY(), b:getPosY()
        if yA == yB then
            return a:getPosX() < b:getPosX()
        end
        return yA < yB
    end)
end

-- ============================================================================
-- DAFTAR OUTPUT PROVIDER (AMAN TANPA MERUSAK BLOK)
-- ============================================================================
local function getProviderPayout(fg)
    -- 1. Provider Tackle Box (3478) -> Umpan Pancing (Fishing Bait)
    if fg == 3478 then
        local baits = { 3480, 3482, 3484, 3486, 3488 }
        return baits[math.random(1, #baits)], math.random(1, 2), "item"
    end

    -- 2. Science Station (5666) & Geothermal (3004) -> Lab Items
    if fg == 5666 or fg == 3004 then
        local items = { 870, 872, 874, 876, 878 }
        return items[math.random(1, #items)], 1, "item"
    end

    -- 3. ATM Machine (1440) -> Gems
    if fg == 1440 then
        return nil, math.random(20, 100), "gems"
    end

    -- 4. Hewan Ternak
    if fg == 6030 then return 6036, 1, "item" end -- Chicken -> Egg
    if fg == 6032 then return 6038, 1, "item" end -- Cow -> Milk
    if fg == 6034 then return 6040, 1, "item" end -- Sheep -> Wool
    if fg == 6036 then return 6042, 1, "item" end -- Pig -> Bacon

    -- 5. Mesin & Generator
    if fg == 3400 then return 3402, 1, "item" end -- Solar Panel -> Battery
    if fg == 4582 then return 4584, 1, "item" end -- Coffee Maker -> Coffee
    if fg == 4586 then return 4588, 1, "item" end -- Teapot -> Tea
    if fg == 2836 then return 2838, 1, "item" end -- Recombobulator -> DNA
    if fg == 2936 then return 2938, 1, "item" end -- Silkworm -> Silk

    local it = getItem(fg)
    if it and it:getName():lower():find("tackle") then
        local baits = { 3480, 3482, 3484, 3486, 3488 }
        return baits[math.random(1, #baits)], 1, "item"
    end

    local nextItem = getItem(fg + 1)
    if nextItem and nextItem:getName() ~= "" then
        return fg + 1, 1, "item"
    end

    return nil, 50, "gems"
end

-- ============================================================================
-- DETEKSI MAGPLANT REMOTE (WAJIB MEMEGANG REMOTE, TIDAK BISA SEED BIASA)
-- ============================================================================
local function getMagplantRemote(world, player)
    local hasRemote = false

    for _, inv in ipairs(player:getInventoryItems()) do
        local id = inv:getItemID()
        local it = getItem(id)
        if it then
            local name = it:getName():lower()
            if id == 5640 or (name:find("magplant") and name:find("remote")) then
                hasRemote = true
                break
            end
        end
    end

    if not hasRemote then
        return nil
    end

    local curWorld = world or (player and player:getWorld())
    if not curWorld then return nil end

    local magStock = curWorld:getMagplantStock(player) or 0
    local magSeed = curWorld:getMagplantSeed(player) or 0
    local seedItem = getItem(magSeed)
    local seedName = seedItem and seedItem:getName() or "Unknown Seed"

    return {
        stock = magStock,
        seedID = magSeed,
        seedName = seedName
    }
end

-- ============================================================================
-- SISTEM ANTREAN BATCH (COOLDOWN 1s / 100 TILE DARI KIRI ATAS KE BAWAH)
-- ============================================================================
local function executeBatchQueue(world, player, tiles, actionName, actionCallback, onComplete)
    local userID = player:getUserID()

    if activeTasks[userID] then
        player:onConsoleMessage("`4[PTHT Auto] `oAksi lain masih berjalan! Harap tunggu hingga selesai.")
        return
    end

    if #tiles == 0 then
        player:onConsoleMessage("`6[PTHT Auto] `oTidak ada tile yang siap untuk di-" .. actionName .. "!")
        return
    end

    sortTopLeftToBottom(tiles)

    activeTasks[userID] = true
    local totalTiles = #tiles
    local currentIndex = 1
    local totalSuccess = 0
    local nextReport = REPORT_EVERY

    local startTile = tiles[1]
    player:onConsoleMessage("`2[PTHT Auto] `oMemulai `w" .. actionName .. " `o(`e" .. totalTiles .. " `otile).")
    player:onConsoleMessage("`2[PTHT Auto] `oMulai dari Kiri Atas `w(" .. startTile:getPosX() .. "," .. startTile:getPosY() .. ") `osampai akhir tile.")

    local function processNextBatch()
        if not player or not player:isOnline() then
            activeTasks[userID] = nil
            return
        end

        local batchCount = 0

        while currentIndex <= totalTiles and batchCount < BATCH_SIZE do
            local tile = tiles[currentIndex]
            local okCall, status = pcall(actionCallback, tile, currentIndex)

            if not okCall then
                player:onConsoleMessage("`4[PTHT Error] `oKendala pada tile (" .. tile:getPosX() .. "," .. tile:getPosY() .. ")!")
                activeTasks[userID] = nil
                if onComplete then onComplete(totalSuccess, true) end
                return
            end

            if status == "STOP_INACTIVE" then
                player:onConsoleMessage("`4[PTHT Peringatan] `oMagplant kamu `4BELUM AKTIF`o! Penanaman dibatalkan.")
                pcall(function() player:playAudio("audio/cant.wav") end)
                activeTasks[userID] = nil
                if onComplete then onComplete(totalSuccess, true) end
                return
            end

            if status == "STOP_STOCK" then
                player:onConsoleMessage("`4[PTHT Peringatan] `oStok seed di Magplant telah HABIS!")
                pcall(function() player:playAudio("audio/cant.wav") end)
                activeTasks[userID] = nil
                if onComplete then onComplete(totalSuccess, true) end
                return
            end

            if status == true then
                totalSuccess = totalSuccess + 1
            end

            batchCount = batchCount + 1
            currentIndex = currentIndex + 1
        end

        -- Laporan progres berkala saja (biar chat tidak spam)
        if (currentIndex - 1) >= nextReport or currentIndex > totalTiles then
            player:onConsoleMessage("`2[PTHT Auto] `oProgress: `w" .. math.min(currentIndex - 1, totalTiles) .. "/" .. totalTiles .. " `otile (" .. totalSuccess .. " berhasil).")
            nextReport = nextReport + REPORT_EVERY
        end

        -- Lanjut di tick berikutnya (yield ke server => tidak nge-lag / crash)
        if currentIndex <= totalTiles then
            timer.setTimeout(0, function()
                processNextBatch()
            end)
        else
            activeTasks[userID] = nil
            pcall(function() player:playAudio("audio/success.wav") end)
            player:onConsoleMessage("`2[PTHT Auto] `eSELESAI! `wTotal `e" .. totalSuccess .. " `otile berhasil di-" .. actionName .. "!")
            if onComplete then onComplete(totalSuccess, false) end
        end
    end

    processNextBatch()
end

-- ============================================================================
-- 1. AUTO PLANT (KHUSUS REMOTE MAGPLANT DI ATAS PLATFORM)
-- ============================================================================
local function doAutoPlant(world, player)
    local curWorld = world or (player and player:getWorld())
    if not curWorld then return end

    local magplant = getMagplantRemote(curWorld, player)

    if not magplant then
        player:onConsoleMessage("`4[Akses Ditolak] `oKamu `4TIDAK MEMEGANG REMOTE MAGPLANT`o! Auto Plant hanya bisa menggunakan seed dari Remote Magplant.")
        pcall(function() player:playAudio("audio/cant.wav") end)
        return
    end

    if magplant.seedID <= 0 then
        player:onConsoleMessage("`4[PTHT Peringatan] `oRemote Magplant kamu belum di-link ke Magplant yang memiliki seed!")
        pcall(function() player:playAudio("audio/cant.wav") end)
        return
    end

    local currentStock = curWorld:getMagplantStock(player) or 0
    if currentStock <= 0 then
        player:onConsoleMessage("`4[PTHT Peringatan] `oStok seed di Magplant kamu KOSONG (0 Seed)! Harap isi Magplant terlebih dahulu.")
        pcall(function() player:playAudio("audio/cant.wav") end)
        return
    end

    local platformEmptyTiles = {}
    for _, tile in ipairs(curWorld:getTiles()) do
        if tile:getTileForeground() == 0 then
            local tileBelow = curWorld:getTile(tile:getPosX(), tile:getPosY() + 1)
            if isPlatformTile(tileBelow) then
                table.insert(platformEmptyTiles, tile)
            end
        end
    end

    local totalPlatformEmpty = #platformEmptyTiles
    if totalPlatformEmpty == 0 then
        player:onConsoleMessage("`6[PTHT Auto] `oTidak ada tile kosong di atas `wPLATFORM `oyang siap ditanami!")
        return
    end

    sortTopLeftToBottom(platformEmptyTiles)

    local willPlantCount = math.min(totalPlatformEmpty, currentStock)
    local plantTiles = {}
    for i = 1, willPlantCount do
        table.insert(plantTiles, platformEmptyTiles[i])
    end

    if willPlantCount < totalPlatformEmpty then
        player:onConsoleMessage("`6[PTHT Peringatan] `oStok Magplant hanya `w" .. currentStock .. " `oseed. Menanam `w" .. willPlantCount .. " `otile platform saja!")
    else
        player:onConsoleMessage("`2[PTHT Auto] `oStok Magplant cukup! Menanam `w" .. willPlantCount .. " `otile `w" .. magplant.seedName .. "`o.")
    end

    executeBatchQueue(curWorld, player, plantTiles, "Plant Platform", function(tile, index)
        if curWorld:getMagplantStock(player) <= 0 then
            return "STOP_STOCK"
        end

        local success = curWorld:plantFromMagplant(player, tile)
        if not success then
            return "STOP_INACTIVE"
        end
        return true
    end, function(totalSuccess, stoppedEarly)
        local remainingStock = curWorld:getMagplantStock(player) or 0
        if remainingStock <= 0 or stoppedEarly or willPlantCount < totalPlatformEmpty then
            player:onConsoleMessage("`4[PTHT Peringatan] `eStok seed di Magplant sekarang telah HABIS (0 Seed)! Silakan isi ulang.")
            pcall(function() player:playAudio("audio/cant.wav") end)
        else
            player:onConsoleMessage("`2[PTHT Info] `oSisa seed di Magplant: `e" .. remainingStock .. " `oseed.")
        end
    end)
end

-- ============================================================================
-- 2. AUTO HARVEST POHON
-- ============================================================================
local function doAutoHarvest(world, player)
    local curWorld = world or (player and player:getWorld())
    if not curWorld then return end

    local harvestTiles = {}

    for _, tile in ipairs(curWorld:getTiles()) do
        local fg = tile:getTileForeground()
        if fg ~= 0 then
            local fruit = tile:getTileData(0)
            local started = tile:getTileData(1)

            if fruit ~= nil then
                local isReady = false
                if fruit > 0 then
                    isReady = true
                elseif started then
                    local it = getItem(fg)
                    local growTime = it and it:getGrowTime() or 0
                    if (started == 1) or (growTime > 0 and (started + growTime) <= os.time()) then
                        isReady = true
                    end
                end

                if isReady then
                    table.insert(harvestTiles, tile)
                end
            end
        end
    end

    sortTopLeftToBottom(harvestTiles)

    executeBatchQueue(curWorld, player, harvestTiles, "Harvest Pohon", function(tile)
        curWorld:punchTile(tile, player)
        return true
    end)
end

-- ============================================================================
-- 3. HARVEST PROVIDER (AMAN TANPA MERUSAK BLOK)
-- ============================================================================
local function doHarvestProvider(world, player)
    local curWorld = world or (player and player:getWorld())
    if not curWorld then return end

    local providerTiles = {}

    for _, tile in ipairs(curWorld:getTiles()) do
        local fg = tile:getTileForeground()
        if fg ~= 0 then
            local fruit = tile:getTileData(0)
            local started = tile:getTileData(1)

            if started ~= nil and fruit == nil then
                local it = getItem(fg)
                local growTime = it and it:getGrowTime() or 0
                local isReady = false

                if started == 1 or (growTime > 0 and os.time() >= (started + growTime)) or (growTime == 0 and os.time() >= started) then
                    isReady = true
                end

                if isReady then
                    table.insert(providerTiles, tile)
                end
            end
        end
    end

    sortTopLeftToBottom(providerTiles)

    executeBatchQueue(curWorld, player, providerTiles, "Harvest Provider", function(tile)
        local fg = tile:getTileForeground()
        local rewardID, rewardCount, rewardType = getProviderPayout(fg)

        if rewardType == "gems" then
            player:addGems(rewardCount)
        elseif rewardID then
            if not player:giveItem(rewardID, rewardCount) then
                curWorld:spawnItem(tile:getPosX(), tile:getPosY(), rewardID, rewardCount)
            end
        end

        curWorld:playEffect(100, tile:getPosX(), tile:getPosY(), 242)

        -- Reset siklus waktu provider (blok tetap aman di world)
        tile:setTileData(1, os.time())
        curWorld:updateTile(tile)
        if curWorld.updateTileFor then
            curWorld:updateTileFor(player, tile)
        end

        return true
    end)
end

-- ============================================================================
-- 4. ALL GROWN SPRAY (INSTAN TANPA WAKTU TUNGGU)
-- ============================================================================
local function doFullGrownBoost(world, player)
    local curWorld = world or (player and player:getWorld())
    if not curWorld then return end

    local userID = player:getUserID()
    if activeTasks[userID] then
        player:onConsoleMessage("`4[PTHT Auto] `oAksi lain masih berjalan! Harap tunggu hingga selesai.")
        return
    end

    -- 1) Scan sekali saja, kumpulkan tile yang perlu di-boost
    local targets = {}
    for _, tile in ipairs(curWorld:getTiles()) do
        local fg = tile:getTileForeground()
        if fg ~= 0 then
            local fruit = tile:getTileData(0)
            local started = tile:getTileData(1)

            -- POHON
            if fruit ~= nil then
                local id = tile:getTileID()
                local it = getItem(id)
                local growTime = 0

                if it and it:getGrowTime() > 0 then
                    growTime = it:getGrowTime()
                else
                    local itPrev = getItem(id - 1)
                    if itPrev and itPrev:getGrowTime() > 0 then
                        growTime = itPrev:getGrowTime()
                    else
                        local itNext = getItem(id + 1)
                        if itNext and itNext:getGrowTime() > 0 then
                            growTime = itNext:getGrowTime()
                        end
                    end
                end

                if growTime <= 0 then growTime = 3600 end
                targets[#targets + 1] = { tile = tile, kind = "tree", growTime = growTime }

            -- HARVESTER / PROVIDER / TACKLE BOX
            elseif started ~= nil and fruit == nil then
                local it = getItem(fg)
                local growTime = (it and it:getGrowTime() > 0) and it:getGrowTime() or 43200
                targets[#targets + 1] = { tile = tile, kind = "provider", growTime = growTime }
            end
        end
    end

    if #targets == 0 then
        player:onConsoleMessage("`6[PTHT Auto] `oTidak ada pohon/provider yang bisa di-All Grown.")
        return
    end

    -- 2) Proses bertahap per giliran supaya tidak nge-lag / crash
    activeTasks[userID] = true
    local total = #targets
    local index = 1
    local boostedTrees = 0
    local boostedProviders = 0

    player:onConsoleMessage("`2[PTHT Auto] `oMemproses All Grown untuk `e" .. total .. " `otile...")

    local function processBatch()
        if not player or not player:isOnline() then
            activeTasks[userID] = nil
            return
        end

        local count = 0
        while index <= total and count < BATCH_SIZE do
            local t = targets[index]
            local tile = t.tile

            if t.kind == "tree" then
                tile:setTileData(0, 4)
                tile:setTileData(1, os.time() - t.growTime - 10)
                boostedTrees = boostedTrees + 1
            else
                tile:setTileData(1, os.time() - t.growTime - 10)
                boostedProviders = boostedProviders + 1
            end

            curWorld:updateTile(tile)
            if curWorld.updateTileFor then
                curWorld:updateTileFor(player, tile)
            end

            if t.kind == "tree" and boostedTrees % 4 == 0 then
                curWorld:playEffect(100, tile:getPosX(), tile:getPosY(), 242)
            end

            index = index + 1
            count = count + 1
        end

        -- Lanjut di tick berikutnya (yield ke server => tidak nge-lag / crash)
        if index <= total then
            timer.setTimeout(0, processBatch)
        else
            activeTasks[userID] = nil
            player:onTextOverlay("`2ALL TREES GROWN!``")
            curWorld:playVisualEffect(100, player:getNetID(), 0, 0)
            pcall(function() player:playAudio("audio/spray.wav") end)

            player:onConsoleMessage("`2[PTHT Auto] `eSUKSES MENUMBUHKAN ALL GROWN!``")
            player:onConsoleMessage("`2-> `w" .. boostedTrees .. " `opohon telah mekar menjadi `2FULL GROWN BESAR `otanpa waktu tunggu!")
            player:onConsoleMessage("`2-> `w" .. boostedProviders .. " `oprovider & tackle box siap dipanen!")
        end
    end

    processBatch()
end

-- ============================================================================
-- 5. TAMPILAN DIALOG /auto ESTETIS (Script By: @PeterGTPS)
-- ============================================================================
local function openAutoDialog(world, player)
    local curWorld = world or (player and player:getWorld())
    local magplant = getMagplantRemote(curWorld, player)
    local magplantStatus = "`4[X] Tidak Memegang Remote``"
    local seedDetail = "`7Hubungkan remote untuk menanam``"

    if magplant then
        if magplant.stock > 0 then
            magplantStatus = "`2[AKTIF] `wTerhubung ke Magplant``"
            seedDetail = "`w" .. magplant.seedName .. " `o(`e" .. magplant.stock .. " Seed`o)``"
        else
            magplantStatus = "`4[KOSONG] `wStok Magplant 0 Seed``"
            seedDetail = "`w" .. magplant.seedName .. " `4(0 Seed)``"
        end
    end

    local cleanName = player.getCleanName and player:getCleanName() or player:getName():gsub("`.", "")

    local dialog = "add_label|big|`2PTHT `wCONTROL DASHBOARD``|left|\n" ..
                   "add_spacer|small|\n" ..
                   "add_textbox|`8==================================================``|left|\n" ..
                   "add_textbox|`oPlayer : `w" .. cleanName .. " `8| `oRole: `ePTHT `2[Aktif]``|left|\n" ..
                   "add_textbox|`oRemote : " .. magplantStatus .. "|left|\n" ..
                   "add_textbox|`oSeed   : " .. seedDetail .. "|left|\n" ..
                   "add_textbox|`8==================================================``|left|\n" ..
                   "add_spacer|small|\n" ..
                   "add_textbox|`wPILIH OPERASI OTOMATIS:``|left|\n" ..
                   "add_button|btn_plant|AUTO PLANT|noflags|0|0|\n" ..
                   "add_button|btn_harvest|AUTO HARVEST POHON|noflags|0|0|\n" ..
                   "add_button|btn_provider|HARVEST PROVIDER|noflags|0|0|\n" ..
                   "add_button|btn_spray|ALL GROWN SPRAY|noflags|0|0|\n" ..
                   "add_spacer|small|\n" ..
                   "add_textbox|`8==================================================``|left|\n" ..
                   "add_textbox|`2Script By: `w@PeterGTPS``|left|\n" ..
                   "add_spacer|small|\n" ..
                   "add_quick_exit|\n" ..
                   "end_dialog|dlg_ptht_auto|Tutup Panel||\n"

    player:onDialogRequest(dialog)
end

-- Handler Tombol Dialog
onPlayerDialogCallback(function(world, player, data)
    if not data or not data.dialog_name then return false end

    if data.dialog_name == "dlg_ptht_auto" then
        local curWorld = world or (player and player:getWorld())

        if not isPlayerPTHT(player) then
            player:onConsoleMessage("`4[Akses Ditolak] `oKamu bukan pemegang akses PTHT!")
            return true
        end

        if not hasWorldPermission(curWorld, player) then
            player:onConsoleMessage("`4[PTHT Auto] `oKamu tidak memiliki akses lock di world ini!")
            return true
        end

        if data.buttonClicked == "btn_plant" then
            doAutoPlant(curWorld, player)
            return true

        elseif data.buttonClicked == "btn_harvest" then
            doAutoHarvest(curWorld, player)
            return true

        elseif data.buttonClicked == "btn_provider" then
            doHarvestProvider(curWorld, player)
            return true

        elseif data.buttonClicked == "btn_spray" then
            doFullGrownBoost(curWorld, player)
            openAutoDialog(curWorld, player)
            return true
        end
    end
    return false
end)

-- ============================================================================
-- 6. PENDAFTARAN COMMAND
-- ============================================================================
-- /auto : kalau role PTHT (101) sudah ada -> digerbang exactRole ke 101.
--         kalau belum ada -> didaftarkan (roleRequired 0) tapi tetap diblok
--         oleh isPlayerPTHT, sehingga hanya daftar PTHT yang bisa masuk.
-- /giveptht & /unptht : khusus Founder.
if type(registerLuaCommand) == "function" then
    pcall(function()
        registerLuaCommand{
            command = "auto",
            roleRequired = PTHT_ROLE_EXISTS and PTHT_ROLE_ID or 0,
            exactRole = PTHT_ROLE_EXISTS and true or false,
            description = "Buka Dashboard Auto PTHT (khusus akses PTHT)"
        }
    end)

    pcall(function()
        registerLuaCommand{
            command = "giveptht",
            roleRequired = FOUNDER_ROLE,
            exactRole = true,
            description = "Beri akses PTHT ke player (Founder only)"
        }
    end)

    pcall(function()
        registerLuaCommand{
            command = "unptht",
            roleRequired = FOUNDER_ROLE,
            exactRole = true,
            description = "Cabut akses PTHT dari player (Founder only)"
        }
    end)
end

onPlayerCommandCallback(function(world, player, fullCommand)
    if not fullCommand then return false end

    -- Engine bisa mengirim command dengan atau tanpa garis miring di depan
    local cmd, args = fullCommand:match("^/?([%w_]+)%s*(.*)")
    if not cmd then return false end
    cmd = cmd:lower()

    -- /auto -----------------------------------------------------------------
    if cmd == "auto" then
        if not isPlayerPTHT(player) then
            player:onConsoleMessage("`4[Akses Ditolak] `oPerintah `w/auto `ohanya untuk pemain dengan akses `ePTHT`o!")
            pcall(function() player:playAudio("audio/cant.wav") end)
            return true
        end

        openAutoDialog(world or (player and player:getWorld()), player)
        return true

    -- /giveptht & /unptht (Founder only) ------------------------------------
    elseif cmd == "giveptht" or cmd == "unptht" then
        if not isFounder(player) then
            player:onConsoleMessage("`4[Akses Ditolak] `oHanya `eFounder `oyang bisa memberi/mencabut akses PTHT!")
            pcall(function() player:playAudio("audio/cant.wav") end)
            return true
        end

        local targetName = args:match("^(%S+)")
        if not targetName then
            player:onConsoleMessage("`4Gunakan: `w/" .. cmd .. " <namaPlayer>")
            return true
        end

        local target = getPlayerByName(targetName)
        if not target then
            player:onConsoleMessage("`4Player `w" .. targetName .. " `4sedang offline! Coba saat player sedang online.")
            return true
        end

        local uid = tostring(target:getUserID())
        local tname = target.getCleanName and target:getCleanName() or target:getName()

        if cmd == "giveptht" then
            pthtList[uid] = tname
            savePTHTList()
            target:onConsoleMessage("`2[PTHT] `oKamu telah diberikan akses `ePTHT`o! Ketik `w/auto`o untuk membuka panel.")
            player:onConsoleMessage("`2Akses PTHT diberikan ke `w" .. tname .. "`2.")
        else
            pthtList[uid] = nil
            savePTHTList()
            target:onConsoleMessage("`4[PTHT] `oAkses `ePTHT `okamu telah dicabut.")
            player:onConsoleMessage("`2Akses PTHT dicabut dari `w" .. tname .. "`2.")
        end
        return true
    end

    return false
end)

print("[Lua] Auto PTHT Loaded - Script By: @PeterGTPS")
