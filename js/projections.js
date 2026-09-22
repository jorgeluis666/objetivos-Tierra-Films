(function () {
  // Proyecciones al cierre de mes sobre la data semanal de Google Ads.
  //
  // Google Ads entrega totales por semana, asi que cada semana se reparte en
  // partes iguales entre sus dias. Con esa serie diaria se calcula el acumulado
  // real del mes y se proyecta el resto con uno de tres ritmos. El nodo final de
  // la grafica se arrastra para simular otro cierre: el simulador convierte
  // conversiones en gasto (y al reves) con el costo por conversion marginal.
  const GOAL_KEY = 'tierra_films_projection_goal_v2';
  const CPA_KEY = 'tierra_films_projection_marginal_cpa';
  const SCENARIO_KEY = 'tierra_films_projection_scenario';
  const METRICS = ['cost', 'impressions', 'clicks', 'conversions'];
  const CHART_METRICS = {
    cost: { label: 'Gasto', unit: 'money', color: '#0284c7', drag: true },
    conversions: { label: 'Conversiones', unit: 'count', color: '#7c3aed', drag: true },
    costPerConversion: { label: 'Costo x conversion', unit: 'money', color: '#0f766e', drag: false }
  };
  const SCENARIOS = {
    month: { label: 'Ritmo del mes', color: '#0f766e', desc: 'Acumulado del mes / dias con datos' },
    recent: { label: 'Ultimas 4 semanas', color: '#db2777', desc: 'Promedio diario de los ultimos 28 dias' },
    budget: { label: 'Presupuesto diario', color: '#64748b', desc: 'Gasta el presupuesto completo cada dia, con la eficiencia de las ultimas 4 semanas' }
  };
  const SIM_COLOR = '#ea580c';
  const state = { ready: false, data: null, metric: 'cost', scenario: 'month', goal: null, marginalCpa: null, chart: null, model: null, dragging: false };

  const F = () => window.TierraFilmsFormat;

  function addDays(iso, days) {
    const date = new Date(`${iso}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function readStorage(key) {
    try { return window.localStorage.getItem(key); } catch (error) { return null; }
  }

  function writeStorage(key, value) {
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch (error) { /* sin almacenamiento: el valor vive solo en la sesion */ }
  }

  // Serie diaria: la que arma el modulo Gasto Publicitario (coste real donde el
  // export diario lo trae, el resto repartido desde la semana). Si todavia no
  // esta lista, se reparte cada semana entre sus dias.
  function dailySeries(data) {
    const shared = window.TierraFilmsDays;
    if (Array.isArray(shared) && shared.length) {
      return shared.map(row => {
        const out = { date: row.date, week: row.week };
        METRICS.forEach(metric => { out[metric] = Number.isFinite(Number(row[metric])) ? Number(row[metric]) : 0; });
        return out;
      });
    }
    const days = [];
    (data.weeks || []).forEach(week => {
      for (let i = 0; i < week.days; i += 1) {
        const row = { date: addDays(week.dataStart, i), week: week.start };
        METRICS.forEach(metric => { row[metric] = Number(week[metric] || 0) / week.days; });
        days.push(row);
      }
    });
    return days;
  }

  function totals(rows) {
    const out = {};
    METRICS.forEach(metric => { out[metric] = rows.reduce((total, row) => total + row[metric], 0); });
    return F().withRates(out);
  }

  function perDay(sum, days) {
    const out = {};
    METRICS.forEach(metric => { out[metric] = days > 0 ? sum[metric] / days : 0; });
    return out;
  }

  function buildModel(data) {
    const daily = dailySeries(data);
    const lastDate = data.period.end;
    let [year, month] = lastDate.split('-').map(Number);
    let daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    // Si la data llega hasta el ultimo dia del mes, la proyeccion pasa al siguiente.
    if (Number(lastDate.slice(8, 10)) === daysInMonth) {
      month = month % 12 + 1;
      year += month === 1 ? 1 : 0;
      daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    }
    const monthId = `${year}-${String(month).padStart(2, '0')}`;
    const monthRows = daily.filter(row => row.date.startsWith(monthId));
    const record = (data.months || []).find(item => item.id === monthId);
    // El informe mensual manda: puede cubrir mas dias que las semanas cargadas.
    const actual = record ? F().withRates({
      cost: record.cost, impressions: record.impressions, clicks: record.clicks, conversions: record.conversions
    }) : totals(monthRows);
    const daysWithData = record ? record.daysWithData : monthRows.length;
    const remaining = daysInMonth - daysWithData;

    const recentRows = daily.slice(-28);
    const recent = totals(recentRows);
    const recentRate = perDay(recent, recentRows.length);
    const budget = (data.campaigns || []).reduce((total, campaign) => total + Number(campaign.dailyBudget || 0), 0);
    const budgetScale = recentRate.cost > 0 ? budget / recentRate.cost : 0;
    const rates = {
      month: daysWithData ? perDay(actual, daysWithData) : recentRate,
      recent: recentRate,
      budget: METRICS.reduce((out, metric) => Object.assign(out, { [metric]: recentRate[metric] * budgetScale }), {})
    };
    const closes = {};
    Object.keys(rates).forEach(key => {
      const close = {};
      METRICS.forEach(metric => { close[metric] = actual[metric] + rates[key][metric] * remaining; });
      closes[key] = F().withRates(close);
    });

    const prevId = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
    const previous = (data.months || []).find(item => item.id === prevId);
    // Acumulado real dia a dia, base de todas las curvas del grafico.
    const cumulative = [];
    let cost = 0;
    let conversions = 0;
    monthRows.forEach(row => {
      cost += row.cost;
      conversions += row.conversions;
      cumulative.push({ cost, conversions });
    });
    // Los dias del mes que el detalle semanal no cubre se completan con el
    // resto del total mensual, repartido en partes iguales.
    const missing = daysWithData - cumulative.length;
    if (missing > 0) {
      const restCost = (actual.cost - cost) / missing;
      const restConversions = (actual.conversions - conversions) / missing;
      for (let i = 0; i < missing; i += 1) {
        cost += restCost;
        conversions += restConversions;
        cumulative.push({ cost, conversions });
      }
    }
    return {
      monthId,
      monthLabel: `${F().MONTH_NAMES[month - 1]} ${year}`,
      monthName: F().MONTH_NAMES[month - 1].toLowerCase(),
      daysInMonth,
      daysWithData,
      remaining,
      lastDate,
      cumulative,
      actual,
      rates,
      closes,
      budget,
      previous: previous ? F().withRates(previous) : null,
      lastWeek: data.weeks[data.weeks.length - 1],
      record
    };
  }

  // Costo de cada conversion adicional: por defecto el del escenario activo.
  function scenarioCpa() {
    const rate = state.model.rates[state.scenario];
    if (rate.conversions > 0) return rate.cost / rate.conversions;
    return state.model.actual.costPerConversion || 0;
  }

  function marginalCpa() {
    return state.marginalCpa && state.marginalCpa > 0 ? state.marginalCpa : scenarioCpa();
  }

  function baseClose() {
    return state.model.closes[state.scenario];
  }

  // Cierre simulado: las conversiones mandan y el gasto sale del CPA marginal.
  function simClose() {
    const m = state.model;
    const conversions = Math.max(m.actual.conversions, state.goal ?? baseClose().conversions);
    const cost = m.actual.cost + (conversions - m.actual.conversions) * marginalCpa();
    return F().withRates({
      cost,
      conversions,
      clicks: baseClose().clicks,
      impressions: baseClose().impressions
    });
  }

  function isSimulated() {
    return Math.abs(simClose().conversions - baseClose().conversions) > 0.05;
  }

  function metricValue(metric, cost, conversions) {
    if (metric === 'cost') return cost;
    if (metric === 'conversions') return conversions;
    return conversions > 0 ? cost / conversions : null;
  }

  function gapBadge(value, reference, inverse = false) {
    if (!Number.isFinite(value) || !Number.isFinite(reference) || reference === 0 || reference === null || value === null) return '<span class="projection-gap">-</span>';
    const diff = value / reference - 1;
    const good = inverse ? diff <= 0 : diff >= 0;
    const sign = diff > 0 ? '+' : '';
    return `<span class="projection-gap ${good ? 'ok' : 'over'}">${sign}${(diff * 100).toLocaleString('es-PE', { maximumFractionDigits: 1 })}%</span>`;
  }

  function renderKpis() {
    const m = state.model;
    const f = F();
    const close = baseClose();
    const monthlyBudget = m.budget * m.daysInMonth;
    const prevConv = m.previous ? m.previous.conversions : null;
    const cards = [
      [`Gasto al ${f.shortDate(m.lastDate)}`, f.fmtMoney(m.actual.cost), `${m.daysWithData} de ${m.daysInMonth} dias`],
      ['Gasto proyectado', f.fmtMoney(close.cost), monthlyBudget ? `${f.fmtPercent(close.cost / monthlyBudget)} del presupuesto (${f.fmtMoney(monthlyBudget)})` : 'Al cierre del mes'],
      ['Conversiones proyectadas', f.fmtCount(close.conversions), prevConv ? `${f.fmtCount(prevConv)} en ${m.previous.label.split(' ')[0].toLowerCase()}${m.previous.exact ? '' : ' (est.)'}` : `${f.fmtCount(m.actual.conversions)} reales`],
      ['Costo x conversion', f.fmtMoney(close.costPerConversion), `Real a la fecha ${f.fmtMoney(m.actual.costPerConversion)}`],
      ['Clics proyectados', f.fmtCount(close.clicks), `CPC ${f.fmtMoney(close.cpc)}`],
      ['Dias restantes', String(m.remaining), `Del ${f.shortDate(addDays(m.lastDate, 1))} al ${m.daysInMonth} ${m.monthName.slice(0, 3)}`]
    ];
    document.getElementById('projection-kpis').innerHTML = cards.map(([label, value, meta]) => `<div class="kpi-pill"><span>${label}</span><strong>${value}</strong><small>${meta}</small></div>`).join('');
  }

  function toggleHtml(entries, active) {
    return entries.map(([key, item]) => `
      <label class="series-toggle${key === active ? ' active' : ''}" style="${key === active ? `color:${item.color};border-color:${item.color};background:${item.color}14` : ''}"${item.desc ? ` title="${item.desc}"` : ''}>
        <input type="radio" value="${key}"${key === active ? ' checked' : ''}>${item.label}
      </label>`).join('');
  }

  function renderToggles() {
    const scenarios = document.getElementById('projection-scenarios');
    scenarios.innerHTML = toggleHtml(Object.entries(SCENARIOS), state.scenario);
    scenarios.querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
      state.scenario = input.value;
      writeStorage(SCENARIO_KEY, state.scenario);
      // El escenario manda sobre la simulacion: se vuelve a su cierre.
      state.goal = null;
      writeStorage(GOAL_KEY, null);
      render();
    }));
    const metrics = document.getElementById('projection-metrics');
    metrics.innerHTML = toggleHtml(Object.entries(CHART_METRICS), state.metric);
    metrics.querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
      state.metric = input.value;
      renderToggles();
      renderChart();
    }));
  }

  function chartSeries(metric) {
    const m = state.model;
    const labels = Array.from({ length: m.daysInMonth }, (_, i) => String(i + 1));
    const real = labels.map((_, i) => (i < m.cumulative.length ? metricValue(metric, m.cumulative[i].cost, m.cumulative[i].conversions) : null));
    const last = m.cumulative[m.cumulative.length - 1] || { cost: 0, conversions: 0 };
    const line = (costAt, convAt) => labels.map((_, i) => {
      const step = i + 1 - m.daysWithData;
      if (step < 0) return null;
      return metricValue(metric, costAt(step), convAt(step));
    });
    const scenarios = Object.fromEntries(Object.keys(SCENARIOS).map(key => [
      key,
      line(step => last.cost + m.rates[key].cost * step, step => last.conversions + m.rates[key].conversions * step)
    ]));
    const sim = simClose();
    const perDayCost = m.remaining ? (sim.cost - last.cost) / m.remaining : 0;
    const perDayConv = m.remaining ? (sim.conversions - last.conversions) / m.remaining : 0;
    return {
      labels,
      real,
      scenarios,
      sim: line(step => last.cost + perDayCost * step, step => last.conversions + perDayConv * step)
    };
  }

  function renderChart() {
    const m = state.model;
    const f = F();
    const metric = state.metric;
    const meta = CHART_METRICS[metric];
    const series = chartSeries(metric);
    const datasets = [{
      key: 'real',
      label: 'Real acumulado',
      data: series.real,
      borderColor: meta.color,
      backgroundColor: `${meta.color}1f`,
      borderWidth: 2.4,
      fill: metric !== 'costPerConversion',
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.2
    }];
    Object.entries(SCENARIOS).forEach(([key, scenario]) => {
      const active = key === state.scenario;
      datasets.push({
        key,
        label: `Proyeccion: ${scenario.label}`,
        data: series.scenarios[key],
        borderColor: active ? scenario.color : `${scenario.color}59`,
        borderWidth: active ? 2 : 1.2,
        borderDash: [6, 5],
        pointRadius: 0,
        fill: false,
        tension: 0
      });
    });
    datasets.push({
      key: 'sim',
      label: 'Simulacion (arrastra el nodo)',
      data: series.sim,
      borderColor: SIM_COLOR,
      backgroundColor: SIM_COLOR,
      borderWidth: 2.6,
      pointRadius: series.labels.map((_, i) => (i === series.labels.length - 1 ? 7 : 0)),
      pointHoverRadius: series.labels.map((_, i) => (i === series.labels.length - 1 ? 9 : 0)),
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      fill: false,
      tension: 0
    });
    if (metric === 'cost' && m.budget) {
      datasets.push({ key: 'budget-cap', label: 'Presupuesto acumulado', data: series.labels.map((_, i) => m.budget * (i + 1)), borderColor: '#94a3b8', borderWidth: 1, borderDash: [2, 3], pointRadius: 0, fill: false });
    }

    document.getElementById('projection-title').textContent = `Acumulado de ${meta.label.toLowerCase()} | ${m.monthLabel}`;
    document.getElementById('projection-sub').textContent = `Datos reales al ${f.shortDate(m.lastDate)} (${m.daysWithData} dias) y proyeccion hasta el ${m.daysInMonth} de ${m.monthName}.`;
    document.getElementById('projection-legend').innerHTML = datasets.map(dataset => {
      const dashed = dataset.borderDash ? ' dashed' : '';
      return `<span style="color:${dataset.borderColor}"><i class="legend-line${dashed}" style="${dashed ? '' : `background:${dataset.borderColor}`}"></i><b>${dataset.label}</b></span>`;
    }).join('');

    const canvas = document.getElementById('chart-projection');
    if (typeof Chart === 'undefined') {
      canvas.parentElement.innerHTML = '<div class="empty-state"><strong>Grafico no disponible sin conexion.</strong><span>La tabla de proyeccion sigue visible.</span></div>';
      return;
    }
    if (state.chart) state.chart.destroy();
    state.chart = new Chart(canvas, {
      type: 'line',
      data: { labels: series.labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: state.dragging ? false : undefined,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            filter: item => item.raw !== null,
            callbacks: {
              title: items => `${items[0].label} de ${m.monthName}`,
              label: context => ` ${context.dataset.label}: ${f.formatValue(context.raw, meta.unit)}`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, border: { color: '#bfdbfe' }, ticks: { color: '#7890b5', font: { size: 10 } } },
          y: { beginAtZero: metric !== 'costPerConversion', border: { display: false }, grid: { color: 'rgba(14,165,233,.16)' }, ticks: { color: '#7890b5', font: { size: 10 }, callback: value => f.formatValue(value, meta.unit, true) } }
        }
      }
    });
    bindDrag(canvas);

    const lw = m.lastWeek;
    const avgWeekCost = m.rates.recent.cost * 7;
    const warn = lw && lw.days === 7 && lw.cost < avgWeekCost * 0.6
      ? ` Ojo: la ultima semana (${f.weekLabel(lw)}) gasto ${f.fmtMoney(lw.cost)}, muy por debajo del promedio de ${f.fmtMoney(avgWeekCost)} por semana; si fue una pausa puntual, el escenario "${SCENARIOS.recent.label}" o "${SCENARIOS.budget.label}" es mas realista.`
      : '';
    const dragNote = meta.drag
      ? `Arrastra el nodo naranja del ultimo dia para simular otro cierre de ${meta.label.toLowerCase()}: el simulador recalcula el resto con el costo por conversion marginal.`
      : 'El costo por conversion sale de dividir el gasto acumulado entre las conversiones acumuladas, asi que se simula desde las vistas de Gasto o Conversiones.';
    document.getElementById('projection-note').textContent = `${dragNote} Google Ads entrega totales semanales: cada semana se reparte en partes iguales entre sus dias, por eso la linea real sube en tramos rectos.${warn}`;
  }

  // El nodo final de la simulacion se arrastra con el mouse o el dedo.
  function bindDrag(canvas) {
    if (canvas.dataset.dragBound === '1') return;
    canvas.dataset.dragBound = '1';

    const simPoint = () => {
      const chart = state.chart;
      if (!chart) return null;
      const index = chart.data.datasets.findIndex(dataset => dataset.key === 'sim');
      if (index < 0) return null;
      const points = chart.getDatasetMeta(index).data;
      return points.length ? points[points.length - 1] : null;
    };

    const near = event => {
      const point = simPoint();
      if (!point) return false;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      return Math.hypot(point.x - x, point.y - y) < 26;
    };

    const valueAt = event => {
      const rect = canvas.getBoundingClientRect();
      return state.chart.scales.y.getValueForPixel(event.clientY - rect.top);
    };

    const apply = event => {
      const m = state.model;
      const value = valueAt(event);
      if (!Number.isFinite(value)) return;
      let conversions;
      if (state.metric === 'conversions') {
        conversions = value;
      } else {
        conversions = m.actual.conversions + (value - m.actual.cost) / marginalCpa();
      }
      state.goal = Math.max(m.actual.conversions, Math.round(conversions * 10) / 10);
      const input = document.getElementById('projection-goal');
      if (input) input.value = Math.round(state.goal);
      renderChart();
      renderSim();
      renderTable();
      renderWeeks();
    };

    canvas.addEventListener('pointermove', event => {
      if (!state.dragging) {
        canvas.style.cursor = CHART_METRICS[state.metric].drag && near(event) ? 'grab' : 'default';
        return;
      }
      apply(event);
    });
    canvas.addEventListener('pointerdown', event => {
      if (!CHART_METRICS[state.metric].drag || !near(event)) return;
      state.dragging = true;
      canvas.style.cursor = 'grabbing';
      try { canvas.setPointerCapture(event.pointerId); } catch (error) { /* el navegador no soporta captura */ }
      event.preventDefault();
    });
    const stop = event => {
      if (!state.dragging) return;
      state.dragging = false;
      canvas.style.cursor = 'grab';
      try { canvas.releasePointerCapture(event.pointerId); } catch (error) { /* el puntero ya se solto */ }
      writeStorage(GOAL_KEY, state.goal === null ? null : String(state.goal));
    };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
  }

  function renderTable() {
    const m = state.model;
    const f = F();
    const rate = m.rates[state.scenario];
    const close = baseClose();
    const sim = simClose();
    const simulated = isSimulated();
    const prev = m.previous;
    const prevName = prev ? `${prev.label.split(' ')[0]}${prev.exact ? '' : ' (est.)'}` : 'Mes anterior';
    document.getElementById('projection-actual-head').textContent = `Real al ${f.shortDate(m.lastDate)}`;
    document.getElementById('projection-close-head').textContent = `Cierre ${m.monthName}`;
    document.getElementById('projection-sim-head').textContent = simulated ? 'Simulacion' : 'Simulacion (=)';
    document.getElementById('projection-ref-head').textContent = prevName;
    document.getElementById('projection-table-sub').textContent = `Escenario "${SCENARIOS[state.scenario].label}": ${SCENARIOS[state.scenario].desc.toLowerCase()}. Cierre = real + ritmo diario x ${m.remaining} dias restantes.`;
    const rows = [
      ['Gasto', 'money', 'cost', false],
      ['Conversiones', 'count', 'conversions', false],
      ['Costo x conversion', 'money', 'costPerConversion', true, true],
      ['Impresiones', 'count', 'impressions', false],
      ['Clics', 'count', 'clicks', false],
      ['CTR', 'percent', 'ctr', false, true],
      ['CPC medio', 'money', 'cpc', true, true]
    ];
    document.getElementById('projection-body').innerHTML = rows.map(([label, unit, key, inverse, isRate]) => `
      <tr class="${isRate ? 'projection-cost-row' : ''}">
        <td>${label}</td>
        <td class="num">${f.formatValue(m.actual[key], unit)}</td>
        <td class="num">${isRate ? '-' : f.formatValue(rate[key], unit === 'count' ? 'decimal' : unit)}</td>
        <td class="num projection-value">${f.formatValue(close[key], unit)}</td>
        <td class="num projection-sim-value">${f.formatValue(sim[key], unit)}</td>
        <td class="num">${prev ? f.formatValue(prev[key], unit) : '-'}</td>
        <td>${prev ? gapBadge(close[key], prev[key], inverse) : '-'}</td>
      </tr>`).join('');
  }

  // Semanas que faltan para cerrar el mes, con el ritmo del escenario activo.
  function renderWeeks() {
    const m = state.model;
    const f = F();
    const sim = simClose();
    const rate = {
      cost: m.remaining ? (sim.cost - m.actual.cost) / m.remaining : 0,
      conversions: m.remaining ? (sim.conversions - m.actual.conversions) / m.remaining : 0,
      impressions: m.rates[state.scenario].impressions,
      clicks: m.rates[state.scenario].clicks
    };
    const rows = [];
    let cursor = addDays(m.lastDate, 1);
    const monthEnd = `${m.monthId}-${String(m.daysInMonth).padStart(2, '0')}`;
    while (cursor <= monthEnd) {
      const weekday = (new Date(`${cursor}T00:00:00Z`).getUTCDay() + 6) % 7;
      let end = addDays(cursor, 6 - weekday);
      if (end > monthEnd) end = monthEnd;
      const days = Math.round((new Date(`${end}T00:00:00Z`) - new Date(`${cursor}T00:00:00Z`)) / 86400000) + 1;
      rows.push({ start: cursor, end, days });
      cursor = addDays(end, 1);
    }
    const body = document.getElementById('projection-weeks-body');
    document.getElementById('projection-weeks-sub').textContent = isSimulated()
      ? 'Lo que tendria que aportar cada semana restante para llegar al cierre simulado.'
      : 'Lo que aportaria cada semana restante del mes con el escenario elegido.';
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="6" class="table-empty">El mes ya esta cerrado con datos reales.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(row => {
      const cost = rate.cost * row.days;
      const conv = rate.conversions * row.days;
      return `
      <tr>
        <td class="campaign-name"><span>${f.shortDate(row.start)} - ${f.shortDate(row.end)}</span><small>${row.days} ${row.days === 1 ? 'dia' : 'dias'}</small></td>
        <td class="num">${f.fmtMoney(cost)}</td>
        <td class="num">${f.fmtMoney(cost / row.days)}</td>
        <td class="num">${f.fmtCount(rate.impressions * row.days)}</td>
        <td class="num">${f.fmtCount(rate.clicks * row.days)}</td>
        <td class="num">${conv.toLocaleString('es-PE', { maximumFractionDigits: 1 })}</td>
        <td class="num">${f.fmtMoney(conv > 0 ? cost / conv : null)}</td>
      </tr>`;
    }).join('');
  }

  // Simulador: relacion entre mas conversiones y cuanto gasto exigen.
  function renderSim() {
    const m = state.model;
    const f = F();
    const sim = simClose();
    const base = baseClose();
    const cpa = marginalCpa();
    const goalInput = document.getElementById('projection-goal');
    const cpaInput = document.getElementById('projection-cpa');
    if (document.activeElement !== goalInput) goalInput.value = Math.round(sim.conversions);
    if (document.activeElement !== cpaInput) cpaInput.value = cpa.toFixed(2);
    const extraConv = sim.conversions - m.actual.conversions;
    const extraCost = sim.cost - m.actual.cost;
    const dailyCost = m.remaining ? extraCost / m.remaining : 0;
    const cards = [
      ['Conversiones al cierre', f.fmtCount(sim.conversions), `${f.fmtCount(m.actual.conversions)} reales + ${f.fmtCount(extraConv)} por lograr`, ''],
      ['Gasto al cierre', f.fmtMoney(sim.cost), `${f.fmtMoney(extraCost)} en los ${m.remaining} dias que faltan`, ''],
      ['Presupuesto diario', f.fmtMoney(dailyCost), m.budget ? `Actual ${f.fmtMoney(m.budget)} por dia` : '', m.budget && dailyCost > m.budget ? 'over' : 'ok'],
      ['Costo x conversion del mes', f.fmtMoney(sim.costPerConversion), `Proyeccion base ${f.fmtMoney(base.costPerConversion)}`, sim.costPerConversion <= base.costPerConversion ? 'ok' : 'over']
    ];
    document.getElementById('projection-sim-grid').innerHTML = cards.map(([label, value, meta, cls]) => `<div class="sim-card"><span>${label}</span><strong class="${cls}">${value}</strong><small>${meta}</small></div>`).join('');
    const diffConv = sim.conversions - base.conversions;
    const diffCost = sim.cost - base.cost;
    document.getElementById('projection-sim-note').textContent = isSimulated()
      ? `Frente a la proyeccion base: ${diffConv > 0 ? '+' : ''}${f.fmtCount(diffConv)} conversiones y ${diffCost > 0 ? '+' : ''}${f.fmtMoney(diffCost)} de gasto, a ${f.fmtMoney(cpa)} cada conversion adicional. Cambia ese costo marginal si esperas que las conversiones extra salgan mas caras.`
      : `La simulacion arranca en la proyeccion base del escenario "${SCENARIOS[state.scenario].label}". Arrastra el nodo naranja del grafico o escribe la meta: cada conversion adicional se valoriza a ${f.fmtMoney(cpa)}.`;
  }

  function render() {
    if (!state.model) return;
    renderToggles();
    renderKpis();
    renderChart();
    renderTable();
    renderWeeks();
    renderSim();
  }

  function bindInputs() {
    const goal = document.getElementById('projection-goal');
    goal.addEventListener('input', () => {
      const value = Number(goal.value);
      state.goal = goal.value !== '' && Number.isFinite(value) && value >= 0 ? value : null;
      writeStorage(GOAL_KEY, state.goal === null ? null : String(state.goal));
      renderChart();
      renderSim();
      renderTable();
      renderWeeks();
    });
    const cpa = document.getElementById('projection-cpa');
    cpa.addEventListener('input', () => {
      const value = Number(cpa.value);
      state.marginalCpa = cpa.value !== '' && Number.isFinite(value) && value > 0 ? value : null;
      writeStorage(CPA_KEY, state.marginalCpa === null ? null : String(state.marginalCpa));
      renderChart();
      renderSim();
      renderTable();
      renderWeeks();
    });
    document.getElementById('projection-sim-prev').addEventListener('click', () => {
      if (!state.model.previous) return;
      state.goal = Math.round(state.model.previous.conversions);
      writeStorage(GOAL_KEY, String(state.goal));
      render();
    });
    document.getElementById('projection-sim-reset').addEventListener('click', () => {
      state.goal = null;
      state.marginalCpa = null;
      writeStorage(GOAL_KEY, null);
      writeStorage(CPA_KEY, null);
      render();
    });
  }

  function setup(data) {
    state.data = data;
    state.model = buildModel(data);
    const storedScenario = readStorage(SCENARIO_KEY);
    if (SCENARIOS[storedScenario]) state.scenario = storedScenario;
    const storedGoal = Number(readStorage(GOAL_KEY));
    state.goal = Number.isFinite(storedGoal) && storedGoal > 0 ? storedGoal : null;
    const storedCpa = Number(readStorage(CPA_KEY));
    state.marginalCpa = Number.isFinite(storedCpa) && storedCpa > 0 ? storedCpa : null;
    const prevButton = document.getElementById('projection-sim-prev');
    if (state.model.previous) prevButton.textContent = `Igualar ${state.model.previous.label.split(' ')[0].toLowerCase()} (${F().fmtCount(state.model.previous.conversions)})`;
    else prevButton.hidden = true;
    bindInputs();
    state.ready = true;
  }

  window.TierraFilmsProjections = {
    init() {
      const data = window.TIERRA_FILMS_RETAIL_DATA;
      if (!state.ready) {
        if (!data || !Array.isArray(data.weeks) || !window.TierraFilmsFormat) return;
        setup(data);
      }
      render();
    }
  };

  window.addEventListener('tierra-films:data-ready', () => {
    if (document.getElementById('view-projection').classList.contains('visible')) window.TierraFilmsProjections.init();
  });
})();
