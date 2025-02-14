document.addEventListener("DOMContentLoaded", function() {
  // Parametri
  const symbolHeight = 40;
  const repeatCount = 10; // atkārtojam emojiSet 10 reizes
  const spinSound = new Audio('griez.mp3');
  const winSound = new Audio('win.mp3');
  const winBigSound = new Audio('winbig.mp3');
  const loseSound = new Audio('lose.mp3');

  // Izmanto 20 unikālos emoji
  const emojiSet = [
    '🍒','🍋','🍊','🍉','🍇','⭐','🔔','7️⃣','🍀','💎',
    '🍏','🍐','🥝','🥭','🍍','🍓','🥑','🍌','🍈','🍄'
  ];
  const reelSymbols = [];
  for (let i = 0; i < repeatCount; i++) {
    reelSymbols.push(...emojiSet);
  }
  const totalSymbols = reelSymbols.length; // 20 * 10 = 200

  const spinButton = document.getElementById("spinButton");
  const messageDiv = document.getElementById("message");
  const multiplierSelect = document.getElementById("multiplierSelect");
  const reelsContainer = document.getElementById("reels");
  const remainingSpinsDiv = document.getElementById("remainingSpins");
  const container = document.getElementById("container");

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
      if (data && data.K !== undefined) {
        const spinsVal = data.K;
        remainingSpinsDiv.textContent = "🪙 " + spinsVal;
        if (spinsVal < 0) {
          remainingSpinsDiv.style.backgroundColor = "red";
        } else {
          remainingSpinsDiv.style.backgroundColor = "";
        }
        if (spinsVal <= -10000) {
          showDebtPopup();
          spinButton.disabled = true;
          return;
        }
      } else {
        remainingSpinsDiv.textContent = "🪙 N/A";
        remainingSpinsDiv.style.backgroundColor = "";
      }
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

  // Sagatavojam reēlus
  const reels = [];
  for (let i = 0; i < 5; i++) {
    const reelElem = reelsContainer.children[i];
    const innerElem = reelElem.querySelector('.reel-inner');
    innerElem.innerHTML = "";
    reelSymbols.forEach(sym => {
      const div = document.createElement("div");
      div.className = "symbol";
      div.textContent = sym;
      innerElem.appendChild(div);
    });
    const randIndex = Math.floor(Math.random() * totalSymbols);
    const initOffset = 40 - randIndex * symbolHeight;
    innerElem.style.transform = `translateY(${initOffset}px)`;
    const reelObj = { innerElem, offset: initOffset, currentIndex: randIndex, isDragging: false };
    addDragListeners(reelElem, reelObj);
    reels.push(reelObj);
  }

  // Manuālā vilkšana
  function addDragListeners(reelElem, reelObj) {
    let startY = 0, startOffset = 0;
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
  function snapReel(r) {
    let index = Math.round((40 - r.offset) / symbolHeight);
    if (index < 0) index += totalSymbols;
    index = index % totalSymbols;
    r.currentIndex = index;
    r.offset = 40 - index * symbolHeight;
    r.innerElem.style.transition = "transform 0.3s ease-out";
    r.innerElem.style.transform = `translateY(${r.offset}px)`;
  }

  // Spin poga – rulli griežas ilgāk; turpina no iepriekšējās pozīcijas
  spinButton.addEventListener("click", function() {
    messageDiv.textContent = "";
    spinButton.disabled = true;
    container.classList.add("spinning");
    spinSound.loop = true;
    spinSound.play();
    const chosenMultiplier = parseInt(multiplierSelect.value, 10) || 1;
    deductSpins(chosenMultiplier, function() { fetchRemainingSpins(); });
    let finishCount = 0;
    reels.forEach(r => {
      if (!r.isDragging) {
        spinReel(r, () => {
          finishCount++;
          if (finishCount === reels.length) {
            spinSound.pause();
            spinSound.currentTime = 0;
            container.classList.remove("spinning");
            checkResult();
          }
        });
      }
    });
  });
  // Pagarinam griešanās laiku: inkrementi 20..30, pāreja 3 s
  function spinReel(r, done) {
    const increments = Math.floor(Math.random() * 11) + 20; // 20..30
    let newIndex = (r.currentIndex + increments) % totalSymbols;
    r.currentIndex = newIndex;
    r.offset = 40 - newIndex * symbolHeight;
    r.innerElem.style.transition = "transform 3s ease-out";
    r.innerElem.style.transform = `translateY(${r.offset}px)`;
    r.innerElem.addEventListener("transitionend", function handler() {
      r.innerElem.style.transition = "";
      r.innerElem.removeEventListener("transitionend", handler);
      done();
    });
  }
  // Rezultāta animācija: 1 s statiska, tad 1 s animācija uz remainingSpins.
  // Callback izsaukts pēc pilnīgas pārejas (transitionend).
  function animateResultToCoin(resultText, callback) {
    const clone = messageDiv.cloneNode(true);
    clone.textContent = resultText;
    clone.style.position = "absolute";
    clone.style.zIndex = "1";
    const msgRect = messageDiv.getBoundingClientRect();
    const containerRect = messageDiv.parentElement.getBoundingClientRect();
    clone.style.left = (msgRect.left - containerRect.left) + "px";
    clone.style.top = (msgRect.top - containerRect.top) + "px";
    clone.style.margin = "0";
    clone.style.transition = "none";
    messageDiv.parentElement.appendChild(clone);
    // Statiskā fāze 1 s, tad animācija 1 s uz remainingSpins:
    setTimeout(() => {
      clone.style.transition = "all 1s ease-out";
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
  function checkResult() {
    const chosenMultiplier = parseInt(multiplierSelect.value, 10) || 1;
    const stake = 1;
    const activeSymbols = [];
    reels.forEach(r => {
      let idx = Math.round((40 - r.offset) / symbolHeight) % totalSymbols;
      if (idx < 0) idx += totalSymbols;
      activeSymbols.push(reelSymbols[idx]);
    });
    const counts = {};
    let maxCount = 0;
    activeSymbols.forEach(s => {
      counts[s] = (counts[s] || 0) + 1;
      if (counts[s] > maxCount) maxCount = counts[s];
    });
    // Ja vismaz 3 "7️⃣" parādās, aktivizē mini-spēli
    if (counts["7️⃣"] >= 3) {
      triggerMiniGame();
      return;
    }
    let winFactor = 0;
    if (maxCount === 5) {
      let customWin = parseInt(window.prompt("Ievadi savu laimesta vērtību:"), 10);
      if (isNaN(customWin) || customWin <= 0) {
        customWin = chosenMultiplier * 1000;
      }
      const resultAmount = customWin;
      deductSpins(-resultAmount, function() {
        fetchRemainingSpins();
        container.classList.remove("spinning");
        container.classList.add("win");
        animateResultToCoin("+" + resultAmount, function() {
          spinButton.disabled = false;
          setTimeout(() => container.classList.remove("win"), 1500);
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
      const loseAmount = stake * chosenMultiplier;
      container.classList.remove("spinning");
      container.classList.add("loss");
      animateResultToCoin("-" + loseAmount, function() {
        spinButton.disabled = false;
        setTimeout(() => container.classList.remove("loss"), 1500);
      });
      loseSound.play();
      return;
    }
    const resultAmount = stake * chosenMultiplier * winFactor;
    deductSpins(-resultAmount, function() {
      fetchRemainingSpins();
      container.classList.remove("spinning");
      container.classList.add("win");
      animateResultToCoin("+" + resultAmount, function() {
        spinButton.disabled = false;
        setTimeout(() => container.classList.remove("win"), 1500);
      });
      winSound.play();
    });
  }

  // Mini-spēles funkcija – Lucky Puzzle Challenge
  function triggerMiniGame() {
    const overlay = document.createElement("div");
    overlay.id = "miniGameOverlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.85)";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.zIndex = "3000";

    // Izveidojam 3x3 režģi
    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(3, 80px)";
    grid.style.gridTemplateRows = "repeat(3, 80px)";
    grid.style.gap = "10px";

    // Sagatavojam mini-spēles simbolus – divas pāres (piemēram, 💎 un ⭐)
    const miniSymbols = ["💎", "💎", "⭐", "⭐"];
    miniSymbols.sort(() => Math.random() - 0.5);
    
    // Izvēlam nejaušas 4 pozīcijas no 9
    const positions = Array.from({length:9}, (_, i) => i);
    positions.sort(() => Math.random() - 0.5);
    const selectedPositions = positions.slice(0,4);

    const cells = [];
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("div");
      cell.className = "miniCell";
      cell.style.width = "80px";
      cell.style.height = "80px";
      cell.style.border = "2px solid #0af";
      cell.style.borderRadius = "8px";
      cell.style.display = "flex";
      cell.style.justifyContent = "center";
      cell.style.alignItems = "center";
      cell.style.cursor = "pointer";
      cell.style.transition = "border-color 0.3s";
      cell.dataset.flipped = "false";
      if (selectedPositions.includes(i)) {
        const sym = miniSymbols.pop();
        cell.dataset.symbol = sym;
      }
      cell.addEventListener("click", function() {
        if (cell.dataset.flipped === "true") return;
        cell.dataset.flipped = "true";
        cell.textContent = cell.dataset.symbol || "";
        cell.style.borderColor = "#FFD700";
        checkMiniGame();
      });
      cells.push(cell);
      grid.appendChild(cell);
    }
    overlay.appendChild(grid);
    document.body.appendChild(overlay);

    function checkMiniGame() {
      const flipped = cells.filter(cell => cell.dataset.flipped === "true");
      if (flipped.length === 2) {
        const first = flipped[0].dataset.symbol;
        const second = flipped[1].dataset.symbol;
        if (first === second) {
          alert("Apsveicam! Tu ieguvi bonus: 10 papildu griezienus!");
          bonusSpins(10);
        } else {
          alert("Mini-spēle neveiksmīga. Mēģini vēlreiz!");
        }
        cells.forEach(cell => {
          cell.textContent = cell.dataset.symbol || "";
        });
        setTimeout(() => overlay.remove(), 1000);
      }
    }
    
    function bonusSpins(count) {
      console.log("Bonus spins: ", count);
      // Šeit vari nosūtīt pieprasījumu uz serveri vai pievienot bonus loģiku.
    }
  }

  // Ja atlikums sasniedz ≤ -10000, parādām debt paziņojumu un bloķējam spēli.
  function showDebtPopup() {
    const popup = document.createElement("div");
    popup.className = "debtPopup";
    popup.textContent = "Tu esi sasniedzis ārkārtīgi lielu parādu! Apsver iespēju atbalstīt Vezitivus, lai samazinātu savu parādu un turpinātu spēlēt.";
    document.body.appendChild(popup);
    spinButton.disabled = true;
  }

  // Jaunas: Periodiska rezultāta atjaunošana ik pēc 2 sekundēm
  setInterval(() => {
    fetchRemainingSpins();
  }, 200);
});
