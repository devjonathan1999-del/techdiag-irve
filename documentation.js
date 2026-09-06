(() => {
  let manufacturerDocs = [], manufacturerDocsPromise = null, renderRequest = 0;
  let appLinks = [], appLinksPromise = null, appRenderRequest = 0;

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

  async function loadAppLinks() {
    if (appLinksPromise) return appLinksPromise;
    appLinksPromise = querySheet("Sources_Public")
      .then(rows => {
        appLinks = rows.filter(row => {
          const isPublic = docNorm(row?.Statut) === 'public';
          const isApplication = docNorm(row?.Type) === 'application';
          return isPublic && isApplication && documentUrl(row?.URL);
        });
        return appLinks;
      })
      .catch(error => {
        console.warn('TechDiag: impossible de charger les liens d’application publics.', error);
        appLinks = [];
        return appLinks;
      });
    return appLinksPromise;
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
      return false;
    }

    return !!brand && title.includes(brand);
  }

  function isGenericProcedure(procedure) {
    const brand = docNorm(procedure?.Marque);
    return brand.includes('generique') || brand.includes('multimarque');
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
      const assignedSteps = String(doc.Step_IDs || '').trim().split(/[\s,;|]+/).filter(Boolean);
      const explicitlyAssigned = assignedSteps.includes(stepId);
      // An exact Step_ID assignment is authoritative, even when a generic
      // diagnostic temporarily routes into a manufacturer-specific branch.
      if (assignedSteps.length && !explicitlyAssigned) return false;
      if (!scopeMatches(doc, procedure) && !(explicitlyAssigned && isGenericProcedure(procedure))) return false;
      const relevant = explicitlyAssigned
        || citedUrls.has(documentUrl(doc.URL))
        || citedIds.has(String(doc.Source_ID || '').trim());
      const url = String(doc.URL || '').trim();
      if (!relevant || seenUrls.has(url)) return false;
      seenUrls.add(url);
      return true;
    });
  }

  function findStepAppLinks(step) {
    const stepId = String(step?.Step_ID || '').trim();
    if (!stepId) return [];
    const seenUrls = new Set();

    return appLinks.filter(app => {
      const assignedSteps = String(app.Step_IDs || '').trim().split(/[\s,;|]+/).filter(Boolean);
      const url = documentUrl(app.URL);
      if (!assignedSteps.includes(stepId) || !url || seenUrls.has(url)) return false;
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
    const anchor = document.getElementById('pathHistory')
      || document.getElementById('settingsReference')
      || document.getElementById('meta');
    anchor?.insertAdjacentElement('afterend', card);
  }

  async function renderStepAppLinks(step) {
    const request = ++appRenderRequest;
    document.getElementById('stepAppLinks')?.remove();

    const stepId = String(step?.Step_ID || '').trim();
    if (!stepId) return;

    await loadAppLinks();
    if (request !== appRenderRequest || String(currentStepId || '').trim() !== stepId) return;

    const apps = findStepAppLinks(step);
    if (!apps.length) return;

    const links = document.createElement('div');
    links.id = 'stepAppLinks';
    links.style.display = 'flex';
    links.style.gap = '8px';
    links.style.flexWrap = 'wrap';
    links.style.margin = '0 0 14px';

    apps.forEach(app => {
      const appLink = document.createElement('a');
      appLink.href = documentUrl(app.URL);
      appLink.target = '_blank';
      appLink.rel = 'noopener noreferrer';
      appLink.textContent = app.Titre ? '📱 ' + app.Titre : '📱 Ouvrir l’application';
      appLink.title = app.Titre || 'Ouvrir l’application';
      appLink.style.display = 'inline-flex';
      appLink.style.alignItems = 'center';
      appLink.style.padding = '10px 13px';
      appLink.style.border = '1px solid rgba(56,189,248,.35)';
      appLink.style.borderRadius = '12px';
      appLink.style.background = 'rgba(14,165,233,.10)';
      appLink.style.color = '#dceaff';
      appLink.style.fontWeight = '700';
      appLink.style.textDecoration = 'none';
      links.appendChild(appLink);
    });

    const controls = document.getElementById('controls');
    if (controls) controls.insertAdjacentElement('beforebegin', links);
    else document.getElementById('meta')?.insertAdjacentElement('afterend', links);
  }

  const originalRenderStep = renderStep;
  renderStep = function(step) {
    originalRenderStep(step);
    renderManufacturerDocs(step);
    renderStepAppLinks(step);
  };

  window.renderManufacturerDocs = renderManufacturerDocs;
  window.renderStepAppLinks = renderStepAppLinks;
})();
