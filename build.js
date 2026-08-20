const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const css = `
<style id="techdiag-summary-style">
.diag-summary{margin-top:16px;border:1px solid var(--line);border-radius:18px;background:#0d1727;padding:15px}
.diag-summary h3{margin:0 0 12px;font-size:17px}
.diag-summary-row{padding:9px 0;border-bottom:1px solid #22314b;font-size:13px;line-height:1.45}
.diag-summary-row:last-child{border-bottom:0}
.diag-summary-row strong{display:block;color:#dce9fb;margin-bottom:3px}
.diag-summary-row span{color:#aabbd4}
.copy-ok{font-size:12px;color:#a7f3d0;align-self:center}
</style>`;

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
output = output.replace('</head>', css + '\n</head>');
output = output.replace('</body>', enhancement + '\n</body>');

const dist = path.join(__dirname, 'dist');
fs.rmSync(dist, {recursive:true, force:true});
fs.mkdirSync(dist, {recursive:true});
fs.writeFileSync(path.join(dist, 'index.html'), output, 'utf8');
console.log('TechDiag build generated: dist/index.html');
