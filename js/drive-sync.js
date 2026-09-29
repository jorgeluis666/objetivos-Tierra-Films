(function () {
  // URL /exec de la aplicacion web de Apps Script (apps-script/drive-sync.gs).
  // Vacia: el tablero usa solo la data del repo y el boton avisa que falta la conexion.
  const DRIVE_SYNC_URL = '';
  const DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1Zz5WjNFy0H37n0trSjhVx90NgPmqkyrO';
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

  // Las hojas traen numeros de verdad; los CSV, texto es-PE ("2461,69", "1.247", "8,34%").
  function parseNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const text = clean(value).replace(/[A-Za-z$€%\s]/g, '');
    if (!text || text === '--') return null;
    const number = Number(text.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(number) ? number : null;
  }

  function parseRange(text) {
    const found = [...clean(text).toLowerCase().matchAll(/(\d{1,2}) de ([a-záéíóú]+) de (\d{4})/g)];
    if (found.length !== 2) return null;
    const dates = found.map(([, d, m, y]) => (MONTHS[m] ? `${y}-${String(MONTHS[m]).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null));
    return dates.every(Boolean) ? { start: dates[0], end: dates[1] } : null;
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
    const name = sheet.sheet && sheet.sheet !== sheet.file ? `${sheet.file} > ${sheet.sheet}` : sheet.file;
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
    const metricsOf = row => Object.fromEntries(Object.entries(columns).map(([metric, index]) => [metric, index === undefined ? null : parseNumber(row[index]) ?? 0]));
    const body = rows.slice(headerIndex + 1);
    const accountRows = body.filter(row => row[statusCol] === 'Total: Cuenta');
    const hasLabel = row => kind === 'actions' && row[0] && row[0] !== '--';

    let totals = accountRows.filter(row => !hasLabel(row)).map(metricsOf)[0];
    if (!totals && kind === 'period') {
      // Sin fila de total: suma las filas por campaña.
      const campaignCol = header.indexOf('Campaña');
      totals = body.filter(row => row[campaignCol] && row[campaignCol] !== '--' && !String(row[statusCol]).startsWith('Total'))
        .map(metricsOf)
        .reduce((sum, item) => Object.fromEntries(Object.keys(item).map(key => [key, (sum[key] || 0) + (item[key] || 0)])), {});
    }
    const report = { kind, name, file: sheet.file, modified: sheet.modified || '', month: range.start.slice(0, 7), start: range.start, end: range.end, totals: totals || null };
    if (kind === 'actions') {
      const actions = accountRows.filter(hasLabel).map(row => ({ name: row[0], conversions: metricsOf(row).conversions || 0 }));
      if (!actions.length) return { skipped: `${name}: no tiene filas por accion de conversion.` };
      actions.sort((a, b) => b.conversions - a.conversions);
      report.actions = { month: report.month, start: range.start, end: range.end, sourceFile: name, total: totals ? totals.conversions : actions.reduce((sum, a) => sum + a.conversions, 0), actions };
    }
    return { report };
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
    reports.forEach(report => {
      if (report.totals && newer(report, bestTotals[report.month])) bestTotals[report.month] = report;
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
      Object.assign(month, withRates({
        cost: report.totals.cost || 0,
        impressions: report.totals.impressions || 0,
        clicks: report.totals.clicks || 0,
        conversions: report.totals.conversions || 0
      }), {
        source: 'Drive',
        sourceFile: report.name,
        exact: true,
        exactMetrics: [],
        rangeStart: report.start,
        rangeEnd: report.end,
        daysWithData: daysBetween(report.start, report.end)
      });
      // El detalle por campaña del repo ya no cuadra con el total nuevo.
      delete month.records;
      applied.push(report.name);
      if (report.end > data.period.end) data.period.end = report.end;
    });

    const blocks = data.conversionActions || [];
    Object.values(bestActions).forEach(report => {
      const index = blocks.findIndex(block => block.month === report.month);
      if (index >= 0 && blocks[index].end > report.end) return;
      if (index >= 0) blocks[index] = report.actions; else blocks.push(report.actions);
      if (!applied.includes(report.name)) applied.push(report.name);
    });
    data.conversionActions = blocks.sort((a, b) => a.month.localeCompare(b.month));
    if (data.months.length) data.defaultMonth = data.months[data.months.length - 1].id;
    data.drive = { folder: payload.folder || '', syncedAt: payload.generatedAt || new Date().toISOString(), applied, notes };
    return data;
  }

  async function fetchFolder() {
    if (!DRIVE_SYNC_URL) throw new Error('Falta conectar la carpeta de Drive (ver README > Sincronizacion con Drive).');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${DRIVE_SYNC_URL}?t=${Date.now()}`, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`Drive respondio HTTP ${response.status}.`);
      const payload = await response.json();
      if (!payload || !payload.ok || !Array.isArray(payload.sheets)) throw new Error('La respuesta de Drive no tiene el formato esperado.');
      return payload;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Drive tardo demasiado en responder.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  window.TierraFilmsDrive = { configured: Boolean(DRIVE_SYNC_URL), folderUrl: DRIVE_FOLDER_URL, fetchFolder, merge, parseSheet };
})();
