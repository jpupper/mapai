// ============================================================
// MAPAI - Autenticación SSO (Fullscreen Auth Centralizado)
// ============================================================

function getToken() {
    return localStorage.getItem('mapai_token');
}

function setToken(token) {
    localStorage.setItem('mapai_token', token);
}

function removeToken() {
    localStorage.removeItem('mapai_token');
}

function getUser() {
    const raw = localStorage.getItem('mapai_user');
    return raw ? JSON.parse(raw) : null;
}

function setUser(user) {
    localStorage.setItem('mapai_user', JSON.stringify(user));
}

function removeUser() {
    localStorage.removeItem('mapai_user');
}

function isLoggedIn() {
    return !!getToken();
}

function isAdmin() {
    const user = getUser();
    return user && (user.role === 'ADMIN' || user.role === 'SYSTEM');
}

function getUserId() {
    const user = getUser();
    return user ? user.id || user._id : null;
}

function getUserUsername() {
    const user = getUser();
    return user ? user.username : null;
}

// Logout: limpia localStorage y redirige al logout centralizado
function logout() {
    removeToken();
    removeUser();
    const redirect = encodeURIComponent(window.location.origin + CONFIG.BASE + '/');
    window.location.href = CONFIG.FSCAUTH_URL + '/api/auth/logout?redirect=' + redirect;
}

// Redirige al login centralizado de fscauth
function showLogin() {
    if (isLoggedIn()) {
        window.location.href = CONFIG.BASE + '/';
        return;
    }
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete('token');
    currentUrl.searchParams.delete('username');
    currentUrl.searchParams.delete('userId');
    window.location.href = CONFIG.FSCAUTH_URL + '/login.html?redirect=' + encodeURIComponent(currentUrl.toString()) + '&origin=' + CONFIG.APP_NAME;
}

// Redirige al registro centralizado de fscauth
function showRegister() {
    if (isLoggedIn()) {
        window.location.href = CONFIG.BASE + '/';
        return;
    }
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete('token');
    currentUrl.searchParams.delete('username');
    currentUrl.searchParams.delete('userId');
    window.location.href = CONFIG.FSCAUTH_URL + '/register.html?redirect=' + encodeURIComponent(currentUrl.toString()) + '&origin=' + CONFIG.APP_NAME;
}

/**
 * SSO Check: Si no hay token local, redirige al sso-check de fscauth
 * para ver si hay una sesión activa por cookie.
 */
async function checkSSO() {
    if (isLoggedIn()) return;
    if (sessionStorage.getItem('mapai_sso_checked')) return;
    sessionStorage.setItem('mapai_sso_checked', 'true');

    const currentUrl = window.location.href;
    window.location.href = CONFIG.FSCAUTH_URL + '/api/auth/sso-check?redirect=' + encodeURIComponent(currentUrl);
}

/**
 * Sync Session: Verifica silenciosamente si la sesión central coincide
 * con la local. Se ejecuta al recuperar el foco de la pestaña.
 */
async function syncSession() {
    try {
        const localToken = getToken();
        const headers = { 'Accept': 'application/json' };
        if (localToken) headers['Authorization'] = 'Bearer ' + localToken;

        const res = await fetch(CONFIG.FSCAUTH_URL + '/api/auth/verify', {
            credentials: 'include',
            headers: headers
        });
        const data = await res.json();

        const localLoggedIn = isLoggedIn();

        if (data.loggedIn) {
            if (!localLoggedIn) {
                console.log('[AUTH] Nueva sesión detectada en FSC. Sincronizando...');
                checkSSO();
            }
        } else {
            if (localLoggedIn) {
                console.warn('[AUTH] Sesión central cerrada. Cerrando local...');
                removeToken();
                removeUser();
                if (typeof updateAuthUI === 'function') updateAuthUI(false);
                window.location.reload();
            }
        }
    } catch (err) {
        console.error('[AUTH] Error syncSession:', err);
    }
}

// Parse JWT para extraer payload
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        );
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
}

// API Request con autenticación automática
async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    const headers = { ...options.headers };

    if (options.body && !(options.body instanceof FormData)) {
        if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
    }

    if (token) headers['Authorization'] = 'Bearer ' + token;

    const res = await fetch(CONFIG.API_URL + endpoint, { ...options, headers });
    if (res.status === 401) {
        logout();
        return null;
    }
    return res;
}

// ============================================================
// INIT: Captura token de URL, limpia, actualiza UI
// ============================================================
(function initAuth() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const urlUsername = urlParams.get('username');
    const urlUserId = urlParams.get('userId');

    if (urlToken && urlUsername) {
        setToken(urlToken);
        const userData = { username: urlUsername, id: urlUserId, _id: urlUserId };
        if (urlParams.get('role')) {
            userData.role = urlParams.get('role');
        }
        // También decodificar JWT para obtener role
        const decoded = parseJwt(urlToken);
        if (decoded && decoded.role && !userData.role) {
            userData.role = decoded.role;
        }
        setUser(userData);

        // Limpiar URL de parámetros de auth
        urlParams.delete('token');
        urlParams.delete('username');
        urlParams.delete('userId');
        urlParams.delete('role');
        urlParams.delete('ssoset');
        const newQuery = urlParams.toString();
        const newUrl = window.location.pathname + (newQuery ? '?' + newQuery : '');
        window.history.replaceState({}, document.title, newUrl);

        // Si estamos en login/register, redirigir a home
        const path = window.location.pathname;
        if (path.includes('login') || path.includes('register')) {
            window.location.href = CONFIG.BASE + '/';
        }
    } else {
        // Sin token en URL, verificar sesión existente
        document.addEventListener('DOMContentLoaded', function() {
            const loggedIn = isLoggedIn();
            if (typeof updateAuthUI === 'function') updateAuthUI(loggedIn);

            if (!loggedIn && !urlParams.has('nosession')) {
                checkSSO();
            }
        });
    }

    // Sincronización al recuperar foco
    window.addEventListener('focus', function() {
        syncSession();
    });
})();
