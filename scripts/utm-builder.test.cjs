const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../js/utm-builder.js'), 'utf8');
const context = { window: {}, URL, document: undefined };
vm.runInNewContext(source, context);
const { construirUrl, limpiar } = context.window.TierraFilmsUtm;
const base = { source: 'google', medium: 'cpc', campana: 'tierra_films_verano_2026' };

test('el texto se normaliza: un utm_ con tildes o espacios cuenta aparte del mismo sin ellos', () => {
  assert.equal(limpiar('Verano 2026'), 'verano_2026');
  assert.equal(limpiar('Diseño & Gráfica'), 'diseno_grafica');
  assert.equal(limpiar('  __hola  mundo__  '), 'hola_mundo');
  assert.equal(limpiar(''), '');
  // El guion se elimina, no se convierte en «_», igual que en el UTM Builder de LR Suite:
  // cambiarlo aquí partiría en dos cualquier campaña ya etiquetada con esa regla.
  assert.equal(limpiar('verano-2026'), 'verano2026');
});

test('la dirección lleva las cinco etiquetas', () => {
  const url = new URL(construirUrl('https://tierrafilms.pe/contacto', { ...base, term: 'video_corporativo', content: 'anuncio_a' }));
  assert.equal(url.searchParams.get('utm_source'), 'google');
  assert.equal(url.searchParams.get('utm_medium'), 'cpc');
  assert.equal(url.searchParams.get('utm_campaign'), 'tierra_films_verano_2026');
  assert.equal(url.searchParams.get('utm_term'), 'video_corporativo');
  assert.equal(url.searchParams.get('utm_content'), 'anuncio_a');
});

test('sin campaña o sin destino válido no hay enlace', () => {
  assert.equal(construirUrl('https://tierrafilms.pe', { ...base, campana: '' }), '');
  assert.equal(construirUrl('', base), '');
  assert.equal(construirUrl('no es una dirección', base), '');
  assert.ok(construirUrl('tierrafilms.pe/contacto', base).startsWith('https://tierrafilms.pe/contacto?'));
});

test('el ancla se respeta', () => {
  // Pegando «?utm_...» al final acababan dentro del fragmento, y ahí GA4 no los ve.
  const url = new URL(construirUrl('https://tierrafilms.pe/servicios#cotizar', { ...base, term: 'drone' }));
  assert.equal(url.hash, '#cotizar');
  assert.equal(url.searchParams.get('utm_term'), 'drone');
});

test('los utm_ que la dirección ya traía se reemplazan, y lo demás se conserva', () => {
  const url = new URL(construirUrl('https://tierrafilms.pe/?utm_source=viejo&utm_term=viejo&ref=boletin', base));
  assert.deepEqual(url.searchParams.getAll('utm_source'), ['google']);
  assert.equal(url.searchParams.get('utm_term'), null);
  assert.equal(url.searchParams.get('ref'), 'boletin');
});

test('source y medium se escriben a mano: «Paid Social» y «paid_social» son el mismo', () => {
  const url = new URL(construirUrl('https://tierrafilms.pe', { source: ' Meta ', medium: 'Paid Social', campana: 'x_y' }));
  assert.equal(url.searchParams.get('utm_source'), 'meta');
  assert.equal(url.searchParams.get('utm_medium'), 'paid_social');
});

test('term y content son opcionales', () => {
  const url = new URL(construirUrl('https://tierrafilms.pe', base));
  assert.equal(url.searchParams.has('utm_term'), false);
  assert.equal(url.searchParams.has('utm_content'), false);
});

test('ValueTrack: las llaves llegan literales, que es lo que Google sustituye', () => {
  // Codificadas como %7B%7D no sustituye nada y el anuncio manda el texto «{keyword}» como si
  // fuera lo que buscó la persona.
  const url = construirUrl('https://tierrafilms.pe/contacto', { ...base, term: '{keyword}', content: '{creative}' });
  assert.ok(url.includes('utm_term={keyword}'), url);
  assert.ok(url.includes('utm_content={creative}'), url);
  assert.equal(url.includes('%7B'), false);
});

test('el marcador no destapa llaves de la ruta ni del ancla, que son del cliente', () => {
  const url = construirUrl('https://tierrafilms.pe/a%7Bb%7D/contacto#cot%7Bizar', { ...base, term: '{keyword}' });
  assert.ok(url.includes('/a%7Bb%7D/contacto'), url);
  assert.ok(url.endsWith('#cot%7Bizar'), url);
  assert.equal(construirUrl('https://tierrafilms.pe/a%7Bb%7D', base).includes('%7B'), true);
});

test('escribir «{keyword}» a mano en el conjunto no lo convierte en marcador', () => {
  assert.equal(limpiar('{keyword}'), 'keyword');
});
