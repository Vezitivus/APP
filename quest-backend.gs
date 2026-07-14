/**
 * VEZITIVUS QUEST — standalone Google Apps Script backend
 * Google Sheet: 1KYwqQ4gpwnXuMjNGjET1KnZVh2hmgadAl1rpmCttdnk
 * Lapa: rats
 */

const SPREADSHEET_ID = '1KYwqQ4gpwnXuMjNGjET1KnZVh2hmgadAl1rpmCttdnk';
const SHEET_NAME = 'rats';
const HEADERS = [
  'ID','TITLE','DESCRIPTION','POINTS','ACTIVE','MODE',
  'OPENED','FIRST_OPENED_AT','OPEN_COUNT',
  'COMPLETED','COMPLETED_BY','COMPLETED_AT','UPDATED_AT'
];

function doGet() {
  return json_({ok:true, service:'VEZITIVUS QUEST', sheet:SHEET_NAME, time:new Date().toISOString()});
}

function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    const action = String(body.action || '');

    if (['listQuests','saveQuest','resetQuest','deleteQuest'].includes(action)) {
      requireAdmin_(body.adminKey);
    }

    let result;
    switch (action) {
      case 'listQuests': result = {quests:listQuests_()}; break;
      case 'getQuest': result = {quest:getQuestAndMarkOpened_(body.id)}; break;
      case 'saveQuest': result = {quest:saveQuest_(body.quest, body.originalId)}; break;
      case 'resetQuest': result = {quest:resetQuest_(body.id)}; break;
      case 'deleteQuest': deleteQuest_(body.id); result = {}; break;
      case 'completeQuest': result = completeQuest_(body.id, body.name); break;
      default: throw new Error('Neatpazīta darbība.');
    }
    return json_(Object.assign({ok:true}, result));
  } catch (err) {
    return json_({ok:false, error:err.message || String(err)});
  }
}

/**
 * Palaid vienu reizi pēc jaunā koda ielikšanas.
 * Funkcija NEIZDZĒŠ lapas saturu.
 */
function setupQuestSheet() {
  const sh = sheet_();
  const lastColumn = Math.max(sh.getLastColumn(), HEADERS.length);
  const existing = sh.getRange(1,1,1,lastColumn).getDisplayValues()[0];
  const isEmpty = existing.every(v => !String(v).trim());

  if (isEmpty) {
    sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
  } else {
    migrateHeaders_(sh, existing);
  }

  sh.setFrozenRows(1);
  sh.getRange(1,1,1,HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#111827')
    .setFontColor('#ffffff');
  sh.setColumnWidth(1,110);
  sh.setColumnWidth(2,240);
  sh.setColumnWidth(3,420);
}

function migrateHeaders_(sh, existing) {
  const oldHeaders = ['ID','TITLE','DESCRIPTION','POINTS','ACTIVE','MODE','COMPLETED','COMPLETED_BY','COMPLETED_AT','UPDATED_AT'];
  const currentFirst = existing.slice(0, HEADERS.length).map(v => String(v).trim().toUpperCase());

  if (HEADERS.every((h,i) => currentFirst[i] === h)) return;

  const oldMatch = oldHeaders.every((h,i) => currentFirst[i] === h);
  if (oldMatch) {
    sh.insertColumnsAfter(6, 3);
    sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
    const rows = sh.getLastRow() - 1;
    if (rows > 0) {
      sh.getRange(2,7,rows,3).setValues(Array.from({length:rows}, () => [false,'',0]));
    }
    return;
  }

  throw new Error('Lapas "rats" 1. rindā jau ir cita struktūra. Neizdevās droši izveidot QUEST kolonnas.');
}

function listQuests_() {
  const sh = sheet_();
  ensureHeaders_(sh);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,HEADERS.length).getValues()
    .filter(r => String(r[0] || '').trim())
    .map(rowToQuest_);
}

function getQuestAndMarkOpened_(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const found = findRow_(id);
    if (!found) throw new Error('Uzdevums ar ID ' + cleanId_(id) + ' nav atrasts.');

    const now = new Date();
    const q = rowToQuest_(found.values);
    const firstOpenedAt = q.firstOpenedAtRaw || now;
    const openCount = (Number(q.openCount) || 0) + 1;

    sheet_().getRange(found.row,7,1,3).setValues([[true, firstOpenedAt, openCount]]);
    const refreshed = sheet_().getRange(found.row,1,1,HEADERS.length).getValues()[0];
    return rowToQuest_(refreshed);
  } finally {
    lock.releaseLock();
  }
}

function saveQuest_(q, originalId) {
  if (!q) throw new Error('Trūkst uzdevuma dati.');
  const quest = {
    id:cleanId_(q.id),
    title:String(q.title||'').trim(),
    description:String(q.description||'').trim(),
    points:Math.max(0,Number(q.points)||0),
    active:Boolean(q.active),
    mode:String(q.mode||'ONCE').toUpperCase()==='REPEAT'?'REPEAT':'ONCE'
  };
  if (!quest.id || !quest.title || !quest.description) throw new Error('ID, nosaukums un apraksts ir obligāti.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_();
    ensureHeaders_(sh);
    const old = originalId ? findRow_(originalId) : null;
    const duplicate = findRow_(quest.id);
    if (duplicate && (!old || duplicate.row !== old.row)) throw new Error('Šāds ID jau eksistē.');

    const existing = old ? rowToQuest_(old.values) : {};
    const values = [
      quest.id, quest.title, quest.description, quest.points, quest.active, quest.mode,
      Boolean(existing.opened), existing.firstOpenedAtRaw || '', Number(existing.openCount)||0,
      Boolean(existing.completed), existing.completedBy||'', existing.completedAtRaw||'', new Date()
    ];

    if (old) sh.getRange(old.row,1,1,HEADERS.length).setValues([values]);
    else sh.appendRow(values);
    return rowToQuest_(values);
  } finally {
    lock.releaseLock();
  }
}

function completeQuest_(id, name) {
  name = String(name||'').trim().slice(0,40);
  if (!name) throw new Error('Ievadi savu vārdu.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const found = findRow_(id);
    if (!found) throw new Error('Uzdevums nav atrasts.');
    const q = rowToQuest_(found.values);
    if (!q.active) throw new Error('Uzdevums nav aktīvs.');
    if (q.completed && q.mode !== 'REPEAT') throw new Error('Šis uzdevums jau ir izpildīts.');

    const now = new Date();
    sheet_().getRange(found.row,10,1,4).setValues([[true,name,now,now]]);
    return {points:q.points, completedBy:name, completedAt:formatDate_(now)};
  } finally {
    lock.releaseLock();
  }
}

/** Atiestata tikai izpildes statusu. Kartīte paliek atzīmēta kā atrasta. */
function resetQuest_(id) {
  const found = findRow_(id);
  if (!found) throw new Error('Uzdevums nav atrasts.');
  sheet_().getRange(found.row,10,1,4).setValues([[false,'','',new Date()]]);
  return getQuestWithoutOpening_(id);
}

function deleteQuest_(id) {
  const found = findRow_(id);
  if (!found) throw new Error('Uzdevums nav atrasts.');
  sheet_().deleteRow(found.row);
}

function getQuestWithoutOpening_(id) {
  const found = findRow_(id);
  if (!found) throw new Error('Uzdevums nav atrasts.');
  return rowToQuest_(found.values);
}

function findRow_(id) {
  id = cleanId_(id);
  if (!id) return null;
  const sh = sheet_();
  ensureHeaders_(sh);
  if (sh.getLastRow() < 2) return null;
  const ids = sh.getRange(2,1,sh.getLastRow()-1,1).getDisplayValues().flat();
  const index = ids.findIndex(v => cleanId_(v) === id);
  if (index < 0) return null;
  const row = index + 2;
  return {row, values:sh.getRange(row,1,1,HEADERS.length).getValues()[0]};
}

function rowToQuest_(r) {
  return {
    id:String(r[0]||''),
    title:String(r[1]||''),
    description:String(r[2]||''),
    points:Number(r[3])||0,
    active:toBool_(r[4]),
    mode:String(r[5]||'ONCE'),
    opened:toBool_(r[6]),
    firstOpenedAt:formatDate_(r[7]),
    firstOpenedAtRaw:r[7]||'',
    openCount:Number(r[8])||0,
    completed:toBool_(r[9]),
    completedBy:String(r[10]||''),
    completedAt:formatDate_(r[11]),
    completedAtRaw:r[11]||'',
    updatedAt:formatDate_(r[12])
  };
}

function sheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Google Sheets failā nav lapas "' + SHEET_NAME + '".');
  return sh;
}

function ensureHeaders_(sh) {
  const current = sh.getRange(1,1,1,HEADERS.length).getDisplayValues()[0]
    .map(v => String(v).trim().toUpperCase());
  if (!HEADERS.every((h,i) => current[i] === h)) {
    throw new Error('Lapa "rats" nav inicializēta. Apps Script redaktorā palaid setupQuestSheet().');
  }
}

function requireAdmin_(key) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!expected) throw new Error('Script Properties nav iestatīta ADMIN_KEY.');
  if (String(key||'') !== expected) throw new Error('Nepareiza administratora atslēga.');
}

function cleanId_(v) { return String(v||'').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,''); }
function toBool_(v) { return v===true || String(v).toUpperCase()==='TRUE'; }
function formatDate_(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d)) return String(v);
  return Utilities.formatDate(d, Session.getScriptTimeZone()||'Europe/Riga', 'dd.MM.yyyy HH:mm:ss');
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
