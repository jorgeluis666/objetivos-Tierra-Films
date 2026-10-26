/**
 * Tierra Films | puente entre las carpetas de Drive y el dashboard.
 *
 * Lee cada archivo de las carpetas (hojas de Google con todas sus pestañas y
 * CSV sueltos) y devuelve sus filas en JSON. El dashboard reconoce el tipo de
 * informe por la fila de encabezados.
 *
 * De la carpeta de reglas ("08 Reglas y Optimización", la hoja del ciclo mensual)
 * solo salen cinco columnas: ver COLUMNAS_POR_CARPETA. La instruccion estrategica
 * de esa hoja no sale de LR Suite, y este Web App no pide clave.
 *
 * Barrido: un disparador lo corre todos los dias a las 10:00 (Lima) y guarda el
 * resultado en un JSON en Drive. El tablero lee ese ultimo barrido al abrir; el
 * boton Sincronizar pide uno en el momento (?fresh=1).
 *
 * Instalacion (una sola vez, ver README > Sincronizacion con Drive):
 *   1. script.google.com > Nuevo proyecto > pegar este archivo.
 *   2. Ejecutar installSweepTriggers() y aceptar los permisos de Drive y Hojas.
 *   3. Implementar > Nueva implementacion > Aplicacion web.
 *      Ejecutar como: Yo. Quien tiene acceso: Cualquier persona.
 *   4. Copiar la URL /exec en js/drive-sync.js (DRIVE_SYNC_URL).
 * Si cambias este archivo: Implementar > Gestionar implementaciones > Editar >
 * Nueva version (la URL no cambia) y, si cambia el horario, installSweepTriggers().
 */

// Carpetas de "Google Ads TF" en Drive, mas la de reglas. El tablero reconoce cada
// informe por su cabecera, asi que la carpeta solo sirve para ordenar.
const FOLDERS = {
  campanas: '1Zz5WjNFy0H37n0trSjhVx90NgPmqkyrO',     // Google Ads TF Campañas
  segmentacion: '1Ehko4amk1IjGW6H-HB4WtkF98aaNeB7U', // Google Ads TF Segmentacion
  keywords: '1WSk4gc4UNeprLTWFzLtTUaSqOSWZ25yL',     // Google Ads TF Keywords
  reglas: '1QBpVlptEoR8F-667W9FCmL4ZsD0WHvY9'        // 08 Reglas y Optimización
};

// La hoja Reglas_Nexus_Tierra Films trae una columna, "Instruccion Estrategica para la IA", que es
// el metodo de trabajo de la agencia: habla del cliente en tercera persona y se queda en LR Suite.
// Este Web App responde a cualquiera que tenga la URL (doGet no pide clave), asi que el recorte se
// hace aca, al armar la respuesta, y no mas abajo en el tablero: de esa carpeta solo salen estas
// columnas. El resto de las carpetas sale entera, como siempre.
const COLUMNAS_POR_CARPETA = {
  reglas: ['ID Regla', 'Métrica (Trigger)', 'Operador', 'Valor', 'Acción Automática']
};
const TIMEZONE = 'America/Lima';
const SWEEP_HOUR = 10;
const SWEEP_HANDLER = 'sweepScheduled';
const SNAPSHOT_PROPERTY = 'SNAPSHOT_FILE_ID';
const SNAPSHOT_NAME = 'Tierra Films - barrido del tablero.json';
// El boton no vuelve a barrer si el ultimo barrido tiene menos de un minuto.
const MANUAL_THROTTLE_MS = 60 * 1000;

// GET            -> ultimo barrido (o uno nuevo si nunca se hizo)
// GET ?fresh=1   -> barrido en el momento (boton Sincronizar)
function doGet(event) {
  try {
    const params = (event && event.parameter) || {};
    const body = params.fresh === '1' ? sweep_('manual') : (readSnapshot_() || sweep_('inicial'));
    return json_(body);
  } catch (error) {
    console.error(error);
    return json_({ ok: false, error: 'No se pudieron leer las carpetas de Drive.' });
  }
}

// Disparador diario.
function sweepScheduled() {
  sweep_('automatico');
}

// Ejecutar UNA vez a mano. Borra los disparadores anteriores del barrido para no duplicarlos.
function installSweepTriggers() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === SWEEP_HANDLER)
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger(SWEEP_HANDLER).timeBased().everyDays(1).atHour(SWEEP_HOUR).inTimezone(TIMEZONE).create();
  logSnapshot_(sweep_('instalacion'));
}

// Barrido de prueba desde el editor, para revisar que los archivos se leen bien.
function probarBarrido() {
  logSnapshot_(sweep_('prueba'));
}

function logSnapshot_(body) {
  console.log('Barrido ' + body.origin + ' ' + body.generatedAt + ' | diario ' + SWEEP_HOUR + ':00 (' + TIMEZONE + ')');
  body.sheets.forEach(sheet => console.log(sheet.folder + ' | ' + sheet.file + ' > ' + sheet.sheet + ': ' + sheet.rows.length + ' filas'));
}

function sweep_(origin) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const previous = readSnapshot_();
    if (origin === 'manual' && previous && Date.now() - Date.parse(previous.generatedAt) < MANUAL_THROTTLE_MS) return previous;
    const sheets = [];
    const folders = {};
    Object.keys(FOLDERS).forEach(key => {
      const folder = DriveApp.getFolderById(FOLDERS[key]);
      folders[key] = folder.getName();
      const columnas = COLUMNAS_POR_CARPETA[key];
      const files = folder.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        if (file.isTrashed()) continue;
        const name = file.getName();
        const modified = file.getLastUpdated().toISOString();
        if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
          const book = SpreadsheetApp.openById(file.getId());
          const zone = book.getSpreadsheetTimeZone();
          book.getSheets().forEach(sheet => {
            const range = sheet.getDataRange();
            const rows = cleanRows(range.getValues(), range.getDisplayValues(), zone);
            sheets.push({ folder: key, file: name, sheet: sheet.getName(), modified, rows: soloColumnas(rows, columnas) });
          });
        } else if (/\.csv$/i.test(name) || file.getMimeType() === MimeType.CSV) {
          // En una carpeta con columnas permitidas, un CSV suelto no se publica: no se puede
          // recortar por nombre de columna con la misma garantia y ahi no tiene nada que hacer.
          if (columnas) continue;
          sheets.push({ folder: key, file: name, sheet: name, modified, rows: readCsv(file.getBlob()) });
        }
      }
    });
    const body = { ok: true, origin, schedule: { hour: SWEEP_HOUR, timeZone: TIMEZONE }, folders, generatedAt: new Date().toISOString(), sheets };
    writeSnapshot_(body);
    return body;
  } finally {
    lock.releaseLock();
  }
}

// El barrido se guarda en un archivo de Drive del dueño del script (no en una carpeta del cliente).
function readSnapshot_() {
  const id = PropertiesService.getScriptProperties().getProperty(SNAPSHOT_PROPERTY);
  if (!id) return null;
  try {
    return JSON.parse(DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8'));
  } catch (error) {
    console.error(error);
    return null;
  }
}

function writeSnapshot_(body) {
  const props = PropertiesService.getScriptProperties();
  const text = JSON.stringify(body);
  const id = props.getProperty(SNAPSHOT_PROPERTY);
  if (id) {
    try {
      DriveApp.getFileById(id).setContent(text);
      return;
    } catch (error) {
      console.error(error);
    }
  }
  props.setProperty(SNAPSHOT_PROPERTY, DriveApp.createFile(SNAPSHOT_NAME, text, MimeType.PLAIN_TEXT).getId());
}

function json_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

// Numeros como se ven en la hoja: un CSV importado con otra configuracion regional guarda "9,977" como 9.977 o
// "3.06" como fecha, pero los muestra como en el informe. Fechas reales como AAAA-MM-DD en la zona de la hoja.
function cleanRows(rows, display, zone) {
  return rows.map((row, r) => row.map((cell, c) => {
    const shown = display[r][c];
    if (cell instanceof Date) return /\d{4}/.test(shown) ? Utilities.formatDate(cell, zone, 'yyyy-MM-dd') : shown;
    if (typeof cell === 'number') return shown;
    return cell;
  }));
}

// Deja de cada fila solo las columnas pedidas, en el orden en que se piden. Sin columnas pedidas,
// la hoja sale entera.
function soloColumnas(filas, columnas) {
  if (!columnas || !filas.length) return columnas ? [] : filas;
  const encabezado = filas[0].map(normalizarEncabezado);
  const indices = columnas
    .map(nombre => encabezado.indexOf(normalizarEncabezado(nombre)))
    .filter(indice => indice >= 0);
  // Si la hoja no trae ninguna de las columnas esperadas no se devuelve nada, en lugar de
  // devolverla entera: un encabezado cambiado no puede destapar la instruccion estrategica.
  if (!indices.length) return [];
  return filas.map(fila => indices.map(indice => fila[indice] === undefined ? '' : fila[indice]));
}

// Los encabezados se comparan sin tildes ni mayusculas: "Métrica (Trigger)" y "metrica (trigger)"
// son la misma columna.
function normalizarEncabezado(valor) {
  const tildes = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n' };
  return String(valor === null || valor === undefined ? '' : valor)
    .trim()
    .toLowerCase()
    .replace(/[áéíóúüñ]/g, letra => tildes[letra])
    .replace(/\s+/g, ' ');
}

// Google Ads exporta CSV (UTF-8, comas) o "CSV para Excel" (UTF-16, tabulaciones).
function readCsv(blob) {
  const bytes = blob.getBytes();
  const utf16 = bytes.length > 1 && (bytes[0] & 0xff) === 0xff && (bytes[1] & 0xff) === 0xfe;
  const text = blob.getDataAsString(utf16 ? 'UTF-16' : 'UTF-8').replace(/^﻿/, '');
  const header = text.split('\n').find(line => /Estado de la campa|Categor.a de b.squeda|Ubicaci.n|Palabra clave/.test(line)) || text;
  return Utilities.parseCsv(text, header.indexOf('\t') >= 0 ? '\t' : ',');
}
