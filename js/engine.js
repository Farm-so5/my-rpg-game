
function getRandomWeighted(items) {
    let totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let randomNum = Math.random() * totalWeight;
    for (let item of items) {
        if (randomNum < item.weight) return item;
        randomNum -= item.weight;
    }
    return items[0];
}

function startGame() {
    if(gameData.kingdoms.length === 0) return alert("กำลังโหลดข้อมูล โปรดรอสักครู่ หรือใช้ Live Server รันโค้ด");
    
    let chosenKingdom = gameData.kingdoms[Math.floor(Math.random() * gameData.kingdoms.length)];
    let chosenOrigin = getRandomWeighted(gameData.origins);
    let chosenMana = getRandomWeighted(gameData.manas);
    if (chosenOrigin.name.includes("จอมมาร")) chosenMana = gameData.manas.find(m => m.isDemonic);

    player = {
        kingdom: chosenKingdom, originObj: chosenOrigin, manaObj: chosenMana,
        age: 0, maxAge: 100, realm: chosenMana.name === "ไร้พลังเวท" ? 0 : 1, exp: 0,
        hp: chosenOrigin.hp, maxHp: chosenOrigin.hp, mp: chosenOrigin.mp, maxMp: chosenOrigin.mp,
        str: chosenOrigin.str, vit: chosenOrigin.vit, agi: chosenOrigin.agi, spr: chosenOrigin.spr,
        strain: 0, gold: chosenOrigin.gold, suspicion: chosenMana.isDemonic ? 15 : 0, luck: chosenOrigin.luck,
        equipment: { weapon: null, gloves: null, armor: null, ring: null, helm: null, necklace: null, relic: null, boots: null },
        inventory: [], isAlive: true
    };
    
    triggeredEvents.clear(); isModalOpen = false;
    document.getElementById('start-panel').classList.add('hidden');
    document.getElementById('game-panel').classList.remove('hidden');
    document.getElementById('time-controls').classList.remove('hidden');
    document.getElementById('progress-wrapper').classList.remove('hidden');
    document.getElementById('log-content').innerHTML = "";

    addLog(`✨ เกิดใหม่ใน <b>${player.kingdom.name}</b> ฐานะ <b>${player.originObj.name}</b>`, "text-amber-300");
    updateUI(); setSpeed(1);
}

function ageUp() {
    if (!player.isAlive || isModalOpen) return;
    player.age += 1;

    if (player.age >= player.maxAge) return die(`สิ้นอายุขัย`);
    if (player.hp <= 0) return die(`บาดเจ็บสาหัส`);
    if (player.strain >= 100) return die(`เส้นชีพจรระเบิด!`);
    if (player.suspicion >= 100) return die(`ถูกศาสนจักรล้อมสังหาร!`);

    let eligibleEvents = gameData.events.filter(e => player.age >= e.minAge && player.age <= e.maxAge && !triggeredEvents.has(e.id));
    if (eligibleEvents.length > 0 && Math.random() < 0.25) {
        let chosenEvent = eligibleEvents[Math.floor(Math.random() * eligibleEvents.length)];
        triggeredEvents.add(chosenEvent.id);
        triggerModalEvent(chosenEvent);
        updateUI(); return;
    }

    let roll = Math.random();
    if (roll < 0.25) {
        let gain = Math.floor(Math.random() * 20) + 10;
        player.gold += gain;
        addLog(`[อายุ ${player.age} ปี] ได้รับเงิน +${gain} เหรียญ`);
    } else {
        addLog(`[อายุ ${player.age} ปี] หมั่นฝึกฝน...`, "text-stone-400");
    }
    updateUI();
}

function setSpeed(speed) {
    if (!player.isAlive || isModalOpen) return;
    currentSpeed = speed; if (speed > 0) lastActiveSpeed = speed;
    
    [0, 1, 2, 3].forEach(s => {
        document.getElementById(`btn-speed-${s}`).className = s === speed 
            ? "px-3 py-1 text-xs font-bold rounded-lg transition bg-amber-600 text-white"
            : "px-3 py-1 text-xs font-bold rounded-lg transition text-stone-400 hover:text-white";
    });

    clearInterval(progressTimer);
    if (speed > 0) {
        let intervalMs = SPEED_INTERVALS[speed], stepMs = 50, increment = (stepMs / intervalMs) * 100;
        progressTimer = setInterval(() => {
            progressValue += increment;
            if (progressValue >= 100) { progressValue = 0; ageUp(); }
            document.getElementById('year-progress').style.width = `${Math.min(progressValue, 100)}%`;
        }, stepMs);
    }
}

function die(reason) {
    player.isAlive = false; clearInterval(progressTimer);
    addLog(`💀 <b>[อายุ ${player.age} ปี]</b> ${reason}`, "text-red-400");
    updateUI();
}

function resetGame() {
    clearInterval(progressTimer); isModalOpen = false;
    document.getElementById('event-modal').classList.add('hidden');
    document.getElementById('start-panel').classList.remove('hidden');
    document.getElementById('game-panel').classList.add('hidden');
    document.getElementById('time-controls').classList.add('hidden');
    document.getElementById('progress-wrapper').classList.add('hidden');
}

function getRealmTitle(realm) {
    const titles = ["ปุถุชนไร้เวท", "ผู้ฝึกหัดเวท", "หลอมรวมปราณ", "ก่อตั้งรากฐาน"];
    return titles[Math.min(realm, 3)] || "ขั้นสูง";
}

function addLog(htmlText, colorClass = "text-stone-300") {
    let logContainer = document.getElementById('log-content');
    logContainer.innerHTML = `<p class="border-l-2 border-amber-700/60 pl-2 py-0.5 ${colorClass}">${htmlText}</p>` + logContainer.innerHTML;
}

function updateUI() {
    if(!player.originObj) return;
    document.getElementById('p-origin').innerText = player.originObj.name;
    document.getElementById('p-kingdom').innerText = player.kingdom.name;
    document.getElementById('p-mana-type').innerText = player.manaObj.name;
    document.getElementById('p-age').innerText = player.age;
    document.getElementById('p-max-age').innerText = player.maxAge;
    document.getElementById('p-realm').innerText = `ขั้นที่ ${player.realm} (${getRealmTitle(player.realm)})`;
    document.getElementById('stat-gold').innerText = player.gold;
    document.getElementById('avatar-icon').innerText = player.originObj.avatar;
    document.getElementById('avatar-aura').innerText = player.manaObj.aura;

    let cStats = calculateCombatStats();
    document.getElementById('combat-atk').innerText = cStats.atk;
    document.getElementById('combat-def').innerText = cStats.def;
    document.getElementById('combat-crit').innerText = `${cStats.crit}%`;
}
