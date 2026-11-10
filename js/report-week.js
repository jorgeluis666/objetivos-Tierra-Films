(function () {
  // Generacion de Reporte: el PDF de publicidad con el diseño del "Modelo Reporte Tierra Films" (noviembre
  // 2026): siete laminas 16:9 con portada, contenido, resumen de leads (KPIs, clics y leads por dia o por
  // bloque de 5 dias y acciones de conversion), palabras clave (termino lider, leads por palabra y tabla con el
  // nivel de calidad), anuncio y calidad, conclusiones con proximos pasos y cierre.
  //
  // Hay tres tipos de reporte:
  // - Semanal: de lunes a domingo, siempre siete dias, numeradas Semana 1, Semana 2... en cada mes. La que
  //   cruza de mes cuenta para el mes donde cae la mayoria de sus dias (28 set - 4 oct es la semana 1 de
  //   octubre). La ultima cerrada por defecto; la que esta en curso se compara con los mismos dias de la anterior.
  // - Acumulado del mes: del 1 a cada domingo del mes (1-4, 1-11, 1-18, 1-25), solo cortes cerrados. Se compara
  //   con el mismo tramo del mes anterior.
  // - Mensual: el mes completo, solo meses cerrados, contra todo el mes anterior.
  // No trae datos nuevos: los totales salen de la serie por dia de Gasto Publicitario (window.TierraFilmsDays)
  // o, si en ese tramo la serie viene repartida, del informe mensual o de la misma semana del informe semanal
  // de campana o de palabras clave cuando su costo cuadra; las palabras clave, del informe por dia de Drive
  // (data.keywordDays), del informe semanal de palabras clave o del informe mensual de palabras clave (con su
  // propio rango si no cubre justo el periodo); el nivel de calidad, del informe de palabras clave. Cada
  // sincronizacion con Drive lo actualiza solo.
  //
  // Lo que Google Ads no manda al tablero se completa sobre la lamina: el anuncio y su eficacia (se guardan una
  // vez para todos los periodos). Formularios y WhatsApp no se escriben a mano: salen del informe por accion de
  // conversion o, sin el, la lamina muestra las conversiones del periodo. Subtitulos, destacados, analisis,
  // conclusiones y proximos pasos vienen propuestos con lo que dicen los numeros; el equipo los reescribe sobre la lamina y quedan guardados
  // por periodo en la hoja privada del CRM, asi todo el equipo ve lo mismo (ver "Textos guardados").
  //
  // El template es propio de Tierra Films: cada tablero de marca tiene el suyo, adaptado por la marca.
  const BRAND = 'Tierra Films';
  // v3: las laminas del modelo de noviembre 2026 tienen otros textos que los del modelo anterior (v2).
  const NOTES_KEY = 'tierra_films_report_notes_v3';
  const GLOBAL_NOTES = '_global';
  const MAX_KEYWORDS = 6;
  const MAX_BARS = 4;
  const MAX_QUALITY = 6;
  const PAGE_WIDTH = 1280;
  const TOTAL_PAGES = 9;
  const LOGO = 'assets/logo-lima-retail.png';
  const AGENCY_LINE = 'Lima Retail · Data Driven Marketing · Power KPI · Digital Analytics';
  const CHANNEL = 'Google Ads';
  const CLICKS_COLOR = '#2563eb';
  const LEADS_COLOR = '#0f172a';
  const BAND_COLOR = '#eef4ff';
  const SEARCH_PITCH = 'Campaña de búsqueda enfocada en captar empresas que buscan una productora audiovisual.';
  const CRM_NOTE = 'Los datos de CRM referencial no estuvieron disponibles este periodo; los leads mostrados son los registrados por Google Ads (formulario y clics a WhatsApp).';

  // El anuncio responsivo activo, como esta en el modelo (octubre 2026). Google Ads no lo manda al tablero: se
  // corrige sobre la lamina y queda para todos los periodos (las claves "ad:" se guardan aparte).
  const AD_DEFAULTS = {
    'ad:url': 'tierrafilms.pe/productora-audiovisual',
    'ad:titulo': 'Productora Audiovisual · Videos Corporativos y Spots | Tierra Films',
    'ad:desc': 'Productora audiovisual con enfoque en resultados: videos institucionales, corporativos y spots publicitarios que venden. Conectamos tu marca con tu público. ¡Contáctanos hoy!',
    'ad:link:0': 'Producción Audiovisual',
    'ad:link:1': 'Videos Publicitarios',
    'ad:link:2': 'Videos Institucionales',
    'ad:link:3': 'Impacta a tu Audiencia',
    'ad:eficacia': 'Excelente',
    'ad:eficacia-texto': 'Los 4 anuncios activos tienen la máxima calificación de Google — títulos y descripciones variados y relevantes.',
  };
  const AD_LINKS = 4;

  // Iconos de linea (24x24) del modelo.
  const ICONS = {
    bars: '<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    flag: '<path d="M4 22V4"/><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1"/>',
    star: '<path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"/>',
    chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>',
    bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    form: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.bars}</svg>`;

  // El periodo elegido se recuerda por tipo: al volver de "Acumulado del mes" sigue la misma semana.
  const state = { type: 'semana', selected: { semana: '', avance: '', mes: '' }, wired: false };

  const G = () => window.TierraFilmsGasto;
  const F = () => window.TierraFilmsFormat;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const isNum = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

  // ── Formatos del modelo ("S/ 1,767", "S/ 6.24", "10.07%", "11.3%", "+24%") ─
  const integer = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 });
  const money = value => (isNum(value) ? `S/ ${integer.format(Math.round(value))}` : '—');
  const money2 = value => (isNum(value) ? `S/ ${Number(value).toFixed(2)}` : '—');
  const count = value => (isNum(value) ? integer.format(Math.round(value)) : '—');
  const percent = value => (isNum(value) ? `${(Number(value) * 100).toFixed(2).replace(/\.?0+$/, '')}%` : '—');
  const percent1 = value => (isNum(value) ? `${(Number(value) * 100).toFixed(1)}%` : '—');
  const change = (current, previous) => (isNum(current) && isNum(previous) && Number(previous) !== 0 ? (Number(current) - Number(previous)) / Number(previous) : null);
  const pct0 = value => `${value >= 0 ? '+' : '-'}${Math.abs(Math.round(value * 100))}%`;
  const pageNumber = value => String(value).padStart(2, '0');
  const list = items => (items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : items[0] || '');
  const quoted = items => list(items.map(item => `"${item}"`));
  const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);
  const shorten = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}.` : text);
  const leadsWord = value => (Math.round(value) === 1 ? 'lead' : 'leads');

  // ── El periodo del reporte (semana, acumulado del mes o mes) ───────────
  const DAY_MS = 86400000;
  const SUMS = ['cost', 'impressions', 'clicks', 'conversions'];
  const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const WEEKDAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const addDays = (iso, days) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
  const spanDays = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
  const weekdayOf = iso => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
  const dayOf = iso => Number(iso.slice(8, 10));
  const monthName = iso => F().MONTH_NAMES[Number(iso.slice(5, 7)) - 1].toLowerCase();
  const monthEnd = iso => `${iso.slice(0, 7)}-${String(new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0')}`;
  const nextMonth = key => addDays(monthEnd(`${key}-01`), 1).slice(0, 7);
  const previousMonth = key => addDays(`${key}-01`, -1).slice(0, 7);
  const data = () => window.TIERRA_FILMS_RETAIL_DATA || {};
  const seriesDays = () => (Array.isArray(window.TierraFilmsDays) ? window.TierraFilmsDays : []).filter(day => isNum(day.cost));
  const daysIn = (from, to) => seriesDays().filter(day => day.date >= from && day.date <= to);

  // "12 – 18 de octubre 2026", "1 de noviembre 2026" (un dia) o, si cruza de mes, "28 de setiembre – 4 de
  // octubre 2026" (short: "28 set – 4 oct 2026"; sin año: "28 set – 4 oct").
  function rangeText(from, to, short = false, withYear = true) {
    const name = iso => (short ? monthName(iso).slice(0, 3) : monthName(iso));
    const of = short ? ' ' : ' de ';
    const year = iso => iso.slice(0, 4);
    const end = `${dayOf(to)}${of}${name(to)}${withYear ? ` ${year(to)}` : ''}`;
    if (from === to) return end;
    const start = from.slice(0, 7) === to.slice(0, 7) ? `${dayOf(from)}` : `${dayOf(from)}${of}${name(from)}${year(from) === year(to) || !withYear ? '' : ` ${year(from)}`}`;
    return `${start} – ${end}`;
  }

  // "1 – 25 de octubre de 2026", como en la nota del periodo del modelo.
  const longRange = (from, to) => rangeText(from, to).replace(/ (\d{4})$/, ' de $1');
  const dayName = iso => `${WEEKDAY_NAMES[weekdayOf(iso)]} ${dayOf(iso)}`;
  const monthTitle = iso => `${capitalize(monthName(iso))} ${iso.slice(0, 4)}`;

  // Semanas de un mes, de lunes a domingo. Cada una cuenta para el mes de su jueves, que es donde cae la
  // mayoria de sus dias: octubre 2026 va del 28 set al 1 nov (5 semanas) y noviembre, del 2 al 29 (4).
  function monthWeeks(key) {
    const first = `${key}-01`;
    const list = [];
    for (let start = addDays(first, ((3 - weekdayOf(first) + 7) % 7) - 3); addDays(start, 3).slice(0, 7) === key; start = addDays(start, 7)) {
      list.push({ number: list.length + 1, start, end: addDays(start, 6) });
    }
    return list;
  }

  // Los domingos de un mes: los cortes del acumulado.
  function monthSundays(key) {
    const first = `${key}-01`;
    const last = monthEnd(first);
    const list = [];
    for (let sunday = addDays(first, 6 - weekdayOf(first)); sunday <= last; sunday = addDays(sunday, 7)) list.push(sunday);
    return list;
  }

  // Una semana del mes key. to es el ultimo dia con datos (en la semana en curso, antes de end).
  function weekItem(week, key, from, to, closed) {
    const chip = rangeText(from, to, true);
    const days = spanDays(from, to);
    const name = `Semana ${week.number}`;
    const title = monthTitle(`${key}-01`);
    return {
      type: 'semana',
      // El lunes de la semana (o el primer dia con datos).
      id: from,
      month: key,
      from,
      to,
      closed,
      previous: { from: addDays(from, -7), to: addDays(to, -7) },
      option: `${name} · ${rangeText(from, week.end, true, false)}${closed ? '' : ' (en curso)'}`,
      labels: {
        cover: `${title} · ${name} · ${rangeText(from, to, true, false)}${closed ? '' : ' (en curso)'}`,
        chip,
        source: `Fuente: Google Ads · ${chip}`,
        analysisSource: `Fuente: análisis Lima Retail sobre Google Ads · ${BRAND} · ${name.toLowerCase()} de ${monthName(`${key}-01`)} ${key.slice(0, 4)}`,
        footer: `${BRAND} · Reporte Google Ads · ${title} · ${name}`,
        vsBadge: closed && days === 7 ? 'vs sem. ant.' : 'vs mismos días',
        closing: 'El cierre de la semana',
        opening: 'El inicio de la semana',
        conclusionsSub: 'Qué funcionó en la semana y qué se hará en la próxima.',
        periodLong: longRange(from, to),
        next: 'la próxima semana',
        period: 'esta semana',
        note: closed ? '' : `Semana en curso: las métricas se consolidan al cierre, el ${dayName(week.end)}.`,
        file: `Semana_${from}_al_${to}`,
      },
    };
  }

  // Acumulado del mes: del 1 a un domingo (o el mes completo). Se compara con los mismos dias del mes anterior
  // (1-18 oct contra 1-18 set); el mes completo, con todo el mes anterior.
  function progressItem(from, to) {
    const chip = rangeText(from, to, true);
    const whole = to === monthEnd(to);
    const month = monthName(from);
    const title = monthTitle(from);
    const before = previousMonth(from.slice(0, 7));
    const beforeEnd = monthEnd(`${before}-01`);
    const clip = day => (`${before}-${day}` < beforeEnd ? `${before}-${day}` : beforeEnd);
    const previous = { from: clip(from.slice(8)), to: whole ? beforeEnd : clip(to.slice(8)) };
    return {
      type: 'avance',
      id: `avance:${to}`,
      month: from.slice(0, 7),
      from,
      to,
      closed: true,
      previous,
      option: whole ? `Mes completo · ${rangeText(from, to, true, false)}` : `Al domingo ${dayOf(to)} · ${rangeText(from, to, true, false)}`,
      labels: {
        cover: `${title} · ${whole ? 'Mes completo' : `Periodo ${rangeText(from, to, true, false)}`}`,
        chip,
        source: `Fuente: Google Ads · ${chip}`,
        analysisSource: `Fuente: análisis Lima Retail sobre Google Ads · ${BRAND} · ${month} ${from.slice(0, 4)}`,
        footer: `${BRAND} · Reporte Google Ads · ${title}`,
        vsBadge: 'vs mes previo',
        closing: 'El cierre del mes',
        opening: 'El inicio del mes',
        conclusionsSub: whole
          ? `Qué funcionó en ${month} y qué se hará en ${monthName(`${nextMonth(from.slice(0, 7))}-01`)}.`
          : `Qué funcionó en ${month} y qué se hará en las próximas semanas.`,
        periodLong: longRange(from, to),
        next: whole ? 'el próximo mes' : 'lo que queda del mes',
        period: whole ? 'este mes' : 'este período',
        note: '',
        file: whole ? `Mes_${from.slice(0, 7)}` : `Avance_${from}_al_${to}`,
      },
    };
  }

  // Mensual: el mes completo. Guarda sus textos con la misma clave que el corte del acumulado al ultimo dia del
  // mes, que es como se guardaba el "Mes completo" antes de tener tipo propio.
  function monthItem(from, to) {
    return Object.assign(progressItem(from, to), { type: 'mes', option: `Mes completo · ${rangeText(from, to, true, false)}` });
  }

  // Los periodos con datos, del mas reciente al mas antiguo. Semanal: las semanas de cada mes (la ultima puede
  // estar en curso). Acumulado del mes: un corte por domingo cerrado, siempre desde el 1. Mensual: los meses cerrados.
  // Solo los que la plataforma llena completos (ver complete).
  function periods(type) {
    return allPeriods(type).filter(complete);
  }

  // Un periodo entra si Google Ads da en la plataforma su inversion, clics, leads e impresiones y su serie de
  // clics y leads por dia: asi la lamina de resumen no queda con datos ni recuadros vacios. Quedan fuera, por
  // ejemplo, las semanas de junio (solo traen el costo diario) y los cortes de junio y julio sin clics por dia.
  function complete(item) {
    const totals = rangeTotals(item.from, item.to);
    return Boolean(totals) && SUMS.every(field => isNum(totals[field])) && dailySeries(item).length > 0;
  }

  function allPeriods(type) {
    const days = seriesDays();
    if (!days.length) return [];
    const first = days[0].date;
    const last = days[days.length - 1].date;
    const list = [];
    if (type === 'semana') {
      // Desde el mes anterior y hasta el siguiente: la semana del primer o del ultimo dato puede contar para ellos.
      for (let key = previousMonth(first.slice(0, 7)); key <= nextMonth(last.slice(0, 7)); key = nextMonth(key)) {
        monthWeeks(key).filter(week => week.end >= first && week.start <= last).forEach(week => {
          const closed = week.end <= last;
          list.push(weekItem(week, key, week.start < first ? first : week.start, closed ? week.end : last, closed));
        });
      }
      return list.reverse();
    }
    for (let key = first.slice(0, 7); key <= last.slice(0, 7); key = nextMonth(key)) {
      const start = `${key}-01` < first ? first : `${key}-01`;
      const end = monthEnd(start);
      if (type === 'mes') {
        if (end <= last) list.push(monthItem(start, end));
      } else {
        monthSundays(key).filter(sunday => sunday >= start && sunday <= last).forEach(sunday => list.push(progressItem(start, sunday)));
      }
    }
    return list.reverse();
  }

  const ratio = (a, b) => (isNum(a) && isNum(b) && Number(b) !== 0 ? Number(a) / Number(b) : null);
  const derive = totals => Object.assign(totals, {
    ctr: ratio(totals.clicks, totals.impressions),
    cpc: ratio(totals.cost, totals.clicks),
    costPerConversion: ratio(totals.cost, totals.conversions),
    conversionRate: ratio(totals.conversions, totals.clicks),
  });

  // Totales de un tramo de dias. Una semana del informe semanal de campana de Drive (el total de la cuenta, con
  // todas las campanas) manda tal cual, tambien si es la semana en curso. Si no, cada suma sale de los dias
  // cuando todos la traen real (el costo diario lo es siempre); si no, en el mes completo, del total de su
  // informe mensual; si no, del total de esa misma semana en el informe semanal del repo o en el de palabras
  // clave, solo si su costo cuadra con el costo diario (hay semanas que esos informes traen incompletas). Si no
  // hay de donde, la suma queda vacia: no se reparte nada.
  function rangeTotals(from, to) {
    const days = daysIn(from, to);
    if (!days.length) return null;
    const source = data();
    const drive = (source.weeks || []).find(week => week.source === 'Drive' && (week.dataStart || week.start) === from && (week.dataEnd || week.end) === to);
    if (drive) return derive(Object.fromEntries(SUMS.map(field => [field, isNum(drive[field]) ? Number(drive[field]) : null])));
    const full = days.length === spanDays(from, to);
    const dayCost = days.reduce((acc, day) => acc + Number(day.cost), 0);
    const fits = week => week && week.start === from && week.end === to && isNum(week.cost) && Math.abs(week.cost - dayCost) <= Math.max(1, dayCost * 0.01);
    const weeks = [(source.weeks || []).find(fits), ((source.keywords && source.keywords.weeks) || []).find(fits)].filter(Boolean);
    const month = dayOf(from) === 1 && to === monthEnd(from) ? G().months().find(item => item.key === from.slice(0, 7)) : null;
    const monthly = field => Boolean(month && month.totals && isNum(month.totals[field]) && !(month.estimated || []).includes(field));
    const totals = {};
    SUMS.forEach(field => {
      const values = days.map(day => day[field]);
      const real = full && values.every(isNum) && days.every(day => !(day.estimated && day.estimated[field]));
      const week = weeks.find(item => isNum(item[field]));
      totals[field] = real ? values.reduce((acc, value) => acc + Number(value), 0) : monthly(field) ? Number(month.totals[field]) : week ? Number(week[field]) : null;
    });
    return derive(totals);
  }

  // Serie por dia del periodo: la del modulo Gasto Publicitario (clics y conversiones reales donde el export
  // por dia los trae; si no, repartidos desde la semana). Los dias sin clics ni conversiones (junio solo trae
  // el costo diario) no entran.
  function dailySeries(item) {
    return daysIn(item.from, item.to).filter(day => isNum(day.clicks) && isNum(day.conversions));
  }

  // Clics y leads del grafico: por dia si el periodo tiene hasta 10 dias; si no, por bloques de 5 dias desde el
  // primero (un resto de 1 o 2 dias va con el bloque anterior: 1-31 termina en 26-31).
  function trendBuckets(item, rows) {
    const point = (from, to, label) => {
      const days = rows.filter(day => day.date >= from && day.date <= to);
      return { from, to, label, clicks: days.reduce((sum, day) => sum + Number(day.clicks), 0), leads: days.reduce((sum, day) => sum + Number(day.conversions), 0) };
    };
    if (!rows.length) return { by: 'day', items: [] };
    if (spanDays(item.from, item.to) <= 10) {
      return { by: 'day', items: rows.map(day => point(day.date, day.date, `${WEEKDAYS[weekdayOf(day.date)]} ${dayOf(day.date)}`)) };
    }
    const items = [];
    for (let start = item.from; start <= item.to;) {
      let end = addDays(start, 4);
      if (end >= item.to || spanDays(end, item.to) - 1 < 3) end = item.to;
      items.push(point(start, end, `${dayOf(start)}–${dayOf(end)}`));
      start = addDays(end, 1);
    }
    return { by: 'block', items };
  }

  const plainKeyword = text => String(text || '').replace(/^["[]+|["\]]+$/g, '').trim();

  // Palabras clave del periodo, de mas a menos leads. Solo las que tuvieron actividad. Salen del informe por dia
  // de Drive si cubre todos los dias (costo, clics y conversiones por termino), del informe semanal de palabras
  // clave del repo o del informe mensual de palabras clave de Drive si su rango es justo el periodo. Si nada
  // cubre el periodo, va el informe mensual del mes con su propio rango (Google Ads entrega las palabras clave
  // por mes) y la lamina lo dice.
  function keywords(item) {
    const source = data();
    const covered = iso => (source.keywordStatsByMonth || []).some(block => iso >= block.start && iso <= block.end);
    const dates = Array.from({ length: spanDays(item.from, item.to) }, (_, index) => addDays(item.from, index));
    let rows = [];
    let kind = null;
    let hasImpressions = false;
    let hasMetrics = true;
    let range = { from: item.from, to: item.to };
    const daily = (source.keywordDays || []).filter(row => row.date >= item.from && row.date <= item.to);
    const weekly = ((source.keywords && source.keywords.weeks) || []).find(week => week.start === item.from && week.end === item.to);
    const monthlyBlocks = (source.keywordConversionsByMonth || []).filter(block => (block.keywords || []).length);
    const monthly = monthlyBlocks.find(block => block.start === item.from && block.end === item.to);
    const ofMonth = monthlyBlocks.find(block => block.month === item.month);
    if (daily.length && dates.every(covered)) {
      kind = 'daily';
      hasImpressions = daily.every(row => isNum(row.impressions));
      rows = daily;
    } else if (weekly) {
      kind = 'weekly';
      hasImpressions = true;
      rows = weekly.rows || [];
    } else if (monthly || ofMonth) {
      const block = monthly || ofMonth;
      kind = monthly ? 'monthly' : 'month';
      // Separado por accion de conversion, Google Ads deja en 0 impresiones, clics y costo de cada palabra.
      hasMetrics = !block.byAction;
      hasImpressions = hasMetrics && block.keywords.every(row => isNum(row.impressions));
      rows = block.keywords;
      range = { from: block.start, to: block.end };
    }
    // La misma palabra con dos concordancias (amplia y frase) o en dos campanas va en una sola fila, como la lee el cliente.
    const byName = new Map();
    rows.forEach(row => {
      const keyword = plainKeyword(row.keyword);
      const name = keyword.toLowerCase();
      if (!byName.has(name)) byName.set(name, { keyword, conversions: 0, cost: 0, clicks: 0, impressions: hasImpressions ? 0 : null });
      const entry = byName.get(name);
      ['conversions', 'cost', 'clicks', 'impressions'].forEach(field => {
        if (isNum(row[field]) && isNum(entry[field])) entry[field] += Number(row[field]);
      });
    });
    // De mas a menos leads; a iguales leads, el de menor costo por lead; sin leads, el de mas clics.
    const cpl = row => (row.conversions > 0 && row.cost > 0 ? row.cost / row.conversions : Infinity);
    const list = [...byName.values()]
      .map(row => Object.assign(row, {
        ctr: ratio(row.clicks, row.impressions),
        costPerConversion: Number(row.conversions) > 0 && Number(row.cost) > 0 ? row.cost / row.conversions : null,
      }))
      .filter(row => Number(row.conversions) > 0 || Number(row.cost) > 0 || Number(row.clicks) > 0)
      .sort((left, right) => Math.round(right.conversions || 0) - Math.round(left.conversions || 0) || cpl(left) - cpl(right) || (right.clicks || 0) - (left.clicks || 0));
    const sum = field => list.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);
    const totals = derive({ cost: sum('cost'), clicks: sum('clicks'), conversions: sum('conversions'), impressions: hasImpressions ? sum('impressions') : null });
    // raw: las filas como llegan del informe (una por palabra y conjunto de anuncios), para la lamina de conjuntos.
    return { rows: list, raw: rows, total: totals.conversions, totals, hasMetrics: Boolean(kind) && hasMetrics, hasImpressions, source: kind, range, exact: kind !== 'month' };
  }

  // ── Campanas y conjuntos de anuncios del periodo ───────────────────────
  // Campanas: del informe por dia de cada campana (el que alimenta Gasto Publicitario). Si el mes no lo tiene,
  // de la semana del informe semanal que cubre justo el periodo. Sin ninguno, solo los nombres.
  function campaignStats(item) {
    const source = data();
    const days = (source.campaignDays || []).filter(row => row.date >= item.from && row.date <= item.to);
    const week = (source.weeks || []).find(entry => (entry.dataStart || entry.start) === item.from && (entry.dataEnd || entry.end) === item.to && (entry.campaigns || []).length);
    const rows = days.length ? days : week ? week.campaigns : [];
    const kind = days.length ? 'daily' : week ? 'weekly' : null;
    const hasImpressions = rows.length > 0 && rows.every(row => isNum(row.impressions));
    const byName = new Map();
    rows.forEach(row => {
      const name = String(row.campaign || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!byName.has(key)) byName.set(key, { campaign: name, cost: 0, clicks: 0, conversions: 0, impressions: hasImpressions ? 0 : null });
      const entry = byName.get(key);
      ['cost', 'clicks', 'conversions', 'impressions'].forEach(field => {
        if (isNum(row[field]) && isNum(entry[field])) entry[field] += Number(row[field]);
      });
    });
    const list = [...byName.values()].map(row => derive(row))
      .filter(row => Number(row.cost) > 0 || Number(row.clicks) > 0 || Number(row.conversions) > 0)
      .sort((left, right) => (right.cost || 0) - (left.cost || 0) || (right.conversions || 0) - (left.conversions || 0));
    const sum = field => list.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);
    const totals = derive({ cost: sum('cost'), clicks: sum('clicks'), conversions: sum('conversions'), impressions: hasImpressions ? sum('impressions') : null });
    return { rows: list, totals, kind, hasImpressions };
  }

  // Tramos del periodo para la tabla de Campanas: por dia hasta 10 dias y, si no, por bloques de 5 dias
  // (la misma regla del grafico del resumen). Cada tramo suma los dias de la campana.
  function campaignBreakdown(item, campaign) {
    const rows = (data().campaignDays || []).filter(row => row.date >= item.from && row.date <= item.to
      && String(row.campaign || '').toLowerCase() === String(campaign || '').toLowerCase());
    if (!rows.length) return [];
    const hasImpressions = rows.every(row => isNum(row.impressions));
    const bucket = (from, to, label) => {
      const days = rows.filter(row => row.date >= from && row.date <= to);
      const sum = field => days.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);
      return Object.assign(derive({ cost: sum('cost'), clicks: sum('clicks'), conversions: sum('conversions'), impressions: hasImpressions ? sum('impressions') : null }), { label, days: days.length });
    };
    const buckets = [];
    if (spanDays(item.from, item.to) <= 10) {
      for (let date = item.from; date <= item.to; date = addDays(date, 1)) buckets.push(bucket(date, date, `${WEEKDAYS[weekdayOf(date)]} ${dayOf(date)}`));
    } else {
      for (let start = item.from; start <= item.to;) {
        let end = addDays(start, 4);
        if (end >= item.to || spanDays(end, item.to) - 1 < 3) end = item.to;
        buckets.push(bucket(start, end, `${dayOf(start)}–${dayOf(end)} ${monthName(end).slice(0, 3)}`));
        start = addDays(end, 1);
      }
    }
    return buckets.filter(row => row.days > 0);
  }

  // Conjuntos de anuncios: solo si el informe de palabras clave del periodo trae "Grupo de anuncios".
  function adGroupStats(report) {
    const kw = report.keywords;
    const byGroup = new Map();
    (kw.raw || []).forEach(row => {
      const name = String(row.group || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!byGroup.has(key)) byGroup.set(key, { name, byKeyword: new Map() });
      const group = byGroup.get(key);
      const keyword = plainKeyword(row.keyword);
      const id = keyword.toLowerCase();
      // Separado por accion de conversion, Google Ads deja costo y clics en 0: quedan en null para no
      // mostrar un CPL de S/ 0.
      if (!group.byKeyword.has(id)) group.byKeyword.set(id, { keyword, conversions: 0, cost: kw.hasMetrics ? 0 : null, clicks: kw.hasMetrics ? 0 : null, impressions: kw.hasImpressions ? 0 : null });
      const entry = group.byKeyword.get(id);
      ['conversions', 'cost', 'clicks', 'impressions'].forEach(field => {
        if (isNum(row[field]) && isNum(entry[field])) entry[field] += Number(row[field]);
      });
    });
    const groups = [...byGroup.values()].map(group => {
      const rows = [...group.byKeyword.values()].map(derive)
        .sort((left, right) => (right.conversions || 0) - (left.conversions || 0) || (right.clicks || 0) - (left.clicks || 0));
      const sum = field => rows.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);
      const totals = derive({ cost: kw.hasMetrics ? sum('cost') : null, clicks: kw.hasMetrics ? sum('clicks') : null, conversions: sum('conversions'), impressions: kw.hasImpressions ? sum('impressions') : null });
      return Object.assign({ name: group.name, rows }, totals);
    }).sort((left, right) => (right.conversions || 0) - (left.conversions || 0) || (right.cost || 0) - (left.cost || 0));
    return { groups, hasMetrics: kw.hasMetrics, hasImpressions: kw.hasImpressions, range: kw.range };
  }

  // Terminos de busqueda: el informe de categorias de intencion. Si el que hay no cubre el periodo, se usa
  // igual pero diciendo de que dias es (como el desglose por accion de conversion).
  function searchTerms(item) {
    const terms = data().searchTerms;
    if (!terms || !(terms.categories || []).length) return null;
    const overlaps = terms.start <= item.to && terms.end >= item.from;
    const rows = terms.categories.filter(row => !row.unclassified && (Number(row.impressions) > 0 || Number(row.clicks) > 0))
      .sort((left, right) => (right.clicks || 0) - (left.clicks || 0) || (right.impressions || 0) - (left.impressions || 0));
    if (!rows.length) return null;
    const totals = rows.reduce((acc, row) => ({ impressions: acc.impressions + (Number(row.impressions) || 0), clicks: acc.clicks + (Number(row.clicks) || 0), conversions: acc.conversions + (Number(row.conversions) || 0) }), { impressions: 0, clicks: 0, conversions: 0 });
    return { rows, totals, from: terms.start, to: terms.end, exact: overlaps, count: terms.categories.length };
  }

  // Nivel de calidad por palabra clave (0-10): es un dato del momento, no del periodo. Sale del informe de
  // palabras clave del mes del reporte o, si no lo trae, del mas reciente que lo traiga; sin ninguno, del
  // informe semanal del repo. Con dos concordancias manda la de mas impresiones.
  function qualityMap(item) {
    const map = new Map();
    const add = (rows, field) => rows.forEach(row => {
      const quality = Number(row[field]);
      if (!(quality > 0)) return;
      const name = plainKeyword(row.keyword).toLowerCase();
      const impressions = Number(row.impressions) || 0;
      if (!map.has(name) || impressions > map.get(name).impressions) map.set(name, { quality, impressions });
    });
    const blocks = (data().keywordConversionsByMonth || []).filter(block => (block.keywords || []).some(row => isNum(row.quality)));
    const block = blocks.find(entry => entry.month === item.month) || blocks.sort((a, b) => b.end.localeCompare(a.end))[0];
    if (block) {
      add(block.keywords, 'quality');
    } else {
      const weeks = (data().keywords && data().keywords.weeks) || [];
      if (weeks.length) add(weeks[weeks.length - 1].rows || [], 'qualityScore');
    }
    return map;
  }

  // Leads por accion de conversion (formulario y WhatsApp), de los informes de Google Ads separados por accion
  // (el de campana o el de palabras clave). Manda el que cubre justo el periodo (exact); si no lo hay, uno que
  // comparta al menos el 90% de los dias con el periodo (1-27 set con el informe del 1-28 set), con su propio
  // rango en la lamina. El de un mes no se muestra en una semana. Sin ninguno, null: la lamina muestra las
  // conversiones del periodo.
  function leadActions(item) {
    const source = data();
    const blocks = (source.conversionActions || []).map(block => ({ start: block.start, end: block.end, actions: block.actions || [] }));
    (source.keywordConversionsByMonth || []).filter(block => block.byAction).forEach(block => {
      const totals = {};
      (block.keywords || []).forEach(row => Object.entries(row.actions || {}).forEach(([name, value]) => { totals[name] = (totals[name] || 0) + Number(value); }));
      blocks.push({ start: block.start, end: block.end, actions: Object.entries(totals).map(([name, conversions]) => ({ name, conversions })) });
    });
    const sum = (actions, pattern) => actions.filter(action => pattern.test(action.name)).reduce((acc, action) => acc + (Number(action.conversions) || 0), 0);
    const splits = blocks
      .filter(block => block.start && block.end)
      .map(block => ({ from: block.start, to: block.end, forms: sum(block.actions, /formulario/i), whatsapp: sum(block.actions, /whatsapp/i) }))
      .filter(split => split.forms + split.whatsapp > 0);
    const exact = splits.find(split => split.from === item.from && split.to === item.to);
    if (exact) return Object.assign(exact, { exact: true });
    const overlap = split => {
      const from = split.from > item.from ? split.from : item.from;
      const to = split.to < item.to ? split.to : item.to;
      if (from > to) return 0;
      const shared = spanDays(from, to);
      return Math.min(shared / spanDays(split.from, split.to), shared / spanDays(item.from, item.to));
    };
    const near = splits
      .filter(split => overlap(split) >= 0.9)
      .sort((a, b) => overlap(b) - overlap(a) || b.to.localeCompare(a.to))[0];
    return near ? Object.assign(near, { exact: false }) : null;
  }

  // Campanas con actividad en el periodo: las del informe por dia de cada campana o, en los dias que no cubre,
  // las de las semanas del informe semanal del repo.
  function campaigns(item) {
    const source = data();
    const active = row => Number(row.cost) > 0 || Number(row.clicks) > 0;
    const names = new Map();
    const add = name => { if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name); };
    const byDay = (source.campaignDays || []).filter(row => row.date >= item.from && row.date <= item.to);
    byDay.filter(active).forEach(row => add(row.campaign));
    const daysWithRows = new Set(byDay.map(row => row.date));
    if (daysWithRows.size < spanDays(item.from, item.to)) {
      (source.weeks || []).filter(week => week.start <= item.to && week.end >= item.from)
        .forEach(week => (week.campaigns || []).filter(active).forEach(row => add(row.campaign)));
    }
    return [...names.values()];
  }

  function buildReport(item) {
    const current = rangeTotals(item.from, item.to);
    // Contra los mismos dias de la semana anterior o, en el acumulado y el mes, el mismo tramo del mes anterior.
    const previousTotals = item.previous.from >= (seriesDays()[0] || {}).date ? rangeTotals(item.previous.from, item.previous.to) : null;
    // Sin costo de esos dias (la semana en curso contra un tramo de la anterior, sin serie por dia real) no hay comparacion.
    const previous = previousTotals && isNum(previousTotals.cost) ? previousTotals : null;
    const days = dailySeries(item);
    const report = {
      item,
      labels: item.labels,
      current,
      previous,
      trend: trendBuckets(item, days),
      keywords: keywords(item),
      quality: qualityMap(item),
      actions: leadActions(item),
      campaigns: campaigns(item),
      campaignRows: campaignStats(item),
      terms: searchTerms(item),
    };
    report.groups = adGroupStats(report);
    return report;
  }

  // ── Lo que se calcula para los textos ───────────────────────────────────
  const qualityOf = (report, keyword) => (report.quality.get(String(keyword || '').toLowerCase()) || {}).quality || null;

  // Leads por formulario y por WhatsApp para los textos: solo si el informe por accion cubre justo el periodo (el
  // del mes con otro rango no se reparte en la semana).
  const leadSplit = report => (report.actions && report.actions.exact ? report.actions : null);

  function keywordFacts(report) {
    const { rows, total, totals } = report.keywords;
    const converting = rows.filter(row => row.conversions > 0);
    const leader = converting[0] || null;
    const average = totals.costPerConversion;
    const others = converting.slice(1).filter(row => isNum(row.costPerConversion));
    const cheapest = others.slice().sort((a, b) => a.costPerConversion - b.costPerConversion)[0] || null;
    const pricey = others.filter(row => isNum(average) && row.costPerConversion > average * 1.5).sort((a, b) => b.costPerConversion - a.costPerConversion)[0];
    const wasted = rows.filter(row => !(row.conversions > 0) && Number(row.cost) > 0).sort((a, b) => b.cost - a.cost);
    const top = converting.slice(0, 2);
    const topLeads = top.reduce((sum, row) => sum + row.conversions, 0);
    const topCost = top.reduce((sum, row) => sum + row.cost, 0);
    return {
      rows, total, converting, leader, average, cheapest, wasted, top, topLeads,
      laggard: pricey || wasted[0] || null,
      topCheap: topLeads > 0 && isNum(average) && topCost / topLeads <= average * 1.05,
      share: leader && total > 0 ? leader.conversions / total : 0,
    };
  }

  // "muy por debajo del promedio", "bajo el promedio (S/ 98)"...
  function versusAverage(value, average, short = false) {
    if (!isNum(value) || !isNum(average)) return '';
    if (short) return value <= average ? `Bajo el promedio (${money(average)})` : `Sobre el promedio (${money(average)})`;
    return value <= average * 0.75 ? 'muy por debajo del promedio' : value <= average ? 'por debajo del promedio' : `por encima del promedio (${money(average)})`;
  }

  const relevanceLabel = ctr => (!isNum(ctr) ? 'Clics ÷ impresiones' : ctr >= 0.08 ? 'Relevancia alta' : ctr >= 0.05 ? 'Relevancia media' : 'Relevancia baja');
  const adStrength = notes => String(noteOr(notes, 'ad:eficacia', AD_DEFAULTS['ad:eficacia'])).trim();
  const isExcellent = strength => /excelente/i.test(strength);

  // ── Textos propuestos (el equipo los reescribe sobre la lamina) ─────────
  function suggestSummarySub(report) {
    const { items, by } = report.trend;
    if (items.length < 2) return SEARCH_PITCH;
    const peak = items.reduce((best, item, index) => (item.clicks > items[best].clicks ? index : best), 0);
    if (peak === items.length - 1) return `${SEARCH_PITCH} ${report.labels.closing} concentró el mayor volumen de clics.`;
    if (peak === 0) return `${SEARCH_PITCH} ${report.labels.opening} concentró el mayor volumen de clics.`;
    const item = items[peak];
    return by === 'day'
      ? `${SEARCH_PITCH} El ${dayName(item.from)} concentró el mayor volumen de clics.`
      : `${SEARCH_PITCH} Los días ${dayOf(item.from)} al ${dayOf(item.to)} concentraron el mayor volumen de clics.`;
  }

  function suggestSummaryHighlight(report) {
    const { current } = report;
    const { items, by } = report.trend;
    const ctr = isNum(current.ctr) ? ` y el CTR llegó a ${percent(current.ctr)}` : '';
    const relevance = !isNum(current.ctr) ? '.'
      : current.ctr >= 0.08 ? ': los anuncios son muy relevantes para quien busca una productora audiovisual.'
        : current.ctr >= 0.05 ? ': los anuncios mantienen una relevancia adecuada para la búsqueda.'
          : ': conviene revisar la relevancia de los anuncios frente a lo que se busca.';
    if (items.length >= 2 && items[items.length - 2].clicks > 0) {
      const last = items[items.length - 1];
      const before = items[items.length - 2];
      const span = by === 'day' ? 'el último día' : `los últimos ${spanDays(last.from, last.to)} días`;
      const times = last.clicks / before.clicks;
      const move = times >= 1.8 ? `Los clics se multiplicaron x${Math.round(times)} en ${span}`
        : times <= 0.6 ? `Los clics bajaron ${Math.round((1 - times) * 100)}% en ${span}`
          : `Los clics se mantuvieron estables en ${span}`;
      return `${move} (${count(before.clicks)} → ${count(last.clicks)})${ctr}${relevance}`;
    }
    return `${count(current.clicks)} clics en el período${ctr}${relevance}`;
  }

  // Sin desglose por accion en el mes: lo que Google Ads si registra del periodo. Las conversiones (formulario +
  // WhatsApp) y la tasa de conversion; sin clics, el costo por conversion o, sin leads, la inversion.
  function conversionTiles(current) {
    const leads = Number(current.conversions) || 0;
    const clicks = Number(current.clicks) || 0;
    const first = { icon: 'flag', value: count(leads), text: `${Math.round(leads) === 1 ? 'Conversión' : 'Conversiones'} · formulario + WhatsApp` };
    if (clicks > 0) {
      return [first, {
        icon: 'trend',
        value: percent1(leads / clicks),
        text: leads > 0 ? `Tasa de conversión · 1 lead cada ${count(clicks / leads)} clics` : `Tasa de conversión · ${count(clicks)} clics sin leads`,
      }];
    }
    if (isNum(current.costPerConversion)) return [first, { icon: 'trend', value: money(current.costPerConversion), text: 'Costo por conversión · inversión ÷ leads' }];
    return [first, { icon: 'trend', value: money(current.cost), text: 'Inversión del período' }];
  }

  function splitText(split) {
    if (!split) return '';
    return `${count(split.forms)} ${Math.round(split.forms) === 1 ? 'formulario' : 'formularios'} y ${count(split.whatsapp)} ${Math.round(split.whatsapp) === 1 ? 'clic' : 'clics'} a WhatsApp`;
  }

  function suggestSummaryAnalysis(report, split) {
    const { current } = report;
    const leads = Number(current.conversions) || 0;
    if (!(leads > 0)) {
      return `**Qué pasó:** ${money(current.cost)} de inversión y ${count(current.clicks)} clics sin leads registrados. **Acción:** revisar los términos y la página de destino antes de sumar inversión.`;
    }
    const detail = split ? ` (${splitText(split)})` : '';
    return `**Qué pasó:** ${count(leads)} ${leadsWord(leads)}${detail} a un CPL de ${money(current.costPerConversion)}${split ? '; el formulario es el contacto más calificado' : ''}. **Acción:** sostener la inversión en los términos que ya convierten y reforzar el seguimiento de los contactos${split ? ' de WhatsApp' : ''}.`;
  }

  // ── Textos de Campanas y Conjuntos de anuncios ─────────────────────────
  function suggestCampaignsSub(report) {
    const rows = report.campaignRows.rows;
    const base = 'Dónde se invirtió y qué devolvió cada campaña del periodo.';
    if (!rows.length) return base;
    if (rows.length === 1) return `${base} Toda la inversión corrió en ${campaignTitle(rows[0].campaign)}.`;
    const share = Math.round((rows[0].cost / report.campaignRows.totals.cost) * 100);
    return `${base} ${campaignTitle(rows[0].campaign)} se llevó el ${share}% del presupuesto.`;
  }

  function suggestCampaignsNote(report) {
    const stats = report.campaignRows;
    const origin = stats.kind === 'daily' ? '**Datos por día de Google Ads.**' : stats.kind === 'weekly' ? '**Datos de la semana del informe de campañas.**' : '';
    const detail = stats.hasImpressions ? ' CTR = clics ÷ impresiones; CPL = inversión ÷ leads.' : ' El informe no trae impresiones por campaña, así que el CTR no se calcula.';
    return `${origin}${detail}`.trim();
  }

  function suggestCampaignsHighlight(report) {
    const { rows, totals } = report.campaignRows;
    const leader = rows[0];
    if (!leader) return `No hay informe por campaña que cubra ${report.labels.period}: la inversión del periodo aparece en el resumen de leads.`;
    if (rows.length === 1) {
      const cpl = isNum(leader.costPerConversion) ? ` a ${money(leader.costPerConversion)} por lead` : '';
      return `${campaignTitle(leader.campaign)} concentra toda la inversión del periodo: ${money(leader.cost)}, ${count(leader.clicks)} clics y ${count(leader.conversions)} leads${cpl}.`;
    }
    const share = Math.round((leader.cost / totals.cost) * 100);
    const best = rows.filter(row => isNum(row.costPerConversion)).sort((a, b) => a.costPerConversion - b.costPerConversion)[0];
    const cheap = best && best !== leader ? ` ${campaignTitle(best.campaign)} consigue el lead más barato (${money(best.costPerConversion)}).` : '';
    return `${campaignTitle(leader.campaign)} se lleva el ${share}% de la inversión y ${count(leader.conversions)} de los ${count(totals.conversions)} leads.${cheap}`;
  }

  function suggestCampaignsAnalysis(report) {
    const { rows, totals } = report.campaignRows;
    const leader = rows[0];
    if (!leader) return '**Qué pasó:** el periodo no tiene informe por campaña. **Acción:** subir a Drive el informe de campañas por día para repartir inversión y leads entre campañas.';
    if (rows.length === 1) {
      return `**Qué pasó:** una sola campaña Search sostiene la captación, con ${count(leader.clicks)} clics y ${count(leader.conversions)} leads. **Acción:** mantener el presupuesto en la campaña y abrir conjuntos nuevos solo cuando la demanda actual quede cubierta.`;
    }
    const weak = rows.filter(row => Number(row.cost) > 0 && !(Number(row.conversions) > 0))[0];
    const action = weak
      ? `**Acción:** recortar o pausar ${campaignTitle(weak.campaign)}, que gastó ${money(weak.cost)} sin leads, y mover ese presupuesto a ${campaignTitle(leader.campaign)}.`
      : `**Acción:** sostener ${campaignTitle(leader.campaign)} y vigilar el costo por lead de las demás.`;
    return `**Qué pasó:** ${rows.length} campañas con inversión; ${campaignTitle(leader.campaign)} aporta ${count(leader.conversions)} de los ${count(totals.conversions)} leads. ${action}`;
  }

  function suggestGroupsSub(report) {
    const groups = report.groups.groups;
    const base = 'Cómo se reparten las palabras clave dentro de cada conjunto de anuncios y qué buscan quienes ven los anuncios.';
    if (!groups.length) return base;
    if (groups.length === 1) return `${base} Todo corre en el conjunto ${groups[0].name}.`;
    return `${base} ${groups.length} conjuntos con actividad en el periodo.`;
  }

  function suggestGroupsHighlight(report) {
    const groups = report.groups.groups;
    const leader = groups[0];
    const terms = report.terms;
    if (!leader) {
      const kw = report.keywords;
      return `El informe de palabras clave de ${rangeText(kw.range.from, kw.range.to, true)} no separa por conjunto de anuncios: al exportarlo con la columna "Grupo de anuncios" cada palabra queda bajo su conjunto.`;
    }
    const top = leader.rows[0];
    const part = top ? ` "${top.keyword}" es la que más aporta, con ${count(top.conversions)} ${Math.round(top.conversions) === 1 ? 'lead' : 'leads'}.` : '';
    const intent = terms && terms.rows[0] ? ` La intención con más clics es "${capitalize(terms.rows[0].name)}".` : '';
    return `El conjunto ${leader.name} reúne ${count(leader.rows.length)} palabras clave y ${count(leader.conversions)} leads.${part}${intent}`;
  }

  function suggestGroupsAnalysis(report) {
    const groups = report.groups.groups;
    const terms = report.terms;
    const leader = groups[0];
    const intent = terms && terms.rows.length
      ? ` **Búsquedas:** la demanda se concentra en ${quoted(terms.rows.slice(0, 2).map(row => capitalize(row.name)))}.`
      : '';
    if (!leader) {
      return `**Qué pasó:** el informe del periodo trae las palabras clave sin su conjunto de anuncios, así que no se puede medir cada grupo por separado.${intent} **Acción:** exportar el informe de palabras clave con la columna "Grupo de anuncios" y subirlo a la carpeta Keywords.`;
    }
    const dead = leader.rows.filter(row => !(Number(row.conversions) > 0) && Number(row.cost) > 0).length;
    const action = dead
      ? `**Acción:** depurar el conjunto ${leader.name}: ${dead} ${dead === 1 ? 'palabra clave gasta' : 'palabras clave gastan'} sin cerrar leads.`
      : `**Acción:** sostener el conjunto ${leader.name} y abrir uno nuevo solo para las búsquedas que hoy no tienen anuncio propio.`;
    return `**Qué pasó:** ${groups.length === 1 ? `un solo conjunto (${leader.name}) concentra la actividad` : `${groups.length} conjuntos con actividad; ${leader.name} lidera`}, con ${count(leader.conversions)} leads.${intent} ${action}`;
  }

  function suggestKeywordSub(report) {
    const facts = keywordFacts(report);
    const base = 'Qué búsquedas traen los leads y a qué costo.';
    if (facts.leader && facts.share >= 0.5) return `${base} El término "${facts.leader.keyword}" concentra la mayoría de los contactos.`;
    if (facts.converting.length > 1) return `${base} Los contactos se reparten entre ${facts.converting.length} términos.`;
    return base;
  }

  function suggestKeywordHighlight(report) {
    const { leader, total, average } = keywordFacts(report);
    if (!leader) return 'Ningún término de búsqueda cerró leads en el período: conviene revisar la intención de las palabras clave y la página de destino.';
    const share = Math.round(leader.conversions) >= Math.round(total) ? `trae los ${count(total)} leads` : `trae ${count(leader.conversions)} de los ${count(total)} leads`;
    const cost = isNum(leader.costPerConversion) ? ` a ${money(leader.costPerConversion)} cada uno${isNum(average) ? `, ${versusAverage(leader.costPerConversion, average)}` : ''}` : '';
    const close = !isNum(average) || leader.costPerConversion <= average ? 'Es el término a sostener y ampliar con variantes afines.' : 'Conviene revisar su puja y su concordancia.';
    return `"${leader.keyword}" ${share}${cost}. ${close}`;
  }

  // Google Ads entrega las palabras clave por mes: si el informe no cubre justo el periodo, la nota lo dice primero.
  function suggestKeywordNote(report) {
    const kw = report.keywords;
    const { cheapest, laggard } = keywordFacts(report);
    const range = kw.source && !kw.exact ? `**Palabras clave del ${rangeText(kw.range.from, kw.range.to, true)}** (Google Ads las entrega por mes). ` : '';
    const parts = [];
    if (cheapest) parts.push(`"${cheapest.keyword}" también convierte a ${money(cheapest.costPerConversion)}`);
    // Con el aviso del rango no entra todo: el termino que no rinde ya va en el analisis.
    if (laggard && !(range && cheapest)) parts.push(`"${laggard.keyword}" ${laggard.conversions > 0 ? 'trae tráfico pero a mayor costo por lead' : 'gasta sin convertir'}`);
    return `${range}Calidad = nivel de calidad de Google (0–10).${parts.length ? ` ${parts.join('; ')}.` : ''}`;
  }

  function suggestKeywordAnalysis(report) {
    const { leader, top, topLeads, topCheap, total, laggard } = keywordFacts(report);
    if (!leader) return '**Qué pasó:** ningún término cerró leads en el período. **Acción:** revisar la concordancia de las palabras clave y la página de destino, y concentrar el presupuesto en búsquedas con intención de contratar.';
    const works = top.length > 1
      ? `la demanda se concentra en ${quoted(top.map(row => row.keyword))}, que juntan ${count(topLeads)} de los ${count(total)} leads${topCheap ? ' a buen costo' : ''}`
      : `la demanda se concentra en "${leader.keyword}", con ${count(leader.conversions)} de los ${count(total)} leads`;
    const lag = laggard ? ` "${laggard.keyword}" aún no convierte al mismo ritmo.` : '';
    const action = `**Acción:** redistribuir presupuesto hacia los términos que convierten y crear variantes cercanas a "${leader.keyword}"${laggard ? `; revisar las concordancias de "${laggard.keyword}"` : ''}.`;
    return `**Qué pasó:** ${works}.${lag} ${action}`;
  }

  // Terminos con nivel de calidad para las barras: los que tuvieron actividad en el periodo (si no hay
  // palabras clave del periodo, los del informe de calidad), de mayor a menor calidad.
  function qualityRows(report) {
    const fromRows = report.keywords.rows
      .map(row => ({ keyword: row.keyword, quality: qualityOf(report, row.keyword), clicks: Number(row.clicks) || 0 }))
      .filter(row => row.quality);
    const rows = fromRows.length ? fromRows : [...report.quality.entries()].map(([keyword, entry]) => ({ keyword, quality: entry.quality, clicks: entry.impressions }));
    return rows.sort((a, b) => b.quality - a.quality || b.clicks - a.clicks).slice(0, MAX_QUALITY);
  }

  function suggestAdHighlight(report, notes) {
    const strength = adStrength(notes);
    const ctr = isNum(report.current.ctr) ? ` + CTR ${percent(report.current.ctr)}` : '';
    return isExcellent(strength)
      ? `Anuncios en "${strength}"${ctr}: la combinación de buena calidad y relevancia es lo que mantiene bajo el costo por clic frente a la competencia.`
      : `Anuncios en "${strength}"${ctr}: subir la eficacia del anuncio con más títulos y descripciones variadas ayudaría a bajar el costo por clic.`;
  }

  function suggestAdAnalysis(report, notes) {
    const strength = adStrength(notes);
    const { leader } = keywordFacts(report);
    const high = qualityRows(report).filter(row => row.quality >= 6 && (!leader || row.keyword.toLowerCase() !== leader.keyword.toLowerCase())).slice(0, 2);
    const levels = [...new Set(high.map(row => row.quality))].sort((a, b) => a - b);
    const highText = high.length ? ` y ${high.length > 1 ? 'los términos' : 'el término'} ${quoted(high.map(row => row.keyword))} ${high.length > 1 ? 'alcanzan' : 'alcanza'} calidad ${levels.join('–')}` : '';
    const leaderQuality = leader ? qualityOf(report, leader.keyword) : null;
    const leaderText = leaderQuality ? ` "${leader.keyword}", el que más convierte, está en ${leaderQuality}${leaderQuality < 7 ? ' y tiene margen para subir' : ''}.` : '';
    const action = leaderQuality && leaderQuality < 7
      ? `alinear mejor la página de destino y los títulos con "${leader.keyword}" para subir su calidad, bajar el CPC y ampliar el volumen de leads.`
      : 'sostener los títulos que funcionan y probar variantes que mantengan la calidad y el CTR.';
    return `**Qué pasó:** los anuncios tienen eficacia "${strength}"${highText}.${leaderText} **Acción:** ${action}`;
  }

  function suggestConclusions(report, notes, split) {
    const { current, previous } = report;
    const { leader, total, average } = keywordFacts(report);
    const strength = adStrength(notes);
    const leaderQuality = leader ? qualityOf(report, leader.keyword) : null;
    const leads = Number(current.conversions) || 0;
    const cards = [];
    if (leader) {
      const versus = isNum(average) && isNum(leader.costPerConversion) ? ` (${leader.costPerConversion <= average ? 'bajo' : 'sobre'} el promedio de ${money(average)})` : '';
      cards.push({
        icon: 'search',
        title: `"${capitalize(leader.keyword)}" es el motor`,
        text: `${count(leader.conversions)} de los ${count(total)} leads vienen de ese término${isNum(leader.costPerConversion) ? `, a ${money(leader.costPerConversion)} por lead${versus}` : ''}. Se sostendrá la inversión ahí y se ampliará con variantes cercanas que ya muestran intención.`,
      });
    } else {
      const costChange = previous ? change(current.costPerConversion, previous.costPerConversion) : null;
      cards.push(leads > 0 && costChange !== null
        ? { icon: 'trend', title: `Costo por lead ${costChange <= 0 ? 'mejoró' : 'subió'}`, text: `El costo por lead ${costChange <= 0 ? 'bajó' : 'subió'} a ${money(current.costPerConversion)} (${pct0(costChange)} ${report.labels.vsBadge}). ${costChange <= 0 ? 'El canal se volvió más eficiente.' : 'Revisar pujas y términos para recuperar eficiencia.'}` }
        : { icon: 'trend', title: leads > 0 ? `Costo por lead de ${money(current.costPerConversion)}` : 'Sin leads en el período', text: leads > 0 ? `${count(leads)} ${leadsWord(leads)} con ${money(current.cost)} de inversión. Es la base para comparar ${report.labels.next}.` : `${money(current.cost)} de inversión y ${count(current.clicks)} clics sin leads registrados. Revisar los términos y la página de destino para ${report.labels.next}.` });
    }
    cards.push({
      icon: 'star',
      title: isExcellent(strength) ? 'Anuncios de máxima calidad' : `Anuncios en "${strength}"`,
      text: `Los anuncios activos están en "${strength}"${isNum(current.ctr) ? ` y el CTR llegó a ${percent(current.ctr)}` : ''}. ${isExcellent(strength) ? 'La buena calidad mantiene el CPC competitivo.' : 'Subir su eficacia ayudará a bajar el CPC.'}${leaderQuality && leaderQuality < 7 ? ` Se renovarán títulos para subir la calidad de "${leader.keyword}" (hoy ${leaderQuality}/10).` : ''}`,
    });
    cards.push({
      icon: 'chat',
      title: 'Calificar los contactos',
      text: !(leads > 0)
        ? 'Sin leads registrados en el período: se revisará que el formulario y el botón de WhatsApp registren cada contacto.'
        : split
          ? `De los ${count(leads)} ${leadsWord(leads)}, ${count(split.forms)} llegaron por formulario (el contacto más calificado) y ${count(split.whatsapp)} por WhatsApp. Se reforzará el seguimiento de los contactos de WhatsApp para convertirlos en oportunidades reales.`
          : `Los ${count(leads)} ${leadsWord(leads)} llegaron por formulario y WhatsApp. Se reforzará el seguimiento de cada contacto para convertirlos en oportunidades reales.`,
    });
    return cards;
  }

  function suggestSteps(report) {
    const { leader, top, topLeads, total, laggard } = keywordFacts(report);
    const leaderQuality = leader ? qualityOf(report, leader.keyword) : null;
    const steps = [{
      icon: 'search',
      title: 'Concentrar presupuesto en lo que convierte',
      text: top.length
        ? `Priorizar ${quoted(top.map(row => row.keyword))} (${count(topLeads)} de ${count(total)} leads)${laggard ? ` y revisar las concordancias de "${laggard.keyword}" para mejorar su costo por lead` : ''}.`
        : 'Concentrar el presupuesto en las búsquedas con intención de contratar y pausar las que gastan sin convertir.',
    }];
    steps.push(leader && leaderQuality && leaderQuality < 7
      ? { icon: 'star', title: 'Subir la calidad del término líder', text: `Alinear página de destino y títulos con "${leader.keyword}" para subir su nivel de calidad (hoy ${leaderQuality}/10), reducir el CPC y ampliar el volumen de leads al mismo presupuesto.` }
      : leader
        ? { icon: 'star', title: 'Ampliar el término líder', text: `Sumar variantes cercanas a "${leader.keyword}" y probar nuevos títulos para captar más búsquedas con la misma intención.` }
        : { icon: 'star', title: 'Revisar la página de destino', text: 'Alinear la página de destino y los títulos con las búsquedas que traen clics para convertirlos en contactos.' });
    return steps;
  }

  // ── Textos guardados por periodo (la clave es el id: el primer dia de la semana o "avance:" y el corte); los
  // del anuncio ("ad:"), una sola vez para todos los periodos ──────────────
  // Se comparten con el equipo por la hoja privada del CRM, el mismo Web App que usan Leads y las acciones
  // sugeridas (apps-script/crm-leads.gs; URL y token en window.TIERRA_FILMS_CRM, que el build incrusta desde
  // los secrets TF_CRM_URL y TF_CRM_TOKEN). Este navegador guarda una copia: es lo que se pinta mientras llega
  // la hoja y lo que queda si la hoja no responde. Sin esos secrets los textos viven solo en el navegador.
  const isGlobal = key => key.startsWith('ad:');
  const CRM_TIMEOUT = 20000;
  // Un texto se sube un rato despues de la ultima tecla (o al salir de el), no en cada letra.
  const SAVE_DELAY = 900;
  const crmConfig = () => window.TIERRA_FILMS_CRM || {};
  const isRemote = () => Boolean(crmConfig().url && crmConfig().token);
  // status: local | cargando | guardando | listo | error. pending: textos escritos que la hoja todavia no tiene.
  const shared = { status: 'local', detail: '', pending: new Map(), loading: null };

  async function callCrm(action, extra) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CRM_TIMEOUT);
    try {
      const response = await fetch(crmConfig().url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ token: crmConfig().token, action }, extra)),
        signal: controller.signal,
      });
      const body = await response.json();
      if (!body || body.ok === false) throw new Error((body && body.error) || `HTTP ${response.status}`);
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  function crmProblem(error) {
    if (error.name === 'AbortError') return 'la hoja no respondió a tiempo';
    // El Web App publicado es anterior a los textos del reporte: falta su version nueva (README › Leads).
    if (/accion no valida/i.test(error.message)) return 'falta publicar la versión nueva de apps-script/crm-leads.gs';
    return error.message;
  }

  function showSharedStatus() {
    const box = document.getElementById('week-notes');
    if (!box) return;
    const text = {
      local: ['Textos solo en este navegador', 'Para que el equipo vea los mismos textos hay que conectar la hoja privada del CRM (README › Leads).'],
      cargando: ['Leyendo los textos del equipo…', ''],
      guardando: ['Guardando en la hoja…', ''],
      listo: ['Textos compartidos con el equipo', 'Lo que se escribe sobre las láminas se guarda en la hoja privada del CRM.'],
      error: ['Textos solo en este navegador', `No se pudo usar la hoja del CRM: ${shared.detail}. Lo escrito queda en este navegador hasta que vuelva.`],
    }[shared.status];
    box.className = `week-notes ${shared.status}`;
    box.textContent = text[0];
    box.title = text[1];
  }

  // Trae los textos de la hoja y reemplaza la copia del navegador. Devuelve true si cambio algo.
  function loadShared() {
    if (!isRemote()) {
      shared.status = 'local';
      showSharedStatus();
      return Promise.resolve(false);
    }
    if (shared.loading) return shared.loading;
    shared.status = 'cargando';
    showSharedStatus();
    shared.loading = callCrm('notas-list', {}).then(body => {
      const notes = {};
      const put = (periodo, clave, texto) => { notes[periodo] = Object.assign(notes[periodo] || {}, { [clave]: texto }); };
      (body.rows || []).forEach(row => { if (row && row.periodo && row.clave) put(row.periodo, row.clave, String(row.texto ?? '')); });
      // Lo escrito que todavia no llego a la hoja no se pisa: se vuelve a subir.
      shared.pending.forEach(entry => put(entry.periodo, entry.clave, entry.texto));
      const changed = JSON.stringify(notes) !== JSON.stringify(readNotes());
      writeNotes(notes);
      shared.status = shared.pending.size ? 'guardando' : 'listo';
      shared.detail = '';
      shared.pending.forEach((entry, id) => { if (!entry.timer) flushShared(id); });
      return changed;
    }).catch(error => {
      shared.status = 'error';
      shared.detail = crmProblem(error);
      return false;
    }).finally(() => {
      shared.loading = null;
      showSharedStatus();
    });
    return shared.loading;
  }

  function queueShared(periodo, clave, texto) {
    const id = `${periodo}|${clave}`;
    const entry = shared.pending.get(id) || { periodo, clave, sending: Promise.resolve() };
    clearTimeout(entry.timer);
    entry.texto = texto;
    entry.timer = setTimeout(() => flushShared(id), SAVE_DELAY);
    shared.pending.set(id, entry);
    if (shared.status !== 'error') {
      shared.status = 'guardando';
      showSharedStatus();
    }
  }

  // Sube un texto pendiente. Los envios de una misma clave van en fila, asi el ultimo escrito es el que queda.
  function flushShared(id) {
    const entry = shared.pending.get(id);
    if (!entry) return Promise.resolve();
    clearTimeout(entry.timer);
    entry.timer = null;
    const texto = entry.texto;
    entry.sending = entry.sending.then(() => callCrm('notas-save', { row: { periodo: entry.periodo, clave: entry.clave, texto } })).then(() => {
      // Si mientras subia se siguio escribiendo, queda pendiente el texto nuevo.
      if (shared.pending.get(id) === entry && entry.texto === texto && !entry.timer) shared.pending.delete(id);
      if (!shared.pending.size) {
        shared.status = 'listo';
        shared.detail = '';
      }
    }).catch(error => {
      // El texto queda en este navegador y pendiente: se reintenta con la proxima edicion o al volver a leer la hoja.
      shared.status = 'error';
      shared.detail = crmProblem(error);
    }).finally(showSharedStatus);
    return entry.sending;
  }

  // Al cerrar o cambiar de pestaña con algo a medio subir, se manda igual (sin esperar respuesta).
  function beaconPending() {
    if (!isRemote() || !shared.pending.size || typeof navigator.sendBeacon !== 'function') return;
    shared.pending.forEach((entry, id) => {
      if (!entry.timer) return;
      clearTimeout(entry.timer);
      entry.timer = null;
      const body = JSON.stringify({ token: crmConfig().token, action: 'notas-save', row: { periodo: entry.periodo, clave: entry.clave, texto: entry.texto } });
      if (navigator.sendBeacon(crmConfig().url, new Blob([body], { type: 'text/plain;charset=utf-8' }))) shared.pending.delete(id);
    });
    if (!shared.pending.size && shared.status === 'guardando') shared.status = 'listo';
    showSharedStatus();
  }

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

  function notesFor(periodId) {
    const notes = readNotes();
    return Object.assign({}, notes[GLOBAL_NOTES] || {}, notes[periodId] || {});
  }

  const bucketOf = (periodId, key) => (isGlobal(key) ? GLOBAL_NOTES : periodId);

  function saveNote(periodId, key, value) {
    const notes = readNotes();
    const bucket = bucketOf(periodId, key);
    notes[bucket] = Object.assign({}, notes[bucket] || {}, { [key]: value });
    writeNotes(notes);
    if (isRemote()) queueShared(bucket, key, value);
  }

  async function resetNotes(periodId) {
    const notes = readNotes();
    delete notes[periodId];
    writeNotes(notes);
    if (!isRemote()) return;
    // Lo pendiente de ese periodo ya no se sube; lo que estaba en camino se espera para que no reviva despues.
    const sending = [];
    shared.pending.forEach((entry, id) => {
      if (entry.periodo !== periodId) return;
      clearTimeout(entry.timer);
      sending.push(entry.sending);
      shared.pending.delete(id);
    });
    await Promise.all(sending);
    try {
      await callCrm('notas-reset', { periodo: periodId });
      if (!shared.pending.size) shared.status = 'listo';
    } catch (error) {
      shared.status = 'error';
      shared.detail = crmProblem(error);
    }
    showSharedStatus();
  }

  // **texto** va en negrita, como "Qué pasó:" en el modelo.
  const rich = text => esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

  // Texto editable sobre la lamina: al hacer clic se ve el texto con sus ** y al salir vuelve a negrita.
  const editable = (key, text, tag = 'p', className = '') => `<${tag} class="rp-edit ${className}" data-note="${esc(key)}" data-raw="${esc(text)}" title="Clic para editar · **texto** va en negrita">${rich(text)}</${tag}>`;
  const noteOr = (notes, key, suggested) => (notes[key] != null ? notes[key] : suggested);

  // ── Piezas de las laminas ──────────────────────────────────────────────
  const chip = text => `<span class="rp-chip">${icon('calendar')}${esc(text)}</span>`;

  function head(title, sub, chipText, notes, subKey) {
    const subtitle = subKey ? editable(subKey, noteOr(notes, subKey, sub)) : `<p>${esc(sub)}</p>`;
    return `<header class="rp-head"><div><h2>${esc(title)}</h2>${subtitle}</div>${chipText ? chip(chipText) : ''}</header>`;
  }

  const stat = (label, value, foot, badge = '') => `
    <div class="rp-card rp-stat">
      <div class="rp-stat-top"><span class="rp-stat-label">${esc(label)}</span>${badge ? `<span class="rp-badge">${esc(badge)}</span>` : ''}</div>
      <strong>${value}</strong>
      <small>${esc(foot)}</small>
    </div>`;

  const cardHead = (iconName, title, sub, aside = '') => `
    <div class="rp-card-head">
      ${iconName ? `<span class="rp-card-icon">${icon(iconName)}</span>` : ''}
      <div><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>
      ${aside}
    </div>`;

  const legend = items => `<span class="rp-legends">${items.map(([label, color]) => `<span class="rp-legend"><i style="background:${color}"></i>${esc(label)}</span>`).join('')}</span>`;

  const highlight = (key, text) => `
    <div class="rp-insight">
      <span class="rp-insight-icon">${icon('bulb')}</span>
      <div><span class="rp-insight-label">Destacado</span>${editable(key, text)}</div>
    </div>`;

  const analysis = (key, text) => `
    <div class="rp-card rp-analysis">
      <div class="rp-analysis-head">${icon('bars')}<b>Análisis</b></div>
      ${editable(key, text)}
    </div>`;

  function footer(left, report, page) {
    return `
      <footer class="rp-foot">
        <span>${esc(left)}</span>
        <span class="rp-foot-right"><img src="${LOGO}" alt=""><b>Lima Retail</b>${esc(report.labels.footer)} · ${pageNumber(page)} / ${pageNumber(TOTAL_PAGES)}</span>
      </footer>`;
  }

  // Evolucion de clics y leads: dos paneles con su propia escala (clics arriba, leads abajo), el valor de cada
  // punto (el maximo en negrita y relleno) y una franja en el tramo con mas clics.
  function trendChart(report) {
    const { items } = report.trend;
    if (!items.length) return `<p class="rp-empty rp-chart-empty">${capitalize(report.labels.period)} no tiene clics ni leads por día en el tablero: la evolución aparece cuando se suba el informe de campaña por día.</p>`;
    const width = 600;
    const left = 40;
    const right = width - 30;
    const step = items.length > 1 ? (right - left) / (items.length - 1) : right - left;
    const x = index => (items.length > 1 ? left + step * index : (left + right) / 2);
    const peak = items.reduce((best, item, index) => (item.clicks > items[best].clicks ? index : best), 0);
    const bandWidth = Math.min(step * 0.9, 96);
    const panel = (values, color, label, top) => {
      const bottom = top + 104;
      const max = Math.max(...values, 1);
      const y = value => bottom - (value / max) * (bottom - top);
      const strongest = values.indexOf(Math.max(...values));
      const marks = values.map((value, index) => {
        const strong = index === strongest;
        const above = strong || index % 2 === 0;
        return `<circle cx="${x(index)}" cy="${y(value)}" r="${strong ? 4 : 3.4}" fill="${strong ? color : '#fff'}" stroke="${color}" stroke-width="1.8"/>`
          + `<text x="${x(index)}" y="${above ? y(value) - 9 : y(value) + 18}" text-anchor="middle" class="rp-val${strong ? ' strong' : ''}">${count(value)}</text>`;
      }).join('');
      return `
        <rect x="${left - 26}" y="${top - 30}" width="9" height="9" rx="2" fill="${color}"/>
        <text x="${left - 12}" y="${top - 22}" class="rp-panel-label">${label}</text>
        <line x1="${left - 26}" x2="${right + 22}" y1="${bottom + 6}" y2="${bottom + 6}" class="rp-grid dashed"/>
        <polyline points="${values.map((value, index) => `${x(index)},${y(value)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
        ${marks}`;
    };
    const labels = items.map((item, index) => `<text x="${x(index)}" y="352" text-anchor="middle" class="rp-axis${index === peak ? ' peak' : ''}">${esc(item.label)}</text>`).join('');
    return `
      <svg class="rp-chart rp-chart-trend" viewBox="0 0 ${width} 364" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Evolución de clics y leads">
        <rect x="${x(peak) - bandWidth / 2}" y="0" width="${bandWidth}" height="364" rx="6" fill="${BAND_COLOR}"/>
        ${panel(items.map(item => item.clicks), CLICKS_COLOR, 'Clics', 44)}
        ${panel(items.map(item => item.leads), LEADS_COLOR, 'Leads', 200)}
        ${labels}
      </svg>`;
  }

  // Leads por palabra clave: barras de los terminos con leads (hasta cuatro), el primero resaltado.
  function keywordBars(report) {
    const bars = report.keywords.rows.filter(row => row.conversions > 0).slice(0, MAX_BARS);
    if (!bars.length) return `<p class="rp-empty rp-chart-empty">${report.keywords.source ? 'Ningún término registró leads en el período.' : `Sin informe de palabras clave que cubra ${report.labels.period}.`}</p>`;
    const width = 560;
    const top = 26;
    const bottom = 170;
    const left = 44;
    const right = width - 10;
    const max = Math.max(...bars.map(row => Math.round(row.conversions)), 1);
    const tick = [1, 2, 5, 10, 20, 50, 100].find(size => max / size <= 4) || 200;
    const scale = Math.ceil(max / tick) * tick;
    const y = value => bottom - (value / scale) * (bottom - top);
    const slot = (right - left) / bars.length;
    const barWidth = Math.min(46, slot * 0.4);
    const grid = [];
    for (let value = tick; value <= scale; value += tick) {
      grid.push(`<line x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}" class="rp-grid dashed"/><text x="${left - 12}" y="${y(value) + 4}" text-anchor="end" class="rp-tick">${integer.format(value)}</text>`);
    }
    const drawn = bars.map((row, index) => {
      const center = left + slot * (index + 0.5);
      const value = Math.round(row.conversions);
      const first = index === 0;
      return `${first ? `<rect x="${center - slot / 2 + 4}" y="${top - 18}" width="${slot - 8}" height="${bottom - top + 40}" rx="6" fill="${BAND_COLOR}"/>` : ''}
        <rect x="${center - barWidth / 2}" y="${y(value)}" width="${barWidth}" height="${bottom - y(value)}" rx="3" fill="${CLICKS_COLOR}"/>
        <text x="${center}" y="${y(value) - 7}" text-anchor="middle" class="rp-val${first ? ' strong blue' : ''}">${count(value)}</text>
        <text x="${center}" y="${bottom + 16}" text-anchor="middle" class="rp-axis${first ? ' peak' : ''}">${esc(shorten(capitalize(row.keyword), 22))}</text>`;
    }).join('');
    return `
      <svg class="rp-chart rp-chart-bars" viewBox="0 0 ${width} 196" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Leads por palabra clave">
        ${grid.join('')}
        ${drawn}
        <line x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" class="rp-grid"/>
      </svg>`;
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
          <span class="rp-gads" aria-hidden="true">G</span>
          <h1>Reporte de Publicidad</h1>
          <p class="rp-cover-client">Cliente: <b>${BRAND}</b></p>
          <p class="rp-cover-period">${esc(report.labels.cover)}<i></i>${esc(CHANNEL)}</p>
        </div>
        <footer class="rp-foot">
          <span>${AGENCY_LINE}</span>
          <span class="rp-foot-right"><img src="${LOGO}" alt=""><b>Lima Retail</b>Emitido el ${esc(issuedLabel())}</span>
        </footer>
      </section>`;
  }

  function contentsPage(report) {
    const items = [
      { title: 'Resumen de leads', desc: 'Inversión, clics, leads y costo por lead del periodo.', icon: 'chat', page: 3 },
      { title: 'Campañas', desc: 'Qué devolvió cada campaña y cómo se repartió la inversión.', icon: 'bars', page: 4 },
      { title: 'Conjuntos de anuncios', desc: 'Las palabras clave de cada conjunto y qué buscan los usuarios.', icon: 'search', page: 5 },
      { title: 'Palabras clave', desc: 'Qué términos traen los leads y a qué costo.', icon: 'search', page: 6 },
      { title: 'Anuncio y calidad', desc: 'El anuncio activo y su nivel de calidad en Google.', icon: 'star', page: 7 },
      { title: 'Conclusiones', desc: 'Qué funciona y próximos pasos.', icon: 'flag', page: 8 },
    ];
    return `
      <section class="rp-page">
        ${head('Contenido del reporte', 'Qué encontrarás en cada sección de este informe.')}
        <div class="rp-body rp-contents">
          ${items.map((item, index) => `
            <div class="rp-card rp-toc">
              <div class="rp-toc-top"><span class="rp-icon">${icon(item.icon)}</span><span class="rp-toc-num">${pageNumber(index + 1)}</span></div>
              <h3>${esc(item.title)}</h3>
              <p>${esc(item.desc)}</p>
              <span class="rp-toc-page">Página ${pageNumber(item.page)}</span>
            </div>`).join('')}
        </div>
        ${footer(report.labels.source, report, 2)}
      </section>`;
  }

  function summaryPage(report, notes) {
    const { current, previous, labels } = report;
    const leads = Number(current.conversions) || 0;
    const ctrChange = previous ? change(current.ctr, previous.ctr) : null;
    const campaignsCount = report.campaigns.length;
    const cards = [
      stat('Inversión', money(current.cost), campaignsCount > 1 ? `${campaignsCount} campañas Search` : 'Campaña Search'),
      stat('Clics', count(current.clicks), `CPC ${money2(current.cpc)}`),
      stat('Leads', count(leads), 'Form. + WhatsApp', leads > 0 ? 'Captación activa' : ''),
      // Sin leads no hay costo por lead: va dicho, con la inversion del periodo, en vez de un guion.
      leads > 0 ? stat('Costo por lead', money(current.costPerConversion), 'Inversión ÷ leads') : stat('Costo por lead', 'Sin leads', `${money(current.cost)} invertidos`),
      stat('CTR', percent(current.ctr), relevanceLabel(current.ctr), ctrChange === null ? '' : `${pct0(ctrChange)} ${labels.vsBadge}`),
      stat('Impresiones', count(current.impressions), 'Búsquedas activas'),
    ];
    // Formulario y WhatsApp: del informe por accion de Google Ads del periodo o del mismo mes (con su rango). Sin
    // desglose en el mes, las conversiones y la tasa de conversion del periodo. Todo sale de la plataforma: los
    // recuadros no se editan a mano y nunca quedan vacios.
    const split = report.actions;
    const tile = (iconName, value, text, on) => `
      <div class="rp-tile${on ? ' on' : ''}">
        <span class="rp-tile-icon">${icon(iconName)}</span>
        <div><strong>${esc(value)}</strong><small>${esc(text)}</small></div>
      </div>`;
    const tiles = split
      ? [
        tile('form', count(split.forms), 'Formularios enviados · el lead más calificado', true),
        tile('chat', count(split.whatsapp), 'Clics a WhatsApp · intención de contacto', false),
      ]
      : conversionTiles(current).map((item, index) => tile(item.icon, item.value, item.text, index === 0));
    const actionsSub = !split ? 'Leads de formulario y WhatsApp que registró Google Ads'
      : split.exact ? 'Cómo contactan los leads generados'
        : `Desglose de Google Ads del ${rangeText(split.from, split.to, true, false)}`;
    const resolved = leadSplit(report);
    return `
      <section class="rp-page">
        ${head('Resumen de leads', suggestSummarySub(report), labels.chip, notes, 'resumen:sub')}
        <div class="rp-body">
          <div class="rp-stats">${cards.join('')}</div>
          <div class="rp-cols">
            <div class="rp-card rp-chart-card">
              ${cardHead('', 'Evolución de clics y leads', report.trend.by === 'day' ? 'Por día' : 'Por bloque de 5 días', legend([['Clics', CLICKS_COLOR], ['Leads', LEADS_COLOR]]))}
              ${trendChart(report)}
            </div>
            <div class="rp-stack">
              <div class="rp-card rp-actions">
                ${cardHead('chat', 'Acciones de conversión', actionsSub)}
                <div class="rp-tiles">${tiles.join('')}</div>
              </div>
              ${highlight('resumen:destacado', noteOr(notes, 'resumen:destacado', suggestSummaryHighlight(report)))}
              ${analysis('resumen:analisis', noteOr(notes, 'resumen:analisis', suggestSummaryAnalysis(report, resolved)))}
            </div>
          </div>
        </div>
        ${footer(labels.source, report, 3)}
      </section>`;
  }

  // Barras de reparto (inversion por campana, leads por conjunto): etiqueta, barra y valor.
  const shareBars = items => (items.length
    ? `<div class="rp-quality rp-shares">${items.map(([label, share, value]) => `
        <div class="rp-quality-row">
          <span title="${esc(label)}">${esc(shorten(label, 26))}</span>
          <i><b style="width:${Math.max(2, Math.min(100, (Number(share) || 0) * 100)).toFixed(1)}%"></b></i>
          <em>${esc(value)}</em>
        </div>`).join('')}</div>`
    : '');

  const campaignTitle = name => capitalize(String(name || '').toLowerCase());

  function campaignsPage(report, notes) {
    const { labels } = report;
    const stats = report.campaignRows;
    const rows = stats.rows;
    const totals = stats.totals;
    const leader = rows[0] || null;
    const share = leader && Number(totals.cost) > 0 ? leader.cost / totals.cost : null;
    const metric = value => (stats.hasImpressions ? value : '—');
    const cards = leader ? [
      stat('Campañas activas', count(rows.length), rows.length === 1 ? 'Campaña Search con inversión' : 'Campañas Search con inversión'),
      stat('Campaña líder', `<span class="rp-stat-term">${esc(campaignTitle(leader.campaign))}</span>`, isNum(share) ? `${Math.round(share * 100)}% de la inversión` : 'La de mayor inversión'),
      stat('Inversión del periodo', money(totals.cost), `CPC ${money2(totals.cpc)}`),
      stat('Leads', count(totals.conversions), isNum(totals.costPerConversion) ? `CPL ${money(totals.costPerConversion)}` : 'Form. + WhatsApp'),
    ] : [
      stat('Campañas activas', '—', 'Sin informe por campaña'),
      stat('Campaña líder', '—', 'La de mayor inversión'),
      stat('Inversión del periodo', money(report.current.cost), 'Total de la cuenta'),
      stat('Leads', count(report.current.conversions), 'Form. + WhatsApp'),
    ];
    // Con una sola campana, la tabla la abre por tramos del periodo; con varias, una fila por campana.
    const single = rows.length === 1 ? campaignBreakdown(report.item, rows[0].campaign) : [];
    const cell = (name, row, isTotal) => `
          <td class="${isTotal ? '' : 'rp-name'}" title="${esc(name)}">${esc(name)}</td>
          <td class="num">${money(row.cost)}</td>
          <td class="num">${Number(totals.cost) > 0 ? `${Math.round((row.cost / totals.cost) * 100)}%` : '—'}</td>
          <td class="num">${count(row.clicks)}</td>
          <td class="num">${metric(percent1(row.ctr))}</td>
          <td class="num">${money2(row.cpc)}</td>
          <td class="num">${count(row.conversions)}</td>
          <td class="num">${isNum(row.costPerConversion) ? money(row.costPerConversion) : '—'}</td>`;
    const body = single.length > 1
      ? single.map(row => `<tr>${cell(row.label, row, false)}</tr>`).join('')
        + `<tr class="rp-total">${cell(`Total · ${campaignTitle(rows[0].campaign)}`, totals, true)}</tr>`
      : rows.length ? rows.map(row => `<tr${row === leader ? ' class="rp-top"' : ''}>${cell(campaignTitle(row.campaign), row, false)}</tr>`).join('')
      : `<tr><td colspan="8" class="rp-empty">Sin informe por campaña que cubra ${esc(labels.period)}: ${esc(report.campaigns.length ? `corrió ${report.campaigns.map(campaignTitle).join(', ')}` : 'no hay campañas con actividad')}.</td></tr>`;
    const totalRow = rows.length > 1 ? `
        <tr class="rp-total">
          <td>Total · ${rows.length} campañas</td>
          <td class="num">${money(totals.cost)}</td>
          <td class="num">100%</td>
          <td class="num">${count(totals.clicks)}</td>
          <td class="num">${metric(percent1(totals.ctr))}</td>
          <td class="num">${money2(totals.cpc)}</td>
          <td class="num">${count(totals.conversions)}</td>
          <td class="num">${isNum(totals.costPerConversion) ? money(totals.costPerConversion) : '—'}</td>
        </tr>` : '';
    const bars = shareBars(rows.map(row => [campaignTitle(row.campaign), Number(totals.cost) > 0 ? row.cost / totals.cost : 0, money(row.cost)]));
    return `
      <section class="rp-page rp-page-tables">
        ${head('Campañas', suggestCampaignsSub(report), labels.chip, notes, 'campanas:sub')}
        <div class="rp-body">
          <div class="rp-grid-4">${cards.join('')}</div>
          <div class="rp-cols">
            <div class="rp-stack">
              <div class="rp-card rp-table-card">
                <table class="rp-table rp-campaigns">
                  <colgroup><col><col style="width:12%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:11%"><col style="width:9%"><col style="width:11%"></colgroup>
                  <thead><tr><th>${single.length > 1 ? 'Tramo del periodo' : 'Campaña'}</th><th class="num">Inversión</th><th class="num">% inv.</th><th class="num">Clics</th><th class="num">CTR</th><th class="num">CPC</th><th class="num">Leads</th><th class="num">CPL</th></tr></thead>
                  <tbody>${body}${totalRow}</tbody>
                </table>
                ${editable('campanas:nota', noteOr(notes, 'campanas:nota', suggestCampaignsNote(report)), 'p', 'rp-table-foot')}
              </div>
              ${highlight('campanas:destacado', noteOr(notes, 'campanas:destacado', suggestCampaignsHighlight(report)))}
            </div>
            <div class="rp-stack">
              <div class="rp-card">
                ${cardHead('bars', 'Reparto de la inversión', 'Cuánto se llevó cada campaña')}
                ${bars || '<p class="rp-empty">Sin inversión por campaña en el periodo.</p>'}
              </div>
              ${analysis('campanas:analisis', noteOr(notes, 'campanas:analisis', suggestCampaignsAnalysis(report)))}
            </div>
          </div>
        </div>
        ${footer(labels.source, report, 4)}
      </section>`;
  }

  function adGroupsPage(report, notes) {
    const { labels } = report;
    const kw = report.keywords;
    const groups = report.groups.groups;
    const leader = groups[0] || null;
    const terms = report.terms;
    const totalKeywords = groups.reduce((acc, group) => acc + group.rows.length, 0);
    const cards = leader ? [
      stat('Conjuntos activos', count(groups.length), groups.length === 1 ? 'Un conjunto con actividad' : 'Conjuntos con actividad'),
      stat('Conjunto líder', `<span class="rp-stat-term">${esc(leader.name)}</span>`, `${count(leader.rows.length)} palabras clave`),
      stat('Leads del líder', count(leader.conversions), isNum(leader.costPerConversion) ? `CPL ${money(leader.costPerConversion)}` : 'Form. + WhatsApp'),
      stat('Palabras clave', count(totalKeywords), 'Con actividad en el periodo'),
    ] : [
      stat('Conjuntos activos', '—', 'El informe no trae el conjunto'),
      stat('Conjunto líder', '—', 'Grupo de anuncios de Google Ads'),
      stat('Leads del periodo', count(kw.totals.conversions), 'Por palabra clave'),
      stat('Palabras clave', count(kw.rows.length), 'Con actividad en el periodo'),
    ];
    // El informe por accion de conversion solo trae leads: en ese caso, en vez de clics, CPL e inversion
    // vacios, la tabla muestra el peso de cada palabra dentro de su conjunto.
    const full = report.groups.hasMetrics;
    const cols = full
      ? [['Conjunto · palabra clave'], ['Clics', true], ['Leads', true], ['CPL', true], ['Inversión', true]]
      : [['Conjunto · palabra clave'], ['Leads', true], ['% del conjunto', true]];
    const widths = full ? ['', '12%', '12%', '15%', '15%'] : ['', '18%', '22%'];
    const cells = (name, row, share, isGroup) => (full
      ? `<td class="${isGroup ? '' : 'rp-name'}" title="${esc(name)}">${esc(name)}</td>
          <td class="num">${count(row.clicks)}</td>
          <td class="num">${count(row.conversions)}</td>
          <td class="num">${isNum(row.costPerConversion) ? money(row.costPerConversion) : '—'}</td>
          <td class="num">${money(row.cost)}</td>`
      : `<td class="${isGroup ? '' : 'rp-name'}" title="${esc(name)}">${esc(name)}</td>
          <td class="num">${count(row.conversions)}</td>
          <td class="num">${isNum(share) ? `${Math.round(share * 100)}%` : '—'}</td>`);
    // Lo que entra en la lamina: con un solo conjunto, sus primeras palabras; con varios, menos de cada uno.
    const limit = groups.length <= 1 ? 5 : Math.max(2, Math.floor(MAX_KEYWORDS / groups.length));
    const groupRows = groups.map(group => {
      const total = groups.reduce((acc, item) => acc + (Number(item.conversions) || 0), 0);
      const groupHead = `<tr class="rp-group">${cells(group.name, group, total > 0 ? group.conversions / total : null, true)}</tr>`;
      const rows = group.rows.slice(0, limit)
        .map(row => `<tr>${cells(row.keyword, row, Number(group.conversions) > 0 ? row.conversions / group.conversions : null, false)}</tr>`).join('');
      const rest = group.rows.length - Math.min(group.rows.length, limit);
      const more = rest > 0 ? `<tr><td colspan="${cols.length}" class="rp-table-more">y ${rest} ${rest === 1 ? 'palabra clave más' : 'palabras clave más'} del conjunto</td></tr>` : '';
      return groupHead + rows + more;
    }).join('');
    const empty = `<tr><td colspan="${cols.length}" class="rp-empty">El informe de palabras clave de ${esc(rangeText(kw.range.from, kw.range.to, true))} no trae la columna «Grupo de anuncios»: expórtalo desde Google Ads con el grupo de anuncios para repartir las palabras por conjunto.</td></tr>`;
    const termRows = terms ? terms.rows.slice(0, 4).map(row => `
        <tr>
          <td class="rp-name" title="${esc(row.name)}">${esc(capitalize(row.name))}</td>
          <td class="num">${count(row.impressions)}</td>
          <td class="num">${count(row.clicks)}</td>
          <td class="num">${percent1(row.ctr)}</td>
        </tr>`).join('') : '';
    const termsCard = terms
      ? `<table class="rp-table rp-terms">
          <colgroup><col><col style="width:18%"><col style="width:15%"><col style="width:15%"></colgroup>
          <thead><tr><th>Categoría de búsqueda</th><th class="num">Impr.</th><th class="num">Clics</th><th class="num">CTR</th></tr></thead>
          <tbody>${termRows}</tbody>
        </table>`
      : '<p class="rp-empty">Sin informe de términos de búsqueda en Drive: súbelo a la carpeta Segmentación para ver qué buscan los que ven los anuncios.</p>';
    const termsSub = terms
      ? `${terms.count} categorías de intención · ${terms.exact ? 'del periodo' : rangeText(terms.from, terms.to, true, false)}`
      : 'Qué buscan quienes ven los anuncios';
    return `
      <section class="rp-page rp-page-tables">
        ${head('Conjuntos de anuncios', suggestGroupsSub(report), labels.chip, notes, 'conjuntos:sub')}
        <div class="rp-body">
          <div class="rp-grid-4">${cards.join('')}</div>
          <div class="rp-cols">
            <div class="rp-stack">
              <div class="rp-card rp-table-card">
                ${cardHead('search', 'Palabras clave por conjunto', groups.length ? 'Cada conjunto con los términos que corrieron en él' : 'El informe del periodo no reparte por conjunto')}
                <table class="rp-table rp-groups">
                  <colgroup>${widths.map(width => `<col${width ? ` style="width:${width}"` : ''}>`).join('')}</colgroup>
                  <thead><tr>${cols.map(([label, numeric]) => `<th${numeric ? ' class="num"' : ''}>${esc(label)}</th>`).join('')}</tr></thead>
                  <tbody>${groupRows || empty}</tbody>
                </table>
              </div>
              ${highlight('conjuntos:destacado', noteOr(notes, 'conjuntos:destacado', suggestGroupsHighlight(report)))}
            </div>
            <div class="rp-stack">
              <div class="rp-card rp-table-card">
                ${cardHead('bars', 'Términos de búsqueda', termsSub)}
                ${termsCard}
              </div>
              ${analysis('conjuntos:analisis', noteOr(notes, 'conjuntos:analisis', suggestGroupsAnalysis(report)))}
            </div>
          </div>
        </div>
        ${footer(labels.source, report, 5)}
      </section>`;
  }

  function keywordsPage(report, notes) {
    const { labels } = report;
    const kw = report.keywords;
    const { leader, total, average } = keywordFacts(report);
    const kwChip = rangeText(kw.range.from, kw.range.to, true);
    const leaderQuality = leader ? qualityOf(report, leader.keyword) : null;
    const leaderCtr = leader ? leader.ctr : null;
    const cards = leader ? [
      stat('Término líder', `<span class="rp-stat-term">${esc(leader.keyword)}</span>`, `${count(leader.conversions)} de ${count(total)} leads`),
      stat('CPL del líder', money(leader.costPerConversion), versusAverage(leader.costPerConversion, average, true), isNum(average) && leader.costPerConversion <= average ? 'Más eficiente' : ''),
      stat('Clics del líder', kw.hasMetrics ? count(leader.clicks) : '—', kw.hasMetrics && kw.totals.clicks > 0 ? `${Math.round((leader.clicks / kw.totals.clicks) * 100)}% del tráfico` : 'Clics del término'),
      stat('CTR del líder', percent1(leaderCtr), isNum(leaderCtr) && isNum(kw.totals.ctr) ? (leaderCtr >= kw.totals.ctr ? 'Alta intención' : 'Intención media') : 'Clics ÷ impresiones'),
    ] : [
      stat('Término líder', '—', 'Sin leads por palabra clave'),
      stat('CPL del líder', '—', 'Inversión ÷ leads'),
      stat('Clics del líder', '—', 'Clics del término'),
      stat('CTR del líder', '—', 'Clics ÷ impresiones'),
    ];
    const shown = kw.rows.slice(0, MAX_KEYWORDS);
    const metric = value => (kw.hasMetrics ? value : '—');
    const body = shown.length ? shown.map(row => {
      const zero = !(row.conversions > 0);
      const quality = qualityOf(report, row.keyword);
      return `<tr${row === leader ? ' class="rp-top"' : ''}>
        <td class="rp-name" title="${esc(row.keyword)}">${esc(row.keyword)}</td>
        <td class="num">${metric(count(row.clicks))}</td>
        <td class="num">${zero ? '0' : count(row.conversions)}</td>
        <td class="num">${zero || !isNum(row.costPerConversion) ? '—' : money(row.costPerConversion)}</td>
        <td class="num">${metric(percent1(row.ctr))}</td>
        <td class="num">${quality ? `${quality}/10` : '—'}</td>
      </tr>`;
    }).join('') : `<tr><td colspan="6" class="rp-empty">Sin informe de palabras clave que cubra ${esc(labels.period)}.</td></tr>`;
    const campaignName = report.campaigns.length === 1 ? report.campaigns[0].toLowerCase().replace(/(^|\s)\S/g, letter => letter.toUpperCase()) : '';
    const totalRow = shown.length ? `<tr class="rp-total">
        <td>Total · ${esc(campaignName ? `campaña ${campaignName}` : `${report.campaigns.length} campañas`)}</td>
        <td class="num">${metric(count(kw.totals.clicks))}</td>
        <td class="num">${count(kw.totals.conversions)}</td>
        <td class="num">${money(kw.totals.costPerConversion)}</td>
        <td class="num">${metric(percent(kw.totals.ctr))}</td>
        <td class="num">—</td>
      </tr>` : '';
    return `
      <section class="rp-page">
        ${head('Palabras clave', suggestKeywordSub(report), kwChip, notes, 'kw:sub')}
        <div class="rp-body">
          <div class="rp-grid-4">${cards.join('')}</div>
          <div class="rp-cols">
            <div class="rp-stack">
              <div class="rp-card rp-chart-card">
                ${cardHead('', 'Leads por palabra clave', 'Dónde se concentran los contactos', legend([['Leads', CLICKS_COLOR]]))}
                ${keywordBars(report)}
              </div>
              ${highlight('kw:destacado', noteOr(notes, 'kw:destacado', suggestKeywordHighlight(report)))}
            </div>
            <div class="rp-stack">
              <div class="rp-card rp-table-card">
                <table class="rp-table rp-keywords">
                  <colgroup><col><col style="width:11%"><col style="width:11%"><col style="width:13%"><col style="width:11%"><col style="width:13%"></colgroup>
                  <thead><tr><th>Palabra clave</th><th class="num">Clics</th><th class="num">Leads</th><th class="num">CPL</th><th class="num">CTR</th><th class="num">Calidad</th></tr></thead>
                  <tbody>${body}${totalRow}</tbody>
                </table>
                ${editable('kw:nota', noteOr(notes, 'kw:nota', suggestKeywordNote(report)), 'p', 'rp-table-foot')}
              </div>
              ${analysis('kw:analisis', noteOr(notes, 'kw:analisis', suggestKeywordAnalysis(report)))}
            </div>
          </div>
        </div>
        ${footer(`Fuente: Google Ads · ${kwChip}`, report, 6)}
      </section>`;
  }

  function adPage(report, notes) {
    const { labels } = report;
    const ad = key => noteOr(notes, key, AD_DEFAULTS[key]);
    const links = Array.from({ length: AD_LINKS }, (_, index) => editable(`ad:link:${index}`, ad(`ad:link:${index}`), 'span', 'rp-ad-link')).join('');
    const rows = qualityRows(report);
    const quality = rows.length
      ? `<div class="rp-quality">${rows.map(row => `
          <div class="rp-quality-row">
            <span title="${esc(row.keyword)}">${esc(shorten(row.keyword, 26))}</span>
            <i><b style="width:${row.quality * 10}%"></b></i>
            <em>${row.quality}/10</em>
          </div>`).join('')}</div>`
      : '<p class="rp-empty">Sin nivel de calidad en los informes de palabras clave.</p>';
    return `
      <section class="rp-page">
        ${head('Anuncio y calidad', 'El anuncio responsivo activo y su calidad en Google: eficacia del anuncio y nivel de calidad por término.', labels.chip)}
        <div class="rp-body">
          <div class="rp-cols rp-cols-top">
            <div class="rp-stack">
              <div class="rp-card">
                ${cardHead('search', 'Anuncio de búsqueda activo', 'Vista previa del anuncio responsivo')}
                <div class="rp-ad">
                  <div class="rp-ad-top"><b>Anuncio</b>${editable('ad:url', ad('ad:url'), 'span')}</div>
                  ${editable('ad:titulo', ad('ad:titulo'), 'div', 'rp-ad-title')}
                  ${editable('ad:desc', ad('ad:desc'), 'p', 'rp-ad-desc')}
                  <div class="rp-ad-links">${links}</div>
                </div>
              </div>
              <div class="rp-strength">
                <span class="rp-icon framed">${icon('star')}</span>
                <div>
                  <h3>Eficacia del anuncio: ${editable('ad:eficacia', ad('ad:eficacia'), 'span')}</h3>
                  ${editable('ad:eficacia-texto', ad('ad:eficacia-texto'))}
                </div>
              </div>
              ${highlight('anuncio:destacado', noteOr(notes, 'anuncio:destacado', suggestAdHighlight(report, notes)))}
            </div>
            <div class="rp-stack">
              <div class="rp-card">
                ${cardHead('star', 'Nivel de calidad por término', 'Puntaje de Google (0–10)')}
                ${quality}
              </div>
              ${analysis('anuncio:analisis', noteOr(notes, 'anuncio:analisis', suggestAdAnalysis(report, notes)))}
            </div>
          </div>
        </div>
        ${footer(`${labels.source} · calidad de anuncios de Google Ads`, report, 7)}
      </section>`;
  }

  function conclusionsPage(report, notes) {
    const { labels } = report;
    const split = leadSplit(report);
    const cards = suggestConclusions(report, notes, split).map((card, index) => `
      <div class="rp-card rp-conclusion">
        <div class="rp-toc-top"><span class="rp-icon framed">${icon(card.icon)}</span><span class="rp-concl-num">${pageNumber(index + 1)}</span></div>
        ${editable(`concl:${index}:title`, noteOr(notes, `concl:${index}:title`, card.title), 'h3')}
        ${editable(`concl:${index}:text`, noteOr(notes, `concl:${index}:text`, card.text))}
      </div>`).join('');
    const steps = suggestSteps(report).map((step, index) => `
      <div class="rp-step${index === 0 ? ' on' : ''}">
        <span class="rp-step-icon">${icon(step.icon)}</span>
        <div>
          ${editable(`paso:${index}:title`, noteOr(notes, `paso:${index}:title`, step.title), 'b')}
          ${editable(`paso:${index}:text`, noteOr(notes, `paso:${index}:text`, step.text))}
        </div>
      </div>`).join('');
    const periodNote = `**Periodo:** ${labels.periodLong}. ${CRM_NOTE}${labels.note ? ` ${labels.note}` : ''}`;
    return `
      <section class="rp-page">
        ${head('Conclusiones y próximos pasos', labels.conclusionsSub)}
        <div class="rp-body">
          <div class="rp-grid-3 rp-conclusions">${cards}</div>
          <div class="rp-card rp-steps">
            <div class="rp-steps-head">${icon('flag')}<b>Próximos pasos</b></div>
            <div class="rp-steps-list">${steps}</div>
          </div>
          ${editable('periodo:nota', noteOr(notes, 'periodo:nota', periodNote), 'div', 'rp-note')}
        </div>
        ${footer(labels.analysisSource, report, 8)}
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

  function wireEditables(host, periodId) {
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
        saveNote(periodId, node.dataset.note, node.dataset.raw);
      });
      node.addEventListener('blur', () => {
        node.innerHTML = rich(node.dataset.raw);
        // Al salir del texto se sube sin esperar la pausa.
        const id = `${bucketOf(periodId, node.dataset.note)}|${node.dataset.note}`;
        if (shared.pending.get(id)?.timer) flushShared(id);
      });
    });
  }

  // El periodo elegido del tipo activo (por defecto, el ultimo cerrado; si no hay ninguno, el que esta en curso).
  function selectedItem() {
    const available = periods(state.type);
    const id = state.selected[state.type];
    const item = available.find(entry => entry.id === id) || available.find(entry => entry.closed) || available[0] || null;
    if (item) state.selected[state.type] = item.id;
    return { available, item };
  }

  function render() {
    const host = document.getElementById('week-report');
    if (!host || !G()) return;
    document.querySelectorAll('[data-week-type]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.weekType === state.type)));
    const { available, item } = selectedItem();
    const select = document.getElementById('week-select');
    if (!item) {
      const waiting = state.type !== 'semana' && seriesDays().length;
      const empty = state.type === 'mes'
        ? { option: 'Sin meses cerrados', title: 'Todavía no cierra ningún mes', text: 'El reporte mensual va del 1 al último día del mes: aparece aquí cuando termine el primero.' }
        : { option: 'Sin cortes cerrados', title: 'Todavía no cierra ninguna semana', text: 'El acumulado del mes va del 1 a cada domingo: aparece aquí cuando termine la primera semana.' };
      if (select) select.innerHTML = `<option value="">${waiting ? empty.option : 'Sin semanas con datos'}</option>`;
      host.innerHTML = waiting
        ? `<div class="panel"><div class="empty-state"><strong>${empty.title}</strong><span>${empty.text}</span></div></div>`
        : '<div class="panel"><div class="empty-state"><strong>Todavía no hay datos para el reporte</strong><span>El reporte se arma con los informes de Google Ads. En cuanto haya una semana con inversión, aparece aquí.</span></div></div>';
      return;
    }
    if (select) {
      // Un grupo por mes, del mas reciente al mas antiguo.
      const months = [...new Set(available.map(entry => entry.month))];
      select.innerHTML = months.map(month => `<optgroup label="${esc(monthTitle(`${month}-01`))}">${available
        .filter(entry => entry.month === month)
        .map(entry => `<option value="${esc(entry.id)}"${entry.id === item.id ? ' selected' : ''}>${esc(entry.option)}</option>`).join('')}</optgroup>`).join('');
    }
    const source = document.getElementById('week-source');
    if (source) {
      const files = [...new Set(G().months().filter(month => month.source === 'Drive' && month.key >= item.from.slice(0, 7) && month.key <= item.to.slice(0, 7)).map(month => month.sourceFile))];
      source.textContent = `Fuente: ${files.length ? `Google Drive (${files.join(', ')})` : 'informes de Google Ads del repositorio'}`;
    }

    const report = buildReport(item);
    const notes = notesFor(item.id);
    host.innerHTML = `
      <div class="rp-deck" id="week-doc">
        ${coverPage(report)}
        ${contentsPage(report)}
        ${summaryPage(report, notes)}
        ${campaignsPage(report, notes)}
        ${adGroupsPage(report, notes)}
        ${keywordsPage(report, notes)}
        ${adPage(report, notes)}
        ${conclusionsPage(report, notes)}
        ${closingPage()}
      </div>`;
    fitDeck();
    wireEditables(host, item.id);
  }

  // El nombre del PDF lo pone el navegador con el titulo del documento: se cambia solo mientras imprime.
  function printReport() {
    const { item } = selectedItem();
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

  // Cada vez que se abre la pestana se leen los textos del equipo; si cambiaron, se repinta (salvo que alguien
  // este escribiendo sobre la lamina: lo nuevo aparece en el proximo pintado).
  function refreshShared() {
    loadShared().then(changed => {
      if (changed && !document.activeElement?.closest?.('[data-note]')) render();
    });
  }

  window.TierraFilmsWeekReport = {
    init() {
      render();
      refreshShared();
      if (state.wired) return;
      state.wired = true;
      window.addEventListener('pagehide', beaconPending);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') beaconPending(); });
      document.querySelectorAll('[data-week-type]').forEach(button => {
        button.addEventListener('click', () => {
          if (state.type === button.dataset.weekType) return;
          state.type = button.dataset.weekType;
          render();
        });
      });
      const select = document.getElementById('week-select');
      if (select) {
        select.addEventListener('change', event => {
          state.selected[state.type] = event.target.value;
          render();
        });
      }
      const print = document.getElementById('week-print');
      if (print) print.addEventListener('click', printReport);
      // Sin dialogo de confirmacion: el boton vuelve directo a los textos propuestos del periodo (el anuncio queda).
      const reset = document.getElementById('week-reset');
      if (reset) {
        reset.addEventListener('click', () => {
          const { item } = selectedItem();
          if (!item) return;
          resetNotes(item.id);
          // La copia del navegador ya quedo sin los textos: se repinta sin esperar a la hoja.
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
