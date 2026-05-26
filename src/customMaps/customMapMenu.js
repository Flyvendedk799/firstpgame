import { normalizeCustomMapPack } from './schema.js';

function fmtDate(value) {
  if (!value) return 'UNKNOWN';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'UNKNOWN';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

function fmtRelativeAge(value) {
  if (!value) return 'UNKNOWN';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'UNKNOWN';
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return 'JUST NOW';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'JUST NOW';
  if (minutes < 60) return `${minutes} MIN AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} HOUR${hours === 1 ? '' : 'S'} AGO`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} DAY${days === 1 ? '' : 'S'} AGO`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} MONTH${months === 1 ? '' : 'S'} AGO`;
  const years = Math.floor(months / 12);
  return `${years} YEAR${years === 1 ? '' : 'S'} AGO`;
}

function lastEditedLabel(pack) {
  return `LAST EDITED ${fmtRelativeAge(pack && pack.updatedAt)}`;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 0);
}

function sourceLabel(pack) {
  if (pack.source === 'builtin') return 'BUILT-IN';
  if (pack.source === 'dev') return 'PROJECT';
  return 'LOCAL';
}

export function createCustomMapMenuController(options = {}) {
  const store = options.store;
  const validator = options.validator;
  const kitRegistry = options.kitRegistry;
  const onStart = options.onStart || (() => {});
  const onEdit = options.onEdit || (() => {});
  const onBack = options.onBack || (() => {});
  const panel = document.getElementById('custom-maps-panel');
  const list = document.getElementById('cm-list');
  const detail = document.getElementById('cm-detail');
  const status = document.getElementById('cm-status');
  const importInput = document.getElementById('cm-import-file');
  let packs = [];
  let selectedId = null;

  function setStatus(text, tone = '') {
    if (!status) return;
    status.textContent = text || '';
    status.dataset.tone = tone || '';
  }

  function selectedPack() {
    return packs.find((p) => p.id === selectedId) || packs[0] || null;
  }

  function renderList() {
    if (!list) return;
    list.innerHTML = '';
    for (const pack of packs) {
      const button = document.createElement('button');
      button.className = `cm-pack ${pack.id === selectedId ? 'active' : ''}`;
      button.innerHTML = `
        <div class="cm-pack-top"><span>${sourceLabel(pack)}</span><span>${pack.maps.length} MAP${pack.maps.length === 1 ? '' : 'S'}</span></div>
        <div class="cm-pack-title">${pack.title}</div>
        <div class="cm-pack-meta">${lastEditedLabel(pack)} · ${pack.completion && pack.completion.completions ? `${pack.completion.completions} CLEAR` : 'UNCLEARED'}</div>
      `;
      button.addEventListener('click', () => {
        selectedId = pack.id;
        render();
      });
      list.appendChild(button);
    }
  }

  function renderDetail() {
    if (!detail) return;
    const pack = selectedPack();
    if (!pack) {
      detail.innerHTML = '<div class="cm-empty">NO CUSTOM MAPS FOUND</div>';
      return;
    }
    const kit = kitRegistry && kitRegistry.manifest;
    const validation = validator && kit ? validator(pack, kit) : { ok: false, errors: ['kit_loading'], warnings: [] };
    const firstMap = pack.maps[pack.startIndex || 0] || pack.maps[0];
    detail.innerHTML = `
      <div class="cm-detail-title">${pack.title}</div>
      <div class="cm-detail-meta">${pack.author || 'LOCAL'} · ${pack.source === 'builtin' ? 'BUILT-IN TEMPLATE' : pack.source === 'dev' ? 'PROJECT PACK' : 'LOCAL PACK'} · ${pack.maps.length} MAP${pack.maps.length === 1 ? '' : 'S'} · ${lastEditedLabel(pack)} · ${fmtDate(pack.updatedAt)}</div>
      <div class="cm-validation ${validation.ok ? 'ok' : 'bad'}">${validation.ok ? 'VALIDATED' : 'NEEDS ATTENTION'} · ${validation.errors.length} ERR · ${validation.warnings.length} WARN</div>
      <div class="cm-map-preview">
        <div class="cm-map-name">${firstMap ? firstMap.title : 'NO MAP'}</div>
        <div class="cm-map-sub">${firstMap ? `${firstMap.briefing.callsign || 'CUSTOM'} · ${firstMap.theme || 'B01'}` : ''}</div>
      </div>
      <div class="cm-actions">
        <button class="menu-cta menu-cta-go" id="cm-start">START</button>
        <button class="menu-cta" id="cm-edit">${pack.source === 'builtin' ? 'EDIT COPY' : 'EDIT'}</button>
        <button class="menu-cta" id="cm-export">EXPORT</button>
        <button class="menu-cta" id="cm-save-project"${pack.source === 'builtin' ? ' disabled' : ''}>SAVE TO PROJECT</button>
        <button class="menu-cta cm-danger" id="cm-delete"${pack.source === 'builtin' ? ' disabled' : ''}>DELETE</button>
      </div>
      <div class="cm-issues">${validation.errors.concat(validation.warnings).slice(0, 8).map((x) => `<div>${x}</div>`).join('')}</div>
    `;
    detail.querySelector('#cm-start')?.addEventListener('click', () => {
      if (!validation.ok) {
        setStatus('Validation blocked start. Open in editor to repair.', 'bad');
        return;
      }
      onStart(pack.id, pack.startIndex || 0);
    });
    detail.querySelector('#cm-edit')?.addEventListener('click', async () => {
      const editable = pack.source === 'builtin' ? await store.copyPack(pack) : pack;
      await refresh(editable.id);
      onEdit(editable.id, editable.startIndex || 0);
    });
    detail.querySelector('#cm-export')?.addEventListener('click', () => {
      downloadText(`${pack.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'custom-map'}.json`, store.exportPackJson(pack));
      setStatus('Exported JSON.', 'ok');
    });
    detail.querySelector('#cm-save-project')?.addEventListener('click', async () => {
      try {
        const result = await store.savePackToProject(pack);
        setStatus(`Saved ${result.file || 'project map'}.`, 'ok');
      } catch (err) {
        setStatus(err.message || 'Project save failed.', 'bad');
      }
    });
    detail.querySelector('#cm-delete')?.addEventListener('click', async () => {
      await store.deletePack(pack.id);
      selectedId = null;
      await refresh();
      setStatus('Deleted local map pack.', 'ok');
    });
  }

  function render() {
    renderList();
    renderDetail();
  }

  async function refresh(preferredId = null) {
    if (kitRegistry) {
      try { await kitRegistry.load(); } catch (err) { setStatus(err.message || 'Kit failed to load', 'bad'); }
    }
    packs = (await store.listAllPacks()).map(normalizeCustomMapPack);
    selectedId = preferredId || selectedId || (packs[0] && packs[0].id) || null;
    render();
  }

  async function show(preferredId = null) {
    if (!panel) return;
    panel.classList.add('show');
    await refresh(preferredId);
  }

  function hide() {
    if (panel) panel.classList.remove('show');
    onBack();
  }

  document.getElementById('cm-back')?.addEventListener('click', hide);
  document.getElementById('cm-import')?.addEventListener('click', () => importInput && importInput.click());
  importInput?.addEventListener('change', async () => {
    const file = importInput.files && importInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const pack = await store.importPackJson(text, { copyId: true });
      await refresh(pack.id);
      setStatus('Imported custom map pack.', 'ok');
    } catch (err) {
      setStatus(err.message || 'Import failed.', 'bad');
    } finally {
      importInput.value = '';
    }
  });

  return { show, hide, refresh, selectedPack };
}
