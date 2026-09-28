// ============================================================
// MAPAI - Navbar Universal
// Incluir en cualquier pagina con <script src="js/navbar.js"></script>
// Requiere: config.js, auth.js (opcional - degrade sin ellos)
// ============================================================
(function() {
  'use strict';

  // No mostrar dentro de iframes
  if (window.self !== window.top) return;

  var BASE = '/mapai';
  var path = window.location.pathname;
  var page = path.split('/').pop().split('?')[0];

  // ── Proyecto activo: de URL o sessionStorage ──
  var urlParams = new URLSearchParams(window.location.search);
  var currentProject = urlParams.get('project');
  if (currentProject) {
    sessionStorage.setItem('mapai_project', currentProject);
  } else {
    currentProject = sessionStorage.getItem('mapai_project') || 'diplomatura';
  }
  var projSuffix = '?project=' + encodeURIComponent(currentProject);

  function isActive(p) {
    return page === p ? ' unav-active' : '';
  }

  // ── Auth: intentar con auth.js, fallback directo ──
  var user = (typeof getUser === 'function') ? getUser() : null;
  var loggedIn = (typeof isLoggedIn === 'function') && isLoggedIn();
  var authHtml;

  if (loggedIn && user && user.username) {
    authHtml = '<a href="' + BASE + '/mapai/profile.html" class="unav-link unav-user">\u{1F464} ' + esc(user.username) + '</a>' +
      '<button class="unav-logout-btn" onclick="if(typeof logout===\'function\')logout()" title="Cerrar sesi\u00f3n">\u23F3</button>';
  } else {
    // Usar showLogin si disponible, sino redirect directo
    var loginUrl = (typeof window !== 'undefined' && window.CONFIG && window.CONFIG.FSCAUTH_URL) ?
      window.CONFIG.FSCAUTH_URL + '/login.html?redirect=' + encodeURIComponent(window.location.href.split('?')[0]) + '&origin=mapai' :
      'https://fullscreencode.com/fscauth/login.html?redirect=' + encodeURIComponent(window.location.href.split('?')[0]) + '&origin=mapai';
    authHtml = '<a href="' + loginUrl + '" class="unav-link unav-login">Ingresar</a>';
  }

  // ── Mostrar nombre del proyecto actual ──
  var projectLabel = currentProject === 'diplomatura' ? '' :
    '<span class="unav-project">' + esc(currentProject) + '</span>';

  // ── Logo SVG: 3 dots + lines ──
  var logoColor = '#6cb4ff';
  var logoSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="12" cy="4" r="2.5" stroke="' + logoColor + '" stroke-width="1.2" fill="rgba(108,180,255,0.15)"/>' +
    '<circle cx="5" cy="19" r="2.5" stroke="' + logoColor + '" stroke-width="1.2" fill="rgba(108,180,255,0.15)"/>' +
    '<circle cx="19" cy="19" r="2.5" stroke="' + logoColor + '" stroke-width="1.2" fill="rgba(108,180,255,0.15)"/>' +
    '<line x1="12" y1="6" x2="5" y2="17" stroke="' + logoColor + '" stroke-width="1" opacity="0.5"/>' +
    '<line x1="12" y1="6" x2="19" y2="17" stroke="' + logoColor + '" stroke-width="1" opacity="0.5"/>' +
    '<line x1="7.5" y1="19" x2="16.5" y2="19" stroke="' + logoColor + '" stroke-width="1" opacity="0.4"/>' +
    '</svg>';

  var html =
    '<div class="universal-navbar">' +
      '<div class="unav-left">' +
        '<a href="' + BASE + '/" class="unav-logo" title="Inicio">' + logoSvg + '</a>' +
        projectLabel +
        '<a href="' + BASE + '/mapa.html' + projSuffix + '" class="unav-link' + isActive('mapa.html') + '">MAPA</a>' +
        '<a href="' + BASE + '/shared/nube_data/nube_universos.html' + projSuffix + '" class="unav-link' + isActive('nube_universos.html') + '">NUBE</a>' +
        '<a href="' + BASE + '/presentacion.html' + projSuffix + '&node=root" class="unav-link' + isActive('presentacion.html') + '">PRESENTACI\u00d3N</a>' +
        '<a href="' + BASE + '/learn.html' + projSuffix + '" class="unav-link' + isActive('learn.html') + '">LEARN</a>' +
      '</div>' +
      '<div class="unav-right">' +
        '<a href="' + BASE + '/shared/profile.html" class="unav-link unav-maps' + isActive('profile.html') + '">MAPS</a>' +
        '<a href="' + BASE + '/shared/admin.html" class="unav-link unav-create' + (path.includes('admin') ? ' unav-active' : '') + '">CREATE</a>' +
        authHtml +
      '</div>' +
    '</div>';

  var div = document.createElement('div');
  div.innerHTML = html;
  document.body.insertBefore(div.firstElementChild, document.body.firstChild);

  // CSS
  var css = document.createElement('style');
  css.textContent =
    '.universal-navbar{position:fixed;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;padding:6px 16px;background:rgba(0,0,0,0.92);border-bottom:1px solid rgba(255,255,255,0.08);gap:12px;z-index:99999;flex-shrink:0;font-family:"Outfit","Montserrat",sans-serif;box-sizing:border-box;}' +
    '.unav-left,.unav-right{display:flex;align-items:center;gap:4px;}' +
    '.unav-link{padding:5px 12px;font-size:0.8rem;border-radius:5px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.65);text-decoration:none;transition:all 0.2s;white-space:nowrap;cursor:pointer;font-family:inherit;line-height:1.4;}' +
    '.unav-link:hover{background:rgba(255,255,255,0.1);border-color:rgba(120,180,255,0.4);color:#fff;}' +
    '.unav-link.unav-active,.unav-link.unav-active:hover{background:rgba(120,180,255,0.15);border-color:rgba(120,180,255,0.5);color:#6cb4ff;}' +
    '.unav-link.unav-user{background:rgba(120,180,255,0.1);border-color:rgba(120,180,255,0.25);color:#6cb4ff;}' +
    '.unav-link.unav-user:hover{background:rgba(120,180,255,0.2);border-color:rgba(120,180,255,0.5);color:#8fcbff;}' +
    '.unav-link.unav-maps{background:rgba(255,180,100,0.1);border-color:rgba(255,180,100,0.25);color:#ffb464;}' +
    '.unav-link.unav-maps:hover{background:rgba(255,180,100,0.2);border-color:rgba(255,180,100,0.5);color:#ffcc88;}' +
    '.unav-link.unav-create{background:rgba(100,255,180,0.08);border-color:rgba(100,255,180,0.2);color:#64ffb4;}' +
    '.unav-link.unav-create:hover{background:rgba(100,255,180,0.15);border-color:rgba(100,255,180,0.4);color:#88ffcc;}' +
    '.unav-link.unav-login{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.15);color:rgba(255,255,255,0.7);font-weight:600;}' +
    '.unav-link.unav-login:hover{background:rgba(255,255,255,0.12);color:#fff;}' +
    '.unav-logout-btn{background:none!important;border:none!important;color:rgba(255,255,255,0.4)!important;font-size:16px;padding:5px 6px!important;cursor:pointer;font-family:inherit;border-radius:4px;}' +
    '.unav-logout-btn:hover{color:rgba(255,100,100,0.8)!important;background:rgba(255,100,100,0.1)!important;}' +
    '.unav-project{padding:4px 10px;font-size:0.75rem;border-radius:4px;background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.35);border:1px solid rgba(255,255,255,0.06);white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis;font-family:inherit;}' +
    '.unav-logo{display:flex;align-items:center;padding:3px 6px;border-radius:6px;transition:all 0.2s;margin-right:4px;text-decoration:none;}' +
    '.unav-logo:hover{background:rgba(108,180,255,0.12);}' +
    '.unav-logo svg{display:block;}';

  document.head.appendChild(css);

  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
})();
