document.addEventListener("DOMContentLoaded", function() {
  // Audio objekti – pārliecinies, ka MP3 faili (griez.mp3, win.mp3, winbig.mp3, lose.mp3) ir pieejami
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
  // Palielināts emojiSet uz 10 emoji
  const emojiSet = ['🍒','🍋','🍊','🍉','🍇','⭐','🔔','7️⃣','🍀','💎'];
  const numReels = 5;
  const reels = [];
  const spinIntervals = [];
  let reelsStopped = 0;
  const spinButton = document.getElementById("spinButton");
  const messageDiv = document.getElementById("message");
  const multiplierSelect = document.getElementById("multiplierSelect");

  // Inicializē katra reela sākuma simbolu
  for (let i = 0; i < numReels; i++) {
    reels[i] = { currentIndex: Math.floor(Math.random() * emojiSet.length), spinning: false };
    updateReelDisplay(i);
  }

  // Funkcija, kas simulē aktīvā simbola slidināšanu (slide up)
  function updateActiveSymbol(reelIndex, newEmoji) {
    const activeElem = document.getElementById("reel" + reelIndex + "-symbol1");
    activeElem.style.transition = "transform 0.5s ease-out";
    activeElem.style.transform = "translateY(-40px)";
    setTimeout(() => {
      activeElem.textContent = newEmoji;
      activeElem.style.transition = "";
      activeElem.style.transform = "translateY(0)";
    }, 500);
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
    // Izmanto setInterval ik 500ms, lai aktivā simbola elementam pielietotu sliding animāciju
    for (let i = 0; i < numReels; i++) {
      startSpinning(i, 4000 + i * 500); // ilgāka griešanās laika, lai animācija būtu redzama
    }
  });

  function startSpinning(reelIndex, duration) {
    reels[reelIndex].spinning = true;
    // Izmanto setInterval ik 500ms, lai simulētu slide – katru reizi mainām simbolu ar animāciju
    spinIntervals[reelIndex] = setInterval(function() {
      reels[reelIndex].currentIndex = (reels[reelIndex].currentIndex + 1) % emojiSet.length;
      updateActiveSymbol(reelIndex, emojiSet[reels[reelIndex].currentIndex]);
    }, 500);
    setTimeout(function() { stopSpinning(reelIndex); }, duration);
  }

  function stopSpinning(reelIndex) {
    clearInterval(spinIntervals[reelIndex]);
    reels[reelIndex].spinning = false;
    // Pēdējais slide efektu – mēs varam palaist updateActiveSymbol, lai noslēgtu animāciju
    updateActiveSymbol(reelIndex, emojiSet[reels[reelIndex].currentIndex]);
    reelsStopped++;
    if (reelsStopped === numReels) { 
      spinSound.pause(); 
      spinSound.currentTime = 0;
      checkResult(); 
      spinButton.disabled = false; 
    }
  }

  function updateReelDisplay(reelIndex) {
    // Atjaunina visus trīs simbolus (top, active, bottom) bez animācijas, kad sākas griešanās
    const activeElem = document.getElementById("reel" + reelIndex + "-symbol1");
    activeElem.textContent = emojiSet[reels[reelIndex].currentIndex];
    const topElem = document.getElementById("reel" + reelIndex + "-symbol0");
    topElem.textContent = emojiSet[(reels[reelIndex].currentIndex - 1 + emojiSet.length) % emojiSet.length];
    const bottomElem = document.getElementById("reel" + reelIndex + "-symbol2");
    bottomElem.textContent = emojiSet[(reels[reelIndex].currentIndex + 1) % emojiSet.length];
  }

  // Funkcija, kas animē rezultāta klonu no messageDiv uz remainingSpinsDiv:
  // Pirmā daļa: rezultāts parādās centrēti zem reizinātāja un noturās 1 sekundes.
  // Tad, 2 sekundes laikā, tas pārvietojas uz remainingSpinsDiv pozīciju.
  function animateResultToCoin(resultText) {
    const clone = messageDiv.cloneNode(true);
    clone.textContent = resultText;
    clone.style.position = "absolute";
    const msgRect = messageDiv.getBoundingClientRect();
    const containerRect = messageDiv.parentElement.getBoundingClientRect();
    clone.style.left = (msgRect.left - containerRect.left) + "px";
    clone.style.top = (msgRect.top - containerRect.top) + "px";
    clone.style.margin = "0";
    clone.style.transition = "none";
    messageDiv.parentElement.appendChild(clone);
    // Notur 1 sekundes
    setTimeout(() => {
      clone.style.transition = "all 2s ease-out";
      const coinRect = remainingSpinsDiv.getBoundingClientRect();
      const deltaX = coinRect.left - msgRect.left;
      const deltaY = coinRect.top - msgRect.top;
      clone.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.5)`;
      clone.style.opacity = "0";
    }, 1000);
    clone.addEventListener("transitionend", function() {
      clone.remove();
    });
  }

  // Uzvaras/laužu loģika:
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
      const resultAmount = customWin;
      deductSpins(-resultAmount, function() {
        fetchRemainingSpins();
        animateResultToCoin("+" + resultAmount);
        winBigSound.play();
      });
      return;
    } else if (maxCount === 4) {
      winFactor = 100;
    } else if (maxCount === 3) {
      if (Object.values(counts).includes(2)) { // 3+2 vienādi
        winFactor = 25;
      } else {
        winFactor = 10;
      }
    } else {
      // maxCount < 3 (1 vai 2 vienādi) – zaudējums
      const resultAmount = stake * chosenMultiplier;
      animateResultToCoin("-" + resultAmount);
      loseSound.play();
      return;
    }
    
    const resultAmount = stake * chosenMultiplier * winFactor;
    deductSpins(-resultAmount, function() {
      fetchRemainingSpins();
      animateResultToCoin("+" + resultAmount);
      winSound.play();
    });
  }
});
