// Archivo de datos para el mapa de herramientas
// Carga datos dinámicamente desde la API del servidor
// Mantiene la configuración visual (CONFIG) estática ya que es específica del layout del mapa

// Variables globales de configuración (layout del mapa - carga desde la API)
let CONFIG = {
        rootNodeSize: 200,          // Tamaño para el nodo raíz
        primaryNodeSize: 100,        // Tamaño para categorías
        secondaryNodeSize: 90,      // Tamaño para nodos secundarios
        nodeFontSize: 14,           // Tamaño de fuente para nodos normales
        categoryFontSize: 18,       // Tamaño de fuente para categorías
        rootFontSize: 20,           // Tamaño de fuente para el nodo raíz
        popupTitleFontSize: 35,     // Tamaño de fuente para títulos en popups
        popupSubtitleFontSize: 30,  // Tamaño de fuente para subtítulos en popups
        popupTextFontSize: 28,      // Tamaño de fuente para texto en popups
        secondaryNodeDist: 120,      // Distancia entre nodos secundarios
        primaryDistance: 250,       // Distancia de nodo central a categorías principales
        categoryDistancesMain: {     // Distancias personalizadas para cada categoría al nodo central
                'engines': 1300,
                'frameworks': 1500,
                'ia': 700,
                'shaders': 1200,
                'db': 800,
                'ides': 2000,
                'languages': 1600,
                'llm': 1200,
                'frontend': 700,
                'os': 1100,
                'soportes': 1800,
                'protocolos': 1400,
                'software-multimedia': 1000,
                'entornos': 1500,
                'glosario': 1700
        },
        categoryDistances: {         // Distancias personalizadas para cada categoría a sus herramientas
                'engines': 250,
                'frameworks': 250,
                'ia': 180,
                'shaders': 220,
                'db': 220,
                'ides': 220,
                'languages': 350,
                'llm': 220,
                'frontend': 220,
                'os': 220,
                'soportes': 280,
                'protocolos': 220,
                'software-multimedia': 220,
                'entornos': 220,
                'glosario': 380
        },
        // Configuración de tiempos para el modo Play (en milisegundos)
        animCategoryDelay: 3000,
        animNodeDelay: 2500,
        animTransitionSpeed: 800,
        animNodeExpansionSpeed: 400
};

// ═══════════════════════════════════════════════════════════════
//  DATOS DINÁMICOS - Se cargan desde la API
// ═══════════════════════════════════════════════════════════════

// Almacenamiento de datos cargados desde la API
let _apiData = null;
let _dataLoaded = false;

// NODE_INFO se puebla dinámicamente desde la API
let NODE_INFO = {};

// Detectar la base URL para la API (funciona tanto en local como en VPS)
// Detectar el ID del proyecto desde la URL o localStorage
function getCurrentProject() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('project') || 'diplomatura';
}

// Detectar la base URL para la API (funciona tanto en local como en VPS)
function getApiBasePath() {
        const parts = window.location.pathname.split('/').filter(Boolean);
        const reserved = new Set(['api', 'nube_data', 'js', 'css', 'img', 'favicon.ico']);
        const app = parts[0];
        if (app === 'mapai' || app === 'diploia') {
                const tenant = parts[1] && !reserved.has(parts[1]) && !parts[1].includes('.') ? parts[1] : null;
                const base = `/${app}`;
                const basePath = tenant ? `${base}/${tenant}` : base;
                const host = String(window.location.hostname || '').toLowerCase();
                if (host === 'fullscreencode.com' || host.endsWith('.fullscreencode.com') || host === 'fullscreen.com' || host.endsWith('.fullscreen.com')) {
                        const apiOrigin = (window.__DIPLOIA_API_ORIGIN__ ? String(window.__DIPLOIA_API_ORIGIN__) : 'https://vps-4455523-x.dattaweb.com').replace(/\/+$/, '');
                        const remoteBase = app === 'mapai' ? '/mapai' : '/diploia/diploia';
                        const remotePath = tenant && app === 'mapai' ? `${remoteBase}/${tenant}` : remoteBase;
                        return apiOrigin + remotePath;
                }
                return window.location.origin + basePath;
        }
        return window.location.origin;
}

// Cargar datos desde la API
async function loadMapData() {
        if (_dataLoaded) return _apiData;

        try {
                const basePath = getApiBasePath();
                const project = getCurrentProject();
                const query = `?project=${project}`;
                
                const response = await fetch(`${basePath}/api/nodes${query}`);
                const configResponse = await fetch(`${basePath}/api/config${query}`);

                if (!response.ok) {
                        throw new Error(`API responded with status ${response.status}`);
                }

                _apiData = await response.json();

                // Cargar configuración desde API si existe
                if (configResponse.ok) {
                        const configData = await configResponse.json();
                        if (configData.config && Object.keys(configData.config).length > 0) {
                                CONFIG = { ...CONFIG, ...configData.config };
                                console.log('✅ Mapa: Configuración cargada desde API');
                        }
                }

                // Construir NODE_INFO desde los datos de la API
                if (_apiData.nodes) {
                        for (const [nodeId, node] of Object.entries(_apiData.nodes)) {
                                if (node.infoHTML) {
                                        NODE_INFO[nodeId] = node.infoHTML;
                                } else if (node.info) {
                                        NODE_INFO[nodeId] = `<h3>${node.label || nodeId}</h3><p>${node.info}</p>`;
                                }
                        }
                }

                _dataLoaded = true;
                console.log(`✅ Mapa: Datos cargados desde API - ${Object.keys(_apiData.nodes || {}).length} nodos, ${(_apiData.categories || []).length} categorías`);
                return _apiData;
        } catch (error) {
                console.error('❌ Error cargando datos desde API:', error);
                console.warn('⚠️ Asegurate de que el servidor esté corriendo en el puerto 4500');
                _dataLoaded = false;
                return null;
        }
}

// ═══════════════════════════════════════════════════════════════
//  FUNCIONES DE ELEMENTOS Y CONEXIONES - Generadas desde datos API
// ═══════════════════════════════════════════════════════════════

// Función para obtener los elementos del mapa (nodos)
function getMapElements() {
        if (!_apiData || !_apiData.nodes) {
                console.warn('⚠️ getMapElements() llamado sin datos cargados');
                return [];
        }

        const elements = [];

        for (const [nodeId, node] of Object.entries(_apiData.nodes)) {
                const el = {
                        data: {
                                id: node.id,
                                label: node.label || node.id
                        }
                };

                // Agregar tipo si es categoría o root
                if (node.type === 'category' || nodeId === 'root') {
                        el.data.type = 'category';
                }

                // Agregar URL si existe
                if (node.url) {
                        el.data.url = node.url;
                }

                elements.push(el);
        }

        return elements;
}

// Función para obtener las conexiones del mapa
function getMapConnections() {
        if (!_apiData || !_apiData.nodes) {
                console.warn('⚠️ getMapConnections() llamado sin datos cargados');
                return [];
        }

        const connections = [];
        const addedConnections = new Set(); // Evitar duplicados

        // 1. Conexiones primarias: root -> categorías
        if (_apiData.categories) {
                for (const catId of _apiData.categories) {
                        const connId = `root-${catId}`;
                        if (!addedConnections.has(connId)) {
                                connections.push({
                                        data: { id: connId, source: 'root', target: catId }
                                });
                                addedConnections.add(connId);
                        }
                }
        }

        // 2. Conexiones de categorías a sus hijos
        if (_apiData.categoryChildren) {
                for (const [catId, children] of Object.entries(_apiData.categoryChildren)) {
                        for (const childId of children) {
                                const connId = `${catId}-${childId}`;
                                if (!addedConnections.has(connId)) {
                                        connections.push({
                                                data: { id: connId, source: catId, target: childId }
                                        });
                                        addedConnections.add(connId);
                                }
                        }
                }
        }

        // 3. Conexiones secundarias (desde node.connections.secondary)
        for (const [nodeId, node] of Object.entries(_apiData.nodes)) {
                if (node.connections && node.connections.secondary && Array.isArray(node.connections.secondary)) {
                        for (const targetId of node.connections.secondary) {
                                // Verificar que el nodo target existe
                                if (_apiData.nodes[targetId]) {
                                        const connId = `${nodeId}-${targetId}`;
                                        if (!addedConnections.has(connId)) {
                                                connections.push({
                                                        data: { id: connId, source: nodeId, target: targetId, type: 'secondary' }
                                                });
                                                addedConnections.add(connId);
                                        }
                                }
                        }
                }
        }

        return connections;
}
