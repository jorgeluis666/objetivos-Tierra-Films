'use strict';
// Constructor de enlaces etiquetados, traído del módulo UTM Builder de LR Suite.
//
// Tres niveles, como en los anuncios: campaña → conjunto → anuncio. El nombre del conjunto se
// convierte en `utm_term` y el del anuncio en `utm_content`, que es lo que después deja al lead
// de este CRM emparejado con la palabra clave que lo trajo.
//
// Dos diferencias con el original de LR Suite, y las dos por la misma razón: allí el módulo sirve
// a toda la agencia y aquí el tablero es de una sola marca.
//   · La marca no se elige en un desplegable: se toma del propio tablero.
//   · Lo que escribes no se guarda. Al recargar la página empiezas de nuevo, igual que en LR Suite.
//
// Existe una copia gemela en Nexus (public/tablero/js/utm-builder.js), que sirve los tableros de
// las marcas que viven allí. Solo cambia de dónde sale el nombre de la marca. Un arreglo en la
// construcción de la URL hay que llevarlo a las dos; sus pruebas son las mismas.
(function () {
  const BLOQUES = [
    { id: 'meta', source: 'meta', medium: 'paid_social', label: 'Meta Ads' },
    { id: 'google', source: 'google', medium: 'cpc', label: 'Google Ads' },
    { id: 'tiktok', source: 'tiktok', medium: 'paid_social', label: 'TikTok Ads' },
  ];
  const ICONO = {
    basura: '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    mas: '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    bajar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  };

  let montado = false;
  const serie = {};
  BLOQUES.forEach(b => { serie[b.id] = { camp: 0, as: 0, ad: 0 }; });

  // El tablero es de una sola marca y su nombre ya está en la barra lateral: de ahí sale, en vez
  // de repetirlo en el código y arriesgarse a que las dos copias se separen.
  function marcaDelTablero() {
    const nombre = document.querySelector('.s-brand .s-title')?.textContent
      || document.querySelector('.s-ma-name')?.textContent || '';
    return limpiar(nombre);
  }

  // Un `utm_` con mayúsculas, tildes o espacios se cuenta aparte del mismo valor sin ellos: GA4
  // trata «Verano 2026» y «verano_2026» como dos campañas distintas.
  function limpiar(texto) {
    const M = { á: 'a', à: 'a', ä: 'a', â: 'a', ã: 'a', é: 'e', è: 'e', ë: 'e', ê: 'e', í: 'i', ì: 'i', ï: 'i', î: 'i', ó: 'o', ò: 'o', ö: 'o', ô: 'o', õ: 'o', ú: 'u', ù: 'u', ü: 'u', û: 'u', ñ: 'n', ç: 'c' };
    return String(texto || '').toLowerCase().split('').map(c => M[c] ?? c).join('')
      .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '');
  }
  function token(texto) { return String(texto || '').trim().toLowerCase().replace(/\s+/g, '_'); }
  function escapar(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function valor(id) { return document.getElementById(id)?.value ?? ''; }

  // El corazón del módulo, aparte del DOM para poder probarlo: devuelve la dirección etiquetada,
  // o cadena vacía si todavía no hay destino válido o campaña. Con la clase URL el #ancla se
  // respeta —pegar «?utm_...» al final lo metía dentro del fragmento, donde GA4 no lo ve— y los
  // utm_ que la dirección ya trajera se reemplazan en lugar de duplicarse.
  function construirUrl(destino, datos) {
    const texto = String(destino || '').trim();
    if (!texto || !datos || !datos.campana) { return ''; }
    let raiz;
    try { raiz = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`); }
    catch { return ''; }
    [...raiz.searchParams.keys()].filter(c => /^utm_/i.test(c)).forEach(c => raiz.searchParams.delete(c));
    raiz.searchParams.set('utm_source', token(datos.source));
    raiz.searchParams.set('utm_medium', token(datos.medium));
    raiz.searchParams.set('utm_campaign', datos.campana);
    if (datos.term) { raiz.searchParams.set('utm_term', datos.term); }
    if (datos.content) { raiz.searchParams.set('utm_content', datos.content); }
    return raiz.href;
  }

  function anuncioHtml(bloque, camp, ad, as) {
    const base = `utm-${bloque}-${camp}`;
    return `
      <div class="utm-ad-row" id="${base}-ad-${ad}" data-ad="${ad}" data-as="${as}" data-camp="${camp}" data-block="${bloque}">
        <span class="utm-ad-label">Anuncio</span>
        <input type="text" class="utm-ad-name" id="${base}-ad-name-${ad}" placeholder="Nombre del anuncio" aria-label="Nombre del anuncio" />
        <input type="text" class="utm-url" id="${base}-ad-url-${ad}" readonly placeholder="Completa la campaña para ver el enlace" aria-label="Enlace generado" />
        <button type="button" class="utm-copy" data-action="copy-url" data-url-id="${base}-ad-url-${ad}">Copiar</button>
        <button type="button" class="utm-del" data-action="delete-ad" data-ad="${ad}" data-as="${as}" data-camp="${camp}" data-block="${bloque}" title="Eliminar anuncio" aria-label="Eliminar anuncio">${ICONO.basura}</button>
      </div>`;
  }

  function conjuntoHtml(bloque, camp, as) {
    const ad = `ad${++serie[bloque].ad}`;
    const base = `utm-${bloque}-${camp}`;
    return `
      <div class="utm-adset" id="${base}-as-${as}" data-as="${as}" data-camp="${camp}" data-block="${bloque}">
        <div class="utm-adset-head">
          <span class="utm-adset-label">Conjunto</span>
          <input type="text" id="${base}-as-name-${as}" placeholder="Nombre del conjunto" aria-label="Nombre del conjunto" />
          <button type="button" class="utm-del" data-action="delete-adset" data-as="${as}" data-camp="${camp}" data-block="${bloque}" title="Eliminar conjunto" aria-label="Eliminar conjunto">${ICONO.basura}</button>
        </div>
        <div class="utm-preview" id="${base}-as-preview-${as}" hidden>
          <span class="utm-preview-label">utm_term</span>
          <span class="utm-preview-value" id="${base}-as-pv-${as}"></span>
        </div>
        <div class="utm-ads" id="${base}-ads-${as}">${anuncioHtml(bloque, camp, ad, as)}</div>
        <button type="button" class="utm-add" data-action="add-ad" data-as="${as}" data-camp="${camp}" data-block="${bloque}">${ICONO.mas} Añadir anuncio</button>
      </div>`;
  }

  function campanaHtml(bloque, camp) {
    const as = `as${++serie[bloque].as}`;
    const base = `utm-${bloque}-${camp}`;
    const marca = marcaDelTablero();
    return `
      <div class="utm-campaign" id="utm-${bloque}-${camp}" data-camp="${camp}" data-block="${bloque}">
        <div class="utm-campaign-head">
          <p class="utm-level">Nivel 1 · Campaña</p>
          <button type="button" class="utm-del" data-action="delete-campaign" data-camp="${camp}" data-block="${bloque}" title="Eliminar campaña" aria-label="Eliminar campaña">${ICONO.basura}</button>
        </div>
        <div class="utm-campaign-body">
          <div class="utm-fields">
            <label class="utm-field"><span>Dirección de destino</span><input id="${base}-base-url" type="url" placeholder="https://..." /></label>
            <label class="utm-field"><span>Marca</span><input id="${base}-marca" type="text" value="${escapar(marca)}" readonly title="La marca de este tablero" /></label>
            <label class="utm-field"><span>Nombre de la campaña</span><input id="${base}-campaign-name" type="text" placeholder="por ejemplo, verano 2026" /></label>
          </div>
          <div class="utm-preview" id="${base}-preview" hidden>
            <span class="utm-preview-label">utm_campaign</span>
            <span class="utm-preview-value" id="${base}-pv"></span>
          </div>
        </div>
        <div class="utm-tree-wrap">
          <p class="utm-level">Niveles 2 y 3 · Conjuntos y anuncios</p>
          <div class="utm-tree" id="${base}-tree">${conjuntoHtml(bloque, camp, as)}</div>
          <button type="button" class="utm-add" data-action="add-adset" data-camp="${camp}" data-block="${bloque}">${ICONO.mas} Añadir conjunto</button>
        </div>
      </div>`;
  }

  function bloqueHtml(bloque) {
    const camp = `camp${++serie[bloque.id].camp}`;
    return `
      <div class="panel utm-block" id="utm-${bloque.id}-block">
        <div class="utm-block-head">
          <strong>${escapar(bloque.label)}</strong>
          <span class="utm-pill"><span>utm_source</span><input id="utm-${bloque.id}-source" value="${escapar(bloque.source)}" aria-label="utm_source de ${escapar(bloque.label)}" /></span>
          <span class="utm-pill"><span>utm_medium</span><input id="utm-${bloque.id}-medium" value="${escapar(bloque.medium)}" aria-label="utm_medium de ${escapar(bloque.label)}" /></span>
          <span class="utm-block-actions">
            <button type="button" class="utm-ghost" data-action="export-csv" data-block="${bloque.id}">${ICONO.bajar} Exportar CSV</button>
            <button type="button" class="utm-ghost" data-action="clear-block" data-block="${bloque.id}">Limpiar</button>
          </span>
        </div>
        <div id="utm-${bloque.id}-campaigns">${campanaHtml(bloque.id, camp)}</div>
        <div class="utm-block-foot">
          <button type="button" class="utm-add" data-action="add-campaign" data-block="${bloque.id}">${ICONO.mas} Añadir campaña</button>
        </div>
      </div>`;
  }

  function refrescarBloque(bloque) {
    const def = BLOQUES.find(b => b.id === bloque);
    const source = valor(`utm-${bloque}-source`) || def.source;
    const medium = valor(`utm-${bloque}-medium`) || def.medium;
    document.getElementById(`utm-${bloque}-campaigns`)?.querySelectorAll('.utm-campaign')
      .forEach(el => refrescarCampana(bloque, el.dataset.camp, source, medium));
  }

  function refrescarCampana(bloque, camp, source, medium) {
    const base = `utm-${bloque}-${camp}`;
    const destinoTexto = valor(`${base}-base-url`).trim();
    const marca = limpiar(valor(`${base}-marca`));
    const nombre = limpiar(valor(`${base}-campaign-name`));
    const campana = marca && nombre ? `${marca}_${nombre}` : '';
    const destinoValido = construirUrl(destinoTexto, { source, medium, campana: campana || 'x' }) !== '';

    const vista = document.getElementById(`${base}-preview`);
    const vistaValor = document.getElementById(`${base}-pv`);
    if (vista && vistaValor) { vista.hidden = !campana; vistaValor.textContent = campana; }

    const arbol = document.getElementById(`${base}-tree`);
    if (!arbol) return;
    arbol.querySelectorAll('.utm-adset').forEach(asEl => {
      const as = asEl.dataset.as;
      const term = limpiar(valor(`${base}-as-name-${as}`));
      const asVista = document.getElementById(`${base}-as-preview-${as}`);
      const asValor = document.getElementById(`${base}-as-pv-${as}`);
      if (asVista && asValor) { asVista.hidden = !term; asValor.textContent = term; }
      asEl.querySelectorAll('.utm-ad-row').forEach(adEl => {
        const ad = adEl.dataset.ad;
        const content = limpiar(valor(`${base}-ad-name-${ad}`));
        const salida = document.getElementById(`${base}-ad-url-${ad}`);
        if (!salida) return;
        const url = construirUrl(destinoTexto, { source, medium, campana, term, content });
        if (!url) {
          salida.value = '';
          salida.title = destinoValido || !destinoTexto ? '' : 'La dirección de destino no es válida';
          salida.classList.remove('has-url');
          return;
        }
        salida.value = url;
        salida.title = url;
        salida.classList.add('has-url');
      });
    });
  }

  function exportarCsv(bloque) {
    const def = BLOQUES.find(b => b.id === bloque);
    const source = token(valor(`utm-${bloque}-source`) || def.source);
    const medium = token(valor(`utm-${bloque}-medium`) || def.medium);
    const filas = [];
    document.getElementById(`utm-${bloque}-campaigns`)?.querySelectorAll('.utm-campaign').forEach(campEl => {
      const camp = campEl.dataset.camp;
      const base = `utm-${bloque}-${camp}`;
      const campana = document.getElementById(`${base}-pv`)?.textContent || '';
      campEl.querySelectorAll('.utm-adset').forEach(asEl => {
        const as = asEl.dataset.as;
        asEl.querySelectorAll('.utm-ad-row').forEach(adEl => {
          const url = document.getElementById(`${base}-ad-url-${adEl.dataset.ad}`)?.value;
          if (!url) return;
          filas.push([source, medium, campana, limpiar(valor(`${base}-as-name-${as}`)), limpiar(valor(`${base}-ad-name-${adEl.dataset.ad}`)), url]);
        });
      });
    });
    if (!filas.length) return;
    const cabecera = ['#', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'URL'].join(',');
    const cuerpo = filas.map((f, i) => [i + 1, ...f.map(v => `"${String(v).replace(/"/g, '""')}"`)].join(',')).join('\n');
    const blob = new Blob(['﻿' + cabecera + '\n' + cuerpo], { type: 'text/csv;charset=utf-8;' });
    const href = URL.createObjectURL(blob);
    const marca = marcaDelTablero() || 'tablero';
    const enlace = Object.assign(document.createElement('a'), { href, download: `utm_${marca}_${bloque}_${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.appendChild(enlace); enlace.click(); document.body.removeChild(enlace);
    URL.revokeObjectURL(href);
  }

  function acciones(bloqueEl, bloque) {
    bloqueEl.addEventListener('input', () => refrescarBloque(bloque));
    bloqueEl.addEventListener('change', () => refrescarBloque(bloque));
    bloqueEl.addEventListener('click', evento => {
      const boton = evento.target.closest('[data-action]');
      if (!boton) return;
      const { action, camp, as, ad } = boton.dataset;
      const base = `utm-${bloque}-${camp}`;

      if (action === 'add-campaign') {
        const contenedor = document.getElementById(`utm-${bloque}-campaigns`);
        if (!contenedor) return;
        añadir(contenedor, campanaHtml(bloque, `camp${++serie[bloque].camp}`));
      }
      if (action === 'delete-campaign' && camp) {
        const contenedor = document.getElementById(`utm-${bloque}-campaigns`);
        // Un bloque sin ninguna campaña no se puede recuperar sin recargar: siempre queda una.
        if (!contenedor || contenedor.querySelectorAll('.utm-campaign').length <= 1) return;
        document.getElementById(`utm-${bloque}-${camp}`)?.remove();
      }
      if (action === 'add-adset' && camp) {
        const arbol = document.getElementById(`${base}-tree`);
        if (!arbol) return;
        añadir(arbol, conjuntoHtml(bloque, camp, `as${++serie[bloque].as}`));
        refrescarBloque(bloque);
      }
      if (action === 'delete-adset' && camp && as) {
        const arbol = document.getElementById(`${base}-tree`);
        if (!arbol || arbol.querySelectorAll('.utm-adset').length <= 1) return;
        document.getElementById(`${base}-as-${as}`)?.remove();
      }
      if (action === 'add-ad' && camp && as) {
        const contenedor = document.getElementById(`${base}-ads-${as}`);
        if (!contenedor) return;
        añadir(contenedor, anuncioHtml(bloque, camp, `ad${++serie[bloque].ad}`, as));
        refrescarBloque(bloque);
      }
      if (action === 'delete-ad' && camp && as && ad) {
        const contenedor = document.getElementById(`${base}-ads-${as}`);
        if (!contenedor || contenedor.querySelectorAll('.utm-ad-row').length <= 1) return;
        document.getElementById(`${base}-ad-${ad}`)?.remove();
      }
      if (action === 'copy-url') {
        const salida = document.getElementById(boton.dataset.urlId);
        if (!salida?.value) return;
        navigator.clipboard?.writeText(salida.value).catch(() => {});
        const texto = boton.textContent;
        boton.textContent = 'Copiado';
        window.setTimeout(() => { boton.textContent = texto; }, 1500);
      }
      if (action === 'export-csv') exportarCsv(bloque);
      if (action === 'clear-block') {
        const def = BLOQUES.find(b => b.id === bloque);
        const src = document.getElementById(`utm-${bloque}-source`);
        const med = document.getElementById(`utm-${bloque}-medium`);
        if (src) src.value = def.source;
        if (med) med.value = def.medium;
        serie[bloque] = { camp: 0, as: 0, ad: 0 };
        const contenedor = document.getElementById(`utm-${bloque}-campaigns`);
        if (!contenedor) return;
        contenedor.innerHTML = '';
        añadir(contenedor, campanaHtml(bloque, `camp${++serie[bloque].camp}`));
      }
    });
  }

  function añadir(contenedor, html) {
    const envoltorio = document.createElement('div');
    envoltorio.innerHTML = html;
    const nodo = envoltorio.firstElementChild;
    if (nodo) { contenedor.appendChild(nodo); nodo.querySelector('input')?.focus(); }
  }

  function init() {
    if (montado) return;
    const destino = document.getElementById('utm-blocks');
    if (!destino) return;
    destino.innerHTML = BLOQUES.map(bloqueHtml).join('');
    BLOQUES.forEach(b => {
      const el = document.getElementById(`utm-${b.id}-block`);
      if (el) acciones(el, b.id);
    });
    const marca = document.getElementById('utm-marca-actual');
    if (marca) marca.textContent = marcaDelTablero() || 'sin marca';
    montado = true;
  }

  // `construirUrl` y `limpiar` salen por aquí para que tests/utm_builder.cjs los compruebe sin DOM.
  window.TierraFilmsUtm = { init, construirUrl, limpiar };
})();
