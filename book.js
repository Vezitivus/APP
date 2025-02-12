document.addEventListener("DOMContentLoaded", function() {
  // ===== UID iegūšana no URL =====
  function getUID() {
    const params = new URLSearchParams(window.location.search);
    let uid = params.get("uid");
    if (!uid) {
      const pathSegments = window.location.pathname.split("/").filter(seg => seg.length > 0);
      uid = pathSegments[pathSegments.length - 1];
    }
    return uid;
  }
  const uid = getUID();

  // ===== Google Sheets integrācija =====
  // Pārliecinies, ka tavs Google Apps Script web app URL apstrādā arī "deduct" parametru!
  const sheetUrlBase = "https://script.google.com/macros/s/AKfycbyS8FWFUDIInu7NFBxa8BP2qGeoLdoLdIxRVs-aL8ss9umKeGU88D17QHSlPVb2z7o5qQ/exec";
  const remainingSpinsDiv = document.getElementById("remainingSpins");

  // Iegūst atlikušos griezienus no Google Sheets
  function fetchRemainingSpins() {
    if (!uid) {
      remainingSpinsDiv.textContent = "🪙 N/A";
      return;
    }
    const url = sheetUrlBase + "?uid=" + encodeURIComponent(uid);
    fetch(url)
      .then(response => response.json())
      .then(data => {
         // Pieņemam, ka atbildē ir lauks "K" ar atlikušajiem griezieniem
         const spins = data.K;
         remainingSpinsDiv.textContent = "🪙 " + spins;
      })
      .catch(error => {
         console.error("Error fetching remaining spins:", error);
         remainingSpinsDiv.textContent = "🪙 N/A";
      });
  }

  // Funkcija, kas atskaita griezienus, izmantojot izvēlēto reizinātāju
  function deductSpins(multiplier) {
    if (!uid) return Promise.resolve();
    const url = sheetUrlBase + "?uid=" + encodeURIComponent(uid) + "&deduct=" + multiplier;
    return fetch(url)
      .then(response => response.json())
      .then(data => {
         return data;
      })
      .catch(error => {
         console.error("Error deducting spins:", error);
      });
  }

  // Izsaucam, lai sākumā ielādē atlikušos griezienus
  fetchRemainingSpins();

  // ===== Spēles loģika =====
  const emojiSet = ['🍒', '🍋', '🍊', '🍉', '🍇', '⭐', '🔔', '7️⃣'];
  const numReels = 5;
  const reels = [];
  const spinIntervals = [];
  let reelsStopped = 0;
  const spinButton = document.getElementById("spinButton");
  const messageDiv = document.getElementById("message");
  const multiplierSelect = document.getElementById("multiplierSelect");

  // Inicializējam reelu sākuma simbolus
  for (let i = 0; i < numReels; i++) {
    reels[i] = {
      currentIndex: Math.floor(Math.random() * emojiSet.length),
      spinning: false
    };
    updateReelDisplay(i);
  }

  // Pogu notikums – sāk griešanās un atskaita griezienus
  spinButton.addEventListener("click", function() {
    const multiplier = parseInt(multiplierSelect.value, 10) || 1;
    // Veicam atskaitīšanu Google Sheets (ja tas izdevās, atjaunojam atlikumu)
    deductSpins(multiplier).then(() => {
      fetchRemainingSpins();
    });
    spinButton.disabled = true;
    messageDiv.textContent = "";
    reelsStopped = 0;
    for (let i = 0; i < numReels; i++) {
      // Katram reēlam griešanās ilgums: 2000ms + (i * 500ms)
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
    // Izvēlam pēdējo simbolu nejauši
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
    const counts = {};
    results.forEach(symbol => {
      counts[symbol] = (counts[symbol] || 0) + 1;
    });
    let win = false;
    for (const key in counts) {
      if (counts[key] >= 3) {
        win = true;
        break;
      }
    }
    messageDiv.textContent = win ? "Uzvara!" : "Zaudēji!";
  }
});
