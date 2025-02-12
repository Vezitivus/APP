document.addEventListener("DOMContentLoaded", function() {
  // Parametri
  const symbolHeight = 40;
  const visibleCount = 3; 
  const repeatCount = 10; // reizinām emojiSet 10 reizes => 100 simboli
  const spinSound = new Audio('griez.mp3');
  const winSound = new Audio('win.mp3');
  const winBigSound = new Audio('winbig.mp3');
  const loseSound = new Audio('lose.mp3');

  // Emoji masīvs (10 unikāli)
  const emojiSet = ['🍒','🍋','🍊','🍉','🍇','⭐','🔔','7️⃣','🍀','💎'];
  const reelSymbols = [];
  for (let i = 0; i < repeatCount; i++) {
    reelSymbols.push(...emojiSet);
  }
  const totalSymbols = reelSymbols.length; // 100

  const spinButton = document.getElementById("spinButton");
  const messageDiv = document.getElementById("message");
  const multiplierSelect = document.getElementById("multiplierSelect");
  const reelsContainer = document.getElementById("reels");
  const remainingSpinsDiv = document.getElementById("remainingSpins");

  // Google Sheets integrācija
  function getUID() {
    const params = new URLSearchParams(window.location.search);
    let uid = params.get("uid");
    if (!uid) {
      const segments = window.location.pathname.split("/").filter(s => s.length > 0);
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

  // Reel sagatavošana
  const reels = [];
  for (let i = 0; i < 5; i++) {
    const reelElem = reelsContainer.children[i];
    const innerElem = reelElem.querySelector('.reel-inner');
    // Piepildām ar 100 simboliem
    innerElem.innerHTML = "";
    reelSymbols.forEach(sym => {
      const div = document.createElement("div");
      div.className = "symbol";
      div.textContent = sym;
      innerElem.appendChild(div);
    });
    // Nejauša sākuma index
    const randIndex = Math.floor(Math.random() * totalSymbols);
    const initOffset = 40 - randIndex * symbolHeight;
    innerElem.style.transform = `translateY(${initOffset}px)`;
    const reelObj = { innerElem, offset: initOffset, currentIndex: randIndex, isDragging: false };
    addDragListeners(reelElem, reelObj);
    reels.push(reelObj);
  }

  function addDragListeners(reelElem, reelObj) {
    let startY = 0;
    let startOffset = 0;
    function onMouseDown(e) {
      reelObj.isDragging = true;
      startY = e.clientY;
      startOffset = reelObj.offset;
      reelObj.innerElem.style.transition = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }
    function onMouseMove(e) {
      if (!reelObj.isDragging) return;
      const delta = e.clientY - startY;
      reelObj.offset = startOffset + delta;
      reelObj.innerElem.style.transform = `translateY(${reelObj.offset}px)`;
    }
    function onMouseUp(e) {
      reelObj.isDragging = false;
      snapReel(reelObj);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    reelElem.addEventListener("mousedown", onMouseDown);

    function onTouchStart(e) {
      reelObj.isDragging = true;
      startY = e.touches[0].clientY;
      startOffset = reelObj.offset;
      reelObj.innerElem.style.transition = "none";
      document.addEventListener("touchmove", onTouchMove);
      document.addEventListener("touchend", onTouchEnd);
    }
    function onTouchMove(e) {
      if (!reelObj.isDragging) return;
      const delta = e.touches[0].clientY - startY;
      reelObj.offset = startOffset + delta;
      reelObj.innerElem.style.transform = `translateY(${reelObj.offset}px)`;
    }
    function onTouchEnd(e) {
      reelObj.isDragging = false;
      snapReel(reelObj);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    }
    reelElem.addEventListener("touchstart", onTouchStart);
  }

  function snapReel(reelObj) {
    let index = Math.round((40 - reelObj.offset) / symbolHeight);
    if (index < 0) index += totalSymbols;
    index = index % totalSymbols;
    reelObj.currentIndex = index;
    reelObj.offset = 40 - index * symbolHeight;
    reelObj.innerElem.style.transition = "transform 0.3s ease-out";
    reelObj.innerElem.style.transform = `translateY(${reelObj.offset}px)`;
  }

  // Spin poga
  spinButton.addEventListener("click", function() {
    messageDiv.textContent = "";
    // Atspējojam pogu
    spinButton.disabled = true;
    spinSound.loop = true;
    spinSound.play();
    const chosenMultiplier = parseInt(multiplierSelect.value, 10) || 1;
    deductSpins(chosenMultiplier, function() {
      fetchRemainingSpins();
    });
    let finishCount = 0;
    reels.forEach(reelObj => {
      if (!reelObj.isDragging) {
        spinReel(reelObj, () => {
          finishCount++;
          if (finishCount === reels.length) {
            spinSound.pause();
            spinSound.currentTime = 0;
            checkResult();
            // Tagad pogu NEiespējosim uzreiz, to darīs animācija beigās
          }
        });
      }
    });
  });

  function spinReel(reelObj, done) {
    // nejaušs increments
    const increments = Math.floor(Math.random() * 11) + 10; // 10..20
    let newIndex = reelObj.currentIndex + increments;
    newIndex = newIndex % totalSymbols;
    reelObj.currentIndex = newIndex;
    reelObj.offset = 40 - newIndex * symbolHeight;
    reelObj.innerElem.style.transition = "transform 2s ease-out";
    reelObj.innerElem.style.transform = `translateY(${reelObj.offset}px)`;
    reelObj.innerElem.addEventListener("transitionend", function handler() {
      reelObj.innerElem.style.transition = "";
      reelObj.innerElem.removeEventListener("transitionend", handler);
      done();
    });
  }

  // Animācija, parādās 1 sekundi, tad 2 sekundes slīd
  // Pievienojam callback, lai kad animācija pabeidzas, ieslēgtu pogu
  function animateResultToCoin(resultText, callback) {
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
    clone.addEventListener("transitionend", function onTransitionEnd() {
      clone.removeEventListener("transitionend", onTransitionEnd);
      clone.remove();
      if (callback) callback();
    });
  }

  // Pārbauda rezultātu
  function checkResult() {
    // Pirmstam atstāj pogu atspējotu
    const chosenMultiplier = parseInt(multiplierSelect.value, 10) || 1;
    const stake = 1;
    const activeSymbols = [];
    reels.forEach(r => {
      let idx = Math.round((40 - r.offset) / symbolHeight) % totalSymbols;
      if (idx < 0) idx += totalSymbols;
      const sym = reelSymbols[idx];
      activeSymbols.push(sym);
    });
    const counts = {};
    let maxCount = 0;
    activeSymbols.forEach(s => {
      counts[s] = (counts[s] || 0) + 1;
      if (counts[s] > maxCount) maxCount = counts[s];
    });
    let winFactor = 0;
    if (maxCount === 5) {
      let customWin = parseInt(window.prompt("Ievadi savu laimesta vērtību:"), 10);
      if (isNaN(customWin) || customWin <= 0) {
        customWin = chosenMultiplier * 1000;
      }
      const resultAmount = customWin;
      deductSpins(-resultAmount, function() {
        fetchRemainingSpins();
        // Kad animācija beidzas, ieslēdz pogu
        animateResultToCoin("+" + resultAmount, function() {
          spinButton.disabled = false;
        });
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
      // zaudējums
      const loseAmount = stake * chosenMultiplier;
      animateResultToCoin("-" + loseAmount, function() {
        spinButton.disabled = false;
      });
      loseSound.play();
      return;
    }
    const resultAmount = stake * chosenMultiplier * winFactor;
    deductSpins(-resultAmount, function() {
      fetchRemainingSpins();
      animateResultToCoin("+" + resultAmount, function() {
        spinButton.disabled = false;
      });
      winSound.play();
    });
  }
});
