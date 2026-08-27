(() => {
  const STEP_VISUALS = {
    'F107-020': {
      title: 'Schéma de câblage Modbus DPM / CN12',
      guidance: 'Consulter le schéma correspondant au DPM installé pour vérifier le câblage côté DPM et côté CN12.',
      href: 'assets/f2m/107/cablage-cn12.png',
      label: 'Voir le schéma de câblage DPM / CN12'
    }
  };

  function renderStepVisual(step) {
    document.getElementById('stepVisual')?.remove();
    const visual = STEP_VISUALS[String(step?.Step_ID || '').trim()];
    if (!visual) return;

    const card = document.createElement('div');
    card.id = 'stepVisual';
    card.style.marginTop = '18px';
    card.style.padding = '16px';
    card.style.border = '1px solid rgba(127,157,200,.16)';
    card.style.borderRadius = '16px';
    card.style.background = 'rgba(9,20,34,.72)';

    const title = document.createElement('strong');
    title.textContent = visual.title;
    title.style.display = 'block';
    title.style.marginBottom = '8px';
    title.style.color = '#dceaff';

    const guidance = document.createElement('div');
    guidance.textContent = visual.guidance;
    guidance.style.marginBottom = '12px';
    guidance.style.fontSize = '13px';
    guidance.style.lineHeight = '1.5';
    guidance.style.color = '#a8bad4';

    const link = document.createElement('a');
    link.href = visual.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = '📎 ' + visual.label;
    link.style.display = 'inline-flex';
    link.style.alignItems = 'center';
    link.style.gap = '8px';
    link.style.padding = '11px 14px';
    link.style.border = '1px solid rgba(56,189,248,.35)';
    link.style.borderRadius = '12px';
    link.style.background = 'rgba(14,165,233,.10)';
    link.style.color = '#dceaff';
    link.style.fontWeight = '700';
    link.style.textDecoration = 'none';

    card.append(title, guidance, link);
    document.getElementById('question')?.insertAdjacentElement('afterend', card);
  }

  const originalRenderStep = renderStep;
  renderStep = function(step) {
    originalRenderStep(step);
    renderStepVisual(step);
  };

  window.renderStepVisual = renderStepVisual;
})();
