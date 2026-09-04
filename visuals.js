(() => {
  let visuals=[], visualsPromise=null;

  async function loadVisuals() {
    if (visualsPromise) return visualsPromise;
    visualsPromise = querySheet("Visuels_Terrain")
      .then(rows => {
        visuals = rows.filter(row => String(row?.Step_ID || '').trim() && String(row?.URL || '').trim());
        return visuals;
      })
      .catch(error => {
        console.warn('TechDiag: impossible de charger les visuels terrain.', error);
        visuals = [];
        return visualsPromise;
      });
    return visualsPromise;
  }

  function normalizeConditionValue(value) {
    return String(value ?? '').trim().toLowerCase();
  }

  function matchesVisualCondition(visual) {
    const rawCondition = String(visual?.Condition_affichage || '').trim();
    if (!rawCondition) return true;

    const separatorIndex = rawCondition.indexOf('=');
    if (separatorIndex <= 0) return false;

    const field = rawCondition.slice(0, separatorIndex).trim();
    const expected = rawCondition.slice(separatorIndex + 1).trim();
    if (!field || !expected) return false;

    const actual = typeof collected !== 'undefined' && collected
      ? collected[field]
      : '';
    return normalizeConditionValue(actual) === normalizeConditionValue(expected);
  }

  function findStepVisual(step) {
    const stepId = String(step?.Step_ID || '').trim();
    const procedureId = String(step?.Procedure_ID || '').trim();
    return visuals.find(visual => {
      const sameStep = String(visual.Step_ID || '').trim() === stepId;
      const visualProcedure = String(visual.Procedure_ID || '').trim();
      return sameStep && (!visualProcedure || visualProcedure === procedureId) && matchesVisualCondition(visual);
    }) || null;
  }

  function isInlineImage(visual) {
    return String(visual?.Affichage || '').trim().toLowerCase() === 'image';
  }

  function appendVisualLink(card, visual) {
    const link = document.createElement('a');
    link.href = visual.URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = '📎 ' + (visual['Légende'] || 'Voir le visuel');
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
    card.appendChild(link);
  }

  function appendInlineImage(card, visual) {
    const link = document.createElement('a');
    link.href = visual.URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'block';
    link.style.borderRadius = '14px';
    link.style.overflow = 'hidden';
    link.style.border = '1px solid rgba(56,189,248,.28)';
    link.style.background = 'rgba(5,15,27,.72)';
    link.style.textDecoration = 'none';

    const image = document.createElement('img');
    image.src = visual.URL;
    image.alt = visual['Légende'] || visual.Sujet || 'Visuel technique';
    image.loading = 'lazy';
    image.style.display = 'block';
    image.style.width = '100%';
    image.style.maxHeight = '560px';
    image.style.objectFit = 'contain';
    image.style.background = '#fff';
    link.appendChild(image);

    const caption = document.createElement('div');
    caption.textContent = (visual['Légende'] || 'Ouvrir le visuel') + ' · cliquer pour agrandir';
    caption.style.padding = '10px 12px';
    caption.style.fontSize = '12px';
    caption.style.color = '#a8bad4';
    caption.style.textAlign = 'center';
    link.appendChild(caption);

    card.appendChild(link);
  }

  async function renderStepVisual(step) {
    document.getElementById('stepVisual')?.remove();
    const stepId = String(step?.Step_ID || '').trim();
    if (!stepId) return;

    await loadVisuals();
    if (String(currentStepId || '').trim() !== stepId) return;

    const visual = findStepVisual(step);
    if (!visual || !String(visual.URL || '').trim()) return;

    const card = document.createElement('div');
    card.id = 'stepVisual';
    card.style.marginTop = '18px';
    card.style.padding = '16px';
    card.style.border = '1px solid rgba(127,157,200,.16)';
    card.style.borderRadius = '16px';
    card.style.background = 'rgba(9,20,34,.72)';

    const title = document.createElement('strong');
    title.textContent = visual.Sujet || 'Visuel technique';
    title.style.display = 'block';
    title.style.marginBottom = '8px';
    title.style.color = '#dceaff';
    card.appendChild(title);

    const guidanceText = visual['Utilisation TechDiag'] || visual['Éléments visibles'] || visual.Note || '';
    if (guidanceText) {
      const guidance = document.createElement('div');
      guidance.textContent = guidanceText;
      guidance.style.marginBottom = '12px';
      guidance.style.fontSize = '13px';
      guidance.style.lineHeight = '1.5';
      guidance.style.color = '#a8bad4';
      card.appendChild(guidance);
    }

    if (isInlineImage(visual)) appendInlineImage(card, visual);
    else appendVisualLink(card, visual);

    const anchor = document.getElementById('peakSettingAlert') || document.getElementById('hint');
    anchor?.insertAdjacentElement('afterend', card);
  }

  const originalRenderStep = renderStep;
  renderStep = function(step) {
    originalRenderStep(step);
    renderStepVisual(step);
  };

  window.renderStepVisual = renderStepVisual;
})();
