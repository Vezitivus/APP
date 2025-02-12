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

  // Pogas "Kruķīt" notikums: noņem griezienus pēc izvēlētā reizinātāja un sāk animāciju.
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
