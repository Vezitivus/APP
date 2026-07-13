/**
 * GAME ON ONLINE v2 — Google Apps Script backend
 *
 * Katrai spēlei tiek izveidota atsevišķa Google Sheets lapa:
 * GO-<PIN>, piemēram, GO-6969.
 *
 * GAMEON_SPELES lapa tiek izmantota tikai kā spēļu reģistrs.
 * Esošā Lapa1 un tās dati netiek mainīti.
 */

const GAMEON_CONFIG = Object.freeze({
  SPREADSHEET_ID: '1QSKZhnCWaLSQKXKQujIGa16xEjYhfLAhEwx-Ichz1-4',
  INDEX_SHEET_NAME: 'GAMEON_SPELES',
  SHEET_PREFIX: 'GO-',
  APP_ID: 'gameononline-v2',
  CHUNK_SIZE: 44000,
  MAX_PAYLOAD_CHARS: 5000000,
  LOCK_TIMEOUT_MS: 20000,
  META_CACHE_SECONDS: 5
});

const GAMEON_HEADERS = [
  'GAMEON_RECORD',
  'UPDATED_AT',
  'REVISION',
  'CLIENT_ID',
  'PAYLOAD_HASH',
  'CHUNK_COUNT',
  'PAYLOAD_LENGTH',
  'SCHEMA'
];

const INDEX_HEADERS = [
  'PIN',
  'LAPAS_NOSAUKUMS',
  'IZVEIDOTS',
  'ATJAUNOTS',
  'REVĪZIJA'
];

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    authorize_(params);
    const action = String(params.action || 'ping').toLowerCase();
    let result;

    if (action === 'ping') result = {ok: true, service: 'gameononline-v2'};
    else if (action === 'create') result = createGame_(params.pin);
    else if (action === 'meta') result = readMetaByPin_(params.pin);
    else if (action === 'load') result = readSnapshotByPin_(params.pin);
    else throw new Error('Nezināma darbība.');

    result.ok = true;
    result.appId = GAMEON_CONFIG.APP_ID;
    return output_(result, params.prefix);
  } catch (error) {
    return output_({ok: false, error: errorMessage_(error)}, e && e.parameter ? e.parameter.prefix : '');
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const body = parsePostBody_(e);
    authorize_(body);
    if (String(body.action || '').toLowerCase() !== 'save') throw new Error('Nezināma darbība.');

    lock.waitLock(GAMEON_CONFIG.LOCK_TIMEOUT_MS);
    const result = saveSnapshotByPin_(body.pin, body);
    return output_({
      ok: true,
      appId: GAMEON_CONFIG.APP_ID,
      pin: result.pin,
      revision: result.revision,
      updatedAt: result.updatedAt,
      payloadHash: result.payloadHash
    });
  } catch (error) {
    return output_({ok: false, error: errorMessage_(error)});
  } finally {
    try { if (lock.hasLock()) lock.releaseLock(); } catch (_) {}
  }
}

function authorize_(data) {
  if (!data || String(data.appId || '') !== GAMEON_CONFIG.APP_ID) throw new Error('Nepareizs appId.');
}

function validatePin_(value) {
  const pin = String(value || '').trim();
  if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN jābūt 4–8 cipariem.');
  return pin;
}

function sheetNameForPin_(pin) {
  return GAMEON_CONFIG.SHEET_PREFIX + validatePin_(pin);
}

function openSpreadsheet_() {
  return SpreadsheetApp.openById(GAMEON_CONFIG.SPREADSHEET_ID);
}

function getGameSheet_(pin) {
  const cleanPin = validatePin_(pin);
  const sheet = openSpreadsheet_().getSheetByName(sheetNameForPin_(cleanPin));
  return {pin: cleanPin, sheet: sheet};
}

function createGame_(pin) {
  const cleanPin = validatePin_(pin);
  const lock = LockService.getScriptLock();
  lock.waitLock(GAMEON_CONFIG.LOCK_TIMEOUT_MS);

  try {
    const spreadsheet = openSpreadsheet_();
    const sheetName = sheetNameForPin_(cleanPin);
    const existing = spreadsheet.getSheetByName(sheetName);

    if (existing) return {created: false, exists: true, pin: cleanPin, sheetName: sheetName};

    const sheet = spreadsheet.insertSheet(sheetName);
    setupGameSheet_(sheet);
    updateIndex_(cleanPin, sheetName, new Date().toISOString(), 0, true);
    clearMetaCache_(cleanPin);

    return {
      created: true,
      exists: true,
      pin: cleanPin,
      sheetName: sheetName,
      hasData: false,
      revision: 0
    };
  } finally {
    try { if (lock.hasLock()) lock.releaseLock(); } catch (_) {}
  }
}

function setupGameSheet_(sheet) {
  ensureSheetSize_(sheet, 4, GAMEON_HEADERS.length);
  sheet.getRange(1, 1, 1, GAMEON_HEADERS.length).setValues([GAMEON_HEADERS]);
  sheet.getRange(2, 1, 1, GAMEON_HEADERS.length).setValues([[
    'game', '', 0, '', '', 0, 0, GAMEON_CONFIG.APP_ID
  ]]);
  sheet.setFrozenRows(2);
  sheet.autoResizeColumns(1, GAMEON_HEADERS.length);
  SpreadsheetApp.flush();
}

function ensureSheetSize_(sheet, rows, columns) {
  if (sheet.getMaxRows() < rows) sheet.insertRowsAfter(sheet.getMaxRows(), rows - sheet.getMaxRows());
  if (sheet.getMaxColumns() < columns) sheet.insertColumnsAfter(sheet.getMaxColumns(), columns - sheet.getMaxColumns());
}

function readMetaByPin_(pin) {
  const cleanPin = validatePin_(pin);
  const cache = CacheService.getScriptCache();
  const cacheKey = metaCacheKey_(cleanPin);
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (_) {}
  }

  const found = getGameSheet_(cleanPin);
  if (!found.sheet) {
    return {exists: false, hasData: false, pin: cleanPin, revision: 0, chunkCount: 0, payloadLength: 0};
  }

  const values = found.sheet.getRange(2, 1, 1, GAMEON_HEADERS.length).getValues()[0];
  const chunkCount = Math.max(0, Number(values[5] || 0));
  const meta = {
    exists: true,
    hasData: chunkCount > 0,
    pin: cleanPin,
    sheetName: found.sheet.getName(),
    updatedAt: dateToIso_(values[1]),
    revision: Math.max(0, Number(values[2] || 0)),
    clientId: String(values[3] || ''),
    payloadHash: String(values[4] || ''),
    chunkCount: chunkCount,
    payloadLength: Math.max(0, Number(values[6] || 0)),
    schema: String(values[7] || GAMEON_CONFIG.APP_ID)
  };

  cache.put(cacheKey, JSON.stringify(meta), GAMEON_CONFIG.META_CACHE_SECONDS);
  return meta;
}

function readSnapshotByPin_(pin) {
  const cleanPin = validatePin_(pin);
  const meta = readMetaByPin_(cleanPin);
  if (!meta.exists) throw new Error('Spēle ar šādu PIN nav atrasta.');
  if (!meta.hasData) return Object.assign({}, meta, {payload: 'null'});

  const found = getGameSheet_(cleanPin);
  const rows = found.sheet.getRange(4, 1, meta.chunkCount, 1).getDisplayValues();
  const encodedPayload = rows.map(function(row) { return String(row[0] || ''); }).join('');

  let payload;
  try {
    payload = Utilities.newBlob(Utilities.base64Decode(encodedPayload)).getDataAsString('UTF-8');
  } catch (_) {
    throw new Error('Saglabāto datu dekodēšana neizdevās.');
  }

  if (payload.length !== meta.payloadLength) throw new Error('Saglabātais datu garums neatbilst metadatiem.');
  if (hashText_(payload) !== meta.payloadHash) throw new Error('Saglabāto datu kontrolsumma neatbilst.');
  JSON.parse(payload);
  return Object.assign({}, meta, {payload: payload});
}

function saveSnapshotByPin_(pin, body) {
  const cleanPin = validatePin_(pin);
  const found = getGameSheet_(cleanPin);
  if (!found.sheet) throw new Error('Spēle ar šādu PIN nav atrasta.');

  const payload = String(Object.prototype.hasOwnProperty.call(body, 'payload') ? body.payload : 'null');
  if (payload.length > GAMEON_CONFIG.MAX_PAYLOAD_CHARS) throw new Error('Datu apjoms ir pārāk liels.');
  try { JSON.parse(payload); } catch (_) { throw new Error('Saglabājamie dati nav derīgs JSON.'); }

  const oldMeta = readMetaByPin_(cleanPin);
  const revision = oldMeta.revision + 1;
  const updatedAt = new Date().toISOString();
  const clientId = String(body.clientId || '').slice(0, 120);
  const payloadHash = hashText_(payload);
  const encodedPayload = Utilities.base64Encode(payload, Utilities.Charset.UTF_8);
  const chunks = chunkText_(encodedPayload, GAMEON_CONFIG.CHUNK_SIZE);
  const rowsToClear = Math.max(oldMeta.chunkCount, chunks.length, 1);

  ensureSheetSize_(found.sheet, 4 + rowsToClear, GAMEON_HEADERS.length);
  found.sheet.getRange(4, 1, rowsToClear, 1).clearContent();
  if (chunks.length) {
    found.sheet.getRange(4, 1, chunks.length, 1).setValues(chunks.map(function(chunk) { return [chunk]; }));
  }

  found.sheet.getRange(2, 1, 1, GAMEON_HEADERS.length).setValues([[
    'game', updatedAt, revision, clientId, payloadHash, chunks.length, payload.length, GAMEON_CONFIG.APP_ID
  ]]);

  updateIndex_(cleanPin, found.sheet.getName(), updatedAt, revision, false);
  SpreadsheetApp.flush();

  const newMeta = {
    exists: true,
    hasData: true,
    pin: cleanPin,
    sheetName: found.sheet.getName(),
    updatedAt: updatedAt,
    revision: revision,
    clientId: clientId,
    payloadHash: payloadHash,
    chunkCount: chunks.length,
    payloadLength: payload.length,
    schema: GAMEON_CONFIG.APP_ID
  };

  CacheService.getScriptCache().put(metaCacheKey_(cleanPin), JSON.stringify(newMeta), GAMEON_CONFIG.META_CACHE_SECONDS);
  return newMeta;
}

function updateIndex_(pin, sheetName, updatedAt, revision, isNew) {
  const spreadsheet = openSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(GAMEON_CONFIG.INDEX_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(GAMEON_CONFIG.INDEX_SHEET_NAME, 0);

  ensureSheetSize_(sheet, 2, INDEX_HEADERS.length);
  sheet.getRange(1, 1, 1, INDEX_HEADERS.length).setValues([INDEX_HEADERS]);
  sheet.setFrozenRows(1);

  const lastRow = Math.max(sheet.getLastRow(), 1);
  const values = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, INDEX_HEADERS.length).getValues() : [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === pin) {
      rowIndex = i + 2;
      break;
    }
  }

  if (rowIndex === -1) {
    sheet.appendRow([pin, sheetName, updatedAt, updatedAt, revision]);
  } else {
    const createdAt = values[rowIndex - 2][2] || updatedAt;
    sheet.getRange(rowIndex, 1, 1, INDEX_HEADERS.length).setValues([[
      pin, sheetName, createdAt, updatedAt, revision
    ]]);
  }

  if (isNew) sheet.autoResizeColumns(1, INDEX_HEADERS.length);
}

function parsePostBody_(e) {
  if (!e || !e.postData || typeof e.postData.contents !== 'string') throw new Error('Trūkst POST datu.');
  try { return JSON.parse(e.postData.contents) || {}; }
  catch (_) { throw new Error('POST dati nav derīgs JSON.'); }
}

function chunkText_(text, size) {
  const result = [];
  for (let i = 0; i < text.length; i += size) result.push(text.slice(i, i + size));
  if (!result.length) result.push('');
  return result;
}

function hashText_(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}

function metaCacheKey_(pin) {
  return 'gameononline_v2_meta_' + pin;
}

function clearMetaCache_(pin) {
  CacheService.getScriptCache().remove(metaCacheKey_(pin));
}

function dateToIso_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) return value.toISOString();
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function output_(data, prefix) {
  const json = JSON.stringify(data);
  const callback = String(prefix || '');
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]{0,100}$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function errorMessage_(error) {
  return String(error && error.message ? error.message : error);
}

function setupGameOnOnline() {
  const spreadsheet = openSpreadsheet_();
  let indexSheet = spreadsheet.getSheetByName(GAMEON_CONFIG.INDEX_SHEET_NAME);
  if (!indexSheet) indexSheet = spreadsheet.insertSheet(GAMEON_CONFIG.INDEX_SHEET_NAME, 0);

  ensureSheetSize_(indexSheet, 2, INDEX_HEADERS.length);
  indexSheet.getRange(1, 1, 1, INDEX_HEADERS.length).setValues([INDEX_HEADERS]);
  indexSheet.setFrozenRows(1);
  indexSheet.autoResizeColumns(1, INDEX_HEADERS.length);
  SpreadsheetApp.flush();
  return 'Game On Online v2 ir sagatavots.';
}
