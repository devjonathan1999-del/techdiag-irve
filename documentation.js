(() => {
  let manufacturerDocs = [], manufacturerDocsPromise = null, renderRequest = 0;

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
          return isPublic && isManufacturer && documentUrl(row?.URL);
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

  function documentUrl(value) {
    try {
      const url = new URL(String(value ?? '').trim());
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      // A citation to a PDF page still identifies the same public document.
      url.hash = '';
      return url.href;
    } catch {
      return '';
    }
  }

  function findStepDocs(step) {
    const procedureId = String(step?.Procedure_ID || '').trim();
    const procedure = catalogueByProcedure?.[procedureId];
    if (!procedure) return [];

    const stepId = String(step?.Step_ID || '').trim();
    const source = String(step?.Source || '');
    const urlPattern = /https?:\/\/[^\s<>"'|]+/g;
    const citedUrls = new Set((source.match(urlPattern) || [])
      .map(url => documentUrl(url.replace(/[),.;\]}]+$/, ''))).filter(Boolean));
    const citedIds = new Set(source.replace(urlPattern, ' ').match(/[A-Za-z0-9_-]+/g) || []);
    const seenUrls = new Set();

    return manufacturerDocs.filter(doc => {
      if (!scopeMatches(doc, procedure)) return false;
      const assignedSteps = String(doc.Step_IDs || '').trim().split(/[\s,;|]+/).filter(Boolean);
      // Explicit assignments take precedence. Never fall back to all documents
      // for the model, or infer relevance from generic words in the question.
      const relevant = assignedSteps.length
        ? assignedSteps.includes(stepId)
        : citedUrls.has(documentUrl(doc.URL)) || citedIds.has(String(doc.Source_ID || '').trim());
      const url = String(doc.URL || '').trim();
      if (!relevant || seenUrls.has(url)) return false;
      seenUrls.add(url);
      return true;
    });
  }

  async function renderManufacturerDocs(step) {
    const request = ++renderRequest;
    document.getElementById('manufacturerDocs')?.remove();

    const stepId = String(step?.Step_ID || '').trim();
    if (!stepId) return;

    await loadManufacturerDocs();
    if (request !== renderRequest || String(currentStepId || '').trim() !== stepId) return;

    const docs = findStepDocs(step);
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

    docs.forEach(doc => {
      const docLink = document.createElement('a');
      docLink.href = String(doc.URL || '').trim();
      docLink.target = '_blank';
      docLink.rel = 'noopener noreferrer';
      docLink.textContent = doc.Titre ? '📘 ' + doc.Titre : '📘 Documentation fabricant';
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
