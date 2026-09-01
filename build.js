const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const stepVisuals = fs.readFileSync(path.join(__dirname, 'visuals.js'), 'utf8');
const settingsRenderer = fs.readFileSync(path.join(__dirname, 'settings.js'), 'utf8');
const manufacturerDocs = fs.readFileSync(path.join(__dirname, 'documentation.js'), 'utf8');

const css = `
<style id="techdiag-summary-style">
.diag-summary{margin-top:22px}
.diag-summary h3{margin:0 0 14px;font-size:16px;font-weight:600;letter-spacing:-.01em}
.summary-data{border:1px solid var(--line-soft);border-radius:16px;background:var(--panel3);padding:20px;margin-bottom:16px}
.summary-values{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 24px;margin:0}
.summary-values>div{min-width:0;overflow-wrap:anywhere}
.summary-values dt{font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:4px}
.summary-values dd{margin:0;font-size:15px;color:var(--text);line-height:1.5;white-space:pre-line}
.summary-path ol{padding:4px 20px 4px 42px;margin:0}
.diag-summary-row{padding:14px 0;border-bottom:1px solid var(--line-soft);font-size:14px;line-height:1.6;overflow-wrap:anywhere}
.diag-summary-row:last-child{border-bottom:0}
.diag-summary-row strong{display:block;font-weight:500;color:var(--muted);margin-bottom:5px}
.diag-summary-row span{color:var(--text);white-space:pre-line}
.summary-empty{font-size:13px;color:var(--muted);padding:16px}
.copy-ok{font-size:13px;color:#a7f3d0;align-self:center}
.copy-ok.error{color:#fecdd3}
@media(max-width:600px){.summary-values{grid-template-columns:1fr}.summary-data{padding:16px}}
</style>`;

const enhancement = `
<script id="techdiag-summary-script">
(() => {
  let summaryVersion = 0, copyFeedbackTimer = null;
  const tdEsc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const TD_SUMMARY_ACCENTS = {
    controle:'contrôle', controles:'contrôles', cable:'câble', cables:'câbles',
    endommage:'endommagé', endommagee:'endommagée', redemarrage:'redémarrage',
    apres:'après', reglage:'réglage', reglages:'réglages', reglee:'réglée',
    mesure:'mesure', mesuree:'mesurée', detecte:'détecté', detectee:'détectée',
    vehicule:'véhicule', securite:'sécurité', arret:'arrêt', reinitialisation:'réinitialisation',
    connectivite:'connectivité', entree:'entrée'
  };
  const TD_SUMMARY_UPPER = new Set(['t2','dpm','cp','pp','tic','db','agcp','rfid','ble','wifi']);
  const tdPretty = (key) => {
    let label = String(key ?? '').replaceAll('_',' ').trim().replace(/\\s+\\d+$/,'');
    label = label.split(/\\s+/).filter(Boolean).map(word => {
      const lower = word.toLowerCase();
      if(TD_SUMMARY_UPPER.has(lower) || /^cn\\d+$/i.test(word)) return word.toUpperCase();
      return TD_SUMMARY_ACCENTS[lower] || lower;
    }).join(' ');
    return label ? label.charAt(0).toUpperCase() + label.slice(1) : '';
  };
  const tdSummaryDataEntries = () => Object.entries(collected || {}).filter(([key]) => !/^conclusion(?:_|$)/i.test(key));

  function ensureSummaryUI(){
    const final = document.getElementById('final');
    if(!final || document.getElementById('diagSummary')) return;
    const btns = final.querySelector('.btns');
    const summary = document.createElement('div');
    summary.id = 'diagSummary';
    summary.className = 'diag-summary';
    final.appendChild(summary);

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
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      btns.appendChild(status);
    }
  }

  function renderDiagnosticSummary(title, text){
    ensureSummaryUI();
    const box = document.getElementById('diagSummary');
    if(!box) return;
    summaryVersion += 1;
    clearTimeout(copyFeedbackTimer);
    document.getElementById('copyStatus')?.classList.add('hidden');

    const values = tdSummaryDataEntries();
    const dataHtml = values.length
      ? '<section class="summary-data" aria-labelledby="summaryDataTitle"><h3 id="summaryDataTitle">Données collectées</h3><dl class="summary-values">' + values.map(([k,v]) => '<div><dt>'+tdEsc(tdPretty(k))+'</dt><dd>'+tdEsc(v)+'</dd></div>').join('') + '</dl></section>'
      : '';

    const stepsHtml = (reportLog && reportLog.length)
      ? '<ol>' + reportLog.map(x => '<li class="diag-summary-row"><strong>'+tdEsc(x.question)+'</strong><span>'+tdEsc(x.answer)+'</span></li>').join('') + '</ol>'
      : '<p class="summary-empty">Aucune étape enregistrée.</p>';

    const count = (reportLog || []).length;
    box.innerHTML = dataHtml + '<details class="disclosure summary-path"><summary>Parcours détaillé · '+count+' étape'+(count>1?'s':'')+'</summary>' + stepsHtml + '</details>';
  }

  function buildDiagnosticText(){
    const title = document.getElementById('finalTitle')?.textContent || 'Diagnostic terminé';
    const lines = ['TECHDIAG – RÉSUMÉ DU DIAGNOSTIC','', 'Diagnostic : '+(activeProcedureTitle || ''), 'ID procédure : '+(activeProcedureId || '')];
    finalContextRows().forEach((item,i) => {
      if(i===0) lines.push('Statut procédure : '+item.status);
      else lines.push('Procédure de sortie : '+item.title, 'ID procédure de sortie : '+item.id, 'Statut procédure de sortie : '+item.status);
    });

    const values = tdSummaryDataEntries();
    if(values.length){
      lines.push('', 'DONNÉES COLLECTÉES');
      values.forEach(([k,v]) => lines.push('- '+tdPretty(k)+' : '+v));
    }

    lines.push('', 'PARCOURS');
    (reportLog || []).forEach((x,i) => {
      lines.push((i+1)+'. '+x.question);
      lines.push('   → '+x.answer);
    });

    lines.push('', 'CONCLUSION', title);
    return lines.join('\\n');
  }

  async function copyDiagnostic(){
    const text = buildDiagnosticText();
    const version = summaryVersion;
    let copied = false;
    try{
      await navigator.clipboard.writeText(text);
      copied = true;
    }catch(err){
      if(version !== summaryVersion) return;
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      try{
        ta.select();
        copied = document.execCommand('copy');
      }catch(fallbackError){
        copied = false;
      }finally{
        ta.remove();
      }
    }
    if(version !== summaryVersion) return;
    const status = document.getElementById('copyStatus');
    if(status){
      clearTimeout(copyFeedbackTimer);
      status.textContent = copied ? 'Copié ✓' : 'Copie impossible. Réessayez ou sélectionnez le texte du diagnostic.';
      status.className = copied ? 'copy-ok' : 'copy-ok error';
      if(copied) copyFeedbackTimer = setTimeout(() => status.classList.add('hidden'), 1800);
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

const visualEnhancement = `\n<script id="techdiag-step-visuals">\n${stepVisuals}\n</script>`;
const settingsEnhancement = `\n<script id="techdiag-settings">\n${settingsRenderer}\n</script>`;
const documentationEnhancement = `\n<script id="techdiag-manufacturer-docs">\n${manufacturerDocs}\n</script>`;

let output = source;
const sheetsQuerySignature = 'BASE_URL+encodeURIComponent(name)';
if (!output.includes(sheetsQuerySignature)) {
  throw new Error('TechDiag build: Google Sheets query signature not found');
}
output = output.replace(sheetsQuerySignature, sheetsQuerySignature + "+'&cacheBust='+Date.now()");
output = output.replace('</head>', css + '\n</head>');
output = output.replace('</body>', visualEnhancement + '\n' + settingsEnhancement + '\n' + documentationEnhancement + '\n' + enhancement + '\n</body>');

const dist = path.join(__dirname, 'dist');
fs.rmSync(dist, {recursive:true, force:true});
fs.mkdirSync(dist, {recursive:true});
fs.writeFileSync(path.join(dist, 'index.html'), output, 'utf8');
fs.writeFileSync(path.join(dist, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`, 'utf8');

const assetsSource = path.join(__dirname, 'assets');
if (fs.existsSync(assetsSource)) {
  fs.cpSync(assetsSource, path.join(dist, 'assets'), { recursive: true });
}

console.log('TechDiag build generated: dist/index.html + hosted assets');
