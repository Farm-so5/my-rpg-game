// Global Game State and Data
let gameData = {
    kingdoms: [],
    origins: [],
    manas: [],
    items: [],
    events: [],
    balance: {}
};

let player = {};
let currentSpeed = 0;
let lastActiveSpeed = 1;
let progressTimer = null;
let progressValue = 0;
let isModalOpen = false;

const SPEED_INTERVALS = { 0: null, 1: 2000, 2: 1000, 3: 400 };

// โหลดข้อมูล JSON ทั้งหมด
async function loadData() {
    try {
        const [resK, resO, resM, resI, resB, resE1, resE2, resE3, resE4] = await Promise.all([
            fetch('data/kingdoms.json'),
            fetch('data/origins.json'),
            fetch('data/manas.json'),
            fetch('data/items.json'),
            fetch('data/balance.json'),
            fetch('data/events/event_early_life.json'),
            fetch('data/events/event_mid_life.json'),
            fetch('data/events/event_endgame.json'),
            fetch('data/events/event_world.json')
        ]);

        gameData.kingdoms = await resK.json();
        gameData.origins = await resO.json();
        gameData.manas = await resM.json();
        gameData.items = await resI.json();
        gameData.balance = await resB.json();

        const e1 = await resE1.json();
        const e2 = await resE2.json();
        const e3 = await resE3.json();
        const e4 = await resE4.json();
        gameData.events = [...e1, ...e2, ...e3, ...e4];

        console.log("Data loaded successfully. Total events:", gameData.events.length);
        const statusEl = document.getElementById('game-status');
        if (statusEl) statusEl.innerText = "พร้อมจุติ";
    } catch (e) {
        console.warn("Fetch failed:", e);
        alert("⚠️ คำเตือน: ไม่สามารถโหลดข้อมูล JSON ได้\nการเปิดไฟล์ index.html ผ่าน file:// ตรงๆ เบราว์เซอร์จะบล็อก fetch() ตามระบบความปลอดภัย CORS\nโปรดรันผ่าน Live Server ใน VS Code หรือทดสอบบน GitHub Pages เสมอ!");
    }
}

window.onload = () => {
    loadData();
};
