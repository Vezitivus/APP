document.addEventListener("DOMContentLoaded", function() {
  // Konstantes
  const symbolHeight = 40; // katra simbola augstums (px)
  const visibleCount = 3;  // redzamo simbolu skaits
  const reelHeight = symbolHeight * visibleCount; // 120px

  // Audio objekti – pārliecinies, ka MP3 faili (griez.mp3, win.mp3, winbig.mp3, lose.mp3) ir pieejami
  const spinSound = new Audio('griez.mp3');
  const winSound = new Audio('win.mp3');
  const winBigSound = new Audio('winbig.mp3');
  const loseSound = new Audio('lose.mp3');

  // Emoji masīvs – palielināts uz 10 elementiem
  const emojiSet = ['🍒','🍋','🍊','🍉','🍇','⭐','🔔','7️⃣','🍀','💎'];
  // Izveidojam masīvu, kas atkārto emojiSet 3 reizes, lai reele būtu gluda
  const reelSymbols = emojiSet.concat(emojiSet, emojiSet);
  const totalSymbols = reelSymbols.length; // 30
  const totalHeight = totalSymbols * symbolHeight; // 30*40 = 1200

  const numReels = 5;
  const reels = []; // katram reēlam saglabājam objektu ar rādītājiem

  const spinButton = document.getElementById("spinButton");
  const messageDiv = document.getElementById("message");
  const multiplierSelect = document.getElementById("multiplierSelect");
  const remainingSpinsDiv = document.getElementById("remainingSpins");

  // Servera funkcijas (no iepriekšējā koda)
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
  const sheetUrlBase = "https://script.google.com/macros/s/AKfycbyS8FWFUDIInu7NFBxa8BP2qGeoLdoLdIxRVs-aL8ss9umKeGU88D17QHSlPVb2z7o5qQ/exec";

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

  // Izveidojam reelešu saturu un inicializējam katru reeli
  const reelsContainer = document.getElementById("reels");
  for (let i = 0; i < numReels; i++) {
    const reelElem = reelsContainer.children[i];
    let innerElem = reelElem.querySelector('.reel-inner');
    if (!innerElem) {
      innerElem = document.createElement("div");
      innerElem.className = "reel-inner";
      // Izveidojam simbolus
      reelSymbols.forEach(sym => {
        const symDiv = document.createElement("div");
        symDiv.className = "symbol";
        symDiv.textContent = sym;
        innerElem.appendChild(symDiv);
      });
      reelElem.appendChild(innerElem);
    }
    // Inicializējam nejaušu sākuma pozīciju, sakrītošu ar simbolu
    const randIndex = Math.floor(Math.random() * totalSymbols);
    const initOffset = 40 - randIndex * symbolHeight; // tā, lai aktivā (vidējā) simbola top būtu 40px
    innerElem.style.transform = `translateY(${initOffset}px)`;
    // Saglabājam reēla objektu
    reels.push({ reelElem: reelElem, innerElem: innerElem, offset: initOffset, isDragging: false });
    addDragListeners(reelElem, innerElem, reels[i]);
  }

  // Manuāla vilkšanas funkcionalitāte – ļauj nobraukt katru reeli
  function addDragListeners(reelElem, innerElem, reelObj) {
    let startY = 0;
    let startOffset = 0;
    function onMouseDown(e) {
      reelObj.isDragging = true;
      startY = e.clientY;
      startOffset = reelObj.offset;
      innerElem.style.transition = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }
    function onMouseMove(e) {
      if (!reelObj.isDragging) return;
      const delta = e.clientY - startY;
      reelObj.offset = startOffset + delta;
      innerElem.style.transform = `translateY(${reelObj.offset}px)`;
    }
    function onMouseUp(e) {
      reelObj.isDragging = false;
      reelObj.offset = Math.round(reelObj.offset / symbolHeight) * symbolHeight;
      innerElem.style.transition = "transform 0.3s ease-out";
      innerElem.style.transform = `translateY(${reelObj.offset}px)`;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    reelElem.addEventListener("mousedown", onMouseDown);
    // Touch events
    function onTouchStart(e) {
      reelObj.isDragging = true;
      startY = e.touches[0].clientY;
      startOffset = reelObj.offset;
      innerElem.style.transition = "none";
      document.addEventListener("touchmove", onTouchMove);
      document.addEventListener("touchend", onTouchEnd);
    }
    function onTouchMove(e) {
      if (!reelObj.isDragging) return;
      const delta = e.touches[0].clientY - startY;
      reelObj.offset = startOffset + delta;
      innerElem.style.transform = `translateY(${reelObj.offset}px)`;
    }
    function onTouchEnd(e) {
      reelObj.isDragging = false;
      reelObj.offset = Math.round(reelObj.offset / symbolHeight) * symbolHeight;
      innerElem.style.transition = "transform 0.3s ease-out";
      innerElem.style.transform = `translateY(${reelObj.offset}px)`;
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    }
    reelElem.addEventListener("touchstart", onTouchStart);
  }

  // Spin funkcija: kad spinButton tiek nospiests, ja reelis netiek vilkts manuāli, animē reele
  spinButton.addEventListener("click", function() {
    messageDiv.textContent = "";
    spinSound.loop = true;
    spinSound.play();
    const chosenMultiplier = parseInt(multiplierSelect.value, 10) || 1;
    deductSpins(chosenMultiplier, function() { fetchRemainingSpins(); });
    spinButton.disabled = true;
    let spinningCount = 0;
    reels.forEach((reelObj, i) => {
      if (!reelObj.isDragging) {
        spinReel(reelObj);
        spinningCount++;
      }
    });
  });

  // Spin vienam reēlam: animē reelObj.innerElem, pievienojot nejaušu skaitu simbolu (piemēram, 10–20 simbolus)
  function spinReel(reelObj) {
    const innerElem = reelObj.innerElem;
    const increments = Math.floor(Math.random() * 11) + 10; // 10 līdz 20
    const delta = increments * symbolHeight;
    let newOffset = reelObj.offset - delta; // pārvieto uz augšu
    // Nodrošina nepārtrauktu efektu – ja newOffset pārsniedz limitu, atgriežas
    while (newOffset < - (totalHeight - reelHeight)) {
      newOffset += totalHeight;
    }
    reelObj.offset = newOffset;
    innerElem.style.transition = "transform 2s ease-out";
    innerElem.style.transform = `translateY(${newOffset}px)`;
    innerElem.addEventListener("transitionend", function handler() {
      innerElem.style.transition = "";
      innerElem.removeEventListener("transitionend", handler);
      checkAllSpinsFinished();
    });
  }

  let spinsFinished = 0;
  function checkAllSpinsFinished() {
    spinsFinished++;
    if (spinsFinished >= numReels) {
      spinsFinished = 0;
      spinSound.pause();
      spinSound.currentTime = 0;
      checkResult();
      spinButton.disabled = false;
    }
  }

  // Animē rezultāta klonu, kas parādās zem reizinātāja centrēti 1 sekundes un tad 2 sekundēs slīd uz remainingSpinsDiv
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
    // Turpina 1 sekundes
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

  // Check result: aprēķina aktīvo simbolu kombināciju, izmantojot katra reēla "satriektu" vērtību
  function checkResult() {
    const activeSymbols = [];
    // Aktīvais simbols ir tas, kura virsotne atrodas 40px no reēla augšas (jo redzamais laukums ir 120px, un centrā ir 40px – 80px)
    reels.forEach(reelObj => {
      // Aprēķina aktīvā simbola indeksu: (40 - offset) / symbolHeight
      const index = Math.round((40 - reelObj.offset) / symbolHeight);
      // Izmanto modulo, lai pārvērstu indeksu par vērtību reelSymbols masīvā
      const adjustedIndex = ((index % totalSymbols) + totalSymbols) % totalSymbols;
      activeSymbols.push(reelSymbols[adjustedIndex]);
    });
    // Saskaitām kombināciju
    const counts = {};
    activeSymbols.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
    let maxCount = 0, winSymbol = null;
    for (let s in counts) {
      if (counts[s] > maxCount) { maxCount = counts[s]; winSymbol = s; }
    }
    const chosenMultiplier = parseInt(multiplierSelect.value, 10) || 1;
    const stake = 1; // likme
    let winFactor = 0;
    
    if (maxCount === 5) {
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
