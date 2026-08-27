(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.TechDiagVisuals = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  const str = (v) => String(v ?? '').trim();
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function indexVisuals(rows){
    const index = {};
    (rows || []).forEach(row => {
      const pid = str(row.Procedure_ID);
      const sid = str(row.Step_ID);
      const url = str(row.URL);
      if(!pid || !sid || !url) return;
      const key = pid + '::' + sid;
      (index[key] ??= []).push(row);
    });
    return index;
  }

  function getStepVisuals(index, procedureId, stepId){
    return (index && index[str(procedureId) + '::' + str(stepId)]) || [];
  }

  function renderStepVisualsHtml(rows){
    if(!rows || !rows.length) return '';
    return '<div class="stepvisuals">' + rows.map(row => {
      const url = esc(str(row.URL));
      const legend = esc(str(row['Légende']) || str(row.Sujet) || 'Visuel technique');
      const subject = esc(str(row.Sujet));
      return '<figure class="visual-card">' +
        '<img src="'+url+'" alt="'+legend+'" loading="lazy">' +
        '<figcaption>' + (subject ? '<strong>'+subject+'</strong>' : '') + '<span>'+legend+'</span></figcaption>' +
        '<a class="visual-open" href="'+url+'" target="_blank" rel="noopener noreferrer">Agrandir</a>' +
      '</figure>';
    }).join('') + '</div>';
  }

  return { indexVisuals, getStepVisuals, renderStepVisualsHtml };
});
