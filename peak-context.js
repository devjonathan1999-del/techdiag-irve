(() => {
  const peakText = value => String(value ?? '').trim();

  function peakContextLabel(step) {
    if (peakText(step?.Procedure_ID) !== 'SCH-PEAK-PARAM-001') return '';
    const supply = peakText(collected?.type_alimentation_peak_param).toLowerCase();
    if (/monophas/.test(supply)) return 'Monophasé • EVA2HPC1';
    if (/triphas/.test(supply)) return 'Triphasé • EVA2HPC3';
    return '';
  }

  function renderPeakContext(step) {
    document.getElementById('peakContextBadge')?.remove();
    const label = peakContextLabel(step);
    if (!label) return;

    const badge = document.createElement('div');
    badge.id = 'peakContextBadge';
    badge.className = 'badge peak-context-badge';
    badge.textContent = label;
    badge.style.display = 'inline-flex';
    badge.style.marginTop = '14px';
    badge.style.color = '#cceeff';
    badge.style.borderColor = 'rgba(92,217,245,.32)';
    badge.style.background = 'rgba(92,217,245,.08)';

    document.querySelector('#diag .diagnostic-context')?.insertAdjacentElement('afterend', badge);
  }

  const originalRenderStep = renderStep;
  renderStep = function(step) {
    originalRenderStep(step);
    renderPeakContext(step);
  };

  window.renderPeakContext = renderPeakContext;
})();
