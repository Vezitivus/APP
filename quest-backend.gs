/**
 * VEZITIVUS QUEST — Google Apps Script backend
 *
 * 1) Izveido Google Sheet.
 * 2) Extensions -> Apps Script.
 * 3) Ielīmē šo failu Code.gs.
 * 4) Project Settings -> Script Properties:
 *      SPREADSHEET_ID = Google Sheet ID
 *      ADMIN_KEY     = tava slepenā administratora atslēga
 * 5) Palaid setupQuestSheet() vienu reizi.
 * 6) Deploy -> New deployment -> Web app:
 *      Execute as: Me
 *      Who has access: Anyone
 * 7) Deployment URL ievieto quest-admin.html un quest.html konstantē API_URL.
 */

const SHEET_NAME = 'QUESTS';
const HEADERS = [
  'ID','TITLE','DESCRIPTION','POINTS','ACTIVE','MODE',
  'COMPLETED','COMPLETED_BY','COMPLETED_AT','UPDATED_AT'
];

function doGet() {
  return json_({ok:true, service:'VEZITIVUS QUEST', time:new Date().toISOString()});
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
      case 'getQuest': result = {quest:getQuest_(body.id)}; break;
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

function setupQuestSheet() {
  const ss = spreadsheet_();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  sh.clear();
  sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
  sh.setFrozenRows(1);
  sh.getRange('A1:J1').setFontWeight('bold').setBackground('#111827').setFontColor('#ffffff');
  sh.setColumnWidths(1,10,150);
  sh.setColumnWidth(2,240);
  sh.setColumnWidth(3,420);
  sh.appendRow(['Q001','Atrodi slepeno vietu','Atrodi paslēpto vietu un uztaisi tur kopbildi.',25,true,'ONCE',false,'','','']);
}

function listQuests_() {
  const sh = sheet_();
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,HEADERS.length).getValues().map(rowToQuest_);
}

function getQuest_(id) {
  const found = findRow_(id);
  if (!found) throw new Error('Uzdevums ar ID ' + cleanId_(id) + ' nav atrasts.');
  return rowToQuest_(found.values);
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
    const old = originalId ? findRow_(originalId) : null;
    const duplicate = findRow_(quest.id);
    if (duplicate && (!old || duplicate.row !== old.row)) throw new Error('Šāds ID jau eksistē.');

    const existing = old ? rowToQuest_(old.values) : {};
    const values = [
      quest.id, quest.title, quest.description, quest.points, quest.active, quest.mode,
      Boolean(existing.completed), existing.completedBy||'', existing.completedAt||'', new Date()
    ];
    if (old) sh.getRange(old.row,1,1,HEADERS.length).setValues([values]);
    else sh.appendRow(values);
    return old ? rowToQuest_(values) : getQuest_(quest.id);
  } finally { lock.releaseLock(); }
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
    sheet_().getRange(found.row,7,1,4).setValues([[true,name,now,now]]);
    return {points:q.points, completedBy:name, completedAt:formatDate_(now)};
  } finally { lock.releaseLock(); }
}

function resetQuest_(id) {
  const found = findRow_(id);
  if (!found) throw new Error('Uzdevums nav atrasts.');
  sheet_().getRange(found.row,7,1,4).setValues([[false,'','',new Date()]]);
  return getQuest_(id);
}

function deleteQuest_(id) {
  const found = findRow_(id);
  if (!found) throw new Error('Uzdevums nav atrasts.');
  sheet_().deleteRow(found.row);
}

function findRow_(id) {
  id = cleanId_(id);
  if (!id) return null;
  const sh = sheet_();
  if (sh.getLastRow() < 2) return null;
  const ids = sh.getRange(2,1,sh.getLastRow()-1,1).getDisplayValues().flat();
  const index = ids.findIndex(v=>cleanId_(v)===id);
  if (index < 0) return null;
  const row = index + 2;
  return {row:row, values:sh.getRange(row,1,1,HEADERS.length).getValues()[0]};
}

function rowToQuest_(r) {
  return {
    id:String(r[0]||''), title:String(r[1]||''), description:String(r[2]||''),
    points:Number(r[3])||0, active:toBool_(r[4]), mode:String(r[5]||'ONCE'),
    completed:toBool_(r[6]), completedBy:String(r[7]||''),
    completedAt:formatDate_(r[8]), updatedAt:formatDate_(r[9])
  };
}

function sheet_() {
  const ss = spreadsheet_();
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Nav lapas "'+SHEET_NAME+'". Palaid setupQuestSheet().');
  return sh;
}

function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Script Properties nav SPREADSHEET_ID.');
  return SpreadsheetApp.openById(id);
}

function requireAdmin_(key) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!expected) throw new Error('Script Properties nav ADMIN_KEY.');
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
