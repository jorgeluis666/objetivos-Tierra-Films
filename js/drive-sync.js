(function () {
  // URL /exec de la aplicacion web de Apps Script (apps-script/drive-sync.gs).
  // Vacia: el tablero usa solo la data del repo y el boton avisa que falta la conexion.
  const DRIVE_SYNC_URL = '';
  // Carpetas "Google Ads TF"; deben coincidir con FOLDERS en apps-script/drive-sync.gs.
  const FOLDER_URLS = {
    campanas: 'https://drive.google.com/drive/folders/1Zz5WjNFy0H37n0trSjhVx90NgPmqkyrO',
    segmentacion: 'https://drive.google.com/drive/folders/1Ehko4amk1IjGW6H-HB4WtkF98aaNeB7U',
    keywords: 'https://drive.google.com/drive/folders/1WSk4gc4UNeprLTWFzLtTUaSqOSWZ25yL'
  };
  const TIMEOUT_MS = 25000;
  const MONTHS = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
  const MONTH_LABELS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const METRIC_COLUMNS = {
    cost: ['Costo', 'Coste'],
    impressions: ['Impr.', 'Impresiones'],
    clicks: ['Clics'],
    conversions: ['Conversiones']
  };

  const clean = value => String(value ?? '').trim();

  // Las hojas traen numeros de verdad; los CSV, texto. Google Ads exporta segun el idioma de la
  // cuenta: es-PE ("2461,69", "1.247", "8,34%") o en ("1,124", "186.01%"). Cada hoja se mira entera.
  function detectLocale(rows) {
    let es = 0;
    let en = 0;
    rows.forEach(row => row.forEach(cell => {
      if (typeof cell !== 'string') return;
      if (/^-?\d+,\d{1,2}%?$/.test(cell)) es += 1;
      else if (/^-?\d+\.\d{1,2}%?$/.test(cell)) en += 1;
    }));
    return en > es ? 'en' : 'es';
  }

  function parseNumber(value, locale = 'es') {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const text = clean(value).replace(/[A-Za-z$€%\s]/g, '');
    if (!text || text === '--') return null;
    const normalized = locale === 'en' ? text.replace(/,/g, '') : text.replace(/\./g, '').replace(',', '.');
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }

  // Porcentajes como fraccion: "186.01%" -> 1.8601. "∞" es un valor que la semana anterior fue 0.
  function parsePercent(value, locale = 'es') {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const text = clean(value);
    if (text === '∞' || text === '+∞') return Infinity;
    const number = parseNumber(text, locale);
    return number === null ? null : number / 100;
  }

  function parseDates(text) {
    return [...clean(text).toLowerCase().matchAll(/(\d{1,2}) de ([a-záéíóú]+) de (\d{4})/g)]
      .map(([, d, m, y]) => (MONTHS[m] ? `${y}-${String(MONTHS[m]).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null))
      .filter(Boolean);
  }

  function parseRange(text) {
    const dates = parseDates(text);
    return dates.length === 2 ? { start: dates[0], end: dates[1] } : null;
  }

  // Fechas del preambulo (las filas antes de la cabecera): el rango y, si hay, el de comparacion.
  function preambleDates(rows, headerIndex) {
    return rows.slice(0, headerIndex).map(row => parseDates(row.find(cell => typeof cell === 'string' && cell) || '')).find(dates => dates.length >= 2) || [];
  }

  function daysBetween(start, end) {
    return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
  }

  function withRates(item) {
    const round2 = value => Math.round(value * 100) / 100;
    item.ctr = item.impressions ? Math.round(item.clicks / item.impressions * 1e6) / 1e6 : null;
    item.cpc = item.clicks ? round2(item.cost / item.clicks) : null;
    item.costPerConversion = item.conversions ? round2(item.cost / item.conversions) : null;
    return item;
  }

  // Un informe por pestaña. El tipo sale de la fila de encabezados, como en el importador de Python.
  function parseSheet(sheet) {
    const rows = (sheet.rows || []).map(row => row.map(cell => (typeof cell === 'number' ? cell : clean(cell))));
    // Una hoja importada de un CSV se llama como el archivo (con .csv): basta con el nombre del archivo.
    const sameName = !sheet.sheet || sheet.sheet === sheet.file || sheet.sheet.replace(/\.csv$/i, '') === sheet.file;
    const name = sameName ? sheet.file : `${sheet.file} > ${sheet.sheet}`;
    const locale = detectLocale(rows);
    const termsIndex = rows.findIndex(row => row.includes('Categoría de búsqueda'));
    if (termsIndex >= 0) return parseSearchTerms(sheet, name, rows, termsIndex, locale);
    const placesIndex = rows.findIndex(row => row.includes('Ubicación'));
    if (placesIndex >= 0) return parseLocations(sheet, name, rows, placesIndex, locale);
    const keywordsIndex = rows.findIndex(row => row.includes('Palabra clave'));
    if (keywordsIndex >= 0) return parseKeywordConversions(sheet, name, rows, keywordsIndex, locale);
    const dailyIndex = rows.findIndex(row => row.includes('Día') && row.includes('Clics') && row.some(cell => cell === 'Costo' || cell === 'Coste'));
    if (dailyIndex >= 0) return parseDailyReport(sheet, name, rows, dailyIndex, locale);
    const headerIndex = rows.findIndex(row => row.includes('Estado de la campaña'));
    if (headerIndex < 0) return { skipped: `${name}: no parece un informe de campaña de Google Ads.` };
    const header = rows[headerIndex];
    const first = header[0];
    const kind = /^acci[oó]n de conversi[oó]n$/i.test(first) ? 'actions' : first === 'Estado de la campaña' ? 'period' : null;
    if (!kind) return { skipped: `${name}: informe segmentado por "${first}"; por ahora el tablero lee el informe del mes sin segmentar o por accion de conversion.` };
    const range = rows.slice(0, headerIndex).map(row => parseRange(row.find(cell => typeof cell === 'string' && cell) || '')).find(Boolean);
    if (!range) return { skipped: `${name}: no trae el rango de fechas en la cabecera.` };
    if (range.start.slice(0, 7) !== range.end.slice(0, 7)) return { skipped: `${name}: cubre varios meses (${range.start} a ${range.end}); sube un informe por mes.` };

    const col = names => names.map(label => header.indexOf(label)).find(index => index >= 0);
    const statusCol = header.indexOf('Estado de la campaña');
    const columns = Object.fromEntries(Object.entries(METRIC_COLUMNS).map(([metric, labels]) => [metric, col(labels)]));
    if (columns.cost === undefined || columns.conversions === undefined) return { skipped: `${name}: faltan las columnas de costo o conversiones.` };
    const metricsOf = row => Object.fromEntries(Object.entries(columns).map(([metric, index]) => [metric, index === undefined ? null : parseNumber(row[index], locale) ?? 0]));
    const body = rows.slice(headerIndex + 1);
    const accountRows = body.filter(row => row[statusCol] === 'Total: Cuenta');
    const hasLabel = row => kind === 'actions' && row[0] && row[0] !== '--';

    const accountRow = accountRows.find(row => !hasLabel(row));
    let totals = accountRow ? metricsOf(accountRow) : undefined;
    // Google Ads calcula el costo por conversion con las conversiones sin redondear (2.99 puede ser 2.9913).
    const cpaCol = col(['Costo/conv.', 'Coste/conv.']);
    if (totals && cpaCol !== undefined) totals.reportedCostPerConversion = parseNumber(accountRow[cpaCol], locale);
    if (!totals && kind === 'period') {
      // Sin fila de total: suma las filas por campaña.
      const campaignCol = header.indexOf('Campaña');
      totals = body.filter(row => row[campaignCol] && row[campaignCol] !== '--' && !String(row[statusCol]).startsWith('Total'))
        .map(metricsOf)
        .reduce((sum, item) => Object.fromEntries(Object.keys(item).map(key => [key, (sum[key] || 0) + (item[key] || 0)])), {});
    }
    // Presupuesto diario y estado de cada campaña en el periodo del informe.
    const campaignCol = header.indexOf('Campaña');
    const budgetCol = col(['Presupuesto']);
    const campaigns = {};
    body.forEach(row => {
      const campaign = campaignCol >= 0 ? clean(row[campaignCol]) : '';
      if (!campaign || campaign === '--' || String(row[statusCol]).startsWith('Total')) return;
      campaigns[campaign] = { name: campaign, status: clean(row[statusCol]), dailyBudget: budgetCol !== undefined ? parseNumber(row[budgetCol], locale) : null };
    });
    const report = { kind, name, file: sheet.file, modified: sheet.modified || '', month: range.start.slice(0, 7), start: range.start, end: range.end, totals: totals || null, campaigns: Object.values(campaigns) };
    if (kind === 'actions') {
      const actions = accountRows.filter(hasLabel).map(row => ({ name: row[0], conversions: metricsOf(row).conversions || 0 }));
      if (!actions.length) return { skipped: `${name}: no tiene filas por accion de conversion.` };
      actions.sort((a, b) => b.conversions - a.conversions);
      report.actions = { month: report.month, start: range.start, end: range.end, sourceFile: name, total: totals ? totals.conversions : actions.reduce((sum, a) => sum + a.conversions, 0), actions };
    }
    return { report };
  }

  // Informe por dia (p. ej. "Informe - Plataforma": Dia x anuncio x palabra clave de la busqueda). Da por dia,
  // campana y palabra clave el costo, los clics y las conversiones reales. Si no trae "Impr.", las impresiones se
  // aproximan con clics / CTR de cada fila: solo cuentan las filas con clics, asi que quedan como estimadas.
  function parseDailyReport(sheet, name, rows, headerIndex, locale) {
    const dates = preambleDates(rows, headerIndex);
    const header = rows[headerIndex];
    const at = (...labels) => labels.map(label => header.indexOf(label)).find(index => index >= 0) ?? -1;
    const cols = {
      day: at('Día'), campaign: at('Campaña'), status: at('Estado de la campaña'),
      keyword: at('Palabra clave de la Búsqueda', 'Palabra clave de la búsqueda', 'Palabra clave'), group: at('Grupo de anuncios'),
      cost: at('Costo', 'Coste'), clicks: at('Clics'), conversions: at('Conversiones'),
      impressions: at('Impr.', 'Impresiones'), ctr: at('CTR')
    };
    if (cols.cost < 0 || cols.clicks < 0 || cols.conversions < 0) return { skipped: `${name}: faltan las columnas de costo, clics o conversiones.` };
    const num = (row, key) => (cols[key] >= 0 ? parseNumber(row[cols[key]], locale) || 0 : 0);
    const exactImpressions = cols.impressions >= 0;
    const months = new Map();
    rows.slice(headerIndex + 1).forEach(row => {
      const day = clean(row[cols.day]);
      // Solo filas con fecha; las de "Total: ..." se ignoran.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
      if (cols.status >= 0 && clean(row[cols.status]).startsWith('Total')) return;
      const campaign = cols.campaign >= 0 ? clean(row[cols.campaign]) : '';
      if (campaign.startsWith('Total')) return;
      const clicks = num(row, 'clicks');
      const ctr = cols.ctr >= 0 ? parsePercent(row[cols.ctr], locale) : null;
      const impressions = exactImpressions ? num(row, 'impressions') : (clicks && ctr && Number.isFinite(ctr) ? clicks / ctr : 0);
      const values = { cost: num(row, 'cost'), clicks, conversions: num(row, 'conversions'), impressions };
      const monthId = day.slice(0, 7);
      if (!months.has(monthId)) months.set(monthId, { days: new Map(), campaigns: new Map(), keywords: new Map(), first: day, last: day });
      const month = months.get(monthId);
      if (day < month.first) month.first = day;
      if (day > month.last) month.last = day;
      const add = (map, key, extra) => {
        if (!map.has(key)) map.set(key, Object.assign({ cost: 0, clicks: 0, conversions: 0, impressions: 0 }, extra));
        const item = map.get(key);
        ['cost', 'clicks', 'conversions', 'impressions'].forEach(field => { item[field] += values[field]; });
      };
      add(month.days, `${day}|${campaign}`, { date: day, campaign });
      add(month.campaigns, campaign, { name: campaign });
      if (cols.keyword >= 0 && clean(row[cols.keyword]) && clean(row[cols.keyword]) !== '--') {
        const keyword = clean(row[cols.keyword]);
        add(month.keywords, `${campaign}|${keyword}`, { keyword, campaign, group: cols.group >= 0 ? clean(row[cols.group]) : '' });
      }
    });
    if (!months.size) return { skipped: `${name}: no tiene filas por día.` };
    const round = value => Math.round(value * 100) / 100;
    const items = [...months.entries()].map(([monthId, month]) => {
      // Rango del informe recortado al mes; sin rango en la cabecera, del primer al ultimo dia con filas.
      const [y, m] = monthId.split('-').map(Number);
      const lastOfMonth = `${monthId}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
      const start = dates.length >= 2 ? (dates[0] > `${monthId}-01` ? dates[0] : `${monthId}-01`) : month.first;
      const end = dates.length >= 2 ? (dates[1] < lastOfMonth ? dates[1] : lastOfMonth) : month.last;
      const campaigns = [...month.campaigns.values()].map(item => Object.assign(item, { cost: round(item.cost), impressions: Math.round(item.impressions) }));
      const totals = ['cost', 'clicks', 'conversions', 'impressions'].reduce((out, field) => Object.assign(out, { [field]: campaigns.reduce((sum, item) => sum + item[field], 0) }), {});
      totals.cost = round(totals.cost);
      totals.conversions = round(totals.conversions);
      return {
        month: monthId, start, end, totals, exactImpressions, campaigns,
        days: [...month.days.values()].sort((a, b) => a.date.localeCompare(b.date)),
        keywords: [...month.keywords.values()]
      };
    });
    return { report: { kind: 'daily', name, modified: sheet.modified || '', months: items } };
  }

  // "Estadisticas de los terminos de busqueda": categorias de busqueda de una semana contra la anterior.
  function parseSearchTerms(sheet, name, rows, headerIndex, locale) {
    const dates = preambleDates(rows, headerIndex);
    if (dates.length < 2) return { skipped: `${name}: no trae el rango de fechas en la cabecera.` };
    const header = rows[headerIndex];
    const at = label => header.indexOf(label);
    const cols = {
      category: at('Categoría de búsqueda'), sub: at('Subcategoría de búsqueda'),
      impressions: at('Impresiones'), impressionsChange: at('Impresiones (cambio porcentual)'),
      clicks: at('Clics'), clicksChange: at('Clics (cambio porcentual)'),
      conversions: at('Conversiones'), conversionsChange: at('Conversiones (cambio porcentual)'),
      ctr: at('CTR'), ctrChange: at('CTR (cambio porcentual)'),
      convRate: at('Porcentaje de conv.'), convRateChange: at('Porcentaje de conv. (cambio porcentual)'),
      volume: at('Volumen de búsquedas'), volumeChange: at('Volumen de búsquedas (cambio porcentual)')
    };
    const cell = (row, key) => (cols[key] >= 0 ? row[cols[key]] : null);
    const num = (row, key) => parseNumber(cell(row, key), locale);
    const pct = (row, key) => parsePercent(cell(row, key), locale);
    // Cada categoria trae su fila "Subcategoría - Total"; las subcategorias sueltas se ignoran.
    const categories = rows.slice(headerIndex + 1)
      .filter(row => cell(row, 'category') && (cols.sub < 0 || cell(row, 'sub') === 'Subcategoría - Total'))
      .map(row => {
        const volume = clean(cell(row, 'volume'));
        return {
          name: cell(row, 'category'),
          unclassified: /sin clasificar/i.test(cell(row, 'category')),
          impressions: num(row, 'impressions') || 0, impressionsChange: pct(row, 'impressionsChange'),
          clicks: num(row, 'clicks') || 0, clicksChange: pct(row, 'clicksChange'),
          conversions: num(row, 'conversions') || 0, conversionsChange: pct(row, 'conversionsChange'),
          ctr: pct(row, 'ctr'), ctrChange: pct(row, 'ctrChange'),
          convRate: pct(row, 'convRate'), convRateChange: pct(row, 'convRateChange'),
          volume: volume && volume !== '--' ? volume : null, volumeChange: pct(row, 'volumeChange')
        };
      });
    if (!categories.length) return { skipped: `${name}: no tiene categorias de busqueda.` };
    return { report: {
      kind: 'searchTerms', name, modified: sheet.modified || '', start: dates[0], end: dates[1],
      data: { start: dates[0], end: dates[1], compareStart: dates[2] || null, compareEnd: dates[3] || null, sourceFile: name, categories }
    } };
  }

  // "Informe de ubicaciones": conversiones (y, si no viene por accion, impresiones y costo) por ubicacion.
  function parseLocations(sheet, name, rows, headerIndex, locale) {
    const dates = preambleDates(rows, headerIndex);
    if (dates.length < 2) return { skipped: `${name}: no trae el rango de fechas en la cabecera.` };
    const header = rows[headerIndex];
    const at = (...labels) => labels.map(label => header.indexOf(label)).find(index => index >= 0) ?? -1;
    const cols = {
      action: at('Acción de conversión'), place: at('Ubicación'),
      impressions: at('Impr.', 'Impresiones'), interactions: at('Interacciones', 'Clics'),
      cost: at('Costo', 'Coste'), conversions: at('Conversiones')
    };
    const num = (row, key) => (cols[key] >= 0 ? parseNumber(row[cols[key]], locale) || 0 : 0);
    const metrics = row => ({ impressions: num(row, 'impressions'), interactions: num(row, 'interactions'), cost: num(row, 'cost'), conversions: num(row, 'conversions') });
    const places = new Map();
    let located = null;
    let account = null;
    rows.slice(headerIndex + 1).forEach(row => {
      const place = clean(row[cols.place]);
      const action = cols.action >= 0 ? clean(row[cols.action]) : '';
      if (!place) return;
      if (place.startsWith('Total')) {
        // Solo las filas de total sin accion traen impresiones y costo.
        if (action && action !== '--') return;
        if (place === 'Total: Ubicaciones') located = metrics(row);
        if (place === 'Total: Cuenta') account = metrics(row);
        return;
      }
      const item = places.get(place) || { name: place.split(',')[0].trim(), full: place, impressions: 0, interactions: 0, cost: 0, conversions: 0, actions: {} };
      const values = metrics(row);
      ['impressions', 'interactions', 'cost', 'conversions'].forEach(key => { item[key] += values[key]; });
      if (action && values.conversions) item.actions[action] = (item.actions[action] || 0) + values.conversions;
      places.set(place, item);
    });
    if (!places.size) return { skipped: `${name}: no tiene filas por ubicacion.` };
    const list = [...places.values()]
      .map(item => Object.assign(item, { actions: Object.entries(item.actions).map(([action, conversions]) => ({ name: action, conversions })).sort((a, b) => b.conversions - a.conversions) }))
      .sort((a, b) => b.conversions - a.conversions || b.impressions - a.impressions);
    return { report: {
      kind: 'locations', name, modified: sheet.modified || '', start: dates[0], end: dates[1],
      data: { start: dates[0], end: dates[1], sourceFile: name, byAction: cols.action >= 0, located, account, places: list }
    } };
  }

  // "Informe de palabras clave de busqueda": resultados por palabra clave. Si viene separado por
  // accion de conversion, Google Ads deja en 0 impresiones, clics y costo de cada palabra.
  const MATCH_TYPES = { 'Concordancia amplia': 'amplia', 'Concordancia de frase': 'frase', 'Concordancia exacta': 'exacta' };

  function parseKeywordConversions(sheet, name, rows, headerIndex, locale) {
    const dates = preambleDates(rows, headerIndex);
    if (dates.length < 2) return { skipped: `${name}: no trae el rango de fechas en la cabecera.` };
    const header = rows[headerIndex];
    const at = (...labels) => labels.map(label => header.indexOf(label)).find(index => index >= 0) ?? -1;
    const cols = {
      action: at('Acción de conversión'), status: at('Estado de palabras clave', 'Estado de las palabras clave'), keyword: at('Palabra clave'),
      match: at('Tipo de concordancia'), impressions: at('Impr.', 'Impresiones'), clicks: at('Clics'),
      cost: at('Costo', 'Coste'), conversions: at('Conversiones')
    };
    if (cols.conversions < 0) return { skipped: `${name}: falta la columna de conversiones.` };
    const num = (row, key) => (cols[key] >= 0 ? parseNumber(row[cols[key]], locale) || 0 : 0);
    const metrics = row => ({ impressions: num(row, 'impressions'), clicks: num(row, 'clicks'), cost: num(row, 'cost'), conversions: num(row, 'conversions') });
    const keywords = new Map();
    const actionTotals = {};
    let account = null;
    rows.slice(headerIndex + 1).forEach(row => {
      const status = cols.status >= 0 ? clean(row[cols.status]) : '';
      const action = cols.action >= 0 ? clean(row[cols.action]) : '';
      const raw = clean(row[cols.keyword]);
      if (status.startsWith('Total')) {
        const accountRow = status === 'Total: Cuenta' || (!account && /^Total: (Tus palabras clave|Palabras clave de tu cuenta)/.test(status));
        if (accountRow && (!action || action === '--')) account = metrics(row);
        return;
      }
      if (!raw || raw === '--') return;
      const match = MATCH_TYPES[clean(row[cols.match])] || clean(row[cols.match]).replace(/^Concordancia (de )?/i, '');
      const key = `${raw}|${match}`;
      // Frase y exacta llegan como "palabra" y [palabra]; el tipo ya va en su columna.
      const item = keywords.get(key) || { keyword: raw.replace(/^["[]+|["\]]+$/g, ''), match, paused: /detenid|pausad/i.test(status), impressions: 0, clicks: 0, cost: 0, conversions: 0, actions: {} };
      const values = metrics(row);
      ['impressions', 'clicks', 'cost', 'conversions'].forEach(metric => { item[metric] += values[metric]; });
      if (action && action !== '--' && values.conversions) {
        item.actions[action] = (item.actions[action] || 0) + values.conversions;
        actionTotals[action] = (actionTotals[action] || 0) + values.conversions;
      }
      keywords.set(key, item);
    });
    if (!keywords.size) return { skipped: `${name}: no tiene filas por palabra clave.` };
    const list = [...keywords.values()].sort((a, b) => b.conversions - a.conversions || b.impressions - a.impressions || a.keyword.localeCompare(b.keyword));
    return { report: {
      kind: 'keywordConversions', name, modified: sheet.modified || '', start: dates[0], end: dates[1],
      data: {
        start: dates[0], end: dates[1], sourceFile: name, byAction: cols.action >= 0, account,
        actions: Object.entries(actionTotals).sort((a, b) => b[1] - a[1]).map(([action]) => action),
        keywords: list
      }
    } };
  }

  // Totales del mes: manda el que llega mas lejos; a igual alcance, el que trae impresiones exactas (el informe
  // de campana del mes) sobre el informe por dia, y despues el editado al ultimo.
  const exactImpr = report => report.kind !== 'dailyMonth' || report.exactImpressions;
  function betterTotals(report, current) {
    if (!current || report.end !== current.end) return newer(report, current);
    if (exactImpr(report) !== exactImpr(current)) return exactImpr(report);
    return report.modified > current.modified;
  }

  // Por cada mes manda el informe que llegue mas lejos (y, si empatan, el editado al ultimo).
  const newer = (a, b) => !b || a.end > b.end || (a.end === b.end && a.modified > b.modified);

  function merge(base, payload) {
    const data = JSON.parse(JSON.stringify(base));
    const notes = [];
    const reports = [];
    (payload.sheets || []).forEach(sheet => {
      const result = parseSheet(sheet);
      if (result.skipped) notes.push(result.skipped);
      else reports.push(result.report);
    });

    const bestTotals = {};
    const bestActions = {};
    const latest = {};
    const keywordMonths = {};
    const dailyMonths = {};
    // Un informe por dia aporta un candidato por mes (con sus dias y palabras clave).
    reports.slice().forEach(report => {
      if (report.kind !== 'daily') return;
      report.months.forEach(item => {
        const candidate = Object.assign({ kind: 'dailyMonth', name: report.name, modified: report.modified }, item);
        if (newer(candidate, dailyMonths[item.month])) dailyMonths[item.month] = candidate;
      });
    });
    Object.values(dailyMonths).forEach(item => reports.push(item));
    reports.forEach(report => {
      if (report.kind === 'daily') return;
      // Palabras Clave: un informe por mes (si hay dos del mismo mes, manda el que llega mas lejos).
      if (report.kind === 'keywordConversions') {
        const month = report.start.slice(0, 7);
        if (newer(report, keywordMonths[month])) keywordMonths[month] = report;
        return;
      }
      // Segmentacion: se muestra el informe mas reciente de cada tipo.
      if (report.kind === 'searchTerms' || report.kind === 'locations') {
        if (newer(report, latest[report.kind])) latest[report.kind] = report;
        return;
      }
      if (report.totals && betterTotals(report, bestTotals[report.month])) bestTotals[report.month] = report;
      if (report.actions && newer(report, bestActions[report.month])) bestActions[report.month] = report;
    });

    data.months = data.months || [];
    const applied = [];
    Object.values(bestTotals).forEach(report => {
      let month = data.months.find(item => item.id === report.month);
      // Un informe mas corto que lo que ya tiene el repo no lo reemplaza.
      if (month && month.rangeEnd && report.end < month.rangeEnd) {
        notes.push(`${report.name}: llega al ${report.end} y el tablero ya tiene ${month.label} hasta el ${month.rangeEnd}; se deja el del repo.`);
        return;
      }
      if (!month) {
        const [y, m] = report.month.split('-').map(Number);
        month = { id: report.month, label: `${MONTH_LABELS[m - 1]} ${y}`, weeks: [], weekDays: 0, daysInMonth: new Date(Date.UTC(y, m, 0)).getUTCDate() };
        data.months.push(month);
        data.months.sort((a, b) => a.id.localeCompare(b.id));
      }
      // Todo el periodo suma lo mismo que los meses: se le agrega la diferencia del mes nuevo.
      if (data.totals) {
        ['cost', 'impressions', 'clicks', 'conversions'].forEach(metric => {
          data.totals[metric] = Math.round(((data.totals[metric] || 0) + (report.totals[metric] || 0) - (month[metric] || 0)) * 100) / 100;
        });
        withRates(data.totals);
      }
      const fromDaily = report.kind === 'dailyMonth';
      Object.assign(month, withRates({
        cost: report.totals.cost || 0,
        impressions: report.totals.impressions || 0,
        clicks: report.totals.clicks || 0,
        conversions: report.totals.conversions || 0
      }), {
        reportedCostPerConversion: Number.isFinite(report.totals.reportedCostPerConversion) && report.totals.reportedCostPerConversion > 0 ? report.totals.reportedCostPerConversion : null,
        source: 'Drive',
        sourceFile: report.name,
        // Del informe por dia sin "Impr.", las impresiones son aproximadas (clics / CTR).
        exact: !fromDaily || report.exactImpressions,
        exactMetrics: fromDaily && !report.exactImpressions ? ['cost', 'clicks', 'conversions'] : [],
        rangeStart: report.start,
        rangeEnd: report.end,
        daysWithData: daysBetween(report.start, report.end)
      });
      // El detalle por campaña del repo ya no cuadra con el total nuevo; el informe por dia trae el suyo.
      delete month.records;
      if (fromDaily) month.records = report.campaigns.map(item => withRates({ campaign: item.name, cost: item.cost, impressions: item.impressions, clicks: item.clicks, conversions: item.conversions }));
      applied.push(report.name);
      if (report.end > data.period.end) data.period.end = report.end;
    });

    // El presupuesto vigente es el del informe mas reciente (en setiembre paso de S/ 110 a S/ 112).
    const newest = Object.values(bestTotals).sort((a, b) => b.end.localeCompare(a.end))[0];
    if (newest && Array.isArray(data.campaigns)) {
      newest.campaigns.forEach(item => {
        const campaign = data.campaigns.find(entry => entry.name === item.name);
        if (!campaign) return;
        if (Number.isFinite(item.dailyBudget) && item.dailyBudget > 0) campaign.dailyBudget = item.dailyBudget;
        if (item.status) campaign.status = item.status;
      });
    }

    Object.values(bestTotals).forEach(report => {
      if (report.kind !== 'dailyMonth' || report.exactImpressions) return;
      const kw = keywordMonths[report.month];
      const account = kw && kw.data.account;
      if (!account || !(account.impressions > 0) || kw.start !== report.start || kw.end !== report.end) return;
      const month = data.months.find(item => item.id === report.month);
      if (!month || month.sourceFile !== report.name) return;
      if (data.totals) {
        data.totals.impressions = Math.round((data.totals.impressions || 0) + account.impressions - (month.impressions || 0));
        withRates(data.totals);
      }
      month.impressions = account.impressions;
      month.ctr = month.impressions ? Math.round(month.clicks / month.impressions * 1e6) / 1e6 : null;
      month.exact = true;
      month.exactMetrics = [];
      month.impressionsFrom = kw.name;
      // Con una sola campana, sus impresiones son las de la cuenta; con varias, el reparto sigue siendo aproximado.
      if (Array.isArray(month.records) && month.records.length === 1) month.records[0] = withRates(Object.assign({}, month.records[0], { impressions: account.impressions }));
      else month.campaignEstimated = ['impressions'];
    });

    const blocks = data.conversionActions || [];
    Object.values(bestActions).forEach(report => {
      const index = blocks.findIndex(block => block.month === report.month);
      if (index >= 0 && blocks[index].end > report.end) return;
      if (index >= 0) blocks[index] = report.actions; else blocks.push(report.actions);
      if (!applied.includes(report.name)) applied.push(report.name);
    });
    data.conversionActions = blocks.sort((a, b) => a.month.localeCompare(b.month));
    Object.values(latest).forEach(report => {
      const current = data[report.kind];
      if (current && current.end > report.end) return;
      data[report.kind] = report.data;
      applied.push(report.name);
    });
    // Serie por dia: la de la cuenta (data.days, la usan Proyecciones y el resto) y la de cada campana.
    const dayMap = new Map((data.days || []).map(day => [day.date, day]));
    const campaignDays = (data.campaignDays || []).slice();
    const keywordStats = (data.keywordStatsByMonth || []).slice();
    Object.values(dailyMonths).forEach(item => {
      const byDate = new Map();
      item.days.forEach(row => {
        const day = byDate.get(row.date) || { date: row.date, cost: 0, clicks: 0, conversions: 0, impressions: 0 };
        ['cost', 'clicks', 'conversions', 'impressions'].forEach(field => { day[field] += row[field]; });
        byDate.set(row.date, day);
      });
      byDate.forEach((day, date) => {
        const entry = Object.assign({}, dayMap.get(date) || { date }, { cost: Math.round(day.cost * 100) / 100, clicks: day.clicks, conversions: Math.round(day.conversions * 100) / 100 });
        if (item.exactImpressions) entry.impressions = day.impressions; else delete entry.impressions;
        dayMap.set(date, withRates(Object.assign({ impressions: entry.impressions || 0 }, entry)));
        if (!item.exactImpressions) delete dayMap.get(date).impressions;
      });
      for (let index = campaignDays.length - 1; index >= 0; index -= 1) if (campaignDays[index].date.startsWith(item.month)) campaignDays.splice(index, 1);
      item.days.forEach(row => campaignDays.push({ date: row.date, campaign: row.campaign, cost: Math.round(row.cost * 100) / 100, clicks: row.clicks, conversions: Math.round(row.conversions * 100) / 100, impressions: item.exactImpressions ? row.impressions : null }));
      const index = keywordStats.findIndex(block => block.month === item.month);
      const block = { month: item.month, start: item.start, end: item.end, sourceFile: item.name, exactImpressions: item.exactImpressions, keywords: item.keywords.map(row => ({ keyword: row.keyword, campaign: row.campaign, group: row.group, cost: Math.round(row.cost * 100) / 100, clicks: row.clicks, conversions: Math.round(row.conversions * 100) / 100, impressions: item.exactImpressions ? row.impressions : null })) };
      if (index >= 0) keywordStats[index] = block; else keywordStats.push(block);
      if (item.end > data.period.end) data.period.end = item.end;
      if (!applied.includes(item.name)) applied.push(item.name);
    });
    if (Object.keys(dailyMonths).length) {
      data.days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
      data.campaignDays = campaignDays.sort((a, b) => a.date.localeCompare(b.date));
      data.keywordStatsByMonth = keywordStats.sort((a, b) => a.month.localeCompare(b.month));
    }

    const byMonth = (data.keywordConversionsByMonth || []).slice();
    Object.entries(keywordMonths).forEach(([month, report]) => {
      const index = byMonth.findIndex(item => item.month === month);
      if (index >= 0 && byMonth[index].end > report.end) return;
      const block = Object.assign({ month }, report.data);
      if (index >= 0) byMonth[index] = block; else byMonth.push(block);
      applied.push(report.name);
    });
    if (byMonth.length) {
      data.keywordConversionsByMonth = byMonth.sort((a, b) => a.month.localeCompare(b.month));
      data.keywordConversions = data.keywordConversionsByMonth[data.keywordConversionsByMonth.length - 1];
    }
    if (data.months.length) data.defaultMonth = data.months[data.months.length - 1].id;
    data.drive = {
      folders: payload.folders || {},
      syncedAt: payload.generatedAt || new Date().toISOString(),
      // automatico (10:00 diario), manual (boton), inicial, instalacion o prueba; vacio en la copia local.
      origin: payload.origin || (payload.snapshot ? 'copia' : ''),
      schedule: payload.schedule || null,
      applied,
      notes
    };
    return data;
  }

  // fresh: true pide un barrido en el momento (boton); si no, el ultimo barrido (el de las 10:00).
  async function fetchFolder(options = {}) {
    if (!DRIVE_SYNC_URL) throw new Error('Falta conectar la carpeta de Drive (ver README > Sincronizacion con Drive).');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${DRIVE_SYNC_URL}?${options.fresh ? 'fresh=1&' : ''}t=${Date.now()}`, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`Drive respondio HTTP ${response.status}.`);
      const payload = await response.json();
      if (payload && payload.ok === false && payload.error) throw new Error(payload.error);
      if (!payload || !payload.ok || !Array.isArray(payload.sheets)) throw new Error('La respuesta de Drive no tiene el formato esperado.');
      return payload;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Drive tardo demasiado en responder.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  window.TierraFilmsDrive = { configured: Boolean(DRIVE_SYNC_URL), folderUrls: FOLDER_URLS, fetchFolder, merge, parseSheet };
})();
