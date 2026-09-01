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

  function isVestelConfig(configId) {
    return /^VEST-CFG-00[1-4]$/i.test(configId);
  }

  function isF2mDpmConfig(configId) {
    return /^F2M-CFG-107$/i.test(configId);
  }

  function isDisplayable(row) {
    const expected = settingText(row?.['Valeur attendue']).toLowerCase();
    return expected && !['à contrôler', 'a controler', 'à identifier', 'a identifier'].includes(expected);
  }

  function normalizedKva(value) {
    const match = settingText(value).match(/^(\d+(?:[.,]\d+)?)\s*kva$/i);
    return match ? `${match[1].replace(',', '.')} kVA` : '';
  }

  function selectedKva() {
    if (typeof collected !== 'object' || !collected) return '';
    const values = Object.values(collected);
    for (let i = values.length - 1; i >= 0; i -= 1) {
      const kva = normalizedKva(values[i]);
      if (kva) return kva;
    }
    return '';
  }

  function matchesSelectedPower(row, kva) {
    if (!kva) return true;
    const conditionKva = normalizedKva(row?.Condition);
    return !conditionKva || conditionKva === kva;
  }

  function settingParts(row, duplicates) {
    const element = settingText(row?.['Élément']);
    const expected = settingText(row?.['Valeur attendue']);
    const condition = settingText(row?.Condition);
    const conditionInLabel = condition && (duplicates > 1 || normalizedKva(condition));
    return {
      label: conditionInLabel ? `${element} — ${condition}` : element,
      value: expected,
      suffix: condition && !conditionInLabel ? ` — ${condition}` : '',
    };
  }

  function appendVisualLink(card, text, href) {
    const visualLink = document.createElement('a');
    visualLink.className = 'settings-visual-link';
    visualLink.href = href;
    visualLink.target = '_blank';
    visualLink.rel = 'noopener noreferrer';
    visualLink.textContent = text;
    visualLink.style.display = 'block';
    visualLink.style.marginTop = '14px';
    visualLink.style.fontWeight = '700';
    card.appendChild(visualLink);
  }

  async function renderSettingsReference(step) {
    const request = ++renderRequest;
    document.getElementById('settingsReference')?.remove();

    const stepId = settingText(step?.Step_ID);
    const configId = configIdForStep(step);
    if (!stepId || !configId) return;

    await loadSettings();
    if (request !== renderRequest || settingText(currentStepId) !== stepId) return;

    const kva = selectedKva();
    const rows = settingsRows.filter(row =>
      settingText(row.Config_ID) === configId && isDisplayable(row) && matchesSelectedPower(row, kva)
    );
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
      const parts = settingParts(row, counts.get(key) || 1);

      const name = document.createElement('span');
      name.className = 'setting-name';
      name.textContent = `${parts.label} : `;
      item.appendChild(name);

      const value = document.createElement('span');
      value.className = 'setting-value';
      value.textContent = parts.value;
      item.appendChild(value);

      if (parts.suffix) {
        const condition = document.createElement('span');
        condition.className = 'setting-condition';
        condition.textContent = parts.suffix;
        item.appendChild(condition);
      }

      card.appendChild(item);
    });

    if (isVestelConfig(configId)) {
      appendVisualLink(
        card,
        '🖼️ Voir le repérage de la borne Vestel',
        'https://raw.githubusercontent.com/devjonathan1999-del/techdiag-irve/main/Capture/Borne%20VESTEL%20.png'
      );
    }

    if (isF2mDpmConfig(configId)) {
      appendVisualLink(
        card,
        '🖼️ Configuration Gavazzi monophasé',
        'https://raw.githubusercontent.com/devjonathan1999-del/techdiag-irve/main/Capture/Config%20gavazzi%20mono.png'
      );
      appendVisualLink(
        card,
        '🖼️ Configuration Gavazzi triphasé',
        'https://raw.githubusercontent.com/devjonathan1999-del/techdiag-irve/main/Capture/Config%20gavazzi%20tri.png'
      );
    }

    document.getElementById('meta')?.insertAdjacentElement('afterend', card);
  }

  const originalRenderStep = renderStep;
  renderStep = function(step) {
    originalRenderStep(step);
    renderSettingsReference(step);
  };

  window.renderSettingsReference = renderSettingsReference;
})();
