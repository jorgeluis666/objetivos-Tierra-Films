(function () {
  // Generacion de Reporte: el PDF de publicidad con el diseño del modelo de Tierra Films ("Modelo Reporte
  // Tierra Films"): laminas 16:9 con portada, contenido, resumen del mes (KPIs y clics y conversiones por
  // dia), palabras clave que convierten, conclusiones y cierre.
  //
  // No trae datos nuevos: el periodo, la comparacion con el mes anterior (prorrateado si el mes esta en
  // curso), los totales, las palabras clave del mes y las conversiones por accion salen de Gasto
  // Publicitario (window.TierraFilmsGasto), y la serie por dia de window.TierraFilmsDays, asi que cada
  // sincronizacion con Drive lo actualiza solo. La lectura del grafico, el texto "Clave", el analisis y las
  // conclusiones vienen propuestos con lo que dicen los numeros; el equipo los reescribe sobre la misma
  // lamina y quedan guardados por mes en este navegador.
  //
  // El template es propio de Tierra Films: cada tablero de marca tiene el suyo, adaptado por la marca.
  const BRAND = 'Tierra Films';
  const NOTES_KEY = 'tierra_films_report_notes_v2';
  const MAX_KEYWORDS = 6;
  const PAGE_WIDTH = 1280;
  const LOGO = 'assets/logo-lima-retail.png';
  const AGENCY_LINE = 'Lima Retail · Data Driven Marketing · Power KPI · Digital Analytics';
  const CHANNEL = 'Google Ads · Search';
  const CLICKS_COLOR = '#2563eb';
  const CONV_COLOR = '#0f172a';

  // Iconos de linea (24x24) de las tarjetas de contenido y conclusiones.
  const ICONS = {
    chart: '<path d="M3 3v18h18"/><path d="M8 17v-5"/><path d="M13 17V8"/><path d="M18 17v-3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    flag: '<path d="M4 22V4"/><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1"/>',
    trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    line: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.chart}</svg>`;

  const state = { month: '', wired: false };

  const G = () => window.TierraFilmsGasto;
  const F = () => window.TierraFilmsFormat;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const isNum = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

  // ── Formatos del modelo ("S/ 330", "S/ 3.14", "10.27%", "5.99", "-71.1%") ─
  const integer = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 });
  const money = value => (isNum(value) ? `S/ ${integer.format(Math.round(value))}` : '—');
  const money2 = value => (isNum(value) ? `S/ ${Number(value).toFixed(2)}` : '—');
  const count = value => (isNum(value) ? integer.format(Math.round(value)) : '—');
  const percent = value => (isNum(value) ? `${(Number(value) * 100).toFixed(2).replace(/\.?0+$/, '')}%` : '—');
  const conv2 = value => (isNum(value) ? Number(value).toFixed(2) : '—');
  const change = (current, previous) => (isNum(current) && isNum(previous) && Number(previous) !== 0 ? (Number(current) - Number(previous)) / Number(previous) : null);
  const pct1 = value => `${value >= 0 ? '+' : '-'}${Math.abs(value * 100).toFixed(1)}%`;
  const pct0 = value => `${value >= 0 ? '+' : '-'}${Math.abs(Math.round(value * 100))}%`;
  const pageNumber = value => String(value).padStart(2, '0');
  const list = items => (items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : items[0] || '');
  const quoted = items => list(items.map(item => `"${item}"`));
  const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);

  // ── El mes del reporte ─────────────────────────────────────────────────
  function months() {
    if (!G()) return [];
    return G().months().slice().reverse().map(month => {
      const period = G().period(month.key);
      if (!period) return null;
      const from = month.firstDay;
      const to = month.lastDay;
      const short = month.shortName.toLowerCase();
      const range = `${from} – ${to}`;
      return {
        id: month.key,
        month,
        period,
        from,
        to,
        option: `${month.name} ${month.year}${period.closed ? '' : ` · ${from}–${to} (en curso)`}`,
        labels: {
          cover: period.closed ? `${month.name} ${month.year}` : `${range} ${month.name} ${month.year}`,
          intro: period.closed
            ? `${month.name} completo: campañas de búsqueda para contactos por WhatsApp y formularios.`
            : `Primeros ${to - from + 1} días de ${month.name.toLowerCase()}: campañas de búsqueda para contactos por WhatsApp y formularios.`,
          days: to - from + 1,
          source: `Fuente: Google Ads · ${range} ${short} ${month.year}`,
          analysisSource: `Fuente: análisis Lima Retail sobre Google Ads · ${range} ${short} ${month.year}`,
          footer: `${BRAND} · Reporte Google Ads · ${period.closed ? `${month.name} ${month.year}` : `${from}-${to} ${month.name} ${month.year}`}`,
          note: period.closed ? '' : `**Datos del período ${range} de ${month.name.toLowerCase()}.** Las métricas se consolidan al cierre del mes.`,
          file: `${month.name}${month.year}${period.closed ? '' : `_${from}-${to}`}`,
        },
      };
    }).filter(Boolean);
  }

  // Conversiones por accion del mes: WhatsApp (plugin y clic) y formularios.
  function actions(period) {
    const blocks = G().actions(period);
    if (!blocks.length) return null;
    const sum = test => blocks.reduce((total, block) => total + block.actions.filter(action => test.test(action.name)).reduce((acc, action) => acc + (Number(action.conversions) || 0), 0), 0);
    return { whatsapp: sum(/whatsapp/i), forms: sum(/formulario|form/i) };
  }

  // Serie por dia del mes: la del modulo Gasto Publicitario (clics y conversiones reales donde el export
  // por dia los trae; si no, repartidos desde la semana).
  function dailySeries(item) {
    const rows = (Array.isArray(window.TierraFilmsDays) ? window.TierraFilmsDays : [])
      .filter(day => day.date.startsWith(item.id))
      .filter(day => {
        const d = Number(day.date.slice(8, 10));
        return d >= item.from && d <= item.to;
      });
    return {
      rows,
      estimated: rows.some(day => day.estimated && (day.estimated.clicks || day.estimated.conversions)),
      complete: rows.length === item.to - item.from + 1,
    };
  }

  // Palabras clave del mes, de mas a menos conversiones. Solo las que tuvieron actividad.
  // El informe de Drive viene por accion de conversion: trae las conversiones de cada palabra pero no su costo
  // ni sus clics. Esos salen del informe semanal de palabras clave del mismo mes, si lo hay, y las palabras que
  // ahi gastaron sin aparecer en Drive entran con 0 conversiones (son las que hay que depurar).
  function keywords(period) {
    const scope = G().keywords(period);
    let rows = scope.rows.map(row => Object.assign({}, row));
    let hasMetrics = scope.hasMetrics;
    let metricsFrom = null;
    const weekly = !hasMetrics && period.months.length === 1 && G().weeklyKeywords ? G().weeklyKeywords(period.month) : null;
    if (weekly && weekly.rows.length) {
      const byKey = new Map(weekly.rows.map(row => [row.key, row]));
      rows.forEach(row => {
        const match = byKey.get(row.key);
        byKey.delete(row.key);
        ['cost', 'impressions', 'clicks'].forEach(field => { row[field] = match ? match[field] : 0; });
      });
      byKey.forEach(row => {
        if (Number(row.cost) > 0) rows.push({ key: row.key, keyword: row.keyword, conversions: 0, cost: row.cost, impressions: row.impressions, clicks: row.clicks });
      });
      rows.forEach(row => {
        row.ctr = Number(row.impressions) > 0 ? row.clicks / row.impressions : null;
        row.costPerConversion = Number(row.conversions) > 0 && Number(row.cost) > 0 ? row.cost / row.conversions : null;
      });
      hasMetrics = true;
      metricsFrom = { from: weekly.startDay, to: weekly.endDay };
    }
    // La misma palabra con dos concordancias (amplia y frase) va en una sola fila, como la lee el cliente.
    const byName = new Map();
    rows.forEach(row => {
      const name = String(row.keyword || '').trim().toLowerCase();
      if (!byName.has(name)) {
        byName.set(name, Object.assign({}, row));
        return;
      }
      const entry = byName.get(name);
      ['conversions', 'cost', 'impressions', 'clicks'].forEach(field => {
        if (isNum(row[field])) entry[field] = (Number(entry[field]) || 0) + Number(row[field]);
      });
    });
    rows = [...byName.values()].map(row => Object.assign(row, {
      ctr: Number(row.impressions) > 0 ? row.clicks / row.impressions : null,
      costPerConversion: Number(row.conversions) > 0 && Number(row.cost) > 0 ? row.cost / row.conversions : null,
    }));
    rows = rows
      .filter(row => Number(row.conversions) > 0 || Number(row.cost) > 0 || Number(row.clicks) > 0)
      .sort((left, right) => (right.conversions || 0) - (left.conversions || 0) || (right.cost || 0) - (left.cost || 0));
    const total = rows.reduce((sum, row) => sum + (Number(row.conversions) || 0), 0);
    return { rows, total, hasMetrics, metricsFrom, estimated: scope.estimated };
  }

  function buildReport(item) {
    const current = G().totals(item.period);
    const previous = G().previous(item.period);
    return {
      item,
      labels: item.labels,
      current,
      previous,
      actions: actions(item.period),
      days: dailySeries(item),
      keywords: keywords(item.period),
      campaigns: item.month.campaigns.filter(campaign => Number(campaign.cost) > 0 || Number(campaign.clicks) > 0),
    };
  }

  // ── Textos propuestos (el equipo los reescribe sobre la lamina) ─────────
  function suggestChartNote(report) {
    const clicks = report.days.rows.map(day => Number(day.clicks) || 0);
    const parts = [];
    if (clicks.length > 2) {
      const mean = clicks.reduce((sum, value) => sum + value, 0) / clicks.length;
      const spread = Math.sqrt(clicks.reduce((sum, value) => sum + (value - mean) ** 2, 0) / clicks.length);
      parts.push(mean > 0 && spread / mean > 0.45 ? 'El tráfico fue irregular' : 'El tráfico fue estable');
    }
    const { rows, total } = report.keywords;
    const top = rows[0];
    if (top && total > 0) {
      parts.push(top.conversions / total >= 0.5 ? `las conversiones se concentraron en ${top.keyword}` : `las conversiones se repartieron entre ${rows.filter(row => row.conversions > 0).length} términos`);
    }
    return parts.length ? `${capitalize(parts.join('; '))}.` : '';
  }

  function suggestKey(report) {
    const { rows, total, hasMetrics } = report.keywords;
    const converting = rows.filter(row => row.conversions > 0);
    const wasted = rows.filter(row => !(row.conversions > 0) && Number(row.cost) > 0);
    if (!converting.length) return 'Ningún término de búsqueda cerró contactos en el período: conviene revisar la intención de las palabras clave y la landing.';
    const [top, ...rest] = converting;
    const parts = [`"${top.keyword}" es el término estrella: ${count(top.conversions)} ${Math.round(top.conversions) === 1 ? 'conversión' : 'conversiones'}${hasMetrics && isNum(top.clicks) ? ` (${count(top.clicks)} clics)` : ''}${isNum(top.costPerConversion) ? ` a ${money2(top.costPerConversion)} c/u` : ''}.`];
    rest.slice(0, 2).forEach((row, index) => {
      const cost = isNum(row.costPerConversion) ? ` a ${money2(row.costPerConversion)}` : '';
      parts.push(`${index === 0 ? '' : 'y '}"${row.keyword}" aporta ${count(row.conversions)} más${cost}${index === 0 && rest.length > 1 ? ',' : '.'}`);
    });
    if (wasted.length) parts.push('Los demás términos gastaron sin convertir.');
    if (total > 0 && top.conversions / total >= 0.5) parts.push(`El foco de demanda está en "${top.keyword}".`);
    return parts.join(' ').replace(/, y /g, ' y ');
  }

  function suggestAnalysis(report) {
    const { rows } = report.keywords;
    const converting = rows.filter(row => row.conversions > 0);
    const wasted = rows.filter(row => !(row.conversions > 0) && Number(row.cost) > 0);
    if (!converting.length) {
      return '**Qué funciona:** ningún término cerró contactos en el período. **Qué mejoramos:** revisar la concordancia y la landing. **Qué hacemos:** concentrar el presupuesto en las búsquedas con intención de contratar.';
    }
    const names = converting.slice(0, 3).map(row => `"${row.keyword}" (${count(row.conversions)})`);
    const works = `**Qué funciona:** ${converting.length === 1 ? 'un término cierra contactos' : `${converting.length > 3 ? 'varios' : ['', 'un', 'dos', 'tres'][converting.length]} términos cierran contactos`} — ${list(names)}.`;
    const improve = wasted.length
      ? `**Qué mejoramos:** reforzar la puja en ${converting.length === 1 ? 'ese término' : 'esos términos'} y pausar o ajustar los que gastan sin convertir (${list(wasted.slice(0, 3).map(row => row.keyword))}).`
      : `**Qué mejoramos:** reforzar la puja en ${converting.length === 1 ? 'ese término' : 'esos términos'} para ganar más impresiones.`;
    const next = `**Qué hacemos:** concentrar el presupuesto en la intención de "${converting[0].keyword}", que es la que trae clientes.`;
    return `${works} ${improve} ${next}`;
  }

  function suggestConclusions(report) {
    const cards = [];
    const { rows, total } = report.keywords;
    const top = rows.find(row => row.conversions > 0);
    if (top && total > 0) {
      const share = Math.round((top.conversions / total) * 100);
      const leadsSpend = rows.every(row => !(Number(row.cost) > Number(top.cost)));
      cards.push({
        icon: 'search',
        title: `${capitalize(top.keyword)} manda`,
        text: `Concentra ${count(top.conversions)} de las ${count(total)} conversiones (${share}%)${leadsSpend && Number(top.cost) > 0 ? ' y la mayor inversión' : ''}. Es el término estrella — mantener y reforzar la puja aquí.`,
      });
    }
    const { current, previous } = report;
    const costChange = previous ? change(current.costPerConversion, previous.costPerConversion) : null;
    const spendChange = previous ? change(current.cost, previous.cost) : null;
    if (costChange !== null) {
      const better = costChange <= 0;
      cards.push({
        icon: 'trend',
        title: `Costo por conversión ${better ? 'mejoró' : 'subió'}`,
        text: `Con ${spendChange !== null && spendChange < 0 ? 'menos' : 'más'} inversión${spendChange !== null ? ` (${pct0(spendChange)})` : ''}, el costo por conversión ${better ? 'bajó' : 'subió'} a ${money(current.costPerConversion)} (${pct0(costChange)}). ${better ? 'El canal se volvió más eficiente — buena base para escalar.' : 'Revisar pujas y términos para recuperar eficiencia.'}`,
      });
    } else if (isNum(current.costPerConversion)) {
      cards.push({
        icon: 'trend',
        title: `Costo por conversión de ${money(current.costPerConversion)}`,
        text: `${count(current.conversions)} conversiones con ${money(current.cost)} de inversión. Es la base para comparar el próximo mes.`,
      });
    }
    const wasted = rows.filter(row => !(row.conversions > 0) && Number(row.cost) > 0).sort((left, right) => right.cost - left.cost);
    if (wasted.length) {
      cards.push({
        icon: 'line',
        title: 'Depurar términos sin conversión',
        text: `${quoted(wasted.slice(0, 2).map(row => row.keyword))} ${wasted.length > 1 ? 'gastan' : 'gasta'} sin convertir. Revisar y reasignar ese presupuesto a los términos que sí cierran.`,
      });
    } else if (rows.filter(row => row.conversions > 0).length > 1) {
      cards.push({
        icon: 'line',
        title: 'Sostener los términos que cierran',
        text: `${quoted(rows.filter(row => row.conversions > 0).slice(1, 3).map(row => row.keyword))} también traen contactos. Mantener su puja y probar variantes de la misma intención.`,
      });
    }
    return cards.slice(0, 3);
  }

  // ── Textos guardados por mes ───────────────────────────────────────────
  function readNotes() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(NOTES_KEY) || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch (error) {
      return {};
    }
  }

  function writeNotes(notes) {
    try {
      window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    } catch (error) {
      // Sin localStorage el texto dura hasta recargar; el PDF se descarga igual.
    }
  }

  function saveNote(monthId, key, value) {
    const notes = readNotes();
    notes[monthId] = Object.assign({}, notes[monthId] || {}, { [key]: value });
    writeNotes(notes);
  }

  function resetNotes(monthId) {
    const notes = readNotes();
    delete notes[monthId];
    writeNotes(notes);
  }

  // **texto** va en negrita, como "Que funciona:" en el modelo.
  const rich = text => esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

  // Texto editable sobre la lamina: al hacer clic se ve el texto con sus ** y al salir vuelve a negrita.
  const editable = (key, text, tag = 'p', className = '') => `<${tag} class="rp-edit ${className}" data-note="${esc(key)}" data-raw="${esc(text)}" title="Clic para editar · **texto** va en negrita">${rich(text)}</${tag}>`;
  const noteOr = (notes, key, suggested) => (notes[key] != null ? notes[key] : suggested);

  // ── Piezas de las laminas ──────────────────────────────────────────────
  const kpi = (label, value, foot) => `
    <div class="rp-card rp-kpi">
      <span class="rp-kpi-label">${esc(label)}</span>
      <strong>${value}</strong>
      <span class="rp-delta muted">${foot}</span>
    </div>`;

  // "▼ -71.1%": en el modelo las variaciones van en gris, con la flecha de su direccion.
  function delta(current, previous) {
    const value = change(current, previous);
    if (value === null) return '';
    return `${value >= 0 ? '▲' : '▼'} ${pct1(value)}`;
  }

  const head = (title, sub) => `<header class="rp-head"><h2>${esc(title)}</h2><p>${esc(sub)}</p></header>`;

  function footer(left, report, page, total) {
    return `
      <footer class="rp-foot">
        <span>${esc(left)}</span>
        <span class="rp-foot-right"><img src="${LOGO}" alt=""><b>Lima Retail</b>${esc(report.labels.footer)} · ${pageNumber(page)} / ${pageNumber(total)}</span>
      </footer>`;
  }

  // Clics y conversiones por dia, con lineas punteadas de referencia (como el modelo).
  function dailyChart(report) {
    const { rows } = report.days;
    if (!rows.length) {
      return '<p class="rp-empty rp-chart-empty">El informe diario de este mes todavía no está en el tablero: la evolución por día aparece cuando se suba el informe de campaña por día.</p>';
    }
    const width = 1160;
    const top = 16;
    const bottom = 236;
    const left = 70;
    const right = width - 30;
    const clicks = rows.map(day => Number(day.clicks) || 0);
    const conversions = rows.map(day => Number(day.conversions) || 0);
    const peak = Math.max(...clicks, ...conversions, 1);
    const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find(size => peak / size <= 4) || 1000;
    const max = Math.ceil(peak / step) * step;
    const x = index => (rows.length > 1 ? left + ((right - left) * index) / (rows.length - 1) : (left + right) / 2);
    const y = value => bottom - (value / max) * (bottom - top);
    const grid = [];
    for (let value = step; value <= max; value += step) {
      grid.push(`<line x1="${left - 18}" x2="${right + 12}" y1="${y(value)}" y2="${y(value)}" class="rp-grid dashed"/><text x="${left - 40}" y="${y(value) + 4}" text-anchor="end" class="rp-tick big">${integer.format(value)}</text>`);
    }
    const line = (values, color) => `
      <polyline points="${values.map((value, index) => `${x(index)},${y(value)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>
      ${values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="3.4" fill="#fff" stroke="${color}" stroke-width="1.8"/>`).join('')}`;
    const labels = rows.map((day, index) => `<text x="${x(index)}" y="${bottom + 20}" text-anchor="middle" class="rp-axis big">${day.date.slice(8, 10)}</text>`).join('');
    return `
      <svg class="rp-chart rp-chart-daily" viewBox="0 0 ${width} 262" preserveAspectRatio="xMidYMin meet" role="img" aria-label="Clics y conversiones por día">
        ${grid.join('')}
        <line x1="${left - 18}" x2="${right + 12}" y1="${bottom}" y2="${bottom}" class="rp-grid"/>
        ${line(clicks, CLICKS_COLOR)}
        ${line(conversions, CONV_COLOR)}
        ${labels}
      </svg>`;
  }

  function insight(label, iconName, key, text) {
    return `
      <div class="rp-insight">
        <span class="rp-insight-icon">${icon(iconName)}</span>
        <div>
          <span class="rp-insight-label">${label}</span>
          ${editable(key, text)}
        </div>
      </div>`;
  }

  // ── Laminas ────────────────────────────────────────────────────────────
  function issuedLabel() {
    const now = new Date(Date.now() - 5 * 3600000);
    return `${now.getUTCDate()} ${F().MONTH_NAMES[now.getUTCMonth()].slice(0, 3).toLowerCase()}. ${now.getUTCFullYear()}`;
  }

  function coverPage(report) {
    return `
      <section class="rp-page rp-cover">
        <div class="rp-brand"><img src="${LOGO}" alt="Lima Retail"><div><b>Lima Retail</b><span>Data Driven Marketing</span></div></div>
        <div class="rp-cover-body">
          <h1>Reporte de Publicidad</h1>
          <p class="rp-cover-client">Cliente: <b>${BRAND}</b></p>
          <p class="rp-cover-period">${esc(report.labels.cover)}&nbsp; | &nbsp;${esc(CHANNEL)}</p>
          <p class="rp-cover-intro">${esc(report.labels.intro)}</p>
        </div>
        <footer class="rp-foot">
          <span>${AGENCY_LINE}</span>
          <span class="rp-foot-right"><img src="${LOGO}" alt=""><b>Lima Retail</b>Emitido el ${esc(issuedLabel())}</span>
        </footer>
      </section>`;
  }

  function contentsPage(report, total) {
    const days = report.labels.days;
    const items = [
      { title: 'Resumen del mes', desc: `Inversión, conversiones y costo por resultado ${report.item.period.closed ? 'del mes' : `de los primeros ${days} días`}, con la evolución diaria.`, icon: 'chart', page: 3 },
      { title: 'Palabras clave', desc: 'Los términos de búsqueda que generaron contactos, su costo y eficiencia, y cuáles depurar.', icon: 'search', page: 4 },
      { title: 'Conclusiones', desc: 'Las tres decisiones recomendadas para el próximo mes en base a los resultados.', icon: 'flag', page: 5 },
    ];
    return `
      <section class="rp-page">
        ${head('Contenido del reporte', 'Qué encontrarás en cada sección de este informe mensual.')}
        <div class="rp-body rp-contents rp-contents-tall">
          ${items.map((item, index) => `
            <div class="rp-card rp-toc">
              <div class="rp-toc-top"><span class="rp-icon">${icon(item.icon)}</span><span class="rp-toc-num">${pageNumber(index + 1)}</span></div>
              <h3>${esc(item.title)}</h3>
              <p>${esc(item.desc)}</p>
              <span class="rp-toc-page">Página ${pageNumber(item.page)}</span>
            </div>`).join('')}
        </div>
        ${footer(report.labels.source, report, 2, total)}
      </section>`;
  }

  function summaryPage(report, notes, total) {
    const { current, previous, actions: split } = report;
    const prev = key => (previous ? previous[key] : null);
    const join = parts => parts.filter(Boolean).join(' · ');
    const costChange = change(current.costPerConversion, prev('costPerConversion'));
    const splitText = split ? `${count(split.whatsapp)} WhatsApp · ${count(split.forms)} form.` : '';
    const cards = [
      kpi('Inversión', money(current.cost), previous ? `${delta(current.cost, prev('cost'))} vs período ant.` : 'Sin mes anterior'),
      kpi('Conversiones', count(current.conversions), join([delta(current.conversions, prev('conversions')), splitText]) || 'Contactos registrados'),
      kpi('Costo x conversión', money(current.costPerConversion), costChange === null ? 'Inversión ÷ conversiones' : `${delta(current.costPerConversion, prev('costPerConversion'))} (${costChange <= 0 ? 'mejoró' : 'empeoró'})`),
      kpi('Clics', count(current.clicks), join([delta(current.clicks, prev('clicks')), `CTR ${percent(current.ctr)}`])),
      kpi('Impresiones', count(current.impressions), delta(current.impressions, prev('impressions')) || 'Veces que se mostraron'),
      kpi('CPC medio', money2(current.cpc), 'Costo por clic'),
      kpi('CTR', percent(current.ctr), delta(current.ctr, prev('ctr')) || 'Clics ÷ impresiones'),
      split ? kpi('WhatsApp', count(split.whatsapp), `+ ${count(split.forms)} ${Math.round(split.forms) === 1 ? 'formulario' : 'formularios'}`) : '',
    ].filter(Boolean);
    const chartNote = noteOr(notes, 'grafico', suggestChartNote(report));
    const estimated = report.days.rows.length && report.days.estimated;
    return `
      <section class="rp-page">
        ${head('Resumen del mes', report.labels.intro)}
        <div class="rp-body">
          <div class="rp-grid-5">${cards.join('')}</div>
          <div class="rp-card rp-chart-card rp-chart-wide">
            <div class="rp-card-row">
              <div>
                <div class="rp-card-title">Clics y conversiones por día</div>
                ${editable('grafico', chartNote, 'div', 'rp-card-sub')}
              </div>
              <span class="rp-legends"><span class="rp-legend"><i style="background:${CLICKS_COLOR}"></i>Clics</span><span class="rp-legend"><i style="background:${CONV_COLOR}"></i>Conversiones</span></span>
            </div>
            ${dailyChart(report)}
            ${estimated || (report.days.rows.length && !report.days.complete) ? `<p class="rp-chart-foot">${[
              estimated ? 'Clics y conversiones por día repartidos desde el total de cada semana (Google Ads no los entrega por día en este informe).' : '',
              report.days.complete ? '' : `La serie por día llega hasta el ${Number(report.days.rows[report.days.rows.length - 1].date.slice(8, 10))}.`,
            ].filter(Boolean).join(' ')}</p>` : ''}
          </div>
        </div>
        ${footer(report.labels.source, report, 3, total)}
      </section>`;
  }

  function keywordsPage(report, notes, total) {
    const { rows, total: conversions, hasMetrics } = report.keywords;
    const shown = rows.slice(0, MAX_KEYWORDS);
    const top = rows.find(row => row.conversions > 0);
    const body = shown.length ? shown.map((row, index) => {
      const zero = !(row.conversions > 0);
      return `<tr${index === 0 && !zero ? ' class="rp-top"' : ''}>
        <td class="rp-name" title="${esc(row.keyword)}">${esc(row.keyword)}</td>
        <td class="num">${hasMetrics ? money(row.cost) : '—'}</td>
        <td class="num">${hasMetrics ? count(row.clicks) : '—'}</td>
        <td class="num">${zero ? '<span class="rp-faint">0</span>' : conv2(row.conversions)}</td>
        <td class="num">${zero || !isNum(row.costPerConversion) ? '<span class="rp-faint">—</span>' : money2(row.costPerConversion)}</td>
        <td class="num">${hasMetrics ? percent(row.ctr) : '—'}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="6" class="rp-empty">Sin palabras clave con actividad en el período.</td></tr>';
    const campaigns = report.campaigns.map(campaign => campaign.name);
    const campaignLine = campaigns.length === 1 ? `Una sola campaña (${campaigns[0]}).` : campaigns.length ? `${campaigns.length} campañas: ${list(campaigns)}.` : '';
    const concentration = top && conversions > 0 ? ` "${top.keyword}" concentra ${count(top.conversions)} de ${count(conversions)} conversiones.` : '';
    const { metricsFrom } = report.keywords;
    const metricsNote = !hasMetrics
      ? ' El informe de palabras clave del mes viene por acción de conversión: trae conversiones por término, sin costo ni clics.'
      : metricsFrom
        ? ` Costo, clics y CTR del informe semanal de palabras clave (${metricsFrom.from}–${metricsFrom.to} ${report.item.month.shortName.toLowerCase()}); conversiones del informe por acción de conversión.`
        : '';
    return `
      <section class="rp-page">
        ${head('Palabras clave que convierten', 'Los términos de búsqueda que generaron contactos, ordenados por conversiones.')}
        <div class="rp-body">
          <div class="rp-card rp-table-card">
            <table class="rp-table rp-keywords">
              <colgroup><col><col style="width:12%"><col style="width:10%"><col style="width:11%"><col style="width:17%"><col style="width:13%"></colgroup>
              <thead><tr><th>Palabra clave</th><th class="num">Coste</th><th class="num">Clics</th><th class="num">Conv.</th><th class="num">Costo/conv.</th><th class="num">CTR</th></tr></thead>
              <tbody>${body}</tbody>
            </table>
            <div class="rp-table-foot">${esc(`${campaignLine}${concentration}${metricsNote}`.trim())}</div>
          </div>
          ${insight('Clave', 'search', 'clave', noteOr(notes, 'clave', suggestKey(report)))}
          <div class="rp-card rp-analysis">
            <div class="rp-analysis-head">${icon('chart')}<b>Análisis</b></div>
            ${editable('analisis', noteOr(notes, 'analisis', suggestAnalysis(report)))}
          </div>
        </div>
        ${footer(report.labels.source, report, 4, total)}
      </section>`;
  }

  function conclusionsPage(report, notes, total) {
    const cards = suggestConclusions(report).map((card, index) => `
      <div class="rp-card rp-conclusion">
        <div class="rp-toc-top"><span class="rp-icon framed">${icon(card.icon)}</span><span class="rp-concl-num">${pageNumber(index + 1)}</span></div>
        ${editable(`concl:${index}:title`, noteOr(notes, `concl:${index}:title`, card.title), 'h3')}
        ${editable(`concl:${index}:text`, noteOr(notes, `concl:${index}:text`, card.text))}
      </div>`).join('');
    return `
      <section class="rp-page">
        ${head('Conclusiones del período', 'Cómo evolucionó y qué priorizar.')}
        <div class="rp-body rp-centered">
          <div class="rp-grid-3 rp-conclusions">${cards}</div>
          ${report.labels.note ? `<div class="rp-note">${rich(report.labels.note)}</div>` : ''}
        </div>
        ${footer(report.labels.analysisSource, report, 5, total)}
      </section>`;
  }

  function closingPage() {
    return `
      <section class="rp-page rp-closing">
        <img src="${LOGO}" alt="Lima Retail">
        <b>Lima Retail</b>
        <span class="rp-closing-tag">Data Driven Marketing</span>
        <span>Power KPI · Digital Analytics</span>
      </section>`;
  }

  // ── Pintado ────────────────────────────────────────────────────────────
  function fitDeck() {
    const host = document.getElementById('week-report');
    if (!host || !host.clientWidth) return;
    host.style.setProperty('--rp-scale', String(Math.min(1, host.clientWidth / PAGE_WIDTH)));
  }

  function wireEditables(host, monthId) {
    host.querySelectorAll('[data-note]').forEach(node => {
      try {
        node.contentEditable = 'plaintext-only';
      } catch (error) {
        node.contentEditable = 'true';
      }
      node.spellcheck = false;
      node.addEventListener('focus', () => { node.textContent = node.dataset.raw; });
      node.addEventListener('input', () => {
        node.dataset.raw = node.innerText.replace(/\n+$/, '');
        saveNote(monthId, node.dataset.note, node.dataset.raw);
      });
      node.addEventListener('blur', () => { node.innerHTML = rich(node.dataset.raw); });
    });
  }

  function render() {
    const host = document.getElementById('week-report');
    if (!host || !G()) return;
    const available = months();
    const select = document.getElementById('week-select');
    if (!available.length) {
      if (select) select.innerHTML = '<option value="">Sin meses con datos</option>';
      host.innerHTML = '<div class="panel"><div class="empty-state"><strong>Todavia no hay datos para el reporte</strong><span>El reporte se arma con los informes de Google Ads. En cuanto haya un mes con inversion, aparece aqui.</span></div></div>';
      return;
    }
    if (!available.some(item => item.id === state.month)) state.month = available[0].id;
    const item = available.find(entry => entry.id === state.month);
    if (select) {
      select.innerHTML = available.map(entry => `<option value="${esc(entry.id)}"${entry.id === state.month ? ' selected' : ''}>${esc(entry.option)}</option>`).join('');
    }
    const source = document.getElementById('week-source');
    if (source) source.textContent = `Fuente: ${item.month.source === 'Drive' ? `Google Drive (${item.month.sourceFile})` : 'informes de Google Ads del repositorio'}`;

    const report = buildReport(item);
    const notes = readNotes()[item.id] || {};
    const total = 6;
    host.innerHTML = `
      <div class="rp-deck" id="week-doc">
        ${coverPage(report)}
        ${contentsPage(report, total)}
        ${summaryPage(report, notes, total)}
        ${keywordsPage(report, notes, total)}
        ${conclusionsPage(report, notes, total)}
        ${closingPage()}
      </div>`;
    fitDeck();
    wireEditables(host, item.id);
  }

  // El nombre del PDF lo pone el navegador con el titulo del documento: se cambia solo mientras imprime.
  function printReport() {
    const item = months().find(entry => entry.id === state.month);
    if (!item) return;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const title = document.title;
    document.title = `Reporte_Tierra-Films_${item.labels.file}`;
    const restore = () => {
      document.title = title;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
    window.setTimeout(restore, 2000);
  }

  window.TierraFilmsWeekReport = {
    init() {
      render();
      if (state.wired) return;
      state.wired = true;
      const select = document.getElementById('week-select');
      if (select) {
        select.addEventListener('change', event => {
          state.month = event.target.value;
          render();
        });
      }
      const print = document.getElementById('week-print');
      if (print) print.addEventListener('click', printReport);
      // Sin dialogo de confirmacion: el boton vuelve directo a los textos propuestos del mes.
      const reset = document.getElementById('week-reset');
      if (reset) {
        reset.addEventListener('click', () => {
          if (!state.month) return;
          resetNotes(state.month);
          render();
        });
      }
      const host = document.getElementById('week-report');
      if (host && typeof window.ResizeObserver === 'function') new window.ResizeObserver(fitDeck).observe(host);
    }
  };

  // Llega al cargar y cada vez que se sincroniza Drive: si los numeros cambian, el reporte se repinta.
  window.addEventListener('tierra-films:data-ready', () => {
    if (document.getElementById('view-week')?.classList.contains('visible')) render();
  });
})();
