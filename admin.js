/**
 * Local admin for data/works.json and media/ paths (static site — no server upload).
 */
(function () {
  const DATA_URL = 'data/works.json';
  const STORAGE_KEY = 'portfolio-works-draft';
  const MEDIA_PREFIX = 'media/';

  const SECTIONS = [
    {
      id: 'showreel',
      title: 'Showreel',
      hint: 'YouTube or Vimeo link for the homepage reel. Poster image optional (media/ path).',
      galleryLayout: false,
      filter: (p) => p.type === 'showreel',
      addLabel: 'Add showreel',
      addDefaults: () => ({
        id: 'showreel-2026',
        slug: 'showreel',
        title: 'SHOW REEL',
        type: 'showreel',
        tag: 'CASE STUDY',
        showreelUrl: '',
        media: { image: '', poster: '' },
        caption: '',
        description: '',
        tags: [],
        link: null,
      }),
      single: true,
    },
    {
      id: 'works-case',
      title: 'Works gallery — Case studies',
      hint: 'Horizontal gallery on index (CASE STUDY filter). Image thumbnail only — media/image path, no video.',
      galleryLayout: true,
      filter: (p) => p.type === 'gallery' && p.category === 'case-study',
      addLabel: 'Add case study',
      addDefaults: () => ({
        id: `work-${Date.now().toString(36).slice(-4)}`,
        slug: `work-${Date.now().toString(36).slice(-4)}`,
        title: 'New case study',
        type: 'gallery',
        category: 'case-study',
        chip: '',
        media: { image: '' },
        caption: '',
        description: '',
        tags: [],
      }),
    },
    {
      id: 'works-service',
      title: 'Works gallery — Services',
      hint: 'Gallery cards on index (SERVICE filter). Image thumbnail only — media/image path, no video.',
      galleryLayout: true,
      filter: (p) => p.type === 'gallery' && p.category === 'service',
      addLabel: 'Add service item',
      addDefaults: () => ({
        id: `service-${Date.now().toString(36).slice(-4)}`,
        slug: `service-${Date.now().toString(36).slice(-4)}`,
        title: 'New service',
        type: 'gallery',
        category: 'service',
        chip: '',
        media: { image: '' },
        caption: '',
        description: '',
        tags: [],
      }),
    },
    {
      id: 'other',
      title: 'Other / unclassified',
      hint: 'Projects that do not match a section above (fix type or category).',
      galleryLayout: false,
      filter: (p) => {
        if (p.type === 'showreel') return false;
        if (p.type === 'gallery') {
          return p.category !== 'case-study' && p.category !== 'service';
        }
        return true;
      },
      addLabel: 'Add project',
      addDefaults: () => ({
        id: `project-${Date.now().toString(36).slice(-4)}`,
        slug: `project-${Date.now().toString(36).slice(-4)}`,
        title: 'New project',
        type: 'gallery',
        category: 'case-study',
        media: { image: '' },
        caption: '',
        description: '',
        tags: [],
      }),
      hiddenIfEmpty: true,
    },
  ];

  let data = { projects: [] };
  let dirty = false;
  let mediaDirHandle = null;

  const el = {
    projects: document.getElementById('admin-projects'),
    status: document.getElementById('admin-status'),
    jsonRaw: document.getElementById('admin-json-raw'),
    pickMediaFolder: document.getElementById('btn-pick-media-folder'),
    reload: document.getElementById('btn-reload'),
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

  /** Original upload basename only — no slug prefix, case preserved. */
  function mediaBasenameFromFile(file) {
    const raw = String(file?.name || '').trim();
    if (!raw) return '';
    const base = raw.replace(/^.*[/\\]/, '');
    return base.replace(/[/\\?%*:|"<>]/g, '-');
  }

  function mediaPathForFile(file) {
    const base = mediaBasenameFromFile(file);
    return base ? `${MEDIA_PREFIX}${base}` : MEDIA_PREFIX;
  }

  function isVideoPath(path) {
    return /\.(mp4|webm|mov|m4v)$/i.test(path || '');
  }

  function isImagePath(path) {
    return /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(path || '');
  }

  function parseEmbedUrl(url) {
    const u = String(url || '').trim();
    if (!u) return null;
    let m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
    if (m) {
      return {
        type: 'youtube',
        embed: `https://www.youtube.com/embed/${m[1]}`,
      };
    }
    m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) {
      return {
        type: 'vimeo',
        embed: `https://player.vimeo.com/video/${m[1]}`,
      };
    }
    if (/^https?:\/\//i.test(u)) {
      return { type: 'link', embed: u };
    }
    return null;
  }

  async function loadWorks() {
    const res = await fetch(`${DATA_URL}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`Could not load ${DATA_URL}`);
    data = await res.json();
    if (!Array.isArray(data.projects)) data.projects = [];
    migrateShowreelFields();
    dirty = false;
    render();
    syncJsonPanel();
    setStatus('Loaded from data/works.json', true);
  }

  function migrateShowreelFields() {
    data.projects.forEach((p) => {
      if (p.type !== 'showreel') return;
      if (!p.showreelUrl && p.media?.video && /^https?:\/\//i.test(p.media.video)) {
        p.showreelUrl = p.media.video;
      }
    });
  }

  function getProject(index) {
    return data.projects[index];
  }

  function updatePreview(card, path, embedUrl) {
    const box = card.querySelector('.admin-preview');
    if (!box) return;
    box.innerHTML = '';
    box.classList.remove('admin-preview--embed');

    if (embedUrl) {
      const parsed = parseEmbedUrl(embedUrl);
      if (parsed && parsed.type !== 'link') {
        box.classList.add('admin-preview--embed');
        const iframe = document.createElement('iframe');
        iframe.src = parsed.embed;
        iframe.title = 'Showreel preview';
        iframe.loading = 'lazy';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        box.appendChild(iframe);
        return;
      }
    }

    if (!path) return;
    const url = path;
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
      if (key === 'showreelUrl') {
        updatePreview(card, null, val);
      }
      const pathInput = card.querySelector('[data-media-path]');
      if (pathInput && nested === 'media') {
        updatePreview(card, pathInput.value);
      }
      markDirty();
    });
  }

  async function saveFileToMediaFolder(file) {
    const name = mediaBasenameFromFile(file);
    if (!name) {
      alert('Could not determine filename from the selected file.');
      return false;
    }
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

  function renderShowreelFields(project, index, media) {
    return `
      <div class="admin-field">
        <label for="p-${index}-showreelUrl">Showreel URL (YouTube or Vimeo)</label>
        <input
          id="p-${index}-showreelUrl"
          data-field="showreelUrl"
          type="url"
          value="${attr(project.showreelUrl)}"
          placeholder="https://www.youtube.com/watch?v=… or https://vimeo.com/…"
        />
      </div>
      <div class="admin-field admin-media-row">
        <label>Poster / thumbnail image (optional)</label>
        <input data-media-path data-nested="media" data-key="image" value="${attr(media.image)}" placeholder="media/showreel-poster.jpg" />
        <div class="admin-media-actions">
          <input type="file" accept="image/*" data-pick="image" />
          <button type="button" class="admin-btn admin-btn--ghost" data-save-media="image">Save file to media/</button>
        </div>
        <div class="admin-preview" aria-hidden="true"></div>
      </div>
      <div class="admin-field admin-media-row">
        <label>Poster frame path (optional, for video thumb)</label>
        <input data-media-path data-nested="media" data-key="poster" value="${attr(media.poster)}" placeholder="media/poster.jpg" />
      </div>
    `;
  }

  function renderGalleryBadge(project) {
    if (project.category === 'service') {
      return '<span class="admin-card-badge admin-card-badge--service">Service</span>';
    }
    if (project.category === 'case-study') {
      return '<span class="admin-card-badge">Case study</span>';
    }
    return '';
  }

  function renderProjectCard(project, index, sectionId) {
    const card = document.createElement('details');
    const isGallery = project.type === 'gallery';
    const isShowreel = project.type === 'showreel';
    card.className = 'admin-card';
    if (isGallery) card.classList.add('admin-card--gallery');
    if (isShowreel) card.classList.add('admin-card--showreel');
    card.dataset.section = sectionId;
    card.open = false;

    const tags = (project.tags || []).join(', ');
    const media = project.media || {};

    const typeField = isShowreel
      ? `<input type="hidden" data-field="type" value="showreel" />`
      : `
        <div class="admin-field">
          <label for="p-${index}-type">Type</label>
          <select id="p-${index}-type" data-field="type">
            ${option('showreel', project.type)}
            ${option('gallery', project.type)}
          </select>
        </div>`;

    const categoryField =
      project.type === 'gallery'
        ? `
        <div class="admin-field">
          <label for="p-${index}-category">Gallery category</label>
          <select id="p-${index}-category" data-field="category">
            ${option('case-study', project.category)}
            ${option('service', project.category)}
            <option value="" ${!project.category ? 'selected' : ''}>—</option>
          </select>
        </div>
        <div class="admin-field">
          <label for="p-${index}-chip">Chip label (optional)</label>
          <input id="p-${index}-chip" data-field="chip" value="${attr(project.chip)}" placeholder="Brand, UI, Motion…" />
        </div>`
        : '';

    const mediaBlock = isShowreel
      ? renderShowreelFields(project, index, media)
      : isGallery
        ? `
        <div class="admin-field admin-media-row">
          <label>Gallery thumbnail (image only)</label>
          <input data-media-path data-nested="media" data-key="image" value="${attr(media.image)}" placeholder="media/example.jpg" />
          <div class="admin-media-actions">
            <input type="file" accept="image/*" data-pick="image" />
            <button type="button" class="admin-btn admin-btn--ghost" data-save-media="image">Save file to media/</button>
          </div>
          <div class="admin-preview" aria-hidden="true"></div>
        </div>`
        : `
        <div class="admin-field admin-media-row">
          <label>Media — image</label>
          <input data-media-path data-nested="media" data-key="image" value="${attr(media.image)}" placeholder="media/example.jpg" />
          <div class="admin-media-actions">
            <input type="file" accept="image/*" data-pick="image" />
            <button type="button" class="admin-btn admin-btn--ghost" data-save-media="image">Save file to media/</button>
          </div>
          <div class="admin-preview" aria-hidden="true"></div>
        </div>`;

    card.innerHTML = `
      <summary>
        <span class="admin-card-title">${escapeHtml(project.title || project.slug || 'Untitled')}</span>
        ${renderGalleryBadge(project)}
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
        ${typeField}
        ${categoryField}
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
        ${mediaBlock}
        <div class="admin-card-footer">
          <a class="admin-btn admin-btn--ghost" href="work.html?slug=${encodeURIComponent(project.slug || '')}" target="_blank" rel="noopener">Preview</a>
          <a class="admin-btn admin-btn--ghost" href="index.html" target="_blank" rel="noopener">Portfolio</a>
          <button type="button" class="admin-btn admin-btn--danger" data-delete>Remove</button>
        </div>
      </div>
    `;

    bindField(card, index, 'id', '[data-field="id"]');
    bindField(card, index, 'slug', '[data-field="slug"]');
    bindField(card, index, 'title', '[data-field="title"]');
    bindField(card, index, 'type', '[data-field="type"]');
    bindField(card, index, 'category', '[data-field="category"]');
    bindField(card, index, 'chip', '[data-field="chip"]');
    bindField(card, index, 'caption', '[data-field="caption"]');
    bindField(card, index, 'description', '[data-field="description"]');
    bindField(card, index, 'tags', '[data-field="tags"]');
    bindField(card, index, 'showreelUrl', '[data-field="showreelUrl"]');

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

    if (isShowreel && project.showreelUrl) {
      updatePreview(card, null, project.showreelUrl);
    } else if (isShowreel && media.image) {
      updatePreview(card, media.image);
    }

    card.querySelectorAll('[data-pick]').forEach((fileInput) => {
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;
        const project = getProject(index);
        const key = fileInput.dataset.pick;
        const path = mediaPathForFile(file);
        const pathInput = card.querySelector(
          `[data-nested="media"][data-key="${key}"]`
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
        if (!file) {
          alert('Choose a file first with the file input above.');
          return;
        }
        const path = mediaPathForFile(file);
        const pathInput = card.querySelector(`[data-nested="media"][data-key="${key}"]`);
        const project = getProject(index);
        if (pathInput && project) {
          if (!project.media) project.media = {};
          project.media[key] = path;
          pathInput.value = path;
          updatePreview(card, path);
          markDirty();
        }
        fileInput._pendingPath = path;
        await saveFileToMediaFolder(file);
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

  function addProject(section) {
    if (section.single) {
      const existing = data.projects.some(section.filter);
      if (existing) {
        alert('Only one showreel entry is allowed. Edit the existing card.');
        return;
      }
    }
    const item = section.addDefaults();
    data.projects.push(item);
    render();
    markDirty();
    const idx = data.projects.length - 1;
    const card = el.projects?.querySelector(`[data-project-index="${idx}"]`);
    if (card) {
      card.open = true;
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function stripGalleryVideoFields() {
    data.projects.forEach((p) => {
      if (p.type !== 'gallery' || !p.media) return;
      delete p.media.video;
      delete p.media.poster;
    });
  }

  function render() {
    if (!el.projects) return;
    stripGalleryVideoFields();
    el.projects.replaceChildren();
    el.projects.className = 'admin-sections';

    SECTIONS.forEach((section) => {
      const items = data.projects
        .map((p, i) => ({ project: p, index: i }))
        .filter(({ project }) => section.filter(project));

      if (section.hiddenIfEmpty && items.length === 0) return;

      const sectionEl = document.createElement('section');
      sectionEl.className = 'admin-section';
      sectionEl.id = `admin-section-${section.id}`;

      const header = document.createElement('header');
      header.className = 'admin-section-header';
      header.innerHTML = `
        <h2 class="admin-section-title">${escapeHtml(section.title)}</h2>
        <p class="admin-section-hint">${escapeHtml(section.hint)}</p>
        <div class="admin-section-actions">
          <button type="button" class="admin-btn admin-btn--ghost" data-add-section="${section.id}">${escapeHtml(section.addLabel)}</button>
        </div>
      `;
      sectionEl.appendChild(header);

      const list = document.createElement('div');
      list.className = section.galleryLayout
        ? 'admin-section-items admin-section-items--gallery'
        : 'admin-section-items';

      if (items.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'admin-section-empty';
        empty.textContent = 'No entries yet. Use the button above to add one.';
        list.appendChild(empty);
      } else {
        items.forEach(({ project, index }) => {
          const card = renderProjectCard(project, index, section.id);
          card.dataset.projectIndex = String(index);
          list.appendChild(card);
        });
      }

      sectionEl.appendChild(list);
      el.projects.appendChild(sectionEl);

      header.querySelector(`[data-add-section="${section.id}"]`)?.addEventListener('click', () => {
        addProject(section);
      });
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
      migrateShowreelFields();
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
      migrateShowreelFields();
      render();
      markDirty();
      setStatus('Restored draft from browser', false);
    } catch (err) {
      alert(`Could not restore draft: ${err.message}`);
    }
  }

  function init() {
    el.reload?.addEventListener('click', () => {
      if (dirty && !confirm('Discard unsaved changes and reload?')) return;
      loadWorks().catch((err) => {
        console.error(err);
        setStatus('Failed to load works.json', false);
      });
    });

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
