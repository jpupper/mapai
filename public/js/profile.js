function resolveBasePath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const reserved = new Set(['api', 'nube_data', 'js', 'css', 'img', 'favicon.ico']);
  const app = parts[0];
  if (app === 'mapai') {
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
  }
  return BASE_PATH;
}

const API = resolveApiOrigin() + resolveApiBasePath() + '/api';

// Keys de autenticación - único sistema
const TOKEN_KEYS = ['mapai_token'];
const USER_KEYS = ['mapai_user'];

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
  const jsonImport = $('json-import-section');
  const badge = $('account-badge');
  const label = $('account-label');
  if (status) {
    status.innerHTML = loggedIn
      ? `Sesi\u00f3n iniciada como <strong>${escapeHtml(authUser?.username || '')}</strong>.`
      : 'No hay sesi\u00f3n activa. Inici\u00e1 sesi\u00f3n para ver tus mapas.';
  }
  if (loginCta) loginCta.style.display = loggedIn ? 'none' : '';
  if (btnLogout) btnLogout.style.display = loggedIn ? '' : 'none';
  if (jsonImport) jsonImport.style.display = loggedIn ? '' : 'none';
  if (badge) {
    if (loggedIn) {
      badge.textContent = String(authUser.username || '').slice(0, 1).toUpperCase();
      badge.style.display = '';
    } else {
      badge.textContent = '';
      badge.style.display = 'none';
    }
  }
  if (label) label.textContent = loggedIn ? String(authUser.username || '') : 'Cuenta';
}

function renderProjects(projects) {
  const container = $('projects');
  if (!container) return;
  if (!projects || projects.length === 0) {
    container.innerHTML = '<div class="muted">Todav\u00eda no ten\u00e9s mapas.</div>';
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
      const meta = escapeHtml(metaParts.join(' \u00b7 '));
      const qp = encodeURIComponent(id);
      const thumbHtml = p.thumbnail
        ? `<div class="thumb-wrap"><img src="${escapeHtml(p.thumbnail)}" alt="${name}" loading="lazy"></div>`
        : '';
      return `
        <div class="item">
          <div class="top-row">
            ${thumbHtml}
            <div class="content-wrap">
              <h3>${name}</h3>
              <div class="meta">${meta}</div>
              ${desc}
            </div>
          </div>
          <div class="actions">
            <a class="btn primary" href="${BASE_PATH}/mapa.html?project=${qp}">Mapa</a>
            <a class="btn" href="${BASE_PATH}/admin.html?project=${qp}">Editar</a>
          </div>
        </div>
      `;
    })
    .join('');
}

function openAuthModal() {
  if (authToken && authUser) {
    window.location.href = '/mapai/mapai/profile.html';
  } else {
    const redirect = encodeURIComponent(window.location.href);
    window.location.href = 'https://vps-4455523-x.dattaweb.com/fscauth/login.html?redirect=' + redirect;
  }
}

async function importFromJson() {
  const input = $('json-input');
  const status = $('json-import-status');
  if (!input || !status) return;
  
  let jsonData;
  try {
    jsonData = JSON.parse(input.value);
  } catch (e) {
    status.textContent = 'Error: JSON inv\u00e1lido';
    status.style.display = '';
    status.style.color = '#ef4444';
    return;
  }

  if (!jsonData.nodes || typeof jsonData.nodes !== 'object' || Array.isArray(jsonData.nodes)) {
    status.textContent = 'Error: Falta "nodes" (objeto con id->nodo)';
    status.style.display = '';
    status.style.color = '#ef4444';
    return;
  }

  status.textContent = 'Creando mapa...';
  status.style.display = '';
  status.style.color = 'var(--muted)';

  try {
    const result = await apiFetch('/projects/import', {
      method: 'POST',
      body: JSON.stringify(jsonData)
    });
    const projectId = result?.project?.id;
    if (projectId) {
      status.textContent = `\u2713 Mapa creado: ${escapeHtml(result.project.name || projectId)}`;
      status.style.color = '#22c55e';
      input.value = '';
      // Reload projects
      const data = await apiFetch('/projects', { method: 'GET' });
      renderProjects(data.projects || []);
    } else {
      status.textContent = 'Error: No se pudo crear el mapa';
      status.style.color = '#ef4444';
    }
  } catch (e) {
    status.textContent = 'Error: ' + escapeHtml(e.message);
    status.style.color = '#ef4444';
  }
}

async function bootstrap() {
  $('link-home')?.setAttribute('href', '/mapai/');
  $('link-admin')?.setAttribute('href', `${BASE_PATH}/admin.html`);
  $('link-login')?.setAttribute('href', `${BASE_PATH}/admin.html`);
  $('link-community')?.setAttribute('href', '/mapai/');

  // Account button
  $('btn-account')?.addEventListener('click', openAuthModal);

  // Logout
  $('btn-logout')?.addEventListener('click', () => {
    clearAuthState();
    setAuthUI({ loggedIn: false });
    renderProjects([]);
  });

  // JSON import
  $('btn-import-json')?.addEventListener('click', importFromJson);

  if (!authToken) {
    setAuthUI({ loggedIn: false });
    renderProjects([]);
    return;
  }

  // Verify session with server
  try {
    const me = await apiFetch('/auth/me', { method: 'GET' });
    authUser = me.user;
    setAuthUI({ loggedIn: true });
  } catch {
    clearAuthState();
    setAuthUI({ loggedIn: false });
    renderProjects([]);
    return;
  }

  // Load projects
  try {
    const data = await apiFetch('/projects', { method: 'GET' });
    renderProjects(data.projects || []);
  } catch (e) {
    $('projects').innerHTML = `<div class="muted">${escapeHtml(e.message)}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
