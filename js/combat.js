
function calculateCombatStats() {
    let realmMult = Math.max(1, player.realm * 1.5);
    let atk = Math.round((player.str * 8 + player.spr * 4) * realmMult * player.manaObj.atkMod);
    let def = Math.round((player.vit * 7 + player.spr * 3) * realmMult * player.manaObj.defMod);
    let crit = Math.min(95, Math.round(player.agi * 0.3 + player.manaObj.critBonus));
    let eva = Math.min(85, Math.round(player.agi * 0.4 + player.manaObj.evaBonus));
    let spd = Math.round(100 + player.agi * 2 + player.realm * 15);

    Object.values(player.equipment).forEach(item => {
        if (item) { atk += item.atk; def += item.def; crit += item.crit; eva += item.eva; }
    });
    return { atk, def, crit, eva, spd };
}

function unequipSlot(slotName) {
    if (!player.isAlive) return;
    let item = player.equipment[slotName];
    if (!item) return;
    if (player.inventory.length >= 6) return addLog(`⚠️ กระเป๋าเต็ม!`, "text-red-400");
    player.equipment[slotName] = null;
    player.inventory.push(item);
    updateUI();
}
