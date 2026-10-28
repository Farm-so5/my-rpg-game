/**
 * js/combat.js
 * ระบบการต่อสู้และคำนวณค่าสถานะ
 * คำนวณแบบต่อเนื่องตาม plv(player) ไม่กระโดดเป็นขั้นบันได
 * ค่าคงที่ทั้งหมดอิงจาก data/balance.json
 */

function getExpToNext(realm) {
    const table = gameData.balance?.cultivation?.expToNext;
    if (table && Array.isArray(table)) {
        return table[Math.min(realm, table.length - 1)] || 100000;
    }
    return 100 * Math.pow(2, realm);
}

// ระดับพลังต่อเนื่อง (Continuous Power Level): realm + เศษความก้าวหน้า
function plv(p) {
    if (!p) return 0;
    const realm = p.realm || 0;
    const nextReq = getExpToNext(realm);
    const progress = nextReq > 0 ? Math.min(0.999, Math.max(0, (p.exp || 0) / nextReq)) : 0;
    return +(realm + progress).toFixed(3);
}

function calculateCombatStats() {
    const balCombat = gameData.balance?.combat || {
        strAtkMod: 8, sprAtkMod: 4,
        vitDefMod: 7, sprDefMod: 3,
        agiCritMod: 0.3, agiEvaMod: 0.4,
        agiSpdMod: 2, baseSpd: 100
    };

    const powerFactor = Math.max(1, 1 + plv(player) * 0.4);
    const manaAtk = player.manaObj?.atkMod ?? 1.0;
    const manaDef = player.manaObj?.defMod ?? 1.0;
    const manaCrit = player.manaObj?.critBonus ?? 0;
    const manaEva = player.manaObj?.evaBonus ?? 0;

    let atk = Math.round((player.str * balCombat.strAtkMod + player.spr * balCombat.sprAtkMod) * powerFactor * manaAtk);
    let def = Math.round((player.vit * balCombat.vitDefMod + player.spr * balCombat.sprDefMod) * powerFactor * manaDef);
    let crit = Math.min(95, Math.round(player.agi * balCombat.agiCritMod + manaCrit));
    let eva = Math.min(85, Math.round(player.agi * balCombat.agiEvaMod + manaEva));
    let spd = Math.round(balCombat.baseSpd + player.agi * balCombat.agiSpdMod + plv(player) * 12);

    if (player.equipment) {
        Object.values(player.equipment).forEach(item => {
            if (item) {
                atk += item.atk || 0;
                def += item.def || 0;
                crit += item.crit || 0;
                eva += item.eva || 0;
            }
        });
    }

    return { atk, def, crit, eva, spd };
}

function equipItem(inventoryIndex) {
    if (!player.isAlive || isModalOpen) return;
    if (!player.inventory || !player.inventory[inventoryIndex]) return;

    const item = player.inventory[inventoryIndex];
    const slot = item.slot;
    if (!slot) return;

    // ถอดของเก่าในช่องนั้น (ถ้ามี) สลับเข้ากระเป๋า
    const oldItem = player.equipment[slot];
    player.equipment[slot] = item;
    player.inventory.splice(inventoryIndex, 1);
    if (oldItem) player.inventory.push(oldItem);

    addLog(`🛡️ สวมใส่ <b>${item.name}</b>`, "text-cyan-300");
    updateUI();
}

function unequipSlot(slotName) {
    if (!player.isAlive || isModalOpen) return;
    const item = player.equipment[slotName];
    if (!item) return;

    if (!player.inventory) player.inventory = [];
    if (player.inventory.length >= 6) {
        return addLog(`⚠️ กระเป๋าเต็ม! ถอดอุปกรณ์ไม่ได้`, "text-red-400");
    }

    player.equipment[slotName] = null;
    player.inventory.push(item);
    addLog(`ถอด <b>${item.name}</b> เก็บเข้ากระเป๋า`, "text-stone-400");
    updateUI();
}
