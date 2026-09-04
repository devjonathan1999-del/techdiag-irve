(() => {
  const text = value => String(value ?? '').trim();

  function isParameterProcedure(step) {
    return /-PARAM-/i.test(text(step?.Procedure_ID));
  }

  function requiresDiagnosticContext(transition) {
    return text(transition?.Type_transition).toUpperCase() === 'RETOUR_DIAGNOSTIC';
  }

  function contextualTransitions(step, transitions) {
    const originProcedureId = typeof activeProcedureId === 'undefined' ? '' : text(activeProcedureId);
    const stepProcedureId = text(step?.Procedure_ID);
    return (transitions || []).filter(transition =>
      !requiresDiagnosticContext(transition) ||
      Boolean(originProcedureId && originProcedureId !== stepProcedureId)
    );
  }

  if (typeof renderStructuredChoices === 'function') {
    const originalRenderStructuredChoices = renderStructuredChoices;
    renderStructuredChoices = function(step, transitions) {
      return originalRenderStructuredChoices(step, contextualTransitions(step, transitions));
    };
  }

  function positionParameterControls(step) {
    const diag = document.getElementById('diag');
    const controls = document.getElementById('controls');
    if (!diag || !controls) return;

    if (isParameterProcedure(step)) {
      const navigation = diag.lastElementChild;
      if (navigation && navigation !== controls) diag.insertBefore(controls, navigation);
      else diag.appendChild(controls);
      return;
    }

    const reference = document.getElementById('referenceCard');
    reference?.insertAdjacentElement('afterend', controls);
  }

  window.contextualTransitions = contextualTransitions;
  window.positionParameterControls = positionParameterControls;

  if (typeof renderStep === 'function') {
    const originalRenderStep = renderStep;
    renderStep = function(step) {
      originalRenderStep(step);
      positionParameterControls(step);
    };
  }
})();
