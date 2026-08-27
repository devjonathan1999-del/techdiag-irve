(() => {
  const STEP_VISUALS = {
    'F107-020': {
      title: 'Schéma de câblage Modbus DPM ↔ CN12',
      guidance: 'Choisir le schéma correspondant au DPM installé puis vérifier la correspondance des bornes entre le DPM et le CN12 de la Wallbox.',
      src: 'data:image/png;base64,__CN12_IMAGE_BASE64__'
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

    const image = document.createElement('img');
    image.src = visual.src;
    image.alt = visual.title;
    image.style.display = 'block';
    image.style.width = '100%';
    image.style.height = 'auto';
    image.style.maxWidth = '716px';
    image.style.margin = '0 auto';
    image.style.borderRadius = '10px';
    image.style.background = '#fff';

    card.append(title, guidance, image);
    document.getElementById('question')?.insertAdjacentElement('afterend', card);
  }

  const originalRenderStep = renderStep;
  renderStep = function(step) {
    originalRenderStep(step);
    renderStepVisual(step);
  };

  window.renderStepVisual = renderStepVisual;
})();
