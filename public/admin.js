// ===============================================================
//  MapAI ADMIN - JavaScript Client v2.0
// ===============================================================

// Centralized API Configuration
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

const AUTH_TOKEN_KEY = 'mapai_token';
const AUTH_USER_KEY = 'mapai_user';
let authToken = localStorage.getItem(AUTH_TOKEN_KEY) || null;
let authUser = (() => {
    try {
        return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null');
    } catch {
        return null;
    }
})();
let isAuthenticated = false;
let authMode = 'login';

function cleanUrl() {
    const url = new URL(window.location.href);
    for (const key of ['token', 'username', 'userId', 'ssoset', 'nosession']) url.searchParams.delete(key);
    return url.toString();
}

function persistSsoParams() {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    if (!token) return false;
    const username = url.searchParams.get('username') || '';
    const userId = url.searchParams.get('userId') || '';
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem('community_auth_token', token);
    if (username || userId) {
        const userData = JSON.stringify({ username: String(username || userId || 'USER').trim().toUpperCase(), role: 'user', id: userId || undefined });
        localStorage.setItem(AUTH_USER_KEY, userData);
        localStorage.setItem('community_auth_user', userData);
    }
    authToken = token;
    window.history.replaceState({}, '', cleanUrl());
    return true;
}

const FSCAUTH_ORIGIN = 'https://vps-4455523-x.dattaweb.com';
const PROD_REDIRECT = window.location.href.split('?')[0]; // redirect back to current page after SSO

persistSsoParams();
if (!authToken) {
    const url = new URL(window.location.href);
    if (url.searchParams.get('nosession') === 'true') {
        window.location.href = `${FSCAUTH_ORIGIN}/fscauth/login.html?redirect=${encodeURIComponent(PROD_REDIRECT)}`;
    } else {
        window.location.href = `${FSCAUTH_ORIGIN}/fscauth/api/auth/sso-check?redirect=${encodeURIComponent(PROD_REDIRECT)}`;
    }
}

// ===============================================================
//  STATE
// ===============================================================
let nodesData = { nodes: {}, categories: [], categoryChildren: {}, config: {} };
let rankingData = { rankings: [] };
let projectsData = { projects: [] };
let spaceConfigData = {};
let currentProject = null;
let editingNodeId = null;
let currentSecondaryTags = []; // Store IDs for the tag picker

const IA_SKILL_TEXT = `Objetivo: generar un JSON válido para crear un "Mapa de Herramientas" en DiploIA.

Instrucciones IMPORTANTES:
1) Respondé SOLO con JSON válido (sin markdown, sin explicación).
2) El JSON tiene que respetar este esquema y referencias (ids, categorías, nodos y conexiones).
3) Usá IDs en kebab-case (solo a-z, 0-9 y guiones). Sin espacios.
4) URLs sin backticks, sin comillas extra y sin espacios al principio/fin (ej: "https://ejemplo.com").
5) Todo id mencionado en categorías, categoryChildren o connections DEBE existir en "nodes".

Estructura requerida (top-level):
- project (opcional): { id?, name, description?, isPublic? }
- nodes (obligatorio): objeto { [nodeId]: Node }
- categories (opcional pero recomendado): array de ids de categorías (nodes con type="category")
- categoryChildren (opcional): objeto { [categoryId]: [nodeId, ...] }
- config (opcional): objeto libre de configuración (puede ser {})

Node (cada entrada dentro de nodes):
- label (obligatorio)
- type (recomendado): "root" | "category" | "tool" | "concept"
- url (opcional)
- info (opcional): texto corto
- infoHTML (opcional): HTML simple
- connections (opcional):
  - parent: [{ id: string, type: string }]
  - children: [{ id: string, type: string }]
  - secondary: [string]

Reglas mínimas:
- Debe existir nodes.root con type="root".
- Si agregás categorías: el node de esa categoría debe tener type="category" y su id debe estar en "categories".
- Si usás categoryChildren: para cada categoryId, listá los ids de nodos que pertenecen a esa categoría.

Salida final:
- Generá un mapa coherente con 2-6 categorías y 10-40 nodos, con labels claros y URLs reales cuando aplique.
- Incluí un nombre de proyecto en project.name.`;

const IA_JSON_BASE = `{
  "project": {
    "name": "Mapa de herramientas (ejemplo IA)",
    "description": "Ejemplo mínimo con categorías y nodos",
    "isPublic": true
  },
  "nodes": {
    "root": {
      "label": "Mapa de herramientas (ejemplo IA)",
      "type": "root",
      "connections": { "parent": [], "children": [], "secondary": [] }
    },
    "programacion": {
      "label": "Programación",
      "type": "category",
      "connections": { "parent": [], "children": [], "secondary": [] }
    },
    "ia": {
      "label": "IA",
      "type": "category",
      "connections": { "parent": [], "children": [], "secondary": [] }
    },
    "javascript": {
      "label": "JavaScript",
      "type": "tool",
      "url": "https://developer.mozilla.org/es/docs/Web/JavaScript",
      "info": "Lenguaje para web y apps.",
      "connections": { "parent": [{ "id": "programacion", "type": "category" }], "children": [], "secondary": ["nodejs"] }
    },
    "nodejs": {
      "label": "Node.js",
      "type": "tool",
      "url": "https://nodejs.org/",
      "info": "Runtime de JavaScript en servidor.",
      "connections": { "parent": [{ "id": "programacion", "type": "category" }], "children": [], "secondary": ["javascript"] }
    },
    "chatgpt": {
      "label": "ChatGPT",
      "type": "tool",
      "url": "https://chat.openai.com/",
      "info": "Asistente para ideación y trabajo con texto/código.",
      "connections": { "parent": [{ "id": "ia", "type": "category" }], "children": [], "secondary": [] }
    }
  },
  "categories": ["programacion", "ia"],
  "categoryChildren": {
    "programacion": ["javascript", "nodejs"],
    "ia": ["chatgpt"]
  },
  "config": {}
}`;

const IA_COMBINED_TEXT = `${IA_SKILL_TEXT}

--- JSON BASE (ejemplo) ---
${IA_JSON_BASE}`;

// ===============================================================
//  INIT
// ===============================================================
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initModals();
    initButtons();
    initGenerateIA();
    initTagPicker();
    initConnSearch();
    initAuthUI();
    bootstrapAuth();
});

function getCurrentProjectStorageKey() {
    const u = authUser?.username ? String(authUser.username).toUpperCase() : 'ANON';
    return `diploia_current_project_${u}`;
}

function setCurrentProject(projectId) {
    currentProject = projectId;
    if (projectId) localStorage.setItem(getCurrentProjectStorageKey(), projectId);
}

function showAuthOverlay() {
    const overlay = document.getElementById('admin-login-overlay');
    overlay?.classList.add('active');
    document.getElementById('admin-username')?.focus();
}

function hideAuthOverlay() {
    const overlay = document.getElementById('admin-login-overlay');
    overlay?.classList.remove('active');
}

function setAuthState({ token, user }) {
    authToken = token || null;
    authUser = user || null;
    isAuthenticated = !!authToken && !!authUser;
    if (authToken && authUser) {
        localStorage.setItem(AUTH_TOKEN_KEY, authToken);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser));
        localStorage.setItem('community_auth_token', authToken);
        localStorage.setItem('community_auth_user', JSON.stringify(authUser));
    }
}

function clearAuthState() {
    authToken = null;
    authUser = null;
    isAuthenticated = false;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem('community_auth_token');
    localStorage.removeItem('community_auth_user');
}

function setAuthMode(mode) {
    authMode = mode;
    const btnLoginMode = document.getElementById('btn-mode-login');
    const btnRegisterMode = document.getElementById('btn-mode-register');
    const confirmGroup = document.getElementById('register-confirm-group');
    const submitBtn = document.getElementById('btn-auth-submit');
    const hint = document.getElementById('login-hint');
    const errorMsg = document.getElementById('login-error');
    const usernameEl = document.getElementById('admin-username');
    const passEl = document.getElementById('admin-password');
    const confirmEl = document.getElementById('admin-password-confirm');

    if (btnLoginMode) btnLoginMode.classList.toggle('active', mode === 'login');
    if (btnRegisterMode) btnRegisterMode.classList.toggle('active', mode === 'register');
    if (confirmGroup) confirmGroup.style.display = (mode === 'register') ? 'block' : 'none';
    if (submitBtn) submitBtn.textContent = (mode === 'register') ? 'Crear cuenta' : 'Entrar';
    if (hint) hint.textContent = '';
    if (usernameEl) usernameEl.placeholder = (mode === 'register') ? 'TUUSUARIO' : 'ADMIN';
    if (mode === 'register' && (usernameEl?.value || '').trim().toUpperCase() === 'ADMIN') {
        usernameEl.value = '';
    }
    if (passEl) passEl.value = '';
    if (confirmEl) confirmEl.value = '';
    errorMsg?.classList.remove('visible');
}

function shakeLoginCard() {
    const card = document.querySelector('.login-card');
    if (!card) return;
    card.style.animation = 'none';
    card.offsetHeight;
    card.style.animation = 'shake 0.4s';
}

function initAuthUI() {
    document.getElementById('btn-mode-login')?.addEventListener('click', () => setAuthMode('login'));
    document.getElementById('btn-mode-register')?.addEventListener('click', () => setAuthMode('register'));

    const submit = () => {
        if (authMode === 'register') registerUser();
        else loginUser();
    };

    document.getElementById('btn-auth-submit')?.addEventListener('click', submit);
    document.getElementById('admin-username')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') submit(); });
    document.getElementById('admin-password')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') submit(); });
    document.getElementById('admin-password-confirm')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') submit(); });

    document.getElementById('btn-clear-session')?.addEventListener('click', () => {
        clearAuthState();
        localStorage.removeItem(getCurrentProjectStorageKey());
        document.getElementById('admin-username').value = '';
        document.getElementById('admin-password').value = '';
        const c = document.getElementById('admin-password-confirm');
        if (c) c.value = '';
        showToast('Sesión limpiada', 'info');
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
        clearAuthState();
        setCurrentProject(null);
        showToast('Sesión cerrada', 'info');
        showAuthOverlay();
        location.reload();
    });

    setAuthMode('login');
}

async function bootstrapAuth() {
    if (!authToken) {
        showAuthOverlay();
        return;
    }

    try {
        const res = await fetch(API + '/auth/me', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) {
            clearAuthState();
            showAuthOverlay();
            return;
        }
        const data = await res.json();
        setAuthState({ token: authToken, user: data.user });
        await afterAuthReady();
    } catch (e) {
        clearAuthState();
        showAuthOverlay();
    }
}

async function loginUser() {
    const username = (document.getElementById('admin-username')?.value || '').trim().toUpperCase();
    const password = document.getElementById('admin-password')?.value || '';
    const errorMsg = document.getElementById('login-error');
    errorMsg?.classList.remove('visible');

    try {
        const res = await fetch(API + '/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            errorMsg.textContent = data.error || 'Usuario o contraseña incorrectos';
            errorMsg?.classList.add('visible');
            showToast(errorMsg.textContent, 'error');
            shakeLoginCard();
            return;
        }

        setAuthState(data);
        await afterAuthReady();
        showToast('Acceso concedido', 'success');
    } catch (e) {
        errorMsg.textContent = 'Error de conexión';
        errorMsg?.classList.add('visible');
        showToast(errorMsg.textContent, 'error');
        shakeLoginCard();
    }
}

async function registerUser() {
    const username = (document.getElementById('admin-username')?.value || '').trim().toUpperCase();
    const password = document.getElementById('admin-password')?.value || '';
    const confirm = document.getElementById('admin-password-confirm')?.value || '';
    const errorMsg = document.getElementById('login-error');
    errorMsg?.classList.remove('visible');

    if (username === 'ADMIN') {
        errorMsg.textContent = 'El usuario ADMIN está reservado';
        errorMsg?.classList.add('visible');
        showToast(errorMsg.textContent, 'error');
        shakeLoginCard();
        return;
    }

    if (password !== confirm) {
        errorMsg.textContent = 'Las contraseñas no coinciden';
        errorMsg?.classList.add('visible');
        showToast(errorMsg.textContent, 'error');
        shakeLoginCard();
        return;
    }

    try {
        const res = await fetch(API + '/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            errorMsg.textContent = data.error || 'No se pudo registrar';
            errorMsg?.classList.add('visible');
            showToast(errorMsg.textContent, 'error');
            shakeLoginCard();
            return;
        }

        setAuthState(data);
        await afterAuthReady();
        showToast('Cuenta creada', 'success');
    } catch (e) {
        errorMsg.textContent = 'Error de conexión';
        errorMsg?.classList.add('visible');
        showToast(errorMsg.textContent, 'error');
        shakeLoginCard();
    }
}

function applyRoleUI() {
    const isAdmin = authUser?.role === 'admin';

    const navUsers = document.getElementById('nav-users');
    if (navUsers) navUsers.style.display = isAdmin ? '' : 'none';

    const navImportExport = document.getElementById('nav-import-export');
    if (navImportExport) navImportExport.style.display = '';

    const navGenerateIA = document.getElementById('nav-generate-ia');
    if (navGenerateIA) navGenerateIA.style.display = '';

    const vpsCard = document.getElementById('card-sync-vps');
    if (vpsCard) vpsCard.style.display = isAdmin ? '' : 'none';

    const userBadge = document.getElementById('user-badge');
    const logoutBtn = document.getElementById('btn-logout');
    if (userBadge) {
        userBadge.style.display = '';
        userBadge.textContent = `● ${authUser.username}${isAdmin ? ' (ADMIN)' : ''}`;
    }
    if (logoutBtn) logoutBtn.style.display = '';
}

async function afterAuthReady() {
    applyRoleUI();
    hideAuthOverlay();
    await loadProjects();

    const stored = localStorage.getItem(getCurrentProjectStorageKey());
    const available = (projectsData.projects || []).map(p => p.id);
    const next = (stored && available.includes(stored)) ? stored : (available[0] || null);
    setCurrentProject(next);

    populateProjectSelector();
    renderProjects();

    if (currentProject) {
        await loadAllData();
    } else {
        showToast('Crea un proyecto para empezar', 'info');
        switchSection('projects');
    }
}

// ===============================================================
//  NAVIGATION
// ===============================================================
function initNavigation() {
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            switchSection(section);
        });
    });

    // Mobile menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (menuToggle && sidebar && overlay) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('open');
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('open');
        });
    }
}

function initGenerateIA() {
    const el = document.getElementById('ia-skill-and-json');
    if (el && !el.value) el.value = IA_COMBINED_TEXT;
}

function copyValue(elementId, successMsg) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const value = ('value' in el) ? el.value : (el.textContent || '');
    navigator.clipboard.writeText(String(value || '')).then(() => {
        showToast(successMsg || 'Copiado al portapapeles', 'success');
    });
}

function switchSection(sectionId) {
    // Update nav
    document.querySelectorAll('.nav-item[data-section]').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
    if (navItem) navItem.classList.add('active');

    // Update sections
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById('section-' + sectionId);
    if (section) section.classList.add('active');

    // Update title
    const titles = {
        'dashboard': 'Dashboard',
        'projects': 'Proyectos',
        'users': 'Usuarios',
        'categories': 'Categorías',
        'nodes': 'Nodos',
        'connections': 'Conexiones',
        'ranking': 'Ranking',
        'config': 'Configuración Mapa',
        'space-config': 'Configuracion Espacio',
        'presentation-config': 'Configuración Presentación',
        'import-export': 'Importar / Exportar',
        'generate-ia': 'Generate with IA'
    };
    document.getElementById('topbar-title').textContent = titles[sectionId] || sectionId;

    if (sectionId === 'users' && authUser?.role === 'admin') {
        loadUsers();
    }

    // Show/hide header save button based on section
    const headerSaveBtn = document.getElementById('btn-save-current-section');
    const sectionsWithSave = ['config', 'space-config', 'presentation-config'];

    if (sectionsWithSave.includes(sectionId)) {
        headerSaveBtn.style.display = 'block';
        headerSaveBtn.onclick = () => {
            if (sectionId === 'config') {
                saveConfig();
            } else if (sectionId === 'space-config') {
                saveSpaceConfig();
            } else if (sectionId === 'presentation-config') {
                savePresentationConfig();
            }
        };
    } else {
        headerSaveBtn.style.display = 'none';
    }

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
}

// ═══════════════════════════════════════════════════════════════
//  MODALS
// ═══════════════════════════════════════════════════════════════
function initModals() {
    // Close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(btn.dataset.close);
        });
    });

    // Click outside modal
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    });
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// ═══════════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ═══════════════════════════════════════════════════════════════
//  DATA LOADING
// ═══════════════════════════════════════════════════════════════
async function loadAllData() {
    try {
        const query = `?project=${currentProject}`;
        const [nodesRes, rankingRes, configRes] = await Promise.all([
            fetch(API + '/nodes' + query),
            fetch(API + '/ranking' + query),
            fetch(API + '/config' + query)
        ]);

        const nodesResp = await nodesRes.json();
        nodesData = nodesResp;
        rankingData = await rankingRes.json();
        let configResp = { config: {} };
        if (configRes.ok) {
            try {
                configResp = await configRes.json();
            } catch (e) {
                console.warn('Error parsing config response, using defaults');
            }
        } else {
            console.warn('Config endpoint returned:', configRes.status);
            try {
                configResp = await configRes.json();
            } catch (e) { }
        }

        // Ensure nodesData has config for compatibility
        nodesData.config = configResp.config || {};

        try {
            const spaceRes = await fetch(API + '/space-config' + query);
            if (spaceRes.ok) {
                spaceConfigData = await spaceRes.json();
                console.log('Space config loaded:', spaceConfigData);
            } else {
                console.warn('Space config endpoint returned:', spaceRes.status);
            }
        } catch (e) {
            console.warn('Space config not available, using defaults:', e);
        }

        renderDashboard();
        renderCategories();
        renderNodes();
        renderConnections();
        renderRanking();
        renderConfig();
        renderSpaceConfig();
        renderPresentationConfig();
        populateSelects();

        showToast('Datos cargados correctamente', 'success');
    } catch (err) {
        console.error('Error loading data:', err);
        showToast('Error al cargar datos', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
//  RENDERS
// ═══════════════════════════════════════════════════════════════

// Dashboard
function renderDashboard() {
    const nodes = nodesData.nodes || {};
    const nodeCount = Object.keys(nodes).length;
    const catCount = (nodesData.categories || []).length;

    // Count connections
    let connCount = 0;
    for (const nid in nodes) {
        const n = nodes[nid];
        if (n.connections) {
            connCount += (n.connections.children || []).length;
            connCount += (n.connections.secondary || []).length;
        }
    }

    document.getElementById('stat-total-nodes').textContent = nodeCount;
    document.getElementById('stat-categories').textContent = catCount;
    document.getElementById('stat-connections').textContent = connCount;
    document.getElementById('stat-rankings').textContent = (rankingData.rankings || []).length;

    // PROJECT LINKS
    const absoluteBase = BASE_PATH.startsWith('http') ? BASE_PATH : window.location.origin + BASE_PATH;
    const mapLink = `${absoluteBase}/mapadeherramientas.html?project=${currentProject}`;
    const presLink = `${absoluteBase}/presentation.html?project=${currentProject}`;
    const nubeLink = `${absoluteBase}/nube_universos.html?project=${currentProject}`;

    document.getElementById('link-mapa').value = mapLink;
    document.getElementById('view-mapa').href = mapLink;
    document.getElementById('link-presentacion').value = presLink;
    document.getElementById('view-presentacion').href = presLink;
    document.getElementById('link-nube').value = nubeLink;
    document.getElementById('view-nube').href = nubeLink;

    // Recent nodes (last 10 tool nodes)
    const recentList = document.getElementById('recent-nodes-list');
    const toolNodes = Object.values(nodes).filter(n => n.type !== 'category').slice(0, 10);
    recentList.innerHTML = toolNodes.map(n => `
    <div class="list-item">
      <div class="list-item-icon">🔵</div>
      <div class="list-item-content">
        <div class="list-item-title">${n.label || n.id}</div>
        <div class="list-item-sub">${n.id} ${n.url ? '• ' + n.url : ''}</div>
      </div>
    </div>
  `).join('') || '<p style="color:var(--text-muted);padding:16px;">No hay nodos cargados. Usa Importar para cargar datos.</p>';
}

// Categories
function renderCategories() {
    const list = document.getElementById('categories-list');
    const categories = nodesData.categories || [];
    const nodes = nodesData.nodes || {};
    const children = nodesData.categoryChildren || {};

    list.innerHTML = categories.map(catId => {
        const node = nodes[catId] || {};
        const childCount = (children[catId] || []).length;
        return `
      <div class="grid-card">
        <div class="grid-card-title">${node.label || catId}</div>
        <div class="grid-card-sub">ID: ${catId}</div>
        <div class="grid-card-count">${childCount} <span>nodos</span></div>
        <div class="grid-card-actions">
          <button class="btn-icon" onclick="editNode('${catId}')" title="Editar">✏️</button>
          <button class="btn-icon danger" onclick="deleteCategory('${catId}')" title="Eliminar">🗑️</button>
        </div>
      </div>
    `;
    }).join('');
}

// Nodes
function renderNodes(filter = '', catFilter = '') {
    const list = document.getElementById('nodes-list');
    const nodes = nodesData.nodes || {};
    const search = filter.toLowerCase();

    let entries = Object.values(nodes).filter(n => n.id !== 'root');

    // Filter by category
    if (catFilter) {
        const catChildren = (nodesData.categoryChildren || {})[catFilter] || [];
        entries = entries.filter(n => catChildren.includes(n.id) || n.id === catFilter);
    }

    // Search filter
    if (search) {
        entries = entries.filter(n =>
            (n.label || '').toLowerCase().includes(search) ||
            (n.id || '').toLowerCase().includes(search)
        );
    }

    // Sort: categories first, then alphabetical
    entries.sort((a, b) => {
        if (a.type === 'category' && b.type !== 'category') return -1;
        if (a.type !== 'category' && b.type === 'category') return 1;
        return (a.label || a.id).localeCompare(b.label || b.id);
    });

    list.innerHTML = entries.map(n => {
        const isCategory = n.type === 'category';
        const parentCat = findParentCategory(n.id);
        const imgUrl = n.image ? `${BASE_PATH}/${n.image}` : null;
        const icon = imgUrl ? `<img src="${imgUrl}" class="node-list-img" onerror="this.src='img/node-placeholder.png';this.onerror=null;">` : (isCategory ? '📁' : '🔵');

        return `
      <div class="list-item">
        <div class="list-item-icon">${icon}</div>
        <div class="list-item-content">
          <div class="list-item-title">${n.label || n.id}</div>
          <div class="list-item-sub">${n.id}${n.url ? ' • <a href="' + n.url + '" target="_blank" style="color:var(--accent-secondary)">' + n.url + '</a>' : ''}${parentCat ? ' • Cat: ' + parentCat : ''}</div>
        </div>
        ${isCategory ? '<span class="list-item-badge cat">categoría</span>' : ''}
        <div class="list-item-actions">
          <button class="btn-icon" onclick="editNode('${n.id}')" title="Editar">✏️</button>
          <button class="btn-icon danger" onclick="deleteNode('${n.id}')" title="Eliminar">🗑️</button>
        </div>
      </div>
    `;
    }).join('') || '<p style="color:var(--text-muted);padding:16px;">No se encontraron nodos.</p>';
}

// Connections
function renderConnections() {
    const list = document.getElementById('connections-list');
    const nodes = nodesData.nodes || {};
    let conns = [];

    for (const nid in nodes) {
        const n = nodes[nid];
        if (n.connections && n.connections.secondary) {
            for (const targetId of n.connections.secondary) {
                conns.push({ source: nid, target: targetId, type: 'secondary' });
            }
        }
    }

    conns.sort((a, b) => a.source.localeCompare(b.source));

    list.innerHTML = conns.map(c => {
        const srcNode = nodes[c.source];
        const tgtNode = nodes[c.target];
        return `
      <div class="list-item">
        <div class="list-item-icon">🔗</div>
        <div class="list-item-content">
          <div class="list-item-title">${srcNode?.label || c.source} ↔ ${tgtNode?.label || c.target}</div>
          <div class="list-item-sub">${c.source} — ${c.target}</div>
        </div>
        <span class="list-item-badge">${c.type}</span>
        <div class="list-item-actions">
          <button class="btn-icon danger" onclick="deleteConnection('${c.source}','${c.target}','${c.type}')" title="Eliminar">🗑️</button>
        </div>
      </div>
    `;
    }).join('') || '<p style="color:var(--text-muted);padding:16px;">No hay conexiones secundarias.</p>';
}

// Ranking
function renderRanking() {
    const list = document.getElementById('ranking-list');
    const rankings = rankingData.rankings || [];

    list.innerHTML = rankings.map((r, i) => {
        let posClass = '';
        if (i === 0) posClass = 'gold';
        else if (i === 1) posClass = 'silver';
        else if (i === 2) posClass = 'bronze';

        return `
      <div class="list-item ranking-item">
        <div class="ranking-pos ${posClass}">#${i + 1}</div>
        <div class="list-item-content">
          <div class="list-item-title">${r.playerName}</div>
          <div class="list-item-sub">${new Date(r.date).toLocaleDateString('es-AR')}</div>
        </div>
        <div class="ranking-score">${r.score}</div>
        <div class="ranking-stats">✓${r.correctAnswers || 0} ✗${r.wrongAnswers || 0}</div>
        <div class="list-item-actions">
           <button class="btn-icon danger" onclick="deleteRanking('${r.id}')" title="Eliminar">🗑️</button>
        </div>
      </div>
    `;
    }).join('') || '<p style="color:var(--text-muted);padding:16px;">No hay rankings todavía.</p>';
}

// ═══════════════════════════════════════════════════════════════
//  POPULATE SELECTS
// ═══════════════════════════════════════════════════════════════
function populateSelects() {
    const nodes = nodesData.nodes || {};
    const categories = nodesData.categories || [];

    // Category filter for nodes section
    const filterCat = document.getElementById('filter-category');
    filterCat.innerHTML = '<option value="">Todas las categorías</option>' +
        categories.map(c => `<option value="${c}">${nodes[c]?.label || c}</option>`).join('');

    // Parent category select in node modal
    const nodeParent = document.getElementById('node-parent');
    nodeParent.innerHTML = '<option value="">Sin categoría padre</option>' +
        categories.map(c => `<option value="${c}">${nodes[c]?.label || c}</option>`).join('');

    // Connection source/target selects
    const allNodeIds = Object.keys(nodes).sort();
    const nodeOptions = allNodeIds.map(id => `<option value="${id}">${nodes[id]?.label || id} (${id})</option>`).join('');

    document.getElementById('conn-source').innerHTML = nodeOptions;
    document.getElementById('conn-target').innerHTML = nodeOptions;
}

// ═══════════════════════════════════════════════════════════════
//  TAG PICKER LOGIC
// ═══════════════════════════════════════════════════════════════
function initTagPicker() {
    const input = document.getElementById('conn-search-input');
    const results = document.getElementById('conn-search-results');

    if (!input || !results) return;

    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            results.classList.remove('active');
            return;
        }

        const nodes = nodesData.nodes || {};
        const matches = Object.values(nodes).filter(n =>
            (n.label || '').toLowerCase().includes(query) ||
            n.id.toLowerCase().includes(query)
        ).slice(0, 10);

        if (matches.length > 0) {
            results.innerHTML = matches.map(n => `
                <div class="conn-search-item" onclick="addTag('${n.id}')">
                    <span class="item-label">${n.label || n.id}</span>
                    <span class="item-id">${n.id}</span>
                    <span class="item-type">${n.type === 'category' ? '📁' : '🔵'}</span>
                </div>
            `).join('');
            results.classList.add('active');
        } else {
            results.classList.remove('active');
        }
    });

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.conn-search-wrap')) {
            results.classList.remove('active');
        }
    });
}

function addTag(nodeId) {
    if (currentSecondaryTags.includes(nodeId)) {
        showToast('El nodo ya está en la lista', 'info');
    } else {
        currentSecondaryTags.push(nodeId);
        renderTags();
    }

    // Clear search
    document.getElementById('conn-search-input').value = '';
    document.getElementById('conn-search-results').classList.remove('active');
}

function removeTag(nodeId) {
    currentSecondaryTags = currentSecondaryTags.filter(id => id !== nodeId);
    renderTags();
}

function renderTags() {
    const container = document.getElementById('conn-tags');
    const nodes = nodesData.nodes || {};

    container.innerHTML = currentSecondaryTags.map(id => {
        const label = nodes[id]?.label || id;
        return `
            <div class="conn-tag">
                <span>${label}</span>
                <button class="conn-tag-remove" onclick="removeTag('${id}')">✕</button>
            </div>
        `;
    }).join('');

    // Update hidden field for saveNode function compatibility
    document.getElementById('node-secondary').value = currentSecondaryTags.join(', ');
}

// ═══════════════════════════════════════════════════════════════
//  CONNECTION SEARCH (Modal)
// ═══════════════════════════════════════════════════════════════
function initConnSearch() {
    const sourceSearch = document.getElementById('conn-source-search');
    const targetSearch = document.getElementById('conn-target-search');

    if (sourceSearch) {
        sourceSearch.addEventListener('input', (e) => filterSelect('conn-source', e.target.value));
    }

    if (targetSearch) {
        targetSearch.addEventListener('input', (e) => filterSelect('conn-target', e.target.value));
    }
}

function filterSelect(selectId, query) {
    const select = document.getElementById(selectId);
    const nodes = nodesData.nodes || {};
    const q = query.toLowerCase().trim();

    const allNodeIds = Object.keys(nodes).sort();
    const filtered = q
        ? allNodeIds.filter(id => id.toLowerCase().includes(q) || (nodes[id]?.label || '').toLowerCase().includes(q))
        : allNodeIds;

    select.innerHTML = filtered.map(id =>
        `<option value="${id}">${nodes[id]?.label || id} (${id})</option>`
    ).join('');
}

// ═══════════════════════════════════════════════════════════════
//  HELPER: find parent category of a node
// ═══════════════════════════════════════════════════════════════
function findParentCategory(nodeId) {
    const children = nodesData.categoryChildren || {};
    for (const catId in children) {
        if (children[catId].includes(nodeId)) {
            return catId;
        }
    }
    return null;
}

// ═══════════════════════════════════════════════════════════════
//  BUTTONS INIT
// ═══════════════════════════════════════════════════════════════
function initButtons() {
    // Add Category
    document.getElementById('btn-add-category').addEventListener('click', () => {
        document.getElementById('cat-id').value = '';
        document.getElementById('cat-label').value = '';
        document.getElementById('cat-info').value = '';
        openModal('modal-add-category');
    });

    document.getElementById('btn-save-category').addEventListener('click', saveCategory);

    // Add Node
    document.getElementById('btn-add-node').addEventListener('click', () => {
        editingNodeId = null;
        document.getElementById('modal-node-title').textContent = 'Nuevo Nodo';
        document.getElementById('node-id').value = '';
        document.getElementById('node-id').disabled = false;
        document.getElementById('node-label').value = '';
        document.getElementById('node-type').value = 'tool';
        document.getElementById('node-parent').value = '';
        document.getElementById('node-url').value = '';
        document.getElementById('node-info').value = '';
        document.getElementById('node-infohtml').value = '';
        currentSecondaryTags = [];
        renderTags();
        openModal('modal-node');
    });

    document.getElementById('btn-save-node').addEventListener('click', saveNode);

    // Add Connection
    document.getElementById('btn-add-connection').addEventListener('click', () => {
        openModal('modal-connection');
    });

    document.getElementById('btn-save-connection').addEventListener('click', saveConnection);

    // Search/Filter for nodes
    document.getElementById('search-nodes').addEventListener('input', (e) => {
        renderNodes(e.target.value, document.getElementById('filter-category').value);
    });

    document.getElementById('filter-category').addEventListener('change', (e) => {
        renderNodes(document.getElementById('search-nodes').value, e.target.value);
    });

    // Import file
    document.getElementById('btn-import').addEventListener('click', importFile);

    // Import legacy
    document.getElementById('btn-import-legacy').addEventListener('click', importLegacy);

    // Export
    document.getElementById('btn-export').addEventListener('click', exportData);

    // Regenerate thumbnails
    document.getElementById('btn-regenerate-thumbnails')?.addEventListener('click', regenerateThumbnails);

    // Import JSON (paste) -> create project
    document.getElementById('btn-import-json-create')?.addEventListener('click', importJsonCreateProject);

    // Generate with IA
    document.getElementById('btn-copy-ia-all')?.addEventListener('click', () => copyValue('ia-skill-and-json', 'Copiado al portapapeles'));

    // Sync VPS
    const btnSyncToVps = document.getElementById('btn-sync-to-vps');
    if (btnSyncToVps) btnSyncToVps.addEventListener('click', syncToVps);
    const btnSyncFromVps = document.getElementById('btn-sync-from-vps');
    if (btnSyncFromVps) btnSyncFromVps.addEventListener('click', syncFromVps);

    // Save Config
    document.getElementById('btn-save-config').addEventListener('click', saveConfig);

    // Save Space Config
    document.getElementById('btn-save-space-config').addEventListener('click', saveSpaceConfig);

    // Save Presentation Config
    document.getElementById('btn-save-presentation-config').addEventListener('click', savePresentationConfig);

    // Sync HTML from text
    document.getElementById('btn-sync-html').addEventListener('click', () => {
        const label = document.getElementById('node-label').value.trim();
        const info = document.getElementById('node-info').value.trim();

        if (!info) {
            showToast('Escribe algo en la descripción primero', 'info');
            return;
        }

        // Convert plain text to simple HTML (line breaks to <p>)
        const paragraphs = info.split('\n').filter(p => p.trim() !== '');
        const htmlContent = `<h3>${label}</h3>\n` + paragraphs.map(p => `<p>${p}</p>`).join('\n');

        document.getElementById('node-infohtml').value = htmlContent;
        showToast('HTML actualizado', 'success');
    });
}

// ═══════════════════════════════════════════════════════════════
//  CRUD OPERATIONS
// ═══════════════════════════════════════════════════════════════

// Save Category
async function saveCategory() {
    const id = document.getElementById('cat-id').value.trim();
    const label = document.getElementById('cat-label').value.trim();
    const info = document.getElementById('cat-info').value.trim();

    if (!id || !label) {
        showToast('ID y Nombre son requeridos', 'error');
        return;
    }

    try {
        const res = await fetch(API + '/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id,
                label,
                info,
                infoHTML: `<h3>${label}</h3><p>${info}</p>`
            })
        });

        const data = await res.json();
        if (data.success) {
            showToast(`Categoría "${label}" creada`, 'success');
            closeModal('modal-add-category');
            loadAllData();
        } else {
            showToast(data.error || 'Error al crear', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

// Edit Node - populate modal
function editNode(nodeId) {
    console.log('📝 Intentando editar nodo:', nodeId);
    const node = nodesData.nodes[nodeId];

    if (!node) {
        console.error('❌ No se encontró el nodo con ID:', nodeId, 'en nodesData.nodes');
        showToast('Error: No se encontró la información del nodo', 'error');
        return;
    }

    console.log('✅ Nodo encontrado:', node);

    editingNodeId = nodeId;
    document.getElementById('modal-node-title').textContent = 'Editar: ' + (node.label || nodeId);
    document.getElementById('node-id').value = nodeId;
    document.getElementById('node-id').disabled = true;
    document.getElementById('node-label').value = node.label || '';
    document.getElementById('node-type').value = node.type || 'tool';
    document.getElementById('node-parent').value = findParentCategory(nodeId) || '';
    document.getElementById('node-url').value = node.url || '';
    const imageInput = document.getElementById('node-image');
    imageInput.value = node.image || '';
    imageInput.placeholder = `Por defecto: img/nodes/${nodeId.toLowerCase()}.png`;

    document.getElementById('node-info').value = node.info || '';

    document.getElementById('node-infohtml').value = node.infoHTML || '';

    // Secondary connections
    currentSecondaryTags = (node.connections && node.connections.secondary) || [];
    renderTags();

    openModal('modal-node');
}

// Save Node
async function saveNode() {
    const id = document.getElementById('node-id').value.trim();
    const label = document.getElementById('node-label').value.trim();
    const type = document.getElementById('node-type').value;
    const parentCategory = document.getElementById('node-parent').value;
    const url = document.getElementById('node-url').value.trim();
    const image = document.getElementById('node-image').value.trim();
    const info = document.getElementById('node-info').value.trim();
    const infoHTML = document.getElementById('node-infohtml').value.trim();
    const secondaryStr = document.getElementById('node-secondary').value.trim();
    const secondary = secondaryStr ? secondaryStr.split(',').map(s => s.trim()).filter(Boolean) : [];

    if (!id || !label) {
        showToast('ID y Nombre son requeridos', 'error');
        return;
    }

    const nodeData = {
        id,
        label,
        type,
        url: url || null,
        image: image || null,
        info: info || label,
        infoHTML: infoHTML || `<h3>${label}</h3><p>${info || ''}</p>`,
        parentCategory: parentCategory || null,
        connections: {
            parent: parentCategory ? [{ id: parentCategory, type: 'primary' }] : [],
            children: [],
            secondary
        }
    };

    try {
        const isEditing = editingNodeId !== null;
        const method = isEditing ? 'PUT' : 'POST';
        const finalId = id; // use the current id for the endpoint
        const endpoint = isEditing ? API + '/nodes/' + encodeURIComponent(editingNodeId) : API + '/nodes';

        const res = await fetch(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nodeData)
        });

        const data = await res.json();
        if (data.success) {
            showToast(`Nodo "${label}" ${isEditing ? 'actualizado' : 'creado'}`, 'success');

            // Actualizar localmente antes de recargar para respuesta instantánea
            if (isEditing) {
                nodesData.nodes[editingNodeId] = data.node;
            } else {
                nodesData.nodes[id] = data.node;
                editingNodeId = finalId;

                // Actualizar UI del modal para modo edición
                const titleEl = document.getElementById('modal-node-title');
                if (titleEl) titleEl.textContent = 'Editar: ' + label;
                const idInput = document.getElementById('node-id');
                if (idInput) idInput.disabled = true;
            }

            // Recargar todo para asegurar consistencia (especialmente categoryChildren)
            await loadAllData();

            // MUY IMPORTANTE: Después de loadAllData, el selector de categoría padre
            // puede haberse reseteado porque se repueblan los selects.
            // Lo volvemos a poner como estaba.
            document.getElementById('node-parent').value = parentCategory;

            // Refrescar el editingNodeId con el ID final
            editingNodeId = finalId;
        } else {
            showToast(data.error || 'Error', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

// Delete Node
async function deleteNode(nodeId) {
    if (!confirm(`¿Eliminar el nodo "${nodesData.nodes[nodeId]?.label || nodeId}"?`)) return;

    try {
        const res = await fetch(API + '/nodes/' + encodeURIComponent(nodeId), { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('Nodo eliminado', 'success');
            loadAllData();
        } else {
            showToast(data.error || 'Error', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

// Delete Category
async function deleteCategory(catId) {
    const childCount = (nodesData.categoryChildren[catId] || []).length;
    if (!confirm(`¿Eliminar la categoría "${nodesData.nodes[catId]?.label || catId}" y sus ${childCount} nodos hijos?`)) return;

    try {
        const res = await fetch(API + '/categories/' + encodeURIComponent(catId), { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('Categoría eliminada', 'success');
            loadAllData();
        } else {
            showToast(data.error || 'Error', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

// Save Connection
async function saveConnection() {
    const source = document.getElementById('conn-source').value;
    const target = document.getElementById('conn-target').value;
    const type = document.getElementById('conn-type').value;

    if (source === target) {
        showToast('Origen y destino no pueden ser iguales', 'error');
        return;
    }

    try {
        const res = await fetch(API + '/connections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source, target, type })
        });

        const data = await res.json();
        if (data.success) {
            showToast('Conexión agregada', 'success');
            closeModal('modal-connection');
            loadAllData();
        } else {
            showToast(data.error || 'Error', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

// Delete Connection
async function deleteConnection(source, target, type) {
    if (!confirm(`¿Eliminar conexión ${source} ↔ ${target}?`)) return;

    try {
        const res = await fetch(API + '/connections', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source, target, type })
        });

        const data = await res.json();
        if (data.success) {
            showToast('Conexión eliminada', 'success');
            loadAllData();
        } else {
            showToast(data.error || 'Error', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

// Delete Ranking
async function deleteRanking(id) {
    if (!confirm('¿Eliminar esta entrada del ranking?')) return;

    try {
        const res = await fetch(API + '/ranking/' + id, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('Ranking eliminado', 'success');
            loadAllData();
        } else {
            showToast(data.error || 'Error', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════

// Default CONFIG as fallback
const DEFAULT_CONFIG = {
    rootNodeSize: 200,
    primaryNodeSize: 100,
    secondaryNodeSize: 90,
    nodeFontSize: 14,
    categoryFontSize: 18,
    rootFontSize: 20,
    popupTitleFontSize: 35,
    popupSubtitleFontSize: 30,
    popupTextFontSize: 28,
    secondaryNodeDist: 120,
    primaryDistance: 250,
    categoryDistancesMain: {
        'engines': 1300, 'frameworks': 1500, 'ia': 700, 'shaders': 1200, 'db': 800,
        'ides': 2000, 'languages': 1600, 'llm': 1200, 'frontend': 700, 'os': 1100,
        'soportes': 1800, 'protocolos': 1400, 'software-multimedia': 1000,
        'entornos': 1500, 'glosario': 1700
    },
    categoryDistances: {
        'engines': 250, 'frameworks': 250, 'ia': 180, 'shaders': 220, 'db': 220,
        'ides': 220, 'languages': 350, 'llm': 220, 'frontend': 220, 'os': 220,
        'soportes': 280, 'protocolos': 220, 'software-multimedia': 220,
        'entornos': 220, 'glosario': 380
    },
    animCategoryDelay: 3000,
    animNodeDelay: 2500,
    animTransitionSpeed: 800,
    animNodeExpansionSpeed: 400
};

function renderConfig() {
    const config = { ...DEFAULT_CONFIG, ...(nodesData.config || {}) };

    // Global fields
    const fields = [
        'rootNodeSize', 'primaryNodeSize', 'secondaryNodeSize',
        'nodeFontSize', 'categoryFontSize', 'rootFontSize',
        'primaryDistance', 'secondaryNodeDist',
        'animCategoryDelay', 'animNodeDelay', 'animTransitionSpeed', 'animNodeExpansionSpeed',
        'popupTitleFontSize', 'popupTextFontSize'
    ];

    fields.forEach(f => {
        const el = document.getElementById('cfg-' + f);
        if (el) el.value = config[f];
    });

    // Category Specific distances
    const distList = document.getElementById('category-distances-list');
    const categories = nodesData.categories || [];
    const nodes = nodesData.nodes || {};

    if (categories.length === 0) {
        distList.innerHTML = '<p class="hint-text" style="padding:10px;">No hay categorías creadas todavía.</p>';
        return;
    }

    distList.innerHTML = `
        <div class="config-cat-row config-cat-header">
            <div>Categoría</div>
            <div style="text-align:center;">Dist. Raíz</div>
            <div style="text-align:center;">Dist. Nodos</div>
        </div>
    ` + categories.map(catId => {
        const label = nodes[catId]?.label || catId;
        const mainDist = config.categoryDistancesMain?.[catId] || 1000;
        const subDist = config.categoryDistances?.[catId] || 250;

        return `
        <div class="config-cat-row">
            <div class="config-cat-info">
                <span class="config-cat-label">${label}</span>
                <span class="config-cat-id">${catId}</span>
            </div>
            <div>
                <input type="number" class="config-cat-main config-input-small" data-cat="${catId}" value="${mainDist}">
            </div>
            <div>
                <input type="number" class="config-cat-sub config-input-small" data-cat="${catId}" value="${subDist}">
            </div>
        </div>
        `;
    }).join('');
}

async function saveConfig() {
    const config = { ...DEFAULT_CONFIG, ...(nodesData.config || {}) };

    // Get global fields
    const fields = [
        'rootNodeSize', 'primaryNodeSize', 'secondaryNodeSize',
        'nodeFontSize', 'categoryFontSize', 'rootFontSize',
        'primaryDistance', 'secondaryNodeDist',
        'animCategoryDelay', 'animNodeDelay', 'animTransitionSpeed', 'animNodeExpansionSpeed',
        'popupTitleFontSize', 'popupTextFontSize'
    ];

    fields.forEach(f => {
        const el = document.getElementById('cfg-' + f);
        if (el) config[f] = Number(el.value);
    });

    // Get category distances
    config.categoryDistancesMain = {};
    config.categoryDistances = {};

    document.querySelectorAll('.config-cat-main').forEach(input => {
        config.categoryDistancesMain[input.dataset.cat] = Number(input.value);
    });

    document.querySelectorAll('.config-cat-sub').forEach(input => {
        config.categoryDistances[input.dataset.cat] = Number(input.value);
    });

    try {
        const res = await fetch(API + '/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        const data = await res.json();
        if (data.success) {
            showToast('Configuración guardada correctamente', 'success');
            nodesData.config = config;
        } else {
            showToast(data.error || 'Error al guardar', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
//  SPACE CONFIGURATION (nube_data/config.js overrides)
// ═══════════════════════════════════════════════════════════════

const SC_DEFAULTS = {
    game: {
        gameTime: 60, evalTimePerQuestion: 30, collectTime: 1.2,
        pointsRouteCorrect: 300, pointsRandomCorrect: 50, pointsWrong: -100,
        pvTotalPlanets: 10, pvPointsPerVisit: 100, pvPointsCorrect: 200, pvPointsWrong: -50,
        pvStopDistance: 120, pvAutoAdvanceTime: 15, pvInfoFontSize: 14,
        pvPanelTitleFontSize: 2.0, pvPanelDescFontSize: 1.15,
        pvMobileTitleFontSize: 1.2, pvMobileDescFontSize: 1.3, pvMobileOptionFontSize: 1.4,
        pvMobileQuestionFontSize: 0.95, pvMobileAnswerFontSize: 0.95
    },
    ship: {
        maxSpeed: 3000, acceleration: 1000, drag: 0.97,
        turnSpeed: 2.0, boostMultiplier: 2, mouseSensitivity: 0.002
    },
    scene: { fogColor: 0x06060e, fogDensity: 0.00015, ambientColor: 0x111122, ambientIntensity: 0.5 },
    stars: { count: 25000, minDistance: 3000, maxDistance: 30000, baseSize: 4 },
    connections: { traceDuration: 5.5, traceSphereRadius: 10, traceSphereGlowMult: 2.5 },
    planetTexture: { size: 512, noiseScale: 4.5, octaves: 8, darkBase: 0.0, brightRange: 3.0, contrast: 1.4 }
};

const SC_FIELD_MAP = [
    { id: 'sc-game-gameTime', path: ['game', 'gameTime'] },
    { id: 'sc-game-evalTimePerQuestion', path: ['game', 'evalTimePerQuestion'] },
    { id: 'sc-game-collectTime', path: ['game', 'collectTime'] },
    { id: 'sc-game-pointsRouteCorrect', path: ['game', 'pointsRouteCorrect'] },
    { id: 'sc-game-pointsRandomCorrect', path: ['game', 'pointsRandomCorrect'] },
    { id: 'sc-game-pointsWrong', path: ['game', 'pointsWrong'] },
    { id: 'sc-game-pvTotalPlanets', path: ['game', 'pvTotalPlanets'] },
    { id: 'sc-game-pvPointsPerVisit', path: ['game', 'pvPointsPerVisit'] },
    { id: 'sc-game-pvPointsCorrect', path: ['game', 'pvPointsCorrect'] },
    { id: 'sc-game-pvPointsWrong', path: ['game', 'pvPointsWrong'] },
    { id: 'sc-game-pvStopDistance', path: ['game', 'pvStopDistance'] },
    { id: 'sc-game-pvAutoAdvanceTime', path: ['game', 'pvAutoAdvanceTime'] },
    { id: 'sc-game-pvInfoFontSize', path: ['game', 'pvInfoFontSize'] },
    { id: 'sc-game-pvPanelTitleFontSize', path: ['game', 'pvPanelTitleFontSize'] },
    { id: 'sc-game-pvPanelDescFontSize', path: ['game', 'pvPanelDescFontSize'] },
    { id: 'sc-game-pvMobileTitleFontSize', path: ['game', 'pvMobileTitleFontSize'] },
    { id: 'sc-game-pvMobileDescFontSize', path: ['game', 'pvMobileDescFontSize'] },
    { id: 'sc-game-pvMobileOptionFontSize', path: ['game', 'pvMobileOptionFontSize'] },
    { id: 'sc-game-pvMobileQuestionFontSize', path: ['game', 'pvMobileQuestionFontSize'] },
    { id: 'sc-game-pvMobileAnswerFontSize', path: ['game', 'pvMobileAnswerFontSize'] },
    { id: 'sc-ship-maxSpeed', path: ['ship', 'maxSpeed'] },
    { id: 'sc-ship-acceleration', path: ['ship', 'acceleration'] },
    { id: 'sc-ship-drag', path: ['ship', 'drag'] },
    { id: 'sc-ship-turnSpeed', path: ['ship', 'turnSpeed'] },
    { id: 'sc-ship-boostMultiplier', path: ['ship', 'boostMultiplier'] },
    { id: 'sc-ship-mouseSensitivity', path: ['ship', 'mouseSensitivity'] },
    { id: 'sc-scene-fogColor', path: ['scene', 'fogColor'], hex: true },
    { id: 'sc-scene-fogDensity', path: ['scene', 'fogDensity'] },
    { id: 'sc-scene-ambientColor', path: ['scene', 'ambientColor'], hex: true },
    { id: 'sc-scene-ambientIntensity', path: ['scene', 'ambientIntensity'] },
    { id: 'sc-stars-count', path: ['stars', 'count'] },
    { id: 'sc-stars-minDistance', path: ['stars', 'minDistance'] },
    { id: 'sc-stars-maxDistance', path: ['stars', 'maxDistance'] },
    { id: 'sc-stars-baseSize', path: ['stars', 'baseSize'] },
    { id: 'sc-connections-traceDuration', path: ['connections', 'traceDuration'] },
    { id: 'sc-connections-traceSphereRadius', path: ['connections', 'traceSphereRadius'] },
    { id: 'sc-connections-traceSphereGlowMult', path: ['connections', 'traceSphereGlowMult'] },
    { id: 'sc-planetTexture-size', path: ['planetTexture', 'size'] },
    { id: 'sc-planetTexture-noiseScale', path: ['planetTexture', 'noiseScale'] },
    { id: 'sc-planetTexture-octaves', path: ['planetTexture', 'octaves'] },
    { id: 'sc-planetTexture-darkBase', path: ['planetTexture', 'darkBase'] },
    { id: 'sc-planetTexture-brightRange', path: ['planetTexture', 'brightRange'] },
    { id: 'sc-planetTexture-contrast', path: ['planetTexture', 'contrast'] },
];

const SC_CAT_COLOR_DEFAULTS = {
    engines: 0xff6b35, frameworks: 0x00d4ff, ia: 0xb44dff, shaders: 0x00ff88,
    db: 0xffd700, ides: 0xff4d8b, languages: 0x00c9a7, llm: 0xe864ff,
    frontend: 0x4d94ff, os: 0x8bff4d, soportes: 0xff9f43, protocolos: 0x54e0ff,
    'software-multimedia': 0xff6688, entornos: 0x88cc44, glosario: 0xccaa88
};

function _scHexStr(val) {
    if (val === undefined || val === null) return '';
    if (typeof val === 'string') return val;
    return '#' + val.toString(16).padStart(6, '0');
}

function _scParseHex(str) {
    if (!str) return 0;
    str = str.trim();
    if (str.startsWith('0x') || str.startsWith('0X')) return parseInt(str.substring(2), 16);
    if (str.startsWith('#')) return parseInt(str.substring(1), 16);
    return parseInt(str, 16);
}

function _scGet(saved, path) {
    let cur = saved;
    for (const k of path) {
        if (cur === undefined || cur === null) return undefined;
        cur = cur[k];
    }
    return cur;
}

function _scGetDefault(path) {
    return _scGet(SC_DEFAULTS, path);
}

function renderSpaceConfig() {
    const saved = spaceConfigData || {};
    console.log('Rendering space config with data:', saved);

    SC_FIELD_MAP.forEach(f => {
        const el = document.getElementById(f.id);
        if (!el) {
            console.warn(`Element not found: ${f.id}`);
            return;
        }
        const val = _scGet(saved, f.path);
        const def = _scGetDefault(f.path);
        const v = (val !== undefined) ? val : def;

        // Log específico para las variables de fuente
        if (f.path.includes('pvMobile') || f.path.includes('pvInfoFontSize')) {
            console.log(`Font field ${f.id}: path=${f.path.join('.')}, value=${v}, default=${def}, saved=${val}`);
        }

        if (f.hex) {
            el.value = _scHexStr(v);
        } else {
            el.value = (v !== undefined && v !== null) ? v : '';
        }
    });

    _renderScCategoryList(saved);
}

function _renderScCategoryList(saved) {
    const container = document.getElementById('sc-category-list');
    const categories = nodesData.categories || [];
    const nodes = nodesData.nodes || {};
    const rawConfig = nodesData.config || {};
    const mapConfig = {
        categoryDistancesMain: { ...DEFAULT_CONFIG.categoryDistancesMain, ...(rawConfig.categoryDistancesMain || {}), ...(saved.categoryDistancesMain || {}) },
        categoryDistances: { ...DEFAULT_CONFIG.categoryDistances, ...(rawConfig.categoryDistances || {}), ...(saved.categoryDistances || {}) }
    };
    const savedColors = (saved.categoryColors) || {};

    if (categories.length === 0) {
        container.innerHTML = '<p class="hint-text" style="padding:10px;">No hay categorías creadas.</p>';
        return;
    }

    container.innerHTML = `
        <div class="config-cat-row config-cat-header">
            <div>Categoría</div>
            <div style="text-align:center;">Dist. al Centro</div>
            <div style="text-align:center;">Dist. Planetas</div>
            <div style="text-align:center;">Color</div>
        </div>
    ` + categories.map(catId => {
        const label = nodes[catId]?.label || catId;
        const mainDist = mapConfig.categoryDistancesMain?.[catId] || 1000;
        const subDist = mapConfig.categoryDistances?.[catId] || 250;
        const colorVal = (savedColors[catId] !== undefined) ? savedColors[catId] : (SC_CAT_COLOR_DEFAULTS[catId] || 0x888888);
        const colorHex = '#' + colorVal.toString(16).padStart(6, '0');

        return `
        <div class="config-cat-row">
            <div class="config-cat-info">
                <span class="config-cat-label">${label}</span>
                <span class="config-cat-id">${catId}</span>
            </div>
            <div>
                <input type="number" class="sc-cat-main config-input-small" data-cat="${catId}" value="${mainDist}">
            </div>
            <div>
                <input type="number" class="sc-cat-sub config-input-small" data-cat="${catId}" value="${subDist}">
            </div>
            <div>
                <input type="color" class="sc-cat-color" data-cat="${catId}" value="${colorHex}" style="width:50px;height:32px;border:none;cursor:pointer;background:transparent;">
            </div>
        </div>
        `;
    }).join('');
}

async function saveSpaceConfig() {
    const config = {};

    SC_FIELD_MAP.forEach(f => {
        const el = document.getElementById(f.id);
        if (!el) return;
        const path = f.path;
        if (!config[path[0]]) config[path[0]] = {};
        if (f.hex) {
            config[path[0]][path[1]] = _scParseHex(el.value);
        } else {
            config[path[0]][path[1]] = Number(el.value);
        }
    });

    config.categoryColors = {};
    document.querySelectorAll('.sc-cat-color').forEach(input => {
        config.categoryColors[input.dataset.cat] = _scParseHex(input.value);
    });

    const catDistMain = {};
    const catDistSub = {};
    document.querySelectorAll('.sc-cat-main').forEach(input => {
        catDistMain[input.dataset.cat] = Number(input.value);
    });
    document.querySelectorAll('.sc-cat-sub').forEach(input => {
        catDistSub[input.dataset.cat] = Number(input.value);
    });

    config.categoryDistancesMain = catDistMain;
    config.categoryDistances = catDistSub;

    const mapConfig = { ...DEFAULT_CONFIG, ...(nodesData.config || {}) };
    mapConfig.categoryDistancesMain = { ...DEFAULT_CONFIG.categoryDistancesMain, ...catDistMain };
    mapConfig.categoryDistances = { ...DEFAULT_CONFIG.categoryDistances, ...catDistSub };

    let mapOk = false;
    let scOk = false;

    try {
        const cfgRes = await fetch(API + '/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mapConfig)
        });
        const cfgData = await cfgRes.json();
        if (cfgData.success) {
            mapOk = true;
            nodesData.config = mapConfig;
        }
    } catch (e) {
        console.error('Error saving map config:', e);
    }

    try {
        const scRes = await fetch(API + '/space-config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        if (scRes.ok) {
            const scData = await scRes.json();
            if (scData.success) {
                scOk = true;
                spaceConfigData = config;
            }
        }
    } catch (e) {
        console.warn('Space config API not available');
    }

    if (mapOk) {
        showToast(scOk ? 'Configuración de espacio guardada' : 'Distancias guardadas (space-config no disponible)', 'success');
    } else {
        showToast('Error al guardar configuración', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
//  PRESENTATION CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const PRES_DEFAULTS = {
    autoRandomShader: true,
    shaderColor1: 0x00ffff,
    shaderColor2: 0x9900ff,
    shaderSpeed: 0.1,
    shaderScale: 3.0,
    shaderDistortion: 0.1,
    shaderBrightness: 0.8
};

const PRES_FIELD_MAP = [
    { id: 'pres-autoRandomShader', path: ['presentation', 'autoRandomShader'], type: 'checkbox' },
    { id: 'pres-shaderColor1', path: ['presentation', 'shaderColor1'], hex: true },
    { id: 'pres-shaderColor2', path: ['presentation', 'shaderColor2'], hex: true },
    { id: 'pres-shaderSpeed', path: ['presentation', 'shaderSpeed'] },
    { id: 'pres-shaderScale', path: ['presentation', 'shaderScale'] },
    { id: 'pres-shaderDistortion', path: ['presentation', 'shaderDistortion'] },
    { id: 'pres-shaderBrightness', path: ['presentation', 'shaderBrightness'] }
];

function renderPresentationConfig() {
    const saved = spaceConfigData || {};
    console.log('Rendering presentation config with data:', saved.presentation || {});

    PRES_FIELD_MAP.forEach(f => {
        const el = document.getElementById(f.id);
        if (!el) return;

        const val = _scGet(saved, f.path);
        const def = _scGet(PRES_DEFAULTS, [f.path[1]]);
        const v = (val !== undefined) ? val : def;

        if (f.type === 'checkbox') {
            el.checked = !!v;
        } else if (f.hex) {
            el.value = _scHexStr(v);
        } else {
            el.value = (v !== undefined && v !== null) ? v : '';
        }
    });
}

async function savePresentationConfig() {
    // We merge with existing spaceConfigData to avoid overwriting other fields
    const config = { ...spaceConfigData };
    if (!config.presentation) config.presentation = {};

    PRES_FIELD_MAP.forEach(f => {
        const el = document.getElementById(f.id);
        if (!el) return;

        const key = f.path[1];
        if (f.type === 'checkbox') {
            config.presentation[key] = el.checked;
        } else if (f.hex) {
            config.presentation[key] = _scParseHex(el.value);
        } else {
            config.presentation[key] = Number(el.value);
        }
    });

    try {
        const res = await fetch(API + '/space-config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                spaceConfigData = config;
                showToast('Configuración de presentación guardada', 'success');
            } else {
                showToast(data.error || 'Error al guardar', 'error');
            }
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
//  IMPORT / EXPORT
// ═══════════════════════════════════════════════════════════════

// Import from file
async function importFile() {
    const fileInput = document.getElementById('import-file');
    const statusEl = document.getElementById('import-status');

    if (!fileInput.files.length) {
        showToast('Selecciona un archivo JSON', 'error');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function (e) {
        try {
            const jsonData = JSON.parse(e.target.result);

            const res = await fetch(API + '/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jsonData)
            });

            const data = await res.json();
            if (data.success) {
                const catCount = Array.isArray(jsonData.categories) ? jsonData.categories.length : 0;
                statusEl.textContent = `✅ Importados ${data.totalNodes} nodos y ${catCount} categorías`;
                statusEl.className = 'status-message show success';
                showToast('Datos importados correctamente', 'success');
                loadAllData();
            } else {
                statusEl.textContent = '❌ ' + (data.error || 'Error');
                statusEl.className = 'status-message show error';
            }
        } catch (err) {
            statusEl.textContent = '❌ Error parseando JSON: ' + err.message;
            statusEl.className = 'status-message show error';
        }
    };

    reader.readAsText(file);
}

// Import legacy data (from existing mapa_herramientas_data.json served in nube_data)
async function importLegacy() {
    const statusEl = document.getElementById('import-legacy-status');
    statusEl.textContent = '⏳ Cargando datos legacy...';
    statusEl.className = 'status-message show info';

    try {
        // Try to fetch the existing JSON file from the nube_data folder
        // It could be served from different paths depending on setup
        let jsonData = null;
        const paths = [
            BASE_PATH + '/nube_data/mapa_herramientas_data.json',
            '/nube_data/mapa_herramientas_data.json',
            'nube_data/mapa_herramientas_data.json'
        ];

        for (const p of paths) {
            try {
                const res = await fetch(p);
                if (res.ok) {
                    jsonData = await res.json();
                    break;
                }
            } catch (e) { /* try next */ }
        }

        if (!jsonData) {
            statusEl.textContent = '❌ No se encontró el archivo legacy. Usa "Importar desde JSON" con el archivo manualmente.';
            statusEl.className = 'status-message show error';
            return;
        }

        const res = await fetch(API + '/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jsonData)
        });

        const data = await res.json();
        if (data.success) {
            const catCount = Array.isArray(jsonData.categories) ? jsonData.categories.length : 0;
            statusEl.textContent = `✅ Importados ${data.totalNodes} nodos y ${catCount} categorías desde datos legacy`;
            statusEl.className = 'status-message show success';
            showToast('Datos legacy importados', 'success');
            loadAllData();
        } else {
            statusEl.textContent = '❌ ' + (data.error || 'Error');
            statusEl.className = 'status-message show error';
        }
    } catch (err) {
        statusEl.textContent = '❌ Error: ' + err.message;
        statusEl.className = 'status-message show error';
    }
}

async function importJsonCreateProject() {
    const textEl = document.getElementById('import-json-text');
    const statusEl = document.getElementById('import-json-status');
    const raw = String(textEl?.value || '').trim();
    if (!raw) {
        showToast('Pegá un JSON primero', 'error');
        return;
    }

    let jsonData;
    try {
        let cleaned = raw;
        cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
        jsonData = JSON.parse(cleaned);
    } catch (e) {
        if (statusEl) {
            statusEl.textContent = '❌ Error parseando JSON: ' + e.message;
            statusEl.className = 'status-message show error';
        }
        return;
    }

    if (statusEl) {
        statusEl.textContent = '⏳ Creando proyecto...';
        statusEl.className = 'status-message show info';
    }

    try {
        const res = await fetch(API + '/projects/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jsonData)
        });
        const contentType = String(res.headers.get('content-type') || '').toLowerCase();
        const rawBody = await res.text();
        const data = (contentType.includes('application/json'))
            ? (JSON.parse(rawBody || '{}') || {})
            : null;

        if (!res.ok || !data?.success || !data?.project?.id) {
            const msg = data?.error
                || (rawBody ? rawBody.slice(0, 180) : '')
                || `HTTP ${res.status}`;
            if (statusEl) {
                statusEl.textContent = '❌ ' + msg;
                statusEl.className = 'status-message show error';
            }
            return;
        }

        if (statusEl) {
            statusEl.textContent = `✅ Proyecto creado: ${data.project.id} (${data.totalNodes || 0} nodos)`;
            statusEl.className = 'status-message show success';
        }
        showToast('Proyecto creado desde JSON', 'success');

        await loadProjects();
        setCurrentProject(data.project.id);
        populateProjectSelector();
        renderProjects();
        await loadAllData();
        switchSection('dashboard');
    } catch (e) {
        if (statusEl) {
            statusEl.textContent = '❌ Error: ' + e.message;
            statusEl.className = 'status-message show error';
        }
    }
}

// Export data
async function exportData() {
    try {
        const res = await fetch(API + '/export');
        const data = await res.json();

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'diploia_nodes_data_' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(url);

        showToast('Datos exportados', 'success');
    } catch (err) {
        showToast('Error al exportar', 'error');
    }
}

async function regenerateThumbnails() {
    const statusEl = document.getElementById('thumb-status');
    if (!statusEl) return;
    
    try {
        // Get all my projects
        const res = await fetch(API + '/projects');
        const data = await res.json();
        const projects = data.projects || [];
        const projectsWithThumb = projects.filter(p => p.id && p.id !== 'diplomatura');
        
        if (projectsWithThumb.length === 0) {
            statusEl.textContent = 'No hay proyectos para regenerar';
            statusEl.style.color = '#fbbf24';
            return;
        }

        statusEl.textContent = `Regenerando thumbnails para ${projectsWithThumb.length} proyectos...`;
        statusEl.style.color = 'var(--muted)';
        
        let done = 0;
        let errors = 0;
        
        for (const p of projectsWithThumb) {
            const basePath = resolveApiBasePath();
            const mapaUrl = `${window.location.origin}${basePath}/mapadeherramientas.html?project=${encodeURIComponent(p.id)}&capture=1`;
            
            // Open the map in a tiny window to capture the thumbnail
            // The mapadeherramientas.html will auto-capture via the thumbnail hook
            // We can just open and immediately close since the server-side capture is automatic
            const thumbWindow = window.open(mapaUrl, '_blank', 'width=600,height=400');
            
            if (thumbWindow) {
                setTimeout(() => {
                    try { thumbWindow.close(); } catch(e) {}
                }, 5000);
            }
            
            done++;
            statusEl.textContent = `Regenerando: ${done}/${projectsWithThumb.length} (${errors} errores)`;
            statusEl.style.color = '#22c55e';
            
            // Wait a bit between projects to not overwhelm
            await new Promise(r => setTimeout(r, 3000));
        }
        
        statusEl.textContent = `✅ Thumbnails regenerados: ${done} proyectos (${errors} errores)`;
        statusEl.style.color = '#22c55e';
        showToast(`Thumbnails regenerados para ${done} proyectos`, 'success');
    } catch (err) {
        statusEl.textContent = 'Error: ' + err.message;
        statusEl.style.color = '#ef4444';
        showToast('Error al regenerar thumbnails', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
//  SYNC LOCAL <-> VPS
// ═══════════════════════════════════════════════════════════════

async function getVpsAdminToken(VPS_BASE_URL) {
    const password = prompt('Contraseña ADMIN para VPS:');
    if (!password) throw new Error('Operación cancelada');

    const res = await originalFetch(`${VPS_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ADMIN', password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) throw new Error(data.error || 'No se pudo autenticar en VPS');
    return data.token;
}

async function syncToVps() {
    if (!confirm(`¿Estás seguro de que quieres SOBREESCRIBIR los datos del VPS con tu versión LOCAL del proyecto "${currentProject}"?`)) return;

    try {
        showToast('Obteniendo datos locales...', 'info');
        const VPS_BASE_URL = 'https://vps-4455523-x.dattaweb.com/mapai';
        const vpsToken = await getVpsAdminToken(VPS_BASE_URL);
        
        // 1. Get local export
        const exportRes = await fetch(`${API}/export?project=${currentProject}`);
        const localData = await exportRes.json();

        // Ensure project exists on VPS
        const projectsRes = await originalFetch(`${VPS_BASE_URL}/api/projects`, {
            headers: { 'Authorization': `Bearer ${vpsToken}` }
        });
        const projectsData = await projectsRes.json();
        const projectExists = (projectsData.projects || []).some(p => p.id === currentProject);
        if (!projectExists) {
            await originalFetch(`${VPS_BASE_URL}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vpsToken}` },
                body: JSON.stringify({ id: currentProject, name: currentProject, description: 'Sincronizado desde local' })
            }).catch(e => console.log('Project might already exist'));
        }

        // 2. Post to VPS import
        showToast('Subiendo nodos y config al VPS...', 'info');
        const importRes = await originalFetch(`${VPS_BASE_URL}/api/import?project=${encodeURIComponent(currentProject)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vpsToken}` },
            body: JSON.stringify(localData)
        });
        
        const importData = await importRes.json();
        if (!importData.success) throw new Error(importData.error);

        // 3. Sync Space Config
        const spaceRes = await fetch(`${API}/space-config?project=${currentProject}`);
        if (spaceRes.ok) {
            const spaceData = await spaceRes.json();
            await originalFetch(`${VPS_BASE_URL}/api/space-config?project=${encodeURIComponent(currentProject)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vpsToken}` },
                body: JSON.stringify(spaceData)
            });
        }

        showToast('Sincronización Local ➔ VPS completada ✅', 'success');
    } catch (err) {
        console.error(err);
        showToast('Error al sincronizar al VPS: ' + err.message, 'error');
    }
}

async function syncFromVps() {
    if (!confirm(`¿Estás seguro de que quieres SOBREESCRIBIR tus datos LOCALES con la versión del VPS del proyecto "${currentProject}"?`)) return;

    try {
        showToast('Descargando datos del VPS...', 'info');
        const VPS_BASE_URL = 'https://vps-4455523-x.dattaweb.com/mapai';
        const vpsToken = await getVpsAdminToken(VPS_BASE_URL);
        
        // 1. Get VPS export
        const exportRes = await originalFetch(`${VPS_BASE_URL}/api/export?project=${encodeURIComponent(currentProject)}`, {
            headers: { 'Authorization': `Bearer ${vpsToken}` }
        });
        if (!exportRes.ok) throw new Error('No se pudo descargar del VPS');
        const vpsData = await exportRes.json();

        // 2. Post to local import
        showToast('Importando en local...', 'info');
        const importRes = await fetch(`${API}/import?project=${currentProject}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vpsData)
        });
        
        const importData = await importRes.json();
        if (!importData.success) throw new Error(importData.error);

        // 3. Sync Space Config
        const spaceRes = await originalFetch(`${VPS_BASE_URL}/api/space-config?project=${encodeURIComponent(currentProject)}`, {
            headers: { 'Authorization': `Bearer ${vpsToken}` }
        });
        if (spaceRes.ok) {
            const spaceData = await spaceRes.json();
            await fetch(`${API}/space-config?project=${currentProject}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(spaceData)
            });
        }

        showToast('Sincronización VPS ➔ Local completada ✅', 'success');
        loadAllData(); // reload UI
    } catch (err) {
        console.error(err);
        showToast('Error al sincronizar desde VPS: ' + err.message, 'error');
    }
}


// ═══════════════════════════════════════════════════════════════
//  PROJECTS
// ═══════════════════════════════════════════════════════════════

async function loadProjects() {
    try {
        const res = await fetch(API + '/projects');
        if (res.status === 401) {
            clearAuthState();
            showAuthOverlay();
            return;
        }
        const data = await res.json();
        projectsData = data;
        renderProjects();
        populateProjectSelector();
    } catch (err) {
        console.error('Error loading projects:', err);
    }
}

function renderProjects() {
    const list = document.getElementById('projects-list');
    if (!list) return;

    const projects = projectsData.projects || [];
    list.innerHTML = projects.map(p => `
        <div class="grid-card ${p.id === currentProject ? 'active-project' : ''}" 
             style="${p.id === currentProject ? 'border: 2px solid #5a57f2; background: rgba(90, 87, 242, 0.05);' : ''}">
            <div class="grid-card-title">${p.name}</div>
            <div class="grid-card-sub">ID: ${p.id}</div>
            <div class="grid-card-actions">
                <button class="btn btn-sm btn-accent" onclick="switchProject('${p.id}')">Seleccionar</button>
                ${p.id !== 'diplomatura' ? `<button class="btn btn-sm btn-icon danger" onclick="deleteProject('${p.id}')" title="Eliminar Proyecto">🗑️</button>` : ''}
            </div>
        </div>
    `).join('');
}

function populateProjectSelector() {
    const selector = document.getElementById('global-project-selector');
    if (!selector) return;

    const projects = projectsData.projects || [];
    if (!projects.length) {
        selector.innerHTML = `<option value="">Sin proyectos</option>`;
        selector.disabled = true;
        return;
    }

    selector.disabled = false;
    selector.innerHTML = projects.map(p => `
        <option value="${p.id}" ${p.id === currentProject ? 'selected' : ''}>${p.name}</option>
    `).join('');

    selector.onchange = (e) => switchProject(e.target.value);
}

function switchProject(projectId) {
    setCurrentProject(projectId);
    showToast(`Proyecto cambiado a: ${projectId}`, 'info');

    // Reload all data for the new project
    loadAllData();
    renderProjects();
    populateProjectSelector();
}

async function saveProject() {
    const id = document.getElementById('project-id').value.trim();
    const name = document.getElementById('project-name').value.trim();
    const description = document.getElementById('project-description').value.trim();

    if (!id || !name) {
        showToast('ID y Nombre son requeridos', 'error');
        return;
    }

    try {
        const res = await fetch(API + '/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name, description })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`Proyecto "${name}" creado`, 'success');
            closeModal('modal-add-project');
            setCurrentProject(id);
            await loadProjects();
            await loadAllData();
            renderProjects();
            populateProjectSelector();
        } else {
            showToast(data.error || 'Error', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

async function deleteProject(projectId) {
    if (!confirm(`¿Estás seguro de eliminar el proyecto "${projectId}" y TODOS sus datos (nodos, rankings, config)?`)) return;

    try {
        const res = await fetch(API + '/projects/' + projectId, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('Proyecto eliminado', 'success');
            await loadProjects();
            const available = (projectsData.projects || []).map(p => p.id);
            if (currentProject === projectId) {
                setCurrentProject(available[0] || null);
            }
            if (currentProject) await loadAllData();
            renderProjects();
            populateProjectSelector();
        } else {
            showToast(data.error || 'Error', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
//  USERS (ADMIN)
// ═══════════════════════════════════════════════════════════════
let usersData = { users: [] };

async function loadUsers() {
    const list = document.getElementById('users-list');
    if (!list) return;
    list.innerHTML = '';

    if (authUser?.role !== 'admin') {
        list.innerHTML = '<div class="hint-text">Acceso restringido.</div>';
        return;
    }

    try {
        const res = await fetch(API + '/users');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showToast(data.error || 'Error al cargar usuarios', 'error');
            return;
        }
        usersData = data;
        renderUsers();
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
}

function renderUsers() {
    const list = document.getElementById('users-list');
    if (!list) return;

    const users = usersData.users || [];
    if (!users.length) {
        list.innerHTML = '<div class="hint-text">No hay usuarios registrados.</div>';
        return;
    }

    list.innerHTML = users.map(u => {
        const projects = u.projects || [];
        const subtitle = projects.length
            ? projects.map(p => `${p.name} (${p.id})`).join(' • ')
            : 'Sin proyectos';

        return `
        <div class="list-item">
            <div class="list-item-icon">👤</div>
            <div class="list-item-content">
                <div class="list-item-title">${u.username} <span style="opacity:.6; font-weight:500; font-size:12px;">• ${projects.length} proyectos</span></div>
                <div class="list-item-sub">${subtitle}</div>
            </div>
        </div>
        `;
    }).join('');
}

function copyLink(inputId) {
    const input = document.getElementById(inputId);
    input.select();
    input.setSelectionRange(0, 99999); // For mobile
    navigator.clipboard.writeText(input.value).then(() => {
        showToast('Enlace copiado al portapapeles', 'success');
    });
}

const originalFetch = window.fetch.bind(window);
window.fetch = function (url, options = {}) {
    let finalUrl = url;
    const isStringUrl = typeof url === 'string';

    if (isStringUrl) {
        const isApiCall = url.includes('/api/');
        const isAuthCall = url.includes('/api/auth/');
        const isProjectsCall = url.includes('/api/projects');
        const isUsersCall = url.includes('/api/users');
        const hasProjectParam = url.includes('project=');

        if (isApiCall && !isAuthCall && !isProjectsCall && !isUsersCall && !hasProjectParam && currentProject) {
            const separator = url.includes('?') ? '&' : '?';
            finalUrl = `${url}${separator}project=${encodeURIComponent(currentProject)}`;
        }
    }

    if (isStringUrl && finalUrl.includes('/api/') && authToken) {
        const headers = new Headers(options.headers || {});
        if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${authToken}`);
        options = { ...options, headers };
    }

    return originalFetch(finalUrl, options);
};

// Initialize new project buttons
document.getElementById('btn-add-project')?.addEventListener('click', () => {
    openProjectModal();
});

document.getElementById('btn-quick-add-project')?.addEventListener('click', () => {
    openProjectModal();
});

function openProjectModal() {
    document.getElementById('project-id').value = '';
    document.getElementById('project-name').value = '';
    document.getElementById('project-description').value = '';
    openModal('modal-add-project');
}

document.getElementById('btn-save-project')?.addEventListener('click', saveProject);
