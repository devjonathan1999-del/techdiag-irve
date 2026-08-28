(() => {
  let manufacturerDocs = [], manufacturerDocsPromise = null;

  const docNorm = value => String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  async function loadManufacturerDocs() {
    if (manufacturerDocsPromise) return manufacturerDocsPromise;
    manufacturerDocsPromise = querySheet("Sources_Public")
      .then(rows => {
        manufacturerDocs = rows.filter(row => {
          const isPublic = docNorm(row?.Statut) === 'public';
          const isManufacturer = docNorm(row?.Type).includes('constructeur');
          const hasUrl = String(row?.URL || '').trim();
          return isPublic && isManufacturer && hasUrl;
        });
        return manufacturerDocs;
      })
      .catch(error => {
        console.warn('TechDiag: impossible de charger la documentation fabricant publique.', error);
        manufacturerDocs = [];
        return manufacturerDocs;
      });
    return manufacturerDocsPromise;
  }

  function scopeMatches(doc, procedure) {
    const scope = docNorm(doc?.['Périmètre']);
    const model = docNorm(procedure?.['Modèle / périmètre']);
    const brand = docNorm(procedure?.Marque);
    const title = docNorm(doc?.Titre);

    if (scope && model) {
      if (scope.includes(model) || model.includes(scope)) return true;
      const scopeParts = scope.split(/[\/;,|]+/).map(value => value.trim()).filter(Boolean);
      if (scopeParts.some(part => model.includes(part) || part.includes(model))) return true;
    }

    return !!brand && title.includes(brand);
  }

  function findProcedureDocs(step) {
    const procedureId = String(step?.Procedure_ID || '').trim();
    const procedure = catalogueByProcedure?.[procedureId];
    if (!procedure) return [];
    return manufacturerDocs.filter(doc => scopeMatches(doc, procedure));
  }

  async function renderManufacturerDocs(step) {
    document.getElementById('manufacturerDocs')?.remove();

    const stepId = String(step?.Step_ID || '').trim();
    if (!stepId) return;

    await loadManufacturerDocs();
    if (String(currentStepId || '').trim() !== stepId) return;

    const docs = findProcedureDocs(step);
    if (!docs.length) return;

    const card = document.createElement('div');
    card.id = 'manufacturerDocs';
    card.className = 'manualcheck';

    const title = document.createElement('strong');
    title.textContent = 'Documentation fabricant';
    card.appendChild(title);

    const links = document.createElement('div');
    links.style.display = 'flex';
    links.style.gap = '8px';
    links.style.flexWrap = 'wrap';

    docs.forEach((doc, index) => {
      const docLink = document.createElement('a');
      docLink.href = String(doc.URL || '').trim();
      docLink.target = '_blank';
      docLink.rel = 'noopener noreferrer';
      docLink.textContent = docs.length === 1 ? '📘 Documentation fabricant' : '📘 ' + (doc.Titre || `Document ${index + 1}`);
      docLink.title = doc.Titre || 'Documentation fabricant';
      docLink.style.display = 'inline-flex';
      docLink.style.alignItems = 'center';
      docLink.style.padding = '10px 13px';
      docLink.style.border = '1px solid rgba(56,189,248,.35)';
      docLink.style.borderRadius = '12px';
      docLink.style.background = 'rgba(14,165,233,.10)';
      docLink.style.color = '#dceaff';
      docLink.style.fontWeight = '700';
      docLink.style.textDecoration = 'none';
      links.appendChild(docLink);
    });

    card.appendChild(links);
    document.getElementById('meta')?.insertAdjacentElement('afterend', card);
  }

  const originalRenderStep = renderStep;
  renderStep = function(step) {
    originalRenderStep(step);
    renderManufacturerDocs(step);
  };

  window.renderManufacturerDocs = renderManufacturerDocs;
})();
