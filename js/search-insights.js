(function () {
  // Palabras Clave | informes de las carpetas de Drive: palabras que convierten (TF Keywords),
  // categorias de busqueda y ubicaciones (TF Segmentacion).
  // Cada informe trae su propio rango, independiente del filtro de mes del modulo.
  const TOP_CATEGORIES = 12;
  const PLACE_COLORS = ['#0284c7', '#7c3aed', '#0f766e', '#f59e0b', '#94a3b8'];
  const state = { showAll: false, showAllKeywords: false };
  const F = () => window.TierraFilmsFormat;

  function rangeLabel(start, end) {
    const f = F();
    const [ys, ms, ds] = start.split('-').map(Number);
    const [ye, me] = end.split('-').map(Number);
    const head = ys === ye && ms === me ? String(ds) : f.shortDate(start);
    return `${head} - ${f.shortDate(end)}${ye ? ` ${ye}` : ''}`;
  }

  // Cambio contra el periodo anterior. "nuevo" cuando antes era 0 (Google Ads lo marca con ∞).
  function changeCell(value) {
    if (value === Infinity) return '<td class="num delta-cell up">nuevo</td>';
    if (value === null || value === undefined || !Number.isFinite(value)) return '<td class="num delta-cell">-</td>';
    const cls = Math.abs(value) < 0.005 ? '' : value > 0 ? 'up' : 'down';
    const sign = value > 0 ? '+' : '';
    return `<td class="num delta-cell ${cls}">${sign}${(value * 100).toLocaleString('es-PE', { maximumFractionDigits: 0 })}%</td>`;
  }

  function categoryRow(item, extraClass = '') {
    const f = F();
    return `<tr class="${extraClass}">
      <td class="campaign-name">${f.escapeHtml(item.unclassified ? 'Sin clasificar' : item.name)}</td>
      <td class="num">${f.fmtCount(item.impressions)}</td>${changeCell(item.impressionsChange)}
      <td class="num">${f.fmtCount(item.clicks)}</td>${changeCell(item.clicksChange)}
      <td class="num">${item.impressions ? f.fmtPercent(item.ctr) : '-'}</td>
      <td class="num">${f.fmtCount(item.conversions)}</td>${changeCell(item.conversionsChange)}
      <td class="num">${item.clicks ? f.fmtPercent(item.convRate) : '-'}</td>
      <td class="num">${f.escapeHtml(item.volume || '-')}</td>${changeCell(item.volumeChange)}
    </tr>`;
  }

  function renderTerms(terms) {
    const f = F();
    const classified = terms.categories.filter(item => !item.unclassified).sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks);
    const unclassified = terms.categories.filter(item => item.unclassified);
    const sum = key => terms.categories.reduce((total, item) => total + (item[key] || 0), 0);
    const totals = { impressions: sum('impressions'), clicks: sum('clicks'), conversions: sum('conversions') };
    const looseShare = totals.impressions ? unclassified.reduce((total, item) => total + item.impressions, 0) / totals.impressions : 0;
    const visible = state.showAll ? classified : classified.slice(0, TOP_CATEGORIES);
    const compare = terms.compareStart && terms.compareEnd ? ` contra ${rangeLabel(terms.compareStart, terms.compareEnd)}` : '';
    const toggle = classified.length > TOP_CATEGORIES
      ? `<button type="button" class="drive-more" data-terms-toggle>${state.showAll ? `Ver solo las ${TOP_CATEGORIES} principales` : `Ver las ${classified.length} categorias`}</button>`
      : '';
    return `
      <div class="panel campaigns-panel drive-panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">Categorias de busqueda | ${f.escapeHtml(rangeLabel(terms.start, terms.end))}</div>
            <div class="panel-sub">Como agrupa Google Ads lo que la gente busco${f.escapeHtml(compare)}. % Δ compara con esa semana. Fuente: ${f.escapeHtml(terms.sourceFile)}.</div>
          </div>
        </div>
        <div class="drive-stats">
          <div><span>Impresiones</span><strong>${f.fmtCount(totals.impressions)}</strong></div>
          <div><span>Clics</span><strong>${f.fmtCount(totals.clicks)}</strong></div>
          <div><span>Conversiones</span><strong>${f.fmtCount(totals.conversions)}</strong></div>
          <div><span>Categorias con impresiones</span><strong>${classified.filter(item => item.impressions > 0).length}</strong></div>
          <div><span>Busquedas sin clasificar</span><strong>${Math.round(looseShare * 100)}%</strong><small>de las impresiones</small></div>
        </div>
        <div class="table-scroll">
          <table class="data-table campaigns-table drive-terms-table">
            <thead><tr><th>Categoria</th><th class="num">Impresiones</th><th class="num">% Δ</th><th class="num">Clics</th><th class="num">% Δ</th><th class="num">CTR</th><th class="num">Conv.</th><th class="num">% Δ</th><th class="num">Tasa conv.</th><th class="num">Volumen de busquedas</th><th class="num">% Δ</th></tr></thead>
            <tbody>
              ${visible.map(item => categoryRow(item, item.impressions ? '' : 'is-muted')).join('')}
              ${unclassified.map(item => categoryRow(item, 'is-loose')).join('')}
              <tr class="reservations-total-row"><td class="total-label">Total</td><td class="num">${f.fmtCount(totals.impressions)}</td><td></td><td class="num">${f.fmtCount(totals.clicks)}</td><td></td><td class="num">${totals.impressions ? f.fmtPercent(totals.clicks / totals.impressions) : '-'}</td><td class="num">${f.fmtCount(totals.conversions)}</td><td></td><td class="num">${totals.clicks ? f.fmtPercent(totals.conversions / totals.clicks) : '-'}</td><td></td><td></td></tr>
            </tbody>
          </table>
        </div>
        ${toggle ? `<div class="drive-more-wrap">${toggle}</div>` : ''}
      </div>`;
  }

  function renderKeywords(report) {
    const f = F();
    const total = report.keywords.reduce((sum, item) => sum + item.conversions, 0);
    const onlyConversions = report.byAction && report.keywords.every(item => !item.impressions && !item.cost);
    const converting = report.keywords.filter(item => item.conversions > 0);
    const visible = state.showAllKeywords ? report.keywords : converting;
    const actions = report.actions;
    const metricHead = onlyConversions ? '' : '<th class="num">Impr.</th><th class="num">Clics</th><th class="num">Gasto</th><th class="num">Costo x conv.</th>';
    const row = item => {
      const share = total ? item.conversions / total : 0;
      const metrics = onlyConversions ? '' : `<td class="num">${f.fmtCount(item.impressions)}</td><td class="num">${f.fmtCount(item.clicks)}</td><td class="num">${f.fmtMoney(item.cost)}</td><td class="num">${item.conversions ? f.fmtMoney(item.cost / item.conversions) : '-'}</td>`;
      return `<tr class="${item.conversions ? '' : 'is-muted'}">
        <td class="campaign-name">${f.escapeHtml(item.keyword)}${item.paused ? ' <span class="status-pill muted">detenida</span>' : ''}</td>
        <td><span class="match-pill">${f.escapeHtml(item.match || '-')}</span></td>
        <td class="num"><strong>${f.fmtCount(item.conversions)}</strong></td>
        <td class="num"><span class="kw-share"><i style="width:${(share * 100).toFixed(2)}%"></i></span>${total && item.conversions ? `${Math.round(share * 100)}%` : '-'}</td>
        ${actions.map(action => `<td class="num">${item.actions[action] ? f.fmtCount(item.actions[action]) : '-'}</td>`).join('')}
        ${metrics}
      </tr>`;
    };
    const acc = report.account;
    const note = onlyConversions
      ? `El informe viene separado por accion de conversion, asi que por palabra clave solo trae conversiones.${acc ? ` En el mismo periodo la cuenta tuvo ${f.fmtCount(acc.impressions)} impresiones, ${f.fmtCount(acc.clicks)} clics y ${f.fmtMoney(acc.cost)} de gasto.` : ''}`
      : '';
    const hidden = report.keywords.length - converting.length;
    const toggle = hidden > 0
      ? `<button type="button" class="drive-more" data-keywords-toggle>${state.showAllKeywords ? 'Ver solo las que convierten' : `Ver tambien las ${hidden} sin conversiones`}</button>`
      : '';
    return `
      <div class="panel campaigns-panel drive-panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">Palabras clave que convierten | ${f.escapeHtml(rangeLabel(report.start, report.end))}</div>
            <div class="panel-sub">Conversiones de cada palabra clave y por que accion llegaron. Fuente: ${f.escapeHtml(report.sourceFile)}.</div>
          </div>
          <div class="drive-total"><strong>${f.fmtCount(total)}</strong> conversiones · ${converting.length} de ${report.keywords.length} palabras</div>
        </div>
        <div class="table-scroll">
          <table class="data-table campaigns-table drive-terms-table">
            <thead><tr><th>Palabra clave</th><th>Concordancia</th><th class="num">Conv.</th><th class="num">% del total</th>${actions.map(action => `<th class="num">${f.escapeHtml(action)}</th>`).join('')}${metricHead}</tr></thead>
            <tbody>
              ${visible.map(row).join('')}
              <tr class="reservations-total-row"><td class="total-label">Total</td><td></td><td class="num">${f.fmtCount(total)}</td><td></td>${actions.map(action => `<td class="num">${f.fmtCount(report.keywords.reduce((sum, item) => sum + (item.actions[action] || 0), 0))}</td>`).join('')}${onlyConversions ? '' : '<td></td><td></td><td></td><td></td>'}</tr>
            </tbody>
          </table>
        </div>
        ${toggle ? `<div class="drive-more-wrap">${toggle}</div>` : ''}
        ${note ? `<div class="panel-note">${note}</div>` : ''}
      </div>`;
  }

  function renderPlaces(places) {
    const f = F();
    const total = places.places.reduce((sum, item) => sum + item.conversions, 0);
    const onlyConversions = places.byAction && places.places.every(item => !item.impressions && !item.cost);
    const rows = places.places.map((item, index) => {
      const share = total ? item.conversions / total : 0;
      const color = PLACE_COLORS[Math.min(index, PLACE_COLORS.length - 1)];
      const actions = item.actions.length ? item.actions.map(action => `${f.escapeHtml(action.name)} ${f.fmtCount(action.conversions)}`).join(' · ') : '';
      const extra = onlyConversions ? '' : `<span class="place-extra">${f.fmtCount(item.impressions)} impr. · ${f.fmtMoney(item.cost)}</span>`;
      return `<li>
        <div class="place-head"><span class="place-name" title="${f.escapeHtml(item.full)}">${f.escapeHtml(item.name)}</span><span class="place-value"><strong>${f.fmtCount(item.conversions)}</strong> conv. <small>${total ? `${Math.round(share * 100)}%` : '-'}</small></span></div>
        <div class="place-bar"><i style="width:${(share * 100).toFixed(2)}%;background:${color}"></i></div>
        <div class="place-actions">${actions}${extra}</div>
      </li>`;
    }).join('');
    const loc = places.located;
    const acc = places.account;
    const note = onlyConversions && loc
      ? `El informe viene separado por accion de conversion, asi que por ubicacion solo trae conversiones. Con ubicacion identificada: ${f.fmtCount(loc.impressions)} impresiones, ${f.fmtCount(loc.interactions)} interacciones y ${f.fmtMoney(loc.cost)}${acc ? ` (la cuenta: ${f.fmtCount(acc.impressions)}, ${f.fmtCount(acc.interactions)} y ${f.fmtMoney(acc.cost)})` : ''}.`
      : '';
    return `
      <div class="panel drive-panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">Ubicaciones | ${f.escapeHtml(rangeLabel(places.start, places.end))}</div>
            <div class="panel-sub">De donde vienen las conversiones. Fuente: ${f.escapeHtml(places.sourceFile)}.</div>
          </div>
          <div class="drive-total"><strong>${f.fmtCount(total)}</strong> conversiones</div>
        </div>
        <ul class="place-list">${rows}</ul>
        ${note ? `<div class="panel-note">${note}</div>` : ''}
      </div>`;
  }

  function render() {
    const host = document.getElementById('kw-drive');
    const data = window.TIERRA_FILMS_RETAIL_DATA;
    if (!host || !data || !F()) return;
    const drive = window.TierraFilmsDrive;
    const urls = (drive && drive.folderUrls) || {};
    const links = [['keywords', 'Carpeta Keywords'], ['segmentacion', 'Carpeta Segmentacion']]
      .filter(([key]) => urls[key])
      .map(([key, label]) => `<a class="drive-link" href="${F().escapeHtml(urls[key])}" target="_blank" rel="noopener">${label}</a>`).join('');
    const blocks = [
      data.keywordConversions ? renderKeywords(data.keywordConversions) : '',
      data.searchTerms ? renderTerms(data.searchTerms) : '',
      data.locations ? renderPlaces(data.locations) : ''
    ].join('');
    host.innerHTML = `
      <div class="drive-block-head">
        <div>
          <div class="sec-lbl">Desde Google Drive</div>
          <p>Informes de las carpetas Google Ads TF Keywords y Segmentacion. Cada uno muestra su propio rango de fechas; el filtro de mes de arriba no los cambia.</p>
        </div>
        ${links ? `<div class="drive-links">${links}</div>` : ''}
      </div>
      ${blocks || '<div class="data-notice"><strong>Todavia no hay informes de Drive.</strong>Sube a las carpetas el informe de palabras clave, el de estadisticas de terminos de busqueda o el de ubicaciones y aprieta Sincronizar.</div>'}`;
    const toggle = host.querySelector('[data-terms-toggle]');
    if (toggle) toggle.addEventListener('click', () => { state.showAll = !state.showAll; render(); });
    const keywordsToggle = host.querySelector('[data-keywords-toggle]');
    if (keywordsToggle) keywordsToggle.addEventListener('click', () => { state.showAllKeywords = !state.showAllKeywords; render(); });
  }

  window.addEventListener('tierra-films:data-ready', render);
  window.TierraFilmsSearchInsights = { render };
})();
