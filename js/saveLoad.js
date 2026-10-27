
function saveGame() {
    if (!player.isAlive) return alert("ผู้เล่นเสียชีวิตแล้ว ไม่สามารถเซฟได้");
    const saveData = {
        player: player,
        triggeredEvents: Array.from(triggeredEvents)
    };
    localStorage.setItem('rpgLifeSimSave', JSON.stringify(saveData));
    addLog(`💾 บันทึกเกมสำเร็จ!`, "text-sky-300");
}

function loadGame() {
    const saveStr = localStorage.getItem('rpgLifeSimSave');
    if (!saveStr) return alert("ไม่พบข้อมูลเซฟเก่า");
    try {
        const saveData = JSON.parse(saveStr);
        player = saveData.player;
        triggeredEvents = new Set(saveData.triggeredEvents);
        
        document.getElementById('start-panel').classList.add('hidden');
        document.getElementById('game-panel').classList.remove('hidden');
        document.getElementById('time-controls').classList.remove('hidden');
        document.getElementById('progress-wrapper').classList.remove('hidden');
        
        updateUI();
        setSpeed(0); // เริ่มมาให้หยุดเวลาก่อน
        addLog(`📂 โหลดเกมสำเร็จ! ยินดีต้อนรับกลับสู่วัฏจักร`, "text-sky-300");
    } catch (e) {
        alert("ไฟล์เซฟเสียหาย");
    }
}
