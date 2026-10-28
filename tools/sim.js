#!/usr/bin/env node
/**
 * tools/sim.js
 * สคริปต์จำลองชีวิตตัวละครนับร้อยนับพันรอบ (Headless Life Simulator)
 * 
 * คุณสมบัติ:
 * 1. รันเกมผ่าน Node.js แบบไร้หน้าจอ (Headless DOM Sandbox)
 * 2. จำลองการใช้ชีวิตทีละปี พร้อมระบบตัดสินใจใน Event (Choice AI)
 * 3. วิเคราะห์สถิติเชิงลึก:
 *    - อายุขัย & อัตราการตายในวัยเยาว์ (<15 ปี)
 *    - สาเหตุการตาย (แก่ตาย, บาดเจ็บ, ชีพจรระเบิด, โดนศาสนจักรล่า)
 *    - การกระจายของขอบเขตพลัง Realm 0-9 (ตรวจเป้าหมายขั้น 9 < 1%)
 *    - วิเคราะห์เจาะลึกรายชาติกำเนิด (Origins), มานา (Manas), อาณาจักร (Kingdoms)
 *    - ตรวจสอบ Event Analytics (เหตุการณ์ที่เกิดบ่อยสุด vs เหตุการณ์ที่ไม่เคยเกิดเลย)
 *    - เศรษฐกิจและทรัพย์สิน (ทอง, ไอเทม)
 * 4. รองรับการ Export เป็นไฟล์ JSON เพื่อนำไปพล็อตวิเคราะห์ต่อได้
 * 
 * ใช้งาน:
 *   node tools/sim.js 2000
 *   node tools/sim.js 5000 --export
 *   node tools/sim.js 1000 --export=my_test.json
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const JS_DIR = path.join(ROOT_DIR, 'js');

// Parse CLI Arguments
const args = process.argv.slice(2);
let numLives = 1000;
let exportFile = null;
let isVerbose = false;

args.forEach(arg => {
    if (/^\d+$/.test(arg)) {
        numLives = parseInt(arg, 10);
    } else if (arg.startsWith('--export')) {
        if (arg.includes('=')) {
            exportFile = arg.split('=')[1];
        } else {
            exportFile = path.join(__dirname, 'sim_report.json');
        }
    } else if (arg === '--verbose' || arg === '-v') {
        isVerbose = true;
    }
});

// ANSI Colors
const c = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    gray: "\x1b[90m"
};

// -------------------------------------------------------------
// 1. สร้าง Headless Sandbox จำลอง Browser & DOM
// -------------------------------------------------------------
const mockElements = {};
function createMockElement(tag = 'div') {
    return {
        tagName: tag.toUpperCase(),
        innerText: '',
        innerHTML: '',
        className: '',
        style: {},
        classList: {
            add() {},
            remove() {},
            contains() { return false; },
            toggle() {}
        },
        appendChild() {},
        removeChild() {}
    };
}

const sandbox = {
    console: {
        log: () => {},
        warn: () => {},
        error: (msg) => { if (isVerbose) console.error(msg); }
    },
    Math,
    JSON,
    Set,
    Array,
    Object,
    Date,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    alert: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    window: {},
    localStorage: {
        _store: {},
        getItem(k) { return this._store[k] ?? null; },
        setItem(k, v) { this._store[k] = String(v); },
        removeItem(k) { delete this._store[k]; },
        clear() { this._store = {}; }
    },
    document: {
        getElementById: (id) => {
            if (!mockElements[id]) mockElements[id] = createMockElement();
            return mockElements[id];
        },
        createElement: createMockElement
    }
};

const context = vm.createContext(sandbox);

// -------------------------------------------------------------
// 2. โหลดโค้ดเกม JS และข้อมูล JSON
// -------------------------------------------------------------
const jsFiles = ['main.js', 'engine.js', 'combat.js', 'events.js', 'saveLoad.js'];
jsFiles.forEach(file => {
    const fullPath = path.join(JS_DIR, file);
    if (fs.existsSync(fullPath)) {
        const code = fs.readFileSync(fullPath, 'utf8');
        vm.runInContext(code, context, { filename: file });
    }
});

// โหลดไฟล์ JSON
const readJSON = (rel) => {
    const p = path.join(DATA_DIR, rel);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
};

const kingdoms = readJSON('kingdoms.json');
const origins = readJSON('origins.json');
const manas = readJSON('manas.json');
const items = readJSON('items.json');
const balance = readJSON('balance.json');

// รวบรวม events จากโฟลเดอร์ data/events/*.json
let allEvents = [];
const eventsDir = path.join(DATA_DIR, 'events');
if (fs.existsSync(eventsDir)) {
    fs.readdirSync(eventsDir).filter(f => f.endsWith('.json')).forEach(f => {
        const evs = readJSON(path.join('events', f));
        if (Array.isArray(evs)) allEvents.push(...evs);
    });
}

// อัปเดตข้อมูลเข้า gameData ของ sandbox
vm.runInContext(`
    gameData.kingdoms = ${JSON.stringify(kingdoms)};
    gameData.origins = ${JSON.stringify(origins)};
    gameData.manas = ${JSON.stringify(manas)};
    gameData.items = ${JSON.stringify(items)};
    gameData.balance = ${JSON.stringify(balance)};
    gameData.events = ${JSON.stringify(allEvents)};
`, context);

// -------------------------------------------------------------
// 3. ฟังก์ชันจำลองการตัดสินใจของผู้เล่น (Choice AI)
// -------------------------------------------------------------
function evaluateCondition(cond, player) {
    if (!cond || !cond.stat) return true;
    let val = player[cond.stat];
    if (cond.stat === 'power') val = (player.realm || 0) * 100 + (player.exp || 0);
    if (cond.stat === 'demonic') val = player.manaObj?.isDemonic ? 1 : 0;
    if (cond.stat === 'expToNext') val = ((player.realm || 0) + 1) * 100 - (player.exp || 0);
    if (cond.stat.startsWith('event:')) {
        const evId = cond.stat.substring(6);
        val = (player.eventLast && player.eventLast[evId] !== undefined) ? 1 : 0;
    }
    if (cond.stat.startsWith('hasItem:')) {
        const itemId = cond.stat.substring(8);
        const inInv = player.inventory?.some(i => i.id === itemId || i === itemId);
        const inEq = Object.values(player.equipment || {}).some(i => i && (i.id === itemId || i === itemId));
        val = (inInv || inEq) ? 1 : 0;
    }

    const target = cond.value ?? 0;
    const op = cond.op || '>=';
    switch (op) {
        case '>=': return val >= target;
        case '<=': return val <= target;
        case '>': return val > target;
        case '<': return val < target;
        case '==': return val == target;
        case '!=': return val != target;
        default: return true;
    }
}

function applyEffects(effects, player) {
    if (!Array.isArray(effects)) return;
    effects.forEach(eff => {
        if (eff.op === 'add' && eff.stat) {
            player[eff.stat] = (player[eff.stat] || 0) + (eff.value || 0);
        } else if (eff.op === 'set' && eff.stat) {
            player[eff.stat] = eff.value;
        } else if (eff.op === 'hurt') {
            const dmg = eff.pct ? Math.round(player.maxHp * eff.pct) : (eff.value || 0);
            player.hp = Math.max(0, player.hp - dmg);
        } else if (eff.op === 'give' && eff.item) {
            const itemObj = items.find(i => i.id === eff.item);
            if (itemObj && (!player.inventory || player.inventory.length < 6)) {
                if (!player.inventory) player.inventory = [];
                player.inventory.push(itemObj);
            }
        } else if (eff.op === 'equip' && eff.item) {
            const itemObj = items.find(i => i.id === eff.item);
            if (itemObj && itemObj.slot) {
                if (!player.equipment) player.equipment = {};
                player.equipment[itemObj.slot] = itemObj;
            }
        } else if (eff.op === 'die') {
            player.isAlive = false;
            player.deathReason = eff.reason || "สิ้นชีพกะทันหัน";
        }
    });
}

function handleEventDecision(player, currentModalEvent, eventStats) {
    if (!currentModalEvent || !currentModalEvent.choices || currentModalEvent.choices.length === 0) {
        return;
    }

    const eventId = currentModalEvent.id || 'unknown';
    eventStats.triggeredCounts[eventId] = (eventStats.triggeredCounts[eventId] || 0) + 1;

    // บันทึกประวัติการเกิดเหตุการณ์
    if (!player.eventLast) player.eventLast = {};
    player.eventLast[eventId] = player.age || 1;

    // กรองชอยส์ที่เงื่อนไขผ่าน
    const availableChoices = currentModalEvent.choices.filter(ch => {
        if (!ch.if || !Array.isArray(ch.if)) return true;
        return ch.if.every(cond => evaluateCondition(cond, player));
    });

    const chosen = availableChoices.length > 0
        ? availableChoices[Math.floor(Math.random() * availableChoices.length)]
        : currentModalEvent.choices[0];

    // ประมวลผล Roll
    if (chosen.roll) {
        const chance = chosen.roll.chance || {};
        const base = chance.base ?? 0.5;
        const luckBonus = (chance.luck ?? 0.002) * (player.luck || 50);
        const powerBonus = (chance.power ?? 0.02) * (player.realm || 1);
        const finalChance = Math.min(0.95, Math.max(0.05, base + luckBonus + powerBonus));

        if (Math.random() < finalChance) {
            applyEffects(chosen.roll.success, player);
        } else {
            applyEffects(chosen.roll.fail, player);
        }
    }

    // ประมวลผล Effects โดยตรง
    if (chosen.effects) {
        applyEffects(chosen.effects, player);
    }
}

// -------------------------------------------------------------
// 4. เริ่มต้นการจำลอง (Simulation Loop)
// -------------------------------------------------------------
console.log(`\n${c.bold}${c.cyan}================================================================${c.reset}`);
console.log(`${c.bold}${c.cyan} 🔮 Chronicles of Reincarnation: Deep Life Simulation${c.reset}`);
console.log(`${c.bold}${c.cyan}================================================================${c.reset}`);
console.log(`- จำนวนชีวิตที่จะจำลอง: ${c.bold}${c.yellow}${numLives.toLocaleString()}${c.reset} ชีวิต`);
console.log(`- กำลังเตรียมสภาพแวดล้อมและประมวลผล...\n`);

const startTime = Date.now();

// โครงสร้างเก็บสถิติ
const stats = {
    totalLives: numLives,
    errors: {},
    ages: [],
    deathReasons: {},
    realms: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
    origins: {},
    manas: {},
    kingdoms: {},
    goldAtDeath: [],
    eventStats: {
        totalTriggered: 0,
        triggeredCounts: {}
    }
};

// เตรียม registry สำหรับ origins / manas / kingdoms
origins.forEach(o => {
    stats.origins[o.name] = { count: 0, totalAge: 0, totalRealm: 0, deaths: {}, totalGold: 0 };
});
manas.forEach(m => {
    stats.manas[m.name] = { count: 0, totalAge: 0, totalRealm: 0, deaths: {}, suspicionDeaths: 0, strainDeaths: 0 };
});
kingdoms.forEach(k => {
    stats.kingdoms[k.name] = { count: 0, totalAge: 0, deaths: {}, suspicionDeaths: 0 };
});

for (let i = 0; i < numLives; i++) {
    try {
        // เริ่มชีวิตใหม่
        vm.runInContext('startGame();', context);
        let yearsLived = 0;

        while (yearsLived < 800) {
            const isAlive = vm.runInContext('player.isAlive', context);
            if (!isAlive) break;

            const isModalOpen = vm.runInContext('isModalOpen', context);
            if (isModalOpen) {
                stats.eventStats.totalTriggered++;
                const playerObj = vm.runInContext('player', context);

                // ดึงอีเวนต์ล่าสุดจาก modal
                const modalTitle = mockElements['modal-title']?.innerText || '';
                const evObj = allEvents.find(e => e.title === modalTitle) || allEvents[0];

                handleEventDecision(playerObj, evObj, stats.eventStats);

                // บันทึก player กลับและปิด modal
                vm.runInContext(`
                    player = Object.assign(player, ${JSON.stringify(playerObj)});
                    closeModal();
                `, context);
            }

            // เพิ่มอายุ
            vm.runInContext('ageUp();', context);
            yearsLived++;
        }

        const p = vm.runInContext('player', context);
        if (yearsLived >= 800) {
            stats.errors['เกิน 800 ปี (Infinite Loop/ไม่ตาย)'] = (stats.errors['เกิน 800 ปี (Infinite Loop/ไม่ตาย)'] || 0) + 1;
            continue;
        }

        // ดึงสาเหตุการตาย
        const logHtml = mockElements['log-content']?.innerHTML || '';
        const deathMatch = logHtml.match(/💀 <b>\[อายุ \d+ ปี\]<\/b> ([^<]+)<\/p>/);
        const reason = p.deathReason || (deathMatch ? deathMatch[1].trim() : 'ไม่ทราบสาเหตุ');

        // บันทึกสถิติ
        stats.ages.push(p.age);
        stats.deathReasons[reason] = (stats.deathReasons[reason] || 0) + 1;
        stats.realms[p.realm] = (stats.realms[p.realm] || 0) + 1;
        stats.goldAtDeath.push(p.gold || 0);

        // สถิติตาม Origin
        const oName = p.originObj?.name || 'ไม่ระบุ';
        if (stats.origins[oName]) {
            stats.origins[oName].count++;
            stats.origins[oName].totalAge += p.age;
            stats.origins[oName].totalRealm += p.realm;
            stats.origins[oName].totalGold += p.gold || 0;
            stats.origins[oName].deaths[reason] = (stats.origins[oName].deaths[reason] || 0) + 1;
        }

        // สถิติตาม Mana
        const mName = p.manaObj?.name || 'ไม่ระบุ';
        if (stats.manas[mName]) {
            stats.manas[mName].count++;
            stats.manas[mName].totalAge += p.age;
            stats.manas[mName].totalRealm += p.realm;
            stats.manas[mName].deaths[reason] = (stats.manas[mName].deaths[reason] || 0) + 1;
            if (reason.includes('ศาสนจักร') || reason.includes('สังหาร')) stats.manas[mName].suspicionDeaths++;
            if (reason.includes('ชีพจร') || reason.includes('บอบช้ำ')) stats.manas[mName].strainDeaths++;
        }

        // สถิติตาม Kingdom
        const kName = p.kingdom?.name || 'ไม่ระบุ';
        if (stats.kingdoms[kName]) {
            stats.kingdoms[kName].count++;
            stats.kingdoms[kName].totalAge += p.age;
            stats.kingdoms[kName].deaths[reason] = (stats.kingdoms[kName].deaths[reason] || 0) + 1;
            if (reason.includes('ศาสนจักร') || reason.includes('สังหาร')) stats.kingdoms[kName].suspicionDeaths++;
        }

    } catch (err) {
        const errMsg = err.message.split('\n')[0];
        stats.errors[errMsg] = (stats.errors[errMsg] || 0) + 1;
    }
}

const elapsedMs = Date.now() - startTime;
stats.ages.sort((a, b) => a - b);
stats.goldAtDeath.sort((a, b) => a - b);

// คำนวณค่าทางสถิติ
const totalSimulated = stats.ages.length;
const minAge = stats.ages[0] || 0;
const maxAge = stats.ages[stats.ages.length - 1] || 0;
const medianAge = stats.ages[Math.floor(stats.ages.length / 2)] || 0;
const avgAge = totalSimulated > 0 ? (stats.ages.reduce((a, b) => a + b, 0) / totalSimulated).toFixed(1) : 0;

// Age Brackets
const bracketInfant = stats.ages.filter(a => a < 15).length;
const bracketYouth = stats.ages.filter(a => a >= 15 && a <= 30).length;
const bracketMid = stats.ages.filter(a => a > 30 && a <= 60).length;
const bracketElder = stats.ages.filter(a => a > 60 && a < 100).length;
const bracketCent = stats.ages.filter(a => a >= 100).length;

const pct = (n) => totalSimulated > 0 ? ((n / totalSimulated) * 100).toFixed(1) + '%' : '0%';

// -------------------------------------------------------------
// 5. แสดงผล Dashboard รายงานสถิติ
// -------------------------------------------------------------
console.log(`${c.bold}${c.green}✔ จำลองครบ ${totalSimulated.toLocaleString()} ชีวิตสำเร็จ ในเวลา ${(elapsedMs / 1000).toFixed(2)} วินาที${c.reset}\n`);

// 5.1 สรุปอายุขัย
console.log(`${c.bold}${c.yellow}┌───────────────────────────────────────────────────────────────┐${c.reset}`);
console.log(`${c.bold}${c.yellow}│ ⏳ 1. สรุปอายุขัย & การรอดชีวิต (Lifespan Analytics)          │${c.reset}`);
console.log(`${c.bold}${c.yellow}└───────────────────────────────────────────────────────────────┘${c.reset}`);
console.log(`  - อายุขัยเฉลี่ย (Average): ${c.bold}${avgAge}${c.reset} ปี  |  มัธยฐาน (Median): ${c.bold}${medianAge}${c.reset} ปี`);
console.log(`  - อายุสั้นสุด: ${minAge} ปี  |  อายุยืนยาวสุด: ${maxAge} ปี`);
console.log(`  - การกระจายตามช่วงอายุ:`);
console.log(`    • ${c.red}ตายในวัยเยาว์ (< 15 ปี):${c.reset}  ${bracketInfant.toString().padStart(6)} ชีวิต (${pct(bracketInfant)}) ${bracketInfant / totalSimulated > 0.2 ? c.red + '[สูงเกินไป!]' + c.reset : ''}`);
console.log(`    • วัยหนุ่มสาว (15 - 30 ปี):   ${bracketYouth.toString().padStart(6)} ชีวิต (${pct(bracketYouth)})`);
console.log(`    • วัยกลางคน (31 - 60 ปี):    ${bracketMid.toString().padStart(6)} ชีวิต (${pct(bracketMid)})`);
console.log(`    • วัยชรา (61 - 99 ปี):       ${bracketElder.toString().padStart(6)} ชีวิต (${pct(bracketElder)})`);
console.log(`    • ยืนยาวร้อยปี (100+ ปี):    ${bracketCent.toString().padStart(6)} ชีวิต (${pct(bracketCent)})`);

// 5.2 สาเหตุการตาย
console.log(`\n${c.bold}${c.red}┌───────────────────────────────────────────────────────────────┐${c.reset}`);
console.log(`${c.bold}${c.red}│ 💀 2. สาเหตุการตาย (Cause of Death Breakdown)                 │${c.reset}`);
console.log(`${c.bold}${c.red}└───────────────────────────────────────────────────────────────┘${c.reset}`);
Object.entries(stats.deathReasons)
    .sort((a, b) => b[1] - a[1])
    .forEach(([reason, cnt]) => {
        const bar = '█'.repeat(Math.round((cnt / totalSimulated) * 30));
        console.log(`  - ${reason.padEnd(26)} : ${cnt.toString().padStart(6)} (${pct(cnt).padStart(6)})  ${c.red}${bar}${c.reset}`);
    });

// 5.3 ขอบเขตพลัง Realm 0-9
console.log(`\n${c.bold}${c.cyan}┌───────────────────────────────────────────────────────────────┐${c.reset}`);
console.log(`${c.bold}${c.cyan}│ ⚡ 3. ขอบเขตพลัง (Cultivation Realm Distribution)              │${c.reset}`);
console.log(`${c.bold}${c.cyan}└───────────────────────────────────────────────────────────────┘${c.reset}`);
for (let r = 0; r <= 9; r++) {
    const cnt = stats.realms[r] || 0;
    const isTarget = r === 9;
    const flag = isTarget ? (cnt / totalSimulated <= 0.01 ? `${c.green}[ผ่านเป้าหมาย < 1%]${c.reset}` : `${c.red}[เกินเป้าหมาย!]${c.reset}`) : '';
    console.log(`  - ขั้นที่ ${r} : ${cnt.toString().padStart(6)} ชีวิต (${pct(cnt).padStart(6)}) ${flag}`);
}

// 5.4 วิเคราะห์รายชาติกำเนิด (Origins)
console.log(`\n${c.bold}${c.white}┌───────────────────────────────────────────────────────────────┐${c.reset}`);
console.log(`${c.bold}${c.white}│ 👑 4. เจาะลึกรายชาติกำเนิด (Origin Breakdown)                │${c.reset}`);
console.log(`${c.bold}${c.white}└───────────────────────────────────────────────────────────────┘${c.reset}`);
console.log(`  ${'ชาติกำเนิด'.padEnd(30)} ${'จำนวน'.padStart(6)} ${'อายุเฉลี่ย'.padStart(10)} ${'ขั้นเฉลี่ย'.padStart(10)} ${'ทองเฉลี่ย'.padStart(10)}`);
console.log(`  ${'-'.repeat(70)}`);
Object.entries(stats.origins).forEach(([name, data]) => {
    if (data.count === 0) return;
    const oAvgAge = (data.totalAge / data.count).toFixed(1);
    const oAvgRealm = (data.totalRealm / data.count).toFixed(2);
    const oAvgGold = Math.round(data.totalGold / data.count);
    console.log(`  ${name.padEnd(30)} ${data.count.toString().padStart(6)} ${(oAvgAge + ' ปี').padStart(10)} ${oAvgRealm.padStart(10)} ${(oAvgGold + ' 💰').padStart(10)}`);
});

// 5.5 วิเคราะห์รายมานา (Manas)
console.log(`\n${c.bold}${c.magenta}┌───────────────────────────────────────────────────────────────┐${c.reset}`);
console.log(`${c.bold}${c.magenta}│ 🔮 5. รูปแบบพลังมานา & ความเสี่ยง (Mana & Risk Stats)          │${c.reset}`);
console.log(`${c.bold}${c.magenta}└───────────────────────────────────────────────────────────────┘${c.reset}`);
console.log(`  ${'รูปแบบมานา'.padEnd(24)} ${'เกิด'.padStart(6)} ${'อายุเฉลี่ย'.padStart(10)} ${'ขั้นเฉลี่ย'.padStart(10)} ${'โดนล่าตาย'.padStart(12)}`);
console.log(`  ${'-'.repeat(66)}`);
Object.entries(stats.manas).forEach(([name, data]) => {
    if (data.count === 0) return;
    const mAvgAge = (data.totalAge / data.count).toFixed(1);
    const mAvgRealm = (data.totalRealm / data.count).toFixed(2);
    const suspRate = ((data.suspicionDeaths / data.count) * 100).toFixed(1) + '%';
    console.log(`  ${name.padEnd(24)} ${data.count.toString().padStart(6)} ${(mAvgAge + ' ปี').padStart(10)} ${mAvgRealm.padStart(10)} ${suspRate.padStart(12)}`);
});

// 5.6 วิเคราะห์อาณาจักร (Kingdoms)
console.log(`\n${c.bold}${c.blue}┌───────────────────────────────────────────────────────────────┐${c.reset}`);
console.log(`${c.bold}${c.blue}│ 🏰 6. สถิติรายอาณาจักร (Kingdom Influence)                   │${c.reset}`);
console.log(`${c.bold}${c.blue}└───────────────────────────────────────────────────────────────┘${c.reset}`);
console.log(`  ${'อาณาจักร'.padEnd(26)} ${'ประชากร'.padStart(8)} ${'อายุเฉลี่ย'.padStart(10)} ${'โดนล่าตาย (Suspicion)'.padStart(22)}`);
console.log(`  ${'-'.repeat(70)}`);
Object.entries(stats.kingdoms).forEach(([name, data]) => {
    if (data.count === 0) return;
    const kAvgAge = (data.totalAge / data.count).toFixed(1);
    const suspPct = ((data.suspicionDeaths / data.count) * 100).toFixed(1) + '%';
    console.log(`  ${name.padEnd(26)} ${data.count.toString().padStart(8)} ${(kAvgAge + ' ปี').padStart(10)} ${(data.suspicionDeaths + ' (' + suspPct + ')').padStart(22)}`);
});

// 5.7 Event Analytics & Event Chains
console.log(`\n${c.bold}${c.yellow}┌───────────────────────────────────────────────────────────────┐${c.reset}`);
console.log(`${c.bold}${c.yellow}│ 📜 7. วิเคราะห์เหตุการณ์ & เหตุการณ์ต่อเนื่อง (Event Analytics)  │${c.reset}`);
console.log(`${c.bold}${c.yellow}└───────────────────────────────────────────────────────────────┘${c.reset}`);
const avgEventsPerLife = totalSimulated > 0 ? (stats.eventStats.totalTriggered / totalSimulated).toFixed(2) : 0;
console.log(`  - เกิดเหตุการณ์เฉลี่ย: ${c.bold}${avgEventsPerLife}${c.reset} ครั้ง/ชีวิต (รวมทั้งหมด ${stats.eventStats.totalTriggered.toLocaleString()} ครั้ง)`);

// 7.1 เหตุการณ์ระดับโลก (World Events / Phenomena)
const worldEventIds = [
    'world_spiritual_tide',
    'world_blood_moon',
    'world_meteor_shower',
    'world_miasma_plague',
    'world_celestial_conjunction'
];
console.log(`\n  ${c.cyan}${c.bold}🌍 ปรากฏการณ์ระดับโลก (World Phenomena):${c.reset}`);
worldEventIds.forEach(id => {
    const ev = allEvents.find(e => e.id === id);
    const count = stats.eventStats.triggeredCounts[id] || 0;
    const rate = totalSimulated > 0 ? ((count / totalSimulated) * 100).toFixed(2) + '%' : '0%';
    console.log(`    • ${(ev ? ev.title : id).padEnd(45)} : ${count.toString().padStart(6)} ครั้ง (${rate})`);
});

// 7.2 เหตุการณ์ต่อเนื่อง (Event Chains Progression)
console.log(`\n  ${c.magenta}${c.bold}⛓️ เหตุการณ์ต่อเนื่อง (Event Chains Progression):${c.reset}`);
const chains = [
    {
        name: "ซากสุสานจักรพรรดิโบราณ (Imperial Tomb Chain)",
        steps: ['chain_imperial_tomb_map', 'chain_imperial_tomb_gate', 'chain_imperial_tomb_core']
    },
    {
        name: "การตามล่าของศาสนจักรออร์โธดอกซ์ (Holy Inquisition Pursuit)",
        steps: ['chain_inquisition_marked', 'chain_inquisition_assassin', 'chain_inquisition_counterstrike']
    },
    {
        name: "กายาโลหิตโบราณตื่นรู้ (Ancient Bloodline Awakening)",
        steps: ['chain_bloodline_fever', 'chain_bloodline_awakening']
    }
];

const chainStatsReport = {};
chains.forEach(ch => {
    console.log(`    ┌─ ${c.bold}${ch.name}${c.reset}`);
    chainStatsReport[ch.name] = {};
    ch.steps.forEach((stepId, idx) => {
        const ev = allEvents.find(e => e.id === stepId);
        const count = stats.eventStats.triggeredCounts[stepId] || 0;
        const rate = totalSimulated > 0 ? ((count / totalSimulated) * 100).toFixed(2) + '%' : '0%';
        const isLast = idx === ch.steps.length - 1;
        const prefix = isLast ? '└──' : '├──';
        console.log(`    │  ${prefix} ขั้นที่ ${idx + 1}: ${(ev ? ev.title : stepId).padEnd(46)} : ${count.toString().padStart(5)} ครั้ง (${rate})`);
        chainStatsReport[ch.name][`ขั้นที่ ${idx + 1} (${stepId})`] = { count, rate };
    });
});

// ตรวจหาเหตุการณ์ที่ไม่เคยเกิดเลย (Dead / Unreached Events)
const unreachedEvents = allEvents.filter(e => !stats.eventStats.triggeredCounts[e.id]);
if (unreachedEvents.length > 0) {
    console.log(`\n  - ${c.yellow}⚠ เหตุการณ์ที่ยังไม่เคยเกิดเลย (${unreachedEvents.length} เหตุการณ์):${c.reset}`);
    unreachedEvents.slice(0, 5).forEach(e => {
        console.log(`    • [${e.id}] ${e.title || 'ไม่มีชื่อ'} (ช่วงอายุ ${e.minAge}-${e.maxAge} ปี)`);
    });
    if (unreachedEvents.length > 5) console.log(`    • ... และอีก ${unreachedEvents.length - 5} รายการ`);
} else {
    console.log(`\n  - ${c.green}✔ ทุกเหตุการณ์ (${allEvents.length} รายการ) ถูกกระตุ้นอย่างน้อย 1 ครั้ง${c.reset}`);
}

// -------------------------------------------------------------
// 5.8 วิเคราะห์สถิติวิศวกรรม ระดับความเชื่อมั่น 99% (Engineering Statistics)
// -------------------------------------------------------------
console.log(`\n${c.bold}${c.green}┌───────────────────────────────────────────────────────────────┐${c.reset}`);
console.log(`${c.bold}${c.green}│ 📈 8. วิเคราะห์สถิติวิศวกรรม (Engineering Statistics - 99% CI) │${c.reset}`);
console.log(`${c.bold}${c.green}└───────────────────────────────────────────────────────────────┘${c.reset}`);

// ค่าวิกฤตมาตรฐานปกติสำหรับความเชื่อมั่น 99% สองหาง (Two-tailed Z_alpha/2 where alpha = 0.01)
const Z99 = 2.575829;

function calcProportionCI99(k, n) {
    if (n === 0) return { k: 0, n: 0, p: 0, se: 0, moe: 0, low: 0, high: 0, str: "0.00% ± 0.00% [0.00% - 0.00%]" };
    const p = k / n;
    const se = Math.sqrt((p * (1 - p)) / n);
    const moe = Z99 * se;
    const low = Math.max(0, p - moe);
    const high = Math.min(1, p + moe);
    return {
        k,
        n,
        p: +(p * 100).toFixed(3),
        se: +(se * 100).toFixed(4),
        moe: +(moe * 100).toFixed(3),
        low: +(low * 100).toFixed(3),
        high: +(high * 100).toFixed(3),
        str: `${(p * 100).toFixed(2)}% ± ${(moe * 100).toFixed(2)}% [${(low * 100).toFixed(2)}% - ${(high * 100).toFixed(2)}%]`
    };
}

function calcMeanCI99(data) {
    const n = data.length;
    if (n === 0) return { mean: 0, s: 0, se: 0, moe: 0, low: 0, high: 0, str: "0.00 ± 0.00" };
    const mean = data.reduce((a, b) => a + b, 0) / n;
    const variance = data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / (n - 1 || 1);
    const s = Math.sqrt(variance);
    const se = s / Math.sqrt(n);
    const moe = Z99 * se;
    const low = mean - moe;
    const high = mean + moe;
    return {
        mean: +mean.toFixed(2),
        s: +s.toFixed(2),
        se: +se.toFixed(3),
        moe: +moe.toFixed(2),
        low: +low.toFixed(2),
        high: +high.toFixed(2),
        str: `${mean.toFixed(2)} ± ${moe.toFixed(2)} ปี [${low.toFixed(2)} - ${high.toFixed(2)} ปี]`
    };
}

// คำนวณดัชนีสำคัญ
const ciRealm9 = calcProportionCI99(stats.realms[9] || 0, totalSimulated);
const r8PlusCount = (stats.realms[8] || 0) + (stats.realms[9] || 0);
const ciRealm8Plus = calcProportionCI99(r8PlusCount, totalSimulated);
const r5PlusCount = [5, 6, 7, 8, 9].reduce((sum, r) => sum + (stats.realms[r] || 0), 0);
const ciRealm5Plus = calcProportionCI99(r5PlusCount, totalSimulated);
const ciLifespan = calcMeanCI99(stats.ages);
const ciInfantDeath = calcProportionCI99(bracketInfant, totalSimulated);

// อัตราการตายจากความเสี่ยงสูง (มาร/ศาสนจักร/ระเบิดชีพจร)
const riskDeaths = Object.entries(stats.deathReasons)
    .filter(([r]) => r.includes('ชีพจร') || r.includes('ศาสนจักร') || r.includes('สังหาร') || r.includes('มาร'))
    .reduce((sum, [, cnt]) => sum + cnt, 0);
const ciRiskDeath = calcProportionCI99(riskDeaths, totalSimulated);

console.log(`  - ระดับความเชื่อมั่นทางสถิติ (Confidence Level): ${c.bold}${c.green}99.0% (Z = 2.576)${c.reset}`);
console.log(`  - ขนาดกลุ่มตัวอย่าง (Sample Size N):         ${c.bold}${totalSimulated.toLocaleString()}${c.reset} ชีวิต`);
console.log(`  - หลักการกำหนดขนาด N: สำหรับสัดส่วนขั้น 9 (p ≈ 0.3%) ที่ค่าผิดพลาดสูงสุดยอมรับได้ E = 0.1%`);
console.log(`    คำนวณจากสูตร: N = (Z^2 * p * (1-p)) / E^2 = (2.576^2 * 0.003 * 0.997) / 0.001^2 ≈ 19,848 ชีวิต`);
console.log(`  -----------------------------------------------------------------------------------------`);
console.log(`  ${'ตัวชี้วัดความน่าเชื่อถือ (Key Metric)'.padEnd(36)} | ${'ค่าประมาณการ ± Margin of Error [99% CI]'.padEnd(46)}`);
console.log(`  -----------------------------------------------------------------------------------------`);
console.log(`  ${'1. อัตราการบรรลุขั้น 9 (Realm 9 Rate)'.padEnd(36)} | ${c.cyan}${ciRealm9.str.padEnd(46)}${c.reset}`);
console.log(`  ${'2. อัตราขั้นสูง 8+ (Grandmaster+)'.padEnd(36)} | ${ciRealm8Plus.str.padEnd(46)}`);
console.log(`  ${'3. อัตราทะลวงขั้นกลาง 5+ (Mid Tier+)'.padEnd(36)} | ${ciRealm5Plus.str.padEnd(46)}`);
console.log(`  ${'4. อายุขัยเฉลี่ยทั้งประชากร (Mean Age)'.padEnd(36)} | ${c.yellow}${ciLifespan.str.padEnd(46)}${c.reset}`);
console.log(`  ${'5. อัตราการตายในวัยเยาว์ (< 15 ปี)'.padEnd(36)} | ${ciInfantDeath.str.padEnd(46)}`);
console.log(`  ${'6. อัตราตายจากความเสี่ยง (มาร/ศาสนจักร)'.padEnd(36)} | ${ciRiskDeath.str.padEnd(46)}`);
console.log(`  -----------------------------------------------------------------------------------------`);

const isTargetMet = ciRealm9.high <= 1.0;
if (isTargetMet) {
    console.log(`  ${c.green}${c.bold}✔ ผ่านเกณฑ์มาตรฐานวิศวกรรม: ช่วงความเชื่อมั่น 99% ของขั้น 9 อยู่ในกรอบ < 1.00% อย่างมีนัยสำคัญทางสถิติ${c.reset}`);
} else {
    console.log(`  ${c.red}${c.bold}⚠ ขอบบนของช่วงความเชื่อมั่น 99% ของขั้น 9 (${ciRealm9.high}%) เกินเกณฑ์ 1% เล็กน้อย ควรปรับจูนลดลง${c.reset}`);
}

// 5.9 Error Summary
if (Object.keys(stats.errors).length > 0) {
    console.log(`\n${c.bold}${c.red}┌───────────────────────────────────────────────────────────────┐${c.reset}`);
    console.log(`${c.bold}${c.red}│ ✖ พบข้อผิดพลาดระหว่างจำลอง (Runtime Errors)                   │${c.reset}`);
    console.log(`${c.bold}${c.red}└───────────────────────────────────────────────────────────────┘${c.reset}`);
    Object.entries(stats.errors).forEach(([msg, cnt]) => {
        console.log(`  - ${msg}: ${cnt} ครั้ง`);
    });
} else {
    console.log(`\n${c.green}✔ ไม่พบ Runtime Error หรือ Infinite Loop ระหว่างจำลอง${c.reset}`);
}

// -------------------------------------------------------------
// 6. Export JSON (ถ้ามีการระบุตัวเลือก)
// -------------------------------------------------------------
if (exportFile) {
    const reportData = {
        meta: {
            simulatedAt: new Date().toISOString(),
            numLives: totalSimulated,
            durationSeconds: +(elapsedMs / 1000).toFixed(2),
            confidenceLevel: "99%",
            zScore: Z99
        },
        engineeringStats99CI: {
            realm9Rate: ciRealm9,
            realm8PlusRate: ciRealm8Plus,
            realm5PlusRate: ciRealm5Plus,
            lifespanMean: ciLifespan,
            infantMortalityRate: ciInfantDeath,
            highRiskDeathRate: ciRiskDeath
        },
        lifespan: {
            min: minAge,
            max: maxAge,
            mean: +avgAge,
            median: medianAge,
            brackets: { infant: bracketInfant, youth: bracketYouth, mid: bracketMid, elder: bracketElder, centenarian: bracketCent }
        },
        deathReasons: stats.deathReasons,
        realms: stats.realms,
        origins: stats.origins,
        manas: stats.manas,
        kingdoms: stats.kingdoms,
        eventStats: stats.eventStats,
        eventChains: chainStatsReport,
        errors: stats.errors
    };

    fs.writeFileSync(exportFile, JSON.stringify(reportData, null, 2), 'utf8');
    console.log(`\n${c.cyan}💾 บันทึกรายงานสถิติวิศวกรรมละเอียดลงไฟล์: ${c.bold}${exportFile}${c.reset}`);
}

console.log(`\n${c.bold}${c.cyan}================================================================${c.reset}\n`);

