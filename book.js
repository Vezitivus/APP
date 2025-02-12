document.addEventListener("DOMContentLoaded", function() {
  // ===== Funkcija UID iegūšanai no URL =====
  function getUID() {
    // Mēģina iegūt uid no query parametriem (piemēram, ?uid=ABC123)
    const params = new URLSearchParams(window.location.search);
    let uid = params.get("uid");
    if (!uid) {
      // Ja query parametrs nav, tad mēģina iegūt pēdējo ceļa segmentu
      const pathSegments = window.location.pathname.split("/").filter(seg => seg.length > 0);
      uid = pathSegments[pathSegments.length - 1];
    }
    return uid;
  }

  const uid = getUID();
  
  // ===== Google Sheets integrācija =====
  const sheetUrlBase = "https://script.google.com/macros/s/AKfycbyS8FWFUDIInu7NFBxa8BP2qGeoLdoLdIxRVs-aL8ss9umKeGU88D17QHSlPVb2z7o5qQ/exec";
  const remainingSpinsDiv = document.getElementById("remainingSpins");

  // Funkcija, lai izgūtu atlikušos griezienus no Google Sheets.
  // Pieņemam, ka web app atgriež JSON objektu, kurā:
  // - Lapa1 A kolonnas vērtība ir uid,
  // - K kolonnas vērtība satur griezienu skaitu.
  function fetchRemainingSpins() {
    if (!uid) {
      remainingSpinsDiv.textContent = "Atlikušie griezieni: N/A";
      return;
    }
    const url = sheetUrlBase + "?uid=" + encodeURIComponent(uid);
    fetch(url)
      .then(response => response.json())
      .then(data => {
         // Pielāgo, ja nepieciešams, atkarībā no web app atbildes struktūras
         const spins = data.K;
         remainingSpinsDiv.textContent = "Atlikušie griezieni: " + spins;
      })
      .catch(error => {
         console.error("Error fetching remaining spins:", error);
         remainingSpinsDiv.textContent = "Atlikušie griezieni: N/A";
      });
  }

  // Izsaucam funkciju lapas ielādē, lai parādītu griezienu atlikumu
  fetchRemainingSpins();

  // ===== Spēles loģika =====
  const emojiSet = ['🍒', '🍋', '🍊', '🍉', '🍇', '⭐', '🔔', '7️⃣'];
  const numReels = 5;
  const reels = [];
  const spinIntervals = [];
  let reelsStopped = 0;
  const spinButton = document.getElementById("spinButton");
  const messageDiv = document.getElementById("message");

  // Inicializējam katru reeli ar nejaušu sākuma simbolu
  for (let i = 0; i < numReels; i++) {
    reels[i] = {
      currentIndex: Math.floor(Math.random() * emojiSet.length),
      spinning: false
    };
    updateReelDisplay(i);
  }

  // Pogu notikums – sāk griešanās
  spinButton.addEventListener("click", function() {
    spinButton.disabled = true;
    messageDiv.textContent = "";
    reelsStopped = 0;
    for (let i = 0; i < numReels; i++) {
      // Katram reelim griešanās ilgums: 2000ms + (i * 500ms)
      startSpinning(i, 2000 + i * 500);
    }
  });

  function startSpinning(reelIndex, duration) {
    reels[reelIndex].spinning = true;
    spinIntervals[reelIndex] = setInterval(function() {
      reels[reelIndex].currentIndex = (reels[reelIndex].currentIndex + 1) % emojiSet.length;
      updateReelDisplay(reelIndex);
    }, 100);

    setTimeout(function() {
      stopSpinning(reelIndex);
    }, duration);
  }

  function stopSpinning(reelIndex) {
    clearInterval(spinIntervals[reelIndex]);
    reels[reelIndex].spinning = false;
    // Izvēlam pēdējo simbolu nejauši (var arī saglabāt griešanās stāvokli)
    reels[reelIndex].currentIndex = Math.floor(Math.random() * emojiSet.length);
    updateReelDisplay(reelIndex);
    reelsStopped++;
    if (reelsStopped === numReels) {
      checkResult();
      spinButton.disabled = false;
    }
  }

  function updateReelDisplay(reelIndex) {
    const reel = reels[reelIndex];
    const topIndex = (reel.currentIndex - 1 + emojiSet.length) % emojiSet.length;
    const bottomIndex = (reel.currentIndex + 1) % emojiSet.length;
    document.getElementById("reel" + reelIndex + "-symbol0").textContent = emojiSet[topIndex];
    document.getElementById("reel" + reelIndex + "-symbol1").textContent = emojiSet[reel.currentIndex];
    document.getElementById("reel" + reelIndex + "-symbol2").textContent = emojiSet[bottomIndex];
  }

  function checkResult() {
    const results = [];
    for (let i = 0; i < numReels; i++) {
      const symbol = document.getElementById("reel" + i + "-symbol1").textContent;
      results.push(symbol);
    }
    // Saskaitam katra simbola parādīšanās reižu skaitu
    const counts = {};
    results.forEach(symbol => {
      counts[symbol] = (counts[symbol] || 0) + 1;
    });
    let win = false;
    for (const key in counts) {
      if (counts[key] >= 3) { // ja vismaz 3 reizes sakrīt – uzvara
        win = true;
        break;
      }
    }
    messageDiv.textContent = win ? "Uzvara!" : "Zaudēji!";
  }
});
