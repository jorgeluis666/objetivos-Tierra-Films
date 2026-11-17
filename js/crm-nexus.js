/* Nexus supplies an authenticated, read-only CRM view. The existing manual feedback remains intact. */
(function () {
  'use strict';
  const manual = window.TierraFilmsLeads;
  const frame = document.getElementById('crm-nexus-frame');
  if (!manual || !frame) return;
  let selected = 'nexus';
  function choose(mode) {
    selected = mode;
    document.getElementById('crm-nexus-panel').hidden = mode !== 'nexus';
    document.getElementById('crm-feedback-panel').hidden = mode !== 'feedback';
    document.getElementById('crm-nexus-tab').setAttribute('aria-pressed', String(mode === 'nexus'));
    document.getElementById('crm-feedback-tab').setAttribute('aria-pressed', String(mode === 'feedback'));
    if (mode === 'feedback') manual.init();
    else {
      if (!frame.getAttribute('src')) frame.src = frame.dataset.src;
      const status = document.getElementById('status-view');
      if (status) status.textContent = 'CRM sincronizado por Nexus · solo lectura';
    }
  }
  document.getElementById('crm-nexus-tab').addEventListener('click', () => choose('nexus'));
  document.getElementById('crm-feedback-tab').addEventListener('click', () => choose('feedback'));
  let nexusOrigin = '';
  try { nexusOrigin = new URL(frame.dataset.src, location.href).origin; } catch (_) { nexusOrigin = ''; }
  // La llave del CRM llega por TF_NEXUS_CRM_KEY y solo existe dentro de este HTML cifrado, que ya
  // se abrio con la clave de la pagina. Se la damos al iframe cuando dice que esta cerrado, para
  // que el cliente no escriba una segunda contrasena. Nunca viaja en una URL.
  const crmKey = (window.TIERRA_FILMS_NEXUS || {}).key || '';
  window.addEventListener('message', event => {
    if (!nexusOrigin || event.origin !== nexusOrigin || event.source !== frame.contentWindow || !event.data) return;
    if (event.data.type === 'nexus-crm-height' && Number.isFinite(event.data.height)) {
      frame.style.height = Math.min(5000, Math.max(300, event.data.height + 24)) + 'px';
      return;
    }
    if (event.data.type === 'nexus-crm-locked' && crmKey) {
      frame.contentWindow.postMessage({ type: 'nexus-crm-key', key: crmKey }, nexusOrigin);
    }
  });
  window.TierraFilmsLeads = {...manual, init: () => choose(selected)};
})();
