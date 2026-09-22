(function () {
  const DATA_URL = 'data/tierra-films-lima-retail-2026.json';
  const MONTH_STORAGE_KEY = 'tierra_films_selected_month';
  const ALL = 'all';
  const SERIES = {
    cost: { label: 'Inversion', unit: 'money', color: '#0284c7', fill: 'rgba(2,132,199,.18)', axis: 'y' },
    conversions: { label: 'Conversiones', unit: 'count', color: '#7c3aed', fill: 'rgba(124,58,237,.16)', axis: 'y1' },
    costPerConversion: { label: 'Costo x conversion', unit: 'money', color: '#0f766e', fill: 'rgba(15,118,110,.16)', axis: 'y2' },
    clicks: { label: 'Clics', unit: 'count', color: '#f59e0b', fill: 'rgba(245,158,11,.16)', axis: 'y3' }
  };
  const BAR_METRICS = ['cost', 'conversions', 'costPerConversion'];
  const TREND_METRICS = ['cost', 'conversions', 'costPerConversion', 'clicks'];
  const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  const state = { data: null, months: [], weeks: [], monthId: ALL, chart: null, trendChart: null };

  const fmtMoney = value => Number.isFinite(Number(value)) && value !== null ? `S/ ${Number(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
  const fmtCount = value => Number.isFinite(Number(value)) && value !== null ? Number(value).toLocaleString('es-PE', { maximumFractionDigits: 0 }) : '-';
  const fmtPercent = value => Number.isFinite(Number(value)) && value !== null ? `${(Number(value) * 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '-';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function formatValue(value, unit, short = false) {
    if (unit === 'money') {
      if (short && Number.isFinite(Number(value)) && Math.abs(Number(value)) >= 1000) return `S/ ${(Number(value) / 1000).toFixed(1)}k`;
      return fmtMoney(value);
    }
    if (unit === 'percent') return fmtPercent(value);
    if (unit === 'decimal') return Number.isFinite(Number(value)) && value !== null ? Number(value).toLocaleString('es-PE', { maximumFractionDigits: 1 }) : '-';
    return fmtCount(value);
  }

  function parseDate(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return { y, m, d };
  }

  function shortDate(iso) {
    const { m, d } = parseDate(iso);
    return `${d} ${MONTH_SHORT[m - 1]}`;
  }

  function weekLabel(week) {
    return `${shortDate(week.dataStart || week.start)} - ${shortDate(week.dataEnd || week.end)}`;
  }

  // Metricas derivadas a partir de los totales, igual que las calcula Google Ads.
  function withRates(item) {
    const out = Object.assign({}, item);
    out.ctr = out.impressions > 0 ? out.clicks / out.impressions : null;
    out.cpc = out.clicks > 0 ? out.cost / out.clicks : null;
    out.costPerConversion = out.conversions > 0 ? out.cost / out.conversions : null;
    return out;
  }

  function delta(current, previous) {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0 || current === null || previous === null) return null;
    return current / previous - 1;
  }

  function deltaCell(value, inverse = false) {
    if (value === null) return '<td class="num delta-cell">-</td>';
    const good = inverse ? value < 0 : value > 0;
    const cls = Math.abs(value) < 0.005 ? '' : (good ? 'up' : 'down');
    const sign = value > 0 ? '+' : '';
    return `<td class="num delta-cell ${cls}">${sign}${(value * 100).toLocaleString('es-PE', { maximumFractionDigits: 1 })}%</td>`;
  }

  function readStoredMonth() {
    try { return window.localStorage.getItem(MONTH_STORAGE_KEY); } catch (error) { return null; }
  }

  function storeMonth(monthId) {
    try { window.localStorage.setItem(MONTH_STORAGE_KEY, monthId); } catch (error) { /* solo vive en la sesion */ }
  }

  function currentMonth() {
    return state.months.find(month => month.id === state.monthId) || null;
  }

  // Semanas del filtro activo. En un mes se listan las que tienen al menos un dia
  // dentro de el; su aporte al total del mes se prorratea por dias.
  function visibleWeeks() {
    if (state.monthId === ALL) return state.weeks.map(week => ({ week, share: 1 }));
    return state.weeks
      .filter(week => week.daysByMonth && week.daysByMonth[state.monthId])
      .map(week => ({ week, share: week.daysByMonth[state.monthId] / week.days }));
  }

  function periodTotals() {
    if (state.monthId === ALL) return withRates(state.data.totals);
    return withRates(currentMonth());
  }

  function periodLabel() {
    if (state.monthId === ALL) {
      const { start, end } = state.data.period;
      return `${shortDate(start)} - ${shortDate(end)} ${parseDate(end).y}`;
    }
    return currentMonth() ? currentMonth().label : '';
  }

  function renderFilters() {
    const host = document.getElementById('retail-filters');
    if (!host) return;
    const allOption = `<option value="${ALL}"${state.monthId === ALL ? ' selected' : ''}>Todo el periodo (${escapeHtml(`${shortDate(state.data.period.start)} - ${shortDate(state.data.period.end)}`)})</option>`;
    const options = state.months
      .map(item => `<option value="${escapeHtml(item.id)}"${item.id === state.monthId ? ' selected' : ''}>${escapeHtml(item.label)}${item.daysWithData < item.daysInMonth ? ` (al ${parseDate(state.data.period.end).d})` : ''}</option>`)
      .reverse()
      .join('');
    const campaign = state.data.campaigns && state.data.campaigns[0];
    host.innerHTML = `
      <label class="retail-filter" for="filter-month">
        <span>Periodo</span>
        <select id="filter-month">${allOption}${options}</select>
        <small title="Fuente: ${escapeHtml(state.data.sourceFile)}">Fuente: ${escapeHtml(state.data.sourceFile)}</small>
      </label>
      <div class="retail-filter filter-hint">
        <span>Cuenta Google Ads</span>
        <p>${state.data.campaigns.length} ${state.data.campaigns.length === 1 ? 'campaña' : 'campañas'} de ${escapeHtml(campaign ? campaign.type : 'Búsqueda')}${campaign && campaign.dailyBudget ? ` | presupuesto ${fmtMoney(campaign.dailyBudget)}/dia` : ''} | ${state.weeks.length} semanas cargadas.</p>
      </div>
    `;
    document.getElementById('filter-month').addEventListener('change', event => {
      state.monthId = event.target.value;
      storeMonth(state.monthId);
      renderAll();
    });
  }

  function renderKpis() {
    const host = document.getElementById('kpi-strip');
    const t = periodTotals();
    const days = state.monthId === ALL ? state.weeks.reduce((total, week) => total + week.days, 0) : currentMonth().daysWithData;
    const cards = [
      ['Coste total', fmtMoney(t.cost), `Promedio ${fmtMoney(t.cost / days)} x dia`],
      ['Impresiones', fmtCount(t.impressions), `${days} dias con datos`],
      ['CTR', fmtPercent(t.ctr), 'Clics / impresiones'],
      ['Clics', fmtCount(t.clicks), `CPC medio ${fmtMoney(t.cpc)}`],
      ['Conversiones', fmtCount(t.conversions), 'Resultados registrados'],
      ['Costo x conversion', fmtMoney(t.costPerConversion), 'Coste / conversiones']
    ];
    host.innerHTML = cards.map(([label, value, meta]) => `<div class="kpi-pill"><span>${label}</span><strong>${value}</strong><small>${meta}</small></div>`).join('');
  }

  function barValuesPlugin(seriesMap) {
    return {
      id: 'insideBarValues',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        ctx.save();
        chart.data.datasets.forEach((dataset, datasetIndex) => {
          const series = seriesMap[dataset.metricKey];
          chart.getDatasetMeta(datasetIndex).data.forEach((bar, index) => {
            const value = dataset.data[index];
            if (!Number.isFinite(Number(value)) || Number(value) <= 0) return;
            const top = Math.min(bar.y, bar.base);
            const height = Math.max(bar.y, bar.base) - top;
            ctx.fillStyle = series.color;
            ctx.font = '700 9px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(formatValue(value, series.unit, true), bar.x, height > 28 ? top + 14 : top - 8);
          });
        });
        ctx.restore();
      }
    };
  }

  // Tope del eje de costo por conversion: ignora los picos de semanas con 1 conversion.
  function cpaCap(rows) {
    const values = rows.map(row => row.costPerConversion).filter(Number.isFinite).sort((a, b) => a - b);
    if (values.length < 4) return undefined;
    return values[Math.floor(values.length * 0.75)] * 1.6;
  }

  function renderChart() {
    const rows = visibleWeeks().map(({ week }) => week);
    document.getElementById('chart-title').textContent = `Resultados por semana | ${periodLabel()}`;
    document.getElementById('chart-sub').textContent = 'Inversion, conversiones y costo por conversion de cada semana (lunes a domingo).';
    const legend = document.querySelector('#chart-panel .chart-legend span');
    if (legend) legend.innerHTML = BAR_METRICS.map(metric => `<i class="legend-line" style="background:${SERIES[metric].color}"></i><b>${SERIES[metric].label}</b>`).join('');
    const canvas = document.getElementById('chart-monthly');
    if (typeof Chart === 'undefined') {
      canvas.parentElement.innerHTML = '<div class="empty-state"><strong>Grafico no disponible sin conexion.</strong><span>La tabla de resultados sigue visible.</span></div>';
      return;
    }
    if (state.chart) state.chart.destroy();
    state.chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map(weekLabel),
        datasets: BAR_METRICS.map(metric => ({
          metricKey: metric,
          label: SERIES[metric].label,
          data: rows.map(row => Number(row[metric] || 0)),
          yAxisID: SERIES[metric].axis,
          borderColor: SERIES[metric].color,
          backgroundColor: SERIES[metric].fill,
          borderWidth: 1.4,
          borderRadius: 4,
          barPercentage: 0.7,
          categoryPercentage: 0.7,
          maxBarThickness: 22
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: context => ` ${SERIES[context.dataset.metricKey].label}: ${formatValue(context.raw, SERIES[context.dataset.metricKey].unit)}` } }
        },
        scales: {
          x: { grid: { display: false }, border: { color: '#bfdbfe' }, ticks: { color: '#7890b5', font: { size: 10 }, maxRotation: 35, minRotation: 0 } },
          y: { beginAtZero: true, border: { display: false }, grid: { color: 'rgba(14,165,233,.16)' }, ticks: { color: '#7890b5', font: { size: 10 }, callback: value => formatValue(value, 'money', true) } },
          y1: { beginAtZero: true, position: 'right', border: { display: false }, grid: { drawOnChartArea: false }, ticks: { color: '#7c3aed', font: { size: 10 }, precision: 0 } },
          // Las semanas con 1 conversion (S/ 569, S/ 937) aplastarian al resto: se recorta la escala.
          y2: { beginAtZero: true, display: false, grid: { drawOnChartArea: false }, max: cpaCap(rows) }
        }
      },
      // Con muchas semanas las etiquetas se enciman: solo se dibujan en vistas cortas.
      plugins: rows.length <= 6 ? [barValuesPlugin(SERIES)] : []
    });
  }

  // Tendencia de todas las semanas; las del periodo filtrado quedan resaltadas.
  function renderTrend() {
    const panel = document.getElementById('daily-panel');
    const rows = state.weeks;
    panel.hidden = false;
    const selected = new Set(visibleWeeks().map(({ week }) => week.start));
    document.getElementById('daily-title').textContent = 'Evolucion semanal | todo el periodo';
    const t = withRates(state.data.totals);
    document.getElementById('daily-sub').textContent = `${rows.length} semanas | ${fmtMoney(t.cost)} de inversion | ${fmtCount(t.conversions)} conversiones | ${fmtMoney(t.costPerConversion)} por conversion.`;
    const legend = document.querySelector('.daily-legend span');
    if (legend) legend.innerHTML = TREND_METRICS.map(metric => `<i class="legend-line" style="background:${SERIES[metric].color}"></i><b>${SERIES[metric].label}</b>`).join('');
    const note = document.getElementById('daily-note');
    const first = rows[0];
    note.hidden = false;
    note.textContent = `La primera semana (${weekLabel(first)}) solo tiene ${first.days} dias dentro del informe.${state.monthId === ALL ? '' : ' Los puntos resaltados son las semanas del mes seleccionado.'} El eje del costo por conversion se recorta para que las semanas con 1 conversion (S/ 569 y S/ 937) no aplasten al resto; el valor exacto sale al pasar el cursor.`;
    const canvas = document.getElementById('chart-daily');
    if (typeof Chart === 'undefined') return;
    if (state.trendChart) state.trendChart.destroy();
    state.trendChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: rows.map(weekLabel),
        datasets: TREND_METRICS.map(metric => ({
          metricKey: metric,
          label: SERIES[metric].label,
          data: rows.map(row => Number.isFinite(row[metric]) ? row[metric] : null),
          yAxisID: SERIES[metric].axis,
          borderColor: SERIES[metric].color,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: metric === 'costPerConversion' ? [5, 4] : [],
          pointRadius: rows.map(row => (state.monthId !== ALL && selected.has(row.start) ? 5 : 3)),
          pointBackgroundColor: rows.map(row => (state.monthId === ALL || selected.has(row.start) ? SERIES[metric].color : '#fff')),
          pointBorderColor: SERIES[metric].color,
          pointHoverRadius: 6,
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
              title: items => `Semana ${weekLabel(rows[items[0].dataIndex])}`,
              label: context => ` ${SERIES[context.dataset.metricKey].label}: ${formatValue(context.raw, SERIES[context.dataset.metricKey].unit)}`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, border: { color: '#bfdbfe' }, ticks: { color: '#7890b5', font: { size: 10 } } },
          y: { beginAtZero: true, border: { display: false }, grid: { color: 'rgba(14,165,233,.16)' }, ticks: { color: '#7890b5', font: { size: 10 }, callback: value => formatValue(value, 'money', true) } },
          y1: { beginAtZero: true, position: 'right', border: { display: false }, grid: { drawOnChartArea: false }, ticks: { color: '#7c3aed', font: { size: 10 }, precision: 0 } },
          y2: { display: false, beginAtZero: true, grid: { drawOnChartArea: false }, max: cpaCap(rows) },
          y3: { display: false, beginAtZero: true, grid: { drawOnChartArea: false } }
        }
      }
    });
  }

  function renderTable() {
    const body = document.getElementById('campaigns-body');
    const items = visibleWeeks();
    const month = currentMonth();
    document.getElementById('campaigns-title').textContent = `Resultados semanales | ${periodLabel()}`;
    document.getElementById('campaigns-sub').textContent = `${items.length} semanas. % Δ compara cada semana con la anterior; en CPC y costo por conversion, bajar es mejor.`;
    const note = document.getElementById('campaigns-note');
    const partial = items.filter(({ share }) => share < 1);
    note.classList.toggle('visible', partial.length > 0);
    note.textContent = partial.length
      ? `Las semanas marcadas cruzan de mes: se muestran completas, pero el total de ${month.label} solo suma sus dias dentro del mes.`
      : '';
    const byStart = new Map(state.weeks.map((week, index) => [week.start, index]));
    const rowsHtml = items.map(({ week, share }) => {
      const prev = state.weeks[byStart.get(week.start) - 1];
      const tag = share < 1 ? `<small>${week.daysByMonth[state.monthId]} de ${week.days} dias en ${month.label.split(' ')[0].toLowerCase()}</small>` : (week.days < 7 ? `<small>${week.days} dias con datos</small>` : '');
      return `
      <tr>
        <td class="campaign-name"><span>${escapeHtml(weekLabel(week))}</span>${tag}</td>
        <td class="num">${fmtMoney(week.cost)}</td>${deltaCell(prev ? delta(week.cost, prev.cost) : null)}
        <td class="num">${fmtCount(week.impressions)}</td>
        <td class="num">${fmtPercent(week.ctr)}</td>
        <td class="num">${fmtCount(week.clicks)}</td>${deltaCell(prev ? delta(week.clicks, prev.clicks) : null)}
        <td class="num">${fmtMoney(week.cpc)}</td>${deltaCell(prev ? delta(week.cpc, prev.cpc) : null, true)}
        <td class="num">${fmtCount(week.conversions)}</td>${deltaCell(prev ? delta(week.conversions, prev.conversions) : null)}
        <td class="num">${fmtMoney(week.costPerConversion)}</td>${deltaCell(prev ? delta(week.costPerConversion, prev.costPerConversion) : null, true)}
      </tr>`;
    }).join('');
    const t = periodTotals();
    const totalLabel = state.monthId === ALL ? 'Total del periodo' : `Total ${month.label}${partial.length ? ' (prorrateado)' : ''}`;
    body.innerHTML = rowsHtml + `
      <tr class="reservations-total-row">
        <td class="total-label">${totalLabel}</td>
        <td class="num">${fmtMoney(t.cost)}</td><td></td>
        <td class="num">${fmtCount(t.impressions)}</td>
        <td class="num">${fmtPercent(t.ctr)}</td>
        <td class="num">${fmtCount(t.clicks)}</td><td></td>
        <td class="num">${fmtMoney(t.cpc)}</td><td></td>
        <td class="num">${fmtCount(t.conversions)}</td><td></td>
        <td class="num">${fmtMoney(t.costPerConversion)}</td><td></td>
      </tr>`;
  }

  function updateSourceLabels() {
    const status = document.getElementById('topbar-status');
    const source = document.getElementById('footer-source');
    const footerStatus = document.getElementById('footer-status');
    const caption = document.getElementById('topbar-caption');
    if (!document.getElementById('view-obj').classList.contains('visible')) return;
    if (status) status.textContent = `Datos al ${shortDate(state.data.period.end)} | ${state.weeks.length} semanas`;
    if (source) source.textContent = `Fuente: ${state.data.sourceFile}`;
    if (footerStatus) footerStatus.textContent = `Periodo ${periodLabel()}`;
    if (caption) caption.textContent = `Google Ads | ${periodLabel()}`;
  }

  function renderAll() {
    renderFilters();
    renderKpis();
    renderChart();
    renderTrend();
    renderTable();
    updateSourceLabels();
  }

  function renderError(message) {
    document.getElementById('view-obj').innerHTML = `<div class="data-notice error"><strong>No se pudo cargar la data de Google Ads.</strong>${escapeHtml(message)}</div>`;
  }

  async function init() {
    try {
      state.data = window.TIERRA_FILMS_RETAIL_DATA;
      if (!state.data) {
        const response = await fetch(DATA_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        state.data = await response.json();
      }
      if (!Array.isArray(state.data.weeks) || !state.data.weeks.length) throw new Error('La fuente no contiene semanas con datos.');
      window.TIERRA_FILMS_RETAIL_DATA = state.data;
      state.weeks = state.data.weeks.map(withRates);
      state.months = (state.data.months || []).map(withRates);
      const stored = readStoredMonth();
      state.monthId = stored === ALL || state.months.some(month => month.id === stored) ? stored : (state.data.defaultMonth || ALL);
      renderAll();
      window.dispatchEvent(new CustomEvent('tierra-films:data-ready', { detail: state.data }));
    } catch (error) {
      renderError(error.message);
      console.error(error);
    }
  }

  window.TierraFilmsFormat = { fmtMoney, fmtCount, fmtPercent, formatValue, shortDate, weekLabel, withRates, escapeHtml, MONTH_NAMES };
  window.TierraFilmsRefreshLabels = updateSourceLabels;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
