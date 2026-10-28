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
        return (player.manaObj?.isDemonic || player.manas?.some(m => m && m.isDemonic)) ? 1 : 0;
    }
    if (statName === 'kingdom') {
        return player.kingdom?.name || '';
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
                if (eff.stat === 'kingdom' && gameData.kingdoms) {
                    const foundK = gameData.kingdoms.find(k => k.name === eff.value);
                    if (foundK) {
                        player.kingdom = foundK;
                        addLog(`🏰 โยกย้ายถิ่นฐาน ลี้ภัยสู่ <b>${foundK.name}</b>`, "text-amber-300");
                    }
                } else if (eff.stat) {
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

            case 'learnMana': {
                if (eff.mana && gameData.manas) {
                    const foundMana = gameData.manas.find(m => m.name === eff.mana || m.id === eff.mana);
                    if (foundMana && typeof acquireNewMana === 'function') {
                        acquireNewMana(foundMana);
                    }
                }
                break;
            }

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

function getStatLabel(stat) {
    const labels = {
        'gold': '💰 ทอง',
        'str': '💪 พละกำลัง (STR)',
        'vit': '🛡️ ความทนทาน (VIT)',
        'agi': '💨 ความว่องไว (AGI)',
        'spr': '🔮 จิตวิญญาณ (SPR)',
        'luck': '🍀 วาสนา (LUCK)',
        'realm': '⚡ ขั้นพลัง (Realm)',
        'hp': '❤️ พลังชีวิต (HP)',
        'mp': '🔷 พลังเวท (MP)',
        'strain': '🩸 บอบช้ำ (Strain)',
        'suspicion': '👁️ เพ่งเล็ง (Suspicion)',
        'power': '⚡ พลังรวม (PLv)',
        'demonic': '🔥 พลังมาร'
    };
    if (stat.startsWith('event:')) return `📜 เควสต์ [${stat.substring(6)}]`;
    if (stat.startsWith('hasItem:')) return `🎒 มีไอเทม [${stat.substring(8)}]`;
    return labels[stat] || stat;
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

    // อัปเดตข้อมูลสถานะด่วนของผู้เล่นบนหัวป๊อปอัป (Modal Player HUD)
    const setModalHud = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    setModalHud('modal-hud-gold', player.gold ?? 0);
    setModalHud('modal-hud-hp', `${player.hp ?? 0}/${player.maxHp ?? 100}`);
    setModalHud('modal-hud-mp', `${player.mp ?? 0}/${player.maxMp ?? 100}`);
    setModalHud('modal-hud-strain', `${player.strain ?? 0}%`);
    setModalHud('modal-hud-suspicion', `${player.suspicion ?? 0}%`);
    setModalHud('modal-hud-str', player.str ?? 10);
    setModalHud('modal-hud-vit', player.vit ?? 10);
    setModalHud('modal-hud-agi', player.agi ?? 10);
    setModalHud('modal-hud-spr', player.spr ?? 10);
    setModalHud('modal-hud-luck', player.luck ?? 50);
    setModalHud('modal-hud-realm', player.realm ?? 1);

    if (!choicesDiv) return;
    choicesDiv.innerHTML = "";

    eventObj.choices.forEach((choice, idx) => {
        const conditionBadges = [];
        let canChoose = true;

        // ตรวจสอบเงื่อนไข if
        if (choice.if && Array.isArray(choice.if)) {
            choice.if.forEach(cond => {
                const currentVal = getStatValue(cond.stat, player);
                const passed = evaluateCondition(cond, player);
                if (!passed) canChoose = false;

                const statName = getStatLabel(cond.stat);
                const op = cond.op || '>=';
                const reqVal = cond.value ?? 0;

                if (passed) {
                    conditionBadges.push(`<span class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-600/60 font-medium">✔ ต้องการ ${statName} ${op} ${reqVal} (มีอยู่: ${currentVal})</span>`);
                } else {
                    conditionBadges.push(`<span class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-rose-950/90 text-rose-300 border border-rose-600/70 font-medium">✖ ต้องการ ${statName} ${op} ${reqVal} (มีอยู่: ${currentVal})</span>`);
                }
            });
        }

        // ตรวจสอบค่าใช้จ่ายทองและผลกระทบสำคัญ
        const costBadges = [];
        if (choice.effects && Array.isArray(choice.effects)) {
            choice.effects.forEach(eff => {
                if (eff.op === 'add' && eff.stat === 'gold') {
                    if (eff.value < 0) {
                        const canAfford = (player.gold || 0) >= Math.abs(eff.value);
                        costBadges.push(`<span class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${canAfford ? 'bg-amber-950/80 text-amber-300 border border-amber-600/60' : 'bg-red-950/90 text-red-300 border border-red-700/60'} font-semibold">💸 เสีย ${Math.abs(eff.value)} ทอง ${canAfford ? '(มีพอจ่าย)' : '(ทองไม่พอ!)'}</span>`);
                    } else if (eff.value > 0) {
                        costBadges.push(`<span class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-600/60 font-semibold">💰 ได้รับ +${eff.value} ทอง</span>`);
                    }
                }
            });
        }

        // ตรวจสอบโอกาสทอยเต๋า Roll
        if (choice.roll) {
            const chancePct = Math.round(calculateRollChance(choice.roll.chance, player) * 100);
            costBadges.push(`<span class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-600/60 font-semibold">🎲 โอกาสสำเร็จ ~${chancePct}%</span>`);
        }

        const btn = document.createElement('button');
        btn.className = canChoose
            ? "w-full text-left p-3.5 rounded-xl bg-stone-900 border border-amber-700/60 text-stone-200 hover:bg-stone-800 hover:border-amber-400 transition cursor-pointer shadow-md space-y-1.5"
            : "w-full text-left p-3.5 rounded-xl bg-stone-950/70 border border-stone-800 text-stone-500 cursor-not-allowed opacity-60 space-y-1.5";

        let htmlContent = `<div class="font-medium text-sm leading-snug">${choice.text}</div>`;

        if (conditionBadges.length > 0 || costBadges.length > 0) {
            htmlContent += `<div class="flex flex-wrap gap-1.5 pt-0.5">`;
            if (conditionBadges.length > 0) htmlContent += conditionBadges.join(' ');
            if (costBadges.length > 0) htmlContent += costBadges.join(' ');
            htmlContent += `</div>`;
        }

        btn.innerHTML = htmlContent;
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
