/**
 * VEZITIVUS — spēļu rezultātu API
 * Google Apps Script faila nosaukums: speles.gs
 *
 * Datu avots:
 *   Lapa: gamehost
 *   Spēles: F4:AR4
 *   Spēlētāju ID: B6:B1000
 *   Spēlētāju vārdi: C6:C1000
 */

const SPELES_CONFIG = Object.freeze({
  spreadsheetId: '1KYwqQ4gpwnXuMjNGjET1KnZVh2hmgadAl1rpmCttdnk',
  sheetName: 'gamehost',
  gameHeaderRow: 4,
  gameStartColumn: 6,   // F
  gameEndColumn: 44,    // AR
  playerStartRow: 6,
  playerEndRow: 1000,
  playerIdColumn: 2,    // B
  playerNameColumn: 3,  // C
  bootstrapCacheSeconds: 45
});

function doGet(e) {
  const params = (e && e.parameter) || {};
  const callback = String(params.callback || '');

  try {
    const action = String(params.action || 'bootstrap');
    let result;

    switch (action) {
      case 'bootstrap':
        result = getBootstrapData_(params.force === '1');
        break;
      case 'saveResult':
        result = saveResult_(params);
        break;
      case 'ping':
        result = {
          ok: true,
          service: 'vezitivus-speles',
          timestamp: new Date().toISOString()
        };
        break;
      default:
        throw new Error('Nezināma darbība: ' + action);
    }

    return createOutput_(result, callback);
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return createOutput_({
      ok: false,
      error: error && error.message ? error.message : String(error)
    }, callback);
  }
}

/**
 * POST atbalsts testiem vai citām integrācijām.
 * GitHub HTML izmanto JSONP GET, lai nebūtu CORS problēmu.
 */
function doPost(e) {
  let payload = {};

  try {
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = String(payload.action || '');
    let result;

    if (action === 'saveResult') {
      result = saveResult_(payload);
    } else if (action === 'bootstrap') {
      result = getBootstrapData_(payload.force === '1');
    } else {
      throw new Error('Nezināma darbība: ' + action);
    }

    return createOutput_(result, '');
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return createOutput_({
      ok: false,
      error: error && error.message ? error.message : String(error)
    }, '');
  }
}

function getBootstrapData_(forceRefresh) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'speles-bootstrap-v2';

  if (!forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  const sheet = getGamehostSheet_();
  const gameWidth = SPELES_CONFIG.gameEndColumn - SPELES_CONFIG.gameStartColumn + 1;
  const gameValues = sheet
    .getRange(SPELES_CONFIG.gameHeaderRow, SPELES_CONFIG.gameStartColumn, 1, gameWidth)
    .getDisplayValues()[0];

  const games = [];
  gameValues.forEach(function (rawName, index) {
    const name = normalizeText_(rawName);
    if (!name) return;

    games.push({
      name: name,
      column: SPELES_CONFIG.gameStartColumn + index,
      a1: columnToLetter_(SPELES_CONFIG.gameStartColumn + index) + SPELES_CONFIG.gameHeaderRow
    });
  });

  const playerRowCount = SPELES_CONFIG.playerEndRow - SPELES_CONFIG.playerStartRow + 1;
  const playerValues = sheet
    .getRange(SPELES_CONFIG.playerStartRow, SPELES_CONFIG.playerIdColumn, playerRowCount, 2)
    .getDisplayValues();

  const players = [];
  const seenIds = Object.create(null);

  playerValues.forEach(function (row, index) {
    const id = normalizeText_(row[0]);
    const name = normalizeText_(row[1]);
    if (!id || !name || seenIds[id]) return;

    seenIds[id] = true;
    players.push({
      id: id,
      name: name,
      row: SPELES_CONFIG.playerStartRow + index
    });
  });

  const response = {
    ok: true,
    games: games,
    players: players,
    timestamp: new Date().toISOString()
  };

  const serialized = JSON.stringify(response);
  if (serialized.length < 95000) {
    cache.put(cacheKey, serialized, SPELES_CONFIG.bootstrapCacheSeconds);
  }

  return response;
}

function saveResult_(params) {
  const gameColumn = toInteger_(params.gameColumn, 'Nav norādīta spēles kolonna.');
  const gameNameFromClient = normalizeText_(params.gameName);
  const teamAIds = parseIdList_(params.teamA);
  const teamBIds = parseIdList_(params.teamB);
  const scoreA = parseScore_(params.scoreA, 'Komandas 1 rezultāts nav derīgs.');
  const scoreB = parseScore_(params.scoreB, 'Komandas 2 rezultāts nav derīgs.');
  const requestId = normalizeText_(params.requestId).slice(0, 100);

  if (gameColumn < SPELES_CONFIG.gameStartColumn || gameColumn > SPELES_CONFIG.gameEndColumn) {
    throw new Error('Izvēlētā spēles kolonna nav diapazonā F:AR.');
  }
  if (!teamAIds.length) throw new Error('Komandā 1 nav izvēlēts neviens spēlētājs.');
  if (!teamBIds.length) throw new Error('Komandā 2 nav izvēlēts neviens spēlētājs.');

  const duplicateIds = teamAIds.filter(function (id) { return teamBIds.indexOf(id) !== -1; });
  if (duplicateIds.length) {
    throw new Error('Viens spēlētājs nevar būt abās komandās: ' + duplicateIds.join(', '));
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const sheet = getGamehostSheet_();
    const actualGameName = normalizeText_(sheet.getRange(SPELES_CONFIG.gameHeaderRow, gameColumn).getDisplayValue());
    if (!actualGameName) throw new Error('Izvēlētajā kolonnā nav spēles nosaukuma.');
    if (gameNameFromClient && actualGameName !== gameNameFromClient) {
      throw new Error('Spēļu saraksts ir mainījies. Atjauno datus un mēģini vēlreiz.');
    }

    const playerMap = getPlayerRowMap_(sheet);
    const allIds = teamAIds.concat(teamBIds);
    const missingIds = allIds.filter(function (id) { return !playerMap[id]; });
    if (missingIds.length) {
      throw new Error('Google Sheets nav atrasti spēlētāji ar ID: ' + missingIds.join(', '));
    }

    const teamARanges = teamAIds.map(function (id) {
      return columnToLetter_(gameColumn) + playerMap[id];
    });
    const teamBRanges = teamBIds.map(function (id) {
      return columnToLetter_(gameColumn) + playerMap[id];
    });

    sheet.getRangeList(teamARanges).setValue(scoreA);
    sheet.getRangeList(teamBRanges).setValue(scoreB);
    SpreadsheetApp.flush();

    return {
      ok: true,
      game: actualGameName,
      gameColumn: gameColumn,
      scoreA: scoreA,
      scoreB: scoreB,
      teamAPlayers: teamAIds.length,
      teamBPlayers: teamBIds.length,
      requestId: requestId,
      savedAt: new Date().toISOString()
    };
  } finally {
    lock.releaseLock();
  }
}

function getPlayerRowMap_(sheet) {
  const rowCount = SPELES_CONFIG.playerEndRow - SPELES_CONFIG.playerStartRow + 1;
  const ids = sheet
    .getRange(SPELES_CONFIG.playerStartRow, SPELES_CONFIG.playerIdColumn, rowCount, 1)
    .getDisplayValues();

  const map = Object.create(null);
  ids.forEach(function (row, index) {
    const id = normalizeText_(row[0]);
    if (id && !map[id]) {
      map[id] = SPELES_CONFIG.playerStartRow + index;
    }
  });
  return map;
}

function getGamehostSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPELES_CONFIG.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(SPELES_CONFIG.sheetName);
  if (!sheet) {
    throw new Error('Google Sheets lapa "' + SPELES_CONFIG.sheetName + '" nav atrasta.');
  }
  return sheet;
}

function parseIdList_(value) {
  const seen = Object.create(null);
  return String(value || '')
    .split(',')
    .map(normalizeText_)
    .filter(function (id) {
      if (!id || seen[id]) return false;
      seen[id] = true;
      return true;
    });
}

function parseScore_(value, errorMessage) {
  const normalized = String(value == null ? '' : value).trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error(errorMessage);

  const score = Number(normalized);
  if (!isFinite(score) || score < 0) throw new Error(errorMessage);
  return score;
}

function toInteger_(value, errorMessage) {
  const number = Number(value);
  if (!isFinite(number) || Math.floor(number) !== number) throw new Error(errorMessage);
  return number;
}

function normalizeText_(value) {
  return String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
}

function createOutput_(payload, callback) {
  const json = JSON.stringify(payload).replace(/</g, '\u003c');
  const safeCallback = /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback) ? callback : '';

  if (safeCallback) {
    return ContentService
      .createTextOutput(safeCallback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function columnToLetter_(column) {
  let result = '';
  let current = column;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}
