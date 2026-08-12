// Google Apps Script - colar no Extensões > Apps Script da planilha
// Depois: Implantar > Nova implantação > Web App > acesso "Qualquer pessoa"

const CADASTROS_SHEET = 'Cadastros';
const REGISTROS_SHEET = 'Registros';

function getSheet_(nome) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(nome);
  if (!sheet) {
    sheet = ss.insertSheet(nome);
    if (nome === CADASTROS_SHEET) sheet.appendRow(['Nome', 'Descriptor']);
    if (nome === REGISTROS_SHEET) sheet.appendRow(['Nome', 'DataHora', 'Tipo']);
  }
  return sheet;
}

function doGet(e) {
  const sheet = getSheet_(CADASTROS_SHEET);
  const data = sheet.getDataRange().getValues();
  const cadastros = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      cadastros.push({ nome: data[i][0], descriptor: JSON.parse(data[i][1]) });
    }
  }
  return jsonOut_({ cadastros: cadastros });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'cadastrar') {
      return cadastrar_(body.nome, body.descriptor);
    } else if (body.action === 'registrar') {
      return registrar_(body.nome);
    }
    return jsonOut_({ erro: 'acao invalida' });
  } finally {
    lock.releaseLock();
  }
}

function cadastrar_(nome, descriptor) {
  const sheet = getSheet_(CADASTROS_SHEET);
  sheet.appendRow([nome, JSON.stringify(descriptor)]);
  SpreadsheetApp.flush();
  return jsonOut_({ ok: true });
}

function registrar_(nome) {
  const sheet = getSheet_(REGISTROS_SHEET);
  const data = sheet.getDataRange().getValues();
  let ultimoTipo = null;
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === nome) {
      ultimoTipo = data[i][2];
      break;
    }
  }
  const tipo = proximoTipo_(ultimoTipo);
  const agora = new Date();
  sheet.appendRow([nome, agora, tipo]);
  SpreadsheetApp.flush();
  return jsonOut_({ ok: true, tipo: tipo, dataHora: agora.toISOString() });
}

function proximoTipo_(ultimoTipo) {
  return (ultimoTipo === 'Entrada') ? 'Saida' : 'Entrada';
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { proximoTipo_ };
}
