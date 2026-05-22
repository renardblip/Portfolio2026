/**
 * Portfolio works — shared data + index / detail rendering
 */
(function (global) {
  const DATA_URL = 'data/works.json';
  const WORK_PAGE = 'work.html';

  let cache = null;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function galleryMediaImage(project) {
    return project.media?.image || project.featured?.image || '';
  }

  function galleryMediaHtml(project) {
    const img = galleryMediaImage(project);
    if (!img) {
      return '<div class="work-card-media work-card-media--placeholder" aria-hidden="true"></div>';
    }
    const safe = escapeHtml(img);
    return `<div class="work-card-media"><img class="work-card-media-img" src="${safe}" alt="" loading="lazy" decoding="async" /></div>`;
  }

  function mediaStyle(project) {
    const img =
      project.media?.image ||
      project.featured?.image ||
      '';
    if (img) {
      return `background-image:url('${img.replace(/'/g, "\\'")}');background-size:cover;background-position:center;`;
    }
    const hues = {
      'card-reader': 'linear-gradient(135deg,#362A55 0%,#8F5BFF 55%,#F46D7D 100%)',
      'contrast-theory': 'linear-gradient(160deg,#1A1722 0%,#6947B2 45%,#FB9718 100%)',
      'neo-brutal': 'linear-gradient(145deg,#442C53 0%,#8F5BFF 100%)',
      'gen-motion': 'linear-gradient(120deg,#1A1722 30%,#8F5BFF 70%,#FB9718 100%)',
      'brutal-ui': 'linear-gradient(180deg,#362A55 0%,#1A1722 60%)',
      'type-lab': 'linear-gradient(135deg,#703B97 0%,#1A1722 100%)',
      'brand-systems': 'linear-gradient(135deg,#442C53 0%,#8F5BFF 100%)',
      'product-ui': 'linear-gradient(160deg,#6947B2 0%,#362A55 100%)',
      'motion-pack': 'linear-gradient(120deg,#8F5BFF 0%,#F46D7D 100%)',
      'showreel': 'linear-gradient(135deg,#B8B3BC 0%,#8F5BFF 40%,#362A55 100%)',
    };
    const bg = hues[project.slug] || hues[project.id] || '#B8B3BC';
    return `background:${bg};`;
  }

  async function fetchWorks() {
    if (cache) return cache;
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`Failed to load ${DATA_URL}`);
    cache = await res.json();
    return cache;
  }

  function getProjects(data) {
    return Array.isArray(data?.projects) ? data.projects : [];
  }

  function byType(projects, type) {
    return projects.filter((p) => p.type === type);
  }

  function bySlug(projects, slug) {
    return projects.find((p) => p.slug === slug);
  }

  function workUrl(slug) {
    return `${WORK_PAGE}?slug=${encodeURIComponent(slug)}`;
  }

  function readSlugFromLocation() {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('slug');
    if (q) return q;
    const hash = window.location.hash.replace(/^#\/?/, '');
    return hash || null;
  }

  function renderShowreel(project) {
    const section = document.getElementById('show-reel');
    const mount = document.getElementById('showreel-video-mount');
    const captionEl = document.getElementById('showreel-caption');
    const playBtn = document.getElementById('showreel-play');
    const heading = document.getElementById('work-heading');
    const tagEl = section?.querySelector('.work-tag');
    if (!section || !mount || !project) return;

    if (heading) heading.textContent = project.title || 'SHOW REEL';
    if (tagEl && project.tag) tagEl.textContent = project.tag;

    const videoSrc = project.media?.video;
    const poster = project.media?.poster || '';
    let video = mount.querySelector('video');

    if (videoSrc) {
      if (!video) {
        video = document.createElement('video');
        video.className = 'work-video-el';
        video.playsInline = true;
        video.preload = 'metadata';
        mount.insertBefore(video, mount.firstChild);
      }
      video.src = videoSrc;
      if (poster) video.poster = poster;
      video.hidden = true;
    } else if (video) {
      video.remove();
      video = null;
    }

    if (captionEl) {
      const cap = project.caption || '';
      if (cap) {
        captionEl.textContent = cap;
        captionEl.hidden = false;
      } else {
        captionEl.hidden = true;
      }
    }

    const link = project.link || (project.slug ? workUrl(project.slug) : null);
    let linkEl = mount.querySelector('.work-video-link');
    if (link) {
      if (!linkEl) {
        linkEl = document.createElement('a');
        linkEl.className = 'work-video-link';
        linkEl.textContent = 'View project';
        mount.appendChild(linkEl);
      }
      linkEl.href = link;
      linkEl.hidden = false;
    } else if (linkEl) {
      linkEl.hidden = true;
    }

    if (playBtn) {
      playBtn.onclick = () => {
        if (video) {
          video.hidden = false;
          playBtn.hidden = true;
          video.play().catch(() => {});
          return;
        }
        if (link) window.location.href = link;
      };
    }
  }

  function bindGalleryCardHover(card) {
    if (!card?.classList?.contains('work-card--gallery')) return;
    if (card.dataset.galleryHoverBound === '1') return;
    card.dataset.galleryHoverBound = '1';
    card.addEventListener('mouseenter', () => {
      card.classList.add('is-media-hovered');
    });
    card.addEventListener('mouseleave', () => {
      card.classList.remove('is-media-hovered');
    });
  }

  function bindGalleryTrackHover(track) {
    if (!track) return;
    track.querySelectorAll('.work-card--gallery').forEach(bindGalleryCardHover);
  }

  function renderGalleryCard(project) {
    const category = project.category || 'case-study';
    const name = project.title || project.id;
    const desc = project.caption || project.description || '';
    const slug = project.slug;
    const article = document.createElement('article');
    article.className = 'work-card work-card--gallery';
    if (category === 'service') article.classList.add('work-card--service');
    article.tabIndex = 0;
    article.dataset.worksCategory = category;
    article.dataset.slug = slug;
    if (category === 'service') article.hidden = true;

    article.innerHTML = `
      <div class="work-card-flip">
        <div class="work-card-inner">
          ${galleryMediaHtml(project)}
          <div class="work-card-panel work-card-panel--gallery">
            <header class="work-card-panel-head">
              <h3 class="work-card-name">${escapeHtml(name)}</h3>
              <a class="work-card-link work-card-pill" href="${escapeHtml(workUrl(slug))}">Open project</a>
            </header>
            <hr class="work-card-rule" aria-hidden="true" />
            <p class="work-card-desc">${escapeHtml(desc)}</p>
          </div>
        </div>
      </div>
    `;
    bindGalleryCardHover(article);
    return article;
  }

  function renderGallerySkeletonCard() {
    const article = document.createElement('article');
    article.className = 'work-card work-card--gallery work-card--skeleton';
    article.setAttribute('aria-hidden', 'true');
    article.tabIndex = -1;
    article.innerHTML = `
      <div class="work-card-flip">
        <div class="work-card-inner">
          <div class="work-card-media work-card-media--placeholder" aria-hidden="true"></div>
          <div class="work-card-panel work-card-panel--gallery">
            <header class="work-card-panel-head">
              <h3 class="work-card-name">&nbsp;</h3>
            </header>
            <hr class="work-card-rule" aria-hidden="true" />
            <p class="work-card-desc">&nbsp;</p>
          </div>
        </div>
      </div>
    `;
    bindGalleryCardHover(article);
    return article;
  }

  function renderGallerySkeleton() {
    const track = document.getElementById('works-track');
    if (!track || track.dataset.galleryHydrated === '1') return;
    const count = Math.max(1, parseInt(track.dataset.skeletonCount || '5', 10) || 5);
    track.replaceChildren();
    for (let i = 0; i < count; i += 1) {
      track.appendChild(renderGallerySkeletonCard());
    }
    bindGalleryTrackHover(track);
    track.removeAttribute('aria-busy');
  }

  function renderGallery(projects) {
    const track = document.getElementById('works-track');
    if (!track) return;
    const items = byType(projects, 'gallery');
    track.replaceChildren();
    items.forEach((p) => track.appendChild(renderGalleryCard(p)));
    bindGalleryTrackHover(track);
    track.dataset.galleryHydrated = '1';
    track.removeAttribute('aria-busy');
  }

  function renderWorkDetail(project) {
    const root = document.getElementById('work-detail-root');
    if (!root || !project) return;

    document.title = `${project.title} — Réka Mateo Tóth`;

    const tagsHtml = (project.tags || [])
      .map((t) => `<span class="work-detail-tag">${escapeHtml(t)}</span>`)
      .join('');

    const videoSrc = project.media?.video || project.featured?.video;
    const imageSrc = project.media?.image || project.featured?.image;

    let mediaHtml = '';
    if (videoSrc) {
      mediaHtml = `<video class="work-detail-video" src="${escapeHtml(videoSrc)}" controls playsinline></video>`;
    } else if (imageSrc) {
      mediaHtml = `<img class="work-detail-image" src="${escapeHtml(imageSrc)}" alt="" />`;
    } else {
      mediaHtml = `<div class="work-detail-media-placeholder" style="${mediaStyle(project)}"></div>`;
    }

    root.innerHTML = `
      <header class="work-detail-header">
        <p class="work-detail-eyebrow">${escapeHtml(project.tag || project.type || 'Project')}</p>
        <h1 class="work-detail-title">${escapeHtml(project.title)}</h1>
        ${project.caption ? `<p class="work-detail-lead">${escapeHtml(project.caption)}</p>` : ''}
      </header>
      <div class="work-detail-media">${mediaHtml}</div>
      <div class="work-detail-body">
        <p class="work-detail-desc">${escapeHtml(project.description || '')}</p>
        ${tagsHtml ? `<div class="work-detail-tags">${tagsHtml}</div>` : ''}
      </div>
    `;
  }

  function showDetailError(message) {
    const root = document.getElementById('work-detail-root');
    if (!root) return;
    root.innerHTML = `<p class="work-detail-error">${escapeHtml(message)}</p>`;
  }

  async function initIndex() {
    const data = await fetchWorks();
    const projects = getProjects(data);
    const showreel =
      bySlug(projects, 'showreel') || byType(projects, 'showreel')[0];

    if (showreel) renderShowreel(showreel);
    renderGallery(projects);

    document.dispatchEvent(new CustomEvent('works-content-ready'));
  }

  async function initDetail() {
    const slug = readSlugFromLocation();
    if (!slug) {
      showDetailError('No project specified. Use work.html?slug=your-project');
      return;
    }
    const data = await fetchWorks();
    const project = bySlug(getProjects(data), slug);
    if (!project) {
      showDetailError(`Project not found: ${slug}`);
      return;
    }
    renderWorkDetail(project);
  }

  const api = {
    fetchWorks,
    getProjects,
    bySlug,
    workUrl,
    readSlugFromLocation,
    escapeHtml,
    initIndex,
    initDetail,
  };

  global.WorksData = api;

  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('works-track')) {
      renderGallerySkeleton();
    }

    const page = document.body.dataset.page;
    if (page === 'work') {
      initDetail().catch((err) => {
        console.error(err);
        showDetailError('Could not load project data.');
      });
      return;
    }
    if (document.getElementById('works-track') || document.getElementById('showreel-video-mount')) {
      initIndex().catch((err) => {
        console.error(err);
      });
    }
  });
})(window);
