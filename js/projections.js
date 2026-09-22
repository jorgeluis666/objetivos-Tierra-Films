(function () {
  // Proyecciones al cierre de mes sobre la data semanal de Google Ads.
  //
  // Google Ads entrega totales por semana, asi que cada semana se reparte en
  // partes iguales entre sus dias con datos. Con esa serie diaria se calcula el
  // acumulado real del mes y se proyecta el resto con uno de tres ritmos.
  const GOAL_KEY = 'tierra_films_projection_goal_v1';
  const SCENARIO_KEY = 'tierra_films_projection_scenario';
  const METRICS = ['cost', 'impressions', 'clicks', 'conversions'];
  const CHART_METRICS = {
    cost: { label: 'Inversion', unit: 'money', color: '#0284c7' },
    conversions: { label: 'Conversiones', unit: 'count', color: '#7c3aed' },
    clicks: { label: 'Clics', unit: 'count', color: '#f59e0b' }
  };
  const SCENARIOS = {
    month: { label: 'Ritmo del mes', color: '#0f766e', desc: 'Acumulado del mes / dias con datos' },
    recent: { label: 'Ultimas 4 semanas', color: '#db2777', desc: 'Promedio diario de los ultimos 28 dias' },
    budget: { label: 'Presupuesto diario', color: '#64748b', desc: 'Gasta el presupuesto completo cada dia, con la eficiencia de las ultimas 4 semanas' }
  };
  const state = { ready: false, data: null, metric: 'cost', scenario: 'month', goal: null, chart: null, model: null };

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

  // Serie diaria: cada semana repartida entre sus dias dentro del informe.
  function dailySeries(weeks) {
    const days = [];
    weeks.forEach(week => {
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
    const daily = dailySeries(data.weeks);
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
    const actual = totals(monthRows);
    const daysWithData = monthRows.length;
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
    return {
      monthId,
      monthLabel: `${F().MONTH_NAMES[month - 1]} ${year}`,
      monthName: F().MONTH_NAMES[month - 1].toLowerCase(),
      daysInMonth,
      daysWithData,
      remaining,
      lastDate,
      monthRows,
      actual,
      rates,
      closes,
      budget,
      recentFrom: recentRows.length ? recentRows[0].date : null,
      previous: previous ? F().withRates(previous) : null,
      lastWeek: data.weeks[data.weeks.length - 1]
    };
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
    const close = m.closes[state.scenario];
    const monthlyBudget = m.budget * m.daysInMonth;
    const prevConv = m.previous ? m.previous.conversions : null;
    const cards = [
      [`Inversion al ${f.shortDate(m.lastDate)}`, f.fmtMoney(m.actual.cost), `${m.daysWithData} de ${m.daysInMonth} dias`],
      ['Inversion proyectada', f.fmtMoney(close.cost), monthlyBudget ? `${f.fmtPercent(close.cost / monthlyBudget)} del presupuesto (${f.fmtMoney(monthlyBudget)})` : 'Al cierre del mes'],
      ['Conversiones proyectadas', f.fmtCount(close.conversions), prevConv ? `${f.fmtCount(prevConv)} en ${m.previous.label.split(' ')[0].toLowerCase()}` : `${f.fmtCount(m.actual.conversions)} reales`],
      ['Costo x conversion', f.fmtMoney(close.costPerConversion), `Real a la fecha ${f.fmtMoney(m.actual.costPerConversion)}`],
      ['Clics proyectados', f.fmtCount(close.clicks), `CPC ${f.fmtMoney(close.cpc)}`],
      ['Dias restantes', String(m.remaining), `Del ${f.shortDate(addDays(m.lastDate, 1))} al ${m.daysInMonth} ${m.monthName.slice(0, 3)}`]
    ];
    document.getElementById('projection-kpis').innerHTML = cards.map(([label, value, meta]) => `<div class="kpi-pill"><span>${label}</span><strong>${value}</strong><small>${meta}</small></div>`).join('');
  }

  function renderScenarioToggles() {
    const host = document.getElementById('projection-scenarios');
    host.innerHTML = Object.entries(SCENARIOS).map(([key, scenario]) => `
      <label class="series-toggle${key === state.scenario ? ' active' : ''}" style="${key === state.scenario ? `color:${scenario.color};border-color:${scenario.color};background:${scenario.color}14` : ''}" title="${scenario.desc}">
        <input type="radio" name="projection-scenario" value="${key}"${key === state.scenario ? ' checked' : ''}>${scenario.label}
      </label>`).join('');
    host.querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
      state.scenario = input.value;
      writeStorage(SCENARIO_KEY, state.scenario);
      render();
    }));
  }

  function renderMetricToggles() {
    const host = document.getElementById('projection-metrics');
    host.innerHTML = Object.entries(CHART_METRICS).map(([key, metric]) => `
      <label class="series-toggle${key === state.metric ? ' active' : ''}" style="${key === state.metric ? `color:${metric.color};border-color:${metric.color};background:${metric.color}14` : ''}">
        <input type="radio" name="projection-metric" value="${key}"${key === state.metric ? ' checked' : ''}>${metric.label}
      </label>`).join('');
    host.querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
      state.metric = input.value;
      renderMetricToggles();
      renderChart();
    }));
  }

  function renderChart() {
    const m = state.model;
    const f = F();
    const metric = state.metric;
    const meta = CHART_METRICS[metric];
    const labels = Array.from({ length: m.daysInMonth }, (_, i) => String(i + 1));
    const real = [];
    let running = 0;
    m.monthRows.forEach(row => { running += row[metric]; real.push(running); });
    const lastReal = m.daysWithData ? real[m.daysWithData - 1] : 0;
    const projected = key => labels.map((_, i) => {
      const day = i + 1;
      if (day < m.daysWithData) return null;
      return lastReal + m.rates[key][metric] * (day - m.daysWithData);
    });
    const datasets = [{
      key: 'real',
      label: 'Real acumulado',
      data: labels.map((_, i) => (i < real.length ? real[i] : null)),
      borderColor: meta.color,
      backgroundColor: `${meta.color}1f`,
      borderWidth: 2.4,
      fill: true,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.2
    }];
    Object.entries(SCENARIOS).forEach(([key, scenario]) => {
      const active = key === state.scenario;
      datasets.push({
        key,
        label: `Proyeccion: ${scenario.label}`,
        data: projected(key),
        borderColor: active ? scenario.color : `${scenario.color}66`,
        borderWidth: active ? 2.4 : 1.4,
        borderDash: [6, 5],
        pointRadius: labels.map((_, i) => (active && i === labels.length - 1 ? 4 : 0)),
        pointBackgroundColor: scenario.color,
        fill: false,
        tension: 0
      });
    });
    if (metric === 'cost' && m.budget) {
      datasets.push({ key: 'budget-cap', label: 'Presupuesto acumulado', data: labels.map((_, i) => m.budget * (i + 1)), borderColor: '#94a3b8', borderWidth: 1, borderDash: [2, 3], pointRadius: 0, fill: false });
    }
    if (metric === 'conversions' && state.goal) {
      datasets.push({ key: 'goal', label: 'Meta del mes', data: labels.map(() => state.goal), borderColor: '#16a34a', borderWidth: 1.4, borderDash: [2, 3], pointRadius: 0, fill: false });
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
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
          y: { beginAtZero: true, border: { display: false }, grid: { color: 'rgba(14,165,233,.16)' }, ticks: { color: '#7890b5', font: { size: 10 }, callback: value => f.formatValue(value, meta.unit, true) } }
        }
      }
    });

    const lw = m.lastWeek;
    const avgWeekCost = m.rates.recent.cost * 7;
    const warn = lw && lw.days === 7 && lw.cost < avgWeekCost * 0.6
      ? ` Ojo: la ultima semana (${f.weekLabel(lw)}) invirtio ${f.fmtMoney(lw.cost)}, muy por debajo del promedio de ${f.fmtMoney(avgWeekCost)} por semana; si fue una pausa puntual, el escenario "${SCENARIOS.recent.label}" o "${SCENARIOS.budget.label}" es mas realista.`
      : '';
    document.getElementById('projection-note').textContent = `Google Ads entrega totales semanales: cada semana se reparte en partes iguales entre sus dias, por eso la linea real sube en tramos rectos.${warn}`;
  }

  function renderTable() {
    const m = state.model;
    const f = F();
    const rate = m.rates[state.scenario];
    const close = m.closes[state.scenario];
    const prev = m.previous;
    const prevName = prev ? prev.label.split(' ')[0] : 'Mes anterior';
    document.getElementById('projection-actual-head').textContent = `Real al ${f.shortDate(m.lastDate)}`;
    document.getElementById('projection-close-head').textContent = `Cierre ${m.monthName}`;
    document.getElementById('projection-ref-head').textContent = prevName;
    document.getElementById('projection-table-sub').textContent = `Escenario "${SCENARIOS[state.scenario].label}": ${SCENARIOS[state.scenario].desc.toLowerCase()}. Cierre = real + ritmo diario x ${m.remaining} dias restantes.`;
    const rows = [
      ['Inversion', 'money', 'cost', false],
      ['Impresiones', 'count', 'impressions', false],
      ['Clics', 'count', 'clicks', false],
      ['Conversiones', 'count', 'conversions', false],
      ['CTR', 'percent', 'ctr', false, true],
      ['CPC medio', 'money', 'cpc', true, true],
      ['Costo x conversion', 'money', 'costPerConversion', true, true]
    ];
    document.getElementById('projection-body').innerHTML = rows.map(([label, unit, key, inverse, isRate]) => `
      <tr class="${isRate ? 'projection-cost-row' : ''}">
        <td>${label}</td>
        <td class="num">${f.formatValue(m.actual[key], unit)}</td>
        <td class="num">${isRate ? '-' : f.formatValue(rate[key], unit === 'count' && rate[key] < 10 ? 'decimal' : unit)}</td>
        <td class="num projection-value">${f.formatValue(close[key], unit)}</td>
        <td class="num">${prev ? f.formatValue(prev[key], unit) : '-'}</td>
        <td>${prev ? gapBadge(close[key], prev[key], inverse) : '-'}</td>
      </tr>`).join('');
  }

  // Semanas que faltan para cerrar el mes, con el ritmo del escenario activo.
  function renderWeeks() {
    const m = state.model;
    const f = F();
    const rate = m.rates[state.scenario];
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
        <td class="num">${f.fmtCount(rate.impressions * row.days)}</td>
        <td class="num">${f.fmtCount(rate.clicks * row.days)}</td>
        <td class="num">${conv.toLocaleString('es-PE', { maximumFractionDigits: 1 })}</td>
        <td class="num">${f.fmtMoney(conv > 0 ? cost / conv : null)}</td>
      </tr>`;
    }).join('');
  }

  // Meta de conversiones: cuanto hay que conseguir por dia y cuanto costaria.
  function renderGoal() {
    const m = state.model;
    const f = F();
    const input = document.getElementById('projection-goal');
    if (document.activeElement !== input) input.value = state.goal ?? '';
    const grid = document.getElementById('projection-goal-grid');
    const note = document.getElementById('projection-goal-note');
    if (!state.goal) {
      grid.innerHTML = '';
      note.textContent = `Ingresa la meta de conversiones de ${m.monthName} para ver el ritmo y la inversion que hacen falta en los ${m.remaining} dias restantes.`;
      return;
    }
    const rate = m.rates[state.scenario];
    const cpa = rate.conversions > 0 ? rate.cost / rate.conversions : m.actual.costPerConversion;
    const missing = Math.max(0, state.goal - m.actual.conversions);
    const neededDaily = m.remaining ? missing / m.remaining : 0;
    const neededCost = missing * cpa;
    const neededDailyCost = m.remaining ? neededCost / m.remaining : 0;
    const projected = m.closes[state.scenario].conversions;
    const reach = projected / state.goal;
    const cards = [
      ['Faltan', f.fmtCount(missing), `${f.fmtCount(m.actual.conversions)} de ${f.fmtCount(state.goal)} logradas`, ''],
      ['Conversiones x dia', neededDaily.toLocaleString('es-PE', { maximumFractionDigits: 1 }), `Hoy: ${rate.conversions.toLocaleString('es-PE', { maximumFractionDigits: 1 })} por dia`, neededDaily <= rate.conversions ? 'ok' : 'over'],
      ['Inversion necesaria', f.fmtMoney(neededCost), `A ${f.fmtMoney(cpa)} por conversion`, ''],
      ['Presupuesto diario', f.fmtMoney(neededDailyCost), m.budget ? `Actual ${f.fmtMoney(m.budget)} por dia` : '', m.budget && neededDailyCost > m.budget ? 'over' : 'ok']
    ];
    grid.innerHTML = cards.map(([label, value, meta, cls]) => `<div class="sim-card"><span>${label}</span><strong class="${cls}">${value}</strong><small>${meta}</small></div>`).join('');
    note.textContent = missing === 0
      ? 'La meta ya esta cumplida con los datos reales.'
      : `Con el escenario "${SCENARIOS[state.scenario].label}" el mes cerraria en ${f.fmtCount(projected)} conversiones (${f.fmtPercent(reach)} de la meta). El costo por conversion usado es el del mismo escenario.`;
  }

  function render() {
    if (!state.model) return;
    renderScenarioToggles();
    renderMetricToggles();
    renderKpis();
    renderChart();
    renderTable();
    renderWeeks();
    renderGoal();
  }

  function bindGoal() {
    const input = document.getElementById('projection-goal');
    input.addEventListener('input', () => {
      const value = Number(input.value);
      state.goal = input.value !== '' && Number.isFinite(value) && value > 0 ? value : null;
      writeStorage(GOAL_KEY, state.goal === null ? null : String(state.goal));
      renderGoal();
      if (state.metric === 'conversions') renderChart();
    });
    document.getElementById('projection-goal-prev').addEventListener('click', () => {
      if (!state.model.previous) return;
      state.goal = Math.round(state.model.previous.conversions);
      writeStorage(GOAL_KEY, String(state.goal));
      input.value = state.goal;
      renderGoal();
      if (state.metric === 'conversions') renderChart();
    });
  }

  function setup(data) {
    state.data = data;
    state.model = buildModel(data);
    const storedScenario = readStorage(SCENARIO_KEY);
    if (SCENARIOS[storedScenario]) state.scenario = storedScenario;
    const storedGoal = Number(readStorage(GOAL_KEY));
    state.goal = Number.isFinite(storedGoal) && storedGoal > 0 ? storedGoal : null;
    const prevButton = document.getElementById('projection-goal-prev');
    if (state.model.previous) prevButton.textContent = `Igualar ${state.model.previous.label.split(' ')[0].toLowerCase()} (${F().fmtCount(state.model.previous.conversions)})`;
    else prevButton.hidden = true;
    bindGoal();
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
