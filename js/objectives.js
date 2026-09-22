(function () {
  const DATA_URL = 'data/tierra-films-lima-retail-2026.json';
  const MONTH_STORAGE_KEY = 'tierra_films_selected_month';
  const ALL = 'all';
  const SERIES = {
    cost: { label: 'Gasto', unit: 'money', color: '#0284c7', axis: 'y' },
    conversions: { label: 'Conversiones', unit: 'count', color: '#7c3aed', axis: 'y1' },
    costPerConversion: { label: 'Costo x conversion', unit: 'money', color: '#0f766e', axis: 'y2', dashed: true },
    ctr: { label: 'CTR', unit: 'percent', color: '#f59e0b', axis: 'y3', dashed: true }
  };
  const TREND_METRICS = ['cost', 'conversions', 'costPerConversion', 'ctr'];
  const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  const state = { data: null, months: [], weeks: [], days: [], estimatedDays: false, monthId: ALL, chart: null, trendChart: null };

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

  function formatLongDate(iso) {
    const { d, m } = parseDate(iso);
    return `${d} de ${MONTH_NAMES[m - 1].toLowerCase()}`;
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

  // Serie diaria: la real del export por dia o, si no hay, la semana repartida
  // en partes iguales entre sus dias (queda marcada como estimada).
  function buildDays(data) {
    if (Array.isArray(data.days) && data.days.length) {
      state.estimatedDays = false;
      return data.days.map(withRates);
    }
    state.estimatedDays = true;
    const rows = [];
    (data.weeks || []).forEach(week => {
      for (let i = 0; i < week.days; i += 1) {
        const date = new Date(`${week.dataStart}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + i);
        rows.push(withRates({
          date: date.toISOString().slice(0, 10),
          week: week.start,
          cost: week.cost / week.days,
          impressions: week.impressions / week.days,
          clicks: week.clicks / week.days,
          conversions: week.conversions / week.days
        }));
      }
    });
    return rows;
  }

  function visibleDays() {
    if (state.monthId === ALL) return state.days;
    return state.days.filter(day => day.date.startsWith(state.monthId));
  }

  function periodTotals() {
    if (state.monthId === ALL) return withRates(state.data.totals);
    return withRates(currentMonth());
  }

  function periodDays() {
    if (state.monthId === ALL) return state.months.reduce((total, month) => total + month.daysWithData, 0);
    const month = currentMonth();
    return month ? month.daysWithData : 0;
  }

  // De donde sale el total del mes: informe mensual propio o prorrateo de semanas.
  function monthSourceNote() {
    const month = currentMonth();
    if (!month) {
      const exact = state.months.filter(item => item.exact).length;
      return `Totales por mes: ${exact} de ${state.months.length} vienen de su informe mensual; el resto se calcula repartiendo por dias las semanas que cruzan de mes.`;
    }
    const range = month.rangeStart && month.rangeEnd ? ` (${shortDate(month.rangeStart)} - ${shortDate(month.rangeEnd)})` : '';
    if (month.exact) {
      const weeksNote = month.weekDays && month.weekDays !== month.daysWithData
        ? ` El detalle semanal cubre ${month.weekDays} dias, asi que puede no sumar exactamente el total del mes.`
        : '';
      return `Total de ${month.label} tomado del informe mensual${range}: ${escapeHtml(month.sourceFile)}.${weeksNote}`;
    }
    return `Total de ${month.label} calculado repartiendo por dias las semanas que cruzan de mes. Para el dato exacto, importa el informe mensual de ${month.label.split(' ')[0].toLowerCase()}.`;
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
    const campaign = state.data.campaigns && state.data.campaigns[0];
    const options = state.months.map(month => {
      const partial = month.daysWithData < month.daysInMonth;
      const label = `${month.label.split(' ')[0]}${partial ? ` (al ${parseDate(state.data.period.end).d})` : ''}`;
      return `<button type="button" class="month-tab${month.id === state.monthId ? ' active' : ''}" data-month="${escapeHtml(month.id)}">${escapeHtml(label)}</button>`;
    }).join('');
    host.innerHTML = `
      <div class="retail-filter">
        <span>Mes</span>
        <div class="month-tabs filter-months">
          ${options}
          <button type="button" class="month-tab${state.monthId === ALL ? ' active' : ''}" data-month="${ALL}" title="${escapeHtml(`${shortDate(state.data.period.start)} - ${shortDate(state.data.period.end)}`)}">Todo el periodo</button>
        </div>
      </div>
      <div class="retail-filter filter-hint">
        <span>Cuenta Google Ads</span>
        <p>${state.data.campaigns.length} ${state.data.campaigns.length === 1 ? 'campaña' : 'campañas'} de ${escapeHtml(campaign ? campaign.type : 'Búsqueda')}${campaign && campaign.dailyBudget ? ` | presupuesto ${fmtMoney(campaign.dailyBudget)}/dia` : ''} | ${state.months.length} meses y ${state.weeks.length} semanas cargadas.<br>${monthSourceNote()}</p>
      </div>
    `;
    host.querySelectorAll('[data-month]').forEach(button => {
      button.addEventListener('click', () => {
        state.monthId = button.dataset.month;
        storeMonth(state.monthId);
        renderAll();
      });
    });
  }

  function renderKpis() {
    const host = document.getElementById('kpi-strip');
    const t = periodTotals();
    const days = periodDays();
    const cards = [
      ['Gasto total', fmtMoney(t.cost), `Promedio ${fmtMoney(t.cost / days)} x dia`],
      ['Impresiones', fmtCount(t.impressions), `${days} dias con datos`],
      ['CTR', fmtPercent(t.ctr), 'Clics / impresiones'],
      ['Clics', fmtCount(t.clicks), `CPC medio ${fmtMoney(t.cpc)}`],
      ['Conversiones', fmtCount(t.conversions), 'Resultados registrados'],
      ['Costo x conversion', fmtMoney(t.costPerConversion), 'Gasto / conversiones']
    ];
    host.innerHTML = cards.map(([label, value, meta]) => `<div class="kpi-pill"><span>${label}</span><strong>${value}</strong><small>${meta}</small></div>`).join('');
  }

  // Tope del eje de costo por conversion: ignora los picos de semanas con 1 conversion.
  function cpaCap(rows) {
    const values = rows.map(row => row.costPerConversion).filter(Number.isFinite).sort((a, b) => a - b);
    if (values.length < 4) return undefined;
    return values[Math.floor(values.length * 0.75)] * 1.6;
  }

  // Grafico de lineas reutilizable: una linea por indicador, cada una con su escala.
  function lineChart(canvas, rows, options) {
    if (typeof Chart === 'undefined') {
      canvas.parentElement.innerHTML = '<div class="empty-state"><strong>Grafico no disponible sin conexion.</strong><span>Las tablas siguen visibles.</span></div>';
      return null;
    }
    return new Chart(canvas, {
      type: 'line',
      data: {
        labels: options.labels || rows.map(weekLabel),
        datasets: TREND_METRICS.map(metric => {
          const series = SERIES[metric];
          return {
            metricKey: metric,
            label: series.label,
            data: rows.map(row => (Number.isFinite(row[metric]) ? row[metric] : null)),
            yAxisID: series.axis,
            borderColor: series.color,
            backgroundColor: 'transparent',
            borderWidth: options.dashed ? 1.8 : 2.2,
            borderDash: series.dashed || options.dashed ? [5, 4] : [],
            pointRadius: options.pointRadius === undefined ? 3 : options.pointRadius,
            pointBackgroundColor: options.pointBackground ? options.pointBackground(series) : series.color,
            pointBorderColor: series.color,
            pointHoverRadius: 6,
            tension: 0.32,
            spanGaps: true
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: items => (options.tooltipTitle ? options.tooltipTitle(items[0].dataIndex) : `Semana ${weekLabel(rows[items[0].dataIndex])}`),
              label: context => ` ${SERIES[context.dataset.metricKey].label}: ${formatValue(context.raw, SERIES[context.dataset.metricKey].unit)}${options.suffix || ''}`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, border: { color: '#bfdbfe' }, ticks: { color: '#7890b5', font: { size: 10 }, maxRotation: 35, minRotation: 0 } },
          y: { beginAtZero: true, border: { display: false }, grid: { color: 'rgba(14,165,233,.16)' }, ticks: { color: '#7890b5', font: { size: 10 }, callback: value => formatValue(value, 'money', true) } },
          y1: { beginAtZero: true, position: 'right', border: { display: false }, grid: { drawOnChartArea: false }, ticks: { color: '#7c3aed', font: { size: 10 }, precision: 0 } },
          // Ejes ocultos: el costo por conversion y el CTR conservan su forma sin aplastar al resto.
          y2: { display: false, beginAtZero: true, grid: { drawOnChartArea: false }, max: cpaCap(rows) },
          y3: { display: false, beginAtZero: true, grid: { drawOnChartArea: false } }
        }
      }
    });
  }

  function legendHtml(estimated = false) {
    return TREND_METRICS.map(metric => `<i class="legend-line${SERIES[metric].dashed || estimated ? ' dashed' : ''}" style="${SERIES[metric].dashed || estimated ? `color:${SERIES[metric].color}` : `background:${SERIES[metric].color}`}"></i><b>${SERIES[metric].label}${estimated ? ' (est.)' : ''}</b>`).join('');
  }

  // Dia a dia del mes elegido.
  function renderChart() {
    const rows = visibleDays();
    const perMonth = state.monthId !== ALL;
    const panel = document.getElementById('chart-panel');
    const notice = document.getElementById('records-empty');
    panel.hidden = !rows.length;
    notice.hidden = rows.length > 0;
    if (!rows.length) {
      const month = currentMonth();
      notice.innerHTML = `<strong>Sin detalle por semana ni por dia para ${escapeHtml(month ? month.label : 'este periodo')}.</strong>Los KPIs de arriba vienen del informe mensual. Para ver la curva, descarga el informe de ese mes con Segmento > Tiempo > Semana (o Dia) y vuelve a importarlo.`;
      if (state.chart) { state.chart.destroy(); state.chart = null; }
      return;
    }
    document.getElementById('chart-title').textContent = `Indicadores por dia | ${periodLabel()}`;
    document.getElementById('chart-sub').textContent = state.estimatedDays
      ? 'Gasto, conversiones, costo por conversion y CTR estimados por dia: Google Ads entrega totales semanales y cada semana se reparte en partes iguales entre sus dias.'
      : 'Gasto, conversiones, costo por conversion y CTR de cada dia.';
    const legend = document.querySelector('#chart-panel .chart-legend span');
    if (legend) legend.innerHTML = legendHtml(state.estimatedDays);
    if (state.chart) state.chart.destroy();
    state.chart = lineChart(document.getElementById('chart-monthly'), rows, {
      labels: rows.map(row => (perMonth ? String(parseDate(row.date).d) : shortDate(row.date))),
      tooltipTitle: index => formatLongDate(rows[index].date),
      pointRadius: rows.length > 40 ? 0 : 2.5,
      dashed: state.estimatedDays,
      suffix: state.estimatedDays ? ' (estimado)' : ''
    });
  }

  // Tendencia de todas las semanas; las del mes elegido quedan resaltadas.
  function renderTrend() {
    const panel = document.getElementById('daily-panel');
    const rows = state.weeks;
    panel.hidden = !rows.length;
    if (!rows.length) {
      if (state.trendChart) { state.trendChart.destroy(); state.trendChart = null; }
      return;
    }
    const selected = new Set(visibleWeeks().map(({ week }) => week.start));
    document.getElementById('daily-title').textContent = 'Evolucion semanal | todo el periodo';
    const t = withRates(state.data.totals);
    document.getElementById('daily-sub').textContent = `${rows.length} semanas | ${fmtMoney(t.cost)} de gasto | ${fmtCount(t.conversions)} conversiones | ${fmtMoney(t.costPerConversion)} por conversion | CTR ${fmtPercent(t.ctr)}.`;
    const legend = document.querySelector('.daily-legend span');
    if (legend) legend.innerHTML = legendHtml();
    const note = document.getElementById('daily-note');
    const first = rows[0];
    note.hidden = false;
    const missingDaily = state.estimatedDays
      ? ' El detalle por dia del panel de arriba es estimado: para la curva real, descarga el mismo informe con Segmento > Tiempo > Dia y vuelve a importar.'
      : '';
    note.textContent = `La primera semana (${weekLabel(first)}) solo tiene ${first.days} dias dentro del informe.${state.monthId === ALL ? '' : ' Los puntos resaltados son las semanas del mes elegido.'} El eje del costo por conversion se recorta para que las semanas con 1 conversion no aplasten al resto; el valor exacto sale al pasar el cursor.${missingDaily}`;
    if (state.trendChart) state.trendChart.destroy();
    state.trendChart = lineChart(document.getElementById('chart-daily'), rows, {
      pointRadius: rows.map(row => (state.monthId !== ALL && selected.has(row.start) ? 5 : 3)),
      pointBackground: series => rows.map(row => (state.monthId === ALL || selected.has(row.start) ? series.color : '#fff'))
    });
  }

  function renderTable() {
    const body = document.getElementById('campaigns-body');
    const items = visibleWeeks();
    const month = currentMonth();
    document.getElementById('campaigns-title').textContent = `Resultados semanales | ${periodLabel()}`;
    document.getElementById('campaigns-sub').textContent = items.length
      ? `${items.length} semanas. % Δ compara cada semana con la anterior; en CPC y costo por conversion, bajar es mejor.`
      : 'Sin semanas cargadas para este periodo.';
    const note = document.getElementById('campaigns-note');
    const partial = items.filter(({ share }) => share < 1);
    const partialNote = partial.length && month
      ? `Las semanas marcadas cruzan de mes: se muestran completas, pero el total de ${month.label} solo cuenta sus dias dentro del mes. `
      : '';
    note.classList.add('visible');
    note.textContent = `${partialNote}${monthSourceNote()}`;
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
    if (!items.length) {
      body.innerHTML = `<tr><td colspan="13" class="table-empty">Sin detalle semanal para ${escapeHtml(month ? month.label : 'este periodo')}. El total del mes sigue en los KPIs de arriba.</td></tr>`;
      return;
    }
    const totalLabel = state.monthId === ALL
      ? 'Total del periodo'
      : `Total ${month.label}${month.exact ? '' : ' (prorrateado)'}`;
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
      state.days = buildDays(state.data);
      state.months = (state.data.months || []).map(withRates);
      const stored = readStoredMonth();
      const fallback = state.data.defaultMonth || (state.months.length ? state.months[state.months.length - 1].id : ALL);
      state.monthId = stored === ALL || state.months.some(month => month.id === stored) ? stored : fallback;
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
