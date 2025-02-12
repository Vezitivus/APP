document.addEventListener("DOMContentLoaded", function() {
  // Iegūst uid no URL (query parametri vai pēdējais ceļa segments)
  function getUID() {
    const params = new URLSearchParams(window.location.search);
    let uid = params.get("uid");
    if (!uid) {
      const segments = window.location.pathname.split("/").filter(seg => seg.length > 0);
      uid = segments[segments.length - 1];
    }
    return uid;
  }
  const uid = getUID();

  // Google Apps Script web app URL (izmanto JSONP, lai izvairītos no CORS problēmām)
  const sheetUrlBase = "https://script.google.com/macros/s/AKfycbyS8FWFUDIInu7NFBxa8BP2qGeoLdoLdIxRVs-aL8ss9umKeGU88D17QHSlPVb2z7o5qQ/exec";
  const remainingSpinsDiv = document.getElementById("remainingSpins");

  // Iegūst atlikušos griezienus ar JSONP
  function fetchRemainingSpins() {
    if (!uid) { remainingSpinsDiv.textContent = "🪙 N/A"; return; }
    const callbackName = "handleSpinResponse";
    window[callbackName] = function(data) {
      remainingSpinsDiv.textContent = (data && data.K !== undefined) ? "🪙 " + data.K : "🪙 N/A";
      script.remove();
      delete window[callbackName];
    };
    const url = sheetUrlBase + "?uid=" + encodeURIComponent(uid) + "&callback=" + callbackName;
    const script = document.createElement("script");
    script.src = url;
    script.onerror = function() {
      remainingSpinsDiv.textContent = "🪙 Error";
      script.remove();
      delete window[callbackName];
    };
    document.body.appendChild(script);
  }

  // Atskaita griezienus (ar noteiktu summu) ar JSONP
  function deductSpins(amount, callback) {
    if (!uid) return callback();
    const callbackName = "handleDeductResponse";
    window[callbackName] = function(data) {
      callback(data);
      script.remove();
      delete window[callbackName];
    };
    const url = sheetUrlBase + "?uid=" + encodeURIComponent(uid) + "&deduct=" + amount + "&callback=" + callbackName;
    const script = document.createElement("script");
    script.src = url;
    script.onerror = function() {
      console.error("Error deducting spins");
      callback(null);
      script.remove();
      delete window[callbackName];
    };
    document.body.appendChild(script);
  }

  fetchRemainingSpins();

  // Spēles loģika
  const emojiSet = ['🍒','🍋','🍊','🍉','🍇','⭐','🔔','7️⃣'];
  const numReels = 5;
  const reels = [];
  const spinIntervals = [];
  let reelsStopped = 0;
  const spinButton = document.getElementById("spinButton");
  const messageDiv = document.getElementById("message");
  const multiplierSelect = document.getElementById("multiplierSelect");

  // Inicializē reelu sākuma simbolus
  for (let i = 0; i < numReels; i++) {
    reels[i] = { currentIndex: Math.floor(Math.random() * emojiSet.length), spinning: false };
    updateReelDisplay(i);
  }

  spinButton.addEventListener("click", function() {
    const chosenMultiplier = parseInt(multiplierSelect.value, 10) || 1;
    // Noņem likmi pirms griešanās
    deductSpins(chosenMultiplier, function() { fetchRemainingSpins(); });
    spinButton.disabled = true;
    reelsStopped = 0;
    for (let i = 0; i < numReels; i++) {
      startSpinning(i, 2000 + i * 500);
    }
  });

  function startSpinning(reelIndex, duration) {
    reels[reelIndex].spinning = true;
    spinIntervals[reelIndex] = setInterval(function() {
      reels[reelIndex].currentIndex = (reels[reelIndex].currentIndex + 1) % emojiSet.length;
      updateReelDisplay(reelIndex);
    }, 100);
    setTimeout(function() { stopSpinning(reelIndex); }, duration);
  }

  function stopSpinning(reelIndex) {
    clearInterval(spinIntervals[reelIndex]);
    reels[reelIndex].spinning = false;
    reels[reelIndex].currentIndex = Math.floor(Math.random() * emojiSet.length);
    updateReelDisplay(reelIndex);
    reelsStopped++;
    if (reelsStopped === numReels) { checkResult(); spinButton.disabled = false; }
  }

  function updateReelDisplay(reelIndex) {
    const reel = reels[reelIndex];
    const top = (reel.currentIndex - 1 + emojiSet.length) % emojiSet.length;
    const bottom = (reel.currentIndex + 1) % emojiSet.length;
    document.getElementById("reel" + reelIndex + "-symbol0").textContent = emojiSet[top];
    document.getElementById("reel" + reelIndex + "-symbol1").textContent = emojiSet[reel.currentIndex];
    document.getElementById("reel" + reelIndex + "-symbol2").textContent = emojiSet[bottom];
  }

  // Jaunā uzvaras/laužu loģika
  function checkResult() {
    const results = [];
    for (let i = 0; i < numReels; i++) {
      results.push(document.getElementById("reel" + i + "-symbol1").textContent);
    }
    // Izveidojam skaitītāju
    const counts = {};
    results.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
    let maxCount = 0, winSymbol = null;
    for (let s in counts) {
      if (counts[s] > maxCount) { maxCount = counts[s]; winSymbol = s; }
    }
    const chosenMultiplier = parseInt(multiplierSelect.value, 10) || 1;
    const stake = 1; // likme
    let winFactor = 0;
    
    if (maxCount === 5) {
      // Ja 5 vienādi, parādās ievades logs, kur spēlētājs ievada savu laimesta vērtumu.
      let customWin = parseInt(window.prompt("Ievadi savu laimesta vērtību:"), 10);
      if (isNaN(customWin) || customWin <= 0) { 
        // Ja nepareiza vērtība, izmanto noklusējumu (piemēram, chosenMultiplier * 1000)
        customWin = chosenMultiplier * 1000;
      }
      winFactor = null; // lieto customWin
      var resultAmount = customWin;
      // Uzvaras gadījumā rezultāts ir pozitīvs
      deductSpins(-resultAmount, function() {
        fetchRemainingSpins();
        messageDiv.textContent = "+" + resultAmount;
      });
      return;
    } else if (maxCount === 4) {
      winFactor = 1000;
    } else if (maxCount === 3) {
      if (Object.values(counts).includes(2)) {
        winFactor = 250;
      } else {
        winFactor = 50;
      }
    } else if (maxCount === 2) {
      // Skaitām pārus
      const pairCount = Object.values(counts).filter(x => x === 2).length;
      if (pairCount === 2) {
        winFactor = 10;
      } else {
        winFactor = 3;
      }
    } else { // maxCount === 1
      // Nav uzvaras – zaude
      const resultAmount = stake * chosenMultiplier;
      messageDiv.textContent = "-" + resultAmount;
      return;
    }
    
    // Aprēķinām rezultātu (ja winFactor ir definēts)
    const resultAmount = stake * chosenMultiplier * winFactor;
    deductSpins(-resultAmount, function() {
      fetchRemainingSpins();
      messageDiv.textContent = "+" + resultAmount;
    });
  }
});
