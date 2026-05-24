function createMenu() {
    const urlParams = new URLSearchParams(window.location.search);
    const project = encodeURIComponent(urlParams.get('project') || 'diplomatura');
    const isDiploiaTenant = window.location.pathname.startsWith('/diploia') || window.location.pathname.startsWith('/mapai/diploia');

    const menuItems = isDiploiaTenant
        ? [
            { text: 'Clases', url: 'index.html' },
            { text: 'Trabajo Práctico', url: 'trabajopractico.html' },
            { text: 'MAPA', url: `mapa.html?project=${project}` },
            { text: 'Tutoriales', url: 'tutoriales.html' },
            { text: 'Prompting', url: 'prompting.html' },
            { text: 'Protocolo de Revisión', url: 'protocolo-revision.html' }
        ]
        : [
            { text: 'Clases', url: 'index.html' },
            { text: 'Trabajo Práctico', url: 'trabajopractico.html' },
            { text: 'Mapa de Herramientas', url: 'mapadeherramientas.html' },
            { text: 'Nube de Universos', url: 'nube_data/nube_universos.html' },
            { text: 'Presentación', url: 'presentacion.html' },
            { text: 'Tutoriales', url: 'tutoriales.html' },
            { text: 'Prompting', url: 'prompting.html' },
            { text: 'Protocolo de Revisión', url: 'protocolo-revision.html' }
        ];

    const nav = document.createElement('nav');
    nav.className = 'main-nav';

    // Detectar si estamos en un subdirectorio para ajustar las URLs
    const pathParts = window.location.pathname.split('/');
    const currentFile = pathParts.pop() || 'index.html';
    const currentDir = pathParts.pop() || '';
    const isSubdir = currentDir && currentDir !== '' && currentDir !== 'diploia';
    const basePrefix = isSubdir ? '../' : '';

    menuItems.forEach(item => {
        const link = document.createElement('a');
        link.href = basePrefix + item.url;
        link.className = 'nav-link';
        link.textContent = item.text;

        // Highlight current page
        const itemFile = item.url.split('/').pop();
        if (currentFile === itemFile) {
            link.classList.add('active');
        }

        nav.appendChild(link);
    });

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
    menuToggle.addEventListener('click', () => {
        menu.classList.toggle('active');
    });

    // Check if it's a compact header (like in mapadeherramientas.html)
    const headerContent = headerContainer.querySelector('.header-content');
    if (headerContent) {
        headerContent.appendChild(menuToggle);
        headerContent.appendChild(menu);
    } else {
        // Insert at top
        headerContainer.insertBefore(menu, headerContainer.firstChild);
        headerContainer.insertBefore(menuToggle, headerContainer.firstChild);
    }
}

// Initialize menu when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMenu);
} else {
    initMenu();
}
