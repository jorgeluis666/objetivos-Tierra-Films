/**
 * Tierra Films | puente entre las carpetas de Drive y el dashboard.
 *
 * Lee cada archivo de las carpetas (hojas de Google con todas sus pestañas y
 * CSV sueltos) y devuelve sus filas en JSON. El dashboard reconoce el tipo de
 * informe por la fila de encabezados.
 *
 * Instalacion (una sola vez, ver README > Sincronizacion con Drive):
 *   1. script.google.com > Nuevo proyecto > pegar este archivo.
 *   2. Implementar > Nueva implementacion > Aplicacion web.
 *      Ejecutar como: Yo. Quien tiene acceso: Cualquier persona.
 *   3. Copiar la URL /exec en js/drive-sync.js (DRIVE_SYNC_URL).
 */

// Una carpeta por modulo del tablero.
const FOLDERS = {
  gasto: '1Zz5WjNFy0H37n0trSjhVx90NgPmqkyrO',
  palabras: '1Ehko4amk1IjGW6H-HB4WtkF98aaNeB7U'
};

function doGet() {
  const sheets = [];
  const folders = {};
  Object.keys(FOLDERS).forEach(key => {
    const folder = DriveApp.getFolderById(FOLDERS[key]);
    folders[key] = folder.getName();
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      const name = file.getName();
      const modified = file.getLastUpdated().toISOString();
      if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
        const book = SpreadsheetApp.openById(file.getId());
        const zone = book.getSpreadsheetTimeZone();
        book.getSheets().forEach(sheet => {
          sheets.push({ folder: key, file: name, sheet: sheet.getName(), modified, rows: cleanRows(sheet.getDataRange().getValues(), zone) });
        });
      } else if (/\.csv$/i.test(name) || file.getMimeType() === MimeType.CSV) {
        sheets.push({ folder: key, file: name, sheet: name, modified, rows: readCsv(file.getBlob()) });
      }
    }
  });
  const body = { ok: true, folders, generatedAt: new Date().toISOString(), sheets };
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

// Numeros quedan como numero; fechas como AAAA-MM-DD en la zona de la hoja.
function cleanRows(rows, zone) {
  return rows.map(row => row.map(cell => {
    if (cell instanceof Date) return Utilities.formatDate(cell, zone, 'yyyy-MM-dd');
    return cell;
  }));
}

// Google Ads exporta CSV (UTF-8, comas) o "CSV para Excel" (UTF-16, tabulaciones).
function readCsv(blob) {
  const bytes = blob.getBytes();
  const utf16 = bytes.length > 1 && (bytes[0] & 0xff) === 0xff && (bytes[1] & 0xff) === 0xfe;
  const text = blob.getDataAsString(utf16 ? 'UTF-16' : 'UTF-8').replace(/^\uFEFF/, '');
  const header = text.split('\n').find(line => /Estado de la campa|Categor.a de b.squeda|Ubicaci.n/.test(line)) || text;
  return Utilities.parseCsv(text, header.indexOf('\t') >= 0 ? '\t' : ',');
}
