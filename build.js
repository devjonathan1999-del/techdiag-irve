const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const visualsCore = fs.readFileSync(path.join(__dirname, 'visuals.js'), 'utf8');

const css = `
<style id="techdiag-summary-style">
.diag-summary{margin-top:18px;border:1px solid rgba(127,157,200,.13);border-radius:18px;background:rgba(9,20,34,.72);padding:17px}
.diag-summary h3{margin:0 0 13px;font-size:17px;letter-spacing:-.01em}
.diag-summary-row{padding:10px 0;border-bottom:1px solid rgba(127,157,200,.11);font-size:13px;line-height:1.5}
.diag-summary-row:last-child{border-bottom:0}
.diag-summary-row strong{display:block;color:#dce9fb;margin-bottom:4px;font-size:12px}
.diag-summary-row span{color:#9fb0cc}
.copy-ok{font-size:12px;color:#a7f3d0;align-self:center}
</style>`;

const visualCss = `
<style id="techdiag-visuals-style">
#stepVisuals:empty{display:none}
.stepvisuals{display:grid;grid-template-columns:minmax(0,430px);gap:12px;margin-top:16px}
.visual-card{margin:0;border:1px solid rgba(56,213,255,.18);border-radius:16px;background:rgba(9,20,34,.76);padding:12px;overflow:hidden}
.visual-card img{display:block;width:100%;max-height:440px;object-fit:contain;border-radius:11px;background:#fff;border:1px solid rgba(127,157,200,.12)}
.visual-card figcaption{display:flex;flex-direction:column;gap:4px;margin-top:10px;font-size:12px;line-height:1.4;color:#9fb0cc}
.visual-card figcaption strong{font-size:12px;color:#dce9fb}
.visual-open{display:inline-flex;align-items:center;justify-content:center;margin-top:10px;padding:8px 11px;border-radius:10px;border:1px solid rgba(56,213,255,.28);background:rgba(56,213,255,.07);color:#bdeeff;font-size:12px;font-weight:800;text-decoration:none}
.visual-open:hover{border-color:rgba(56,213,255,.55);background:rgba(56,213,255,.11)}
@media(max-width:760px){.stepvisuals{grid-template-columns:1fr}.visual-card img{max-height:360px}}
</style>`;

const visualEnhancement = `
<script id="techdiag-visuals-script">
(() => {
  let visualIndex = {};

  function ensureVisualUI(){
    const hint = document.getElementById('hint');
    if(!hint || document.getElementById('stepVisuals')) return;
    const root = document.createElement('div');
    root.id = 'stepVisuals';
    hint.insertAdjacentElement('afterend', root);
  }

  function renderStepVisuals(step){
    ensureVisualUI();
    const root = document.getElementById('stepVisuals');
    if(!root || !window.TechDiagVisuals || !step){
      if(root) root.innerHTML = '';
      return;
    }
    const rows = window.TechDiagVisuals.getStepVisuals(visualIndex, step.Procedure_ID, step.Step_ID);
    root.innerHTML = window.TechDiagVisuals.renderStepVisualsHtml(rows);
  }

  function renderCurrentStepVisuals(){
    if(typeof byStep !== 'undefined' && typeof currentStepId !== 'undefined' && currentStepId){
      renderStepVisuals(byStep[currentStepId]);
    }
  }

  async function loadStepVisuals(){
    if(typeof querySheet !== 'function' || !window.TechDiagVisuals) return;
    try{
      const rows = await querySheet('Visuels_Terrain');
      visualIndex = window.TechDiagVisuals.indexVisuals(rows);
      renderCurrentStepVisuals();
    }catch(err){
      console.warn('TechDiag : impossible de charger les visuels terrain.', err);
    }
  }

  ensureVisualUI();

  if(typeof renderStep === 'function'){
    const originalRenderStep = renderStep;
    renderStep = function(step){
      originalRenderStep(step);
      renderStepVisuals(step);
    };
  }

  if(window.google && google.charts){
    google.charts.setOnLoadCallback(loadStepVisuals);
  }else{
    window.addEventListener('load', loadStepVisuals, {once:true});
  }
})();
</script>`;

const enhancement = `
<script id="techdiag-summary-script">
(() => {
  const tdEsc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const tdPretty = (key) => String(key ?? '').replaceAll('_',' ').replace(/\\b\\w/g, m => m.toUpperCase());

  function ensureSummaryUI(){
    const final = document.getElementById('final');
    if(!final || document.getElementById('diagSummary')) return;
    const btns = final.querySelector('.btns');
    const summary = document.createElement('div');
    summary.id = 'diagSummary';
    summary.className = 'diag-summary';
    final.insertBefore(summary, btns || null);

    if(btns){
      const copy = document.createElement('button');
      copy.className = 'primary';
      copy.type = 'button';
      copy.textContent = '📋 Copier le diagnostic';
      copy.onclick = copyDiagnostic;
      btns.insertBefore(copy, btns.firstChild);

      const status = document.createElement('span');
      status.id = 'copyStatus';
      status.className = 'copy-ok hidden';
      status.textContent = 'Copié ✓';
      btns.appendChild(status);
    }
  }

  function renderDiagnosticSummary(title, text){
    ensureSummaryUI();
    const box = document.getElementById('diagSummary');
    if(!box) return;

    const values = Object.entries(collected || {});
    const dataHtml = values.length
      ? '<div class="diag-summary-row"><strong>Données collectées</strong></div>' + values.map(([k,v]) => '<div class="diag-summary-row"><strong>'+tdEsc(tdPretty(k))+'</strong><span>'+tdEsc(v)+'</span></div>').join('')
      : '';

    const stepsHtml = (reportLog && reportLog.length)
      ? reportLog.map((x,i) => '<div class="diag-summary-row"><strong>'+(i+1)+'. '+tdEsc(x.question)+'</strong><span>→ '+tdEsc(x.answer)+'</span></div>').join('')
      : '<div class="diag-summary-row"><span>Aucune étape enregistrée.</span></div>';

    box.innerHTML = '<h3>Résumé du diagnostic</h3>' +
      '<div class="diag-summary-row"><strong>Diagnostic</strong><span>'+tdEsc(activeProcedureTitle || '')+'</span></div>' +
      dataHtml +
      '<div class="diag-summary-row"><strong>Parcours réalisé</strong></div>' + stepsHtml +
      '<div class="diag-summary-row"><strong>Conclusion</strong><span>'+tdEsc(title)+(text ? ' — '+tdEsc(text) : '')+'</span></div>';
  }

  function buildDiagnosticText(){
    const title = document.getElementById('finalTitle')?.textContent || 'Diagnostic terminé';
    const conclusion = document.querySelector('#finalBox .result p')?.textContent || '';
    const lines = ['TECHDIAG – RÉSUMÉ DU DIAGNOSTIC','', 'Diagnostic : '+(activeProcedureTitle || ''), 'Procedure_ID : '+(activeProcedureId || '')];

    const values = Object.entries(collected || {});
    if(values.length){
      lines.push('', 'DONNÉES COLLECTÉES');
      values.forEach(([k,v]) => lines.push('- '+tdPretty(k)+' : '+v));
    }

    lines.push('', 'PARCOURS');
    (reportLog || []).forEach((x,i) => {
      lines.push((i+1)+'. '+x.question);
      lines.push('   → '+x.answer);
    });

    lines.push('', 'CONCLUSION', title + (conclusion ? ' — '+conclusion : ''));
    return lines.join('\\n');
  }

  async function copyDiagnostic(){
    const text = buildDiagnosticText();
    try{
      await navigator.clipboard.writeText(text);
    }catch(err){
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    const status = document.getElementById('copyStatus');
    if(status){
      status.classList.remove('hidden');
      setTimeout(() => status.classList.add('hidden'), 1800);
    }
  }

  window.copyDiagnostic = copyDiagnostic;
  ensureSummaryUI();

  if(typeof finishGeneric === 'function'){
    const originalFinishGeneric = finishGeneric;
    finishGeneric = function(title, text, type='ok'){
      originalFinishGeneric(title, text, type);
      renderDiagnosticSummary(title, text);
    };
  }
})();
</script>`;

let output = source;
output = output.replace('</head>', css + '\n' + visualCss + '\n</head>');
output = output.replace('</body>', '<script id="techdiag-visuals-core">\n' + visualsCore + '\n</script>\n' + visualEnhancement + '\n' + enhancement + '\n</body>');

const dist = path.join(__dirname, 'dist');
fs.rmSync(dist, {recursive:true, force:true});
fs.mkdirSync(dist, {recursive:true});
fs.writeFileSync(path.join(dist, 'index.html'), output, 'utf8');
fs.writeFileSync(path.join(dist, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`, 'utf8');

const assets = path.join(__dirname, 'assets');
if(fs.existsSync(assets)) fs.cpSync(assets, path.join(dist, 'assets'), {recursive:true});

console.log('TechDiag build generated: dist/index.html + dist/_headers + dist/assets');