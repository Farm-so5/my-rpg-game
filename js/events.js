
function triggerModalEvent(eventObj) {
    clearInterval(progressTimer); isModalOpen = true;
    document.getElementById('modal-age').innerText = `อายุ ${player.age} ปี`;
    document.getElementById('modal-title').innerText = eventObj.title;
    document.getElementById('modal-desc').innerText = eventObj.desc;
    
    let choicesDiv = document.getElementById('modal-choices');
    choicesDiv.innerHTML = "";
    eventObj.choices.forEach((choice) => {
        let btn = document.createElement('button');
        btn.className = "w-full text-left p-3.5 rounded-xl bg-stone-900 border border-amber-700/60 text-stone-200";
        btn.innerText = choice.text;
        btn.onclick = () => {
            // Simplified action logic for generated file demo
            addLog(`⚡ เลือก: ${choice.text}`, "text-amber-300");
            closeModal();
        };
        choicesDiv.appendChild(btn);
    });
    document.getElementById('event-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('event-modal').classList.add('hidden');
    isModalOpen = false;
    updateUI(); setSpeed(lastActiveSpeed);
}
