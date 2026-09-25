(function () {
  // Prefijo propio: los tableros de Lima Retail comparten dominio y, por eso, localStorage.
  const STORAGE_KEY = 'tierra-films-sidebar-collapsed';

  function getStoredState() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  function saveState(collapsed) {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // El dashboard también debe funcionar si el navegador bloquea localStorage.
    }
  }

  function wireSidebarToggle() {
    const shell = document.querySelector('.shell');
    const toggle = document.getElementById('sidebar-toggle');
    if (!shell || !toggle) return;

    const items = [...document.querySelectorAll('#sidebar .s-item')];
    let collapsed = getStoredState();

    function render() {
      shell.classList.toggle('sidebar-collapsed', collapsed);
      toggle.setAttribute('aria-expanded', String(!collapsed));

      const label = collapsed ? 'Expandir panel' : 'Minimizar panel';
      toggle.setAttribute('aria-label', label);
      toggle.setAttribute('title', label);

      // En la tira de iconos, el nombre del modulo aparece al pasar el mouse.
      items.forEach(item => {
        const name = item.querySelector('.s-title-nav')?.textContent.trim();
        if (collapsed && name) item.setAttribute('title', name);
        else item.removeAttribute('title');
      });
    }

    toggle.addEventListener('click', function () {
      collapsed = !collapsed;
      saveState(collapsed);
      render();

      // Los graficos se reajustan al nuevo ancho cuando termina la animacion.
      window.setTimeout(function () {
        window.dispatchEvent(new Event('resize'));
      }, 250);
    });

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireSidebarToggle);
  } else {
    wireSidebarToggle();
  }
})();
