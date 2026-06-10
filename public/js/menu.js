// ============================================================
// MAPAI - Menú de Navegación + Auth UI
// ============================================================

// --- AUTH UI ---
function renderAuthControls() {
    const container = document.createElement('div');
    container.className = 'nav-auth';

    const loggedIn = typeof isLoggedIn === 'function' && isLoggedIn();
    const user = typeof getUser === 'function' ? getUser() : null;

    if (loggedIn && user) {
        container.innerHTML = `
            <span class="nav-username">${escapeHTML(user.username)}</span>
            <button type="button" class="nav-link auth-link" id="nav-logout-btn" title="Cerrar sesión">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Salir
            </button>
        `;
        container.querySelector('#nav-logout-btn').addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof logout === 'function') logout();
        });
    } else {
        container.innerHTML = `
            <button type="button" class="nav-link auth-link" id="nav-login-btn">Ingresar</button>
            <button type="button" class="nav-link auth-link auth-register" id="nav-register-btn">Registro</button>
        `;
        container.querySelector('#nav-login-btn').addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof showLogin === 'function') showLogin();
        });
        container.querySelector('#nav-register-btn').addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof showRegister === 'function') showRegister();
        });
    }

    return container;
}

function updateAuthUI(loggedIn) {
    const existingAuth = document.querySelector('.nav-auth');
    if (existingAuth) {
        existingAuth.replaceWith(renderAuthControls());
    } else {
        const nav = document.querySelector('.main-nav');
        if (nav) {
            nav.appendChild(renderAuthControls());
        }
    }
}

// --- MENU ---
function createMenu() {
    const urlParams = new URLSearchParams(window.location.search);
    const project = encodeURIComponent(urlParams.get('project') || 'diplomatura');
    const isDiploiaTenant = window.location.pathname.startsWith('/diploia') || window.location.pathname.startsWith('/mapai/diploia');

    const menuItems = isDiploiaTenant
        ? [
            { text: 'Clases', url: 'index.html' },
            { text: 'Trabajo Práctico', url: 'trabajopractico.html' },
            { text: 'MAPA', url: 'mapa.html?project=' + project },
            { text: 'Tutoriales', url: 'tutoriales.html' },
            { text: 'Prompting', url: 'prompting.html' },
            { text: 'Protocolo de Revisión', url: 'protocolo-revision.html' }
        ]
        : [
            { text: 'Clases', url: 'index.html' },
            { text: 'Trabajo Práctico', url: 'trabajopractico.html' },
            { text: 'Mapa de Herramientas', url: 'mapadeherramientas.html' },
            { text: 'Nube de Universos', url: 'nube_data/nube_universos.html?project=' + project },
            { text: 'Presentación', url: 'presentacion.html' },
            { text: 'Tutoriales', url: 'tutoriales.html' },
            { text: 'Prompting', url: 'prompting.html' },
            { text: 'Protocolo de Revisión', url: 'protocolo-revision.html' }
        ];

    const nav = document.createElement('nav');
    nav.className = 'main-nav';

    const pathParts = window.location.pathname.split('/');
    const currentFile = pathParts.pop() || 'index.html';
    const currentDir = pathParts.pop() || '';
    const isSubdir = currentDir && currentDir !== '' && currentDir !== 'diploia';
    const basePrefix = isSubdir ? '../' : '';

    menuItems.forEach(function(item) {
        const link = document.createElement('a');
        link.href = basePrefix + item.url;
        link.className = 'nav-link';
        link.textContent = item.text;

        const itemFile = item.url.split('/').pop().split('?')[0];
        if (currentFile === itemFile) {
            link.classList.add('active');
        }

        nav.appendChild(link);
    });

    // Add auth controls at the right side
    const authControls = renderAuthControls();
    nav.appendChild(authControls);

    return nav;
}

function initMenu() {
    const header = document.querySelector('header');
    const headerContainer = document.querySelector('header .container');
    if (!headerContainer) return;

    const existingNav = headerContainer.querySelector('.main-nav');
    if (existingNav) {
        existingNav.remove();
    }

    const existingToggle = headerContainer.querySelector('.menu-toggle');
    if (existingToggle) {
        existingToggle.remove();
    }

    // Create hamburger button
    const menuToggle = document.createElement('button');
    menuToggle.className = 'menu-toggle';
    menuToggle.innerHTML = '☰';
    menuToggle.setAttribute('aria-label', 'Toggle menu');

    const menu = createMenu();

    // Add toggle functionality
    menuToggle.addEventListener('click', function() {
        menu.classList.toggle('active');
    });

    // Check if it's a compact header
    const headerContent = headerContainer.querySelector('.header-content');
    if (headerContent) {
        headerContent.appendChild(menuToggle);
        headerContent.appendChild(menu);
    } else {
        headerContainer.insertBefore(menu, headerContainer.firstChild);
        headerContainer.insertBefore(menuToggle, headerContainer.firstChild);
    }
}

// Inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        initMenu();
        // Auth UI update after menu is built
        if (typeof isLoggedIn === 'function') {
            updateAuthUI(isLoggedIn());
        }
    });
} else {
    initMenu();
    if (typeof isLoggedIn === 'function') {
        updateAuthUI(isLoggedIn());
    }
}

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
