/**
 * js/saveLoad.js
 * ระบบบันทึกและโหลดเกม (Save & Load System)
 * เก็บเฉพาะชื่ออ้างอิงและ ID เพื่อความกะทัดรัด พร้อมระบบตรวจสอบและย้ายข้อมูลตามเวอร์ชัน (Save Migration)
 */

const SAVE_VERSION = 2;
const SAVE_KEY = 'chronicles_reincarnation_save';
const LEGACY_SAVE_KEY = 'rpgLifeSimSave';

function saveGame() {
    if (!player || !player.isAlive) {
        return alert("ผู้เล่นเสียชีวิตแล้ว ไม่สามารถเซฟเกมได้");
    }

    // แปลงอุปกรณ์และกระเป๋าเป็น ID เพื่อไม่ให้ข้อมูลบวม
    const equipIds = {};
    if (player.equipment) {
        for (const [slot, item] of Object.entries(player.equipment)) {
            equipIds[slot] = item ? item.id : null;
        }
    }

    const invIds = (player.inventory || []).map(item => item ? item.id : null).filter(Boolean);

    const saveData = {
        version: SAVE_VERSION,
        timestamp: Date.now(),
        player: {
            kingdomName: player.kingdom?.name,
            originName: player.originObj?.name,
            manaName: player.manaObj?.name,
            age: player.age,
            maxAge: player.maxAge,
            realm: player.realm,
            exp: player.exp,
            hp: player.hp,
            maxHp: player.maxHp,
            mp: player.mp,
            maxMp: player.maxMp,
            str: player.str,
            vit: player.vit,
            agi: player.agi,
            spr: player.spr,
            strain: player.strain,
            suspicion: player.suspicion,
            luck: player.luck,
            gold: player.gold,
            equipment: equipIds,
            inventory: invIds,
            resting: player.resting,
            eventLast: player.eventLast || {}
        }
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    addLog(`💾 บันทึกเกมสำเร็จ (Save v${SAVE_VERSION})`, "text-sky-300");
    alert("บันทึกข้อมูลการเดินทางสำเร็จ!");
}

function migrateSave(rawSave) {
    // กรณีเป็นเซฟเก่าเวอร์ชัน Ver.0 (ไม่มี version หรือเซฟทั้งก้อน)
    if (!rawSave.version || rawSave.version < 2) {
        console.warn("ตรวจพบเซฟเวอร์ชันเก่า กำลังทำการ Migrate เป็น v2...");
        const oldP = rawSave.player || {};
        return {
            version: 2,
            player: {
                kingdomName: oldP.kingdom?.name || oldP.kingdomName,
                originName: oldP.originObj?.name || oldP.originName,
                manaName: oldP.manaObj?.name || oldP.manaName,
                age: oldP.age || 0,
                maxAge: oldP.maxAge || 100,
                realm: oldP.realm || 1,
                exp: oldP.exp || 0,
                hp: oldP.hp || 100,
                maxHp: oldP.maxHp || 100,
                mp: oldP.mp || 100,
                maxMp: oldP.maxMp || 100,
                str: oldP.str || 10,
                vit: oldP.vit || 10,
                agi: oldP.agi || 10,
                spr: oldP.spr || 10,
                strain: oldP.strain || 0,
                suspicion: oldP.suspicion || 0,
                luck: oldP.luck || 50,
                gold: oldP.gold || 0,
                equipment: oldP.equipment || {},
                inventory: (oldP.inventory || []).map(i => typeof i === 'string' ? i : i.id),
                resting: false,
                eventLast: {}
            }
        };
    }
    return rawSave;
}

function loadGame() {
    let saveStr = localStorage.getItem(SAVE_KEY);
    if (!saveStr) {
        saveStr = localStorage.getItem(LEGACY_SAVE_KEY);
    }

    if (!saveStr) {
        return alert("ไม่พบข้อมูลเซฟเก่าในเบราว์เซอร์");
    }

    try {
        let rawSave = JSON.parse(saveStr);
        let saveData = migrateSave(rawSave);
        const sp = saveData.player;

        // ผูก Object อ้างอิงกลับคืนมาจาก gameData
        const kingdom = gameData.kingdoms.find(k => k.name === sp.kingdomName) || gameData.kingdoms[0];
        const origin = gameData.origins.find(o => o.name === sp.originName) || gameData.origins[0];
        const mana = gameData.manas.find(m => m.name === sp.manaName) || gameData.manas[0];

        // คืนค่าอุปกรณ์
        const equip = { weapon: null, gloves: null, armor: null, ring: null, helm: null, necklace: null, relic: null, boots: null };
        if (sp.equipment) {
            for (const [slot, itemId] of Object.entries(sp.equipment)) {
                if (itemId) {
                    equip[slot] = gameData.items.find(i => i.id === itemId) || null;
                }
            }
        }

        // คืนค่ากระเป๋า
        const inv = [];
        if (Array.isArray(sp.inventory)) {
            sp.inventory.forEach(itemId => {
                const item = gameData.items.find(i => i.id === itemId);
                if (item && inv.length < 6) inv.push(item);
            });
        }

        // ประกอบร่าง player
        player = {
            kingdom: kingdom,
            originObj: origin,
            manaObj: mana,
            age: sp.age,
            maxAge: sp.maxAge,
            realm: sp.realm,
            exp: sp.exp,
            hp: sp.hp,
            maxHp: sp.maxHp,
            mp: sp.mp,
            maxMp: sp.maxMp,
            str: sp.str,
            vit: sp.vit,
            agi: sp.agi,
            spr: sp.spr,
            strain: sp.strain || 0,
            suspicion: sp.suspicion || 0,
            luck: sp.luck,
            gold: sp.gold,
            equipment: equip,
            inventory: inv,
            isAlive: true,
            resting: sp.resting || false,
            eventLast: sp.eventLast || {}
        };

        isModalOpen = false;

        document.getElementById('start-panel')?.classList.add('hidden');
        document.getElementById('game-panel')?.classList.remove('hidden');
        document.getElementById('time-controls')?.classList.remove('hidden');
        document.getElementById('progress-wrapper')?.classList.remove('hidden');

        updateUI();
        setSpeed(0); // เมื่อโหลดเกมมา ให้หยุดเวลาไว้ก่อน เพื่อให้ผู้เล่นตรวจสอบสถานะ

        addLog(`📂 โหลดเกมสำเร็จ (Save v${saveData.version})! ยินดีต้อนรับกลับสู่วัฏจักร`, "text-sky-300");
    } catch (e) {
        console.error("Load failed:", e);
        alert("ไฟล์เซฟเสียหายหรือไม่สามารถอ่านข้อมูลได้");
    }
}
