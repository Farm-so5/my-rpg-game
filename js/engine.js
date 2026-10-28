/**
 * js/engine.js
 * ลูปรายปี / ฝึกฝน / ทะลวงขั้น / พักฟื้น / ตรวจสอบความตาย / UI
 * ค่าสมดุลทั้งหมดอิงจาก data/balance.json
 */

function getRandomWeighted(items) {
    let totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
    let randomNum = Math.random() * totalWeight;
    for (let item of items) {
        const w = item.weight || 1;
        if (randomNum < w) return item;
        randomNum -= w;
    }
    return items[0];
}

function getRealmTitle(realm) {
    const titles = [
        "ปุถุชนไร้เวท",
        "ผู้ฝึกหัดรวบรวมปราณ",
        "หลอมรวมลมปราณ",
        "แก่นทองคำแท้",
        "วิญญาณก่อกำเนิด",
        "ตัดวิญญาณรู้แจ้ง",
        "หลอมรวมเต๋า",
        "มหาปรมาจารย์แดนลี้ลับ",
        "กึ่งเซียนครึ่งก้าวสู่สวรรค์",
        "มหาเซียนนิรันดร์กาล"
    ];
    return titles[realm] || `มหาเซียนขั้นที่ ${realm}`;
}

function startGame() {
    if (!gameData.kingdoms || gameData.kingdoms.length === 0) {
        return alert("⚠️ กำลังโหลดข้อมูล โปรดรอสักครู่ หรือใช้ Live Server / GitHub Pages รันโค้ด");
    }

    let chosenKingdom = gameData.kingdoms[Math.floor(Math.random() * gameData.kingdoms.length)];
    let chosenOrigin = getRandomWeighted(gameData.origins);
    let chosenMana = getRandomWeighted(gameData.manas);

    // หากเป็นจอมมาร จะบังคับได้รับมานามาร
    if (chosenOrigin.name.includes("จอมมาร")) {
        const demonicManas = gameData.manas.filter(m => m.isDemonic);
        if (demonicManas.length > 0) chosenMana = demonicManas[Math.floor(Math.random() * demonicManas.length)];
    }

    // กำหนดโครงสร้าง player ตามสเปก v2 ครบทุกฟิลด์
    player = {
        kingdom: chosenKingdom,
        originObj: chosenOrigin,
        manaObj: chosenMana,
        age: 0,
        maxAge: 100,
        realm: chosenMana.name === "ไร้พลังเวท" ? 0 : 1,
        exp: 0,
        hp: chosenOrigin.hp,
        maxHp: chosenOrigin.hp,
        mp: chosenOrigin.mp,
        maxMp: chosenOrigin.mp,
        str: chosenOrigin.str,
        vit: chosenOrigin.vit,
        agi: chosenOrigin.agi,
        spr: chosenOrigin.spr,
        strain: 0,
        suspicion: chosenMana.isDemonic ? 15 : 0,
        luck: chosenOrigin.luck,
        gold: chosenOrigin.gold,
        equipment: {
            weapon: null,
            gloves: null,
            armor: null,
            ring: null,
            helm: null,
            necklace: null,
            relic: null,
            boots: null
        },
        inventory: [],
        isAlive: true,
        resting: false,
        eventLast: {}
    };

    isModalOpen = false;

    // สลับหน้าจอ
    document.getElementById('start-panel')?.classList.add('hidden');
    document.getElementById('game-panel')?.classList.remove('hidden');
    document.getElementById('time-controls')?.classList.remove('hidden');
    document.getElementById('progress-wrapper')?.classList.remove('hidden');

    const logEl = document.getElementById('log-content');
    if (logEl) logEl.innerHTML = "";

    addLog(`✨ จุติใหม่ใน <b>${player.kingdom.name}</b> ฐานะ <b>${player.originObj.name}</b>`, "text-amber-300");
    addLog(`🔮 ได้รับพลัง: <b>${player.manaObj.name}</b> (${player.manaObj.aura})`, "text-purple-300");

    updateUI();
    setSpeed(1);
}

function tryBreakthrough() {
    const balCult = gameData.balance?.cultivation;
    if (!balCult) return;

    const currentReq = getExpToNext(player.realm);
    if (player.exp < currentReq || player.realm >= 9) return;

    // หากอยู่ที่ขั้น 8 กำลังขึ้นขั้น 9 ต้องผ่านมหาทัณฑ์สวรรค์
    if (player.realm === 8) {
        const tribulationEvent = gameData.events?.find(e => e.id === "heavenly_tribulation_9");
        if (tribulationEvent && !isModalOpen) {
            addLog(`⚡ มหาทัณฑ์สวรรค์ปรากฏสู่เบื้องหน้า! สวรรค์ส่งสายฟ้าลงมาทดสอบ!`, "text-yellow-400 font-bold");
            triggerModalEvent(tribulationEvent);
            return;
        }
    }

    const baseChance = balCult.breakthroughBaseChance?.[player.realm] ?? 0.35;
    const luckBonus = (balCult.breakthroughLuckMod ?? 0.003) * (player.luck || 50);
    const finalChance = Math.min(0.9, Math.max(0.05, baseChance + luckBonus));

    const roll = Math.random();
    if (roll < finalChance) {
        player.realm += 1;
        player.exp = 0;
        const gains = balCult.breakthroughStatGains || { str: 2, vit: 2, agi: 2, spr: 3, hp: 20, mp: 25 };
        player.str += gains.str || 0;
        player.vit += gains.vit || 0;
        player.agi += gains.agi || 0;
        player.spr += gains.spr || 0;
        player.maxHp += gains.hp || 0;
        player.hp = player.maxHp;
        player.maxMp += gains.mp || 0;
        player.mp = player.maxMp;

        const lifespanAdd = balCult.breakthroughLifespanGains?.[player.realm - 1] || 0;
        if (lifespanAdd > 0) {
            player.maxAge += lifespanAdd;
        }

        addLog(`🎉 <b>[อายุ ${player.age} ปี]</b> ทะลวงขอบเขตสำเร็จ! บรรลุ <b>${getRealmTitle(player.realm)}</b>!${lifespanAdd > 0 ? ` (อายุขัย +${lifespanAdd} ปี)` : ''}`, "text-cyan-300 font-bold");
    } else {
        const failStrain = balCult.breakthroughFailStrain ?? 15;
        const failDamage = Math.round(player.maxHp * (balCult.breakthroughFailHpDamagePct ?? 0.20));
        player.strain = Math.min(100, player.strain + failStrain);
        player.hp = Math.max(0, player.hp - failDamage);
        player.exp = Math.round(player.exp * 0.7); // เสียตบะบางส่วน

        addLog(`⚠️ <b>[อายุ ${player.age} ปี]</b> ทะลวงขั้นล้มเหลว! ธาตุไฟเข้าแทรก บาดเจ็บ ${failDamage} จุด บอบช้ำ +${failStrain}%`, "text-orange-400");
        if (player.strain >= 100) return die("ธาตุไฟเข้าแทรกระหว่างทะลวงขั้น ชีพจรระเบิดดับสูญ!");
        if (player.hp <= 0) return die("ได้รับบาดเจ็บสาหัสจากการทะลวงขั้นล้มเหลวจนสิ้นใจ");
    }
}

function ageUp() {
    if (!player.isAlive || isModalOpen) return;

    player.age += 1;

    // 1. ตรวจสอบเงื่อนไขการเสียชีวิต
    if (player.age >= player.maxAge) {
        if (player.realm >= 8) return die("มหาเซียนละสังขาร คืนสู่ธรรมชาติอันเป็นนิรันดร์");
        if (player.realm >= 4) return die("ยอดฝีมือหมดสิ้นอายุขัย ละโลกไปอย่างสงบ");
        return die("สิ้นอายุขัยตามกฎแห่งกาลเวลา");
    }
    if (player.hp <= 0) return die("บาดเจ็บสาหัส พิษบาดแผลกำเริบจนสิ้นลมหายใจ");
    if (player.strain >= 100) {
        if (player.manaObj?.isDemonic) return die("พลังมารตีกลับ ชีพจรระเบิด ร่างกายแหลกสลาย!");
        if (player.manaObj?.name && !player.manaObj.name.includes("ไร้พลัง")) {
            return die(`ธาตุไฟเข้าแทรก ลมปราณ${player.manaObj.name}ตีกลับ ชีพจรฉีกขาด!`);
        }
        return die("เส้นชีพจรระเบิด ร่างกายแหลกสลาย!");
    }
    if (player.suspicion >= 100) {
        if (player.kingdom?.name?.includes("ศักดิ์สิทธิ์")) return die("ถูกศาลศาสนจักรศักดิ์สิทธิ์ไต่สวนและเผาทั้งเป็นบนลานประหาร!");
        if (player.kingdom?.name?.includes("อัศวิน")) return die("ถูกกองอัศวินโต๊ะกลมปิดล้อมและตัดศีรษะในสนามรบ!");
        return die("ถูกกองทัพศาสนจักรและผู้พิทักษ์กฎล้อมสังหาร!");
    }

    const bal = gameData.balance || {};
    const balRest = bal.rest || { strainThreshold: 55, hpThresholdPct: 0.5, strainRecovery: 18, hpRecoveryPct: 0.35, mpRecoveryPct: 0.4 };
    const balSusp = bal.suspicion || { demonicBaseAnnualGain: 5, passiveDecay: 1 };
    const balCult = bal.cultivation || { baseTrainExp: 25, sprExpMod: 1.2, realmExpMultiplier: 0.35, trainStrainGain: 3 };

    // 2. ระบบพักฟื้นอัตโนมัติ vs หมั่นฝึกฝน
    const needRest = player.strain >= balRest.strainThreshold || (player.hp < player.maxHp * balRest.hpThresholdPct);

    if (needRest) {
        player.resting = true;
        player.strain = Math.max(0, player.strain - balRest.strainRecovery);
        player.hp = Math.min(player.maxHp, player.hp + Math.round(player.maxHp * balRest.hpRecoveryPct));
        player.mp = Math.min(player.maxMp, player.mp + Math.round(player.maxMp * balRest.mpRecoveryPct));
        player.suspicion = Math.max(0, player.suspicion - (balSusp.passiveDecay || 1));

        addLog(`🌿 <b>[อายุ ${player.age} ปี]</b> พักฟื้นรักษาชีพจร (บอบช้ำ -${balRest.strainRecovery}%, พลังชีวิตฟื้นฟู)`, "text-emerald-400");
    } else {
        player.resting = false;

        // ผู้ใช้มานามารจะถูกเพ่งเล็งสะสมในแต่ละปี
        if (player.manaObj?.isDemonic) {
            const suspMod = player.kingdom?.suspMod ?? 1.0;
            const suspGain = Math.round((balSusp.demonicBaseAnnualGain || 5) * suspMod);
            player.suspicion = Math.min(100, player.suspicion + suspGain);
        }

        // เก็บเกี่ยวค่าประสบการณ์ โดยสเกลตามขั้นพลัง
        const realmScale = 1 + (typeof plv === 'function' ? plv(player) : player.realm) * (balCult.realmExpMultiplier || 0.35);
        const expGain = Math.round(((balCult.baseTrainExp || 25) + player.spr * (balCult.sprExpMod || 1.2)) * realmScale);
        player.exp += expGain;
        player.strain = Math.min(100, player.strain + (balCult.trainStrainGain || 3));

        // สุ่มรายได้รายปี
        const minGold = bal.economy?.annualGoldMin ?? 5;
        const maxGold = bal.economy?.annualGoldMax ?? 25;
        const earned = Math.floor(Math.random() * (maxGold - minGold + 1)) + minGold;
        player.gold += earned;

        addLog(`🧘 <b>[อายุ ${player.age} ปี]</b> หมั่นฝึกฝน (ได้ exp +${expGain}, ทอง +${earned})`, "text-stone-400");

        // ตรวจสอบการทะลวงขอบเขตพลัง
        tryBreakthrough();
    }

    // 3. ตรวจสอบการเกิดเหตุการณ์ (Events)
    const annualEventChance = (bal.events?.annualTriggerChance ?? 0.35) + ((player.luck || 50) * (bal.events?.luckChanceMod ?? 0.001));

    if (gameData.events && gameData.events.length > 0 && Math.random() < annualEventChance) {
        const eligibleEvents = gameData.events.filter(e => {
            // เช็กอายุ
            if (e.minAge !== undefined && player.age < e.minAge) return false;
            if (e.maxAge !== undefined && player.age > e.maxAge) return false;

            // เช็กอาณาจักร
            if (e.kingdoms && Array.isArray(e.kingdoms) && !e.kingdoms.includes(player.kingdom.name)) return false;

            // เช็ก cooldown
            const lastAge = player.eventLast ? player.eventLast[e.id] : undefined;
            if (lastAge !== undefined) {
                if (e.cooldown === undefined) return false; // ไม่มี cooldown = เกิดได้ครั้งเดียว
                if (player.age - lastAge < e.cooldown) return false;
            }

            // เช็กเงื่อนไข if
            if (e.if && Array.isArray(e.if)) {
                if (!e.if.every(cond => evaluateCondition(cond, player))) return false;
            }

            return true;
        });

        if (eligibleEvents.length > 0) {
            const chosenEvent = getRandomWeighted(eligibleEvents);
            triggerModalEvent(chosenEvent);
            updateUI();
            return;
        }
    }

    updateUI();
}

function setSpeed(speed) {
    if (!player.isAlive || isModalOpen) return;
    currentSpeed = speed;
    if (speed > 0) lastActiveSpeed = speed;

    [0, 1, 2, 3].forEach(s => {
        const btn = document.getElementById(`btn-speed-${s}`);
        if (btn) {
            btn.className = s === speed
                ? "px-3 py-1 text-xs font-bold rounded-lg transition bg-amber-600 text-white"
                : "px-3 py-1 text-xs font-bold rounded-lg transition text-stone-400 hover:text-white";
        }
    });

    clearInterval(progressTimer);
    if (speed > 0) {
        let intervalMs = SPEED_INTERVALS[speed] || 1000;
        let stepMs = 50;
        let increment = (stepMs / intervalMs) * 100;

        progressTimer = setInterval(() => {
            progressValue += increment;
            if (progressValue >= 100) {
                progressValue = 0;
                ageUp();
            }
            const bar = document.getElementById('year-progress');
            if (bar) bar.style.width = `${Math.min(progressValue, 100)}%`;
        }, stepMs);
    }
}

function die(reason) {
    player.isAlive = false;
    player.deathReason = reason;
    clearInterval(progressTimer);

    const statusEl = document.getElementById('game-status');
    if (statusEl) {
        statusEl.innerText = "สิ้นชีพแล้ว";
        statusEl.className = "text-xs px-2.5 py-0.5 bg-red-950 text-red-300 border border-red-700 rounded-full";
    }

    addLog(`💀 <b>[อายุ ${player.age} ปี]</b> ${reason}`, "text-red-400 font-bold");
    updateUI();
}

function resetGame() {
    clearInterval(progressTimer);
    isModalOpen = false;

    document.getElementById('event-modal')?.classList.add('hidden');
    document.getElementById('start-panel')?.classList.remove('hidden');
    document.getElementById('game-panel')?.classList.add('hidden');
    document.getElementById('time-controls')?.classList.add('hidden');
    document.getElementById('progress-wrapper')?.classList.add('hidden');

    const statusEl = document.getElementById('game-status');
    if (statusEl) {
        statusEl.innerText = "รอการจุติ";
        statusEl.className = "text-xs px-2.5 py-0.5 bg-stone-900 text-stone-400 border border-stone-700 rounded-full";
    }
}

function addLog(htmlText, colorClass = "text-stone-300") {
    let logContainer = document.getElementById('log-content');
    if (logContainer) {
        logContainer.innerHTML = `<p class="border-l-2 border-amber-700/60 pl-2 py-0.5 ${colorClass}">${htmlText}</p>` + logContainer.innerHTML;
    }
}

function updateUI() {
    if (!player || !player.originObj) return;

    // ข้อมูลทั่วไป
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

    setTxt('p-origin', player.originObj.name);
    setTxt('p-kingdom', player.kingdom.name);
    setTxt('p-mana-type', player.manaObj.name);
    setTxt('p-age', player.age);
    setTxt('p-max-age', player.maxAge);
    setTxt('p-realm', `ขั้นที่ ${player.realm} (${getRealmTitle(player.realm)}) [PLv: ${plv(player)}]`);
    setTxt('stat-gold', player.gold);
    setTxt('stat-strain', player.strain);
    setTxt('stat-suspicion', player.suspicion);
    setTxt('combat-luck', player.luck);

    // สถานะพักฟื้น / ฝึกฝน
    const statusEl = document.getElementById('game-status');
    if (statusEl && player.isAlive) {
        if (player.resting) {
            statusEl.innerText = "🌿 พักฟื้นชีพจร";
            statusEl.className = "text-xs px-2.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700 rounded-full";
        } else {
            statusEl.innerText = "⚔️ หมั่นฝึกฝน";
            statusEl.className = "text-xs px-2.5 py-0.5 bg-stone-900 text-amber-300 border border-amber-700 rounded-full";
        }
    }

    // Avatar & Aura
    setTxt('avatar-icon', player.originObj.avatar || '🧘‍♂️');
    setTxt('avatar-aura', player.manaObj.aura || 'ออร่า');

    // แถบ EXP
    const nextExp = getExpToNext(player.realm);
    const expPct = nextExp > 0 ? Math.min(100, Math.round((player.exp / nextExp) * 100)) : 100;
    const expBar = document.getElementById('exp-bar');
    if (expBar) expBar.style.width = `${expPct}%`;
    setTxt('exp-text', `${player.exp}/${nextExp} (${expPct}%)`);

    // HP & MP Bars
    const hpBar = document.getElementById('bar-hp');
    if (hpBar) hpBar.style.width = `${Math.min(100, Math.max(0, (player.hp / player.maxHp) * 100))}%`;
    setTxt('text-hp', `${player.hp}/${player.maxHp}`);

    const mpBar = document.getElementById('bar-mp');
    if (mpBar) mpBar.style.width = `${Math.min(100, Math.max(0, (player.mp / player.maxMp) * 100))}%`;
    setTxt('text-mp', `${player.mp}/${player.maxMp}`);

    // Attributes
    setTxt('attr-str', player.str);
    setTxt('attr-vit', player.vit);
    setTxt('attr-agi', player.agi);
    setTxt('attr-spr', player.spr);

    // Combat Stats
    if (typeof calculateCombatStats === 'function') {
        const cStats = calculateCombatStats();
        setTxt('combat-atk', cStats.atk);
        setTxt('combat-def', cStats.def);
        setTxt('combat-crit', `${cStats.crit}%`);
        setTxt('combat-eva', `${cStats.eva}%`);
        setTxt('combat-spd', cStats.spd);
    }

    // อุปกรณ์สวมใส่ (Equipment Slots)
    const slotNames = ['weapon', 'gloves', 'armor', 'ring', 'helm', 'necklace', 'relic', 'boots'];
    slotNames.forEach(slot => {
        const slotEl = document.getElementById(`slot-${slot}`);
        if (!slotEl) return;
        const item = player.equipment?.[slot];
        if (item) {
            slotEl.className = "rpg-slot occupied w-14 h-14 rounded-lg flex flex-col items-center justify-center cursor-pointer relative border border-amber-500 bg-amber-950/40 shadow-sm";
            slotEl.innerHTML = `<span class="text-xl">${item.icon || '⚔️'}</span><span class="text-[9px] text-amber-200 mt-0.5 truncate max-w-[50px]">${item.name}</span>`;
            slotEl.title = `${item.name} (คลิกเพื่อถอด)\n${item.desc || ''}`;
        } else {
            slotEl.className = "rpg-slot empty w-14 h-14 rounded-lg flex flex-col items-center justify-center cursor-pointer relative";
            const defaultIcons = { weapon: '🗡️', gloves: '🧤', armor: '🥋', ring: '💍', helm: '👑', necklace: '📿', relic: '🔮', boots: '🥾' };
            const defaultNames = { weapon: 'อาวุธ', gloves: 'ถุงมือ', armor: 'เกราะ', ring: 'แหวน', helm: 'ศีรษะ', necklace: 'สร้อยคอ', relic: 'สมบัติวิเศษ', boots: 'รองเท้า' };
            slotEl.innerHTML = `<span class="text-xl">${defaultIcons[slot]}</span><span class="text-[9px] text-stone-400 mt-0.5">${defaultNames[slot]}</span>`;
            slotEl.title = `ช่องว่าง (${defaultNames[slot]})`;
        }
    });

    // กระเป๋าสัมภาระ (Inventory)
    const bagCountEl = document.getElementById('bag-count');
    if (bagCountEl) bagCountEl.innerText = `${player.inventory ? player.inventory.length : 0}/6`;

    const invGrid = document.getElementById('inventory-grid');
    if (invGrid) {
        invGrid.innerHTML = "";
        for (let i = 0; i < 6; i++) {
            const item = player.inventory?.[i];
            const slotBox = document.createElement('div');
            if (item) {
                slotBox.className = "w-11 h-11 bg-stone-900 border border-amber-700/80 rounded-lg flex items-center justify-center cursor-pointer hover:border-amber-400 hover:scale-105 transition shadow";
                slotBox.innerHTML = `<span class="text-xl">${item.icon || '📦'}</span>`;
                slotBox.title = `${item.name} (${item.slot})\n${item.desc || ''}\nคลิกเพื่อสวมใส่`;
                slotBox.onclick = () => { if (typeof equipItem === 'function') equipItem(i); };
            } else {
                slotBox.className = "w-11 h-11 bg-black/40 border border-stone-800 rounded-lg flex items-center justify-center text-stone-600 text-xs";
                slotBox.innerText = "+";
            }
            invGrid.appendChild(slotBox);
        }
    }
}
