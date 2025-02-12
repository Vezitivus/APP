document.addEventListener("DOMContentLoaded", function() {
  // Iegūst uid no URL: vispirms pārbauda query parametrus, tad pēdējo ceļa segmentu.
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

  // Google Apps Script web app URL (izmanto JSONP, lai izvairītos no CORS problēmām)
  const sheetUrlBase = "https://script.google.com/macros/s/AKfycbyS8FWFUDIInu7NFBxa8BP2qGeoLdoLdIxRVs-aL8ss9umKeGU88D17QHSlPVb2z7o5qQ/exec";
  const remainingSpinsDiv = document.getElementById("remainingSpins");

  // Iegūst atlikušos griezienus, izmantojot JSONP pieeju
  function fetchRemainingSpins() {
    if (!uid) {
      remainingSpinsDiv.textContent = "🪙 N/A";
      return;
    }
    const callbackName = "handleSpinResponse";
    window[callbackName] = function(data) {
      if (data && data.K !== undefined) {
        remainingSpinsDiv.textContent = "🪙 " + data.K;
      } else {
        remainingSpinsDiv.textContent = "🪙 N/A";
      }
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

  // Atskaita griezienus (ar reizinātāju) un izsauc callback, kad atbilde ir saņemta.
  function deductSpins(multiplier, callback) {
    if (!uid) return callback();
    const callbackName = "handleDeductResponse";
    window[callbackName] = function(data) {
      callback(data);
      script.remove();
      delete window[callbackName];
    };
    const url = sheetUrlBase + "?uid=" + encodeURIComponent(uid) + "&deduct=" + multiplier + "&callback=" + callbackName;
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

  // Sākotnēji ielādē atlikušos griezienus.
  fetchRemainingSpins();

  // Spēles loģika
  const emojiSet = ['🍒', '🍋', '🍊', '🍉', '🍇', '⭐', '🔔', '7️⃣'];
  const numReels = 5;
  const reels = [];
  const spinIntervals = [];
  let reelsStopped = 0;
  const spinButton = document.getElementById("spinButton");
  const messageDiv = document.getElementById("message");
  const multiplierSelect = document.getElementById("multiplierSelect");

  // Inicializē katru reeli ar nejaušu sākuma simbolu
  for (let i = 0; i < numReels; i++) {
    reels[i] = {
      currentIndex: Math.floor(Math.random() * emojiSet.length),
      spinning: false
    };
    updateReelDisplay(i);
  }

  // Pogas "Kruķīt" notikums: atskaita griezienus pēc izvēlētā reizinātāja un sāk animāciju.
  spinButton.addEventListener("click", function() {
    const multiplier = parseInt(multiplierSelect.value, 10) || 1;
    deductSpins(multiplier, function(response) {
      fetchRemainingSpins();
    });
    spinButton.disabled = true;
    messageDiv.textContent = "";
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
    setTimeout(function() {
      stopSpinning(reelIndex);
    }, duration);
  }

  function stopSpinning(reelIndex) {
    clearInterval(spinIntervals[reelIndex]);
    reels[reelIndex].spinning = false;
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

  // Jaunā uzvaras/laužu loģika:
  function checkResult() {
    // Iegūst rezultātu – centra simboli visos reelos.
    const results = [];
    for (let i = 0; i < numReels; i++) {
      results.push(document.getElementById("reel" + i + "-symbol1").textContent);
    }
    // Izveido skaitītāju ar katra simbola reižu skaitu.
    const counts = {};
    results.forEach(symbol => {
      counts[symbol] = (counts[symbol] || 0) + 1;
    });
    // Atrodam maksimālo reižu skaitu un attiecīgo simbolu.
    let maxCount = 0;
    let winningSymbol = null;
    for (const sym in counts) {
      if (counts[sym] > maxCount) {
        maxCount = counts[sym];
        winningSymbol = sym;
      }
    }
    const multiplier = parseInt(multiplierSelect.value, 10) || 1;
    let refund = 0;
    let winMessage = "";
    
    if (maxCount === 5) {
      refund = multiplier * 1000;
      winMessage = "Uzvara! 5 vienādi! Griezieni atgūti: +" + refund;
    } else if (maxCount === 4) {
      refund = multiplier * 50;
      winMessage = "Uzvara! 4 vienādi! Griezieni atgūti: +" + refund;
    } else if (maxCount === 3) {
      // Ja ir 3 vienādi, tad pārbaudām atlikušos 2 simbolus.
      const others = results.filter(x => x !== winningSymbol);
      if (others.length === 2) {
        if (others[0] === others[1]) {
          refund = multiplier * 10;
          winMessage = "Uzvara! 3 vienādi ar 2 vienādiem! Griezieni atgūti: +" + refund;
        } else {
          refund = multiplier * 3;
          winMessage = "Uzvara! 3 vienādi ar 2 dažādiem! Griezieni atgūti: +" + refund;
        }
      } else {
        winMessage = "Uzvara! Bet īpašā kombinācija nav sasniegta.";
      }
    } else if (maxCount === 2) {
      refund = 1;
      winMessage = "Zaudēji, bet 2 vienādi – atgūsti 1 griezienu: +" + refund;
    } else {
      winMessage = "Zaudēji!";
    }
    
    messageDiv.textContent = winMessage;
  }
});
