const AUTH_TOKEN_KEY = 'community_auth_token';
const AUTH_USER_KEY = 'community_auth_user';
const DIPLOIA_AUTH_TOKEN_KEY = 'diploia_auth_token';
const DIPLOIA_AUTH_USER_KEY = 'diploia_auth_user';

function resolveBasePath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'mapai') return '/mapai';
  if (parts[0] === 'diploia') return '/diploia';
  return '';
}

const BASE_PATH = resolveBasePath();

function resolveApiOrigin() {
  const configured = window.__DIPLOIA_API_ORIGIN__;
  if (configured) return String(configured).replace(/\/+$/, '');
  const host = String(window.location.hostname || '').toLowerCase();
  if (host === 'fullscreencode.com' || host.endsWith('.fullscreencode.com')) {
    return 'https://vps-4455523-x.dattaweb.com';
  }
  return window.location.origin;
}

function resolveApiBasePath() {
  const host = String(window.location.hostname || '').toLowerCase();
  if (host === 'fullscreencode.com' || host.endsWith('.fullscreencode.com')) {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const reserved = new Set(['api', 'nube_data', 'js', 'css', 'img', 'favicon.ico', 'shared']);
    const app = parts[0];
    if (app === 'mapai') {
      const tenant = parts[1] && !reserved.has(parts[1]) && !parts[1].includes('.') ? parts[1] : null;
      const base = '/diploia';
      return tenant ? `${base}/${tenant}` : base;
    }
    if (app === 'diploia') return '/diploia';
  }
  return BASE_PATH;
}

const API_ORIGIN = resolveApiOrigin();
const API_BASE_PATH = resolveApiBasePath();

let authToken = localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(DIPLOIA_AUTH_TOKEN_KEY) || null;
let authUser = (() => {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || localStorage.getItem(DIPLOIA_AUTH_USER_KEY) || 'null');
  } catch {
    return null;
  }
})();
let pendingRedirect = null;

function apiUrl(path) {
  return `${API_ORIGIN}${API_BASE_PATH}${path}`;
}

async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
  const res = await fetch(apiUrl(path), { ...options, headers });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function setAuthState({ token, user }) {
  authToken = token || null;
  authUser = user || null;
  if (authToken && authUser) {
    localStorage.setItem(AUTH_TOKEN_KEY, authToken);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser));
    localStorage.setItem(DIPLOIA_AUTH_TOKEN_KEY, authToken);
    localStorage.setItem(DIPLOIA_AUTH_USER_KEY, JSON.stringify(authUser));
  }
}

function clearAuthState() {
  authToken = null;
  authUser = null;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(DIPLOIA_AUTH_TOKEN_KEY);
  localStorage.removeItem(DIPLOIA_AUTH_USER_KEY);
}

function $(id) {
  return document.getElementById(id);
}

function show(el, on) {
  if (!el) return;
  el.style.display = on ? '' : 'none';
}

function setError(id, message) {
  const el = $(id);
  if (!el) return;
  if (!message) {
    el.textContent = '';
    el.style.display = 'none';
    return;
  }
  el.textContent = message;
  el.style.display = '';
}

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function shortId() {
  return Math.random().toString(36).slice(2, 6);
}

function projectLink(projectId) {
  return `mapa.html?project=${encodeURIComponent(projectId)}`;
}

function renderProjects(container, projects, { showOwner = true } = {}) {
  if (!container) return;
  if (!projects || projects.length === 0) {
    container.innerHTML = '<div class="muted">Todavía no hay mapas.</div>';
    return;
  }

  container.innerHTML = projects
    .map(p => {
      const owner = p.ownerUsername ? String(p.ownerUsername) : '';
      const metaParts = [];
      if (showOwner && owner) metaParts.push(`Autor: ${owner}`);
      if (p.updatedAt) metaParts.push(`Actualizado: ${new Date(p.updatedAt).toLocaleString()}`);
      const meta = metaParts.join(' · ');
      const desc = p.description ? String(p.description) : '';
      return `
        <div class="item">
          <div>
            <h3>${escapeHtml(p.name || p.id)}</h3>
            <p class="meta">${escapeHtml(meta)}</p>
            ${desc ? `<p class="desc">${escapeHtml(desc)}</p>` : ''}
          </div>
          <div class="actions">
            <a class="btn primary" href="${projectLink(p.id)}">Ver mapa</a>
          </div>
        </div>
      `;
    })
    .join('');
}

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function refreshPublicProjects() {
  const data = await apiFetch('/api/projects/public', { method: 'GET' });
  const projects = data.projects || [];
  window.__publicProjects = projects;
  updateStats(projects);
  applyPublicFilter();
}

async function refreshMyProjects() {
  if (!authToken) return;
  const data = await apiFetch('/api/projects', { method: 'GET' });
  renderProjects($('my-projects'), data.projects || [], { showOwner: false });
}

function applyAuthUI() {
  const loggedIn = !!authToken && !!authUser;
  show($('create-card'), loggedIn);
  show($('auth-logged'), loggedIn);
  show($('auth-forms'), !loggedIn);
  const badge = $('account-badge');
  if (badge) {
    if (loggedIn) {
      badge.textContent = String(authUser.username || '').slice(0, 1).toUpperCase();
      badge.style.display = '';
    } else {
      badge.textContent = '';
      badge.style.display = 'none';
    }
  }
  const u = $('auth-username');
  if (u) u.textContent = loggedIn ? String(authUser.username || '') : '';
}

async function bootstrapAuth() {
  if (!authToken) {
    applyAuthUI();
    return;
  }
  try {
    const me = await apiFetch('/api/auth/me', { method: 'GET' });
    authUser = me.user;
    localStorage.setItem(AUTH_TOKEN_KEY, authToken);
    localStorage.setItem(DIPLOIA_AUTH_TOKEN_KEY, authToken);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser));
    localStorage.setItem(DIPLOIA_AUTH_USER_KEY, JSON.stringify(authUser));
  } catch {
    clearAuthState();
  }
  applyAuthUI();
}

function initTabs() {
  const tabLogin = $('tab-login');
  const tabRegister = $('tab-register');
  const formLogin = $('form-login');
  const formRegister = $('form-register');

  function setTab(mode) {
    tabLogin?.classList.toggle('active', mode === 'login');
    tabRegister?.classList.toggle('active', mode === 'register');
    show(formLogin, mode === 'login');
    show(formRegister, mode === 'register');
    setError('login-error', '');
    setError('register-error', '');
  }

  tabLogin?.addEventListener('click', () => setTab('login'));
  tabRegister?.addEventListener('click', () => setTab('register'));
}

function openAuthModal() {
  const modal = $('auth-modal');
  if (!modal) return;
  modal.style.display = '';
  setError('login-error', '');
  setError('register-error', '');
  const usernameEl = $('login-username');
  if (usernameEl) usernameEl.focus();
}

function closeAuthModal() {
  const modal = $('auth-modal');
  if (!modal) return;
  modal.style.display = 'none';
}

function initModal() {
  $('btn-account')?.addEventListener('click', () => openAuthModal());
  $('btn-auth-close')?.addEventListener('click', () => closeAuthModal());
  $('auth-modal-backdrop')?.addEventListener('click', () => closeAuthModal());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAuthModal();
  });
}

function initAuthForms() {
  $('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setError('login-error', '');
    const username = $('login-username')?.value || '';
    const password = $('login-password')?.value || '';
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      setAuthState(data);
      applyAuthUI();
      if (pendingRedirect) {
        const to = pendingRedirect;
        pendingRedirect = null;
        window.location.href = to;
        return;
      }
      closeAuthModal();
    } catch (err) {
      setError('login-error', err.message);
    }
  });

  $('form-register')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setError('register-error', '');
    const username = $('register-username')?.value || '';
    const password = $('register-password')?.value || '';
    const password2 = $('register-password2')?.value || '';
    if (!password || password.length < 4) {
      setError('register-error', 'La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (password !== password2) {
      setError('register-error', 'Las contraseñas no coinciden.');
      return;
    }
    try {
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      setAuthState(data);
      applyAuthUI();
      if (pendingRedirect) {
        const to = pendingRedirect;
        pendingRedirect = null;
        window.location.href = to;
        return;
      }
      closeAuthModal();
    } catch (err) {
      setError('register-error', err.message);
    }
  });
}

function initLogout() {
  $('btn-logout')?.addEventListener('click', async () => {
    clearAuthState();
    applyAuthUI();
    closeAuthModal();
  });
}

function updateStats(projects) {
  const statProjects = $('stat-projects');
  const statCreators = $('stat-creators');
  if (statProjects) statProjects.textContent = String(projects.length);
  if (statCreators) {
    const creators = new Set(projects.map(p => String(p.ownerUsername || '').trim()).filter(Boolean));
    statCreators.textContent = String(creators.size);
  }
}

function applyPublicFilter() {
  const q = String($('public-search')?.value || '').trim().toLowerCase();
  const all = Array.isArray(window.__publicProjects) ? window.__publicProjects : [];
  const filtered = !q
    ? all
    : all.filter(p => {
        const name = String(p.name || '').toLowerCase();
        const desc = String(p.description || '').toLowerCase();
        const owner = String(p.ownerUsername || '').toLowerCase();
        return name.includes(q) || desc.includes(q) || owner.includes(q);
      });
  renderProjects($('public-projects'), filtered, { showOwner: true });
}

function initHero() {
  $('link-diploia')?.setAttribute('href', `${BASE_PATH}/diploia/`);
  $('link-profile')?.setAttribute('href', `${BASE_PATH}/diploia/profile.html`);
  $('link-profile-cta')?.setAttribute('href', `${BASE_PATH}/diploia/profile.html`);

  $('btn-cta-explore')?.addEventListener('click', () => {
    $('explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('btn-cta-create')?.addEventListener('click', () => {
    const loggedIn = !!authToken && !!authUser;
    if (loggedIn) {
      window.location.href = `${BASE_PATH}/diploia/admin.html`;
    } else {
      pendingRedirect = `${BASE_PATH}/diploia/admin.html`;
      openAuthModal();
      $('tab-register')?.click();
    }
  });
  $('btn-go-admin')?.addEventListener('click', () => {
    const loggedIn = !!authToken && !!authUser;
    if (loggedIn) {
      window.location.href = `${BASE_PATH}/diploia/admin.html`;
    } else {
      pendingRedirect = `${BASE_PATH}/diploia/admin.html`;
      openAuthModal();
      $('tab-login')?.click();
    }
  });
  $('public-search')?.addEventListener('input', () => applyPublicFilter());
}

document.addEventListener('DOMContentLoaded', async () => {
  initModal();
  initTabs();
  initAuthForms();
  initLogout();
  initHero();
  await bootstrapAuth();
  await refreshPublicProjects();
});

