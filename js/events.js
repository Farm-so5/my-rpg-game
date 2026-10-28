/**
 * js/events.js
 * ตัวแปลเหตุการณ์ (Event Interpreter)
 * ประมวลผลเงื่อนไข if, การทอยเต๋า roll, และผลลัพธ์ effects ตามสเปก
 * ปลอดภัย: ไม่ใช้ eval หรือ new Function อย่างเด็ดขาด
 */

function getStatValue(statName, player) {
    if (statName === 'power') {
        return typeof plv === 'function' ? plv(player) : (player.realm * 100 + player.exp);
    }
    if (statName === 'demonic') {
        return player.manaObj?.isDemonic ? 1 : 0;
    }
    if (statName === 'expToNext') {
        const nextReq = getExpToNext(player.realm);
        return Math.max(0, nextReq - player.exp);
    }
    if (statName.startsWith('event:')) {
        const evId = statName.substring(6);
        return (player.eventLast && player.eventLast[evId] !== undefined) ? 1 : 0;
    }
    if (statName.startsWith('hasItem:')) {
        const itemId = statName.substring(8);
        const inInv = player.inventory?.some(i => i.id === itemId || i === itemId);
        const inEq = Object.values(player.equipment || {}).some(i => i && (i.id === itemId || i === itemId));
        return (inInv || inEq) ? 1 : 0;
    }
    return player[statName] ?? 0;
}

function evaluateCondition(cond, player) {
    if (!cond || !cond.stat) return true;
    const currentVal = getStatValue(cond.stat, player);
    const targetVal = cond.value ?? 0;
    const op = cond.op || '>=';

    switch (op) {
        case '>=': return currentVal >= targetVal;
        case '<=': return currentVal <= targetVal;
        case '>':  return currentVal > targetVal;
        case '<':  return currentVal < targetVal;
        case '==': return currentVal == targetVal;
        case '!=': return currentVal != targetVal;
        default:   return currentVal >= targetVal;
    }
}

function applyEffects(effects, player) {
    if (!Array.isArray(effects)) return;

    effects.forEach(eff => {
        if (!eff || !eff.op) return;

        switch (eff.op) {
            case 'add':
                if (eff.stat) {
                    player[eff.stat] = (player[eff.stat] || 0) + (eff.value || 0);
                    if (eff.stat === 'strain') player.strain = Math.max(0, Math.min(100, player.strain));
                    if (eff.stat === 'suspicion') player.suspicion = Math.max(0, Math.min(100, player.suspicion));
                    if (eff.stat === 'hp') player.hp = Math.max(0, Math.min(player.maxHp, player.hp));
                    if (eff.stat === 'mp') player.mp = Math.max(0, Math.min(player.maxMp, player.mp));
                }
                break;

            case 'set':
                if (eff.stat) {
                    player[eff.stat] = eff.value;
                }
                break;

            case 'hurt': {
                const damage = eff.pct !== undefined
                    ? Math.round(player.maxHp * eff.pct)
                    : (eff.value || 0);
                player.hp = Math.max(0, player.hp - damage);
                addLog(`💥 ได้รับความเสียหาย ${damage} จุด!`, "text-red-400");
                break;
            }

            case 'give': {
                if (eff.item && gameData.items) {
                    const foundItem = gameData.items.find(i => i.id === eff.item);
                    if (foundItem) {
                        if (!player.inventory) player.inventory = [];
                        if (player.inventory.length < 6) {
                            player.inventory.push(foundItem);
                            addLog(`🎁 ได้รับไอเทม: <b>${foundItem.name}</b>`, "text-emerald-300");
                        } else {
                            addLog(`⚠️ กระเป๋าเต็ม! ไม่สามารถเก็บ ${foundItem.name} ได้`, "text-orange-400");
                        }
                    }
                }
                break;
            }

            case 'equip': {
                if (eff.item && gameData.items) {
                    const foundItem = gameData.items.find(i => i.id === eff.item);
                    if (foundItem && foundItem.slot) {
                        if (player.equipment[foundItem.slot]) {
                            if (player.inventory.length < 6) player.inventory.push(player.equipment[foundItem.slot]);
                        }
                        player.equipment[foundItem.slot] = foundItem;
                        addLog(`✨ สวมใส่อุปกรณ์ทันที: <b>${foundItem.name}</b>`, "text-amber-300");
                    }
                }
                break;
            }

            case 'log':
                if (eff.text) {
                    addLog(eff.text, "text-stone-300");
                }
                break;

            case 'die':
                die(eff.reason || "สิ้นชีพกะทันหัน");
                break;
        }
    });
}

function calculateRollChance(chanceConfig, player) {
    if (!chanceConfig) return 0.5;
    const base = chanceConfig.base ?? 0.5;
    const luckBonus = (chanceConfig.luck ?? 0.002) * (player.luck || 50);
    const powerLevel = typeof plv === 'function' ? plv(player) : (player.realm || 1);
    const powerBonus = (chanceConfig.power ?? 0.02) * powerLevel;

    // ขอบเขตโอกาสสำเร็จขั้นต่ำ 5% สูงสุด 95%
    return Math.min(0.95, Math.max(0.05, base + luckBonus + powerBonus));
}

function triggerModalEvent(eventObj) {
    clearInterval(progressTimer);
    isModalOpen = true;

    const modalAge = document.getElementById('modal-age');
    const modalTitle = document.getElementById('modal-title');
    const modalDesc = document.getElementById('modal-desc');
    const choicesDiv = document.getElementById('modal-choices');

    if (modalAge) modalAge.innerText = `อายุ ${player.age} ปี`;
    if (modalTitle) modalTitle.innerText = eventObj.title || 'เหตุการณ์ไม่คาดฝัน';
    if (modalDesc) modalDesc.innerText = eventObj.desc || '';

    if (!choicesDiv) return;
    choicesDiv.innerHTML = "";

    eventObj.choices.forEach((choice, idx) => {
        const canChoose = !choice.if || choice.if.every(cond => evaluateCondition(cond, player));

        const btn = document.createElement('button');
        btn.className = canChoose
            ? "w-full text-left p-3.5 rounded-xl bg-stone-900 border border-amber-700/60 text-stone-200 hover:bg-stone-800 hover:border-amber-500 transition cursor-pointer shadow-md"
            : "w-full text-left p-3.5 rounded-xl bg-stone-950/70 border border-stone-800 text-stone-600 cursor-not-allowed opacity-60";

        let choiceLabel = choice.text;
        if (!canChoose && choice.if) {
            const missingText = choice.if.map(c => `[ต้องการ ${c.stat} ${c.op || '>='} ${c.value}]`).join(' ');
            choiceLabel += ` <span class="text-xs text-red-500">${missingText}</span>`;
        }

        btn.innerHTML = choiceLabel;
        btn.disabled = !canChoose;

        if (canChoose) {
            btn.onclick = () => {
                addLog(`⚡ <b>ตัดสินใจ:</b> ${choice.text}`, "text-amber-300");

                // บันทึกเวลาที่เกิดเหตุการณ์
                if (!player.eventLast) player.eventLast = {};
                player.eventLast[eventObj.id] = player.age;

                // ตรวจสอบการทอยเต๋า roll
                if (choice.roll) {
                    const finalChance = calculateRollChance(choice.roll.chance, player);
                    const dice = Math.random();

                    if (dice < finalChance) {
                        addLog(`🎲 โชคชะตาเข้าข้าง! (สำเร็จ)`, "text-emerald-400 font-bold");
                        applyEffects(choice.roll.success, player);
                    } else {
                        addLog(`🎲 สวรรค์ไร้ปรานี... (ล้มเหลว)`, "text-rose-400 font-bold");
                        applyEffects(choice.roll.fail, player);
                    }
                }

                // เอฟเฟกต์คงที่ effects
                if (choice.effects) {
                    applyEffects(choice.effects, player);
                }

                closeModal();
            };
        }

        choicesDiv.appendChild(btn);
    });

    const modalEl = document.getElementById('event-modal');
    if (modalEl) modalEl.classList.remove('hidden');
}

function closeModal() {
    const modalEl = document.getElementById('event-modal');
    if (modalEl) modalEl.classList.add('hidden');
    isModalOpen = false;

    // ตรวจสอบความตายหลังจบเหตุการณ์
    if (player.hp <= 0) return die("บาดเจ็บสาหัสจนสิ้นใจ");
    if (player.strain >= 100) return die("เส้นชีพจรระเบิด!");
    if (player.suspicion >= 100) return die("ถูกศาสนจักรล้อมสังหาร!");

    updateUI();
    setSpeed(lastActiveSpeed);
}
