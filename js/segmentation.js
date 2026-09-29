(function () {
  // Modulo Segmentacion | informes de la carpeta Google Ads TF Segmentacion:
  // "Estadisticas de los terminos de busqueda" (categorias de busqueda de una semana contra la anterior)
  // e "Informe de ubicaciones" (conversiones por ciudad). Con ellos arma vistas para decidir
  // a que intencion de busqueda y a que zona apuntar la cuenta.
  const F = () => window.TierraFilmsFormat;
  const METRIC_COLORS = { impressions: '#0284c7', clicks: '#7c3aed', conversions: '#d97706' };
  const DEMAND_TOP = 12;
  const MIN_IMPRESSIONS_TO_JUDGE = 10;

  // Segmentos de intencion. Google Ads agrupa lo buscado en categorias; el tablero las junta por
  // intencion con estas reglas (se prueban en orden y gana la primera que calza).
  const SEGMENTS = [
    { id: 'marca', label: 'Marca Tierra Films', test: /tierra\s*films/, about: 'Buscan a Tierra Films por su nombre.' },
    { id: 'competencia', label: 'Competidores y herramientas IA', test: /vidrush|vidnoz|topview|maracuy|djez|flama|yioo?w|fuel your|buzz marketing|gpo vallas|contacto producciones/, about: 'Buscan otra marca o una app para hacer videos solos.' },
    { id: 'agencias', label: 'Agencias y marketing', test: /agencia|marketing|btl|contenido|dise[ñn]o/, about: 'Buscan una agencia; puede ser un cliente B2B o alguien que no busca produccion.' },
    { id: 'formatos', label: 'Formatos de video', test: /v[ií]deo|spot|brochure|promocional/, about: 'Piden un tipo de pieza: corporativo, institucional, spot, promocional.' },
    { id: 'productoras', label: 'Productoras y produccion', test: /productor|producci|realizador|casas|grabaci|audiovisual/, about: 'Buscan una productora o el servicio de produccion audiovisual.' },
    { id: 'publicidad', label: 'Publicidad generica', test: /publicid|publicitari|anuncio|\bads\b|creamos/, about: 'Terminos amplios de publicidad y anuncios.' },
    { id: 'otros', label: 'Otras busquedas', test: /.*/, about: 'Categorias que no calzan en los grupos anteriores.' }
  ];
  const UNCLASSIFIED = { id: 'sin-clasificar', label: 'Sin clasificar', about: 'Busquedas que Google Ads no agrupo en ninguna categoria.' };

  const ACTIONS = {
    priorizar: { label: 'Priorizar', cls: 'act-good', why: 'Ya trae conversiones: darle grupo de anuncios propio y mas presupuesto.' },
    ampliar: { label: 'Ampliar', cls: 'act-brand', why: 'CTR sobre el promedio de la cuenta: sumar sus terminos como palabras clave de frase o exacta.' },
    proteger: { label: 'Proteger marca', cls: 'act-brand', why: 'Busqueda de marca: mantenerla cubierta con un anuncio de marca.' },
    intencion: { label: 'Revisar intencion', cls: 'act-warn', why: 'Puede ser una agencia que contrata produccion o alguien que busca una agencia: revisar los terminos antes de invertir o excluir.' },
    revisar: { label: 'Revisar anuncio', cls: 'act-warn', why: `${MIN_IMPRESSIONS_TO_JUDGE}+ impresiones sin clics: el anuncio no conecta con esa busqueda; ajustar el texto o excluirla.` },
    excluir: { label: 'Negativa candidata', cls: 'act-bad', why: 'Busca otra marca o una herramienta de IA: agregar como palabra clave negativa.' },
    vigilar: { label: 'Vigilar', cls: 'act-muted', why: 'Tiene clics pero con CTR bajo el promedio: esperar mas semanas antes de decidir.' },
    poca: { label: 'Poca data', cls: 'act-muted', why: `Menos de ${MIN_IMPRESSIONS_TO_JUDGE} impresiones en la semana: todavia no alcanza para decidir.` }
  };
  const ACTION_ORDER = ['priorizar', 'ampliar', 'proteger', 'intencion', 'revisar', 'excluir', 'vigilar', 'poca'];

  const state = { segment: 'all', action: 'all', showAllDemand: false };

  const pct = (value, digits = 0) => (Number.isFinite(value) ? `${(value * 100).toLocaleString('es-PE', { maximumFractionDigits: digits })}%` : '-');
  const share = (part, total) => (total ? part / total : 0);
  const normalize = text => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function rangeLabel(start, end) {
    const f = F();
    const [ys, ms, ds] = start.split('-').map(Number);
    const [ye, me] = end.split('-').map(Number);
    const head = ys === ye && ms === me ? String(ds) : f.shortDate(start);
    return `${head} - ${f.shortDate(end)} ${ye}`;
  }

  function segmentOf(item) {
    if (item.unclassified) return UNCLASSIFIED;
    const name = normalize(item.name);
    return SEGMENTS.find(segment => segment.test.test(name) || segment.test.test(item.name.toLowerCase()));
  }

  // "100 - 1,000" (o "100 - 1.000") -> punto medio geometrico del rango, para ordenar por demanda.
  function volumeMid(text) {
    const bounds = String(text || '').split('-').map(part => Number(part.replace(/[^\d]/g, ''))).filter(Number.isFinite);
    if (bounds.length !== 2) return null;
    const [lo, hi] = bounds;
    return lo > 0 ? Math.sqrt(lo * hi) : hi / 2;
  }

  function actionFor(item, segment, avgCtr) {
    if (item.conversions > 0) return 'priorizar';
    if (segment.id === 'marca') return 'proteger';
    if (segment.id === 'competencia') return 'excluir';
    if (segment.id === 'agencias' && item.impressions) return 'intencion';
    if (item.clicks > 0 && item.ctr >= avgCtr) return 'ampliar';
    if (item.impressions >= MIN_IMPRESSIONS_TO_JUDGE && !item.clicks) return 'revisar';
    if (item.clicks > 0) return 'vigilar';
    return 'poca';
  }

  function build(terms) {
    const categories = terms.categories.map(item => {
      const segment = segmentOf(item);
      return Object.assign({}, item, { segment, mid: volumeMid(item.volume), ctr: item.impressions ? item.clicks / item.impressions : null });
    });
    const totals = ['impressions', 'clicks', 'conversions'].reduce((out, key) => {
      out[key] = categories.reduce((sum, item) => sum + (item[key] || 0), 0);
      return out;
    }, {});
    totals.ctr = totals.impressions ? totals.clicks / totals.impressions : 0;
    totals.convRate = totals.clicks ? totals.conversions / totals.clicks : 0;
    categories.forEach(item => { item.action = item.unclassified ? null : actionFor(item, item.segment, totals.ctr); });

    const segments = [...SEGMENTS, UNCLASSIFIED].map(segment => {
      const items = categories.filter(item => item.segment === segment);
      const sum = key => items.reduce((total, item) => total + (item[key] || 0), 0);
      const out = { segment, items, count: items.length, impressions: sum('impressions'), clicks: sum('clicks'), conversions: sum('conversions') };
      out.ctr = out.impressions ? out.clicks / out.impressions : null;
      out.convRate = out.clicks ? out.conversions / out.clicks : null;
      out.volume = items.reduce((total, item) => total + (item.mid || 0), 0);
      // Tendencia de la demanda del segmento: cambio del volumen ponderado por el tamano de cada categoria.
      const weighted = items.filter(item => item.mid && Number.isFinite(item.volumeChange));
      const weight = weighted.reduce((total, item) => total + item.mid, 0);
      out.volumeChange = weight ? weighted.reduce((total, item) => total + item.volumeChange * item.mid, 0) / weight : null;
      return out;
    }).filter(item => item.count);
    return { categories, totals, segments };
  }

  function verdictFor(row, avgCtr) {
    const id = row.segment.id;
    if (id === 'sin-clasificar') return { label: 'Abrir a nivel termino', cls: 'act-warn' };
    // Convierte pero con CTR bajo el promedio: quedarse con lo que convierte y cortar el resto.
    if (row.conversions > 0) return row.ctr >= avgCtr ? { label: 'Invertir', cls: 'act-good' } : { label: 'Acotar', cls: 'act-warn' };
    if (id === 'competencia') return { label: 'Excluir', cls: 'act-bad' };
    if (id === 'marca') return { label: 'Proteger', cls: 'act-brand' };
    if (id === 'agencias') return { label: 'Revisar intencion', cls: 'act-warn' };
    if (row.impressions && row.ctr >= avgCtr) return { label: 'Ampliar', cls: 'act-brand' };
    if (row.impressions >= MIN_IMPRESSIONS_TO_JUDGE) return { label: 'Optimizar anuncios', cls: 'act-warn' };
    return { label: 'Poca data', cls: 'act-muted' };
  }

  function changeCell(value) {
    if (value === Infinity) return '<td class="num delta-cell up">nuevo</td>';
    if (!Number.isFinite(value)) return '<td class="num delta-cell">-</td>';
    const cls = Math.abs(value) < 0.005 ? '' : value > 0 ? 'up' : 'down';
    return `<td class="num delta-cell ${cls}">${value > 0 ? '+' : ''}${pct(value)}</td>`;
  }

  function actionPill(id) {
    const action = ACTIONS[id];
    return action ? `<span class="act-pill ${action.cls}" title="${F().escapeHtml(action.why)}">${action.label}</span>` : '<span class="no-data">-</span>';
  }

  function renderKpis(model, places) {
    const f = F();
    const loose = model.segments.find(row => row.segment.id === 'sin-clasificar');
    const lima = places ? places.places.find(place => /^lima$/i.test(place.name)) : null;
    const placeTotal = places ? places.places.reduce((sum, place) => sum + place.conversions, 0) : 0;
    const cards = [
      ['Impresiones', f.fmtCount(model.totals.impressions), 'Semana del informe de terminos'],
      ['Clics', f.fmtCount(model.totals.clicks), `CTR ${pct(model.totals.ctr, 1)}`],
      ['Conversiones', f.fmtCount(model.totals.conversions), `Tasa de conv. ${pct(model.totals.convRate, 1)}`],
      ['Categorias con impresiones', f.fmtCount(model.categories.filter(item => !item.unclassified && item.impressions).length), `${model.segments.filter(row => row.segment.id !== 'sin-clasificar').length} segmentos de intencion`],
      ['Sin clasificar', pct(share(loose ? loose.impressions : 0, model.totals.impressions)), 'De las impresiones de la semana'],
      ['Conversiones en Lima', lima ? pct(share(lima.conversions, placeTotal)) : '-', places ? `${f.fmtCount(placeTotal)} conv. con ubicacion` : 'Falta el informe de ubicaciones']
    ];
    document.getElementById('seg-kpis').innerHTML = cards
      .map(([label, value, meta]) => `<div class="kpi-pill"><span>${label}</span><strong>${value}</strong><small>${meta}</small></div>`)
      .join('');
  }

  // Hallazgos que salen directo de los numeros; cada uno termina en una decision de segmentacion.
  function renderDiagnosis(model, places) {
    const f = F();
    const e = f.escapeHtml;
    const items = [];
    const bySeg = id => model.segments.find(row => row.segment.id === id);
    const loose = bySeg('sin-clasificar');
    if (loose && loose.impressions) {
      items.push(`<b>${pct(share(loose.impressions, model.totals.impressions))} de las impresiones y ${f.fmtCount(loose.conversions)} de ${f.fmtCount(model.totals.conversions)} conversiones</b> vienen de busquedas que Google no agrupo en categorias. Para segmentar con precision conviene sumar a la carpeta el informe de terminos de busqueda a nivel termino (no por categoria).`);
    }
    const classified = model.segments.filter(row => row.segment.id !== 'sin-clasificar');
    const best = classified.filter(row => row.impressions).sort((a, b) => b.conversions - a.conversions || (b.ctr || 0) - (a.ctr || 0))[0];
    if (best) {
      const top = best.items.filter(item => item.conversions || item.clicks).sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks).slice(0, 3).map(item => `"${e(item.name)}"`);
      items.push(`<b>${e(best.segment.label)}</b> es el segmento mas rentable: ${pct(share(best.impressions, model.totals.impressions))} de las impresiones, CTR ${pct(best.ctr, 1)} y ${f.fmtCount(best.conversions)} conversiones${top.length ? ` (${top.join(', ')})` : ''}. Es el nucleo de la segmentacion.`);
    }
    const rival = bySeg('competencia');
    if (rival && rival.impressions) {
      const names = rival.items.filter(item => item.impressions).sort((a, b) => b.impressions - a.impressions).slice(0, 5).map(item => e(item.name));
      items.push(`<b>${f.fmtCount(rival.impressions)} impresiones y ${f.fmtCount(rival.clicks)} clics</b> fueron a busquedas de otras marcas o apps de IA (${names.join(', ')}), sin conversiones. Son negativas candidatas.`);
    }
    const agencies = bySeg('agencias');
    if (agencies && agencies.impressions) {
      items.push(`<b>Agencias y marketing</b> sumo ${f.fmtCount(agencies.impressions)} impresiones y ${f.fmtCount(agencies.clicks)} clics (CTR ${pct(agencies.ctr, 1)}) y ${f.fmtCount(agencies.conversions)} conversiones. Hay que decidir si las agencias son un publico B2B a atacar con un anuncio propio o si se excluyen.`);
    }
    const rising = model.categories
      .filter(item => !['competencia', 'sin-clasificar'].includes(item.segment.id) && item.mid >= 100 && Number.isFinite(item.volumeChange) && item.volumeChange >= 0.1)
      .sort((a, b) => b.volumeChange - a.volumeChange)
      .slice(0, 4);
    if (rising.length) {
      items.push(`La demanda crece en ${rising.map(item => `"${e(item.name)}" (+${pct(item.volumeChange)})`).join(', ')}: son las categorias con volumen de 100+ busquedas que mas subieron contra la semana anterior.`);
    }
    if (places && places.places.length) {
      const total = places.places.reduce((sum, place) => sum + place.conversions, 0);
      const list = places.places.map(place => `${e(place.name)} ${f.fmtCount(place.conversions)} (${pct(share(place.conversions, total))})`).join(', ');
      const gap = places.account && places.located ? places.account.cost - places.located.cost : 0;
      items.push(`Todas las conversiones con ubicacion vienen de <b>${list}</b>.${gap > 0 ? ` ${f.fmtMoney(gap)} (${pct(share(gap, places.account.cost), 1)} del gasto) no tiene ubicacion identificada.` : ''} La segmentacion geografica puede quedar en Lima Metropolitana y Callao.`);
    }
    document.getElementById('seg-diagnosis').innerHTML = items.map(text => `<li>${text}</li>`).join('');
  }

  // Participacion de cada segmento en impresiones, clics y conversiones: si un segmento se lleva
  // mas conversiones que impresiones, rinde por encima de su peso.
  function renderSegments(model) {
    const f = F();
    const e = f.escapeHtml;
    const t = model.totals;
    const metrics = [['impressions', 'Impresiones'], ['clicks', 'Clics'], ['conversions', 'Conversiones']];
    document.getElementById('seg-legend').innerHTML = metrics
      .map(([key, label]) => `<span><i class="legend-line" style="background:${METRIC_COLORS[key]}"></i><b>${label}</b></span>`).join('');
    const rows = [...model.segments].sort((a, b) => (a.segment.id === 'sin-clasificar') - (b.segment.id === 'sin-clasificar') || b.conversions - a.conversions || b.impressions - a.impressions);
    document.getElementById('seg-bars').innerHTML = rows.map(row => {
      const bars = metrics.map(([key, label]) => {
        const value = share(row[key], t[key]);
        return `<div class="seg-bar" title="${e(row.segment.label)} | ${label}: ${f.fmtCount(row[key])} de ${f.fmtCount(t[key])} (${pct(value, 1)})"><span class="seg-track"><i style="width:${(value * 100).toFixed(2)}%;background:${METRIC_COLORS[key]}"></i></span><em>${pct(value)}</em></div>`;
      }).join('');
      const active = state.segment === row.segment.id;
      return `<button type="button" class="seg-row${active ? ' active' : ''}${row.segment.id === 'sin-clasificar' ? ' is-loose' : ''}" data-seg="${row.segment.id}" aria-pressed="${active}">
        <span class="seg-label"><strong>${e(row.segment.label)}</strong><small>${row.count} ${row.count === 1 ? 'categoria' : 'categorias'}</small></span>
        <span class="seg-bars">${bars}</span>
      </button>`;
    }).join('');

    document.getElementById('seg-body').innerHTML = rows.map(row => {
      const verdict = verdictFor(row, t.ctr);
      return `<tr class="${row.segment.id === 'sin-clasificar' ? 'is-loose' : ''}">
        <td class="campaign-name">${e(row.segment.label)}<small class="seg-about">${e(row.segment.about)}</small></td>
        <td class="num">${row.count}</td>
        <td class="num">${f.fmtCount(row.impressions)}</td>
        <td class="num">${pct(share(row.impressions, t.impressions), 1)}</td>
        <td class="num">${f.fmtCount(row.clicks)}</td>
        <td class="num">${row.impressions ? pct(row.ctr, 1) : '-'}</td>
        <td class="num">${f.fmtCount(row.conversions)}</td>
        <td class="num">${row.clicks ? pct(row.convRate, 1) : '-'}</td>
        ${changeCell(row.volumeChange)}
        <td><span class="act-pill ${verdict.cls}">${verdict.label}</span></td>
      </tr>`;
    }).join('') + `<tr class="reservations-total-row"><td class="total-label">Total</td><td class="num">${model.categories.length}</td><td class="num">${f.fmtCount(t.impressions)}</td><td class="num">100%</td><td class="num">${f.fmtCount(t.clicks)}</td><td class="num">${pct(t.ctr, 1)}</td><td class="num">${f.fmtCount(t.conversions)}</td><td class="num">${pct(t.convRate, 1)}</td><td></td><td></td></tr>`;
  }

  function renderCategories(model) {
    const f = F();
    const e = f.escapeHtml;
    const list = model.categories.filter(item => !item.unclassified);
    const counts = ACTION_ORDER.map(id => [id, list.filter(item => item.action === id).length]).filter(([, count]) => count);
    const chips = [['all', 'Todas', list.length], ...counts.map(([id, count]) => [id, ACTIONS[id].label, count])];
    document.getElementById('seg-actions').innerHTML = chips
      .map(([id, label, count]) => `<button type="button" class="seg-chip${state.action === id ? ' active' : ''}" data-action="${id}" aria-pressed="${state.action === id}">${label} <b>${count}</b></button>`).join('');
    const segment = model.segments.find(row => row.segment.id === state.segment);
    const visible = list
      .filter(item => state.action === 'all' || item.action === state.action)
      .filter(item => state.segment === 'all' || item.segment.id === state.segment)
      .sort((a, b) => ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action) || b.conversions - a.conversions || b.impressions - a.impressions);
    const filters = [segment && segment.segment.id !== 'sin-clasificar' ? segment.segment.label : '', state.action !== 'all' ? ACTIONS[state.action].label : ''].filter(Boolean);
    document.getElementById('seg-cat-sub').innerHTML = filters.length
      ? `Filtrado por ${filters.map(e).join(' y ')}. <button type="button" class="link-btn" data-seg-clear>Quitar filtros</button>`
      : 'Cada categoria con su segmento y la accion sugerida. Pasa el mouse sobre la accion para ver por que.';
    document.getElementById('seg-cat-body').innerHTML = visible.length ? visible.map(item => `<tr class="${item.impressions ? '' : 'is-muted'}">
        <td class="campaign-name">${e(item.name)}</td>
        <td><span class="match-pill">${e(item.segment.label)}</span></td>
        <td class="num">${f.fmtCount(item.impressions)}</td>${changeCell(item.impressionsChange)}
        <td class="num">${f.fmtCount(item.clicks)}</td>
        <td class="num">${item.impressions ? pct(item.ctr, 1) : '-'}</td>
        <td class="num">${f.fmtCount(item.conversions)}</td>
        <td class="num">${e(item.volume || '-')}</td>${changeCell(item.volumeChange)}
        <td>${actionPill(item.action)}</td>
      </tr>`).join('') : '<tr><td class="table-empty" colspan="10">Ninguna categoria con ese filtro.</td></tr>';
  }

  // Demanda del mercado: volumen de busquedas de cada categoria relevante y cuanto cambio.
  function renderDemand(model) {
    const f = F();
    const e = f.escapeHtml;
    const list = model.categories
      .filter(item => item.mid && !['competencia', 'sin-clasificar'].includes(item.segment.id))
      .sort((a, b) => b.mid - a.mid || b.impressions - a.impressions);
    const visible = state.showAllDemand ? list : list.slice(0, DEMAND_TOP);
    const maxChange = Math.max(0.5, ...visible.map(item => Math.abs(Number.isFinite(item.volumeChange) ? item.volumeChange : 0)));
    const maxMid = Math.max(...visible.map(item => item.mid));
    document.getElementById('seg-demand').innerHTML = visible.map(item => {
      const change = Number.isFinite(item.volumeChange) ? item.volumeChange : 0;
      const width = Math.min(Math.abs(change) / maxChange, 1) * 50;
      const side = change >= 0 ? `left:50%;width:${width}%` : `right:50%;width:${width}%`;
      const volWidth = Math.max(Math.log10(item.mid + 1) / Math.log10(maxMid + 1), 0.04) * 100;
      return `<li title="${e(item.name)} | volumen ${e(item.volume)} busquedas | ${change >= 0 ? '+' : ''}${pct(change)} contra la semana anterior | ${f.fmtCount(item.impressions)} impresiones nuestras">
        <span class="demand-name">${e(item.name)}<small>${e(item.segment.label)}</small></span>
        <span class="demand-volume"><span class="seg-track"><i style="width:${volWidth.toFixed(1)}%;background:${METRIC_COLORS.impressions}"></i></span><em>${e(item.volume)}</em></span>
        <span class="demand-change"><span class="diverge"><i class="${change >= 0 ? 'up' : 'down'}" style="${side}"></i></span><em class="${Math.abs(change) < 0.005 ? '' : change > 0 ? 'up' : 'down'}">${change > 0 ? '+' : ''}${pct(change)}</em></span>
        <span class="demand-ours">${f.fmtCount(item.impressions)}<small>impr.</small></span>
      </li>`;
    }).join('');
    const more = document.getElementById('seg-demand-more');
    more.hidden = list.length <= DEMAND_TOP;
    more.textContent = state.showAllDemand ? `Ver solo las ${DEMAND_TOP} de mas volumen` : `Ver las ${list.length} categorias`;
  }

  function renderPlaces(places) {
    const f = F();
    const e = f.escapeHtml;
    const host = document.getElementById('seg-geo');
    if (!places || !places.places.length) {
      host.innerHTML = '<div class="data-notice"><strong>Falta el informe de ubicaciones.</strong>Sube a la carpeta Segmentacion el "Informe de ubicaciones" y aprieta Sincronizar.</div>';
      return;
    }
    const total = places.places.reduce((sum, place) => sum + place.conversions, 0);
    const loc = places.located;
    const acc = places.account;
    const gap = loc && acc ? { impressions: acc.impressions - loc.impressions, interactions: acc.interactions - loc.interactions, cost: acc.cost - loc.cost } : null;
    const actions = {};
    places.places.forEach(place => place.actions.forEach(action => { actions[action.name] = (actions[action.name] || 0) + action.conversions; }));
    const topAction = Object.entries(actions).sort((a, b) => b[1] - a[1])[0];
    const stats = [
      ['Conversiones', f.fmtCount(total), `${places.places.length} ${places.places.length === 1 ? 'ubicacion' : 'ubicaciones'}`],
      loc && acc ? ['Gasto con ubicacion', pct(share(loc.cost, acc.cost), 1), `${f.fmtMoney(loc.cost)} de ${f.fmtMoney(acc.cost)}`] : null,
      loc && loc.conversions ? ['Costo x conversion', f.fmtMoney(loc.cost / loc.conversions), 'Con ubicacion identificada'] : null,
      topAction ? ['Accion principal', pct(share(topAction[1], total)), e(topAction[0])] : null
    ].filter(Boolean);
    const rows = places.places.map(place => {
      const value = share(place.conversions, total);
      const detail = place.actions.map(action => `${e(action.name)} ${f.fmtCount(action.conversions)}`).join(' · ');
      return `<li>
        <div class="place-head"><span class="place-name" title="${e(place.full)}">${e(place.full)}</span><span class="place-value"><strong>${f.fmtCount(place.conversions)}</strong> conv. <small>${pct(value)}</small></span></div>
        <div class="place-bar"><i style="width:${(value * 100).toFixed(2)}%;background:${METRIC_COLORS.conversions}"></i></div>
        <div class="place-actions">${detail}</div>
      </li>`;
    }).join('');
    const gapRow = gap && gap.cost > 0.005
      ? `<li class="is-loose">
        <div class="place-head"><span class="place-name">Sin ubicacion identificada</span><span class="place-value"><strong>0</strong> conv.</span></div>
        <div class="place-bar"><i style="width:0"></i></div>
        <div class="place-actions">${f.fmtCount(gap.impressions)} impr. · ${f.fmtCount(gap.interactions)} interacciones · ${f.fmtMoney(gap.cost)}</div>
      </li>`
      : '';
    host.innerHTML = `
      <div class="drive-stats seg-geo-stats">${stats.map(([label, value, meta]) => `<div><span>${label}</span><strong>${value}</strong><small>${meta}</small></div>`).join('')}</div>
      <ul class="place-list">${rows}${gapRow}</ul>
      <div class="panel-note">Las conversiones vienen separadas por accion, asi que por ciudad el informe no trae impresiones ni costo; el gasto con ubicacion sale de las filas de total.</div>`;
    document.getElementById('seg-geo-sub').textContent = `${rangeLabel(places.start, places.end)} · Fuente: ${places.sourceFile}.`;
  }

  function render() {
    const data = window.TIERRA_FILMS_RETAIL_DATA;
    const view = document.getElementById('view-segmentation');
    if (!view || !data || !F()) return;
    const terms = data.searchTerms;
    const places = data.locations;
    const empty = document.getElementById('seg-empty');
    const body = document.getElementById('seg-body-wrap');
    const urls = (window.TierraFilmsDrive && window.TierraFilmsDrive.folderUrls) || {};
    const link = document.getElementById('seg-folder');
    if (link && urls.segmentacion) link.href = urls.segmentacion;
    if (!terms || !terms.categories || !terms.categories.length) {
      empty.hidden = false;
      body.hidden = true;
      return;
    }
    empty.hidden = true;
    body.hidden = false;
    const model = build(terms);
    const compare = terms.compareStart && terms.compareEnd ? ` contra ${rangeLabel(terms.compareStart, terms.compareEnd)}` : '';
    document.getElementById('seg-period').textContent = `Terminos de busqueda: ${rangeLabel(terms.start, terms.end)}${compare} · Ubicaciones: ${places ? rangeLabel(places.start, places.end) : 'sin informe'}`;
    document.getElementById('seg-segments-sub').textContent = `${rangeLabel(terms.start, terms.end)} · Participacion de cada segmento en el total de la semana. Haz clic en un segmento para ver sus categorias abajo.`;
    document.getElementById('seg-demand-sub').textContent = `Volumen mensual de busquedas que informa Google Ads y su cambio${compare}, sin competidores ni busquedas sin clasificar.`;
    renderKpis(model, places);
    renderDiagnosis(model, places);
    renderSegments(model);
    renderCategories(model);
    renderDemand(model);
    renderPlaces(places);
  }

  function wire() {
    const view = document.getElementById('view-segmentation');
    if (!view) return;
    view.addEventListener('click', event => {
      const seg = event.target.closest('[data-seg]');
      const action = event.target.closest('[data-action]');
      if (seg) {
        state.segment = state.segment === seg.dataset.seg ? 'all' : seg.dataset.seg;
        // "Sin clasificar" no tiene categorias que listar.
        if (state.segment === 'sin-clasificar') state.segment = 'all';
        render();
        if (state.segment !== 'all') document.getElementById('seg-categories').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (action) {
        state.action = action.dataset.action;
        render();
      } else if (event.target.closest('[data-seg-clear]')) {
        state.segment = 'all';
        state.action = 'all';
        render();
      } else if (event.target.closest('#seg-demand-more')) {
        state.showAllDemand = !state.showAllDemand;
        render();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
  window.addEventListener('tierra-films:data-ready', render);
  window.TierraFilmsSegmentation = { render, build };
})();
