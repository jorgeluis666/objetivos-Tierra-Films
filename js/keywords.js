(function () {
  // Modulo Palabras Clave: lee el informe semanal de palabras clave de Google Ads
  // y explica de donde viene el movimiento de impresiones y clics.
  //
  // La idea central: impresiones = subastas en las que la palabra podia aparecer
  // x cuota de impresiones. Con la cuota que informa Google se despeja el
  // "mercado" (subastas disponibles) y se separa lo que cambio por demanda de lo
  // que cambio por nuestra propia competitividad (Ad Rank).
  const ALL = 'all';
  const PERIOD_KEY = 'tierra_films_keywords_period';
  const SERIES = {
    impressions: { label: 'Impresiones', unit: 'count', color: '#0284c7', axis: 'y' },
    clicks: { label: 'Clics', unit: 'count', color: '#7c3aed', axis: 'y' },
    impressionShare: { label: 'Cuota de impresiones', unit: 'percent', color: '#0f766e', axis: 'y1' },
    lostRank: { label: 'Perdido por ranking', unit: 'percent', color: '#dc2626', axis: 'y1', dashed: true },
    cpc: { label: 'CPC medio', unit: 'money', color: '#f59e0b', axis: 'y2', dashed: true }
  };
  const CHART_METRICS = ['impressions', 'clicks', 'impressionShare', 'lostRank', 'cpc'];
  const state = { ready: false, data: null, weeks: [], months: [], periodId: ALL, chart: null, sort: 'cost' };

  const F = () => window.TierraFilmsFormat;

  function pct(value, digits = 1) {
    return Number.isFinite(value) && value !== null
      ? `${(value * 100).toLocaleString('es-PE', { maximumFractionDigits: digits })}%`
      : '-';
  }

  function signed(value, digits = 1) {
    if (!Number.isFinite(value)) return '-';
    return `${value > 0 ? '+' : ''}${(value * 100).toLocaleString('es-PE', { maximumFractionDigits: digits })}%`;
  }

  function change(current, previous) {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || !previous) return null;
    return current / previous - 1;
  }

  function monthIdOf(week) {
    // Una semana cuenta para el mes en el que cae su lunes.
    return week.start.slice(0, 7);
  }

  function buildMonths(weeks) {
    const ids = [];
    weeks.forEach(week => {
      const id = monthIdOf(week);
      if (!ids.includes(id)) ids.push(id);
    });
    return ids.map(id => {
      const [year, month] = id.split('-').map(Number);
      return { id, label: `${F().MONTH_NAMES[month - 1]} ${year}` };
    });
  }

  function visibleWeeks() {
    if (state.periodId === ALL) return state.weeks;
    return state.weeks.filter(week => monthIdOf(week) === state.periodId);
  }

  // Agrega varias semanas: los totales se suman y las cuotas se ponderan por impresiones.
  function aggregate(weeks) {
    const out = { impressions: 0, clicks: 0, cost: 0, conversions: 0, weeks: weeks.length };
    weeks.forEach(week => {
      out.impressions += week.impressions;
      out.clicks += week.clicks;
      out.cost += week.cost;
      out.conversions += week.conversions;
    });
    const weigh = field => {
      const pairs = weeks.filter(week => Number.isFinite(week[field]) && week[field] !== null && week.impressions);
      const total = pairs.reduce((sum, week) => sum + week.impressions, 0);
      return total ? pairs.reduce((sum, week) => sum + week[field] * week.impressions, 0) / total : null;
    };
    out.impressionShare = weigh('impressionShare');
    out.lostRank = weigh('lostRank');
    out.lostTopAbs = weigh('lostTopAbs');
    out.qualityScore = weigh('qualityScore');
    out.ctr = out.impressions ? out.clicks / out.impressions : null;
    out.cpc = out.clicks ? out.cost / out.clicks : null;
    out.costPerConversion = out.conversions ? out.cost / out.conversions : null;
    // Subastas en las que podiamos aparecer: impresiones / cuota de impresiones.
    out.auctions = out.impressionShare ? out.impressions / out.impressionShare : null;
    out.keywordsWithImpressions = new Set(
      weeks.flatMap(week => week.rows.filter(row => row.impressions > 0).map(row => `${row.keyword}|${row.matchType}`))
    ).size;
    return out;
  }

  // Suma las filas de palabra clave de varias semanas.
  function aggregateRows(weeks) {
    const map = new Map();
    weeks.forEach(week => {
      week.rows.forEach(row => {
        const key = `${row.keyword}|${row.matchType}`;
        const item = map.get(key) || {
          keyword: row.keyword, matchType: row.matchType, status: row.status, reasons: row.reasons,
          impressions: 0, clicks: 0, cost: 0, conversions: 0,
          shareWeight: 0, shareSum: 0, lostSum: 0, lostWeight: 0, qsSum: 0, qsWeight: 0
        };
        item.impressions += row.impressions;
        item.clicks += row.clicks;
        item.cost += row.cost;
        item.conversions += row.conversions;
        if (Number.isFinite(row.impressionShare) && row.impressionShare !== null && row.impressions) {
          item.shareSum += row.impressionShare * row.impressions;
          item.shareWeight += row.impressions;
        }
        if (Number.isFinite(row.lostRank) && row.lostRank !== null && row.impressions) {
          item.lostSum += row.lostRank * row.impressions;
          item.lostWeight += row.impressions;
        }
        if (Number.isFinite(row.qualityScore) && row.qualityScore !== null && row.impressions) {
          item.qsSum += row.qualityScore * row.impressions;
          item.qsWeight += row.impressions;
        }
        map.set(key, item);
      });
    });
    return [...map.values()].map(item => Object.assign(item, {
      ctr: item.impressions ? item.clicks / item.impressions : null,
      cpc: item.clicks ? item.cost / item.clicks : null,
      costPerConversion: item.conversions ? item.cost / item.conversions : null,
      impressionShare: item.shareWeight ? item.shareSum / item.shareWeight : null,
      lostRank: item.lostWeight ? item.lostSum / item.lostWeight : null,
      qualityScore: item.qsWeight ? item.qsSum / item.qsWeight : null
    }));
  }

  function renderFilters() {
    const host = document.getElementById('keywords-filters');
    const buttons = state.months.map(month => `<button type="button" class="month-tab${month.id === state.periodId ? ' active' : ''}" data-kw-period="${month.id}">${F().escapeHtml(month.label.split(' ')[0])}</button>`).join('');
    const period = state.data.period;
    host.innerHTML = `
      <div class="retail-filter">
        <span>Mes</span>
        <div class="month-tabs filter-months">
          ${buttons}
          <button type="button" class="month-tab${state.periodId === ALL ? ' active' : ''}" data-kw-period="${ALL}">Todo el periodo</button>
        </div>
      </div>
      <div class="retail-filter filter-hint">
        <span>Informe</span>
        <p>${state.data.catalog.length} palabras clave en la cuenta | ${state.weeks.length} semanas (${F().shortDate(period.start)} - ${F().shortDate(period.end)}).<br>Fuente: ${F().escapeHtml(state.data.sourceFile)}</p>
      </div>`;
    host.querySelectorAll('[data-kw-period]').forEach(button => {
      button.addEventListener('click', () => {
        state.periodId = button.dataset.kwPeriod;
        try { window.localStorage.setItem(PERIOD_KEY, state.periodId); } catch (error) { /* sesion */ }
        render();
      });
    });
  }

  function renderKpis() {
    const f = F();
    const weeks = visibleWeeks();
    const current = aggregate(weeks);
    const cards = [
      ['Impresiones', f.fmtCount(current.impressions), `${current.keywordsWithImpressions} palabras con impresiones`],
      ['Clics', f.fmtCount(current.clicks), `CTR ${pct(current.ctr, 2)}`],
      ['Cuota de impresiones', pct(current.impressionShare), 'De las subastas en las que competimos'],
      ['Perdido por ranking', pct(current.lostRank), 'No salimos por Ad Rank bajo'],
      ['Nivel de calidad', current.qualityScore ? current.qualityScore.toLocaleString('es-PE', { maximumFractionDigits: 1 }) : '-', 'Promedio ponderado (sobre 10)'],
      ['CPC medio', f.fmtMoney(current.cpc), `${f.fmtMoney(current.cost)} de gasto`]
    ];
    document.getElementById('keywords-kpis').innerHTML = cards
      .map(([label, value, meta]) => `<div class="kpi-pill"><span>${label}</span><strong>${value}</strong><small>${meta}</small></div>`)
      .join('');
  }

  function renderChart() {
    const f = F();
    const rows = state.weeks;
    const selected = new Set(visibleWeeks().map(week => week.start));
    document.getElementById('keywords-chart-sub').textContent = 'Impresiones y clics contra la cuota de impresiones, lo perdido por ranking y el CPC medio de cada semana.';
    document.getElementById('keywords-legend').innerHTML = CHART_METRICS
      .map(metric => `<span style="color:${SERIES[metric].color}"><i class="legend-line${SERIES[metric].dashed ? ' dashed' : ''}" style="${SERIES[metric].dashed ? '' : `background:${SERIES[metric].color}`}"></i><b>${SERIES[metric].label}</b></span>`)
      .join('');
    const canvas = document.getElementById('chart-keywords');
    if (typeof Chart === 'undefined') {
      canvas.parentElement.innerHTML = '<div class="empty-state"><strong>Grafico no disponible sin conexion.</strong><span>La tabla sigue visible.</span></div>';
      return;
    }
    if (state.chart) state.chart.destroy();
    state.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: rows.map(week => `${f.shortDate(week.start)}`),
        datasets: CHART_METRICS.map(metric => ({
          metricKey: metric,
          label: SERIES[metric].label,
          data: rows.map(week => (Number.isFinite(week[metric]) && week[metric] !== null ? week[metric] : null)),
          yAxisID: SERIES[metric].axis,
          borderColor: SERIES[metric].color,
          backgroundColor: 'transparent',
          borderWidth: 2.2,
          borderDash: SERIES[metric].dashed ? [5, 4] : [],
          pointRadius: rows.map(week => (state.periodId !== ALL && selected.has(week.start) ? 5 : 3)),
          pointBackgroundColor: rows.map(week => (state.periodId === ALL || selected.has(week.start) ? SERIES[metric].color : '#fff')),
          pointBorderColor: SERIES[metric].color,
          tension: 0.32,
          spanGaps: true
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: items => `Semana del ${f.shortDate(rows[items[0].dataIndex].start)}`,
              label: context => ` ${SERIES[context.dataset.metricKey].label}: ${f.formatValue(context.raw, SERIES[context.dataset.metricKey].unit)}`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, border: { color: '#bfdbfe' }, ticks: { color: '#7890b5', font: { size: 10 } } },
          y: { beginAtZero: true, border: { display: false }, grid: { color: 'rgba(14,165,233,.16)' }, ticks: { color: '#7890b5', font: { size: 10 }, callback: value => f.fmtCount(value) } },
          y1: { beginAtZero: true, max: 1, position: 'right', border: { display: false }, grid: { drawOnChartArea: false }, ticks: { color: '#0f766e', font: { size: 10 }, callback: value => `${Math.round(value * 100)}%` } },
          y2: { display: false, beginAtZero: true, grid: { drawOnChartArea: false } }
        }
      }
    });
  }

  // Diagnostico: compara las dos ultimas semanas del periodo elegido y reparte
  // la variacion de impresiones entre demanda (subastas) y cuota propia.
  function renderDiagnosis() {
    const f = F();
    const weeks = visibleWeeks();
    const host = document.getElementById('keywords-diagnosis');
    const summary = document.getElementById('keywords-diagnosis-sub');
    if (weeks.length < 2) {
      host.innerHTML = '<li>Hacen falta al menos dos semanas en el periodo elegido para comparar.</li>';
      summary.textContent = '';
      return;
    }
    const last = weeks[weeks.length - 1];
    const prev = weeks[weeks.length - 2];
    const best = state.weeks.reduce((top, week) => (week.impressions > top.impressions ? week : top), state.weeks[0]);
    const impressionsChange = change(last.impressions, prev.impressions);
    const clicksChange = change(last.clicks, prev.clicks);
    const auctionsLast = last.impressionShare ? last.impressions / last.impressionShare : null;
    const auctionsPrev = prev.impressionShare ? prev.impressions / prev.impressionShare : null;
    const auctionsChange = change(auctionsLast, auctionsPrev);
    const shareChange = change(last.impressionShare, prev.impressionShare);
    const cpcChange = change(last.cpc, prev.cpc);
    const cpcVsBest = change(last.cpc, best.cpc);
    const rowsLast = aggregateRows([last]);
    const rowsPrev = aggregateRows([prev]);
    const prevByKey = new Map(rowsPrev.map(row => [`${row.keyword}|${row.matchType}`, row]));
    const drops = rowsLast
      .map(row => {
        const before = prevByKey.get(`${row.keyword}|${row.matchType}`);
        return { row, before, diff: row.impressions - (before ? before.impressions : 0) };
      })
      .concat(rowsPrev
        .filter(row => !rowsLast.some(item => item.keyword === row.keyword && item.matchType === row.matchType))
        .map(row => ({ row: Object.assign({}, row, { impressions: 0 }), before: row, diff: -row.impressions })))
      .sort((a, b) => a.diff - b.diff);
    const lowQuality = state.data.catalog.filter(item => /baja calidad/i.test(item.reasons || ''));
    const weakRows = aggregateRows(weeks).filter(row => Number.isFinite(row.qualityScore) && row.qualityScore <= 4 && row.cost > 0);
    const totalCost = aggregate(weeks).cost;
    const weakCost = weakRows.reduce((sum, row) => sum + row.cost, 0);

    // Evidencia del gasto diario real (modulo Gasto Publicitario).
    const days = (window.TIERRA_FILMS_RETAIL_DATA && window.TIERRA_FILMS_RETAIL_DATA.days) || [];
    const lastDays = days.filter(day => day.date >= last.start && day.date <= last.end);
    const prevDays = days.filter(day => day.date >= prev.start && day.date <= prev.end);
    const sumCost = rows => rows.reduce((total, row) => total + (Number(row.cost) || 0), 0);
    const quietDays = lastDays.filter(day => Number(day.cost) < 20);

    const items = [];
    items.push(`<li><b>Impresiones ${impressionsChange < 0 ? 'cayeron' : 'subieron'} ${signed(impressionsChange)}</b> entre la semana del ${f.shortDate(prev.start)} (${f.fmtCount(prev.impressions)} impresiones) y la del ${f.shortDate(last.start)} (${f.fmtCount(last.impressions)}). Los clics hicieron ${signed(clicksChange)} y el gasto ${signed(change(last.cost, prev.cost))}.</li>`);

    if (auctionsChange !== null && shareChange !== null) {
      const byAuctions = Math.abs(auctionsChange) > Math.abs(shareChange);
      const detail = byAuctions
        ? `Las subastas en las que el anuncio era elegible pasaron de ${f.fmtCount(auctionsPrev)} a ${f.fmtCount(auctionsLast)} (${signed(auctionsChange)}), mientras la cuota de impresiones se mantuvo alrededor de ${pct(last.impressionShare)} (${signed(shareChange)}). O sea, no es que perdieramos la pelea contra la competencia: el anuncio dejo de entrar a la subasta. Google estima esas impresiones elegibles con el estado de la campana, la puja y la calidad.`
        : `Las subastas disponibles casi no se movieron (${signed(auctionsChange)}) pero nuestra cuota de impresiones paso de ${pct(prev.impressionShare)} a ${pct(last.impressionShare)} (${signed(shareChange)}): perdimos terreno frente a la competencia.`;
      items.push(`<li><b>De donde viene la caida:</b> ${detail}</li>`);
    }

    if (lastDays.length && prevDays.length) {
      const detail = quietDays.length
        ? ` ${quietDays.length} de esos ${lastDays.length} dias gastaron menos de S/ 20 (${quietDays.map(day => `${f.shortDate(day.date)}: ${f.fmtMoney(day.cost)}`).join(', ')}).`
        : '';
      items.push(`<li><b>Lo confirma el gasto diario:</b> la semana paso de ${f.fmtMoney(sumCost(prevDays))} a ${f.fmtMoney(sumCost(lastDays))}, con el presupuesto diario sin tocar.${detail} Un gasto asi de bajo con presupuesto disponible apunta a la campana, no al mercado: puja o estrategia de puja, anuncios desaprobados, un problema de facturacion o la campana pausada.</li>`);
    }

    items.push(`<li><b>Problema de fondo:</b> en el periodo perdemos ${pct(aggregate(weeks).lostRank)} de las subastas por Ad Rank bajo (${pct(prev.lostRank)} y ${pct(last.lostRank)} en las dos ultimas semanas)${Number.isFinite(last.lostTopAbs) && last.lostTopAbs !== null ? `, y ${pct(last.lostTopAbs)} de la primera posicion absoluta` : ''}. Aun con la campana corriendo normal, solo captamos ${pct(aggregate(weeks).impressionShare)} de su mercado.</li>`);

    const cpcNote = Math.abs(cpcChange || 0) > 0.1
      ? `${f.fmtMoney(prev.cpc)} -> ${f.fmtMoney(last.cpc)} (${signed(cpcChange)}). Un CPC que baja mientras sube lo perdido por ranking es la firma de una puja que ya no compite.`
      : `${f.fmtMoney(prev.cpc)} -> ${f.fmtMoney(last.cpc)} (${signed(cpcChange)}), practicamente igual, asi que la caida no viene de pagar menos por clic.`;
    items.push(`<li><b>CPC medio:</b> ${cpcNote} En junio el CPC era ${f.fmtMoney(state.weeks[0].cpc)}, hoy es ${f.fmtMoney(last.cpc)}: la cuenta viene comprando trafico mas barato todo el periodo.</li>`);

    items.push(`<li><b>Cobertura:</b> ${prev.keywordsWithImpressions} palabras tuvieron impresiones la semana anterior y ${last.keywordsWithImpressions} la ultima, sobre ${state.data.catalog.filter(item => /habilitad/i.test(item.status)).length} habilitadas de ${state.data.catalog.length} en la cuenta. La mejor semana del periodo (${f.shortDate(best.start)}) llego a ${f.fmtCount(best.impressions)} impresiones.</li>`);

    if (drops.length) {
      const top = drops.slice(0, 3)
        .map(item => `${F().escapeHtml(item.row.keyword)} (${f.fmtCount(item.before ? item.before.impressions : 0)} -> ${f.fmtCount(item.row.impressions)})`)
        .join(', ');
      items.push(`<li><b>Donde se siente mas:</b> ${top}.</li>`);
    }

    if (lowQuality.length) {
      items.push(`<li><b>Calidad:</b> ${lowQuality.length} palabras estan en pausa marcadas como "baja calidad" y el nivel de calidad medio es ${aggregate(weeks).qualityScore ? aggregate(weeks).qualityScore.toLocaleString('es-PE', { maximumFractionDigits: 1 }) : '-'} sobre 10${weakRows.length ? `; las que tienen 4 o menos se llevan ${pct(totalCost ? weakCost / totalCost : null)} del gasto` : ''}. Con esa calidad, subir la puja cuesta mas caro de lo que deberia.</li>`);
    }

    host.innerHTML = items.join('');
    summary.textContent = `Ultima semana comparada: ${f.shortDate(last.start)} - ${f.shortDate(last.end)}. El calculo se rehace solo cuando importas datos nuevos.`;
  }

  function renderTable() {
    const f = F();
    const weeks = visibleWeeks();
    const rows = aggregateRows(weeks).sort((a, b) => (b[state.sort] || 0) - (a[state.sort] || 0));
    const previousWeeks = state.periodId === ALL ? [] : (() => {
      const index = state.months.findIndex(month => month.id === state.periodId);
      const before = state.months[index - 1];
      return before ? state.weeks.filter(week => monthIdOf(week) === before.id) : [];
    })();
    const previous = new Map(aggregateRows(previousWeeks).map(row => [`${row.keyword}|${row.matchType}`, row]));
    document.getElementById('keywords-table-sub').textContent = `${rows.length} palabras con actividad en ${state.periodId === ALL ? 'el periodo' : state.months.find(month => month.id === state.periodId).label}${previousWeeks.length ? `. % Δ compara con el mes anterior.` : '.'}`;
    document.getElementById('keywords-body').innerHTML = rows.map(row => {
      const before = previous.get(`${row.keyword}|${row.matchType}`);
      const impressionsDelta = before ? change(row.impressions, before.impressions) : null;
      const quality = Number.isFinite(row.qualityScore) && row.qualityScore !== null ? row.qualityScore.toLocaleString('es-PE', { maximumFractionDigits: 1 }) : '-';
      const qualityClass = Number.isFinite(row.qualityScore) && row.qualityScore !== null && row.qualityScore <= 4 ? ' class="kw-low"' : '';
      const paused = /pausa|retirad/i.test(row.status || '');
      return `
        <tr>
          <td class="campaign-name"><span>${F().escapeHtml(row.keyword)}</span><small>${F().escapeHtml(row.matchType)}${paused ? ` | ${F().escapeHtml(row.status)}` : ''}</small></td>
          <td class="num">${f.fmtCount(row.impressions)}</td>
          <td class="num delta-cell ${impressionsDelta === null ? '' : (impressionsDelta >= 0 ? 'up' : 'down')}">${impressionsDelta === null ? '-' : signed(impressionsDelta, 0)}</td>
          <td class="num">${f.fmtCount(row.clicks)}</td>
          <td class="num">${pct(row.ctr, 2)}</td>
          <td class="num">${f.fmtMoney(row.cost)}</td>
          <td class="num">${f.fmtMoney(row.cpc)}</td>
          <td class="num">${f.fmtCount(row.conversions)}</td>
          <td class="num">${f.fmtMoney(row.costPerConversion)}</td>
          <td class="num">${pct(row.impressionShare)}</td>
          <td class="num">${pct(row.lostRank)}</td>
          <td class="num"><b${qualityClass}>${quality}</b></td>
        </tr>`;
    }).join('') || '<tr><td colspan="12" class="table-empty">Sin palabras con actividad en este periodo.</td></tr>';
  }

  function render() {
    if (!state.data) return;
    renderFilters();
    renderKpis();
    renderChart();
    renderDiagnosis();
    renderTable();
  }

  window.TierraFilmsKeywords = {
    init() {
      if (!state.ready) {
        const data = window.TIERRA_FILMS_RETAIL_DATA;
        if (!data || !window.TierraFilmsFormat) return;
        if (!data.keywords || !Array.isArray(data.keywords.weeks) || !data.keywords.weeks.length) {
          document.getElementById('view-keywords').innerHTML = '<div class="data-notice"><strong>Sin informe de palabras clave.</strong>Descarga en Google Ads el informe de palabras clave de busqueda segmentado por semana y vuelve a importarlo.</div>';
          state.ready = true;
          return;
        }
        state.data = data.keywords;
        state.weeks = data.keywords.weeks;
        state.months = buildMonths(state.weeks);
        let stored = null;
        try { stored = window.localStorage.getItem(PERIOD_KEY); } catch (error) { stored = null; }
        state.periodId = stored === ALL || state.months.some(month => month.id === stored) ? stored : ALL;
        state.ready = true;
      }
      render();
    }
  };

  window.addEventListener('tierra-films:data-ready', () => {
    if (document.getElementById('view-keywords').classList.contains('visible')) window.TierraFilmsKeywords.init();
  });
})();
