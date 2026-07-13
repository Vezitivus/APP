/**
 * VEZITIVUS — spēļu rezultātu API
 *
 * Dati:
 * - gamehost!F4:AR4      spēļu nosaukumi
 * - gamehost!B6:C1000    spēlētāju ID un vārdi
 * - Komandas!C1004:Q1004 komandu nosaukumi
 * - Komandas!C1005:Q1010 6 spēlētāji zem katras komandas
 */

const SPELES_CONFIG = Object.freeze({
  spreadsheetId: '1KYwqQ4gpwnXuMjNGjET1KnZVh2hmgadAl1rpmCttdnk',

  gamehostSheetName: 'gamehost',
  gameHeaderRow: 4,
  gameStartColumn: 6,   // F
  gameEndColumn: 44,    // AR
  playerStartRow: 6,
  playerEndRow: 1000,
  playerIdColumn: 2,    // B
  playerNameColumn: 3,  // C

  teamsSheetName: 'Komandas',
  teamHeaderRow: 1004,
  teamStartColumn: 3,   // C
  teamEndColumn: 17,    // Q
  teamMemberStartRow: 1005,
  teamMemberCount: 6,

  minTeams: 2,
  maxTeams: 15,
  bootstrapCacheSeconds: 45
});

function doGet(e) {
  const params = (e && e.parameter) || {};
  const callback = String(params.callback || '');

  try {
    return createOutput_(dispatch_(params), callback);
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return createOutput_({
      ok: false,
      error: error && error.message ? error.message : String(error)
    }, callback);
  }
}

function doPost(e) {
  let params = {};

  try {
    if (e && e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      params = e.parameter;
    }

    return createOutput_(dispatch_(params), '');
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return createOutput_({
      ok: false,
      error: error && error.message ? error.message : String(error)
    }, '');
  }
}

function dispatch_(params) {
  const action = String(params.action || 'bootstrap');

  if (action === 'bootstrap') {
    return getBootstrapData_(params.force === '1');
  }

  if (action === 'saveResult') {
    return saveResult_(params);
  }

  if (action === 'ping') {
    return {
      ok: true,
      service: 'vezitivus-speles',
      timestamp: new Date().toISOString()
    };
  }

  throw new Error('Nezināma darbība: ' + action);
}

function getBootstrapData_(forceRefresh) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'speles-bootstrap-v5';

  if (!forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  const gamehostSheet = getRequiredSheet_(SPELES_CONFIG.gamehostSheetName);
  const playerIndex = getPlayerIndex_(gamehostSheet);

  const response = {
    ok: true,
    games: getGames_(gamehostSheet),
    players: playerIndex.players,
    officialTeams: getOfficialTeams_(playerIndex),
    limits: {
      minTeams: SPELES_CONFIG.minTeams,
      maxTeams: SPELES_CONFIG.maxTeams
    },
    timestamp: new Date().toISOString()
  };

  const serialized = JSON.stringify(response);
  if (serialized.length < 95000) {
    cache.put(cacheKey, serialized, SPELES_CONFIG.bootstrapCacheSeconds);
  }

  return response;
}

function getGames_(sheet) {
  const width = SPELES_CONFIG.gameEndColumn - SPELES_CONFIG.gameStartColumn + 1;
  const values = sheet
    .getRange(SPELES_CONFIG.gameHeaderRow, SPELES_CONFIG.gameStartColumn, 1, width)
    .getDisplayValues()[0];

  const games = [];

  values.forEach(function(rawName, index) {
    const name = normalizeText_(rawName);
    if (!name) return;

    const column = SPELES_CONFIG.gameStartColumn + index;

    games.push({
      name: name,
      column: column,
      a1: columnToLetter_(column) + SPELES_CONFIG.gameHeaderRow
    });
  });

  return games;
}

function getPlayerIndex_(sheet) {
  const rowCount = SPELES_CONFIG.playerEndRow - SPELES_CONFIG.playerStartRow + 1;
  const values = sheet
    .getRange(
      SPELES_CONFIG.playerStartRow,
      SPELES_CONFIG.playerIdColumn,
      rowCount,
      2
    )
    .getDisplayValues();

  const players = [];
  const byId = Object.create(null);
  const byName = Object.create(null);

  values.forEach(function(row, index) {
    const id = normalizeText_(row[0]);
    const name = normalizeText_(row[1]);

    if (!id || !name || byId[id]) return;

    const player = {
      id: id,
      name: name,
      row: SPELES_CONFIG.playerStartRow + index
    };

    players.push(player);
    byId[id] = player;

    const nameKey = normalizeKey_(name);
    byName[nameKey] = Object.prototype.hasOwnProperty.call(byName, nameKey)
      ? null
      : player;
  });

  return {
    players: players,
    byId: byId,
    byName: byName
  };
}

function getOfficialTeams_(playerIndex) {
  const sheet = getRequiredSheet_(SPELES_CONFIG.teamsSheetName);
  const width = SPELES_CONFIG.teamEndColumn - SPELES_CONFIG.teamStartColumn + 1;

  const headers = sheet
    .getRange(
      SPELES_CONFIG.teamHeaderRow,
      SPELES_CONFIG.teamStartColumn,
      1,
      width
    )
    .getDisplayValues()[0];

  const memberValues = sheet
    .getRange(
      SPELES_CONFIG.teamMemberStartRow,
      SPELES_CONFIG.teamStartColumn,
      SPELES_CONFIG.teamMemberCount,
      width
    )
    .getDisplayValues();

  const teams = [];

  headers.forEach(function(rawName, columnOffset) {
    const name = normalizeText_(rawName);
    if (!name) return;

    const members = [];
    const unresolved = [];
    const seen = Object.create(null);

    for (let rowOffset = 0; rowOffset < SPELES_CONFIG.teamMemberCount; rowOffset += 1) {
      const rawValue = normalizeText_(memberValues[rowOffset][columnOffset]);
      if (!rawValue) continue;

      const player = resolveTeamMember_(rawValue, playerIndex);

      if (!player) {
        unresolved.push(rawValue);
        continue;
      }

      if (!seen[player.id]) {
        seen[player.id] = true;
        members.push({
          id: player.id,
          name: player.name,
          row: player.row
        });
      }
    }

    teams.push({
      name: name,
      column: SPELES_CONFIG.teamStartColumn + columnOffset,
      members: members,
      unresolved: unresolved
    });
  });

  return teams;
}

function resolveTeamMember_(rawValue, playerIndex) {
  if (playerIndex.byId[rawValue]) return playerIndex.byId[rawValue];

  const exactName = playerIndex.byName[normalizeKey_(rawValue)];
  if (exactName) return exactName;

  const idToken = rawValue.match(
    /(?:^|\s|#|ID[:\s-]*)([A-ZĀČĒĢĪĶĻŅŠŪŽ]{0,5}\d{2,})\b/i
  );

  if (idToken && playerIndex.byId[idToken[1]]) {
    return playerIndex.byId[idToken[1]];
  }

  const candidates = rawValue
    .split(/\s*[|;–—-]\s*/)
    .map(normalizeText_)
    .filter(Boolean);

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];

    if (playerIndex.byId[candidate]) {
      return playerIndex.byId[candidate];
    }

    const byName = playerIndex.byName[normalizeKey_(candidate)];
    if (byName) return byName;
  }

  return null;
}

function saveResult_(params) {
  const mode = String(params.mode || 'players');

  if (mode !== 'players' && mode !== 'officialTeams') {
    throw new Error('Nederīgs disciplīnas veids.');
  }

  const gameColumn = toInteger_(
    params.gameColumn,
    'Nav norādīta spēles kolonna.'
  );

  const gameNameFromClient = normalizeText_(params.gameName);
  const requestId = normalizeText_(params.requestId).slice(0, 100);
  const teams = parseTeamsPayload_(params.teams);

  if (
    gameColumn < SPELES_CONFIG.gameStartColumn ||
    gameColumn > SPELES_CONFIG.gameEndColumn
  ) {
    throw new Error('Izvēlētā spēles kolonna nav diapazonā F:AR.');
  }

  if (
    teams.length < SPELES_CONFIG.minTeams ||
    teams.length > SPELES_CONFIG.maxTeams
  ) {
    throw new Error(
      'Komandu skaitam jābūt no ' +
      SPELES_CONFIG.minTeams +
      ' līdz ' +
      SPELES_CONFIG.maxTeams +
      '.'
    );
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const gamehostSheet = getRequiredSheet_(SPELES_CONFIG.gamehostSheetName);
    const actualGameName = normalizeText_(
      gamehostSheet
        .getRange(SPELES_CONFIG.gameHeaderRow, gameColumn)
        .getDisplayValue()
    );

    if (!actualGameName) {
      throw new Error('Izvēlētajā kolonnā nav spēles nosaukuma.');
    }

    if (gameNameFromClient && actualGameName !== gameNameFromClient) {
      throw new Error(
        'Spēļu saraksts ir mainījies. Atjauno datus un mēģini vēlreiz.'
      );
    }

    const playerIndex = getPlayerIndex_(gamehostSheet);
    const preparedTeams = mode === 'officialTeams'
      ? prepareOfficialTeamsForSave_(teams, playerIndex)
      : preparePlayerTeamsForSave_(teams, playerIndex);

    validateUniquePlayersAcrossTeams_(preparedTeams);

    const columnLetter = columnToLetter_(gameColumn);

    preparedTeams.forEach(function(team) {
      const ranges = team.playerIds.map(function(playerId) {
        return columnLetter + playerIndex.byId[playerId].row;
      });

      gamehostSheet.getRangeList(ranges).setValue(team.score);
    });

    SpreadsheetApp.flush();

    return {
      ok: true,
      mode: mode,
      game: actualGameName,
      gameColumn: gameColumn,
      teamCount: preparedTeams.length,
      teams: preparedTeams.map(function(team) {
        return {
          label: team.label,
          score: team.score,
          playerCount: team.playerIds.length
        };
      }),
      requestId: requestId,
      savedAt: new Date().toISOString()
    };
  } finally {
    lock.releaseLock();
  }
}

function parseTeamsPayload_(value) {
  let parsed;

  try {
    parsed = JSON.parse(String(value || ''));
  } catch (error) {
    throw new Error('Komandu dati nav derīgi.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Komandu dati nav derīgi.');
  }

  return parsed.map(function(team, index) {
    return {
      slot: index + 1,
      score: parseScore_(
        team && team.score,
        'Komandas ' + (index + 1) + ' punkti nav derīgi.'
      ),
      playerIds: Array.isArray(team && team.playerIds)
        ? uniqueTextList_(team.playerIds)
        : [],
      officialTeamColumn:
        team && team.officialTeamColumn !== undefined
          ? Number(team.officialTeamColumn)
          : null,
      officialTeamName: normalizeText_(team && team.officialTeamName)
    };
  });
}

function preparePlayerTeamsForSave_(teams, playerIndex) {
  return teams.map(function(team, index) {
    if (!team.playerIds.length) {
      throw new Error(
        'Komandā ' + (index + 1) + ' nav izvēlēts neviens spēlētājs.'
      );
    }

    const missingIds = team.playerIds.filter(function(id) {
      return !playerIndex.byId[id];
    });

    if (missingIds.length) {
      throw new Error(
        'Google Sheets nav atrasti spēlētāji ar ID: ' +
        missingIds.join(', ')
      );
    }

    return {
      label: 'Komanda ' + (index + 1),
      score: team.score,
      playerIds: team.playerIds
    };
  });
}

function prepareOfficialTeamsForSave_(teams, playerIndex) {
  const officialTeams = getOfficialTeams_(playerIndex);
  const byColumn = Object.create(null);

  officialTeams.forEach(function(team) {
    byColumn[String(team.column)] = team;
  });

  const usedColumns = Object.create(null);

  return teams.map(function(team, index) {
    const column = team.officialTeamColumn;

    if (!Number.isFinite(column) || Math.floor(column) !== column) {
      throw new Error(
        'Komandai ' + (index + 1) + ' nav izvēlēta oficiālā komanda.'
      );
    }

    const officialTeam = byColumn[String(column)];

    if (!officialTeam) {
      throw new Error(
        'Izvēlētā oficiālā komanda vairs nav atrodama lapā "Komandas".'
      );
    }

    if (
      team.officialTeamName &&
      team.officialTeamName !== officialTeam.name
    ) {
      throw new Error(
        'Komandu saraksts ir mainījies. Atjauno datus un mēģini vēlreiz.'
      );
    }

    if (usedColumns[column]) {
      throw new Error(
        'Oficiālā komanda "' +
        officialTeam.name +
        '" izvēlēta vairākas reizes.'
      );
    }

    usedColumns[column] = true;

    if (officialTeam.unresolved.length) {
      throw new Error(
        'Komandai "' +
        officialTeam.name +
        '" nav atrasti šādi spēlētāji gamehost lapā: ' +
        officialTeam.unresolved.join(', ')
      );
    }

    if (!officialTeam.members.length) {
      throw new Error(
        'Komandai "' +
        officialTeam.name +
        '" nav atrasts neviens spēlētājs.'
      );
    }

    return {
      label: officialTeam.name,
      score: team.score,
      playerIds: officialTeam.members.map(function(member) {
        return member.id;
      })
    };
  });
}

function validateUniquePlayersAcrossTeams_(teams) {
  const ownerByPlayer = Object.create(null);

  teams.forEach(function(team, teamIndex) {
    team.playerIds.forEach(function(playerId) {
      if (ownerByPlayer[playerId] !== undefined) {
        throw new Error(
          'Spēlētājs ar ID ' +
          playerId +
          ' ir izvēlēts gan komandā ' +
          (ownerByPlayer[playerId] + 1) +
          ', gan komandā ' +
          (teamIndex + 1) +
          '.'
        );
      }

      ownerByPlayer[playerId] = teamIndex;
    });
  });
}

function uniqueTextList_(values) {
  const seen = Object.create(null);
  const result = [];

  values.forEach(function(value) {
    const text = normalizeText_(value);
    if (!text || seen[text]) return;

    seen[text] = true;
    result.push(text);
  });

  return result;
}

function getRequiredSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.openById(SPELES_CONFIG.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Google Sheets lapa "' + sheetName + '" nav atrasta.');
  }

  return sheet;
}

function parseScore_(value, errorMessage) {
  const normalized = String(value == null ? '' : value)
    .trim()
    .replace(',', '.');

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error(errorMessage);
  }

  const score = Number(normalized);

  if (!isFinite(score) || score < 0) {
    throw new Error(errorMessage);
  }

  return score;
}

function toInteger_(value, errorMessage) {
  const number = Number(value);

  if (!isFinite(number) || Math.floor(number) !== number) {
    throw new Error(errorMessage);
  }

  return number;
}

function normalizeText_(value) {
  return String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey_(value) {
  return normalizeText_(value).toLowerCase();
}

function createOutput_(payload, callback) {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  const safeCallback = /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)
    ? callback
    : '';

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
