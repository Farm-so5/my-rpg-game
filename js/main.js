
// Global Game State and Data
let gameData = { kingdoms: [], origins: [], manas: [], items: [], events: [] };
let player = {};
let currentSpeed = 0;
let lastActiveSpeed = 1;
let progressTimer = null;
let progressValue = 0;
let isModalOpen = false;
let triggeredEvents = new Set();
const SPEED_INTERVALS = { 0: null, 1: 2000, 2: 1000, 3: 400 };

// Load Data (Mock fetch for standard structure - you can adapt this for GAS later)
async function loadData() {
    try {
        // For standard local dev, you'd use fetch(). 
        // Note: fetch() requires a local server (like VS Code Live Server).
        const resK = await fetch('data/kingdoms.json'); gameData.kingdoms = await resK.json();
        const resO = await fetch('data/origins.json'); gameData.origins = await resO.json();
        const resM = await fetch('data/manas.json'); gameData.manas = await resM.json();
        const resI = await fetch('data/items.json'); gameData.items = await resI.json();
        const resE1 = await fetch('data/events/event_early_life.json'); 
        gameData.events = await resE1.json();
        console.log("Data loaded successfully");
    } catch (e) {
        console.warn("Fetch failed (maybe running file://). Using fallback data.");
        // If testing without a local server, you would paste JSON directly here.
    }
}

window.onload = () => {
    loadData();
};
