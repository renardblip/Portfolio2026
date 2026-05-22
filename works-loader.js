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

  /** Site-root relative media path (works from index.html and work.html). */
  function resolveMediaUrl(path) {
    const raw = String(path || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) {
      return raw;
    }
    const cleaned = raw.replace(/^\.\//, '');
    if (cleaned.startsWith('/')) return cleaned;
    return cleaned;
  }

  function galleryMediaImage(project) {
    const m = project.media || {};
    return resolveMediaUrl(m.image || m.poster || '');
  }

  function galleryMediaHtml(project) {
    const img = galleryMediaImage(project);
    if (!img) {
      return '<div class="work-card-media work-card-media--placeholder" aria-hidden="true"></div>';
    }
    const safe = escapeHtml(img);
    return `<div class="work-card-media"><img class="work-card-media-img" src="${safe}" alt="" loading="lazy" decoding="async" data-gallery-img /></div>`;
  }

  function bindGalleryCardImageFallback(card) {
    const img = card.querySelector('[data-gallery-img]');
    if (!img || img.dataset.fallbackBound === '1') return;
    img.dataset.fallbackBound = '1';
    img.addEventListener('error', () => {
      const media = img.closest('.work-card-media');
      if (!media) return;
      media.classList.add('work-card-media--placeholder');
      media.classList.remove('work-card-media--broken');
      img.remove();
    });
  }

  function mediaStyle(project) {
    const img = resolveMediaUrl(project.media?.image || project.media?.poster || '');
    if (img) {
      return `background-image:url('${img.replace(/'/g, "\\'")}');background-size:cover;background-position:center;`;
    }
    const hues = {
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

  function parseVideoEmbedUrl(url) {
    const u = String(url || '').trim();
    if (!u) return null;
    let m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
    if (m) {
      return {
        type: 'youtube',
        embed: `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0`,
        watch: `https://www.youtube.com/watch?v=${m[1]}`,
      };
    }
    m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) {
      return {
        type: 'vimeo',
        embed: `https://player.vimeo.com/video/${m[1]}?autoplay=1`,
        watch: `https://vimeo.com/${m[1]}`,
      };
    }
    if (/^https?:\/\//i.test(u)) {
      return { type: 'link', embed: null, watch: u };
    }
    return null;
  }

  function showreelExternalUrl(project) {
    return (
      project.showreelUrl ||
      (project.media?.video && /^https?:\/\//i.test(project.media.video)
        ? project.media.video
        : '')
    );
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

    const externalUrl = showreelExternalUrl(project);
    const embedInfo = parseVideoEmbedUrl(externalUrl);
    const posterImage = project.media?.poster || project.media?.image || '';
    const localVideo = project.media?.video && !/^https?:\/\//i.test(project.media.video)
      ? resolveMediaUrl(project.media.video)
      : '';

    mount.querySelector('.work-video-embed')?.remove();
    let video = mount.querySelector('video.work-video-el');
    let linkEl = mount.querySelector('.work-video-link');

    if (posterImage) {
      const posterUrl = resolveMediaUrl(posterImage);
      mount.style.backgroundImage = `url('${posterUrl.replace(/'/g, "\\'")}')`;
      mount.style.backgroundSize = 'cover';
      mount.style.backgroundPosition = 'center';
    } else {
      mount.style.backgroundImage = '';
    }

    if (localVideo) {
      if (!video) {
        video = document.createElement('video');
        video.className = 'work-video-el';
        video.playsInline = true;
        video.preload = 'metadata';
        mount.insertBefore(video, mount.firstChild);
      }
      video.src = localVideo;
      if (project.media?.poster) video.poster = project.media.poster;
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

    const detailLink = project.link || (project.slug ? workUrl(project.slug) : null);
    const watchUrl = embedInfo?.watch || externalUrl || detailLink;

    if (watchUrl && !embedInfo?.embed) {
      if (!linkEl) {
        linkEl = document.createElement('a');
        linkEl.className = 'work-video-link';
        linkEl.target = '_blank';
        linkEl.rel = 'noopener noreferrer';
        mount.appendChild(linkEl);
      }
      linkEl.textContent = 'Watch showreel';
      linkEl.href = watchUrl;
      linkEl.hidden = false;
    } else if (linkEl && !detailLink) {
      linkEl.hidden = true;
    } else if (detailLink) {
      if (!linkEl) {
        linkEl = document.createElement('a');
        linkEl.className = 'work-video-link';
        linkEl.textContent = 'View project';
        mount.appendChild(linkEl);
      }
      linkEl.href = detailLink;
      linkEl.hidden = false;
      linkEl.removeAttribute('target');
      linkEl.removeAttribute('rel');
    }

    if (playBtn) {
      playBtn.hidden = false;
      playBtn.onclick = () => {
        if (embedInfo?.embed) {
          const iframe = document.createElement('iframe');
          iframe.className = 'work-video-embed';
          iframe.src = embedInfo.embed;
          iframe.title = project.title || 'Show reel';
          iframe.allow =
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
          iframe.allowFullscreen = true;
          mount.insertBefore(iframe, mount.firstChild);
          playBtn.hidden = true;
          if (captionEl) captionEl.hidden = true;
          return;
        }
        if (video) {
          video.hidden = false;
          playBtn.hidden = true;
          video.play().catch(() => {});
          return;
        }
        if (watchUrl) {
          window.open(watchUrl, '_blank', 'noopener,noreferrer');
          return;
        }
        if (detailLink) window.location.href = detailLink;
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

  function projectDetailHref(project) {
    const slug = project?.slug;
    if (!slug) return null;
    const external = project.link && /^https?:\/\//i.test(project.link) ? project.link : null;
    return external || workUrl(slug);
  }

  function renderGalleryCard(project) {
    const category = project.category || 'case-study';
    const name = project.title || project.id;
    const desc = project.caption || project.description || '';
    const slug = project.slug;
    const detailHref = projectDetailHref(project);
    const article = document.createElement('article');
    article.className = 'work-card work-card--gallery';
    if (category === 'service') article.classList.add('work-card--service');
    article.tabIndex = 0;
    article.dataset.worksCategory = category;
    if (slug) article.dataset.slug = slug;
    if (detailHref) article.dataset.href = detailHref;
    if (category === 'service') article.hidden = true;

    const openLink = detailHref
      ? `<a class="work-card-link work-card-pill" href="${escapeHtml(detailHref)}">Open project</a>`
      : '';

    article.innerHTML = `
      <div class="work-card-flip">
        <div class="work-card-inner">
          ${galleryMediaHtml(project)}
          <div class="work-card-panel work-card-panel--gallery">
            <header class="work-card-panel-head">
              <h3 class="work-card-name">${escapeHtml(name)}</h3>
              ${openLink}
            </header>
            <hr class="work-card-rule" aria-hidden="true" />
            <p class="work-card-desc">${escapeHtml(desc)}</p>
          </div>
        </div>
      </div>
    `;
    bindGalleryCardHover(article);
    bindGalleryCardImageFallback(article);
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

    const videoSrc =
      project.type !== 'gallery' && project.media?.video
        ? resolveMediaUrl(project.media.video)
        : '';
    const imageSrc = resolveMediaUrl(
      project.media?.image || project.media?.poster || ''
    );

    let mediaHtml = '';
    if (videoSrc && !/^https?:\/\//i.test(videoSrc)) {
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
