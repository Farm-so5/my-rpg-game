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

const REALM_ICONS = ["🌱", "✨", "🌀", "🟡", "🔮", "⚔️", "🌌", "🪐", "⚡", "👑"];
function getRealmTitle(realm) {
    const titles = [
        "ผู้ไร้วงแหวนเวท (Tier 0)",
        "วงแหวนเวทระดับ 1: นักเวทฝึกหัด (Novice Mage)",
        "วงแหวนเวทระดับ 2: นักเวทประจำกิลด์ (Guild Mage)",
        "วงแหวนเวทระดับ 3: นักเวทชำนาญการ (Adept Mage)",
        "วงแหวนเวทระดับ 4: นักเวทชั้นสูง (High Mage)",
        "วงแหวนเวทระดับ 5: จอมเวทผู้เชี่ยวชาญ (Expert Mage)",
        "วงแหวนเวทระดับ 6: มหาจอมเวทแห่งหอคอย (Tower Archmage)",
        "วงแหวนเวทระดับ 7: ปรมาจารย์มหาเวท (Master Archmage)",
        "วงแหวนเวทระดับ 8: กึ่งเทวะมหาจอมเวท (Demigod Archmage)",
        "วงแหวนเวทระดับ 9: มหาจอมเวทสูงสุดระดับตำนาน (Supreme Archmage)"
    ];
    const icon = REALM_ICONS[realm] || "👑";
    const title = titles[realm] || `มหาจอมเวทวงแหวนที่ ${realm}`;
    return `${icon} ${title}`;
}

// ตรวจสอบว่าผู้เล่นครอบครองมหาคัมภีร์มนตราทวิลักษณ์หรือศาสตร์ผสานทวิธาตุหรือไม่
function hasYinYangEnlightenment(p = player) {
    if (!p) return false;
    if (p.hasYinYangTao) return true;
    if (p.equipment?.relic?.id === 'manual_yin_yang') return true;
    if (p.inventory?.some(i => i && i.id === 'manual_yin_yang')) return true;
    return false;
}

// ระบบคำนวณปฏิกิริยาทวิธาตุและศาสตร์มนตราผสาน (Elemental Magic Resonance)
function getElementResonance(m1, m2, p = player) {
    if (!m1 || !m2 || m1.name === "ไร้พลังเวท" || m2.name === "ไร้พลังเวท") {
        return {
            type: "single",
            name: "👤 มนตราธาตุเดี่ยว",
            atkMod: 1.0,
            defMod: 1.0,
            critBonus: 0,
            evaBonus: 0,
            spdBonus: 0,
            annualStrain: 0,
            annualSuspicion: 0,
            annualExpMod: 1.0,
            badgeClass: "bg-stone-800 text-stone-300 border-stone-600",
            desc: "ใช้พลังเวทมนตร์สายเดียว วงจรมานาเสถียร ไร้ความขัดแย้งและไร้แรงเสริม"
        };
    }

    const e1 = m1.element || 'neutral';
    const e2 = m2.element || 'neutral';
    const d1 = !!m1.isDemonic;
    const d2 = !!m2.isDemonic;
    const hasYY = hasYinYangEnlightenment(p);

    const isPair = (a, b) => (e1 === a && e2 === b) || (e1 === b && e2 === a);

    // 1. ตรวจสอบขั้วขัดแย้งของธาตุ (Elemental Dissonance / Discord)
    let isConflict = false;
    let conflictName = "";
    let conflictDesc = "";

    if (isPair('fire', 'water')) {
        isConflict = true;
        conflictName = "🔥💧 เพลิงผลาญปะทะกระแสน้ำ (Pyro-Hydro Discord)";
        conflictDesc = "ธาตุไฟและน้ำหักล้างกันเอง วงจรมานาปั่นป่วน";
    } else if (isPair('fire', 'ice')) {
        isConflict = true;
        conflictName = "🔥❄️ เพลิงสุริยันปะทะไอเย็นนิรันดร์ (Flame-Frost Clashing)";
        conflictDesc = "ความร้อนและความเย็นจัดปะทะกัน วงจรเวทแตกร้าว";
    } else if ((e1 === 'light' && d2) || (e2 === 'light' && d1)) {
        isConflict = true;
        conflictName = "☀️🖤 มนต์ขาวศักดิ์สิทธิ์ปะทะมนต์ดำ (Holy-Dark Discord)";
        conflictDesc = "แสงศักดิ์สิทธิ์ปฏิเสธพลังมนต์ดำ ร่างกายรับภาระหนักหน่วง";
    }

    // หากเกิดการขัดแย้ง:
    if (isConflict) {
        if (hasYY) {
            // เมื่อมีมหาคัมภีร์มนตราทวิลักษณ์เอกภพ -> แปรเปลี่ยนเป็น Dual Astral Resonance!
            return {
                type: "taiji",
                name: "🌌 มหาเวททวิธาตุประสานเอกภพ (Dual Astral Resonance)",
                atkMod: 1.20,
                defMod: 1.20,
                critBonus: 10,
                evaBonus: 10,
                spdBonus: 15,
                annualStrain: -2,
                annualSuspicion: 0,
                annualExpMod: 1.15,
                badgeClass: "bg-gradient-to-r from-stone-900 via-purple-950 to-stone-900 text-amber-300 border-amber-500 font-bold shadow-[0_0_8px_rgba(245,158,11,0.5)]",
                desc: "มหาคัมภีร์ทวิลักษณ์หลอมรวมสองธาตุที่ขัดแย้งให้อยู่ในสภาวะสมดุลสมบูรณ์แบบ: ATK/DEF +20%, CRIT/EVA +10%, โอเวอร์โหลด -2%/ปี, ตบะเวท +15%"
            };
        } else {
            return {
                type: "conflict",
                name: `⚡ ${conflictName}`,
                atkMod: 0.90,
                defMod: 0.90,
                critBonus: -5,
                evaBonus: -5,
                spdBonus: -10,
                annualStrain: 3,
                annualSuspicion: 0,
                annualExpMod: 0.90,
                badgeClass: "bg-red-950/80 text-red-300 border-red-600 font-semibold",
                desc: `${conflictDesc}: ลดพลังเวท 10%, โอเวอร์โหลด +3%/ปี (แก้ไขได้ด้วยมหาคัมภีร์มนตราทวิลักษณ์เอกภพ)`
            };
        }
    }

    // 2. ตรวจสอบคู่เกื้อหนุนเฉพาะ (Elemental Synergies & Fusions)
    if (isPair('fire', 'wind')) {
        return {
            type: "harmony",
            name: "🔥🌪️ วายุกระพือเพลิงกัลป์ (Gale-Blaze Resonance)",
            atkMod: 1.18,
            defMod: 0.95,
            critBonus: 12,
            evaBonus: 5,
            spdBonus: 10,
            annualStrain: 0,
            annualSuspicion: 0,
            annualExpMod: 1.08,
            badgeClass: "bg-amber-950/80 text-amber-300 border-amber-600 font-semibold",
            desc: "กระแสลมโหมกระพือเวทเพลิง: ATK +18%, CRIT +12%, ตบะเวท +8%"
        };
    }
    if (isPair('water', 'ice')) {
        return {
            type: "harmony",
            name: "❄️💧 มหาเวทธาราน้ำแข็ง (Glacial Tides Fusion)",
            atkMod: 1.05,
            defMod: 1.18,
            critBonus: 5,
            evaBonus: 8,
            spdBonus: 0,
            annualStrain: -2,
            annualSuspicion: 0,
            annualExpMod: 1.05,
            badgeClass: "bg-sky-950/80 text-sky-300 border-sky-600 font-semibold",
            desc: "ไอเย็นผนึกกระแสน้ำเป็นเกราะแก้วมนตรา: DEF +18%, EVA +8%, ลดโอเวอร์โหลด -2%/ปี"
        };
    }
    if (isPair('earth', 'lightning')) {
        return {
            type: "harmony",
            name: "🪨⚡ ปฐพีสื่อประจุอัสนี (Terra-Thunder Conduction)",
            atkMod: 1.12,
            defMod: 1.15,
            critBonus: 8,
            evaBonus: 0,
            spdBonus: 5,
            annualStrain: 0,
            annualSuspicion: 0,
            annualExpMod: 1.05,
            badgeClass: "bg-amber-950/80 text-yellow-300 border-yellow-600 font-semibold",
            desc: "สายฟ้าเหนี่ยวนำเกราะศิลาเวท: DEF +15%, ATK +12%, CRIT +8%"
        };
    }
    if (isPair('wind', 'lightning')) {
        return {
            type: "harmony",
            name: "🌪️⚡ พายุสายฟ้าคลั่ง (Tempest-Lightning Convergence)",
            atkMod: 1.10,
            defMod: 0.95,
            critBonus: 10,
            evaBonus: 15,
            spdBonus: 25,
            annualStrain: 1,
            annualSuspicion: 0,
            annualExpMod: 1.06,
            badgeClass: "bg-purple-950/80 text-cyan-300 border-cyan-600 font-semibold",
            desc: "กระแสลมพาประจุสายฟ้าทะลุห้วงมิติ: SPD +25, EVA +15%, CRIT +10%"
        };
    }
    if (isPair('light', 'neutral') || (e1 === 'light' && !d2 && e2 !== 'none')) {
        return {
            type: "harmony",
            name: "☀️✨ รัศมีมนต์ขาวชะล้างมลทิน (Holy Purity Radiance)",
            atkMod: 1.10,
            defMod: 1.12,
            critBonus: 5,
            evaBonus: 5,
            spdBonus: 5,
            annualStrain: -1,
            annualSuspicion: -2,
            annualExpMod: 1.08,
            badgeClass: "bg-yellow-950/80 text-amber-200 border-amber-400 font-semibold",
            desc: "ละอองเวทศักดิ์สิทธิ์ชะล้างมลทิน: DEF +12%, ATK +10%, ลดการถูกจับตามอง -2/ปี, ลดโอเวอร์โหลด -1%/ปี"
        };
    }
    if (e1 === 'time' || e2 === 'time') {
        return {
            type: "harmony",
            name: "⏳🌌 มหาเวทบิดเบือนกาลอวกาศ (Chrono-Spatial Mastery)",
            atkMod: 1.12,
            defMod: 1.10,
            critBonus: 12,
            evaBonus: 20,
            spdBonus: 30,
            annualStrain: 0,
            annualSuspicion: 0,
            annualExpMod: 1.10,
            badgeClass: "bg-indigo-950/80 text-purple-300 border-purple-500 font-semibold",
            desc: "ควบคุมกระแสกาลเวลาและมิติ: SPD +30, EVA +20%, CRIT +12%, ตบะเวท +10%"
        };
    }
    if (d1 && d2) {
        return {
            type: "harmony",
            name: "🩸🖤 มหาเวททวิมนต์ดำกลืนสวรรค์ (Abyssal Dual Core)",
            atkMod: 1.25,
            defMod: 0.90,
            critBonus: 15,
            evaBonus: 10,
            spdBonus: 10,
            annualStrain: 1,
            annualSuspicion: 3,
            annualExpMod: 1.12,
            badgeClass: "bg-red-950 text-red-400 border-red-700 font-bold",
            desc: "มนต์ดำสองสายหลอมรวม (ดาบสองคม): ATK +25%, CRIT +15%, ตบะเวท +12%, แต่ถูกจับตามอง +3/ปี"
        };
    }
    if (e1 === 'neutral' || e2 === 'neutral') {
        return {
            type: "harmony",
            name: "✨ สอดประสานกระแสมานาบริสุทธิ์ (Pure Mana Harmony)",
            atkMod: 1.08,
            defMod: 1.08,
            critBonus: 4,
            evaBonus: 4,
            spdBonus: 5,
            annualStrain: 0,
            annualSuspicion: 0,
            annualExpMod: 1.05,
            badgeClass: "bg-stone-800 text-emerald-300 border-emerald-600 font-medium",
            desc: "มานาบริสุทธิ์เกื้อหนุนธาตุคู่: ATK +8%, DEF +8%, ตบะเวท +5%"
        };
    }

    // คู่ธาตุทั่วไปที่ไม่ขัดแย้งกัน
    return {
        type: "harmony",
        name: "🌿 เกื้อหนุนทวิธาตุ (Elemental Harmony)",
        atkMod: 1.06,
        defMod: 1.06,
        critBonus: 3,
        evaBonus: 3,
        spdBonus: 5,
        annualStrain: 0,
        annualSuspicion: 0,
        annualExpMod: 1.03,
        badgeClass: "bg-emerald-950/70 text-emerald-300 border-emerald-700 font-medium",
        desc: "ธาตุทั้งสองไหลเวียนในวงจรมานาอย่างราบรื่น: ATK +6%, DEF +6%"
    };
}

function getPlayerResonance(p = player) {
    if (!p) return null;
    const m1 = p.primaryMana || p.manas?.[0] || p.manaObj;
    const m2 = p.secondaryMana || p.manas?.[1] || null;
    return getElementResonance(m1, m2, p);
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

    // กำหนดโครงสร้าง player ตามสเปก v2 ครบทุกฟิลด์ + ทวิพลังมานา
    player = {
        kingdom: chosenKingdom,
        originObj: chosenOrigin,
        manaObj: chosenMana,
        manas: [ chosenMana ],
        primaryMana: chosenMana,
        secondaryMana: null,
        hasYinYangTao: false,
        rankTitle: "จอมเวทพเนจร",
        rankLevel: 0,
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

    addLog(`✨ กำเนิดใหม่ใน <b>${player.kingdom.name}</b> ฐานะ <b>${player.originObj.name}</b>`, "text-amber-300");
    addLog(`🔮 ได้รับพรสวรรค์มานา: <b>${player.manaObj.name}</b> (${player.manaObj.aura})`, "text-purple-300");

    updateUI();
    setSpeed(1);
}

function tryBreakthrough() {
    const balCult = gameData.balance?.cultivation;
    if (!balCult) return;

    const currentReq = getExpToNext(player.realm);
    if (player.exp < currentReq || player.realm >= 9) return;

    // หากอยู่ที่ขั้น 8 กำลังขึ้นขั้น 9 ต้องผ่านบททดสอบมหาเวทสวรรค์
    if (player.realm === 8) {
        const tribulationEvent = gameData.events?.find(e => e.id === "heavenly_tribulation_9");
        if (tribulationEvent && !isModalOpen) {
            addLog(`⚡ บททดสอบมหาเวทสวรรค์ 9 วงแหวนปรากฏสู่เบื้องหน้า! สภาวะมานาแปรปรวนขั้นวิกฤต!`, "text-yellow-400 font-bold");
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

        addLog(`🎉 <b>[อายุ ${player.age} ปี]</b> เบิกวงแหวนเวทสำเร็จ! เลื่อนขั้นสู่ <b>${getRealmTitle(player.realm)}</b>!${lifespanAdd > 0 ? ` (อายุขัย +${lifespanAdd} ปี)` : ''}`, "text-cyan-300 font-bold");
    } else {
        const failStrain = balCult.breakthroughFailStrain ?? 15;
        const failDamage = Math.round(player.maxHp * (balCult.breakthroughFailHpDamagePct ?? 0.20));
        player.strain = Math.min(100, player.strain + failStrain);
        player.hp = Math.max(0, player.hp - failDamage);
        player.exp = Math.round(player.exp * 0.7); // สูญเสียมานาบางส่วน

        addLog(`⚠️ <b>[อายุ ${player.age} ปี]</b> ร่ายมนตร์เลื่อนขั้นล้มเหลว! มานาโอเวอร์โหลด บาดเจ็บ ${failDamage} จุด โอเวอร์โหลด +${failStrain}%`, "text-orange-400");
        if (player.strain >= 100) return die("สภาวะมานาโอเวอร์โหลดรุนแรง แก่นเวทและวงจรมานาระเบิดดับสูญ!");
        if (player.hp <= 0) return die("ได้รับบาดเจ็บสาหัสจากกระแสมานาแปรปรวนจนสิ้นใจ");
    }
}

function ageUp() {
    if (!player.isAlive || isModalOpen) return;

    player.age += 1;

    // 1. ตรวจสอบเงื่อนไขการเสียชีวิต
    if (player.age >= player.maxAge) {
        if (player.realm >= 8) return die("มหาจอมเวทสูงสุดคืนพลังสู่ห้วงมหาเอกภพ สิ้นอายุขัยอย่างสงบ");
        if (player.realm >= 4) return die("จอมเวทชั้นสูงหมดสิ้นอายุขัย ละสังขารไปอย่างสงบ");
        return die("สิ้นอายุขัยตามกฎแห่งธรรมชาติและกาลเวลา");
    }
    if (player.hp <= 0) return die("บาดเจ็บสาหัส บาดแผลจากเวทมนตร์กำเริบจนสิ้นลมหายใจ");
    if (player.strain >= 100) {
        if (player.manaObj?.isDemonic) return die("พลังเวทมนต์ดำตีกลับ วงจรมานาโอเวอร์โหลด ร่างกายแหลกสลาย!");
        if (player.manaObj?.name && !player.manaObj.name.includes("ไร้พลัง")) {
            return die(`วงจรมานาโอเวอร์โหลด กระแสเวท${player.manaObj.name}ฉีกขาด แก่นเวทแตกสลาย!`);
        }
        return die("วงจรมานาโอเวอร์โหลด แก่นเวทแตกสลาย ร่างกายแหลกสลาย!");
    }
    if (player.suspicion >= 100) {
        if (player.kingdom?.name?.includes("ศักดิ์สิทธิ์")) return die("ถูกศาลศาสนจักรศักดิ์สิทธิ์ไต่สวนความผิดฐานใช้นอกรีตและประหารบนลานศักดิ์สิทธิ์!");
        if (player.kingdom?.name?.includes("อัศวิน")) return die("ถูกกองอัศวินเวทมนตร์โต๊ะกลมปิดล้อมและตัดศีรษะในสนามรบ!");
        return die("ถูกกองทัพศาสนจักรและผู้คุมกฎแห่งสภาเวทมนตร์ล้อมสังหาร!");
    }

    // ผลกระทบประจำปีจากปฏิกิริยาทวิพลัง (Resonance Annual Effects)
    const res = getPlayerResonance(player);
    if (res) {
        if (res.annualStrain) {
            player.strain = Math.max(0, Math.min(100, player.strain + res.annualStrain));
        }
        if (res.annualSuspicion) {
            player.suspicion = Math.max(0, Math.min(100, player.suspicion + res.annualSuspicion));
        }
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

        addLog(`🌿 <b>[อายุ ${player.age} ปี]</b> พักฟื้นวงจรมานา (โอเวอร์โหลด -${balRest.strainRecovery}%, ฟื้นฟูพลังกายและมานา)`, "text-emerald-400");
    } else {
        player.resting = false;

        // ผู้ใช้มานามารจะถูกเพ่งเล็งสะสมในแต่ละปี
        if (player.manaObj?.isDemonic || (player.manas && player.manas.some(m => m.isDemonic))) {
            const suspMod = player.kingdom?.suspMod ?? 1.0;
            const suspGain = Math.round((balSusp.demonicBaseAnnualGain || 5) * suspMod);
            player.suspicion = Math.min(100, player.suspicion + suspGain);
        }

        // เก็บเกี่ยวค่าประสบการณ์ โดยสเกลตามขั้นพลัง และผลเกื้อหนุนของทวิพลัง
        const realmScale = 1 + (typeof plv === 'function' ? plv(player) : player.realm) * (balCult.realmExpMultiplier || 0.35);
        let expGain = Math.round(((balCult.baseTrainExp || 25) + player.spr * (balCult.sprExpMod || 1.2)) * realmScale);
        if (res && res.annualExpMod) {
            expGain = Math.round(expGain * res.annualExpMod);
        }
        player.exp += expGain;
        player.strain = Math.min(100, player.strain + (balCult.trainStrainGain || 3));

        // สุ่มรายได้รายปี
        const minGold = bal.economy?.annualGoldMin ?? 5;
        const maxGold = bal.economy?.annualGoldMax ?? 25;
        const earned = Math.floor(Math.random() * (maxGold - minGold + 1)) + minGold;
        player.gold += earned;

        addLog(`🧙 <b>[อายุ ${player.age} ปี]</b> ค้นคว้าและร่ายมนตร์ฝึกฝน (ได้ exp +${expGain}, ทอง +${earned})`, "text-stone-400");

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
        statusEl.innerText = "รอการกำเนิดใหม่";
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

    setTxt('p-origin', `${player.originObj.avatar || '📜'} ${player.originObj.name}`);
    setTxt('p-kingdom', `${player.kingdom.icon || '🏰'} ${player.kingdom.name}`);
    setTxt('p-mana-type', `${player.manaObj.icon || '🔮'} ${player.manaObj.name}`);
    setTxt('p-age', player.age);
    setTxt('p-max-age', player.maxAge);
    setTxt('p-realm', `${getRealmTitle(player.realm)} [PLv: ${plv(player)}]`);
    setTxt('stat-gold', player.gold);
    setTxt('stat-strain', player.strain);
    setTxt('stat-suspicion', player.suspicion);
    setTxt('combat-luck', player.luck);

    // สถานะพักฟื้น / ฝึกฝน
    const statusEl = document.getElementById('game-status');
    if (statusEl && player.isAlive) {
        if (player.resting) {
            statusEl.innerText = "🌿 พักฟื้นวงจรมานา";
            statusEl.className = "text-xs px-2.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700 rounded-full";
        } else {
            statusEl.innerText = "🧙 ค้นคว้าเวทมนตร์";
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

    // ทวิพลังมานา (Dual-Mana Slots & Resonance)
    if (!player.manas) {
        player.manas = [ player.manaObj ];
        player.primaryMana = player.manaObj;
        player.secondaryMana = null;
    }
    const m1 = player.manas[0] || player.manaObj;
    const m2 = player.manas[1] || null;
    const res = getPlayerResonance(player);

    setTxt('p-mana-slot-1', `${m1.icon || '🔮'} ${m1.name}`);
    const slot2El = document.getElementById('p-mana-slot-2');
    if (slot2El) {
        if (m2) {
            slot2El.innerText = `${m2.icon || '🔮'} ${m2.name}`;
            slot2El.className = "px-2 py-0.5 rounded bg-purple-900/50 border border-purple-600/60 text-purple-200 text-xs font-semibold";
            slot2El.title = `พลังรอง: ${m2.name}`;
        } else {
            slot2El.innerText = "— ว่างเปล่า —";
            slot2El.className = "px-2 py-0.5 rounded bg-stone-900/70 border border-stone-700/60 text-stone-400 text-xs font-medium";
            slot2El.title = "ช่องพลังรองว่าง (สามารถรับพลังเพิ่มได้)";
        }
    }
    const resEl = document.getElementById('p-mana-resonance');
    if (resEl && res) {
        resEl.innerText = res.name;
        resEl.className = `text-[11px] px-2 py-0.5 rounded-full border ${res.badgeClass}`;
        resEl.title = res.desc;
    }
    setTxt('p-mana-type', `${m1.icon || '🔮'} ${m1.name}${m2 ? ` + ${m2.icon || '🔮'} ${m2.name}` : ''}`);

    // อัปเดตรูปประจำตัวพิกเซล (Pixel Art Portrait Selection)
    const avatarImg = document.getElementById('avatar-img');
    if (avatarImg) {
        let avatarSrc = "assets/avatars/cultivator.jpg";
        if (player.manaObj?.isDemonic || player.originObj?.name?.includes("จอมมาร") || (m2 && m2.isDemonic)) {
            avatarSrc = "assets/avatars/demonic.jpg";
        } else if (player.kingdom?.name?.includes("ศักดิ์สิทธิ์") || player.manaObj?.element === 'light' || (m2 && m2.element === 'light')) {
            avatarSrc = "assets/avatars/mage.jpg";
        }
        if (!avatarImg.src || (avatarImg.src !== avatarSrc && !avatarImg.src.endsWith(avatarSrc))) {
            avatarImg.src = avatarSrc;
        }
        avatarImg.classList.remove('hidden');
    }
    setTxt('avatar-title', `${getRealmTitle(player.realm)} · ${player.rankTitle || 'จอมเวทพเนจร'}`);
    setTxt('avatar-aura', `${player.manaObj.aura || 'ออร่า'}${res && res.type === 'taiji' ? ' · ทวิลักษณ์เอกภพ' : ''}`);

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
            const defaultNames = { weapon: 'อาวุธ', gloves: 'ถุงมือ', armor: 'ชุดเกราะ', ring: 'แหวนมนตรา', helm: 'ศีรษะ', necklace: 'สร้อยคอ', relic: 'วัตถุเวท/คัมภีร์', boots: 'รองเท้า' };
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

// ระบบจัดเก็บและสลับรูปแบบพลังเวท (Dual-Mana Management)
function acquireNewMana(newMana) {
    if (!player || !player.isAlive || !newMana) return;

    if (!player.manas) {
        player.manas = [ player.manaObj ];
        player.primaryMana = player.manaObj;
        player.secondaryMana = null;
    }

    // หากมีพลังเดิมชนิดนี้อยู่แล้ว
    if (player.manas.some(m => m.name === newMana.name)) {
        addLog(`🔮 ท่านมีความรู้แจ้งในศาสตร์ <b>${newMana.name}</b> อยู่แล้ว กระแสมานาได้รับการขัดเกลาหนุนเนื่อง`, "text-purple-300");
        return;
    }

    // กรณีที่ 1: ยังมีพลังไม่ครบ 2 ช่อง -> สามารถรับเป็นพลังรองได้ทันที
    if (player.manas.length < 2) {
        player.manas.push(newMana);
        player.secondaryMana = newMana;
        const res = getPlayerResonance(player);
        addLog(`🔮 <b>[อายุ ${player.age} ปี]</b> โชคชะตาเปิดทาง! บรรลุศาสตร์มนตราธาตุที่สอง: <b>${newMana.name}</b>!`, "text-cyan-300 font-bold");
        addLog(`⚡ เกิดปฏิกิริยาทวิมนตรา: <b>${res.name}</b> (${res.desc})`, res.type === 'conflict' ? 'text-rose-400 font-bold' : 'text-emerald-300');
        updateUI();
        return;
    }

    // กรณีที่ 2: มีครบ 2 พลังแล้ว
    // หากอยู่ใน headless mode (simulation) ให้ตัดสินใจอัตโนมัติ
    if (typeof window === 'undefined' || !document.getElementById('mana-modal')) {
        const currentRes = getPlayerResonance(player);
        const resWithSlot1Replaced = getElementResonance(newMana, player.manas[1], player);
        const resWithSlot2Replaced = getElementResonance(player.manas[0], newMana, player);

        // ถ้าของใหม่ให้ Taiji หรือทำให้แก้ conflict ได้ ให้แทนที่
        if (resWithSlot1Replaced.type === 'taiji' || (currentRes.type === 'conflict' && resWithSlot1Replaced.type !== 'conflict')) {
            player.manas[0] = newMana;
            player.primaryMana = newMana;
            player.manaObj = newMana;
        } else if (resWithSlot2Replaced.type === 'taiji' || (currentRes.type === 'conflict' && resWithSlot2Replaced.type !== 'conflict')) {
            player.manas[1] = newMana;
            player.secondaryMana = newMana;
        }
        return;
    }

    // ใน Browser: เปิด Modal ให้ผู้เล่นเลือกอย่างชัดเจน
    openManaChoiceModal(newMana);
}

function openManaChoiceModal(newMana) {
    const modal = document.getElementById('mana-modal');
    const titleEl = document.getElementById('mana-modal-title');
    const choicesEl = document.getElementById('mana-modal-choices');
    if (!modal || !choicesEl) return;

    isModalOpen = true;
    titleEl.innerHTML = `✨ ค้นพบศาสตร์มนตราธาตุใหม่: <span class="text-purple-300">${newMana.icon || '🔮'} ${newMana.name}</span>`;

    const m1 = player.manas[0];
    const m2 = player.manas[1];

    const resKeep = getPlayerResonance(player);
    const resReplace1 = getElementResonance(newMana, m2, player);
    const resReplace2 = getElementResonance(m1, newMana, player);

    choicesEl.innerHTML = "";

    // ตัวเลือกที่ 1: ไม่รับพลังใหม่
    const btn1 = document.createElement('button');
    btn1.className = "w-full text-left p-3 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-stone-700 transition flex flex-col gap-1";
    btn1.innerHTML = `
        <div class="flex items-center justify-between">
            <span class="font-bold text-stone-200">🛡️ สละศาสตร์เวทใหม่ (รักษาศาสตร์เดิมทั้งสองไว้)</span>
            <span class="text-[11px] px-2 py-0.5 rounded border ${resKeep.badgeClass}">${resKeep.name}</span>
        </div>
        <p class="text-xs text-stone-400">รักษา <b>${m1.name}</b> + <b>${m2.name}</b> ต่อไป</p>
    `;
    btn1.onclick = () => {
        addLog(`🔮 สละโอกาสหลอมรวม <b>${newMana.name}</b> เพื่อรักษาสมดุลวงจรมานาเดิม`, "text-stone-400");
        closeManaModal();
    };
    choicesEl.appendChild(btn1);

    // ตัวเลือกที่ 2: แทนที่พลังหลัก (Slot 1)
    const btn2 = document.createElement('button');
    btn2.className = "w-full text-left p-3 rounded-xl bg-stone-900/90 hover:bg-purple-950/60 border border-purple-700/80 transition flex flex-col gap-1";
    btn2.innerHTML = `
        <div class="flex items-center justify-between">
            <span class="font-bold text-amber-300">🔄 แทนที่ศาสตร์เวทหลัก: ${m1.name} ➔ ${newMana.name}</span>
            <span class="text-[11px] px-2 py-0.5 rounded border ${resReplace1.badgeClass}">${resReplace1.name}</span>
        </div>
        <p class="text-xs text-stone-300">ศาสตร์เวทใหม่กลายเป็นพลังหลัก คู่กับ <b>${m2.name}</b> (${resReplace1.desc})</p>
    `;
    btn2.onclick = () => {
        player.manas[0] = newMana;
        player.primaryMana = newMana;
        player.manaObj = newMana;
        addLog(`🔮 สละ <b>${m1.name}</b> และสลัก <b>${newMana.name}</b> เข้าสู่วงจรมานาหลัก!`, "text-cyan-300 font-bold");
        addLog(`⚡ ปฏิกิริยามนตราใหม่: <b>${resReplace1.name}</b> (${resReplace1.desc})`, resReplace1.type === 'conflict' ? 'text-rose-400 font-bold' : 'text-emerald-300');
        closeManaModal();
    };
    choicesEl.appendChild(btn2);

    // ตัวเลือกที่ 3: แทนที่พลังรอง (Slot 2)
    const btn3 = document.createElement('button');
    btn3.className = "w-full text-left p-3 rounded-xl bg-stone-900/90 hover:bg-purple-950/60 border border-purple-700/80 transition flex flex-col gap-1";
    btn3.innerHTML = `
        <div class="flex items-center justify-between">
            <span class="font-bold text-amber-300">🔄 แทนที่ศาสตร์เวทรอง: ${m2.name} ➔ ${newMana.name}</span>
            <span class="text-[11px] px-2 py-0.5 rounded border ${resReplace2.badgeClass}">${resReplace2.name}</span>
        </div>
        <p class="text-xs text-stone-300">ศาสตร์เวทหลักคงเดิมคือ <b>${m1.name}</b> คู่กับศาสตร์เวทรองใหม่ <b>${newMana.name}</b> (${resReplace2.desc})</p>
    `;
    btn3.onclick = () => {
        player.manas[1] = newMana;
        player.secondaryMana = newMana;
        addLog(`🔮 สละ <b>${m2.name}</b> และสลัก <b>${newMana.name}</b> เข้าสู่วงจรมานารอง!`, "text-cyan-300 font-bold");
        addLog(`⚡ ปฏิกิริยามนตราใหม่: <b>${resReplace2.name}</b> (${resReplace2.desc})`, resReplace2.type === 'conflict' ? 'text-rose-400 font-bold' : 'text-emerald-300');
        closeManaModal();
    };
    choicesEl.appendChild(btn3);

    modal.classList.remove('hidden');
}

function closeManaModal() {
    isModalOpen = false;
    document.getElementById('mana-modal')?.classList.add('hidden');
    updateUI();
}

