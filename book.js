document.addEventListener("DOMContentLoaded", function() {
  // Konfigurācijas parametri
  const symbolHeight = 40; // katra simbola augstums (px)
  const visibleCount = 3;  // redzamo simbolu skaits
  const reelHeight = symbolHeight * visibleCount; // 120px

  // Audio objekti – pārliecinies, ka MP3 faili ir pieejami
  const spinSound = new Audio('griez.mp3');
  const winSound = new Audio('win.mp3');
  const winBigSound = new Audio('winbig.mp3');
  const loseSound = new Audio('lose.mp3');

  // Unikālie emoji (10 gabali)
  const emojiSet = ['🍒','🍋','🍊','🍉','🍇','⭐','🔔','7️⃣','🍀','💎'];
  const repeatCount = 10; // cik reizes atkārto emojiSet
  const reelSymbols = [];
  for (let i = 0; i < repeatCount; i++) {
    reelSymbols.push(...emojiSet);
  }
  const totalSymbols = reelSymbols.length; // 10*10 = 100

  // Servera funkcijas
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
  const remainingSpinsDiv = document.getElementById("remainingSpins");

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

  // Inicializējam reēlus
  const reels = []; // objekti ar elementiem un pašreizējo indexu
  const spinButton = document.getElementById("spinButton");
  const messageDiv = document.getElementById("message");
  const multiplierSelect = document.getElementById("multiplierSelect");

  // Katrs reelis: ielādējam reel-inner saturu un izvēlam sākuma indexu
  const reelsContainer = document.getElementById("reels");
  for (let i = 0; i < reelsContainer.children.length; i++) {
    const reelElem = reelsContainer.children[i];
    const innerElem = reelElem.querySelector('.reel-inner');
    // Aizpildām innerElem ar simboliem
    innerElem.innerHTML = "";
    reelSymbols.forEach(sym => {
      const div = document.createElement("div");
      div.className = "symbol";
      div.textContent = sym;
      innerElem.appendChild(div);
    });
    // Izvēlam sākuma indexu nejauši, bet centrinot to (vēlamies, lai aktīvā pozīcija būtu vidū)
    // Mēs vēlamies, lai aktīvais simbols atbilstu rādītājam "1" (vidus) – tādēļ izvēlam index, kas ir vidū atkārtojumu masīvā.
    const midRep = Math.floor(repeatCount / 2);
    const randUnique = Math.floor(Math.random() * emojiSet.length);
    const startIndex = midRep * emojiSet.length + randUnique;
    // Aprēķinām sākuma offset, lai simbola top būtu 40px (aktīvā simbola top)
    const initOffset = 40 - startIndex * symbolHeight;
    innerElem.style.transform = `translateY(${initOffset}px)`;
    // Saglabājam reēla objektu
    reels.push({ innerElem: innerElem, currentIndex: startIndex, offset: initOffset, isDragging: false });
    addDragListeners(reelElem, innerElem, reels[reels.length - 1]);
  }

  // Manuālais vilkšanas mehānisms – ļauj vilkt reēlus un "snap" pie simbola robežām
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
      // Snap to nearest symbol: aprēķina aktīvā simbola rindu
      let r = Math.round((40 - reelObj.offset) / symbolHeight);
      reelObj.offset = 40 - r * symbolHeight;
      innerElem.style.transition = "transform 0.3s ease-out";
      innerElem.style.transform = `translateY(${reelObj.offset}px)`;
      reelObj.currentIndex = r;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    reelElem.addEventListener("mousedown", onMouseDown);
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
      let r = Math.round((40 - reelObj.offset) / symbolHeight);
      reelObj.offset = 40 - r * symbolHeight;
      innerElem.style.transition = "transform 0.3s ease-out";
      innerElem.style.transform = `translateY(${reelObj.offset}px)`;
      reelObj.currentIndex = r;
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    }
    reelElem.addEventListener("touchstart", onTouchStart);
  }

  // Spin – automātiska animācija, ja lietotājs netiek manuāli vilkt reēlus
  spinButton.addEventListener("click", function() {
    messageDiv.textContent = "";
    // Ja kāds reelis tiek vilkts manuāli, to animācija netiek sākta
    spinSound.loop = true;
    spinSound.play();
    const chosenMultiplier = parseInt(multiplierSelect.value, 10) || 1;
    deductSpins(chosenMultiplier, function() { fetchRemainingSpins(); });
    spinButton.disabled = true;
    let spinsFinished = 0;
    reels.forEach((reelObj, i) => {
      if (!reelObj.isDragging) {
        spinReel(reelObj, () => {
          spinsFinished++;
          if (spinsFinished === reels.length) {
            spinSound.pause();
            spinSound.currentTime = 0;
            checkResult();
            spinButton.disabled = false;
          }
        });
      }
    });
  });

  // Spin animācija katram reēlam: izvēlam jaunu mērķa indeksu un animējam pārvietošanu
  function spinReel(reelObj, callback) {
    // Izvēlam nejaušu skaitu simbolu, piemēram, 10 līdz 20
    const increments = Math.floor(Math.random() * 11) + 10; // 10–20 simboli
    let newIndex = reelObj.currentIndex + increments;
    // Nodrošinām, ka newIndex ir regulārs (modulo totalSymbols)
    newIndex = newIndex % totalSymbols;
    const newOffset = 40 - newIndex * symbolHeight;
    reelObj.currentIndex = newIndex;
    reelObj.offset = newOffset;
    reelObj.innerElem.style.transition = "transform 2s ease-out";
    reelObj.innerElem.style.transform = `translateY(${newOffset}px)`;
    reelObj.innerElem.addEventListener("transitionend", function handler() {
      reelObj.innerElem.style.transition = "";
      reelObj.innerElem.removeEventListener("transitionend", handler);
      callback();
    });
  }

  // Animē rezultāta klonu, kas parādās centrēti zem reizinātāja (messageDiv) 1 sekundes, tad 2 sekundēs slīd uz remainingSpinsDiv
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
    const activeSymbols = [];
    // Katram reēlam aprēķina aktīvā simbola indeksu kā: (40 - offset) / symbolHeight
    reels.forEach(reelObj => {
      const idx = Math.round((40 - reelObj.offset) / symbolHeight);
      // Izmanto modulo, lai iegūtu unikālo emoji
      const sym = reelSymbols[idx % totalSymbols];
      activeSymbols.push(sym);
    });
    const counts = {};
    activeSymbols.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
    let maxCount = 0;
    for (let s in counts) {
      if (counts[s] > maxCount) { maxCount = counts[s]; }
    }
    const chosenMultiplier = parseInt(multiplierSelect.value, 10) || 1;
    const stake = 1;
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
      if (Object.values(counts).includes(2)) {
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
