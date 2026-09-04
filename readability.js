(() => {
  function readabilityText(value) {
    return String(value ?? '').trim();
  }

  function applyStatusVocabulary() {
    if (typeof statusClass !== 'function') return;
    const originalStatusClass = statusClass;
    statusClass = function(value) {
      const status = norm(value);
      if (status === 'valide') return 'valid';
      if (status === 'en construction') return 'draft';
      return originalStatusClass(value);
    };
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

  function agcpReferenceMeta() {
    const phase = norm(collected?.type_alimentation || '');
    if (phase.includes('tri')) return { needle: 'triphase', label: 'triphasé' };
    if (phase.includes('mono')) return { needle: 'monophase', label: 'monophasé' };
    return null;
  }

  function findAgcpReference(step) {
    const key = norm((step?.['Instruction / question'] || '') + ' ' + (step?.['Donnée_collectée'] || ''));
    if (!key.includes('calibre') && !key.includes('disjoncteur') && !key.includes('agcp')) return null;

    const phase = agcpReferenceMeta();
    const kva = extractNumber(collected?.puissance_souscrite);
    if (!phase || kva === null) return null;

    const procTitle = norm(activeProcedureTitle || '');
    return references.find(ref => {
      const diagnostic = norm(ref.Diagnostic);
      const control = norm(ref['Contrôle']);
      const diagnosticMatches = !diagnostic || procTitle.includes(diagnostic) || diagnostic.includes(procTitle);
      return diagnosticMatches && control.includes(phase.needle) && control.includes(String(kva) + ' kva');
    }) || null;
  }

  function ensureReadabilityStyles() {
    if (!document?.createElement || !document?.head || document.getElementById('techdiag-readability-style')) return;
    const style = document.createElement('style');
    style.id = 'techdiag-readability-style';
    style.textContent = `
.question.compact{font-size:24px;line-height:1.38;max-width:780px}
.question.dense{font-size:21px;line-height:1.44;max-width:780px}
.step-status,.meta{display:none!important}
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
  applyStatusVocabulary();
  ensureReadabilityStyles();

  if (typeof renderReference === 'function') {
    const originalRenderReference = renderReference;
    renderReference = function(step) {
      const ref = findAgcpReference(step);
      if (!ref) return originalRenderReference(step);

      const box = document.getElementById('referenceCard');
      const phase = agcpReferenceMeta();
      const kva = extractNumber(collected?.puissance_souscrite);
      const rule = str(ref['Règle conforme']);
      if (!box || !phase || kva === null || !rule) return originalRenderReference(step);

      box.className = 'manualcheck';
      box.innerHTML = `<strong>⚡ Réglage attendu — ${esc(kva)} kVA ${esc(phase.label)}</strong><div>${esc(rule)}</div>`;
    };
  }

  if (typeof renderStep === 'function') {
    const originalRenderStep = renderStep;
    renderStep = function(step) {
      originalRenderStep(step);
      applyQuestionReadability(step);
      if (typeof window?.scrollTo === 'function') {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
    };
  }
})();
