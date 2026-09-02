(() => {
  const text = value => String(value ?? '').trim();

  function isParameterProcedure(step) {
    return /-PARAM-/i.test(text(step?.Procedure_ID));
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

  window.positionParameterControls = positionParameterControls;

  if (typeof renderStep === 'function') {
    const originalRenderStep = renderStep;
    renderStep = function(step) {
      originalRenderStep(step);
      positionParameterControls(step);
    };
  }
})();
