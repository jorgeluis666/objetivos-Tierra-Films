#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const DIST_HTML = path.join(DIST_DIR, 'index.html');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function copyDirectory(source, target) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) copyDirectory(sourcePath, targetPath);
    else fs.copyFileSync(sourcePath, targetPath);
  }
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// El acceso lo controla Apache (HTTP Basic Auth), no el navegador. HTPASSWD_PATH es la ruta absoluta
// del archivo de claves en el servidor (la que crea cPanel > Privacidad de directorios). Si falta,
// se deja un marcador: Apache responde 500 en vez de servir el tablero sin clave.
function writeHtaccess(html) {
  const htpasswdPath = (process.env.HTPASSWD_PATH || '').trim();
  if (!htpasswdPath) console.warn('[build] falta HTPASSWD_PATH; dist/.htaccess queda con un marcador y el sitio no abrira');
  // CSP con el hash de cada <script> inline, porque el build mete todo el JS dentro del HTML.
  const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(match => `'sha256-${crypto.createHash('sha256').update(match[1], 'utf8').digest('base64')}'`);
  const csp = [
    "default-src 'self'",
    `script-src 'self' https://cdnjs.cloudflare.com ${hashes.join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
  const template = readFile('deploy/.htaccess');
  for (const token of ['__HTPASSWD_PATH__', '__CSP__']) {
    if (template.split(token).length !== 2) throw new Error(`deploy/.htaccess debe contener ${token} exactamente una vez`);
  }
  const output = template
    .replace('__HTPASSWD_PATH__', htpasswdPath || '/RUTA/NO/CONFIGURADA/.htpasswd')
    .replace('__CSP__', csp);
  fs.writeFileSync(path.join(DIST_DIR, '.htaccess'), output, 'utf8');
}

function main() {
  let html = readFile('index.html');
  const css = readFile('css/dashboard.css').replaceAll('../assets/', 'assets/');
  const app = readFile('js/objectives.js');
  const reservationGoals = readFile('js/reservation-goals.js');
  const projections = readFile('js/projections.js');
  const keywords = readFile('js/keywords.js');
  const navigation = readFile('js/navigation.js');
  const sidebar = readFile('js/sidebar.js');
  const data = readFile('data/tierra-films-lima-retail-2026.json').replace(/</g, '\\u003c');

  // Los assets llevan ?v=<version> para evitar caches viejos del navegador,
  // asi que el build ubica cada etiqueta ignorando ese sufijo.
  const styleTag = file => new RegExp('<link rel="stylesheet" href="' + escapeRegExp(file) + '(?:\\?[^"]*)?">');
  const scriptTag = file => new RegExp('<script src="' + escapeRegExp(file) + '(?:\\?[^"]*)?"></script>');

  html = html.replace(styleTag('css/dashboard.css'), `<style>${css}</style>`);
  html = html.replace(scriptTag('js/objectives.js'), `<script>${app}</script>`);
  html = html.replace(scriptTag('js/reservation-goals.js'), `<script>${reservationGoals}</script>`);
  html = html.replace(scriptTag('js/projections.js'), `<script>${projections}</script>`);
  html = html.replace(scriptTag('js/keywords.js'), `<script>${keywords}</script>`);
  html = html.replace(scriptTag('js/navigation.js'), `<script>${navigation}</script>`);
  html = html.replace(scriptTag('js/sidebar.js'), `<script>${sidebar}</script>`);
  html = html.replace(
    '</head>',
    `<script>window.TIERRA_FILMS_RETAIL_DATA = ${data};</script></head>`
  );

  // El navegador convierte CRLF en LF antes de calcular el hash CSP de cada <script>; si el HTML
  // conserva CRLF (archivos editados en Windows) los hashes no coinciden y el tablero no carga.
  html = html.replace(/\r\n?/g, '\n');

  // Sin limpieza completa no se sigue: restos de builds viejos (login, data/) acabarian publicados.
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(DIST_HTML, html, 'utf8');
  // Los datos ya van incrustados en el HTML y ningun fetch() los pide sin esa copia inline
  // (objectives.js solo cae a data/ si falta window.TIERRA_FILMS_RETAIL_DATA): no se publica data/.
  copyDirectory(path.join(ROOT, 'assets'), path.join(DIST_DIR, 'assets'));
  writeHtaccess(html);

  console.log(`[build] escrito dist/index.html (${(fs.statSync(DIST_HTML).size / 1024).toFixed(1)} KB)`);
}

try {
  main();
} catch (error) {
  console.error('[build] error:', error.message);
  process.exit(1);
}
