(function () {
  // Palabras Clave | informe de la carpeta Google Ads TF Keywords: palabras que convierten.
  // Trae su propio rango, independiente del filtro de mes del modulo. Los informes de la
  // carpeta TF Segmentacion viven en su propio modulo (js/segmentation.js).
  const state = { showAllKeywords: false };
  const F = () => window.TierraFilmsFormat;

  function rangeLabel(start, end) {
    const f = F();
    const [ys, ms, ds] = start.split('-').map(Number);
    const [ye, me] = end.split('-').map(Number);
    const head = ys === ye && ms === me ? String(ds) : f.shortDate(start);
    return `${head} - ${f.shortDate(end)}${ye ? ` ${ye}` : ''}`;
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

  function render() {
    const host = document.getElementById('kw-drive');
    const data = window.TIERRA_FILMS_RETAIL_DATA;
    if (!host || !data || !F()) return;
    const drive = window.TierraFilmsDrive;
    const urls = (drive && drive.folderUrls) || {};
    const links = urls.keywords ? `<a class="drive-link" href="${F().escapeHtml(urls.keywords)}" target="_blank" rel="noopener">Carpeta Keywords</a>` : '';
    const blocks = data.keywordConversions ? renderKeywords(data.keywordConversions) : '';
    host.innerHTML = `
      <div class="drive-block-head">
        <div>
          <div class="sec-lbl">Desde Google Drive</div>
          <p>Informe de la carpeta Google Ads TF Keywords. Muestra su propio rango de fechas; el filtro de mes de arriba no lo cambia. Categorias de busqueda y ubicaciones estan en el modulo Segmentacion.</p>
        </div>
        ${links ? `<div class="drive-links">${links}</div>` : ''}
      </div>
      ${blocks || '<div class="data-notice"><strong>Todavia no hay informe de Drive.</strong>Sube a la carpeta Keywords el informe de palabras clave por accion de conversion y aprieta Sincronizar.</div>'}`;
    const keywordsToggle = host.querySelector('[data-keywords-toggle]');
    if (keywordsToggle) keywordsToggle.addEventListener('click', () => { state.showAllKeywords = !state.showAllKeywords; render(); });
  }

  window.addEventListener('tierra-films:data-ready', render);
  window.TierraFilmsSearchInsights = { render };
})();
