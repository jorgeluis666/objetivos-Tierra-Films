(function () {
  // Generacion de Reporte: el reporte de la ultima semana cerrada de lunes a domingo, con el mismo
  // orden que el de los tableros de Meta de las otras marcas (portada, resumen del periodo, grafico
  // por dia, desglose y conclusiones). No trae datos nuevos: usa las semanas de Google Ads que ya lee
  // Gasto Publicitario (window.TIERRA_FILMS_RETAIL_DATA) y la serie diaria que arma ese modulo
  // (window.TierraFilmsDays), asi que cada sincronizacion con Drive lo actualiza solo.
  //
  // Esta cuenta es de Google Ads en Busqueda: las metricas son las suyas (inversion, impresiones,
  // clics, CTR, CPC, conversiones, costo por conversion y tasa de conversion). No hay alcance,
  // frecuencia, conjuntos de anuncios ni tipos de resultado como en los tableros de Meta; el desglose
  // es por campana y, cuando el informe de palabras clave cubre la semana, por palabra clave.
  const NOTES_KEY = 'tierra_films_week_notes_v1';
  const WEEKS_IN_LIST = 12;
  const SUMS = ['cost', 'impressions', 'clicks', 'conversions'];
  const CONV_COLOR = '#7c3aed';
  const COST_COLOR = '#0284c7';
  const KEYWORDS_IN_REPORT = 10;
  // Los KPIs del reporte son los del modulo Gasto Publicitario, en el mismo orden.
  const KPIS = [
    { key: 'cost', label: 'Inversión', unit: 'money', better: null },
    { key: 'impressions', label: 'Impresiones', unit: 'count', better: 'up' },
    { key: 'clicks', label: 'Clics', unit: 'count', better: 'up' },
    { key: 'ctr', label: 'CTR', unit: 'percent', better: 'up' },
    { key: 'cpc', label: 'CPC prom.', unit: 'money', better: 'down' },
    { key: 'conversions', label: 'Conversiones', unit: 'conv', better: 'up' },
    { key: 'costPerConversion', label: 'Costo por conversión', unit: 'money', better: 'down' },
    { key: 'conversionRate', label: 'Tasa de conversión', unit: 'percent', better: 'up' }
  ];
  // Titulos de las conclusiones, los mismos de los reportes de la agencia: el equipo reescribe el
  // texto, no el orden.
  const NOTE_FIELDS = [
    { key: 'logro', label: 'Lo que funciono' },
    { key: 'alerta', label: 'Lo que hay que corregir' },
    { key: 'siguiente', label: 'Proximos pasos' }
  ];

  const state = { week: '', chart: null, wired: false };

  const F = () => window.TierraFilmsFormat;
  const data = () => window.TIERRA_FILMS_RETAIL_DATA;
  const isNum = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const ratio = (a, b) => (isNum(a) && isNum(b) && Number(b) !== 0 ? Number(a) / Number(b) : null);

  // ── Dias y semanas en hora de Lima ─────────────────────────────────────
  function shiftDays(iso, amount) {
    const date = new Date(`${iso}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  }

  // Lunes de la semana de ese dia (getUTCDay: 0 es domingo, de ahi el +6 % 7).
  const mondayOf = iso => shiftDays(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));
  const limaToday = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);

  // "14 – 20 set 2026"; de un mes al otro, "31 ago – 6 set 2026".
  function rangeLabel(week) {
    const sameMonth = week.start.slice(0, 7) === week.end.slice(0, 7);
    const from = sameMonth ? String(Number(week.start.slice(8, 10))) : F().shortDate(week.start);
    return `${from} – ${F().shortDate(week.end)} ${week.end.slice(0, 4)}`;
  }

  const fileLabel = week => `${F().shortDate(week.start).replace(' ', '')}-${F().shortDate(week.end).replace(' ', '')}${week.end.slice(0, 4)}`;

  // Los 7 dias de la semana, estén o no en el informe.
  const weekDates = week => Array.from({ length: 7 }, (unused, index) => shiftDays(week.start, index));

  // ── Semanas del informe ────────────────────────────────────────────────
  const hasActivity = week => ['cost', 'impressions', 'clicks'].some(field => Number(week[field]) > 0);

  // Semanas cerradas con actividad, de la mas reciente a la mas antigua. La semana en curso no se
  // lista: el reporte es de lunes a domingo completo.
  function closedWeeks() {
    const currentMonday = mondayOf(limaToday());
    return ((data() && data().weeks) || [])
      .filter(week => week.start < currentMonday && hasActivity(week))
      .map(week => F().withRates(week))
      .sort((left, right) => right.start.localeCompare(left.start))
      .slice(0, WEEKS_IN_LIST);
  }

  const weekByStart = start => closedWeeks().find(week => week.start === start) || null;

  function previousWeek(week) {
    const start = shiftDays(week.start, -7);
    const found = ((data() && data().weeks) || []).find(item => item.start === start);
    return found ? F().withRates(found) : null;
  }

  function totals(week) {
    const sum = F().withRates(Object.fromEntries(SUMS.map(field => [field, isNum(week[field]) ? Number(week[field]) : null])));
    sum.conversionRate = ratio(week.conversions, week.clicks);
    return sum;
  }

  // Dias del informe que faltan en la semana: el informe de Google Ads arranca en dataStart y llega
  // hasta dataEnd, asi que una semana en el borde del rango viene incompleta y sus totales pueden subir.
  function missingDays(week) {
    const from = week.dataStart || week.start;
    const to = week.dataEnd || week.end;
    return weekDates(week).filter(date => date < from || date > to);
  }

  // Serie diaria del modulo Gasto Publicitario: coste real donde el export por dia lo trae y el resto
  // repartido desde la semana. De ahi sale el grafico por dia.
  function dailyRows(week) {
    const shared = Array.isArray(window.TierraFilmsDays) ? window.TierraFilmsDays : [];
    return weekDates(week).map(date => {
      const row = shared.find(item => item.date === date) || null;
      return {
        date,
        label: F().shortDate(date),
        cost: row && isNum(row.cost) ? Number(row.cost) : null,
        conversions: row && isNum(row.conversions) ? Number(row.conversions) : null,
        hasData: Boolean(row),
        estimated: Boolean(row && row.estimated && (row.estimated.conversions || row.estimated.cost))
      };
    });
  }

  function campaigns(week) {
    const total = Number(week.cost) || 0;
    return (week.campaigns || [])
      .filter(hasActivity)
      .map(campaign => Object.assign(totals(campaign), {
        name: campaign.campaign,
        share: total > 0 ? Number(campaign.cost) / total : null
      }))
      .sort((left, right) => (right.conversions || 0) - (left.conversions || 0) || (right.cost || 0) - (left.cost || 0));
  }

  // Palabras clave de esa misma semana, cuando el informe de palabras clave la cubre. Es el informe
  // semanal de busqueda: viene por semanas de lunes a domingo, igual que el de campana.
  function keywords(week) {
    const report = ((data() && data().keywords && data().keywords.weeks) || []).find(item => item.start === week.start);
    if (!report) return null;
    const rows = (report.rows || [])
      .filter(hasActivity)
      .sort((left, right) => (right.conversions || 0) - (left.conversions || 0) || (right.cost || 0) - (left.cost || 0));
    return rows.length ? { rows: rows.slice(0, KEYWORDS_IN_REPORT), total: rows.length, week: F().withRates(report) } : null;
  }

  // ── Conclusiones ───────────────────────────────────────────────────────
  function readNotes() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(NOTES_KEY) || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch (error) {
      return {};
    }
  }

  function saveNote(start, key, value) {
    const notes = readNotes();
    notes[start] = Object.assign({}, notes[start] || {}, { [key]: value });
    try {
      window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    } catch (error) {
      // Sin localStorage el texto dura hasta recargar; el PDF se descarga igual.
    }
  }

  // Lo que se puede afirmar con el informe: el resto lo escribe el equipo encima.
  function suggestedNotes(report) {
    const { fmtMoney, fmtConv, fmtPercent } = F();
    const best = report.campaigns[0];
    const topKeyword = report.keywords && report.keywords.rows[0];
    const change = report.previous ? ratio(report.week.conversions - report.previous.conversions, report.previous.conversions) : null;
    const quiet = report.series.filter(day => day.hasData && !day.conversions).length;
    const lostRank = report.keywords && isNum(report.keywords.week.lostRank) ? report.keywords.week.lostRank : null;

    const logro = [
      best ? `«${best.name}» cerro la semana con ${fmtConv(best.conversions)} ${best.conversions === 1 ? 'conversion' : 'conversiones'} y ${fmtMoney(best.cost)} de inversion` : '',
      topKeyword && topKeyword.conversions > 0 ? `la palabra clave que mas convirtio fue «${topKeyword.keyword}» (${fmtConv(topKeyword.conversions)} a ${fmtMoney(topKeyword.costPerConversion)} cada una)` : '',
      isNum(report.week.costPerConversion) ? `el costo por conversion de la semana fue ${fmtMoney(report.week.costPerConversion)}` : ''
    ].filter(Boolean).join('; ');

    const alerta = [
      change !== null
        ? `Las conversiones ${change >= 0 ? 'subieron' : 'bajaron'} ${fmtPercent(Math.abs(change))} contra la semana anterior`
        : 'No hay semana anterior con datos para comparar',
      quiet ? `${quiet} ${quiet === 1 ? 'dia' : 'dias'} de la semana sin conversiones` : '',
      lostRank !== null && lostRank > 0.4 ? `se perdio ${fmtPercent(lostRank)} de las impresiones por ranking` : '',
      report.missingDays.length ? `faltan los dias ${report.missingDays.map(date => F().shortDate(date)).join(', ')} en el informe de Google Ads` : ''
    ].filter(Boolean).join('; ');

    return { logro: logro ? `${logro}.` : '', alerta: alerta ? `${alerta}.` : '', siguiente: '' };
  }

  // ── Armado del reporte de una semana ───────────────────────────────────
  function buildReport(week) {
    const previous = previousWeek(week);
    return {
      week: Object.assign(totals(week), { start: week.start, end: week.end }),
      raw: week,
      previous: previous ? totals(previous) : null,
      previousLabel: previous ? rangeLabel(previous) : '',
      series: dailyRows(week),
      campaigns: campaigns(week),
      keywords: keywords(week),
      missingDays: missingDays(week)
    };
  }

  // ── Pintado ────────────────────────────────────────────────────────────
  const value = (amount, unit) => F().formatValue(amount, unit);

  // "▲ 12.3% vs 7 – 13 set", con el color de si subir es bueno para ese indicador (igual que los
  // KPIs de Gasto Publicitario).
  function deltaHtml(current, before, better, compareLabel) {
    const { escapeHtml } = F();
    const change = ratio(Number(current) - Number(before), before);
    if (change === null) return `<small class="gasto-delta flat">${compareLabel ? `Sin dato en ${escapeHtml(compareLabel)}` : 'Sin semana anterior'}</small>`;
    const direction = Math.abs(change) < 0.0005 ? 'flat' : change > 0 ? 'up' : 'down';
    const tone = direction === 'flat' || !better ? 'flat' : direction === better ? 'good' : 'bad';
    const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '●';
    const pct = `${(Math.abs(change) * 100).toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    return `<small class="gasto-delta ${tone}">${arrow} ${pct} vs ${escapeHtml(compareLabel)}</small>`;
  }

  function kpisHtml(report) {
    return KPIS.map(kpi => {
      const line = report.previous
        ? deltaHtml(report.week[kpi.key], report.previous[kpi.key], kpi.better, report.previousLabel)
        : '<small class="gasto-delta flat">Sin semana anterior para comparar</small>';
      return `<div class="kpi-pill"><span>${kpi.label}</span><strong>${value(report.week[kpi.key], kpi.unit)}</strong>${line}</div>`;
    }).join('');
  }

  function campaignsHtml(report) {
    const { escapeHtml, fmtMoney, fmtCount, fmtConv, fmtPercent } = F();
    if (!report.campaigns.length) {
      return '<div class="empty-state"><strong>Sin campanas con entrega</strong><span>La semana no tiene inversion, impresiones ni clics en el informe de Google Ads.</span></div>';
    }
    const best = report.campaigns[0];
    const rows = report.campaigns.map(campaign => `
      <tr>
        <td class="campaign-name">${escapeHtml(campaign.name)}${report.campaigns.length > 1 && campaign === best && campaign.conversions > 0 ? ' <span class="week-best">Mejor campana</span>' : ''}</td>
        <td class="num">${fmtMoney(campaign.cost)}</td>
        <td class="num">${isNum(campaign.share) ? fmtPercent(campaign.share) : '-'}</td>
        <td class="num">${fmtCount(campaign.impressions)}</td>
        <td class="num">${fmtCount(campaign.clicks)}</td>
        <td class="num">${fmtPercent(campaign.ctr)}</td>
        <td class="num">${fmtMoney(campaign.cpc)}</td>
        <td class="num">${fmtConv(campaign.conversions)}</td>
        <td class="num">${fmtMoney(campaign.costPerConversion)}</td>
      </tr>`).join('');
    return `
      <div class="table-scroll">
        <table class="data-table week-table">
          <thead><tr><th>Campana</th><th class="num">Inversion</th><th class="num">% de la inversion</th><th class="num">Impresiones</th><th class="num">Clics</th><th class="num">CTR</th><th class="num">CPC</th><th class="num">Conversiones</th><th class="num">Costo x conversion</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function keywordsHtml(report) {
    const { escapeHtml, fmtMoney, fmtCount, fmtConv, fmtPercent } = F();
    const best = report.keywords.rows[0];
    const rows = report.keywords.rows.map(row => `
      <tr>
        <td class="campaign-name">${escapeHtml(row.keyword)}${row === best && row.conversions > 0 ? ' <span class="week-best">Mejor palabra</span>' : ''}</td>
        <td class="ad-name-col">${escapeHtml(row.matchType || '-')}</td>
        <td class="num">${fmtMoney(row.cost)}</td>
        <td class="num">${fmtCount(row.impressions)}</td>
        <td class="num">${fmtCount(row.clicks)}</td>
        <td class="num">${fmtPercent(row.ctr)}</td>
        <td class="num">${fmtConv(row.conversions)}</td>
        <td class="num">${fmtMoney(row.costPerConversion)}</td>
        <td class="num">${isNum(row.impressionShare) ? fmtPercent(row.impressionShare) : '-'}</td>
      </tr>`).join('');
    return `
      <div class="table-scroll">
        <table class="data-table week-table">
          <thead><tr><th>Palabra clave</th><th>Concordancia</th><th class="num">Inversion</th><th class="num">Impresiones</th><th class="num">Clics</th><th class="num">CTR</th><th class="num">Conversiones</th><th class="num">Costo x conversion</th><th class="num">Cuota impr.</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function notesHtml(report) {
    const { escapeHtml } = F();
    const saved = readNotes()[report.week.start] || {};
    const suggested = suggestedNotes(report);
    return NOTE_FIELDS.map((field, index) => {
      const text = saved[field.key] !== undefined ? saved[field.key] : suggested[field.key];
      return `
        <label class="week-note" for="week-note-${field.key}">
          <span class="week-note-head"><b>0${index + 1}</b> ${escapeHtml(field.label)}</span>
          <textarea id="week-note-${field.key}" data-week-note="${field.key}" rows="3" placeholder="Escribe la conclusion que va en el reporte">${escapeHtml(text)}</textarea>
        </label>`;
    }).join('');
  }

  function renderChart(report) {
    const canvas = document.getElementById('week-chart');
    if (!canvas || typeof window.Chart !== 'function') return;
    const { fmtMoney, fmtConv } = F();
    if (state.chart) state.chart.destroy();
    state.chart = new window.Chart(canvas, {
      data: {
        labels: report.series.map(day => day.label),
        datasets: [
          { type: 'bar', label: 'Conversiones', data: report.series.map(day => day.conversions), backgroundColor: CONV_COLOR, borderRadius: 4, yAxisID: 'y' },
          { type: 'line', label: 'Inversion', data: report.series.map(day => day.cost), borderColor: COST_COLOR, backgroundColor: COST_COLOR, borderWidth: 2, tension: .3, pointRadius: 3, yAxisID: 'y1' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: context => ` ${context.dataset.label}: ${context.dataset.yAxisID === 'y1' ? fmtMoney(context.raw) : fmtConv(context.raw)}` } }
        },
        scales: {
          x: { grid: { display: false }, border: { color: '#cbd5e1' }, ticks: { color: '#7890b5', font: { size: 10 } } },
          y: { beginAtZero: true, grid: { color: 'rgba(14,165,233,.16)' }, border: { display: false }, ticks: { color: '#7890b5', font: { size: 10 }, precision: 0 } },
          y1: { beginAtZero: true, position: 'right', grid: { display: false }, border: { display: false }, ticks: { color: '#7890b5', font: { size: 10 }, callback: amount => `S/ ${amount}` } }
        }
      }
    });
  }

  function render() {
    const host = document.getElementById('week-report');
    if (!host || !data() || !F()) return;
    const { escapeHtml, shortDate } = F();

    const available = closedWeeks();
    const select = document.getElementById('week-select');
    if (!available.length) {
      if (select) select.innerHTML = '<option value="">Sin semanas cerradas</option>';
      host.innerHTML = '<div class="panel"><div class="empty-state"><strong>Todavia no hay una semana cerrada con datos</strong><span>El reporte se arma con el informe semanal de Google Ads. En cuanto haya una semana de lunes a domingo con entrega, aparece aqui.</span></div></div>';
      return;
    }

    if (!available.some(week => week.start === state.week)) state.week = available[0].start;
    const current = weekByStart(state.week) || available[0];
    const report = buildReport(current);
    const isLast = current.start === available[0].start;
    // La semana que acaba de cerrar: si el informe no llega hasta ahi, se dice en vez de darla por hecha.
    const lastClosed = shiftDays(mondayOf(limaToday()), -7);
    const behind = isLast && current.start < lastClosed;

    if (select) {
      select.innerHTML = available
        .map((week, index) => `<option value="${week.start}"${week.start === state.week ? ' selected' : ''}>${escapeHtml(rangeLabel(week))}${index === 0 ? ' · ultima semana con datos' : ''}</option>`)
        .join('');
    }

    const source = document.getElementById('week-source');
    if (source) {
      source.textContent = report.keywords
        ? 'Informe semanal de campana y de palabras clave de Google Ads'
        : 'Informe semanal de campana de Google Ads';
    }

    const estimatedDays = report.series.some(day => day.estimated);
    let number = 0;
    const heading = title => `<h2 class="week-h2">${String(++number).padStart(2, '0')} · ${title}</h2>`;

    host.innerHTML = `
      <div class="week-doc" id="week-doc">
        <div class="panel week-cover">
          <div>
            <div class="week-cover-brand">Lima Retail · Data Driven Marketing</div>
            <div class="week-cover-title">Reporte de Publicidad · Tierra Films</div>
            <div class="week-cover-period">${escapeHtml(rangeLabel(current))} · Google Ads · lunes a domingo</div>
          </div>
          <div class="week-cover-meta">
            <span>${isLast && !behind ? 'Semana que acaba de pasar' : 'Semana cerrada'}</span>
            <b>${escapeHtml(rangeLabel(current))}</b>
            <span>${current.days} ${current.days === 1 ? 'dia' : 'dias'} con datos</span>
          </div>
        </div>

        ${report.missingDays.length ? `<div class="week-warning">El informe de Google Ads cubre del ${escapeHtml(shortDate(current.dataStart || current.start))} al ${escapeHtml(shortDate(current.dataEnd || current.end))}: ${escapeHtml(report.missingDays.map(date => shortDate(date)).join(', '))} ${report.missingDays.length === 1 ? 'no esta' : 'no estan'} en la semana, asi que los totales pueden subir.</div>` : ''}
        ${behind ? `<div class="week-warning">La ultima semana cerrada es la del ${escapeHtml(rangeLabel({ start: lastClosed, end: shiftDays(lastClosed, 6) }))} y el informe todavia no llega hasta ahi: este es el reporte de la ultima semana con datos. Sincroniza las carpetas de Drive o sube el informe nuevo.</div>` : ''}

        ${heading('Resumen del periodo')}
        <div class="kpi-strip week-kpis">${kpisHtml(report)}</div>

        <div class="panel week-chart-panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">Conversiones e inversion por dia</div>
              <div class="panel-sub">Barras: conversiones del dia. Linea: inversion del dia.${estimatedDays ? ' Google Ads entrega la semana completa: los dias sin informe diario se reparten con el coste de cada dia como peso, asi que el detalle diario es una aproximacion (el total de la semana si es exacto).' : ''}</div>
            </div>
          </div>
          <div class="chart-wrap h-260"><canvas id="week-chart" role="img" aria-label="Conversiones e inversion por dia de la semana"></canvas></div>
          <div class="chart-legend week-legend"><span><i class="legend-dot conversions"></i><b>Conversiones</b></span> <span><i class="legend-line"></i><b>Inversion</b></span></div>
        </div>

        ${heading('Campanas de la semana')}
        <div class="panel">
          <div class="panel-head"><div><div class="panel-title">Por campana</div><div class="panel-sub">Donde se concentro la inversion y de donde salieron las conversiones. CTR, CPC y costo por conversion se recalculan sobre las sumas de la semana.</div></div></div>
          ${campaignsHtml(report)}
        </div>

        ${report.keywords ? `
        ${heading('Palabras clave de la semana')}
        <div class="panel">
          <div class="panel-head"><div><div class="panel-title">Las ${report.keywords.rows.length} palabras con mas conversiones</div><div class="panel-sub">Del informe de palabras clave de busqueda de la misma semana${report.keywords.total > report.keywords.rows.length ? `; la semana tuvo ${report.keywords.total} palabras con entrega` : ''}. Cuota impr.: cuanto de las busquedas de esa palabra nos vio.</div></div></div>
          ${keywordsHtml(report)}
        </div>` : ''}

        ${heading('Conclusiones y proximos pasos')}
        <div class="panel week-notes-panel">
          <div class="panel-head"><div><div class="panel-title">Lo que va en el reporte</div><div class="panel-sub">Los dos primeros textos vienen propuestos con lo que dice la semana. Se editan aqui y quedan guardados en este navegador.</div></div></div>
          <div class="week-notes">${notesHtml(report)}</div>
        </div>

        <div class="week-foot">Fuente: informe semanal de Google Ads de Tierra Films · ${escapeHtml(rangeLabel(current))} · Lima Retail</div>
      </div>`;

    renderChart(report);

    host.querySelectorAll('[data-week-note]').forEach(field => {
      field.addEventListener('input', () => saveNote(report.week.start, field.dataset.weekNote, field.value));
    });
  }

  // El nombre del PDF lo pone el navegador con el titulo del documento: se cambia solo mientras imprime.
  function printReport() {
    const week = weekByStart(state.week);
    if (!week) return;
    const title = document.title;
    document.title = `Reporte_Tierra-Films_${fileLabel(week)}`;
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
          state.week = event.target.value;
          render();
        });
      }
      const print = document.getElementById('week-print');
      if (print) print.addEventListener('click', printReport);
    }
  };

  // Llega al cargar y cada vez que se sincroniza Drive: si la semana cambio, el reporte se repinta.
  window.addEventListener('tierra-films:data-ready', () => {
    if (document.getElementById('view-week')?.classList.contains('visible')) render();
  });
})();
