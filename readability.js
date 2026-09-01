(() => {
  function readabilityText(value) {
    return String(value ?? '').trim();
  }

  function questionReadabilityClass(text) {
    const length = readabilityText(text).length;
    if (length > 180) return 'question dense';
    if (length > 110) return 'question compact';
    return 'question';
  }

  function applyQuestionReadability(step) {
    const question = document.getElementById('question');
    if (!question) return;
    question.className = questionReadabilityClass(step?.['Instruction / question']);
  }

  function ensureReadabilityStyles() {
    if (!document?.createElement || !document?.head || document.getElementById('techdiag-readability-style')) return;
    const style = document.createElement('style');
    style.id = 'techdiag-readability-style';
    style.textContent = `
.question.compact{font-size:24px;line-height:1.38;max-width:780px}
.question.dense{font-size:21px;line-height:1.44;max-width:780px}
.setting-name{color:#cbd8ee}
.setting-value{color:#f5fbff;font-weight:800;letter-spacing:.01em}
.setting-condition{color:var(--muted)}
@media(max-width:760px){
  .question.compact{font-size:20px;line-height:1.42}
  .question.dense{font-size:18px;line-height:1.48}
}`;
    document.head.appendChild(style);
  }

  window.questionReadabilityClass = questionReadabilityClass;
  ensureReadabilityStyles();

  if (typeof renderStep === 'function') {
    const originalRenderStep = renderStep;
    renderStep = function(step) {
      originalRenderStep(step);
      applyQuestionReadability(step);
    };
  }
})();
