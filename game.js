<!DOCTYPE html>
<html lang="lv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SOLO GAMES</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0; padding: 16px;
      background: #000; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
      display: flex; justify-content: center;
    }
    .container {
      width: 100%; max-width: 480px;
      background: #111; border-radius: 12px;
      padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    h1 {
      margin: 0 0 24px;
      font-size: 2.5rem; font-weight: bold;
      text-align: center; line-height: 1.2;
    }
    .row { margin-bottom: 20px; }
    select, input[type="number"] {
      width: 100%; padding: 12px;
      font-size: 1rem; border: none;
      border-radius: 8px; background: #222;
      color: #fff; outline: none;
    }
    .players-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 12px; margin-bottom: 20px;
    }
    .player-column input:first-child,
    .player-column select {
      margin-bottom: 8px;
    }
    #submitBtn {
      width: 100%; padding: 14px;
      font-size: 1.1rem; border: none;
      border-radius: 10px; background: #1a1a1a;
      color: #fff; cursor: pointer;
      transition: background-color .2s;
    }
    #submitBtn:hover:not(:disabled) { background: #333; }
    #submitBtn:disabled { opacity: 0.6; cursor: default; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="container">
    <h1>SOLO GAMES</h1>

    <!-- 1) Spēļu izvēle -->
    <div class="row">
      <select id="gameSelect">
        <option value="" disabled selected>Izvēlies spēli</option>
      </select>
    </div>

    <!-- 2+3) Spēlētāji un viņu punkti -->
    <div id="playersGrid" class="players-grid hidden">
      <div class="player-column">
        <select id="player1">
          <option value="" disabled selected>Spēlētājs 1</option>
        </select>
        <input type="number" id="score1" placeholder="Punkti" min="0" disabled>
      </div>
      <div class="player-column">
        <select id="player2">
          <option value="" disabled selected>Spēlētājs 2</option>
        </select>
        <input type="number" id="score2" placeholder="Punkti" min="0" disabled>
      </div>
    </div>

    <!-- 4) Nosūtīšanas poga -->
    <button id="submitBtn" class="hidden" disabled>Nosūtīt rezultātus</button>
  </div>

  <script>
    const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxIUgMyljIg79EVd2vC_BkEW-lOLteOkjjJbjEIaoE632jxUujKkNC3i-MmH7xgChP4/exec';
    let gamesData = [];

    // 1) JSONP ielāde spēlēm
    function gamesCallback(data) {
      gamesData = data;
      const sel = document.getElementById('gameSelect');
      data.forEach(({name}) => {
        const o = document.createElement('option');
        o.value = name; o.textContent = name;
        sel.appendChild(o);
      });
    }
    function loadGames() {
      const s = document.createElement('script');
      s.src = `${WEBAPP_URL}?callback=gamesCallback`;
      document.body.appendChild(s);
    }
    document.addEventListener('DOMContentLoaded', loadGames);

    // Elementi
    const gameSelect  = document.getElementById('gameSelect');
    const playersGrid = document.getElementById('playersGrid');
    const player1     = document.getElementById('player1');
    const player2     = document.getElementById('player2');
    const score1      = document.getElementById('score1');
    const score2      = document.getElementById('score2');
    const submitBtn   = document.getElementById('submitBtn');

    // 2) Kad spēle izvēlēta → pildām <select> un parādam spēlētāju bloku
    gameSelect.addEventListener('change', () => {
      const selData = gamesData.find(g => g.name === gameSelect.value);
      [player1, player2].forEach(sel => {
        // notīrām vecās iespējas, atstājam pirmo placeholder
        for (let i = sel.options.length - 1; i > 0; i--) {
          sel.remove(i);
        }
        // pievienojam jaunus spēlētājus
        selData.players.forEach(p => {
          const o = new Option(p, p);
          sel.add(o);
        });
        sel.selectedIndex = 0;
      });
      [score1, score2].forEach(i => { i.value = ''; i.disabled = true; });
      submitBtn.disabled = true; submitBtn.classList.add('hidden');
      playersGrid.classList.remove('hidden');
    });

    // 3) Aktivizē punktu ievades laukus
    function checkPlayers() {
      if (player1.value && player2.value && player1.value !== player2.value) {
        score1.disabled = score2.disabled = false;
      } else {
        score1.disabled = score2.disabled = true;
        submitBtn.disabled = true; submitBtn.classList.add('hidden');
      }
    }
    player1.addEventListener('change', checkPlayers);
    player2.addEventListener('change', checkPlayers);

    // 4) Parāda pogu, kad abi punkti ievadīti
    function checkScores() {
      if (score1.value !== '' && score2.value !== '') {
        submitBtn.classList.remove('hidden');
        submitBtn.disabled = false;
      } else {
        submitBtn.classList.add('hidden');
        submitBtn.disabled = true;
      }
    }
    score1.addEventListener('input', checkScores);
    score2.addEventListener('input', checkScores);

    // 5) JSONP iesūtīšana
    function submitCallback(resp) {
      if (resp.status === 'success') {
        alert('Rezultāti saglabāti!');
        [score1, score2].forEach(i => i.value = '');
        submitBtn.disabled = true; submitBtn.classList.add('hidden');
      } else {
        alert('Kļūda: ' + resp.message);
      }
    }
    submitBtn.addEventListener('click', () => {
      const s1 = +score1.value, s2 = +score2.value;
      const params = [
        'callback=submitCallback',
        'game='          + encodeURIComponent(gameSelect.value),
        'winner='        + encodeURIComponent(s1 > s2 ? player1.value : player2.value),
        'loser='         + encodeURIComponent(s1 > s2 ? player2.value : player1.value),
        'winnerPoints='  + encodeURIComponent(Math.max(s1, s2)),
        'loserPoints='   + encodeURIComponent(Math.min(s1, s2))
      ].join('&');
      const s = document.createElement('script');
      s.src = `${WEBAPP_URL}?${params}`;
      document.body.appendChild(s);
    });
  </script>
</body>
</html>
