function getCurrentProject() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('project') || 'diplomatura';
}

function resolveBasePath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'mapai') return '/mapai';
  return '';
}

const BASE_PATH = resolveBasePath();

function createMenu() {
  const project = encodeURIComponent(getCurrentProject());
  const menuItems = [
    { text: 'MAPA', url: `${BASE_PATH}/mapa.html?project=${project}` },
    { text: 'Nube de Universos', url: `${BASE_PATH}/shared/nube_data/nube_universos.html?project=${project}` },
    { text: 'Presentación', url: `${BASE_PATH}/presentacion.html?project=${project}` },
  ];

  const nav = document.createElement('nav');
  nav.className = 'main-nav';

  menuItems.forEach(item => {
    const link = document.createElement('a');
    link.href = item.url;
    link.className = 'nav-link';
    link.textContent = item.text;
    nav.appendChild(link);
  });

  return nav;
}

function initMenu() {
  const headerContainer = document.querySelector('header .container');
  if (!headerContainer) return;

  const existingNav = headerContainer.querySelector('.main-nav');
  if (existingNav) existingNav.remove();

  const existingToggle = headerContainer.querySelector('.menu-toggle');
  if (existingToggle) existingToggle.remove();

  const menuToggle = document.createElement('button');
  menuToggle.className = 'menu-toggle';
  menuToggle.innerHTML = '☰';
  menuToggle.setAttribute('aria-label', 'Toggle menu');

  const menu = createMenu();

  menuToggle.addEventListener('click', () => {
    menu.classList.toggle('active');
  });

  const headerContent = headerContainer.querySelector('.header-content');
  if (headerContent) {
    headerContent.appendChild(menuToggle);
    headerContent.appendChild(menu);
  } else {
    headerContainer.insertBefore(menu, headerContainer.firstChild);
    headerContainer.insertBefore(menuToggle, headerContainer.firstChild);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMenu);
} else {
  initMenu();
}
