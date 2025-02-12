document.addEventListener("DOMContentLoaded", function() {
  // Audio objekti – pārliecinies, ka šie MP3 faili (griez.mp3, win.mp3, winbig.mp3, lose.mp3) ir pieejami
  const spinSound = new Audio('griez.mp3');
  const winSound = new Audio('win.mp3');
  const winBigSound = new Audio('winbig.mp3');
  const loseSound = new Audio('lose.mp3');

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
    // Deklarējam script pirms funkcijas, lai būtu pieejams callback funkcijā
    const script = document.createElement("script");
    window[callbackName] = function(data) {
      remainingSpinsDiv.textContent = (data && data.K !== undefined) ? "🪙 " + data.K : "🪙 N/A";
      remainingSpinsDiv.classList.add("animateSpin");
      setTimeout(() => remainingSpinsDiv.classList.remove("animateSpin"), 500);
      script.remove();
      delete window[callbackName];
    };
    const url = sheetUrlBase + "?uid=" + encodeURIComponent(uid) + "&callback=" + callbackName;
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
    const script = document.createElement("script");
    window[callbackName] = function(data) {
      callback(data);
      script.remove();
      delete window[callbackName];
    };
    const url = sheetUrlBase + "?uid=" + encodeURIComponent(uid) + "&deduct=" + amount + "&callback=" + callbackName;
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

  // Kad griešanās sākas – paslēpj rezultāta lauku un atskaņo spinSound
  spinButton.addEventListener("click", function() {
    messageDiv.textContent = "";
    spinSound.loop = true;
    spinSound.play();
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
    if (reelsStopped === numReels) { 
      spinSound.pause(); 
      spinSound.currentTime = 0;
      checkResult(); 
      spinButton.disabled = false; 
    }
  }

  function updateReelDisplay(reelIndex) {
    const reel = reels[reelIndex];
    const top = (reel.currentIndex - 1 + emojiSet.length) % emojiSet.length;
    const bottom = (reel.currentIndex + 1) % emojiSet.length;
    document.getElementById("reel" + reelIndex + "-symbol0").textContent = emojiSet[top];
    document.getElementById("reel" + reelIndex + "-symbol1").textContent = emojiSet[reel.currentIndex];
    document.getElementById("reel" + reelIndex + "-symbol2").textContent = emojiSet[bottom];
  }

  // Jaunā uzvaras/laužu loģika:
  // 2 vienādi → zaudējums (likme×1)
  // 2+2 vienādi → likme×3
  // 3 vienādi (bez pāra) → likme×10
  // 3+2 vienādi → likme×25
  // 4 vienādi → likme×100
  // 5 vienādi → spēlētājs ievada vērtību
  function checkResult() {
    const results = [];
    for (let i = 0; i < numReels; i++) {
      results.push(document.getElementById("reel" + i + "-symbol1").textContent);
    }
    // Saskaitām simbolus
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
      // 5 vienādi – paša ievade
      let customWin = parseInt(window.prompt("Ievadi savu laimesta vērtību:"), 10);
      if (isNaN(customWin) || customWin <= 0) { 
        customWin = chosenMultiplier * 1000;
      }
      winFactor = null;
      var resultAmount = customWin;
      deductSpins(-resultAmount, function() {
        fetchRemainingSpins();
        messageDiv.textContent = "+" + resultAmount;
        messageDiv.classList.add("animateResult");
        setTimeout(() => messageDiv.classList.remove("animateResult"), 500);
        winBigSound.play();
      });
      return;
    } else if (maxCount === 4) {
      winFactor = 100;
    } else if (maxCount === 3) {
      if (Object.values(counts).includes(2)) {
        winFactor = 25;
      } else {
        winFactor = 10;
      }
    } else {
      // maxCount < 3 (1 vai 2 vienādi) – zaudējums
      const resultAmount = stake * chosenMultiplier;
      messageDiv.textContent = "-" + resultAmount;
      messageDiv.classList.add("animateResult");
      setTimeout(() => messageDiv.classList.remove("animateResult"), 500);
      loseSound.play();
      return;
    }
    
    const resultAmount = stake * chosenMultiplier * winFactor;
    deductSpins(-resultAmount, function() {
      fetchRemainingSpins();
      messageDiv.textContent = "+" + resultAmount;
      messageDiv.classList.add("animateResult");
      setTimeout(() => messageDiv.classList.remove("animateResult"), 500);
      winSound.play();
    });
  }
});
