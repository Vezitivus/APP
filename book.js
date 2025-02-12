/**
 * Galvenā doGet funkcija ar JSONP un CORS atbalstu.
 */
function doGet(e) {
  // Iegūst uid no URL: vai no query parametriem, vai no ceļa pēdējā segmenta
  var uid = e.parameter.uid;
  if (!uid) {
    var pathInfo = e.pathInfo;
    if (pathInfo) {
      var segments = pathInfo.split('/');
      uid = segments[segments.length - 1];
    }
  }
  
  if (!uid) {
    return jsonResponse({ error: "Nav nodrošināts uid" }, e);
  }
  
  // Definējam Google Sheets dokumenta ID un lapas nosaukumu
  var spreadsheetId = "1KYwqQ4gpwnXuMjNGjET1KnZVh2hmgadAl1rpmCttdnk";
  var sheetName = "Lapa1";
  
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return jsonResponse({ error: "Lapa 'Lapa1' nav atrasta" }, e);
    }
    
    // Iegūst visu datu diapazonu un meklē rindu, kur A kolonnas vērtība sakrīt ar uid
    var dataRange = sheet.getDataRange();
    var data = dataRange.getValues();
    
    var spins = null;
    var rowIndex = -1;
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] == uid) {
        // Pieņemam, ka K kolonna atrodas kolonnā 11 (indeksā 10)
        spins = data[i][10];
        rowIndex = i + 1; // Google Sheets rindu numuri sākas ar 1
        break;
      }
    }
    
    if (spins === null) {
      return jsonResponse({ error: "UID netika atrasts" }, e);
    }
    
    // Ja ir nodots "deduct" parametrs, samazinām griezienu atlikumu
    if (e.parameter.deduct) {
      var deductValue = parseInt(e.parameter.deduct, 10);
      if (isNaN(deductValue)) {
        deductValue = 0;
      }
      var newSpins = spins - deductValue;
      if (newSpins < 0) {
        newSpins = 0;
      }
      // Atjaunina attiecīgās rindas K kolonnas vērtību
      sheet.getRange(rowIndex, 11).setValue(newSpins);
      spins = newSpins;
    }
    
    return jsonResponse({ K: spins }, e);
    
  } catch (error) {
    return jsonResponse({ error: error.toString() }, e);
  }
}

/**
 * Funkcija, kas ģenerē JSON atbildi un, ja ir norādīts callback parametrs, iesaiņo rezultātu JSONP formātā.
 * Parametrs "e" tiek izmantots, lai pārbaudītu, vai ir pieprasīts JSONP.
 */
function jsonResponse(data, e) {
  var json = JSON.stringify(data);
  
  // Ja ir callback parametrs, izmanto JSONP – tas ļauj pārsniegt CORS ierobežojumus, jo atbildi iegūst caur script tag.
  if (e && e.parameter && e.parameter.callback) {
    var callback = e.parameter.callback;
    return ContentService
      .createTextOutput(callback + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    // Citi gadījumi – mēģina atgriezt JSON ar CORS galveniem.
    var output = ContentService.createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
    output.setHeader("Access-Control-Allow-Origin", "*");
    output.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    output.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return output;
  }
}
