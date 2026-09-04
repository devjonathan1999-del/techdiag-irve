(() => {
  const text = value => String(value ?? '').trim();

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

  function isFinishButton(button) {
    return text(button?.textContent).toLowerCase() === 'terminer';
  }

  function moveFinishControlsToBottom(diag, controls) {
    document.getElementById('completionControls')?.remove();

    const finishButtons = Array.from(controls.querySelectorAll('button')).filter(isFinishButton);
    if (!finishButtons.length) return;

    const completion = document.createElement('div');
    completion.id = 'completionControls';
    completion.className = 'btns completion-controls';

    finishButtons.forEach(button => {
      const originalParent = button.parentNode;
      completion.appendChild(button);
      if (originalParent && originalParent !== controls && originalParent.children.length === 0) {
        originalParent.remove();
      }
    });

    const navigation = diag.lastElementChild;
    if (navigation && navigation !== controls) diag.insertBefore(completion, navigation);
    else diag.appendChild(completion);
  }

  function positionParameterControls(step) {
    const diag = document.getElementById('diag');
    const controls = document.getElementById('controls');
    if (!diag || !controls) return;

    document.getElementById('completionControls')?.remove();

    const reference = document.getElementById('referenceCard');
    if (reference) reference.insertAdjacentElement('afterend', controls);

    moveFinishControlsToBottom(diag, controls);
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
