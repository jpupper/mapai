// ============================================================
// MAPAI - Configuración Global
// ============================================================
(function() {
    // VPS origin for production
    const VPS_ORIGIN = 'https://vps-4455523-x.dattaweb.com';

    window.CONFIG = {
        // Hosts que ejecutan el backend Node
        NODE_HOSTS: [
            'localhost',
            '127.0.0.1',
            'vps-4455523-x.dattaweb.com'
        ],

        get isLocal() {
            return window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' || 
                   window.location.hostname.includes('192.168');
        },

        get IS_NODE_SERVER() {
            return this.NODE_HOSTS.some(host => window.location.hostname === host) || this.isLocal;
        },

        get BASE() {
            if (window.location.pathname.startsWith('/mapai')) return '/mapai';
            return '';
        },

        get API_URL() {
            const origin = (this.isLocal || !this.IS_NODE_SERVER) ? VPS_ORIGIN : window.location.origin;
            return origin + this.BASE + '/api';
        },

        get FSCAUTH_URL() {
            return VPS_ORIGIN + '/fscauth';
        },

        get APP_NAME() {
            return 'mapai';
        },

        resolveImage(url) {
            if (!url) return '';
            if (url.startsWith('http')) return url;
            if (url.startsWith('/mapai')) {
                return VPS_ORIGIN + url;
            }
            return url;
        }
    };
})();
