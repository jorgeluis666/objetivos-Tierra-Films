(function () {
  const DATA_URL = 'data/tierra-films-lima-retail-2026.json';
  const SNAPSHOT_URL = 'data/drive-snapshot.json';
  const MONTH_STORAGE_KEY = 'tierra_films_selected_month';
  // Pestana Anual; antes existia "Todo el periodo" ('all'), que se migra a Anual.
  const YEAR_KEY = 'anual';
  const LEGACY_ALL = 'all';
  // Indicadores, vista y minimizado del grafico de cada campana, por campana.
  const CAMP_CHARTS_KEY = 'tierra_films_gasto_campaign_charts';
  const KW_COMPACT_KEY = 'tierra_films_gasto_kw_compact';
  const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  const SHORT_NAMES = MONTH_NAMES.map(name => name.slice(0, 3));
  const SUMS = ['cost', 'impressions', 'clicks', 'conversions'];
  const CHART_COLOR = '#0284c7';
  const AXIS_COLOR = '#7890b5';
  const GRID_COLOR = 'rgba(14,165,233,.16)';
  const PREVIOUS_COLOR = '#94a3b8';
  const EST_DASH = [6, 5];
  const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>';
  // Vistas del grafico de cada campana. Las diarias salen de la serie por dia (window.TierraFilmsDays):
  // con una sola campana, la cuenta y la campana son lo mismo.
  const MODES = [
    { key: 'cumulative', label: 'Acumulado del mes', daily: true },
    { key: 'daily', label: 'Por día', daily: true },
    { key: 'weekly', label: 'Por semana', daily: true },
    { key: 'monthly', label: 'Por mes', daily: false }
  ];
  const CAMPAIGN_METRICS = [
    { key: 'cost', label: 'Inversión', unit: 'money' },
    { key: 'conversions', label: 'Conversiones', unit: 'conv' },
    { key: 'clicks', label: 'Clics', unit: 'count' },
    { key: 'impressions', label: 'Impresiones', unit: 'count' }
  ];
  const DEFAULT_METRICS = ['cost', 'conversions'];
  // better: hacia donde una variacion es buena (null = neutra). uses: sumas de las que depende el indicador.
  const CAMPAIGN_KPIS = [
    { key: 'cost', label: 'Inversión', unit: 'money', better: null, uses: ['cost'] },
    { key: 'clicks', label: 'Clics', unit: 'count', better: 'up', uses: ['clicks'] },
    { key: 'ctr', label: 'CTR', unit: 'percent', better: 'up', uses: ['clicks', 'impressions'] },
    { key: 'cpc', label: 'CPC', unit: 'money', better: 'down', uses: ['cost', 'clicks'] },
    { key: 'conversions', label: 'Conversiones', unit: 'conv', better: 'up', uses: ['conversions'] },
    { key: 'costPerConversion', label: 'Costo por conversión', unit: 'money', better: 'down', uses: ['cost', 'conversions'] },
    { key: 'dailyBudget', label: 'Presupuesto diario', unit: 'money', better: null, uses: [] }
  ];
  // perMonth: en Anual muestra su promedio mensual en lugar de la variacion.
  const KPIS = [
    { key: 'cost', label: 'Inversión', hint: 'Costo del periodo', better: null, unit: 'money', perMonth: true, uses: ['cost'] },
    { key: 'impressions', label: 'Impresiones', hint: 'Veces que se mostraron los anuncios', better: 'up', unit: 'count', perMonth: true, uses: ['impressions'] },
    { key: 'clicks', label: 'Clics', hint: 'Clics en los anuncios', better: 'up', unit: 'count', perMonth: true, uses: ['clicks'] },
    { key: 'ctr', label: 'CTR', hint: 'Clics / impresiones', better: 'up', unit: 'percent', uses: ['clicks', 'impressions'] },
    { key: 'cpc', label: 'CPC prom.', hint: 'Costo por clic', better: 'down', unit: 'money', uses: ['cost', 'clicks'] },
    { key: 'conversions', label: 'Conversiones', hint: 'Contactos registrados', better: 'up', unit: 'conv', perMonth: true, uses: ['conversions'] },
    { key: 'costPerConversion', label: 'Costo por conversión', hint: 'Inversión / conversiones', better: 'down', unit: 'money', uses: ['cost', 'conversions'] },
    { key: 'conversionRate', label: 'Tasa de conversión', hint: 'Conversiones / clics', better: 'up', unit: 'percent', uses: ['conversions', 'clicks'] }
  ];

  const state = { data: null, months: [], weeks: [], days: [], monthId: null, annual: false, base: null, snapshot: null };
  const gasto = {
    months: [],
    latestKey: null,
    campaignCharts: readJson(CAMP_CHARTS_KEY),
    charts: new Map(),
    // Palabras clave por mes, armadas una vez por version de la data.
    kwCache: new Map(),
    kwFilter: 'all',
    compact: readSetting(KW_COMPACT_KEY) === 'true',
    fullscreen: false,
    tabsHome: null
  };

  const isNum = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const fmtMoney = value => Number.isFinite(Number(value)) && value !== null ? `S/ ${Number(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
  const fmtCount = value => Number.isFinite(Number(value)) && value !== null ? Number(value).toLocaleString('es-PE', { maximumFractionDigits: 0 }) : '-';
  // Conversiones: Google Ads reparte algunas (2.99, 0.99); se muestran con decimales solo si los hay.
  const fmtConv = value => {
    const number = Number(value);
    if (!Number.isFinite(number) || value === null) return '-';
    return Math.abs(number - Math.round(number)) < 0.005 ? fmtCount(number) : number.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const fmtPercent = value => Number.isFinite(Number(value)) && value !== null ? `${(Number(value) * 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '-';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function formatValue(value, unit, short = false) {
    if (unit === 'money') {
      if (short && Number.isFinite(Number(value)) && Math.abs(Number(value)) >= 1000) return `S/ ${(Number(value) / 1000).toFixed(1)}k`;
      return fmtMoney(value);
    }
    if (unit === 'percent') return fmtPercent(value);
    if (unit === 'conv') return fmtConv(value);
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
    // Meses leidos de Drive: el costo por conversion que reporta Google Ads (con conversiones sin redondear).
    if (Number.isFinite(out.reportedCostPerConversion) && out.reportedCostPerConversion > 0) out.costPerConversion = out.reportedCostPerConversion;
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

  function readSetting(key) {
    try { return window.localStorage.getItem(key); } catch (error) { return null; }
  }
  function saveSetting(key, value) {
    try { window.localStorage.setItem(key, String(value)); } catch (error) { /* almacenamiento bloqueado */ }
  }
  function readJson(key) {
    try {
      const value = JSON.parse(readSetting(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (error) {
      return {};
    }
  }

  function readStoredMonth() {
    const value = readSetting(MONTH_STORAGE_KEY);
    return value === LEGACY_ALL ? YEAR_KEY : value;
  }

  function storeMonth(value) {
    saveSetting(MONTH_STORAGE_KEY, value);
  }

  // Serie diaria. Cada dia toma los indicadores reales que traiga el export
  // diario; los que falten se estiman repartiendo el total de la semana, con el
  // peso del gasto real de cada dia cuando se conoce.
  function buildDays(data) {
    const real = new Map((data.days || []).map(day => [day.date, day]));
    const rows = [];
    const used = new Set();
    (data.weeks || []).forEach(week => {
      const dates = [];
      for (let i = 0; i < week.days; i += 1) {
        const date = new Date(`${week.dataStart}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + i);
        dates.push(date.toISOString().slice(0, 10));
      }
      const costs = dates.map(date => Number(real.get(date) ? real.get(date).cost : NaN));
      const costTotal = costs.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
      const weighted = costs.every(Number.isFinite) && costTotal > 0;
      dates.forEach((date, index) => {
        const source = real.get(date);
        const share = weighted ? costs[index] / costTotal : 1 / week.days;
        const row = { date, week: week.start, estimated: {} };
        SUMS.forEach(metric => {
          const value = source ? Number(source[metric]) : NaN;
          if (Number.isFinite(value)) {
            row[metric] = value;
          } else {
            row[metric] = Number(week[metric] || 0) * share;
            row.estimated[metric] = true;
          }
        });
        used.add(date);
        rows.push(withRates(row));
      });
    });
    // Dias del export que ninguna semana cubre (por ejemplo, un mes sin informe semanal).
    (data.days || []).forEach(day => {
      if (used.has(day.date)) return;
      const row = Object.assign({ estimated: {} }, day);
      SUMS.forEach(metric => {
        if (!Number.isFinite(Number(day[metric]))) row[metric] = null;
      });
      rows.push(withRates(row));
    });
    rows.sort((a, b) => a.date.localeCompare(b.date));
    return rows;
  }

  // ════════════════════════════════════════════════════════════
  // Gasto Publicitario: pestanas de mes y Anual, periodo con KPIs, distribucion por campana
  // con un cuadro por campana. Los totales del mes salen del informe mensual (repo o Drive);
  // el detalle por dia y por semana, de la serie diaria y de las semanas del repo.
  // ════════════════════════════════════════════════════════════
  const normalizeText = text => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const campaignKey = normalizeText;
  const slug = text => String(text).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const monthKeyOf = (year, number) => `${year}-${String(number).padStart(2, '0')}`;
  const limaToday = () => new Date(Date.now() - 5 * 3600000);
  const dayRange = (month, from, to) => `${from}-${to} ${month.name}`;
  const pickSums = item => Object.fromEntries(SUMS.map(field => [field, isNum(item[field]) ? Number(item[field]) : null]));
  // Solo lo que tuvo actividad: inversion, impresiones o clics.
  const isActive = item => ['cost', 'impressions', 'clicks'].some(field => Number(item[field]) > 0);
  const ratio = (a, b) => (isNum(a) && isNum(b) && Number(b) !== 0 ? Number(a) / Number(b) : null);

  // CTR, CPC, costo y tasa de conversion se recalculan sobre las sumas; nunca se promedian. El costo por
  // conversion de un mes de Drive es el que reporta Google Ads (sus conversiones no vienen redondeadas).
  function derive(totals) {
    const reported = Number(totals.reportedCostPerConversion);
    return Object.assign({}, totals, {
      ctr: ratio(totals.clicks, totals.impressions),
      cpc: ratio(totals.cost, totals.clicks),
      costPerConversion: Number.isFinite(reported) && reported > 0 ? reported : ratio(totals.cost, totals.conversions),
      conversionRate: ratio(totals.conversions, totals.clicks)
    });
  }
  // Suma campo a campo; si un sumando no informa el campo (null), la suma tampoco.
  function sumOf(items) {
    return Object.fromEntries(SUMS.map(field => [field, items.reduce((total, item) => (total === null || !isNum(item[field]) ? null : total + Number(item[field])), 0)]));
  }
  const scale = (totals, factor) => Object.fromEntries(SUMS.map(field => [field, isNum(totals[field]) ? totals[field] * factor : null]));

  function campaignMeta(name) {
    const list = (state.data && state.data.campaigns) || [];
    return list.find(item => campaignKey(item.name) === campaignKey(name)) || {};
  }

  // Campanas del mes: las filas por campana del informe si suman el mes; si el informe solo trae el total de
  // la cuenta (los de Drive vienen por accion de conversion) y hay una sola campana, el total es de ella.
  // Estado y presupuesto: los vigentes del informe mas reciente.
  function monthCampaigns(month, totals) {
    const records = Array.isArray(month.records) ? month.records.filter(record => record && record.campaign) : [];
    const recordCost = records.reduce((sum, record) => sum + (Number(record.cost) || 0), 0);
    let rows = [];
    if (records.length && Math.abs(recordCost - (Number(month.cost) || 0)) < 0.05) {
      rows = records.map(record => Object.assign(pickSums(record), { name: record.campaign }));
    } else if (((state.data && state.data.campaigns) || []).length === 1) {
      rows = [Object.assign({}, totals, { name: state.data.campaigns[0].name, reportedCostPerConversion: month.reportedCostPerConversion })];
    }
    return rows.map(row => {
      const meta = campaignMeta(row.name);
      return Object.assign(row, {
        key: campaignKey(row.name),
        label: row.name,
        status: meta.status || '',
        dailyBudget: isNum(meta.dailyBudget) ? Number(meta.dailyBudget) : null
      });
    });
  }

  function gastoMonth(month) {
    const [year, number] = month.id.split('-').map(Number);
    const daysInMonth = new Date(year, number, 0).getDate();
    const dayOf = iso => (typeof iso === 'string' && iso.startsWith(month.id) ? Number(iso.slice(8, 10)) : null);
    const firstDay = dayOf(month.rangeStart) || 1;
    const lastDay = dayOf(month.rangeEnd) || daysInMonth;
    const totals = pickSums(month);
    // Indicadores que no son exactos en el mes (Agosto: solo la inversion sale de la serie diaria).
    const exact = month.exact ? SUMS : (Array.isArray(month.exactMetrics) ? month.exactMetrics : []);
    const estimated = SUMS.filter(field => !exact.includes(field));
    return {
      key: month.id,
      label: month.label,
      name: MONTH_NAMES[number - 1],
      shortName: SHORT_NAMES[number - 1],
      year,
      month: number,
      daysInMonth,
      realFirstDay: firstDay,
      firstDay,
      lastDay,
      totals,
      reportedCostPerConversion: month.reportedCostPerConversion,
      estimated,
      source: month.source || '',
      sourceFile: month.sourceFile || '',
      campaigns: monthCampaigns(month, totals),
      days: state.days.filter(day => day.date.startsWith(month.id)),
      hasData: SUMS.some(field => Number(totals[field]) > 0)
    };
  }

  function buildGastoMonths() {
    gasto.kwCache = new Map();
    gasto.months = state.months.filter(month => /^\d{4}-\d{2}$/.test(month.id)).map(gastoMonth);
    const withData = gasto.months.filter(month => month.hasData);
    gasto.latestKey = withData.length ? withData[withData.length - 1].key : null;
    gasto.months.forEach(month => {
      // Un mes empieza el dia 1 aunque la campana no haya gastado ese dia; solo el primer mes con datos
      // empieza en su primer dia real.
      if (withData.length && month.key !== withData[0].key && month.hasData) month.firstDay = 1;
      month.complete = month.firstDay === 1 && month.lastDay === month.daysInMonth;
      // Un mes anterior al ultimo con datos ya termino aunque su informe no llegue al ultimo dia.
      month.past = Boolean(gasto.latestKey && month.key < gasto.latestKey);
    });
  }

  const gastoMonthByKey = key => gasto.months.find(month => month.key === key) || null;
  function previousKey(month) {
    const date = new Date(month.year, month.month - 2, 1);
    return monthKeyOf(date.getFullYear(), date.getMonth() + 1);
  }
  function selectedGastoMonth() {
    const month = gastoMonthByKey(state.monthId);
    return month && month.hasData ? month : gastoMonthByKey(gasto.latestKey);
  }
  const viewYear = () => (selectedGastoMonth() || { year: limaToday().getUTCFullYear() }).year;

  // Mes cerrado: contra el mes anterior completo. Mes en curso: la inversion contra el mismo tramo del mes
  // anterior cuando hay costo diario real de esos dias; el resto, contra el mes anterior prorrateado a los
  // mismos dias. CTR, CPC, costo y tasa de conversion son los del mes anterior (no cambian al prorratear).
  function periodOf(month) {
    if (!month || !month.hasData) return null;
    const closed = month.complete || month.past;
    const days = month.lastDay - month.firstDay + 1;
    const previous = gastoMonthByKey(previousKey(month));
    let compare = null;
    if (previous && previous.hasData) {
      const previousDays = previous.lastDay - previous.firstDay + 1;
      const factor = closed ? 1 : Math.min(1, days / previousDays);
      const full = dayRange(previous, previous.firstDay, previous.lastDay);
      if (factor >= 1) {
        compare = { month: previous, factor: 1, label: full, short: full, costShort: full, costTramo: null };
      } else {
        const tramo = previous.days.filter(day => {
          const d = Number(day.date.slice(8, 10));
          return d >= month.firstDay && d <= month.lastDay;
        });
        const realCost = tramo.length === days && tramo.every(day => isNum(day.cost) && !(day.estimated && day.estimated.cost));
        const costTramo = realCost ? tramo.reduce((sum, day) => sum + Number(day.cost), 0) : null;
        const tramoLabel = dayRange(previous, month.firstDay, month.lastDay);
        compare = {
          month: previous,
          factor,
          costTramo,
          label: realCost
            ? `${tramoLabel} en inversión (costo diario real); el resto, ${previous.name} prorrateado a ${days} ${days === 1 ? 'día' : 'días'}`
            : `${previous.name} prorrateado a ${days} ${days === 1 ? 'día' : 'días'}`,
          short: `${previous.shortName} prorrateado`,
          costShort: realCost ? tramoLabel : `${previous.shortName} prorrateado`
        };
      }
    }
    return { month, months: [month], year: month.year, closed, compare, label: dayRange(month, month.firstDay, month.lastDay) };
  }

  // Anual: acumulado de los meses del ano con informe, sin comparacion (no hay informes del ano anterior).
  function yearPeriod(year) {
    const months = gasto.months.filter(month => month.hasData && month.year === year);
    if (!months.length) return null;
    const first = months[0];
    const last = months[months.length - 1];
    return {
      annual: true, month: null, months, year, compare: null,
      closed: last.month === 12 && last.complete,
      label: `${first.firstDay} ${first.name} - ${last.lastDay} ${last.name}`
    };
  }

  function currentPeriod() {
    if (state.annual) {
      const period = yearPeriod(viewYear());
      if (period) return period;
    }
    return periodOf(selectedGastoMonth());
  }

  // Sumas que en algun mes del periodo no son exactas (se marcan "est.").
  const periodEstimated = period => new Set(period.months.flatMap(month => month.estimated));
  const isEstimated = (estimated, uses) => uses.some(field => estimated.has(field));

  function periodTotals(period) {
    const sums = sumOf(period.months.map(month => month.totals));
    if (period.months.length === 1) sums.reportedCostPerConversion = period.months[0].reportedCostPerConversion;
    return derive(sums);
  }

  function previousTotals(period) {
    if (!period.compare) return null;
    const { month, factor, costTramo } = period.compare;
    const full = derive(Object.assign({}, month.totals, { reportedCostPerConversion: month.reportedCostPerConversion }));
    if (factor >= 1) return full;
    const scaled = scale(month.totals, factor);
    if (isNum(costTramo)) scaled.cost = costTramo;
    return Object.assign(scaled, {
      ctr: full.ctr, cpc: full.cpc, costPerConversion: full.costPerConversion, conversionRate: full.conversionRate
    });
  }

  // Campanas del periodo, de mayor a menor inversion (en Anual, sumadas por nombre).
  function periodCampaigns(period) {
    const byKey = new Map();
    period.months.forEach(month => month.campaigns.forEach(campaign => {
      if (!byKey.has(campaign.key)) byKey.set(campaign.key, { items: [], months: [] });
      const entry = byKey.get(campaign.key);
      entry.items.push(campaign);
      if (isActive(campaign)) entry.months.push(month);
    }));
    const total = periodTotals(period).cost || 0;
    return [...byKey.values()]
      .map(({ items, months }) => {
        const last = items[items.length - 1];
        const sums = sumOf(items);
        if (items.length === 1) sums.reportedCostPerConversion = items[0].reportedCostPerConversion;
        return Object.assign(derive(sums), {
          key: last.key, name: last.name, label: last.label, status: last.status, dailyBudget: last.dailyBudget,
          months, share: total > 0 && isNum(sums.cost) ? sums.cost / total : null
        });
      })
      .filter(isActive)
      .sort((a, b) => (b.cost || 0) - (a.cost || 0) || (b.conversions || 0) - (a.conversions || 0));
  }

  // La campana en el periodo de comparacion, con la misma regla que el total. El presupuesto no se prorratea.
  function previousCampaign(period, key) {
    if (!period.compare) return null;
    const { month, factor, costTramo } = period.compare;
    const campaign = month.campaigns.find(item => item.key === key);
    if (!campaign || !isActive(campaign)) return null;
    const full = derive(campaign);
    if (factor >= 1) return full;
    const single = month.campaigns.length === 1;
    const scaled = scale(campaign, factor);
    if (single && isNum(costTramo)) scaled.cost = costTramo;
    return Object.assign(scaled, {
      ctr: full.ctr, cpc: full.cpc, costPerConversion: full.costPerConversion, conversionRate: full.conversionRate, dailyBudget: campaign.dailyBudget
    });
  }

  // ── Celdas compartidas ──
  const change = (current, previous) => (isNum(current) && isNum(previous) && Number(previous) !== 0 ? (current - previous) / previous : null);
  const pctText = (value, decimals = 1) => `${(Math.abs(value) * 100).toLocaleString('es-PE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
  const estTag = on => (on ? ' <small class="gasto-est" title="Estimado: repartido desde las semanas">(est.)</small>' : '');

  // "▲ 12.3% vs 1-31 Julio". El color depende de si subir es bueno para ese indicador.
  function deltaHtml(current, previous, better, compareLabel) {
    const d = change(current, previous);
    if (d === null) return compareLabel ? `<small class="gasto-delta flat">Sin dato en ${escapeHtml(compareLabel)}</small>` : '';
    const direction = Math.abs(d) < 0.0005 ? 'flat' : d > 0 ? 'up' : 'down';
    const tone = direction === 'flat' || !better ? 'flat' : direction === better ? 'good' : 'bad';
    const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '●';
    return `<small class="gasto-delta ${tone}">${arrow} ${pctText(d)}${compareLabel ? ` vs ${escapeHtml(compareLabel)}` : ''}</small>`;
  }

  function statusPill(status) {
    const plain = normalizeText(status);
    const tone = /^habilitad/.test(plain) ? 'green' : !plain || /^(detenid|pausad|en pausa|quitad|eliminad)/.test(plain) ? 'muted' : 'amber';
    return `<span class="status-pill ${tone}">${escapeHtml(status || 'Sin estado')}</span>`;
  }

  const shareCell = share => (isNum(share)
    ? `<td class="gasto-share-col"><span class="gasto-share"><span style="width:${Math.min(100, share * 100).toFixed(1)}%"></span></span><b>${fmtPercent(share)}</b></td>`
    : '<td class="gasto-share-col"><span class="no-data">-</span></td>');

  // Un render que reemplaza el HTML de host no saca el foco del control que se estaba usando (pestana o chip).
  function keepFocus(host, render) {
    const active = document.activeElement;
    if (!host || !active || active === host || !host.contains(active)) { render(); return; }
    const sig = node => [node.tagName, node.getAttribute('name'), node.getAttribute('value'),
      ...[...node.attributes].filter(attr => attr.name.startsWith('data-')).map(attr => `${attr.name}=${attr.value}`)].join('|');
    const wanted = sig(active);
    render();
    if (document.activeElement === active) return;
    const match = [...host.querySelectorAll(active.tagName)].find(node => sig(node) === wanted);
    if (match) match.focus({ preventScroll: true });
  }

  // ── Pestanas de mes ──
  function renderTabs(period) {
    const host = document.getElementById('month-tabs');
    if (!host) return;
    const year = viewYear();
    const yearOk = Boolean(yearPeriod(year));
    const annual = Boolean(period && period.annual);
    const selected = period && period.month ? period.month.key : null;
    keepFocus(host, () => {
      host.innerHTML = MONTH_NAMES.map((name, index) => {
        const key = monthKeyOf(year, index + 1);
        const month = gastoMonthByKey(key);
        const ok = Boolean(month && month.hasData);
        const on = !annual && key === selected;
        return `<button type="button" class="month-tab${on ? ' active' : ''}" data-month="${key}" aria-pressed="${on}"${ok ? '' : ' disabled title="Sin informe de campaña"'}>${name}${key === gasto.latestKey ? '<span class="current-dot" title="Último mes con datos"></span>' : ''}</button>`;
      }).join('') + `<button type="button" class="month-tab${annual ? ' active' : ''}" data-month="${YEAR_KEY}" aria-pressed="${annual}" title="${yearOk ? `Acumulado ${year} de los meses con informe` : 'Sin informes de campaña'}"${yearOk ? '' : ' disabled'}>Anual</button>`;
    });
    // En pantallas angostas la tira scrollea: se deja a la vista la pestana elegida (sin mover la pagina).
    const active = host.querySelector('.month-tab.active');
    if (active && host.scrollWidth > host.clientWidth) host.scrollLeft = Math.max(0, active.offsetLeft - host.offsetLeft - 24);
  }

  // Huecos: meses sin informe de campana entre el primero y el ultimo con datos.
  function missingMonths() {
    const withData = gasto.months.filter(month => month.hasData);
    const missing = [];
    if (withData.length < 2) return missing;
    const first = withData[0];
    const last = withData[withData.length - 1];
    for (let date = new Date(first.year, first.month - 1, 1); ; date.setMonth(date.getMonth() + 1)) {
      const key = monthKeyOf(date.getFullYear(), date.getMonth() + 1);
      if (key >= last.key) break;
      const month = gastoMonthByKey(key);
      if (!month || !month.hasData) missing.push(key);
    }
    return missing;
  }

  function renderAlerts() {
    const host = document.getElementById('gasto-alerts');
    if (!host) return;
    const notes = missingMonths().map(key => {
      const [year, number] = key.split('-').map(Number);
      return `<b>Pendiente:</b> ${escapeHtml(`${MONTH_NAMES[number - 1]} ${year}`)} no tiene informe de campaña. Súbelo a la carpeta Google Ads TF Campañas y pulsa Sincronizar, arriba a la derecha.`;
    });
    host.innerHTML = notes.map(note => `<p>${note}</p>`).join('');
    host.hidden = !notes.length;
  }

  // De donde salen los totales del periodo.
  function sourceNote(period) {
    if (period.annual) {
      const partial = period.months.filter(month => month.estimated.length);
      return partial.length
        ? ` ${partial.map(month => month.name).join(', ')} tiene${partial.length === 1 ? '' : 'n'} indicadores estimados desde las semanas (est.).`
        : '';
    }
    const month = period.month;
    const from = month.source === 'Drive' ? `Google Drive (${month.sourceFile})` : month.source === 'serie diaria' ? 'la serie diaria de costo' : 'el informe mensual de Google Ads';
    if (month.estimated.length) {
      return ` Inversión de ${from}; ${month.estimated.filter(field => field !== 'cost').map(field => ({ impressions: 'impresiones', clicks: 'clics', conversions: 'conversiones' }[field])).join(', ')} estimadas desde las semanas (est.).`;
    }
    return ` Fuente: ${from}.`;
  }

  // ── Periodo y KPIs ──
  function renderPeriod(period) {
    const title = document.getElementById('gasto-period-title');
    const sub = document.getElementById('gasto-period-sub');
    const estimated = periodEstimated(period);
    if (period.annual) {
      const count = period.months.length;
      const closed = period.closed || period.year < limaToday().getUTCFullYear();
      title.textContent = `Periodo: ${period.label} ${period.year}${closed ? '' : ' (año en curso)'}`;
      sub.textContent = `Acumulado de ${count} ${count === 1 ? 'mes' : 'meses'} con informe de campaña (${period.months.map(month => month.shortName).join(', ')}). Sin año anterior para comparar.${sourceNote(period)}`;
    } else {
      title.textContent = `Periodo: ${period.label} ${period.year}${period.closed ? '' : ' (mes en curso)'}`;
      const compare = !period.compare ? 'Sin mes anterior para comparar.' : `Comparación vs ${period.compare.label}.`;
      sub.textContent = `${compare}${sourceNote(period)}`;
    }
    const current = periodTotals(period);
    const previous = previousTotals(period);
    const previousEstimated = period.compare ? new Set(period.compare.month.estimated) : new Set();
    let average = null;
    if (period.annual) {
      // Mientras haya meses cerrados el mes en curso queda fuera: un mes a medias bajaria el promedio.
      const closed = period.months.filter(month => month.complete || month.past);
      const months = closed.length ? closed : period.months;
      average = Object.fromEntries(KPIS.filter(kpi => kpi.perMonth).map(kpi => [kpi.key, months.reduce((total, month) => total + (Number(month.totals[kpi.key]) || 0), 0) / months.length]));
      average.basis = `Promedio de ${months.map(month => month.name).join(', ')}`;
    }
    document.getElementById('kpi-strip').innerHTML = KPIS.map(kpi => {
      let line = `<small>${kpi.hint}</small>`;
      if (previous) {
        const label = kpi.key === 'cost' ? period.compare.costShort : period.compare.short;
        line = deltaHtml(current[kpi.key], previous[kpi.key], kpi.better, `${label}${isEstimated(previousEstimated, kpi.uses) ? ' (est.)' : ''}`);
      } else if (average && kpi.perMonth) {
        line = `<small title="${escapeHtml(average.basis)}">Prom. mensual: ${formatValue(average[kpi.key], kpi.unit)}</small>`;
      }
      return `<div class="kpi-pill"><span>${kpi.label}</span><strong>${formatValue(current[kpi.key], kpi.unit)}${estTag(isEstimated(estimated, kpi.uses))}</strong>${line}</div>`;
    }).join('');
  }

  // ── Distribucion de inversion por campana ──
  function renderDistribution(period, campaigns) {
    const total = periodTotals(period);
    const estimated = periodEstimated(period);
    const est = uses => estTag(isEstimated(estimated, uses));
    const budget = campaigns.filter(campaign => /^habilitad/.test(normalizeText(campaign.status))).reduce((sum, campaign) => sum + (Number(campaign.dailyBudget) || 0), 0);
    document.getElementById('gasto-dist-sub').textContent = `${period.label} ${period.year} | ${campaigns.length} ${campaigns.length === 1 ? 'campaña' : 'campañas'} con inversión, impresiones o clics. Estado y presupuesto vigentes en el último informe.`;
    const money = value => (isNum(value) ? fmtMoney(value) : '<span class="no-data">-</span>');
    document.getElementById('gasto-dist-body').innerHTML = campaigns.map(campaign => `
      <tr>
        <td class="campaign-name"><span>${escapeHtml(campaign.label)}</span>${campaign.label !== campaign.name ? `<small>${escapeHtml(campaign.name)}</small>` : ''}</td>
        <td>${statusPill(campaign.status)}</td>
        <td class="num">${money(campaign.dailyBudget)}</td>
        <td class="num">${fmtMoney(campaign.cost)}</td>
        ${shareCell(campaign.share)}
        <td class="num">${fmtCount(campaign.impressions)}${est(['impressions'])}</td>
        <td class="num">${fmtCount(campaign.clicks)}${est(['clicks'])}</td>
        <td class="num">${fmtPercent(campaign.ctr)}${est(['clicks', 'impressions'])}</td>
        <td class="num">${fmtMoney(campaign.cpc)}${est(['clicks'])}</td>
        <td class="num">${fmtConv(campaign.conversions)}${est(['conversions'])}</td>
        <td class="num">${fmtMoney(campaign.costPerConversion)}${est(['conversions'])}</td>
        <td class="num">${fmtPercent(campaign.conversionRate)}${est(['conversions', 'clicks'])}</td>
      </tr>`).join('') + `
      <tr class="gasto-total-row">
        <td>Total del periodo</td>
        <td></td>
        <td class="num" title="Suma del presupuesto diario de las campañas habilitadas">${budget ? fmtMoney(budget) : '<span class="no-data">-</span>'}</td>
        <td class="num">${fmtMoney(total.cost)}</td>
        <td class="gasto-share-col"><b>100%</b></td>
        <td class="num">${fmtCount(total.impressions)}</td>
        <td class="num">${fmtCount(total.clicks)}</td>
        <td class="num">${fmtPercent(total.ctr)}</td>
        <td class="num">${fmtMoney(total.cpc)}</td>
        <td class="num">${fmtConv(total.conversions)}</td>
        <td class="num">${fmtMoney(total.costPerConversion)}</td>
        <td class="num">${fmtPercent(total.conversionRate)}</td>
      </tr>`;
  }

  // ── Cuadro de cada campana ──
  function campaignSettings(key) {
    const saved = gasto.campaignCharts[key] || {};
    const metrics = CAMPAIGN_METRICS.map(metric => metric.key).filter(metricKey => Array.isArray(saved.metrics) && saved.metrics.includes(metricKey));
    return {
      metrics: metrics.length ? metrics : DEFAULT_METRICS,
      // Con serie diaria abre en el acumulado del mes; sin ella, el cuadro cae a Por mes.
      mode: MODES.some(mode => mode.key === saved.mode) ? saved.mode : 'cumulative',
      collapsed: saved.collapsed === true
    };
  }
  function saveCampaignSettings(key, changes) {
    gasto.campaignCharts[key] = Object.assign(campaignSettings(key), changes);
    saveSetting(CAMP_CHARTS_KEY, JSON.stringify(gasto.campaignCharts));
  }
  const campaignBlock = key => [...document.querySelectorAll('#gasto-blocks .gasto-camp-block')].find(node => node.dataset.campaign === key) || null;

  // Serie por dia de la campana: con una sola campana es la de la cuenta. Fuera del mes del periodo, nada.
  const campaignDaily = (period, key) => {
    if (period.annual || gasto.months.some(month => month.campaigns.length > 1)) return [];
    const campaign = period.month.campaigns.find(item => item.key === key);
    return campaign ? period.month.days : [];
  };

  // Conversiones por accion (WhatsApp, Formulario...) del informe por accion de conversion de cada mes.
  function actionBlocks(period) {
    const blocks = (state.data && state.data.conversionActions) || [];
    return period.months.map(month => blocks.find(block => block.month === month.key)).filter(Boolean);
  }

  function actionsHtml(period) {
    const head = '<div class="gasto-kw-block-head"><div class="panel-title">Conversiones por acción</div>';
    const blocks = actionBlocks(period);
    if (!blocks.length) {
      const what = period.annual ? 'Ningún mes del periodo tiene' : `${escapeHtml(period.month.label)} no tiene`;
      return `${head}<div class="panel-sub">${what} informe de conversiones por acción. Sube a la carpeta Google Ads TF Campañas el informe de campaña con Segmento > Conversiones > Acción de conversión.</div></div>`;
    }
    const byName = new Map();
    blocks.forEach(block => block.actions.forEach(action => byName.set(action.name, (byName.get(action.name) || 0) + (Number(action.conversions) || 0))));
    const total = blocks.reduce((sum, block) => sum + (Number(block.total) || 0), 0);
    const rows = [...byName.entries()].sort((a, b) => b[1] - a[1]);
    const range = blocks.length === 1
      ? (() => {
        const block = blocks[0];
        const start = parseDate(block.start);
        const end = parseDate(block.end);
        return `${start.d}-${end.d} ${MONTH_NAMES[end.m - 1]} ${end.y}`;
      })()
      : blocks.map(block => SHORT_NAMES[parseDate(block.start).m - 1]).join(', ');
    const missing = period.months.length - blocks.length;
    return `${head}<div class="panel-sub">Del informe por acción de conversión, ${escapeHtml(range)}: ${fmtConv(total)} conversiones.${missing ? ` ${missing} ${missing === 1 ? 'mes del periodo no tiene' : 'meses del periodo no tienen'} este informe.` : ''}</div></div>
      <div class="table-scroll">
        <table class="data-table gasto-kw-table gasto-actions-table">
          <thead><tr><th>Acción de conversión</th><th class="num">Conversiones</th><th>% del total</th></tr></thead>
          <tbody>${rows.map(([name, conversions]) => `<tr class="${conversions > 0 ? '' : 'is-muted'}">
            <td class="gasto-kw-name"><span>${escapeHtml(name)}</span></td>
            <td class="num gasto-strong">${fmtConv(conversions)}</td>
            ${shareCell(total > 0 ? conversions / total : null)}
          </tr>`).join('')}
          <tr class="gasto-total-row"><td>Total</td><td class="num">${fmtConv(total)}</td><td></td></tr></tbody>
        </table>
      </div>`;
  }

  // Semanas del periodo (las que tienen al menos un dia dentro); el total del mes prorratea las que cruzan.
  function periodWeeks(period) {
    const keys = period.months.map(month => month.key);
    return state.weeks
      .filter(week => week.daysByMonth && keys.some(key => week.daysByMonth[key]))
      .map(week => ({ week, inside: keys.reduce((sum, key) => sum + (week.daysByMonth[key] || 0), 0) }));
  }

  function weeksHtml(period) {
    const head = '<div class="gasto-kw-block-head"><div class="panel-title">Resultados semanales</div>';
    const items = periodWeeks(period);
    if (!items.length) {
      const what = period.annual ? 'el periodo' : escapeHtml(period.month.label);
      return `${head}<div class="panel-sub">Sin detalle semanal para ${what}: el total sale del informe del mes. Sube el informe de campaña por Día o por Semana para verlo.</div></div>`;
    }
    const byStart = new Map(state.weeks.map((week, index) => [week.start, index]));
    const monthName = period.annual ? '' : period.month.name.toLowerCase();
    const rows = items.map(({ week, inside }) => {
      const prev = state.weeks[byStart.get(week.start) - 1];
      const tag = !period.annual && inside < week.days
        ? `<small>${inside} de ${week.days} días en ${monthName}</small>`
        : (week.days < 7 ? `<small>${week.days} días con datos</small>` : '');
      return `
      <tr>
        <td class="campaign-name"><span>${escapeHtml(weekLabel(week))}</span>${tag}</td>
        <td class="num">${fmtMoney(week.cost)}</td>${deltaCell(prev ? delta(week.cost, prev.cost) : null)}
        <td class="num">${fmtCount(week.impressions)}</td>
        <td class="num">${fmtPercent(week.ctr)}</td>
        <td class="num">${fmtCount(week.clicks)}</td>${deltaCell(prev ? delta(week.clicks, prev.clicks) : null)}
        <td class="num">${fmtMoney(week.cpc)}</td>${deltaCell(prev ? delta(week.cpc, prev.cpc) : null, true)}
        <td class="num">${fmtConv(week.conversions)}</td>${deltaCell(prev ? delta(week.conversions, prev.conversions) : null)}
        <td class="num">${fmtMoney(week.costPerConversion)}</td>${deltaCell(prev ? delta(week.costPerConversion, prev.costPerConversion) : null, true)}
      </tr>`;
    }).join('');
    const t = periodTotals(period);
    const coveredDays = items.reduce((sum, item) => sum + item.inside, 0);
    const periodDays = period.months.reduce((sum, month) => sum + (month.lastDay - month.firstDay + 1), 0);
    const crossing = !period.annual && items.some(({ week, inside }) => inside < week.days);
    const notes = [`${items.length} ${items.length === 1 ? 'semana' : 'semanas'} de lunes a domingo. % Δ compara cada semana con la anterior; en CPC y costo por conversión, bajar es mejor.`];
    if (crossing) notes.push(`Las semanas que cruzan de mes se muestran completas; el total de ${monthName} solo cuenta sus días dentro del mes.`);
    if (coveredDays < periodDays) notes.push(`El detalle semanal cubre ${coveredDays} de ${periodDays} días del periodo, así que no suma exactamente el total.`);
    const estimated = periodEstimated(period).size > 0;
    return `${head}<div class="panel-sub">${escapeHtml(notes.join(' '))}</div></div>
      <div class="table-scroll">
        <table class="data-table campaigns-table gasto-weeks-table">
          <thead><tr><th>Semana</th><th class="num">Inversión</th><th class="num">% Δ</th><th class="num">Impresiones</th><th class="num">CTR</th><th class="num">Clics</th><th class="num">% Δ</th><th class="num">CPC medio</th><th class="num">% Δ</th><th class="num">Conversiones</th><th class="num">% Δ</th><th class="num">Costo por conversión</th><th class="num">% Δ</th></tr></thead>
          <tbody>${rows}
            <tr class="reservations-total-row">
              <td class="total-label">Total ${escapeHtml(period.annual ? `${period.year}` : period.month.label)}${estimated ? ' (prorrateado)' : ''}</td>
              <td class="num">${fmtMoney(t.cost)}</td><td></td>
              <td class="num">${fmtCount(t.impressions)}</td>
              <td class="num">${fmtPercent(t.ctr)}</td>
              <td class="num">${fmtCount(t.clicks)}</td><td></td>
              <td class="num">${fmtMoney(t.cpc)}</td><td></td>
              <td class="num">${fmtConv(t.conversions)}</td><td></td>
              <td class="num">${fmtMoney(t.costPerConversion)}</td><td></td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }

  function campaignHtml(period, campaign, before) {
    const key = escapeHtml(campaign.key);
    const id = slug(campaign.key);
    const settings = campaignSettings(campaign.key);
    const estimated = periodEstimated(period);
    const previousEstimated = period.compare ? new Set(period.compare.month.estimated) : new Set();
    let comparison = '';
    if (period.annual) {
      const months = campaign.months;
      comparison = months.length === period.months.length
        ? `. Activa en los ${months.length} ${months.length === 1 ? 'mes' : 'meses'}`
        : `. Activa en ${months.map(month => month.shortName).join(', ')}`;
    } else if (period.compare) {
      comparison = before ? ` vs ${period.compare.label}` : `. Nueva: no corría en ${period.compare.month.name}`;
    }
    const kpis = CAMPAIGN_KPIS.map(kpi => {
      const previousTag = isEstimated(previousEstimated, kpi.uses);
      const deltaPart = before ? deltaHtml(campaign[kpi.key], before[kpi.key], kpi.better) : '';
      return `
      <div><dt>${kpi.label}</dt><dd>${formatValue(campaign[kpi.key], kpi.unit)}${estTag(isEstimated(estimated, kpi.uses))}${deltaPart}${deltaPart && previousTag ? '<small class="gasto-est" title="El mes de comparación es estimado"> (est.)</small>' : ''}</dd></div>`;
    }).join('');
    return `
      <section class="gasto-camp-block${settings.collapsed ? ' is-collapsed' : ''}" data-campaign="${key}">
        <div class="gasto-camp-head">
          <div class="gasto-camp-heading">
            <div class="gasto-camp-title">Campaña ${escapeHtml(campaign.label)}<em>${fmtPercent(campaign.share)} de la inversión</em>${statusPill(campaign.status)}</div>
            <div class="panel-sub">${escapeHtml(`${period.label} ${period.year}`)}${escapeHtml(comparison)}</div>
          </div>
          <div class="gasto-camp-controls">
            <div class="gasto-chips" data-camp-modes role="radiogroup" aria-label="Vista del gráfico de ${escapeHtml(campaign.label)}"></div>
            <button type="button" class="gasto-camp-toggle" data-camp-toggle aria-controls="gasto-camp-body-${id}">${CHEVRON}</button>
          </div>
        </div>
        <dl class="gasto-camp-kpis">${kpis}</dl>
        <div class="gasto-camp-body" id="gasto-camp-body-${id}">
          <div class="gasto-chips gasto-camp-metrics" data-camp-metrics role="group" aria-label="Indicadores del gráfico de ${escapeHtml(campaign.label)}"></div>
          <div class="chart-wrap h-300"><canvas id="chart-gasto-${id}" role="img" aria-label="Gráfico de la campaña ${escapeHtml(campaign.label)}"></canvas></div>
          <div class="gasto-legend" data-camp-legend></div>
          <div class="panel-note gasto-chart-note" data-camp-note hidden></div>
          ${actionsHtml(period)}
          ${weeksHtml(period)}
          ${campaignKeywordsHtml(period, campaign)}
        </div>
      </section>`;
  }

  // Chips de un grafico: radio para la vista, casillas para los indicadores (selected es entonces una lista).
  function chipsHtml(items, selected, name, multiple = false) {
    return items.map(item => {
      const on = multiple ? selected.includes(item.key) : item.key === selected;
      return `<label class="gasto-chip${on ? ' active' : ''}"><input type="${multiple ? 'checkbox' : 'radio'}" name="${escapeHtml(name)}" value="${escapeHtml(item.key)}"${on ? ' checked' : ''}>${escapeHtml(item.label)}</label>`;
    }).join('');
  }

  // ── Graficos de cada campana ──
  // Puntos de una serie: { values, est } (est[i] = el valor i es estimado). Un mes sin informe o en que la
  // campana no corrio queda como hueco.
  function monthlyPoints(metric, key) {
    const year = viewYear();
    const values = [];
    const est = [];
    MONTH_NAMES.forEach((_, index) => {
      const month = gastoMonthByKey(monthKeyOf(year, index + 1));
      const campaign = month && month.hasData ? month.campaigns.find(item => item.key === key) : null;
      const ok = campaign && isActive(campaign) && isNum(campaign[metric.key]);
      values.push(ok ? Number(campaign[metric.key]) : null);
      est.push(Boolean(ok && month.estimated.includes(metric.key)));
    });
    return { labels: SHORT_NAMES, values, est };
  }

  // Valores por dia del mes (indice 0 = dia 1); fuera de la serie, null.
  function dailyPoints(month, rows, metric) {
    const values = Array.from({ length: month.daysInMonth }, () => null);
    const est = Array.from({ length: month.daysInMonth }, () => false);
    rows.forEach(row => {
      const index = Number(row.date.slice(8, 10)) - 1;
      if (!isNum(row[metric.key])) return;
      values[index] = Number(row[metric.key]);
      est[index] = Boolean(row.estimated && row.estimated[metric.key]);
    });
    return { labels: values.map((_, index) => `${index + 1}`), values, est };
  }

  function cumulativePoints(points) {
    let total = 0;
    let estimated = false;
    // Despues del ultimo dia con dato la linea se corta (no se arrastra el acumulado).
    const last = points.values.reduce((at, value, index) => (value === null ? at : index), -1);
    return {
      labels: points.labels,
      values: points.values.map((value, index) => (index > last ? null : (total += value || 0))),
      est: points.est.map((flag, index) => (estimated = estimated || flag) && index <= last)
    };
  }

  // Por semana dentro del mes (lunes a domingo, cortadas en los bordes del mes).
  function weeklyPoints(month, rows, metric) {
    const groups = [];
    rows.forEach(row => {
      if (!isNum(row[metric.key])) return;
      const date = new Date(`${row.date}T00:00:00Z`);
      const monday = new Date(date);
      monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
      const start = monday.toISOString().slice(0, 10);
      let group = groups.find(item => item.start === start);
      if (!group) groups.push(group = { start, first: row.date, last: row.date, value: 0, est: false });
      group.last = row.date;
      group.value += Number(row[metric.key]);
      group.est = group.est || Boolean(row.estimated && row.estimated[metric.key]);
    });
    return {
      labels: groups.map(group => `${Number(group.first.slice(8, 10))}-${Number(group.last.slice(8, 10))} ${MONTH_SHORT[month.month - 1]}`),
      values: groups.map(group => group.value),
      est: groups.map(group => group.est)
    };
  }

  function pointsFor(metric, modeKey, period, key, month = period.month) {
    if (modeKey === 'monthly') return monthlyPoints(metric, key);
    const rows = month === period.month ? campaignDaily(period, key) : month.days;
    if (modeKey === 'weekly') return weeklyPoints(month, rows, metric);
    const daily = dailyPoints(month, rows, metric);
    return modeKey === 'cumulative' ? cumulativePoints(daily) : daily;
  }

  // Dataset con lo estimado punteado (segmentos que tocan un punto estimado) y puntos huecos.
  function lineDataset(points, metric, extra) {
    const solid = points.values.length <= 12;
    return Object.assign({
      label: metric.label, unit: metric.unit, data: points.values, est: points.est,
      borderColor: CHART_COLOR, backgroundColor: 'rgba(2,132,199,.08)', borderWidth: 2, tension: 0.25, spanGaps: false,
      segment: { borderDash: ctx => (points.est[ctx.p0DataIndex] || points.est[ctx.p1DataIndex] ? EST_DASH : undefined) },
      pointRadius: points.values.map(value => (value === null ? 0 : solid ? 4 : 2)),
      pointHoverRadius: 6,
      pointBackgroundColor: points.est.map(flag => (flag ? '#fff' : CHART_COLOR)),
      pointBorderColor: CHART_COLOR, pointBorderWidth: 2
    }, extra || {});
  }

  const MODE_TEXT = { cumulative: 'acumulado del mes', daily: 'por día', weekly: 'por semana', monthly: 'por mes' };

  // Un indicador: su linea (contra el mes anterior en las vistas diarias). Varios: uno por panel apilado.
  function campaignSeries(metrics, modeKey, period, key) {
    const what = modeKey === 'monthly' ? `${viewYear()}` : `${period.month.name} ${period.month.year}`;
    const anyEst = [];
    const datasets = metrics.map((metric, index) => {
      const points = pointsFor(metric, modeKey, period, key);
      if (points.est.some(Boolean)) anyEst.push(metric.label.toLowerCase());
      const marked = modeKey === 'monthly' ? [period.annual ? points.values.reduce((at, value, i) => (value === null ? at : i), -1) : period.month.month - 1] : [];
      return lineDataset(points, metric, Object.assign({ valueLabels: marked, fill: metrics.length === 1 && modeKey === 'cumulative' }, metrics.length > 1 ? { yAxisID: `y${index}` } : {}));
    });
    const labels = pointsFor(metrics[0], modeKey, period, key).labels;
    const legend = [`<span><i class="legend-line" style="background:${CHART_COLOR}"></i><b>${metrics.length === 1 ? `${escapeHtml(metrics[0].label)} ${MODE_TEXT[modeKey]}` : `${metrics.length} indicadores ${MODE_TEXT[modeKey]}`}, ${escapeHtml(what)}</b></span>`];
    if (metrics.length > 1) legend.push('<span>Cada indicador con su escala.</span>');
    // Con un indicador en vista diaria, el mes anterior en el mismo dia del mes.
    if (metrics.length === 1 && modeKey !== 'monthly' && modeKey !== 'weekly') {
      const previous = gastoMonthByKey(previousKey(period.month));
      if (previous && previous.days.length) {
        const points = pointsFor(metrics[0], modeKey, period, key, previous);
        const values = labels.map((_, index) => (index < points.values.length ? points.values[index] : null));
        if (values.some(value => value)) {
          datasets.push(Object.assign(lineDataset({ values, est: labels.map((_, index) => Boolean(points.est[index])) }, metrics[0]), {
            label: previous.name, borderColor: PREVIOUS_COLOR, pointBorderColor: PREVIOUS_COLOR, pointBackgroundColor: '#fff', pointRadius: 0, fill: false, borderDash: [3, 3], segment: undefined
          }));
          legend.push(`<span><i class="legend-line gasto-legend-dashed" style="color:${PREVIOUS_COLOR}"></i><b>${escapeHtml(previous.name)} (mismo día del mes)</b></span>`);
        }
      }
    }
    if (anyEst.length) legend.push(`<span><i class="legend-line gasto-legend-dashed" style="color:${CHART_COLOR}"></i><b>(est.) repartido desde las semanas: ${escapeHtml(anyEst.join(', '))}</b></span>`);
    return { labels, datasets, legend };
  }

  const tickValue = (unit, value) => (unit === 'money'
    ? `S/ ${Number(value).toLocaleString('es-PE', { maximumFractionDigits: 0 })}`
    : Number(value).toLocaleString('es-PE', { notation: Math.abs(value) >= 100000 ? 'compact' : 'standard', maximumFractionDigits: 1 }));

  // Con un indicador hay un solo eje y; con varios, un eje por indicador apilado en vertical (paneles con su
  // escala) sobre el mismo eje x. Nunca dos escalas superpuestas.
  function yScales(metrics) {
    const base = unit => ({ beginAtZero: true, border: { display: false }, ticks: { color: AXIS_COLOR, font: { size: 10 }, callback: value => tickValue(unit, value) } });
    if (metrics.length === 1) return { y: Object.assign(base(metrics[0].unit), { grace: '12%', grid: { color: GRID_COLOR } }) };
    // Chart.js apila de abajo hacia arriba en el orden de los ejes: se dan al reves para que el primero quede arriba.
    return Object.fromEntries(metrics.map((metric, index) => [`y${index}`, Object.assign(base(metric.unit), {
      stack: 'metrics',
      stackWeight: 1,
      grace: '25%',
      // El tope de cada panel cae sobre el cero del panel de arriba: se omite para que no se encimen.
      ticks: Object.assign(base(metric.unit).ticks, { maxTicksLimit: 5, callback: (value, tickIndex, ticks) => (index > 0 && tickIndex === ticks.length - 1 ? '' : tickValue(metric.unit, value)) }),
      grid: { color: ctx => (ctx.tick && ctx.tick.value === 0 ? '#bfdbfe' : GRID_COLOR) },
      panelLabel: metric.label
    })]).reverse());
  }

  const CHART_PLUGINS = [{
    // Etiqueta de valor en los puntos marcados (valueLabels).
    id: 'gastoValueLabels',
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      ctx.save();
      ctx.font = '600 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#334155';
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        if (!Array.isArray(dataset.valueLabels)) return;
        chart.getDatasetMeta(datasetIndex).data.forEach((point, index) => {
          const value = dataset.data[index];
          if (value === null || value === undefined || !dataset.valueLabels.includes(index)) return;
          const text = dataset.unit === 'money' ? tickValue('money', Math.round(value)) : formatValue(value, dataset.unit);
          ctx.fillText(text, point.x, point.y - 12);
        });
      });
      ctx.restore();
    }
  }, {
    // Nombre de cada panel arriba a la izquierda (solo con varios indicadores).
    id: 'gastoPanelLabels',
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      ctx.save();
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textBaseline = 'top';
      Object.values(chart.scales).forEach(scaleItem => {
        const label = scaleItem.options.panelLabel;
        if (!label) return;
        const x = chart.chartArea.left + 8;
        const y = scaleItem.top + 4;
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.fillRect(x - 4, y - 2, ctx.measureText(label).width + 8, 16);
        ctx.fillStyle = '#475569';
        ctx.fillText(label, x, y);
      });
      ctx.restore();
    }
  }, {
    // Linea vertical en el punto del tooltip, a lo alto de todos los paneles.
    id: 'gastoCrosshair',
    afterDatasetsDraw(chart) {
      const active = (chart.tooltip && chart.tooltip.getActiveElements()) || [];
      if (!active.length) return;
      const x = active[0].element.x;
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, chart.chartArea.top);
      ctx.lineTo(x, chart.chartArea.bottom);
      ctx.stroke();
      ctx.restore();
    }
  }];

  function destroyCampaignChart(id) {
    const chart = gasto.charts.get(id);
    if (chart) chart.destroy();
    gasto.charts.delete(id);
  }

  function drawCampaignChart(canvas, series, metrics, modeKey, period) {
    if (typeof Chart === 'undefined') {
      canvas.parentElement.innerHTML = '<div class="empty-state"><strong>Gráfico no disponible sin conexión.</strong><span>Los KPIs y las tablas siguen visibles.</span></div>';
      return;
    }
    const year = viewYear();
    const title = items => {
      const index = items[0].dataIndex;
      if (modeKey === 'monthly') return `${MONTH_NAMES[index]} ${year}`;
      if (modeKey === 'weekly') return `Semana ${items[0].label}`;
      return `${items[0].label} de ${period.month.name.toLowerCase()}`;
    };
    gasto.charts.set(canvas.id, new Chart(canvas, {
      type: 'line',
      data: { labels: series.labels, datasets: series.datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 24, right: 12, left: 4 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            filter: item => item.raw !== null && item.raw !== undefined,
            callbacks: {
              title,
              label: context => ` ${context.dataset.label}: ${formatValue(context.raw, context.dataset.unit)}${context.dataset.est && context.dataset.est[context.dataIndex] ? ' (est.)' : ''}`
            }
          }
        },
        scales: Object.assign({
          x: { grid: { display: false }, border: { color: '#bfdbfe' }, ticks: { color: AXIS_COLOR, font: { size: 10 }, autoSkip: true, maxTicksLimit: modeKey === 'monthly' ? 12 : 16 } }
        }, yScales(metrics))
      },
      plugins: CHART_PLUGINS
    }));
  }

  // Los controles del cuadro lo redibujan solo con la clave; renderCampaigns le pasa el periodo y sus campanas.
  function renderCampaignChart(key, period = currentPeriod(), campaigns = null) {
    const block = campaignBlock(key);
    const list = campaigns || (period ? periodCampaigns(period) : []);
    const campaign = list.find(item => item.key === key);
    if (!block || !campaign) return;
    const settings = campaignSettings(key);
    const rows = campaignDaily(period, key);
    const modes = rows.length ? MODES : MODES.filter(mode => !mode.daily);
    const modeKey = modes.some(mode => mode.key === settings.mode) ? settings.mode : 'monthly';
    // En una vista diaria solo los indicadores que la serie trae (junio, por ejemplo, solo tiene costo por dia).
    const metrics = CAMPAIGN_METRICS.filter(metric => modeKey === 'monthly' || rows.some(row => isNum(row[metric.key])));
    let selected = metrics.filter(metric => settings.metrics.includes(metric.key));
    if (!selected.length) selected = metrics.filter(metric => DEFAULT_METRICS.includes(metric.key));
    if (!selected.length) selected = metrics.slice(0, 1);
    const toggle = block.querySelector('[data-camp-toggle]');
    block.classList.toggle('is-collapsed', settings.collapsed);
    toggle.setAttribute('aria-expanded', String(!settings.collapsed));
    toggle.title = `${settings.collapsed ? 'Expandir' : 'Minimizar'} la campaña ${campaign.label}`;
    toggle.setAttribute('aria-label', toggle.title);
    const modesHost = block.querySelector('[data-camp-modes]');
    const metricsHost = block.querySelector('[data-camp-metrics]');
    const id = slug(key);
    keepFocus(modesHost, () => { modesHost.innerHTML = chipsHtml(modes, modeKey, `gasto-mode-${id}`); });
    keepFocus(metricsHost, () => { metricsHost.innerHTML = chipsHtml(metrics, selected.map(metric => metric.key), `gasto-metric-${id}`, true); });
    // Nota del grafico: hasta donde llega la serie diaria y que viene repartido.
    const note = block.querySelector('[data-camp-note]');
    const notes = [];
    if (!period.annual && !rows.length) notes.push(`${period.month.name} no tiene serie por día: solo la vista Por mes. Sube el informe de campaña por Día a la carpeta Google Ads TF Campañas.`);
    if (!period.annual && rows.length && modeKey !== 'monthly') {
      const last = Number(rows[rows.length - 1].date.slice(8, 10));
      if (last < period.month.lastDay) notes.push(`La serie por día llega al ${last} de ${period.month.name.toLowerCase()}; el informe del mes, al ${period.month.lastDay}.`);
      const missing = CAMPAIGN_METRICS.filter(metric => !metrics.includes(metric)).map(metric => metric.label.toLowerCase());
      if (missing.length) notes.push(`Sin dato por día de ${missing.join(', ')}.`);
    }
    note.textContent = notes.join(' ');
    note.hidden = !notes.length;
    const canvas = block.querySelector('canvas');
    if (!canvas) return;
    destroyCampaignChart(canvas.id);
    if (settings.collapsed) return;
    const series = campaignSeries(selected, modeKey, period, key);
    // Cada panel extra suma alto para que ninguno quede aplastado.
    canvas.parentElement.style.height = selected.length > 1 ? `${90 + 135 * selected.length}px` : '';
    block.querySelector('[data-camp-legend]').innerHTML = series.legend.join('');
    drawCampaignChart(canvas, series, selected, modeKey, period);
  }

  function destroyCampaignCharts() {
    [...gasto.charts.keys()].forEach(destroyCampaignChart);
  }

  function renderCampaigns(period, campaigns) {
    const host = document.getElementById('gasto-blocks');
    destroyCampaignCharts();
    host.innerHTML = campaigns.map(campaign => campaignHtml(period, campaign, previousCampaign(period, campaign.key))).join('');
    campaigns.forEach(campaign => renderCampaignChart(campaign.key, period, campaigns));
  }

  // ── Palabras clave por mes ──
  // Cada mes usa un solo informe para que la tabla sea coherente: el de la carpeta Keywords (por accion
  // de conversion: solo conversiones, Google deja impresiones, clics y costo en 0) o, si no hay, el informe
  // semanal del repo (todas las metricas; las semanas que cruzan de mes se reparten por dias).
  const MATCH_LABELS = { amplia: 'Concordancia amplia', frase: 'Concordancia de frase', exacta: 'Concordancia exacta' };
  const plainKeyword = text => String(text || '').replace(/^["[]+|["\]]+$/g, '').trim();
  const plainMatch = text => {
    const value = normalizeText(text).replace(/^concordancia (de )?/, '');
    return ['amplia', 'frase', 'exacta'].includes(value) ? value : value || '';
  };
  const kwKey = (keyword, match) => `${normalizeText(plainKeyword(keyword))}|${plainMatch(match)}`;
  const KW_METRICS = ['cost', 'impressions', 'clicks'];

  function driveKeywordMonth(month) {
    const block = ((state.data && state.data.keywordConversionsByMonth) || []).find(item => item.month === month.key);
    if (!block) return null;
    const startDay = Number(block.start.slice(8, 10));
    const endDay = Number(block.end.slice(8, 10));
    const rows = new Map();
    block.keywords.forEach(item => {
      const key = kwKey(item.keyword, item.match);
      if (!rows.has(key)) rows.set(key, { key, keyword: plainKeyword(item.keyword), match: plainMatch(item.match), paused: Boolean(item.paused), conversions: 0, cost: null, impressions: null, clicks: null, actions: {} });
      const row = rows.get(key);
      row.conversions += Number(item.conversions) || 0;
      Object.entries(item.actions || {}).forEach(([name, value]) => { row.actions[name] = (row.actions[name] || 0) + (Number(value) || 0); });
      // Sin el segmento por accion el informe trae metricas reales por palabra: se usan.
      KW_METRICS.forEach(field => { if (Number(item[field]) > 0) row[field] = (row[field] || 0) + Number(item[field]); });
    });
    const list = [...rows.values()];
    return {
      source: 'drive', label: block.sourceFile, startDay, endDay,
      complete: startDay === 1 && endDay === month.daysInMonth,
      hasMetrics: list.some(row => KW_METRICS.some(field => Number(row[field]) > 0)),
      actions: block.actions || [], estimated: false, rows: list
    };
  }

  function weeklyKeywordMonth(month) {
    const weeks = ((state.data && state.data.keywords && state.data.keywords.weeks) || []);
    const rows = new Map();
    let first = null;
    let last = null;
    let estimated = false;
    weeks.forEach(week => {
      const start = new Date(`${week.start}T00:00:00Z`);
      const end = new Date(`${week.end}T00:00:00Z`);
      const length = Math.round((end - start) / 86400000) + 1;
      let inside = 0;
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const iso = d.toISOString().slice(0, 10);
        if (!iso.startsWith(month.key)) continue;
        inside += 1;
        const day = Number(iso.slice(8, 10));
        first = first === null ? day : Math.min(first, day);
        last = last === null ? day : Math.max(last, day);
      }
      if (!inside) return;
      const share = inside / length;
      if (share < 1) estimated = true;
      (week.rows || []).forEach(item => {
        const key = kwKey(item.keyword, item.matchType);
        if (!rows.has(key)) rows.set(key, { key, keyword: plainKeyword(item.keyword), match: plainMatch(item.matchType), paused: /pausa|detenid/i.test(item.status || ''), conversions: 0, cost: 0, impressions: 0, clicks: 0, actions: {} });
        const row = rows.get(key);
        SUMS.forEach(field => { row[field] += (Number(item[field]) || 0) * share; });
        row.paused = /pausa|detenid/i.test(item.status || '');
      });
    });
    if (!rows.size) return null;
    return {
      source: 'weekly', label: (state.data.keywords && state.data.keywords.sourceFile) || 'informe semanal de palabras clave',
      startDay: first, endDay: last, complete: first === 1 && last === month.daysInMonth,
      hasMetrics: true, actions: [], estimated, rows: [...rows.values()]
    };
  }

  // Cache por version de la data: se arma una vez por mes.
  function keywordMonth(month) {
    if (!gasto.kwCache.has(month.key)) gasto.kwCache.set(month.key, driveKeywordMonth(month) || weeklyKeywordMonth(month));
    return gasto.kwCache.get(month.key);
  }

  const kwActive = (row, hasMetrics) => (hasMetrics ? isActive(row) : Number(row.conversions) > 0);

  // Filas del periodo (en Anual se suman los meses). hasMetrics: alguna fila trae impresiones, clics o costo.
  function keywordScope(period) {
    const months = period.months.map(month => ({ month, kw: keywordMonth(month) })).filter(item => item.kw);
    const byKey = new Map();
    months.forEach(({ kw }) => kw.rows.forEach(row => {
      if (!byKey.has(row.key)) byKey.set(row.key, Object.assign({}, row, { conversions: 0, cost: null, impressions: null, clicks: null, actions: {} }));
      const entry = byKey.get(row.key);
      entry.conversions += row.conversions;
      entry.paused = row.paused;
      KW_METRICS.forEach(field => { if (isNum(row[field])) entry[field] = (entry[field] || 0) + Number(row[field]); });
      Object.entries(row.actions || {}).forEach(([name, value]) => { entry.actions[name] = (entry.actions[name] || 0) + value; });
    }));
    const hasMetrics = months.some(({ kw }) => kw.hasMetrics);
    // Anual con meses de los dos informes: la inversion por palabra solo existe en los meses del semanal, asi
    // que el costo por conversion mezclaria periodos y no se calcula.
    const metricMonths = months.filter(({ kw }) => kw.hasMetrics).map(({ month }) => month);
    const mixed = hasMetrics && metricMonths.length < months.length;
    const rows = [...byKey.values()].map(row => Object.assign(derive(row), mixed ? { costPerConversion: null } : {}));
    let label = '';
    if (period.annual) label = months.map(({ month }) => month.shortName).join(', ');
    else if (months.length) {
      const { month, kw } = months[0];
      label = kw.complete ? `${month.name} ${month.year}` : `${dayRange(month, kw.startDay, kw.endDay)} ${month.year}`;
    }
    return {
      months, rows, hasMetrics, label, mixed, metricMonths,
      estimated: months.some(({ kw }) => kw.estimated),
      sources: [...new Set(months.map(({ kw }) => kw.source))]
    };
  }

  // Comparacion con el mes calendario anterior: solo si los dos meses usan el mismo informe y cubren el mes
  // completo o los mismos dias.
  function keywordCompare(period) {
    if (period.annual) return { compare: null, reason: null };
    const current = keywordMonth(period.month);
    if (!current) return { compare: null, reason: null };
    const previousMonth = gastoMonthByKey(previousKey(period.month));
    if (!previousMonth || !previousMonth.hasData) return { compare: null, reason: 'Sin mes anterior para comparar.' };
    const previous = keywordMonth(previousMonth);
    if (!previous) return { compare: null, reason: `Sin informe de palabras clave de ${previousMonth.name} para comparar.` };
    if (current.source !== previous.source) {
      return { compare: null, reason: `Sin comparación: ${period.month.name} sale del informe por acción de conversión y ${previousMonth.name}, del informe semanal.` };
    }
    const sameDays = current.startDay === previous.startDay && current.endDay === previous.endDay;
    if ((current.complete && previous.complete) || sameDays) {
      const rows = new Map(keywordScope({ months: [previousMonth], month: previousMonth }).rows.map(row => [row.key, row]));
      return { compare: { month: previousMonth, rows, label: current.complete ? previousMonth.name : dayRange(previousMonth, previous.startDay, previous.endDay), estimated: previous.estimated }, reason: null };
    }
    return { compare: null, reason: `Sin comparación: el informe de palabras clave de ${period.month.name} (${current.startDay}-${current.endDay}) y el de ${previousMonth.name} no cubren los mismos días.` };
  }

  // Variacion con el mes anterior: "Nuevo" si no estaba, verde o rojo si no.
  function variationCell(current, previous) {
    if (previous === null || previous === undefined) return '<span class="status-pill new">Nuevo</span>';
    const d = change(current, previous);
    if (d === null) return '<span class="no-data">-</span>';
    return `<span class="status-pill ${d >= 0 ? 'green' : 'red'}">${d >= 0 ? '▲' : '▼'} ${pctText(d, 0)}</span>`;
  }

  const matchText = match => MATCH_LABELS[match] || match || 'Sin concordancia';
  const keywordCell = (row, cls) => `<td class="${cls}" title="${escapeHtml(`${row.keyword} (${matchText(row.match)})`)}"><span>${row.leader ? '<b class="gasto-leader" title="Líder de la campaña">★</b> ' : ''}${escapeHtml(row.keyword)}</span><small>${escapeHtml(matchText(row.match))}${row.paused ? ' · detenida' : ''}</small></td>`;

  // Palabras clave de la campana en el periodo, con sus conversiones contra el mes anterior.
  function campaignKeywordsHtml(period, campaign) {
    const head = '<div class="gasto-kw-block-head"><div class="panel-title">Palabras clave del periodo</div>';
    const scope = keywordScope(period);
    if (!scope.months.length) {
      const what = period.annual ? 'Ningún mes del periodo tiene' : `${escapeHtml(period.month.label)} no tiene`;
      return `${head}<div class="panel-sub">${what} informe de palabras clave. Súbelo a la carpeta Google Ads TF Keywords de Drive.</div></div>`;
    }
    const all = scope.rows;
    const rows = all.filter(row => kwActive(row, scope.hasMetrics)).sort((a, b) => b.conversions - a.conversions || (b.cost || 0) - (a.cost || 0) || (b.clicks || 0) - (a.clicks || 0));
    if (!rows.length) return `${head}<div class="panel-sub">El informe de palabras clave de ${escapeHtml(scope.label)} no trae actividad de esta campaña.</div></div>`;
    const { compare, reason } = keywordCompare(period);
    const kwCost = rows.reduce((total, row) => total + (Number(row.cost) || 0), 0);
    // Cobertura: la inversion de la campana en los meses que tienen inversion por palabra.
    const campaignCost = scope.mixed ? scope.metricMonths.reduce((total, month) => total + (Number(month.totals.cost) || 0), 0) : campaign.cost;
    const kwConv = rows.reduce((total, row) => total + row.conversions, 0);
    const byCost = scope.hasMetrics && kwCost > 0;
    const hidden = all.length - rows.length;
    const cols = [['Palabra clave'], ['Conversiones', true]]
      .concat(compare ? [[`Conversiones ${compare.label}`, true], ['Variación', true]] : [])
      .concat(scope.hasMetrics ? (scope.mixed ? [] : [['Costo por conversión', true]]).concat([['Inversión', true]]) : [])
      .concat([[byCost ? '% de la campaña' : '% de las conversiones']])
      .concat(scope.hasMetrics ? [['Impresiones', true], ['Clics', true], ['CPC', true]] : []);
    const est = estTag(scope.estimated);
    const body = rows.map(row => {
      const before = compare ? compare.rows.get(row.key) : null;
      return `<tr>
          ${keywordCell(row, 'gasto-kw-name')}
          <td class="num gasto-strong">${fmtConv(row.conversions)}</td>
          ${compare ? `<td class="num">${before ? fmtConv(before.conversions) : '<span class="no-data">-</span>'}</td><td class="num">${variationCell(row.conversions, before ? before.conversions : null)}</td>` : ''}
          ${scope.hasMetrics ? `${scope.mixed ? '' : `<td class="num">${fmtMoney(row.costPerConversion)}</td>`}<td class="num">${fmtMoney(row.cost)}${est}</td>` : ''}
          ${shareCell(byCost ? (Number(row.cost) || 0) / kwCost : kwConv > 0 ? row.conversions / kwConv : null)}
          ${scope.hasMetrics ? `<td class="num">${fmtCount(row.impressions)}${est}</td><td class="num">${fmtCount(row.clicks)}${est}</td><td class="num">${fmtMoney(row.cpc)}</td>` : ''}
        </tr>`;
    }).join('');
    const from = scope.sources.length === 1
      ? (scope.sources[0] === 'drive' ? 'del informe por acción de conversión (carpeta Keywords)' : 'del informe semanal de palabras clave')
      : 'de la carpeta Keywords (Set, Oct) y del informe semanal (meses anteriores)';
    const notes = [`${rows.length} ${rows.length === 1 ? 'palabra clave' : 'palabras clave'} con ${scope.hasMetrics ? 'actividad' : 'conversiones'} en ${escapeHtml(scope.label)}, ${from}.`];
    if (byCost) notes.push(`${fmtMoney(kwCost)} de ${fmtMoney(campaignCost)} de la campaña${scope.mixed ? ` en ${scope.metricMonths.map(month => month.shortName).join(', ')}` : ''}${scope.estimated ? ' (semanas repartidas por días, est.)' : ''}.`);
    if (scope.mixed) notes.push(`Inversión, impresiones y clics por palabra solo de ${scope.metricMonths.map(month => month.shortName).join(', ')}; sin costo por conversión, porque las conversiones suman también los meses del informe por acción.`);
    if (!scope.hasMetrics) notes.push('Ese informe viene separado por acción de conversión: Google Ads no reparte impresiones, clics ni costo por palabra, así que esas columnas no se muestran.');
    if (compare) notes.push(`Conversiones contra ${escapeHtml(compare.label)}${compare.estimated ? ' (est.)' : ''}.`);
    else if (reason) notes.push(escapeHtml(reason));
    if (hidden) notes.push(`${hidden} sin ${scope.hasMetrics ? 'impresiones' : 'conversiones'} no se ${hidden === 1 ? 'muestra' : 'muestran'}.`);
    if (period.annual && scope.months.length < period.months.length) notes.push('Solo los meses del periodo con informe de palabras clave.');
    return `${head}<div class="panel-sub">${notes.join(' ')}</div></div>
      <div class="table-scroll">
        <table class="data-table gasto-kw-table">
          <thead><tr>${cols.map(([label, numeric]) => `<th${numeric ? ' class="num"' : ''}>${escapeHtml(label)}</th>`).join('')}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  }

  // ── Ranking de palabras clave del periodo ──
  function renderRanking(period, campaigns) {
    const panel = document.getElementById('gasto-kw-panel');
    const body = document.getElementById('gasto-kw-body');
    const select = document.getElementById('gasto-kw-campaign');
    const sub = document.getElementById('gasto-kw-sub');
    if (!panel || !body) return;
    const scope = keywordScope(period);
    const { compare, reason } = keywordCompare(period);
    panel.classList.toggle('no-compare', !compare);
    panel.classList.toggle('no-metrics', !scope.hasMetrics);
    panel.classList.toggle('no-cpa', scope.mixed);
    document.getElementById('gasto-kw-title').textContent = `Ranking de palabras clave | ${period.label} ${period.year}`;
    document.getElementById('gasto-kw-prev-head').textContent = compare ? `Conversiones ${compare.label}` : 'Mes anterior';
    // Con una sola campana (o informes sin campana por palabra), todas van a la campana del periodo.
    const campaign = campaigns[0];
    const options = campaign ? [`<option value="${escapeHtml(campaign.key)}"${gasto.kwFilter === campaign.key ? ' selected' : ''}>${escapeHtml(campaign.label)}</option>`] : [];
    select.innerHTML = ['<option value="all">Todas las campañas</option>'].concat(options).join('');
    if (!scope.months.length) {
      sub.textContent = '';
      body.innerHTML = `<tr><td class="table-empty" colspan="11">${period.annual ? 'Ningún mes del periodo tiene' : `${escapeHtml(period.month.label)} no tiene`} informe de palabras clave. Súbelo a la carpeta Google Ads TF Keywords de Drive.</td></tr>`;
      return;
    }
    const rows = scope.rows.filter(row => kwActive(row, scope.hasMetrics))
      .sort((a, b) => b.conversions - a.conversions || (b.cost || 0) - (a.cost || 0) || (b.clicks || 0) - (a.clicks || 0));
    if (rows.length && rows[0].conversions > 0) rows[0].leader = true;
    const visible = gasto.kwFilter === 'all' || (campaign && gasto.kwFilter === campaign.key) ? rows : [];
    const est = estTag(scope.estimated);
    sub.textContent = `${visible.length} ${visible.length === 1 ? 'palabra clave ordenada' : 'palabras clave ordenadas'} por conversiones, ${scope.label}. La estrella marca a la líder de la campaña.${scope.hasMetrics ? '' : ' Solo conversiones: el informe viene separado por acción de conversión.'}${scope.mixed ? ` Inversión, impresiones y clics solo de ${scope.metricMonths.map(month => month.shortName).join(', ')}.` : ''}${compare ? '' : reason ? ` ${reason}` : ''}`;
    body.innerHTML = visible.map(row => {
      const before = compare ? compare.rows.get(row.key) : null;
      return `
        <tr>
          <td class="gasto-rank-campaign" title="${escapeHtml(campaign ? campaign.name : '')}"><span>${escapeHtml(campaign ? campaign.label : '-')}</span></td>
          ${keywordCell(row, 'gasto-rank-keyword')}
          <td class="num gasto-strong">${fmtConv(row.conversions)}</td>
          <td class="num">${before ? fmtConv(before.conversions) : '<span class="no-data">-</span>'}</td>
          <td class="num">${compare ? variationCell(row.conversions, before ? before.conversions : null) : '<span class="no-data">-</span>'}</td>
          <td class="num">${fmtMoney(row.costPerConversion)}</td>
          <td class="num">${fmtMoney(row.cost)}${est}</td>
          <td class="num">${fmtCount(row.impressions)}${est}</td>
          <td class="num">${fmtCount(row.clicks)}${est}</td>
          <td class="num">${fmtPercent(row.ctr)}</td>
          <td class="num">${fmtMoney(row.cpc)}</td>
        </tr>`;
    }).join('') || '<tr><td class="table-empty" colspan="11">No hay palabras clave de esta campaña en el periodo.</td></tr>';
  }

  // ── Herramientas del ranking: compacto y pantalla completa ──
  function applyCompact() {
    const panel = document.getElementById('gasto-kw-panel');
    const button = document.getElementById('gasto-kw-density');
    if (!panel || !button) return;
    panel.classList.toggle('is-compact', gasto.compact);
    button.setAttribute('aria-pressed', String(gasto.compact));
    button.textContent = gasto.compact ? 'Cómodo' : 'Compacto';
    button.title = gasto.compact ? 'Volver a filas amplias' : 'Reducir el alto de las filas';
  }
  function toggleCompact() {
    gasto.compact = !gasto.compact;
    saveSetting(KW_COMPACT_KEY, gasto.compact);
    applyCompact();
  }

  function toggleFullscreen(force) {
    const panel = document.getElementById('gasto-kw-panel');
    const button = document.getElementById('gasto-kw-expand');
    const tabs = document.getElementById('month-tabs');
    if (!panel || !button || !tabs) return;
    const next = force === undefined ? !gasto.fullscreen : Boolean(force);
    if (next === gasto.fullscreen) return;
    gasto.fullscreen = next;
    const scroller = panel.querySelector('.gasto-rank-scroll');
    panel.classList.toggle('is-fullscreen', next);
    document.body.classList.toggle('gasto-table-fullscreen', next);
    // Las pestanas de mes viajan al panel para poder cambiar de mes sin salir.
    if (next) {
      gasto.tabsHome = { parent: tabs.parentNode, next: tabs.nextSibling };
      panel.insertBefore(tabs, scroller);
    } else if (gasto.tabsHome) {
      gasto.tabsHome.parent.insertBefore(tabs, gasto.tabsHome.next);
      gasto.tabsHome = null;
    }
    button.setAttribute('aria-pressed', String(next));
    button.textContent = next ? '✕ Salir' : '⤢ Pantalla completa';
    button.title = next ? 'Salir de pantalla completa (Esc)' : 'Ver la tabla en pantalla completa (Esc para salir)';
    if (next) scroller.focus();
  }

  function openKeywordsView() {
    toggleFullscreen(false);
    const button = document.querySelector('.s-item[data-view-target="view-keywords"]');
    if (button) button.click();
    window.scrollTo(0, 0);
  }

  // ── Render ──
  function selectTab(value) {
    if (value === YEAR_KEY) {
      state.annual = true;
    } else {
      state.annual = false;
      state.monthId = value;
    }
    storeMonth(value);
    renderAll();
  }

  function renderGasto() {
    const period = currentPeriod();
    renderTabs(period);
    renderAlerts();
    if (!period) {
      document.getElementById('gasto-period-title').textContent = 'Sin informes de campaña';
      document.getElementById('gasto-period-sub').textContent = 'Sube el informe del mes a la carpeta Google Ads TF Campañas y sincroniza.';
      document.getElementById('kpi-strip').innerHTML = '';
      document.getElementById('gasto-dist-body').innerHTML = '<tr><td class="table-empty" colspan="12">Sin resultados para mostrar.</td></tr>';
      destroyCampaignCharts();
      document.getElementById('gasto-blocks').innerHTML = '';
      document.getElementById('gasto-kw-body').innerHTML = '<tr><td class="table-empty" colspan="11">Sin resultados para mostrar.</td></tr>';
      return;
    }
    const campaigns = periodCampaigns(period);
    renderPeriod(period);
    renderDistribution(period, campaigns);
    renderCampaigns(period, campaigns);
    renderRanking(period, campaigns);
  }

  function periodLabel() {
    const period = currentPeriod();
    if (!period) return '';
    return period.annual ? `Anual ${period.year}` : period.month.label;
  }

  function updateSourceLabels() {
    const status = document.getElementById('topbar-status');
    const source = document.getElementById('footer-source');
    const footerStatus = document.getElementById('footer-status');
    const caption = document.getElementById('topbar-caption');
    if (!document.getElementById('view-obj').classList.contains('visible')) return;
    // La navegacion puede llamar antes de que termine la carga; renderAll() lo vuelve a hacer despues.
    if (!state.data) return;
    if (status) status.textContent = `Datos al ${shortDate(state.data.period.end)} | ${state.weeks.length} semanas`;
    if (source) source.textContent = `Fuente: ${state.data.sourceFile}`;
    if (footerStatus) footerStatus.textContent = `Periodo ${periodLabel()}`;
    if (caption) caption.textContent = `Google Ads | ${periodLabel()}`;
  }

  function renderAll() {
    renderGasto();
    updateSourceLabels();
  }

  function renderError(message) {
    document.getElementById('view-obj').innerHTML = `<div class="data-notice error"><strong>No se pudo cargar la data de Google Ads.</strong>${escapeHtml(message)}</div>`;
  }

  // Eventos por delegacion en la vista: pestanas y cuadros se repintan.
  function wireEvents() {
    const view = document.getElementById('view-obj');
    if (!view) return;
    view.addEventListener('click', event => {
      const tab = event.target.closest('#month-tabs .month-tab:not(:disabled)');
      if (tab) {
        const value = tab.dataset.month;
        if ((value === YEAR_KEY && state.annual) || (value === state.monthId && !state.annual)) return;
        selectTab(value);
        return;
      }
      const toggle = event.target.closest('[data-camp-toggle]');
      if (toggle) {
        const key = toggle.closest('.gasto-camp-block').dataset.campaign;
        saveCampaignSettings(key, { collapsed: !campaignSettings(key).collapsed });
        renderCampaignChart(key);
        return;
      }
      if (event.target.closest('#gasto-kw-density')) { toggleCompact(); return; }
      if (event.target.closest('#gasto-kw-expand')) { toggleFullscreen(); return; }
      if (event.target.closest('#gasto-kw-more')) openKeywordsView();
    });
    view.addEventListener('change', event => {
      if (event.target.id === 'gasto-kw-campaign') {
        gasto.kwFilter = event.target.value;
        const period = currentPeriod();
        if (period) renderRanking(period, periodCampaigns(period));
        return;
      }
      const input = event.target.closest('.gasto-camp-block input');
      if (!input) return;
      const block = input.closest('.gasto-camp-block');
      const key = block.dataset.campaign;
      if (input.closest('[data-camp-modes]')) {
        saveCampaignSettings(key, { mode: input.value });
      } else {
        // Siempre queda al menos un indicador: desmarcar el ultimo lo deja como estaba.
        const checked = [...block.querySelectorAll('[data-camp-metrics] input:checked')].map(item => item.value);
        if (checked.length) saveCampaignSettings(key, { metrics: checked });
      }
      renderCampaignChart(key);
    });
    // Esc y el cambio de modulo cierran la pantalla completa (con el panel fijo la pagina quedaria bloqueada).
    document.addEventListener('keydown', event => { if (event.key === 'Escape') toggleFullscreen(false); });
    document.querySelectorAll('.s-item').forEach(button => button.addEventListener('click', () => toggleFullscreen(false)));
    applyCompact();
  }

  // Deja lista una version de la data (la del repo o la ya mezclada con Drive) y redibuja todo.
  function applyData(data) {
    state.data = data;
    window.TIERRA_FILMS_RETAIL_DATA = data;
    state.weeks = data.weeks.map(withRates);
    state.days = buildDays(data);
    // Proyecciones reutiliza la misma serie diaria (real donde exista).
    window.TierraFilmsDays = state.days;
    state.months = (data.months || []).map(withRates);
    buildGastoMonths();
    // El mes elegido se conserva; si no existe, el guardado ('anual' es la pestana Anual) o el ultimo con datos.
    const stored = state.monthId || readStoredMonth();
    state.annual = state.annual || stored === YEAR_KEY;
    const valid = id => gasto.months.some(month => month.key === id && month.hasData);
    state.monthId = valid(state.monthId) ? state.monthId : valid(stored) ? stored : (gasto.latestKey || data.defaultMonth);
    renderAll();
    window.dispatchEvent(new CustomEvent('tierra-films:data-ready', { detail: data }));
  }

  // El boton siempre dice "Sincronizar"; el estado va en el texto chico de al lado.
  function setSyncStatus(mode, meta, detail) {
    const button = document.getElementById('drive-sync');
    const text = document.getElementById('drive-sync-label');
    const status = document.getElementById('drive-sync-meta');
    if (!button || !text) return;
    button.dataset.state = mode;
    button.disabled = mode === 'loading';
    text.textContent = mode === 'loading' ? 'Sincronizando...' : 'Sincronizar';
    if (status) status.textContent = meta;
    button.title = detail;
  }

  // Lee la carpeta de Drive y la pone encima de la data del repo. Si falla, el tablero sigue con lo que tenia.
  function snapshotDate() {
    return state.snapshot && state.snapshot.generatedAt ? shortDate(state.snapshot.generatedAt.slice(0, 10)) : '';
  }

  // Copia local de las carpetas de Drive (scripts/drive-snapshot.py). Es opcional.
  async function loadSnapshot() {
    if (window.TIERRA_FILMS_DRIVE_SNAPSHOT) return window.TIERRA_FILMS_DRIVE_SNAPSHOT;
    try {
      const response = await fetch(SNAPSHOT_URL, { cache: 'no-store' });
      return response.ok ? await response.json() : null;
    } catch (error) {
      return null;
    }
  }

  async function syncDrive(event) {
    const drive = window.TierraFilmsDrive;
    if (!drive || !state.base) return;
    const clicked = Boolean(event && event.type === 'click');
    const pending = 'Falta conectar las carpetas de Drive: publica apps-script/drive-sync.gs y pega su URL en js/drive-sync.js.';
    if (!drive.configured) {
      const meta = clicked ? 'falta conectar Drive' : state.snapshot ? `copia ${snapshotDate()}` : 'sin conexion';
      setSyncStatus('off', meta, state.snapshot ? `Mostrando la copia guardada de Drive del ${snapshotDate()}. ${pending}` : pending);
      return;
    }
    setSyncStatus('loading', '', clicked ? 'Leyendo las carpetas de Google Drive' : 'Trayendo el ultimo barrido de Drive');
    try {
      // Al abrir se usa el ultimo barrido (el automatico de las 10:00); el boton barre en el momento.
      const merged = drive.merge(state.base, await drive.fetchFolder({ fresh: clicked }));
      applyData(merged);
      const info = merged.drive;
      const when = new Date(info.syncedAt);
      const time = when.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      const today = when.toDateString() === new Date().toDateString();
      const stamp = today ? time : `${shortDate(when.toISOString().slice(0, 10))} ${time}`;
      const meta = info.origin === 'automatico' ? `auto ${stamp}` : `leido ${stamp}`;
      const schedule = info.schedule ? `Barrido automatico todos los dias a las ${info.schedule.hour}:00 (hora de Lima). ` : '';
      const origin = { automatico: 'automatico', manual: 'con el boton', inicial: 'inicial', instalacion: 'al instalar', prueba: 'de prueba' }[info.origin] || '';
      const used = info.applied.length ? `Leido: ${info.applied.join(', ')}.` : 'Las carpetas no tienen informes que el tablero reconozca.';
      const skipped = info.notes.length ? `\n${info.notes.join('\n')}` : '';
      setSyncStatus(info.notes.length && !info.applied.length ? 'warn' : 'ok', meta, `${schedule}Ultimo barrido${origin ? ` (${origin})` : ''}: ${when.toLocaleString('es-PE')}\n${used}${skipped}`);
    } catch (error) {
      console.error(error);
      const fallback = state.snapshot ? ` Se muestra la copia guardada del ${snapshotDate()}.` : '';
      setSyncStatus('error', 'no se pudo leer', `No se pudo leer Drive: ${error.message}${fallback}`);
    }
  }

  async function init() {
    wireEvents();
    try {
      let data = window.TIERRA_FILMS_RETAIL_DATA;
      if (!data) {
        const response = await fetch(DATA_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        data = await response.json();
      }
      if (!Array.isArray(data.weeks) || !data.weeks.length) throw new Error('La fuente no contiene semanas con datos.');
      // La data del repo queda intacta: cada sincronizacion parte de ella.
      state.base = JSON.parse(JSON.stringify(data));
      state.snapshot = await loadSnapshot();
      let first = data;
      if (state.snapshot && window.TierraFilmsDrive) {
        try { first = window.TierraFilmsDrive.merge(state.base, state.snapshot); } catch (error) { console.error(error); }
      }
      applyData(first);
    } catch (error) {
      renderError(error.message);
      console.error(error);
      return;
    }
    const button = document.getElementById('drive-sync');
    if (button) button.addEventListener('click', syncDrive);
    syncDrive();
  }

  window.TierraFilmsFormat = { fmtMoney, fmtCount, fmtConv, fmtPercent, formatValue, shortDate, weekLabel, withRates, escapeHtml, MONTH_NAMES };
  window.TierraFilmsRefreshLabels = updateSourceLabels;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
