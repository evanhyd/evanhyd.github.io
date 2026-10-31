/**
 * Evan Hyd Blog & Portfolio Application
 * Single Page Architecture with Markdown Reader & Dynamic Index
 */

(function () {
  'use strict';

  // State
  let articles = [];
  let filteredArticles = [];
  let currentArticle = null;
  let activeTag = 'all';
  let searchQuery = '';
  let currentSort = 'date-desc';

  // DOM Elements
  const viewHome = document.getElementById('view-home');
  const viewArticle = document.getElementById('view-article');
  const viewAbout = document.getElementById('view-about');
  const navArticles = document.getElementById('nav-articles');
  const navAbout = document.getElementById('nav-about');

  const articlesGrid = document.getElementById('articles-grid');
  const resultsCount = document.getElementById('results-count');
  const searchInput = document.getElementById('article-search');
  const searchClearBtn = document.getElementById('search-clear');
  const tagsFilterContainer = document.getElementById('tags-filter');
  const sortSelect = document.getElementById('sort-select');

  const articleTitle = document.getElementById('article-title');
  const articleDate = document.getElementById('article-date');
  const articleReadingTime = document.getElementById('article-reading-time');
  const articleTags = document.getElementById('article-tags');
  const articleBody = document.getElementById('article-body');
  const tocNav = document.getElementById('table-of-contents');
  const readingProgressBar = document.getElementById('reading-progress-bar');
  const copyLinkBtn = document.getElementById('copy-article-link-btn');
  const copyLinkText = document.getElementById('copy-link-text');

  const prevArticleCard = document.getElementById('prev-article-card');
  const nextArticleCard = document.getElementById('next-article-card');

  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeLabel = document.getElementById('theme-label');
  const currentYearSpan = document.getElementById('current-year');

  if (currentYearSpan) {
    currentYearSpan.textContent = new Date().getFullYear();
  }

  /* ==========================================================================
     1. Theme Switcher (System / Light / Dark)
     ========================================================================== */
  function initTheme() {
    const meta = document.querySelector('meta[name="color-scheme"]');
    let stored = localStorage.getItem('color-scheme');

    function applyTheme(theme) {
      if (theme === 'dark') {
        meta.content = 'dark';
        document.documentElement.setAttribute('data-theme-active', 'dark');
        themeLabel.textContent = 'Dark';
      } else if (theme === 'light') {
        meta.content = 'light';
        document.documentElement.setAttribute('data-theme-active', 'light');
        themeLabel.textContent = 'Light';
      } else {
        meta.content = 'light dark';
        document.documentElement.setAttribute('data-theme-active', 'system');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        themeLabel.textContent = `Auto (${systemPrefersDark ? 'Dark' : 'Light'})`;
      }
    }

    applyTheme(stored || 'system');

    themeToggleBtn.addEventListener('click', () => {
      const current = localStorage.getItem('color-scheme');
      let next;
      if (!current || current === 'light dark') {
        next = 'dark';
      } else if (current === 'dark') {
        next = 'light';
      } else {
        next = 'system';
      }

      if (next === 'system') {
        localStorage.removeItem('color-scheme');
      } else {
        localStorage.setItem('color-scheme', next);
      }
      applyTheme(next);
    });

    // Listen for cross-tab storage changes
    window.addEventListener('storage', (e) => {
      if (e.key === 'color-scheme') {
        applyTheme(e.newValue || 'system');
      }
    });

    // Listen for OS system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!localStorage.getItem('color-scheme')) {
        applyTheme('system');
      }
    });
  }

  /* ==========================================================================
     2. Articles Fetch & Filtering
     ========================================================================== */
  async function loadArticles() {
    try {
      const res = await fetch('articles.json');
      if (!res.ok) throw new Error('Failed to load articles index');
      articles = await res.json();
      buildTagFilters();
      applyFiltersAndSort();
      handleRoute();
    } catch (err) {
      console.error(err);
      resultsCount.textContent = 'Unable to load articles index. Please ensure articles.json is present.';
      articlesGrid.innerHTML = `
        <div class="empty-state">
          <h3>Failed to load articles</h3>
          <p>If you're previewing locally, run <code>node build-index.js</code> or <code>npx serve .</code></p>
        </div>
      `;
    }
  }

  function buildTagFilters() {
    const tagCounts = {};
    articles.forEach(art => {
      (art.tags || []).forEach(t => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    });

    const tags = Object.keys(tagCounts).sort();
    let html = `<button class="tag-pill ${activeTag === 'all' ? 'active' : ''}" data-tag="all">All (${articles.length})</button>`;
    tags.forEach(tag => {
      const isActive = activeTag.toLowerCase() === tag.toLowerCase();
      html += `<button class="tag-pill ${isActive ? 'active' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)} (${tagCounts[tag]})</button>`;
    });
    tagsFilterContainer.innerHTML = html;

    tagsFilterContainer.querySelectorAll('.tag-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTag = btn.dataset.tag;
        tagsFilterContainer.querySelectorAll('.tag-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyFiltersAndSort();
      });
    });
  }

  function applyFiltersAndSort() {
    filteredArticles = articles.filter(art => {
      const matchesTag = activeTag === 'all' || 
        (art.tags && art.tags.some(t => t.toLowerCase() === activeTag.toLowerCase()));
      
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        art.title.toLowerCase().includes(q) || 
        art.summary.toLowerCase().includes(q) ||
        (art.tags && art.tags.some(t => t.toLowerCase().includes(q)));

      return matchesTag && matchesSearch;
    });

    // Sorting
    filteredArticles.sort((a, b) => {
      if (currentSort === 'date-desc') return new Date(b.date) - new Date(a.date);
      if (currentSort === 'date-asc') return new Date(a.date) - new Date(b.date);
      if (currentSort === 'title') return a.title.localeCompare(b.title);
      if (currentSort === 'reading-time') {
        const getMins = str => parseInt(str, 10) || 0;
        return getMins(b.readingTime) - getMins(a.readingTime);
      }
      return 0;
    });

    renderArticlesGrid();
  }

  function renderArticlesGrid() {
    resultsCount.textContent = `Showing ${filteredArticles.length} of ${articles.length} articles`;

    if (filteredArticles.length === 0) {
      articlesGrid.innerHTML = `
        <div class="empty-state">
          <h3>No articles found</h3>
          <p>Try searching for a different keyword or resetting your tag filter.</p>
        </div>
      `;
      return;
    }

    articlesGrid.innerHTML = filteredArticles.map(art => {
      const tagsHtml = (art.tags || [])
        .map(t => `<span class="card-tag">${escapeHtml(t)}</span>`)
        .join('');

      return `
        <article class="article-card" data-slug="${escapeHtml(art.slug)}" onclick="location.hash='#/article/${encodeURIComponent(art.slug)}'">
          <div class="card-header-meta">
            <time datetime="${art.date}">📅 ${formatDate(art.date)}</time>
            <span class="card-reading-time">⏱️ ${escapeHtml(art.readingTime || '2 min')}</span>
          </div>
          <h2 class="card-title">${escapeHtml(art.title)}</h2>
          <p class="card-summary">${escapeHtml(art.summary)}</p>
          <div class="card-footer">
            <div class="card-tags">${tagsHtml}</div>
            <span class="card-read-more">Read →</span>
          </div>
        </article>
      `;
    }).join('');
  }

  /* ==========================================================================
     3. Article Reader & Markdown Parser
     ========================================================================== */
  async function openArticle(slug) {
    const article = articles.find(a => a.slug === slug);
    if (!article) {
      // Fallback: try to guess filepath
      currentArticle = { slug, title: slug, file: `articles/${slug}.md` };
    } else {
      currentArticle = article;
    }

    // Switch views
    viewHome.hidden = true;
    viewAbout.hidden = true;
    viewArticle.hidden = false;
    navArticles.classList.remove('active');
    navAbout.classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Set Header
    articleTitle.textContent = currentArticle.title || 'Loading...';
    articleDate.textContent = `📅 ${currentArticle.date ? formatDate(currentArticle.date) : 'Recently'}`;
    articleReadingTime.textContent = `⏱️ ${currentArticle.readingTime || '2 min read'}`;

    articleTags.innerHTML = (currentArticle.tags || [])
      .map(t => `<span class="badge badge-accent">${escapeHtml(t)}</span>`)
      .join('');

    articleBody.innerHTML = '<div class="loading-spinner">Loading article content...</div>';
    tocNav.innerHTML = '';

    try {
      const filePath = currentArticle.file || `articles/${slug}.md`;
      const res = await fetch(filePath);
      if (!res.ok) throw new Error(`Could not load ${filePath}`);
      const rawMarkdown = await res.text();

      // Strip YAML frontmatter if present
      const cleanMarkdown = rawMarkdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');

      // Parse with Marked
      const html = marked.parse(cleanMarkdown);
      articleBody.innerHTML = html;

      // Enhance Code Blocks & Syntax Highlight
      enhanceCodeBlocks();
      buildTableOfContents();
      setupNextPrevNavigation(slug);

    } catch (err) {
      console.error(err);
      articleBody.innerHTML = `
        <div class="empty-state">
          <h3>Failed to load article content</h3>
          <p>File path: <code>${escapeHtml(currentArticle.file || slug)}</code></p>
          <p>${escapeHtml(err.message)}</p>
        </div>
      `;
    }
  }

  function enhanceCodeBlocks() {
    const pres = articleBody.querySelectorAll('pre');
    pres.forEach(pre => {
      const code = pre.querySelector('code');
      if (!code) return;

      // Detect language
      let lang = 'text';
      for (const cls of code.classList) {
        if (cls.startsWith('language-')) {
          lang = cls.replace('language-', '');
          break;
        }
      }

      // Create custom wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';

      const header = document.createElement('div');
      header.className = 'code-header';
      header.innerHTML = `
        <span class="code-lang">${lang.toUpperCase()}</span>
        <button class="copy-code-btn" type="button">Copy</button>
      `;

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);

      // Copy Button logic
      const copyBtn = header.querySelector('.copy-code-btn');
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code.innerText);
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
        } catch (e) {
          copyBtn.textContent = 'Failed';
        }
      });
    });

    // Run Prism syntax highlight
    if (window.Prism) {
      Prism.highlightAllUnder(articleBody);
    }
  }

  function buildTableOfContents() {
    const headings = articleBody.querySelectorAll('h2, h3');
    if (headings.length === 0) {
      document.getElementById('article-toc-sidebar').style.display = 'none';
      return;
    }
    document.getElementById('article-toc-sidebar').style.display = 'block';

    let tocHtml = '';
    headings.forEach((h, index) => {
      if (!h.id) {
        h.id = 'heading-' + index + '-' + h.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      }
      const isH3 = h.tagName.toLowerCase() === 'h3';
      tocHtml += `
        <a href="#${h.id}" class="toc-item ${isH3 ? 'indent-1' : ''}" data-heading-id="${h.id}">
          ${escapeHtml(h.textContent)}
        </a>
      `;
    });
    tocNav.innerHTML = tocHtml;

    // Smooth scroll for TOC links
    tocNav.querySelectorAll('.toc-item').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('data-heading-id');
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth' });
          history.replaceState(null, '', `#/article/${currentArticle.slug}`);
        }
      });
    });
  }

  function setupNextPrevNavigation(slug) {
    const currentIndex = articles.findIndex(a => a.slug === slug);
    if (currentIndex === -1) {
      prevArticleCard.innerHTML = '';
      nextArticleCard.innerHTML = '';
      return;
    }

    const prevArticle = articles[currentIndex + 1]; // Older
    const nextArticle = articles[currentIndex - 1]; // Newer

    if (prevArticle) {
      prevArticleCard.style.display = 'block';
      prevArticleCard.innerHTML = `
        <div class="nav-direction">← Previous Post</div>
        <div class="nav-article-title">${escapeHtml(prevArticle.title)}</div>
      `;
      prevArticleCard.onclick = () => {
        location.hash = `#/article/${encodeURIComponent(prevArticle.slug)}`;
      };
    } else {
      prevArticleCard.style.display = 'none';
    }

    if (nextArticle) {
      nextArticleCard.style.display = 'block';
      nextArticleCard.innerHTML = `
        <div class="nav-direction" style="text-align: right;">Next Post →</div>
        <div class="nav-article-title" style="text-align: right;">${escapeHtml(nextArticle.title)}</div>
      `;
      nextArticleCard.onclick = () => {
        location.hash = `#/article/${encodeURIComponent(nextArticle.slug)}`;
      };
    } else {
      nextArticleCard.style.display = 'none';
    }
  }

  /* ==========================================================================
     4. Routing & View Controller
     ========================================================================== */
  function handleRoute() {
    const hash = window.location.hash || '#/';

    if (hash === '#/about') {
      viewHome.hidden = true;
      viewArticle.hidden = true;
      viewAbout.hidden = false;
      navArticles.classList.remove('active');
      navAbout.classList.add('active');
      readingProgressBar.style.width = '0%';
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else if (hash.startsWith('#/article/')) {
      const slug = decodeURIComponent(hash.slice('#/article/'.length));
      openArticle(slug);
    } else {
      // Home
      viewHome.hidden = false;
      viewArticle.hidden = true;
      viewAbout.hidden = true;
      navArticles.classList.add('active');
      navAbout.classList.remove('active');
      readingProgressBar.style.width = '0%';
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  /* ==========================================================================
     5. Reading Progress Bar & Event Listeners
     ========================================================================== */
  window.addEventListener('scroll', () => {
    if (viewArticle.hidden) {
      readingProgressBar.style.width = '0%';
      return;
    }
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight > 0) {
      const progress = Math.min(100, Math.max(0, (window.scrollY / docHeight) * 100));
      readingProgressBar.style.width = progress + '%';
    }
  });

  // Search Input handler
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    searchClearBtn.hidden = !searchQuery;
    applyFiltersAndSort();
  });

  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClearBtn.hidden = true;
    searchInput.focus();
    applyFiltersAndSort();
  });

  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    applyFiltersAndSort();
  });

  copyLinkBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      copyLinkText.textContent = 'Copied!';
      setTimeout(() => { copyLinkText.textContent = 'Share'; }, 2000);
    } catch (e) {
      copyLinkText.textContent = 'Failed';
    }
  });

  window.addEventListener('hashchange', handleRoute);

  /* Helper utilities */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  }

  // Initialize
  initTheme();
  loadArticles();
})();
