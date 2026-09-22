(function () {
  const VIEW_KEY = 'tierra-films-active-view';
  const VIEW_META = {
    'view-obj': {
      title: 'Gasto Publicitario',
      caption: 'Google Ads',
      status: 'Datos semanales de Google Ads',
      source: 'Fuente: data/tierra-films-lima-retail-2026.json',
      footer: 'Resultados de Google Ads',
    },
    'view-projection': {
      title: 'Proyecciones',
      caption: 'Cierre de mes y metas',
      status: 'Proyeccion sobre datos reales',
      source: 'Fuente: data/tierra-films-lima-retail-2026.json',
      footer: 'Proyeccion lineal segun el ritmo elegido',
    },
    'view-messages': {
      title: 'Calculadora de Mensajes',
      caption: 'Planificación WhatsApp por CPL',
      status: 'Guardado automático',
      source: 'Cálculo local de inversión para campañas de Mensajes',
      footer: 'Datos guardados en este navegador',
    },
  };

  function storedView() {
    try {
      const value = window.localStorage.getItem(VIEW_KEY);
      return VIEW_META[value] ? value : 'view-obj';
    } catch {
      return 'view-obj';
    }
  }

  function saveView(viewId) {
    try {
      window.localStorage.setItem(VIEW_KEY, viewId);
    } catch {
      // La navegación sigue funcionando aunque localStorage no esté disponible.
    }
  }

  function showView(viewId) {
    const meta = VIEW_META[viewId] || VIEW_META['view-obj'];
    document.querySelectorAll('.view').forEach(view => {
      view.classList.toggle('visible', view.id === viewId);
    });
    document.querySelectorAll('[data-view-target]').forEach(button => {
      const active = button.dataset.viewTarget === viewId;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });

    document.getElementById('topbar-title').textContent = meta.title;
    document.getElementById('topbar-caption').textContent = meta.caption;
    document.getElementById('topbar-status').textContent = meta.status;
    document.getElementById('footer-source').textContent = meta.source;
    document.getElementById('footer-status').textContent = meta.footer;
    saveView(viewId);

    if (viewId === 'view-messages') window.MessagesCalculator?.init();
    if (viewId === 'view-projection') window.TierraFilmsProjections?.init();
    if (viewId === 'view-obj') {
      window.TierraFilmsRefreshLabels?.();
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
    }
  }

  function initNavigation() {
    document.querySelectorAll('[data-view-target]').forEach(button => {
      button.addEventListener('click', () => showView(button.dataset.viewTarget));
    });
    showView(storedView());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation);
  } else {
    initNavigation();
  }
})();
