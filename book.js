document.addEventListener("DOMContentLoaded", function() {
  // Definējam 8 emoji, kurus izmantojam reelos
  const emojiSet = ['🍒', '🍋', '🍊', '🍉', '🍇', '⭐', '🔔', '7️⃣'];
  const numReels = 5;
  const reels = [];
  const spinIntervals = [];
  let reelsStopped = 0;
  const spinButton = document.getElementById("spinButton");
  const messageDiv = document.getElementById("message");

  // Inicializējam katru reeli ar nejaušu sākuma indeksu
  for (let i = 0; i < numReels; i++) {
    reels[i] = {
      currentIndex: Math.floor(Math.random() * emojiSet.length),
      spinning: false
    };
    updateReelDisplay(i);
  }

  // Pogas notikums, kas uzsāk griešanos
  spinButton.addEventListener("click", function() {
    spinButton.disabled = true;
    messageDiv.textContent = "";
    reelsStopped = 0;
    // Sākt griešanos katram reelim ar nedaudz atšķirīgu ilgumu,
    // lai tie apstātos pa secībai
    for (let i = 0; i < numReels; i++) {
      // Katram reelim griešanās ilgums: 2000ms + (i * 500ms)
      startSpinning(i, 2000 + i * 500);
    }
  });

  // Funkcija, kas sāk griešanos konkrētam reelim
  function startSpinning(reelIndex, duration) {
    reels[reelIndex].spinning = true;
    spinIntervals[reelIndex] = setInterval(function() {
      reels[reelIndex].currentIndex = (reels[reelIndex].currentIndex + 1) % emojiSet.length;
      updateReelDisplay(reelIndex);
    }, 100);

    // Pēc noteikta laika apstādinām griešanos
    setTimeout(function() {
      stopSpinning(reelIndex);
    }, duration);
  }

  // Funkcija, kas apstādina griešanos un izvēlas galīgo simbolu
  function stopSpinning(reelIndex) {
    clearInterval(spinIntervals[reelIndex]);
    reels[reelIndex].spinning = false;
    // Var izvēlēties arī pēdējo griešanās stāvokli, bet šeit nejauši izvēlam gala rezultātu
    reels[reelIndex].currentIndex = Math.floor(Math.random() * emojiSet.length);
    updateReelDisplay(reelIndex);
    reelsStopped++;
    if (reelsStopped === numReels) {
      checkResult();
      spinButton.disabled = false;
    }
  }

  // Atjauno reela vizuālo attēlu: tiek parādīti trīs simboli – augšā, centrā (aktīvais) un apakšā
  function updateReelDisplay(reelIndex) {
    const reel = reels[reelIndex];
    const topIndex = (reel.currentIndex - 1 + emojiSet.length) % emojiSet.length;
    const bottomIndex = (reel.currentIndex + 1) % emojiSet.length;
    document.getElementById("reel" + reelIndex + "-symbol0").textContent = emojiSet[topIndex];
    document.getElementById("reel" + reelIndex + "-symbol1").textContent = emojiSet[reel.currentIndex];
    document.getElementById("reel" + reelIndex + "-symbol2").textContent = emojiSet[bottomIndex];
  }

  // Pārbauda, vai uzvar, skatoties uz visiem "aktīvajiem" (centrālajiem) simboliem
  function checkResult() {
    const results = [];
    for (let i = 0; i < numReels; i++) {
      const symbol = document.getElementById("reel" + i + "-symbol1").textContent;
      results.push(symbol);
    }
    // Saskaita, cik reizes katrs simbols ir parādījies
    const counts = {};
    results.forEach(symbol => {
      counts[symbol] = (counts[symbol] || 0) + 1;
    });
    let win = false;
    for (const key in counts) {
      if (counts[key] >= 3) { // vismaz 3 vienādi – uzvara
        win = true;
        break;
      }
    }
    messageDiv.textContent = win ? "Uzvara!" : "Zaudēji!";
  }
});
