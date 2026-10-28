#!/usr/bin/env node
/**
 * tools/validate.js
 * สคริปต์ตรวจสอบความถูกต้องของข้อมูล JSON ทั้งหมดในโปรเจกต์
 * - ตรวจสอบ Syntax JSON
 * - ตรวจสอบ ID ซ้ำ (Items, Events)
 * - ตรวจสอบ Reference ข้ามไฟล์ (เช่น Item ใน Event effects มีอยู่ใน items.json หรือไม่)
 * - ตรวจสอบการสะกดชื่อ Stat และ Operators ในเงื่อนไข
 * - ตรวจสอบโครงสร้างพื้นฐานของ Kingdoms, Origins, Manas
 * 
 * ใช้งาน: node tools/validate.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

// สี ANSI สำหรับ Console output
const c = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m"
};

let errorCount = 0;
let warnCount = 0;
let checkCount = 0;

function logError(file, msg) {
    errorCount++;
    console.log(`  ${c.red}✖ [ERROR]${c.reset} ${c.yellow}${file}${c.reset}: ${msg}`);
}

function logWarn(file, msg) {
    warnCount++;
    console.log(`  ${c.yellow}⚠ [WARN]${c.reset}  ${c.yellow}${file}${c.reset}: ${msg}`);
}

function logPass(msg) {
    checkCount++;
    console.log(`  ${c.green}✔ [PASS]${c.reset} ${msg}`);
}

function safeReadJSON(relPath, required = true) {
    const fullPath = path.join(DATA_DIR, relPath);
    if (!fs.existsSync(fullPath)) {
        if (required) {
            logError(relPath, "ไม่พบไฟล์ที่จำเป็นนี้");
        } else {
            logWarn(relPath, "ไม่พบไฟล์นี้ (ระบบยังไม่ได้สร้าง)");
        }
        return null;
    }

    try {
        const raw = fs.readFileSync(fullPath, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        logError(relPath, `JSON Syntax ผิดพลาด: ${err.message}`);
        return null;
    }
}

console.log(`\n${c.bold}${c.cyan}====================================================${c.reset}`);
console.log(`${c.bold}${c.cyan} 🔍 Chronicles of Reincarnation - Data Validator${c.reset}`);
console.log(`${c.bold}${c.cyan}====================================================${c.reset}\n`);

// 1. โหลดข้อมูลพื้นฐาน
console.log(`${c.bold}📂 1. ตรวจสอบและโหลดไฟล์ข้อมูลหลัก...${c.reset}`);
const kingdoms = safeReadJSON('kingdoms.json');
const origins = safeReadJSON('origins.json');
const manas = safeReadJSON('manas.json');
const items = safeReadJSON('items.json');
const balance = safeReadJSON('balance.json', false);

// ตรวจสอบ Items
const itemIds = new Set();
const VALID_SLOTS = new Set(['weapon', 'gloves', 'armor', 'ring', 'helm', 'necklace', 'relic', 'boots']);

if (items && Array.isArray(items)) {
    items.forEach((item, idx) => {
        const id = item.id || `index_${idx}`;
        if (!item.id) logError('items.json', `รายการที่ #${idx} ไม่มี field 'id'`);
        if (item.id && itemIds.has(item.id)) logError('items.json', `พบ ID ซ้ำ: '${item.id}'`);
        if (item.id) itemIds.add(item.id);

        if (!item.name) logError('items.json', `Item '${id}' ไม่มี 'name'`);
        if (!item.slot) {
            logError('items.json', `Item '${id}' ไม่มี 'slot'`);
        } else if (!VALID_SLOTS.has(item.slot)) {
            logError('items.json', `Item '${id}' มี slot ไม่ถูกต้อง: '${item.slot}' (ต้องเป็น ${Array.from(VALID_SLOTS).join(', ')})`);
        }
    });
    logPass(`items.json: ตรวจสอบ ${items.length} รายการ (พบ ID: ${itemIds.size})`);
}

// ตรวจสอบ Kingdoms
const kingdomNames = new Set();
if (kingdoms && Array.isArray(kingdoms)) {
    kingdoms.forEach((k, idx) => {
        if (!k.name) logError('kingdoms.json', `รายการที่ #${idx} ไม่มี 'name'`);
        if (k.name) {
            if (kingdomNames.has(k.name)) logError('kingdoms.json', `พบชื่ออาณาจักรซ้ำ: '${k.name}'`);
            kingdomNames.add(k.name);
        }
        if (typeof k.suspMod !== 'number') logWarn('kingdoms.json', `อาณาจักร '${k.name}' ไม่มี 'suspMod' (number)`);
    });
    logPass(`kingdoms.json: ตรวจสอบ ${kingdoms.length} อาณาจักร`);
}

// ตรวจสอบ Origins
const originNames = new Set();
const REQUIRED_ORIGIN_FIELDS = ['name', 'weight', 'gold', 'hp', 'mp', 'str', 'vit', 'agi', 'spr', 'luck'];
if (origins && Array.isArray(origins)) {
    origins.forEach((o, idx) => {
        if (!o.name) logError('origins.json', `รายการที่ #${idx} ไม่มี 'name'`);
        if (o.name) {
            if (originNames.has(o.name)) logError('origins.json', `พบชาติกำเนิดซ้ำ: '${o.name}'`);
            originNames.add(o.name);
        }
        REQUIRED_ORIGIN_FIELDS.forEach(f => {
            if (o[f] === undefined) logError('origins.json', `ชาติกำเนิด '${o.name || idx}' ขาด field '${f}'`);
        });
    });
    logPass(`origins.json: ตรวจสอบ ${origins.length} ชาติกำเนิด`);
}

// ตรวจสอบ Manas
const manaNames = new Set();
if (manas && Array.isArray(manas)) {
    manas.forEach((m, idx) => {
        if (!m.name) logError('manas.json', `รายการที่ #${idx} ไม่มี 'name'`);
        if (m.name) {
            if (manaNames.has(m.name)) logError('manas.json', `พบชื่อรูปแบบพลังมานาซ้ำ: '${m.name}'`);
            manaNames.add(m.name);
        }
        if (typeof m.weight !== 'number') logError('manas.json', `มานา '${m.name}' ต้องมี weight เป็นตัวเลข`);
        if (typeof m.isDemonic !== 'boolean') logWarn('manas.json', `มานา '${m.name}' ควรมี 'isDemonic' (boolean)`);
    });
    logPass(`manas.json: ตรวจสอบ ${manas.length} รูปแบบมานา`);
}

// 2. ตรวจสอบ Events ในโฟลเดอร์ data/events
console.log(`\n${c.bold}📜 2. ตรวจสอบไฟล์ Events...${c.reset}`);
const eventsDir = path.join(DATA_DIR, 'events');
const eventIds = new Set();

const VALID_STATS = new Set([
    'realm', 'exp', 'hp', 'maxHp', 'mp', 'maxMp',
    'str', 'vit', 'agi', 'spr', 'strain', 'suspicion',
    'luck', 'gold', 'age', 'maxAge', 'power', 'demonic', 'expToNext'
]);
const VALID_OPS = new Set(['>=', '<=', '>', '<', '==', '!=']);
const VALID_EFFECT_OPS = new Set(['add', 'set', 'hurt', 'give', 'equip', 'log', 'die']);

function validateCondition(cond, file, context) {
    if (!cond.stat) {
        logError(file, `${context}: เงื่อนไข if ขาด field 'stat'`);
    } else if (cond.stat.startsWith('event:')) {
        // Event chain reference - valid
    } else if (cond.stat.startsWith('hasItem:')) {
        const itemId = cond.stat.substring(8);
        if (!itemIds.has(itemId)) {
            logError(file, `${context}: hasItem อ้างถึง itemId '${itemId}' ซึ่งไม่มีอยู่ใน items.json`);
        }
    } else if (!VALID_STATS.has(cond.stat)) {
        logError(file, `${context}: stat '${cond.stat}' สะกดผิดหรือไม่อยู่ในรายการที่รองรับ (${Array.from(VALID_STATS).slice(0, 8).join(', ')}...)`);
    }

    if (cond.op && !VALID_OPS.has(cond.op)) {
        logError(file, `${context}: op '${cond.op}' ไม่ถูกต้อง (ต้องเป็น >=, <=, >, <, ==, !=)`);
    }
}

function validateEffect(eff, file, context) {
    if (!eff.op) {
        logError(file, `${context}: effect ขาด field 'op'`);
        return;
    }
    if (!VALID_EFFECT_OPS.has(eff.op)) {
        logError(file, `${context}: effect op '${eff.op}' ไม่ถูกต้อง (ต้องเป็น ${Array.from(VALID_EFFECT_OPS).join(', ')})`);
        return;
    }

    if (eff.op === 'give' || eff.op === 'equip') {
        if (!eff.item) {
            logError(file, `${context}: effect '${eff.op}' ขาด field 'item' (item id)`);
        } else if (!itemIds.has(eff.item)) {
            logError(file, `${context}: effect '${eff.op}' อ้างถึง item id '${eff.item}' ซึ่งไม่มีอยู่ใน items.json!`);
        }
    }

    if (eff.op === 'add' || eff.op === 'set') {
        if (!eff.stat) {
            logError(file, `${context}: effect '${eff.op}' ขาด field 'stat'`);
        } else if (!VALID_STATS.has(eff.stat)) {
            logError(file, `${context}: effect stat '${eff.stat}' สะกดผิดหรือไม่รองรับ`);
        }
    }

    if (eff.op === 'hurt') {
        if (eff.pct === undefined && eff.value === undefined) {
            logWarn(file, `${context}: effect 'hurt' ควรมี 'pct' (สัดส่วน maxHp) หรือ 'value'`);
        }
    }
}

if (fs.existsSync(eventsDir)) {
    const eventFiles = fs.readdirSync(eventsDir).filter(f => f.endsWith('.json'));

    if (eventFiles.length === 0) {
        logWarn('data/events', 'ไม่พบไฟล์เหตุการณ์ .json ในโฟลเดอร์');
    }

    eventFiles.forEach(file => {
        const relPath = path.join('events', file);
        const evList = safeReadJSON(relPath);
        if (!evList) return;

        if (!Array.isArray(evList)) {
            logError(relPath, `เนื้อหาไฟล์ต้องเป็น JSON Array [ ... ]`);
            return;
        }

        if (evList.length === 0) {
            logWarn(relPath, `ไฟล์ว่าง (0 เหตุการณ์)`);
            return;
        }

        evList.forEach((ev, idx) => {
            const ctxName = `Event #${idx} (${ev.id || 'ไร้ ID'})`;

            // เช็ค id
            if (!ev.id) {
                logError(relPath, `${ctxName}: ไม่มี 'id'`);
            } else {
                if (eventIds.has(ev.id)) {
                    logError(relPath, `${ctxName}: พบ Event ID ซ้ำข้ามระบบ: '${ev.id}'`);
                }
                eventIds.add(ev.id);
            }

            // เช็ค title / desc
            if (!ev.title) logWarn(relPath, `${ctxName}: ไม่มี 'title'`);
            if (!ev.desc) logWarn(relPath, `${ctxName}: ไม่มี 'desc'`);

            // เช็คช่วงอายุ
            if (typeof ev.minAge !== 'number') logWarn(relPath, `${ctxName}: ไม่มี minAge`);
            if (typeof ev.maxAge !== 'number') logWarn(relPath, `${ctxName}: ไม่มี maxAge`);
            if (ev.minAge !== undefined && ev.maxAge !== undefined && ev.minAge > ev.maxAge) {
                logError(relPath, `${ctxName}: minAge (${ev.minAge}) มากกว่า maxAge (${ev.maxAge})`);
            }

            // เช็คอาณาจักร
            if (ev.kingdoms && Array.isArray(ev.kingdoms)) {
                ev.kingdoms.forEach(kName => {
                    if (!kingdomNames.has(kName)) {
                        logError(relPath, `${ctxName}: อ้างถึงอาณาจักร '${kName}' ซึ่งไม่มีใน kingdoms.json`);
                    }
                });
            }

            // เช็คเงื่อนไขระดับ Event (if)
            if (ev.if && Array.isArray(ev.if)) {
                ev.if.forEach((cond, cIdx) => validateCondition(cond, relPath, `${ctxName} if[${cIdx}]`));
            }

            // เช็ค choices
            if (!ev.choices || !Array.isArray(ev.choices) || ev.choices.length === 0) {
                logError(relPath, `${ctxName}: ไม่มี choices หรือ choices ว่างเปล่า`);
            } else {
                ev.choices.forEach((ch, chIdx) => {
                    const chContext = `${ctxName} choice[${chIdx}]`;
                    if (!ch.text) logError(relPath, `${chContext}: ไม่มี 'text' ตัวเลือก`);

                    // เช็ค if ของ choice
                    if (ch.if && Array.isArray(ch.if)) {
                        ch.if.forEach((cond, cIdx) => validateCondition(cond, relPath, `${chContext} if[${cIdx}]`));
                    }

                    // เช็ค effects
                    if (ch.effects && Array.isArray(ch.effects)) {
                        ch.effects.forEach((eff, eIdx) => validateEffect(eff, relPath, `${chContext} effects[${eIdx}]`));
                    }

                    // เช็ค roll
                    if (ch.roll) {
                        if (!ch.roll.chance || typeof ch.roll.chance.base !== 'number') {
                            logWarn(relPath, `${chContext}: roll ควรมี chance.base (number)`);
                        }
                        if (ch.roll.success && Array.isArray(ch.roll.success)) {
                            ch.roll.success.forEach((eff, eIdx) => validateEffect(eff, relPath, `${chContext} roll.success[${eIdx}]`));
                        }
                        if (ch.roll.fail && Array.isArray(ch.roll.fail)) {
                            ch.roll.fail.forEach((eff, eIdx) => validateEffect(eff, relPath, `${chContext} roll.fail[${eIdx}]`));
                        }
                    }
                });
            }
        });

        logPass(`${relPath}: ตรวจสอบ ${evList.length} เหตุการณ์`);
    });
} else {
    logError('data/events', 'ไม่พบโฟลเดอร์ data/events/');
}

// 3. สรุปผล
console.log(`\n${c.bold}${c.cyan}====================================================${c.reset}`);
console.log(`${c.bold}📊 ผลการตรวจสอบข้อมูล:${c.reset}`);
console.log(`   - เช็กผ่านแล้ว (Passed checks): ${c.green}${checkCount}${c.reset}`);
console.log(`   - ข้อผิดพลาด (Errors):         ${errorCount > 0 ? c.red : c.green}${errorCount}${c.reset}`);
console.log(`   - ข้อควรระวัง (Warnings):       ${warnCount > 0 ? c.yellow : c.green}${warnCount}${c.reset}`);
console.log(`${c.bold}${c.cyan}====================================================${c.reset}\n`);

if (errorCount > 0) {
    console.log(`${c.red}${c.bold}✖ พบข้อผิดพลาดในข้อมูล โปรดแก้ไขก่อนเริ่มทดสอบระบบ${c.reset}\n`);
    process.exit(1);
} else {
    console.log(`${c.green}${c.bold}✔ ข้อมูลทั้งหมดถูกต้อง พร้อมใช้งาน!${c.reset}\n`);
    process.exit(0);
}
