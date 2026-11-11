const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/notificaciones.js'), 'utf8')
  .replace('window.TierraFilmsNotificaciones = { render };', 'window.TierraFilmsNotificaciones = { llamar, guardar, state };');
const lista = [{ nombre: 'Prueba', email: 'prueba@example.com' }];
function setup(fetch) {
  const window = { TIERRA_FILMS_REGLAS: {}, TIERRA_FILMS_ALERTAS: { url: 'https://example.com/exec', token: 'test' }, addEventListener() {} };
  vm.runInNewContext(source, { window, fetch, URL, AbortSignal, console,
    document: { readyState: 'loading', addEventListener() {}, getElementById() { return null; } },
    setTimeout: fn => { fn(); },
  });
  return window.TierraFilmsNotificaciones;
}
const response = destinatarios => ({ ok: true, json: async () => ({ ok: true, destinatarios, actualizado: '2026-11-11' }) });

test('POST opaco seguido de lectura confirma los destinatarios reales', async () => {
  const calls = [];
  const api = setup(async (url, options) => {
    calls.push({ url, options });
    if (options.method === 'POST') return { type: 'opaque', status: 0 };
    return response(lista);
  });
  assert.deepEqual((await api.llamar(lista)).destinatarios, lista);
  assert.equal(calls[0].options.mode, 'no-cors');
  assert.equal(calls[1].options.cache, 'no-store');
  assert.equal(new URL(calls[1].url).searchParams.get('token'), 'test');
  assert.ok(new URL(calls[1].url).searchParams.get('_'));
});

test('respuesta cortada después de persistir no provoca otro POST', async () => {
  let posts = 0, reads = 0;
  const api = setup(async (_, options) => {
    if (options.method === 'POST') { posts++; throw new TypeError('Failed to fetch'); }
    return response(++reads === 1 ? [] : lista);
  });
  await api.llamar(lista);
  assert.equal(posts, 1);
  assert.equal(reads, 2);
});

test('lista antigua, null y lectura fallida nunca confirman un guardado', async () => {
  for (const result of [[], null, 'error']) {
    const api = setup(async (_, options) => {
      if (options.method === 'POST') return { type: 'opaque' };
      if (result === 'error') throw new TypeError('Failed to fetch');
      return response(result);
    });
    api.state.alertas = { lista, estado: 'listo' };
    await api.guardar();
    assert.match(api.state.alertas.mensaje, /No se pudo confirmar/);
    assert.equal(api.state.alertas.tono, 'red');
    assert.deepEqual(api.state.alertas.lista, lista);
  }
});

test('lista vacía solo se confirma si el servidor devuelve un array vacío', async () => {
  const api = setup(async (_, options) => options.method === 'POST' ? {} : response([]));
  assert.deepEqual((await api.llamar([])).destinatarios, []);
});

test('comparación respeta la normalización y deduplicación del servidor', async () => {
  const api = setup(async (_, options) => options.method === 'POST' ? {} : response(lista));
  await api.llamar([{ nombre: ' Prueba ', email: 'PRUEBA@example.com' }, ...lista]);
});

test('rechaza correos inválidos y más de 25 filas antes de enviar', async () => {
  const api = setup(() => { throw new Error('No debe hacer fetch'); });
  api.state.alertas = { lista: [{ nombre: 'Prueba', email: 'invalido' }] };
  await api.guardar();
  assert.match(api.state.alertas.mensaje, /Revisa el correo/);
  api.state.alertas = { lista: Array.from({ length: 26 }, (_, i) => ({ nombre: '', email: `p${i}@example.com` })) };
  await api.guardar();
  assert.match(api.state.alertas.mensaje, /Máximo 25/);
});
