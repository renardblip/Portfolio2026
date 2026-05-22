/**
 * Local admin for data/works.json and media/ paths (static site — no server upload).
 */
(function () {
  const DATA_URL = 'data/works.json';
  const STORAGE_KEY = 'portfolio-works-draft';
  const MEDIA_PREFIX = 'media/';

  let data = { projects: [] };
  let dirty = false;
  let mediaDirHandle = null;

  const el = {
    projects: document.getElementById('admin-projects'),
    status: document.getElementById('admin-status'),
    jsonRaw: document.getElementById('admin-json-raw'),
    pickMediaFolder: document.getElementById('btn-pick-media-folder'),
    reload: document.getElementById('btn-reload'),
    addProject: document.getElementById('btn-add-project'),
    downloadJson: document.getElementById('btn-download-json'),
    saveJson: document.getElementById('btn-save-json'),
    applyJson: document.getElementById('btn-apply-json'),
    restoreDraft: document.getElementById('btn-restore-draft'),
  };

  function setStatus(text, ok) {
    if (!el.status) return;
    el.status.textContent = text;
    el.status.classList.toggle('is-ok', !!ok);
  }

  function markDirty() {
    dirty = true;
    setStatus('Unsaved changes', false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
    } catch (_) {}
    syncJsonPanel();
  }

  function markClean(msg) {
    dirty = false;
    setStatus(msg || 'Up to date', true);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  function syncJsonPanel() {
    if (el.jsonRaw) el.jsonRaw.value = JSON.stringify(data, null, 2);
  }

  function sanitizeFilename(name) {
    return String(name)
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }

  function mediaPathForFile(file, slug) {
    const base = sanitizeFilename(file.name);
    if (slug) {
      const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
      const stem = base.includes('.') ? base.slice(0, base.lastIndexOf('.')) : base;
      return `${MEDIA_PREFIX}${slug}-${stem}${ext}`;
    }
    return `${MEDIA_PREFIX}${base}`;
  }

  function isVideoPath(path) {
    return /\.(mp4|webm|mov|m4v)$/i.test(path || '');
  }

  function isImagePath(path) {
    return /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(path || '');
  }

  async function loadWorks() {
    const res = await fetch(`${DATA_URL}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`Could not load ${DATA_URL}`);
    data = await res.json();
    if (!Array.isArray(data.projects)) data.projects = [];
    dirty = false;
    render();
    syncJsonPanel();
    setStatus('Loaded from data/works.json', true);
  }

  function getProject(index) {
    return data.projects[index];
  }

  function updatePreview(card, path) {
    const box = card.querySelector('.admin-preview');
    if (!box) return;
    box.innerHTML = '';
    if (!path) return;
    const url = path.startsWith('http') ? path : path;
    if (isVideoPath(path)) {
      const v = document.createElement('video');
      v.src = url;
      v.controls = true;
      v.muted = true;
      v.playsInline = true;
      box.appendChild(v);
    } else if (isImagePath(path)) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.loading = 'lazy';
      box.appendChild(img);
    }
  }

  function bindField(card, index, key, selector, nested) {
    const input = card.querySelector(selector);
    if (!input) return;
    input.addEventListener('input', () => {
      const project = getProject(index);
      if (!project) return;
      const val = input.type === 'checkbox' ? input.checked : input.value;
      if (nested) {
        if (!project[nested]) project[nested] = {};
        project[nested][key] = val;
      } else if (key === 'tags') {
        project.tags = val
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
      } else {
        project[key] = val;
      }
      if (key === 'slug' || key === 'title') {
        const summary = card.querySelector('.admin-card-title');
        if (summary) {
          summary.textContent = project.title || project.slug || 'Untitled';
        }
      }
      const pathInput = card.querySelector('[data-media-path]');
      if (pathInput && (nested === 'media' || nested === 'featured')) {
        updatePreview(card, pathInput.value);
      }
      markDirty();
    });
  }

  async function saveFileToMediaFolder(file, relativePath) {
    const name = relativePath.replace(/^media\//, '');
    if (!window.showDirectoryPicker) {
      alert(
        `Browser cannot write files directly.\n\nCopy the file manually to:\nmedia/${name}`
      );
      return false;
    }
    if (!mediaDirHandle) {
      try {
        mediaDirHandle = await window.showDirectoryPicker({
          id: 'portfolio2026-media',
          mode: 'readwrite',
        });
      } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
        return false;
      }
    }
    try {
      const handle = await mediaDirHandle.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(await file.arrayBuffer());
      await writable.close();
      setStatus(`Saved media/${name}`, true);
      return true;
    } catch (err) {
      console.error(err);
      alert(`Could not write media/${name}. Check folder permissions.`);
      return false;
    }
  }

  function renderProjectCard(project, index) {
    const card = document.createElement('details');
    card.className = 'admin-card';
    card.open = index === 0;

    const tags = (project.tags || []).join(', ');
    const media = project.media || {};
    const featured = project.featured || {};

    card.innerHTML = `
      <summary>
        <span class="admin-card-title">${escapeHtml(project.title || project.slug || 'Untitled')}</span>
        <span class="admin-card-type">${escapeHtml(project.type || 'project')}</span>
      </summary>
      <div class="admin-card-body">
        <div class="admin-field">
          <label for="p-${index}-id">ID</label>
          <input id="p-${index}-id" data-field="id" value="${attr(project.id)}" />
        </div>
        <div class="admin-field">
          <label for="p-${index}-slug">Slug (URL: work.html?slug=…)</label>
          <input id="p-${index}-slug" data-field="slug" value="${attr(project.slug)}" />
        </div>
        <div class="admin-field">
          <label for="p-${index}-title">Title</label>
          <input id="p-${index}-title" data-field="title" value="${attr(project.title)}" />
        </div>
        <div class="admin-field">
          <label for="p-${index}-type">Type</label>
          <select id="p-${index}-type" data-field="type">
            ${option('showreel', project.type)}
            ${option('gallery', project.type)}
            ${option('featured', project.type)}
          </select>
        </div>
        <div class="admin-field">
          <label for="p-${index}-category">Category (gallery)</label>
          <select id="p-${index}-category" data-field="category">
            ${option('case-study', project.category)}
            ${option('service', project.category)}
            <option value="" ${!project.category ? 'selected' : ''}>—</option>
          </select>
        </div>
        <div class="admin-field">
          <label for="p-${index}-caption">Caption</label>
          <input id="p-${index}-caption" data-field="caption" value="${attr(project.caption)}" />
        </div>
        <div class="admin-field">
          <label for="p-${index}-desc">Description</label>
          <textarea id="p-${index}-desc" data-field="description">${escapeHtml(project.description || '')}</textarea>
        </div>
        <div class="admin-field">
          <label for="p-${index}-tags">Tags (comma-separated)</label>
          <input id="p-${index}-tags" data-field="tags" value="${attr(tags)}" />
        </div>
        <div class="admin-field admin-media-row">
          <label>Media — image (gallery / detail)</label>
          <input data-media-path data-nested="media" data-key="image" value="${attr(media.image)}" placeholder="media/example.jpg" />
          <div class="admin-media-actions">
            <input type="file" accept="image/*" data-pick="image" />
            <button type="button" class="admin-btn admin-btn--ghost" data-save-media="image">Save file to media/</button>
          </div>
          <div class="admin-preview" aria-hidden="true"></div>
        </div>
        <div class="admin-field admin-media-row">
          <label>Media — video (showreel / detail)</label>
          <input data-media-path data-nested="media" data-key="video" value="${attr(media.video)}" placeholder="media/showreel.mp4" />
          <div class="admin-media-actions">
            <input type="file" accept="video/*" data-pick="video" />
            <button type="button" class="admin-btn admin-btn--ghost" data-save-media="video">Save file to media/</button>
          </div>
        </div>
        <div class="admin-field admin-media-row">
          <label>Media — poster (video thumbnail)</label>
          <input data-media-path data-nested="media" data-key="poster" value="${attr(media.poster)}" placeholder="media/poster.jpg" />
          <div class="admin-media-actions">
            <input type="file" accept="image/*" data-pick="poster" />
            <button type="button" class="admin-btn admin-btn--ghost" data-save-media="poster">Save file to media/</button>
          </div>
        </div>
        <div class="admin-field admin-media-row">
          <label>Featured — image</label>
          <input data-media-path data-nested="featured" data-key="image" value="${attr(featured.image)}" />
        </div>
        <div class="admin-card-footer">
          <a class="admin-btn admin-btn--ghost" href="work.html?slug=${encodeURIComponent(project.slug || '')}" target="_blank" rel="noopener">Preview</a>
          <a class="admin-btn admin-btn--ghost" href="index.html" target="_blank" rel="noopener">Portfolio</a>
          <button type="button" class="admin-btn admin-btn--danger" data-delete>Remove project</button>
        </div>
      </div>
    `;

    bindField(card, index, 'id', '[data-field="id"]');
    bindField(card, index, 'slug', '[data-field="slug"]');
    bindField(card, index, 'title', '[data-field="title"]');
    bindField(card, index, 'type', '[data-field="type"]');
    bindField(card, index, 'category', '[data-field="category"]');
    bindField(card, index, 'caption', '[data-field="caption"]');
    bindField(card, index, 'description', '[data-field="description"]');
    bindField(card, index, 'tags', '[data-field="tags"]');

    card.querySelectorAll('[data-media-path]').forEach((input) => {
      const nested = input.dataset.nested;
      const key = input.dataset.key;
      input.addEventListener('input', () => {
        const project = getProject(index);
        if (!project[nested]) project[nested] = {};
        project[nested][key] = input.value;
        updatePreview(card, input.value);
        markDirty();
      });
      if (input.dataset.key === 'image' && input.value) updatePreview(card, input.value);
    });

    card.querySelectorAll('[data-pick]').forEach((fileInput) => {
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;
        const project = getProject(index);
        const key = fileInput.dataset.pick;
        const path = mediaPathForFile(file, project.slug);
        const pathInput = card.querySelector(
          `[data-nested="media"][data-key="${key}"], [data-nested="featured"][data-key="${key}"]`
        );
        const target =
          pathInput ||
          card.querySelector(`[data-nested="media"][data-key="${key}"]`) ||
          card.querySelector('[data-nested="media"][data-key="image"]');
        if (target) {
          const nested = target.dataset.nested;
          if (!project[nested]) project[nested] = {};
          project[nested][target.dataset.key] = path;
          target.value = path;
          updatePreview(card, path);
          markDirty();
        }
        fileInput._pendingFile = file;
        fileInput._pendingPath = path;
        setStatus(`Path set: ${path} — use “Save file to media/” or copy manually`, false);
      });
    });

    card.querySelectorAll('[data-save-media]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.saveMedia;
        const fileInput = card.querySelector(`[data-pick="${key}"]`);
        const file = fileInput?._pendingFile;
        const path =
          fileInput?._pendingPath ||
          card.querySelector(`[data-nested="media"][data-key="${key}"]`)?.value;
        if (!file) {
          alert('Choose a file first with the file input above.');
          return;
        }
        await saveFileToMediaFolder(file, path);
      });
    });

    card.querySelector('[data-delete]')?.addEventListener('click', () => {
      if (!confirm(`Remove “${project.title || project.slug}”?`)) return;
      data.projects.splice(index, 1);
      render();
      markDirty();
    });

    return card;
  }

  function render() {
    if (!el.projects) return;
    el.projects.replaceChildren();
    data.projects.forEach((p, i) => {
      el.projects.appendChild(renderProjectCard(p, i));
    });
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function attr(str) {
    return escapeHtml(str ?? '');
  }

  function option(value, current) {
    const sel = current === value ? ' selected' : '';
    return `<option value="${value}"${sel}>${value}</option>`;
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'works.json';
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus('Downloaded works.json — replace data/works.json in the project', true);
  }

  async function saveJsonToDisk() {
    const json = JSON.stringify(data, null, 2) + '\n';
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'works.json',
          types: [
            {
              description: 'JSON',
              accept: { 'application/json': ['.json'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        markClean('Saved works.json');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error(err);
      }
    }
    downloadJson();
  }

  function applyRawJson() {
    try {
      const parsed = JSON.parse(el.jsonRaw.value);
      if (!Array.isArray(parsed.projects)) throw new Error('Missing projects array');
      data = parsed;
      render();
      markDirty();
      setStatus('Applied JSON from editor', false);
    } catch (err) {
      alert(`Invalid JSON: ${err.message}`);
    }
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        alert('No draft in browser storage.');
        return;
      }
      data = JSON.parse(raw);
      render();
      markDirty();
      setStatus('Restored draft from browser', false);
    } catch (err) {
      alert(`Could not restore draft: ${err.message}`);
    }
  }

  function addProject() {
    const slug = `new-project-${Date.now().toString(36).slice(-4)}`;
    data.projects.push({
      id: slug,
      slug,
      title: 'New project',
      type: 'gallery',
      category: 'case-study',
      media: { image: '' },
      caption: '',
      description: '',
      tags: [],
    });
    render();
    markDirty();
  }

  function init() {
    el.reload?.addEventListener('click', () => {
      if (dirty && !confirm('Discard unsaved changes and reload?')) return;
      loadWorks().catch((err) => {
        console.error(err);
        setStatus('Failed to load works.json', false);
      });
    });

    el.addProject?.addEventListener('click', addProject);
    el.downloadJson?.addEventListener('click', downloadJson);
    el.saveJson?.addEventListener('click', saveJsonToDisk);
    el.applyJson?.addEventListener('click', applyRawJson);
    el.restoreDraft?.addEventListener('click', restoreDraft);

    el.pickMediaFolder?.addEventListener('click', async () => {
      if (!window.showDirectoryPicker) {
        alert('Use Chrome or Edge, or copy files manually into the media/ folder.');
        return;
      }
      try {
        mediaDirHandle = await window.showDirectoryPicker({
          id: 'portfolio2026-media',
          mode: 'readwrite',
        });
        setStatus('media/ folder selected for uploads', true);
      } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
      }
    });

    const draft = localStorage.getItem(STORAGE_KEY);
    loadWorks()
      .then(() => {
        if (draft) {
          setStatus('Draft in browser — Restore draft if needed', false);
        }
      })
      .catch((err) => {
        console.error(err);
        setStatus('Failed to load works.json', false);
      });
  }

  document.addEventListener('portfolio-admin-authenticated', init, { once: true });
})();
