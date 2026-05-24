function resolveBasePath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const reserved = new Set(['api', 'nube_data', 'js', 'css', 'img', 'favicon.ico']);
  const app = parts[0];
  if (app === 'mapai' || app === 'diploia') {
    const tenant = parts[1] && !reserved.has(parts[1]) && !parts[1].includes('.') ? parts[1] : null;
    const base = `/${app}`;
    return tenant ? `${base}/${tenant}` : base;
  }
  return '';
}

const BASE_PATH = resolveBasePath();

function resolveApiOrigin() {
  const configured = window.__DIPLOIA_API_ORIGIN__;
  if (configured) return String(configured).replace(/\/+$/, '');
  const host = String(window.location.hostname || '').toLowerCase();
  if (host === 'fullscreencode.com' || host.endsWith('.fullscreencode.com') || host === 'fullscreen.com' || host.endsWith('.fullscreen.com')) {
    return 'https://vps-4455523-x.dattaweb.com';
  }
  return window.location.origin;
}

function resolveApiBasePath() {
  const host = String(window.location.hostname || '').toLowerCase();
  if (host === 'fullscreencode.com' || host.endsWith('.fullscreencode.com') || host === 'fullscreen.com' || host.endsWith('.fullscreen.com')) {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const reserved = new Set(['api', 'nube_data', 'js', 'css', 'img', 'favicon.ico']);
    const app = parts[0];
    if (app === 'mapai') {
      const tenant = parts[1] && !reserved.has(parts[1]) && !parts[1].includes('.') ? parts[1] : null;
      const base = '/mapai';
      return tenant ? `${base}/${tenant}` : base;
    }
    if (app === 'diploia') return '/diploia/diploia';
  }
  return BASE_PATH;
}

const API = resolveApiOrigin() + resolveApiBasePath() + '/api';

function resolveCommunityPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const reserved = new Set(['api', 'nube_data', 'js', 'css', 'img', 'favicon.ico']);
  const app = parts[0];
  if (app === 'mapai') return '/mapai/';
  if (app === 'diploia') {
    const tenant = parts[1] && !reserved.has(parts[1]) && !parts[1].includes('.') ? parts[1] : null;
    return tenant ? '/diploia/' : '/mapai/';
  }
  return '/';
}

const TOKEN_KEYS = ['diploia_auth_token', 'community_auth_token'];
const USER_KEYS = ['diploia_auth_user', 'community_auth_user'];

let authToken = TOKEN_KEYS.map(k => localStorage.getItem(k)).find(Boolean) || null;
let authUser = (() => {
  for (const k of USER_KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const u = JSON.parse(raw);
      if (u) return u;
    } catch {}
  }
  return null;
})();

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function clearAuthState() {
  authToken = null;
  authUser = null;
  for (const k of TOKEN_KEYS) localStorage.removeItem(k);
  for (const k of USER_KEYS) localStorage.removeItem(k);
}

async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

function setAuthUI({ loggedIn }) {
  const status = $('auth-status');
  const loginCta = $('login-cta');
  const btnLogout = $('btn-logout');
  if (status) {
    status.innerHTML = loggedIn
      ? `Sesión iniciada como <strong>${escapeHtml(authUser?.username || '')}</strong>.`
      : 'No hay sesión activa. Iniciá sesión para ver tus mapas.';
  }
  if (loginCta) loginCta.style.display = loggedIn ? 'none' : '';
  if (btnLogout) btnLogout.style.display = loggedIn ? '' : 'none';
}

function renderProjects(projects) {
  const container = $('projects');
  if (!container) return;
  if (!projects || projects.length === 0) {
    container.innerHTML = '<div class="muted">Todavía no tenés mapas.</div>';
    return;
  }

  container.innerHTML = projects
    .map(p => {
      const id = String(p.id || '');
      const name = escapeHtml(p.name || p.id || '');
      const desc = p.description ? `<div class="muted" style="margin-top:6px;">${escapeHtml(p.description)}</div>` : '';
      const metaParts = [];
      if (p.updatedAt) metaParts.push(`Actualizado: ${new Date(p.updatedAt).toLocaleString()}`);
      if (p.createdAt) metaParts.push(`Creado: ${new Date(p.createdAt).toLocaleDateString()}`);
      const meta = escapeHtml(metaParts.join(' · '));
      const qp = encodeURIComponent(id);
      return `
        <div class="item">
          <div>
            <h3>${name}</h3>
            <div class="meta">${meta}</div>
            ${desc}
          </div>
          <div class="actions">
            <a class="btn primary" href="${BASE_PATH}/mapa.html?project=${qp}">Mapa</a>
          </div>
        </div>
      `;
    })
    .join('');
}

async function bootstrap() {
  $('link-home')?.setAttribute('href', `${BASE_PATH}/`);
  $('link-admin')?.setAttribute('href', `${BASE_PATH}/admin.html`);
  $('link-login')?.setAttribute('href', `${BASE_PATH}/admin.html`);
  $('link-community')?.setAttribute('href', resolveCommunityPath());

  $('btn-logout')?.addEventListener('click', () => {
    clearAuthState();
    setAuthUI({ loggedIn: false });
    renderProjects([]);
  });

  if (!authToken) {
    setAuthUI({ loggedIn: false });
    renderProjects([]);
    return;
  }

  try {
    const me = await apiFetch('/auth/me', { method: 'GET' });
    authUser = me.user;
    localStorage.setItem('diploia_auth_token', authToken);
    localStorage.setItem('community_auth_token', authToken);
    localStorage.setItem('diploia_auth_user', JSON.stringify(authUser));
    localStorage.setItem('community_auth_user', JSON.stringify(authUser));
    setAuthUI({ loggedIn: true });
  } catch {
    clearAuthState();
    setAuthUI({ loggedIn: false });
    renderProjects([]);
    return;
  }

  try {
    const data = await apiFetch('/projects', { method: 'GET' });
    renderProjects(data.projects || []);
  } catch (e) {
    $('projects').innerHTML = `<div class="muted">${escapeHtml(e.message)}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
