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
    const match = settingText(value).match(/(\d+(?:[.,]\d+)?)\s*kva\b/i);
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

  function normalizedSupply(value) {
    const text = settingText(value).toLowerCase();
    if (/triphas/.test(text) || text === 'tri') return 'tri';
    if (/monophas/.test(text) || text === 'mono') return 'mono';
    return '';
  }

  function selectedSupply() {
    if (typeof collected !== 'object' || !collected) return '';
    const values = Object.values(collected);
    for (let i = values.length - 1; i >= 0; i -= 1) {
      const supply = normalizedSupply(values[i]);
      if (supply) return supply;
    }
    return '';
  }

  function matchesSelectedPower(row, kva) {
    if (!kva) return true;
    const conditionKva = normalizedKva(row?.Condition);
    return !conditionKva || conditionKva === kva;
  }

  function matchesSelectedSupply(row, supply) {
    if (!supply) return true;
    const rowSupply = settingText(row?.Alimentation).toLowerCase();
    if (!rowSupply || (/mono/.test(rowSupply) && /tri/.test(rowSupply))) return true;
    const normalized = normalizedSupply(rowSupply);
    return !normalized || normalized === supply;
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

  function valueForElement(rows, element) {
    const expected = settingText(element).toLowerCase();
    const row = rows.find(item => settingText(item?.['Élément']).toLowerCase() === expected);
    return row ? settingText(row['Valeur attendue']) : '';
  }

  function appendPeakSettingAlert(rows, stepId, configId, kva, supply) {
    if (!['SCHP-130', 'SCHP-M130'].includes(stepId) || configId !== 'SCH-CFG-PEAK-001' || !kva || !supply) return;

    const current = valueForElement(rows, 'Réglage courant max');
    const compatibility = valueForElement(rows, 'Compatibilité installation');
    const ampsPerPhase = valueForElement(rows, 'Intensité par phase');
    const powerWarning = valueForElement(rows, 'Alerte puissance');
    const recommendation = valueForElement(rows, 'Préconisation');
    const prohibited = /pose interdite/i.test(compatibility);
    if (!prohibited && !current) return;

    const alert = document.createElement('div');
    alert.id = 'peakSettingAlert';
    alert.className = `peak-setting-alert${prohibited ? ' prohibited' : powerWarning ? ' warning' : ''}`;
    alert.style.marginTop = '18px';
    alert.style.padding = '16px 18px';
    alert.style.borderRadius = '14px';
    alert.style.border = prohibited
      ? '1px solid rgba(248,113,113,.65)'
      : powerWarning
        ? '1px solid rgba(251,191,36,.65)'
        : '1px solid rgba(56,189,248,.55)';
    alert.style.background = prohibited
      ? 'rgba(127,29,29,.20)'
      : powerWarning
        ? 'rgba(120,53,15,.20)'
        : 'rgba(14,165,233,.10)';

    const title = document.createElement('strong');
    title.className = 'peak-setting-alert-title';
    title.style.display = 'block';
    title.style.fontSize = '18px';
    title.style.marginBottom = '8px';
    title.textContent = prohibited
      ? '⛔ POSE INTERDITE'
      : `⚠️ RÉGLAGE PEAK CONTROLLER : ${current}`;
    alert.appendChild(title);

    const selected = document.createElement('div');
    selected.className = 'peak-setting-alert-selection';
    const supplyLabel = supply === 'tri' ? 'triphasé' : 'monophasé';
    selected.textContent = `Abonnement sélectionné : ${kva} ${supplyLabel}${ampsPerPhase ? ` — ${ampsPerPhase} par phase` : ''}`;
    alert.appendChild(selected);

    if (powerWarning) {
      const warning = document.createElement('div');
      warning.className = 'peak-setting-alert-warning';
      warning.style.marginTop = '8px';
      warning.style.fontWeight = '700';
      warning.textContent = powerWarning;
      alert.appendChild(warning);
    }

    if (recommendation) {
      const advice = document.createElement('div');
      advice.className = 'peak-setting-alert-advice';
      advice.style.marginTop = '4px';
      advice.textContent = `Préconisation : ${recommendation}`;
      alert.appendChild(advice);
    }

    document.getElementById('hint')?.insertAdjacentElement('afterend', alert);
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

  function appendInlineVisual(card, href, alt, caption) {
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'block';
    link.style.marginTop = '14px';
    link.style.borderRadius = '14px';
    link.style.overflow = 'hidden';
    link.style.border = '1px solid rgba(56,189,248,.28)';
    link.style.background = 'rgba(5,15,27,.72)';
    link.style.textDecoration = 'none';

    const image = document.createElement('img');
    image.src = href;
    image.alt = alt;
    image.loading = 'lazy';
    image.style.display = 'block';
    image.style.width = '100%';
    image.style.maxHeight = '560px';
    image.style.objectFit = 'contain';
    image.style.background = '#fff';
    link.appendChild(image);

    const label = document.createElement('div');
    label.textContent = `${caption} · cliquer pour agrandir`;
    label.style.padding = '10px 12px';
    label.style.fontSize = '12px';
    label.style.color = '#a8bad4';
    label.style.textAlign = 'center';
    link.appendChild(label);

    card.appendChild(link);
  }

  function appendF2mParameterWiring(card, stepId) {
    if (stepId !== 'F2MP-010') return;

    const title = document.createElement('strong');
    title.className = 'settings-subsection-title';
    title.textContent = '🔌 Câblage DPM / Modbus RS485';
    title.style.display = 'block';
    title.style.marginTop = '18px';
    card.appendChild(title);

    const guidance = document.createElement('div');
    guidance.className = 'settings-subsection-text';
    guidance.textContent = 'DPM ↔ CN12 : GND ↔ GND • + ↔ + • − ↔ − • câble adapté au Modbus RS485 • continuité correcte.';
    guidance.style.marginTop = '6px';
    guidance.style.lineHeight = '1.5';
    card.appendChild(guidance);

    appendInlineVisual(
      card,
      'assets/f2m/107/cablage-cn12.png',
      'Schéma de câblage DPM / CN12',
      'Schéma de câblage DPM / CN12'
    );
  }

  async function renderSettingsReference(step) {
    const request = ++renderRequest;
    document.getElementById('settingsReference')?.remove();
    document.getElementById('peakSettingAlert')?.remove();

    const stepId = settingText(step?.Step_ID);
    const configId = configIdForStep(step);
    if (!stepId || !configId) return;

    await loadSettings();
    if (request !== renderRequest || settingText(currentStepId) !== stepId) return;

    const kva = selectedKva();
    const supply = selectedSupply();
    const rows = settingsRows.filter(row =>
      settingText(row.Config_ID) === configId &&
      isDisplayable(row) &&
      matchesSelectedPower(row, kva) &&
      matchesSelectedSupply(row, supply)
    );
    if (!rows.length) return;

    appendPeakSettingAlert(rows, stepId, configId, kva, supply);

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
      appendF2mParameterWiring(card, stepId);
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
