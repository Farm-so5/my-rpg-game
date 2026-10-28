/**
 * js/combat.js
 * ระบบการต่อสู้และคำนวณค่าสถานะ
 * คำนวณแบบต่อเนื่องตาม plv(player) ไม่กระโดดเป็นขั้นบันได
 * ค่าคงที่ทั้งหมดอิงจาก data/balance.json
 */

function getExpToNext(realm) {
    const table = gameData.balance?.cultivation?.expToNext;
    let baseReq = 100 * Math.pow(2, realm);
    if (table && Array.isArray(table)) {
        baseReq = table[Math.min(realm, table.length - 1)] || 100000;
    }
    // ภาระจิตสองสาย: หากฝึก 2 พลังโดยไม่มีคัมภีร์หยินหยางผสานเต๋า เพิ่มความยากในการทะลวงขั้น 10%
    if (typeof player !== 'undefined' && player?.manas?.length === 2) {
        const hasYY = typeof hasYinYangEnlightenment === 'function' ? hasYinYangEnlightenment(player) : false;
        if (!hasYY) {
            baseReq = Math.round(baseReq * 1.10);
        }
    }
    return baseReq;
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

    // พลังหลัก (Primary Mana)
    const m1 = player.primaryMana || player.manas?.[0] || player.manaObj;
    let manaAtk = m1?.atkMod ?? 1.0;
    let manaDef = m1?.defMod ?? 1.0;
    let manaCrit = m1?.critBonus ?? 0;
    let manaEva = m1?.evaBonus ?? 0;

    // พลังรอง (Secondary Mana) ให้ผล 40% เพื่อรักษาสมดุลไม่ให้ OP
    const m2 = player.secondaryMana || player.manas?.[1] || null;
    if (m2) {
        const secEff = 0.40;
        manaAtk += ((m2.atkMod ?? 1.0) - 1.0) * secEff;
        manaDef += ((m2.defMod ?? 1.0) - 1.0) * secEff;
        manaCrit += Math.round((m2.critBonus ?? 0) * secEff);
        manaEva += Math.round((m2.evaBonus ?? 0) * secEff);
    }

    // ปฏิกิริยาทวิธาตุ (Elemental Resonance Buff/Debuff)
    const res = typeof getPlayerResonance === 'function' ? getPlayerResonance(player) : null;
    const resAtkMod = res?.atkMod ?? 1.0;
    const resDefMod = res?.defMod ?? 1.0;
    const resCritBonus = res?.critBonus ?? 0;
    const resEvaBonus = res?.evaBonus ?? 0;
    const resSpdBonus = res?.spdBonus ?? 0;

    let atk = Math.round((player.str * balCombat.strAtkMod + player.spr * balCombat.sprAtkMod) * powerFactor * manaAtk * resAtkMod);
    let def = Math.round((player.vit * balCombat.vitDefMod + player.spr * balCombat.sprDefMod) * powerFactor * manaDef * resDefMod);
    let crit = Math.min(95, Math.max(0, Math.round(player.agi * balCombat.agiCritMod + manaCrit + resCritBonus)));
    let eva = Math.min(85, Math.max(0, Math.round(player.agi * balCombat.agiEvaMod + manaEva + resEvaBonus)));
    let spd = Math.round(balCombat.baseSpd + player.agi * balCombat.agiSpdMod + plv(player) * 12 + resSpdBonus);

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
