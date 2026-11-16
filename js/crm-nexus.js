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
  window.addEventListener('message', event => {
    if (event.origin !== 'https://nexus.limaretail.com' || event.source !== frame.contentWindow
        || event.data?.type !== 'nexus-crm-height' || !Number.isFinite(event.data.height)) return;
    frame.style.height = Math.min(5000, Math.max(300, event.data.height + 24)) + 'px';
  });
  window.TierraFilmsLeads = {...manual, init: () => choose(selected)};
})();
