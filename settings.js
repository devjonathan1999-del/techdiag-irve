(() => {
  let settingsRows = [], settingsPromise = null, renderRequest = 0;

  const settingText = value => String(value ?? '').trim();

  async function loadSettings() {
    if (settingsPromise) return settingsPromise;
    settingsPromise = querySheet('Reglages')
      .then(rows => {
        settingsRows = rows.filter(row => settingText(row?.Config_ID));
        return settingsRows;
      })
      .catch(error => {
        console.warn('TechDiag: impossible de charger les réglages.', error);
        settingsRows = [];
        return settingsRows;
      });
    return settingsPromise;
  }

  function configIdForStep(step) {
    const value = settingText(step?.Unité);
    return /^[A-Z0-9]+-CFG-[A-Z0-9-]+$/i.test(value) ? value : '';
  }

  function isDisplayable(row) {
    const expected = settingText(row?.['Valeur attendue']).toLowerCase();
    return expected && !['à contrôler', 'a controler', 'à identifier', 'a identifier'].includes(expected);
  }

  function settingLabel(row, duplicates) {
    const element = settingText(row?.['Élément']);
    const expected = settingText(row?.['Valeur attendue']);
    const condition = settingText(row?.Condition);
    if (condition && duplicates > 1) return `${element} — ${condition} : ${expected}`;
    if (condition) return `${element} : ${expected} — ${condition}`;
    return `${element} : ${expected}`;
  }

  async function renderSettingsReference(step) {
    const request = ++renderRequest;
    document.getElementById('settingsReference')?.remove();

    const stepId = settingText(step?.Step_ID);
    const configId = configIdForStep(step);
    if (!stepId || !configId) return;

    await loadSettings();
    if (request !== renderRequest || settingText(currentStepId) !== stepId) return;

    const rows = settingsRows.filter(row => settingText(row.Config_ID) === configId && isDisplayable(row));
    if (!rows.length) return;

    const counts = new Map();
    rows.forEach(row => {
      const key = settingText(row['Élément']);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const card = document.createElement('div');
    card.id = 'settingsReference';
    card.className = 'manualcheck';

    const title = document.createElement('strong');
    const scope = [settingText(rows[0].Configuration), settingText(rows[0].Alimentation)].filter(Boolean).join(' • ');
    title.textContent = `⚙️ Réglages attendus${scope ? ' — ' + scope : ''}`;
    card.appendChild(title);

    rows.forEach(row => {
      const item = document.createElement('div');
      item.className = 'setting-row';
      item.style.marginTop = '6px';
      const key = settingText(row['Élément']);
      item.textContent = settingLabel(row, counts.get(key) || 1);
      card.appendChild(item);
    });

    document.getElementById('meta')?.insertAdjacentElement('afterend', card);
  }

  const originalRenderStep = renderStep;
  renderStep = function(step) {
    originalRenderStep(step);
    renderSettingsReference(step);
  };

  window.renderSettingsReference = renderSettingsReference;
})();
