/**
 * Barrido diario de Tierra Films a las 06:30, 13:30 y 18:30 de Lima, despues de Nexus.
 *
 * GitHub atrasa varias horas los workflows programados (cron), asi que la hora fija la pone
 * Google Apps Script: un activador llama a la API de GitHub y lanza el workflow
 * "Sincronizar Drive" (.github/workflows/sync-drive.yml), que arranca en segundos. Ese workflow
 * le pide un barrido en el momento al Web App de drive-sync.gs, guarda la copia en
 * data/drive-snapshot.json y vuelve a publicar el tablero.
 *
 * Va en un proyecto aparte del de drive-sync.gs: aqui solo hace falta el token de GitHub, no los
 * permisos de Drive, y asi tocar el barrido no obliga a volver a desplegar el Web App.
 *
 * Instalacion (una sola vez, ver README > Sincronizacion con Drive):
 * 1. Crear un proyecto en https://script.google.com y pegar este archivo.
 * 2. Configuracion del proyecto > Zona horaria: (GMT-05:00) Lima.
 * 3. Configuracion del proyecto > Propiedades del script: GITHUB_TOKEN = token de GitHub de grano
 *    fino, solo para el repositorio objetivos-Tierra-Films, con el permiso Actions: lectura y escritura.
 * 4. Ejecutar instalarActivador() una vez y aceptar los permisos.
 * 5. Ejecutar sincronizarTierraFilms() para probar: en GitHub > Actions aparece la ejecucion.
 *
 * El token nunca va en este archivo: vive solo en las Propiedades del script.
 */

const REPO = 'jorgeluis666/objetivos-Tierra-Films';
const WORKFLOW = 'sync-drive.yml';
const HORAS = [6, 13, 18];
const ZONA = 'America/Lima';

function sincronizarTierraFilms() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Falta GITHUB_TOKEN en Configuracion del proyecto > Propiedades del script.');
  const response = UrlFetchApp.fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    payload: JSON.stringify({ ref: 'main' }),
    muteHttpExceptions: true
  });
  // GitHub responde 204 cuando acepta el pedido. Un error queda en Ejecuciones y llega por correo.
  if (response.getResponseCode() !== 204) {
    throw new Error(`GitHub respondio ${response.getResponseCode()}: ${response.getContentText().slice(0, 300)}`);
  }
  console.log('Barrido de Tierra Films lanzado en GitHub Actions.');
}

// Tres barridos despues de Nexus; Apps Script tiene un margen aproximado de 15 minutos.
function instalarActivador() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'sincronizarTierraFilms')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  HORAS.forEach(hora => ScriptApp.newTrigger('sincronizarTierraFilms')
    .timeBased()
    .everyDays(1)
    .atHour(hora)
    .nearMinute(30)
    .inTimezone(ZONA)
    .create());
  console.log(`Tres activadores creados: 06:30, 13:30 y 18:30 (${ZONA}).`);
}
