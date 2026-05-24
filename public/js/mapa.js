// Archivo principal del mapa de herramientas
// Este archivo contiene la funcionalidad del mapa y utiliza los datos de los archivos separados
// Los datos (CONFIG, NODE_INFO) se cargan dinámicamente desde la API via mapa_data.js

// Función para inicializar el mapa
function initMap() {
    // Aquí puedes poner código de inicialización adicional si es necesario
}

document.addEventListener('DOMContentLoaded', async function () {
    // Mostrar indicador de carga
    const cyContainer = document.getElementById('cy');
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'mapa-loading';
    loadingDiv.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#ff69b4;font-size:1.2rem;font-family:sans-serif;z-index:1000;text-align:center;';
    loadingDiv.innerHTML = '<div style="margin-bottom:12px;">⏳ Cargando datos del mapa...</div><div style="width:40px;height:40px;border:3px solid rgba(255,105,180,0.3);border-top:3px solid #ff69b4;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto;"></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
    cyContainer.appendChild(loadingDiv);

    // Cargar datos desde la API
    const data = await loadMapData();

    // Remover indicador de carga
    if (loadingDiv.parentNode) loadingDiv.remove();

    if (!data) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#ff4444;font-size:1.1rem;font-family:sans-serif;z-index:1000;text-align:center;max-width:400px;';
        errorDiv.innerHTML = '<div style="font-size:2rem;margin-bottom:12px;">❌</div><div>No se pudieron cargar los datos del mapa.</div><div style="margin-top:8px;color:#aaa;font-size:0.9rem;">Asegurate de que el servidor esté corriendo en el puerto 4500.</div>';
        cyContainer.appendChild(errorDiv);
        return;
    }

    // Verificar parámetro de fullscreen en la URL
    const urlParams = new URLSearchParams(window.location.search);
    const autoFullscreen = urlParams.get('fullscreen') === 'true';

    // Inicializar Cytoscape con datos de la API
    var cy = cytoscape({
        container: cyContainer,
        elements: [...getMapElements(), ...getMapConnections()],
        style: [
            {
                selector: 'node',
                style: {
                    'background-color': '#1a1a1a',
                    'border-color': '#ff69b4',
                    'border-width': 2,
                    'label': 'data(label)',
                    'color': '#ffffff',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'font-size': CONFIG.nodeFontSize + 'px',
                    'font-weight': 'bold',
                    'text-wrap': 'wrap',
                    'text-max-width': '100px',
                    'width': CONFIG.secondaryNodeSize + 'px',
                    'height': CONFIG.secondaryNodeSize + 'px',
                    'padding': '15px',
                    'transition-property': 'background-color, border-color, border-width, width, height, background-opacity',
                    'transition-duration': '0.3s',
                    'transition-timing-function': 'ease-in-out'
                }
            },
            {
                selector: 'node[type="category"]',
                style: {
                    'background-color': '#8a2be2',
                    'border-color': '#ff69b4',
                    'border-width': 3,
                    'font-size': CONFIG.categoryFontSize + 'px',
                    'width': CONFIG.primaryNodeSize + 'px',
                    'height': CONFIG.primaryNodeSize + 'px',
                    'padding': '20px'
                }
            },
            {
                selector: 'node[id="root"]',
                style: {
                    'background-color': '#9400d3',
                    'border-color': '#ff1493',
                    'border-width': 4,
                    'font-size': CONFIG.rootFontSize + 'px',
                    'width': CONFIG.rootNodeSize + 'px',
                    'height': CONFIG.rootNodeSize + 'px',
                    'padding': '25px'
                }
            },
            {
                selector: 'node:selected',
                style: {
                    'background-color': '#ff1493',
                    'border-color': '#ffffff',
                    'border-width': 3
                }
            },
            {
                selector: 'edge',
                style: {
                    'display': 'none', // Ocultar todos los edges en Cytoscape por defecto
                    'curve-style': 'bezier',
                    'target-arrow-shape': 'triangle',
                    'arrow-scale': 0.8
                }
            },
            {
                selector: 'edge.highlighted',
                style: {
                    'display': 'element', // Solo mostrar los resaltados
                    'opacity': 1,
                    'width': 3,
                    'line-color': '#00ffff',
                    'target-arrow-color': '#00ffff',
                    'z-index': 999
                }
            },
            {
                selector: 'edge.dash-animated.highlighted',
                style: {
                    'line-style': 'dashed',
                    'line-dash-pattern': [6, 3],
                    'line-color': 'rgba(138, 43, 226, 1)',
                    'target-arrow-color': '#8a2be2'
                }
            }
        ],
        layout: {
            name: 'preset',
            padding: 80,
            fit: true,
            animate: true,
            animationDuration: 1000,
            positions: function (node) {
                // Posición para el nodo raíz (centro)
                if (node.id() === 'root') {
                    return { x: 0, y: 0 };
                }

                // Posiciones para categorías principales (primer anillo)
                if (node.data('type') === 'category') {
                    const categories = _apiData.categories || [];
                    const index = categories.indexOf(node.id());
                    if (index !== -1) {
                        const angle = (2 * Math.PI * index) / categories.length;
                        // Usar la distancia personalizada para cada categoría o el valor por defecto
                        const radius = CONFIG.categoryDistancesMain[node.id()] || 300;
                        return {
                            x: radius * Math.cos(angle),
                            y: radius * Math.sin(angle)
                        };
                    }
                }

                // Posiciones para nodos secundarios (segundo anillo)
                // Construir categoryMap dinámicamente desde los datos de la API
                const categoryMap = {};
                if (_apiData.categoryChildren) {
                    for (const [catId, children] of Object.entries(_apiData.categoryChildren)) {
                        for (const childId of children) {
                            categoryMap[childId] = catId;
                        }
                    }
                }

                const parentCategory = categoryMap[node.id()];
                if (parentCategory) {
                    const categories = _apiData.categories || [];
                    const categoryIndex = categories.indexOf(parentCategory);

                    // Obtener nodos hermanos (misma categoría)
                    const siblings = Object.keys(categoryMap).filter(key => categoryMap[key] === parentCategory);
                    const siblingIndex = siblings.indexOf(node.id());

                    if (categoryIndex !== -1 && siblingIndex !== -1) {
                        const categoryAngle = (2 * Math.PI * categoryIndex) / categories.length;

                        // Algoritmo mejorado para distribución de nodos secundarios
                        let siblingOffset;
                        let radius = CONFIG.categoryDistances[parentCategory] || 500;

                        // Distribuir los nodos secundarios de forma radial alrededor de la categoría
                        // Calcular el ángulo para cada nodo secundario
                        const totalNodes = siblings.length;
                        // Distribuir los nodos en un círculo completo (360 grados)
                        const angleStep = (2 * Math.PI) / totalNodes;
                        // El ángulo para este nodo específico
                        const nodeAngle = angleStep * siblingIndex;

                        // Calcular la posición en coordenadas cartesianas
                        // Primero obtenemos la posición de la categoría padre
                        const categoryX = CONFIG.categoryDistancesMain[parentCategory] * Math.cos(categoryAngle) || 0;
                        const categoryY = CONFIG.categoryDistancesMain[parentCategory] * Math.sin(categoryAngle) || 0;

                        // Luego calculamos la posición del nodo secundario alrededor de la categoría
                        return {
                            x: categoryX + radius * Math.cos(nodeAngle),
                            y: categoryY + radius * Math.sin(nodeAngle)
                        };
                    }
                }

                // Posición por defecto
                return { x: 0, y: 0 };
            }
        },
        minZoom: 0.2,
        maxZoom: 3,
        userZoomingEnabled: true,
        userPanningEnabled: true,
        boxSelectionEnabled: false,
        autounselectify: false,
        autoungrabify: false,  // Permitir arrastrar nodos
        wheelSensitivity: 0.1  // Reducir la sensibilidad del zoom con la rueda
    });

    // Crear el elemento para mostrar información al hacer hover (posición fija)
    const infoBox = document.createElement('div');
    infoBox.id = 'node-hover-info';
    infoBox.style.position = 'absolute';
    infoBox.style.display = 'none';
    infoBox.style.backgroundColor = 'rgba(10, 10, 20, 0.95)';
    infoBox.style.color = '#fff';
    infoBox.style.padding = '20px 25px';
    infoBox.style.borderRadius = '12px';
    infoBox.style.minWidth = '340px';
    infoBox.style.maxWidth = '420px';
    infoBox.style.maxHeight = '70vh';
    infoBox.style.overflowY = 'auto';
    infoBox.style.boxShadow = '0 4px 30px rgba(255, 105, 180, 0.4), 0 0 20px rgba(138, 43, 226, 0.4)';
    infoBox.style.zIndex = '600';
    infoBox.style.pointerEvents = 'none';
    infoBox.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    infoBox.style.opacity = 0;
    infoBox.style.border = '1px solid rgba(255, 105, 180, 0.5)';
    infoBox.style.backdropFilter = 'blur(8px)';
    // Posición fija: lado derecho, centrado verticalmente (igual que modo play)
    infoBox.style.right = '30px';
    infoBox.style.top = '50%';
    infoBox.style.transform = 'translateY(-50%)';

    // Estilos para los elementos internos del infoBox
    const style = document.createElement('style');
    style.textContent = `
        #node-hover-info h3 {
            color: #ff69b4;
            margin-top: 0;
            margin-bottom: 10px;
            font-size: ${CONFIG.popupTitleFontSize}px;
            border-bottom: 1px solid rgba(255, 105, 180, 0.3);
            padding-bottom: 8px;
        }
        #node-hover-info p {
            margin: 8px 0;
            line-height: 1.5;
            font-size: ${CONFIG.popupTextFontSize}px;
        }
        #node-hover-info strong {
            color: #ff9edb;
            font-weight: bold;
            font-size: ${CONFIG.popupSubtitleFontSize}px;
        }
        #node-hover-info ul {
            margin: 5px 0;
            padding-left: 20px;
        }
        #node-hover-info li {
            margin: 3px 0;
            line-height: 1.4;
            font-size: ${CONFIG.popupTextFontSize}px;
        }
    `;
    document.head.appendChild(style);

    document.getElementById('cy').appendChild(infoBox);

    // ============================================================
    // OPTIMIZACIÓN DE RENDERIZADO: BUFFER DE LÍNEAS ESTÁTICAS
    // ============================================================
    const bgCanvas = document.createElement('canvas');
    bgCanvas.id = 'static-edges-canvas';
    bgCanvas.style.position = 'absolute';
    bgCanvas.style.top = '0';
    bgCanvas.style.left = '0';
    bgCanvas.style.width = '100%';
    bgCanvas.style.height = '100%';
    bgCanvas.style.zIndex = '0';
    bgCanvas.style.pointerEvents = 'none';
    cyContainer.insertBefore(bgCanvas, cyContainer.firstChild);

    const bgCtx = bgCanvas.getContext('2d');
    const offscreenCanvas = document.createElement('canvas');
    const offCtx = offscreenCanvas.getContext('2d');
    let bufferReady = false;
    let graphExtent = null;

    function updateStaticBuffer() {
        const edges = cy.edges();
        if (edges.length === 0) return;

        graphExtent = cy.elements().boundingBox();
        const padding = 200;
        
        // Ajustar tamaño del buffer offscreen
        offscreenCanvas.width = (graphExtent.w + padding * 2);
        offscreenCanvas.height = (graphExtent.h + padding * 2);

        offCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        offCtx.strokeStyle = 'rgba(255, 105, 180, 0.25)'; // Líneas estáticas tenues
        offCtx.lineWidth = 1;
        offCtx.beginPath();

        edges.forEach(edge => {
            const src = edge.source().position();
            const tgt = edge.target().position();
            if (src && tgt) {
                offCtx.moveTo(src.x - graphExtent.x1 + padding, src.y - graphExtent.y1 + padding);
                offCtx.lineTo(tgt.x - graphExtent.x1 + padding, tgt.y - graphExtent.y1 + padding);
            }
        });
        offCtx.stroke();
        bufferReady = true;
    }

    function renderStaticBuffer() {
        if (!bufferReady) return;

        const width = cyContainer.clientWidth;
        const height = cyContainer.clientHeight;
        
        if (bgCanvas.width !== width || bgCanvas.height !== height) {
            bgCanvas.width = width;
            bgCanvas.height = height;
        }

        bgCtx.clearRect(0, 0, width, height);
        
        const zoom = cy.zoom();
        const pan = cy.pan();
        const padding = 200;

        // Dibujar el buffer transformado según el viewport de Cytoscape
        bgCtx.drawImage(
            offscreenCanvas,
            (graphExtent.x1 - padding) * zoom + pan.x,
            (graphExtent.y1 - padding) * zoom + pan.y,
            offscreenCanvas.width * zoom,
            offscreenCanvas.height * zoom
        );
    }

    // Actualizar el buffer cuando el layout termine o los nodos se muevan
    cy.on('layoutstop', updateStaticBuffer);
    cy.on('dragfree', updateStaticBuffer);
    
    // Renderizar el buffer en cada cambio de vista
    cy.on('render', renderStaticBuffer);

    // Inicializar el buffer después de un pequeño delay para asegurar que el layout preset se aplicó
    setTimeout(updateStaticBuffer, 500);

    // Variables para la animación de líneas discontinuas
    let dashOffset = 0;
    let animationActive = true;
    let dashAnimationId;

    // Función optimizada para animar líneas discontinuas
    function animateDashLines() {
        if (!animationActive) return;

        const highlightedEdges = cy.$('.dash-animated.highlighted');
        
        // Si no hay elementos resaltados, no necesitamos animar este frame
        if (highlightedEdges.length === 0) {
            dashAnimationId = requestAnimationFrame(animateDashLines);
            return;
        }

        // Incrementar el offset
        dashOffset = (dashOffset + 1) % 12;

        // Aplicar el nuevo offset SOLO a los elementos que lo necesitan
        highlightedEdges.style('line-dash-offset', dashOffset);

        // Programar la próxima animación
        dashAnimationId = requestAnimationFrame(animateDashLines);
    }

    // Agregar clase a todas las líneas discontinuas
    cy.style()
        .selector('edge[type="secondary"]')
        .style({
            'line-style': 'dashed',
            'line-dash-pattern': [6, 3],
            'line-dash-offset': 0,
            'line-color': 'rgba(138, 43, 226, 0.6)',
            'target-arrow-color': '#8a2be2',
            'transition-property': 'line-color, target-arrow-color, width, opacity',
            'transition-duration': '0.3s'
        })
        .update();

    cy.$('edge[type="secondary"]').addClass('dash-animated');

    // Iniciar la animación
    animateDashLines();

    // Detener la animación cuando la pestaña no esté visible para ahorrar recursos
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            animationActive = false;
            if (dashAnimationId) {
                cancelAnimationFrame(dashAnimationId);
            }
        } else {
            animationActive = true;
            animateDashLines();
        }
    });

    // Función para resaltar nodos conectados
    function highlightConnectedNodes(node) {
        // Restablecer todos los nodos y bordes
        cy.elements().removeClass('highlighted faded');

        // Si no hay nodo seleccionado, salir
        if (!node) return;

        // Obtener nodos conectados y bordes
        const connectedEdges = node.connectedEdges();
        const connectedNodes = node.neighborhood('node');

        // Agregar el nodo actual a los nodos conectados
        connectedNodes.merge(node);

        // Atenuar todos los nodos y bordes excepto los conectados
        cy.elements().difference(connectedNodes).difference(connectedEdges).addClass('faded');

        // Resaltar nodos conectados y bordes
        connectedNodes.addClass('highlighted');
        connectedEdges.addClass('highlighted');
        
        // El resto se gestiona por el CSS condicional (display: element para highlighted)
    }

    // Variable para rastrear el nodo seleccionado (click)
    var selectedNode = null;

    // Función para generar el HTML del infoBox con título clickeable
    function buildInfoHTML(nodeId) {
        var info = NODE_INFO[nodeId];
        if (!info) return '';
        var node = cy.getElementById(nodeId);
        var url = node.data('url');
        // Si hay URL y el info tiene un <h3>, hacemos el título clickeable
        if (url && url !== '#') {
            info = info.replace(/<h3>(.*?)<\/h3>/, '<h3><a href="' + url + '" target="_blank" style="color: #ff69b4; text-decoration: underline; cursor: pointer; pointer-events: auto;">$1 🔗</a></h3>');
        }

        // Agregar la imagen del nodo
        if (!info.includes('img src="img/nodes/')) {
            info += `<div style="text-align:center; margin-top: 15px;"><img src="img/nodes/${nodeId}.png" style="max-width: 100%; border-radius: 8px; border: 1px solid rgba(255, 105, 180, 0.4);" onerror="this.style.display='none'"></div>`;
        }

        return info;
    }

    // Agregar interactividad: click = seleccionar nodo (NO abre URL)
    cy.on('tap', 'node', function (evt) {
        if (animRunning) return;
        var node = evt.target;
        highlightConnectedNodes(node);
        selectedNode = node;

        // Mostrar infoBox con título clickeable (NO abrir URL)
        var nodeId = node.id();
        var infoHTML = buildInfoHTML(nodeId);
        if (infoHTML) {
            infoBox.innerHTML = infoHTML;
            infoBox.style.pointerEvents = 'auto';
            infoBox.style.display = 'block';
            infoBox.style.opacity = 0;
            setTimeout(function () {
                infoBox.style.opacity = 1;
            }, 10);
        }
    });

    // Quitar resaltado y deseleccionar al hacer clic en el fondo
    cy.on('tap', function (evt) {
        if (evt.target === cy) {
            selectedNode = null;
            cy.elements().removeClass('highlighted faded');
            // Asegurarse de que ninguna línea discontinua se anime cuando no hay selección
            cy.$('.dash-animated').style('line-dash-offset', 0);
            // Ocultar infoBox
            infoBox.style.opacity = 0;
            infoBox.style.pointerEvents = 'none';
            setTimeout(function () {
                if (infoBox.style.opacity === '0') {
                    infoBox.style.display = 'none';
                }
            }, 300);
        }
    });

    // Mostrar información al hacer hover sobre un nodo y resaltar conexiones
    cy.on('mouseover', 'node', function (evt) {
        if (animRunning) return;
        var node = evt.target;
        var nodeId = node.id();
        var nodeInfo = NODE_INFO[nodeId];

        // Aplicar estilo directamente para asegurar que se aplique
        node.style({
            'border-width': '5px',
            'border-color': '#00ffff',
            'background-color': '#3a3a3a',
            'z-index': 1000
        });

        // Obtener todas las conexiones entrantes y salientes
        var connectedEdges = node.connectedEdges();
        // Agregar clase highlighted para que se activen en Cytoscape y muestren animación
        connectedEdges.addClass('highlighted');

        // Resaltar nodos conectados
        var connectedNodes = node.neighborhood('node');
        connectedNodes.style({
            'border-color': '#00ccff',
            'border-width': '4px',
            'z-index': 999
        });

        if (nodeInfo) { // Mostrar info para todos los nodos
            var infoHTML = buildInfoHTML(nodeId);
            infoBox.innerHTML = infoHTML;
            infoBox.style.pointerEvents = 'auto';
            infoBox.style.display = 'block';
            infoBox.style.opacity = 0;

            // Animar la aparición del infoBox (posición fija, no sigue al cursor)
            setTimeout(function () {
                infoBox.style.opacity = 1;
            }, 10);
        }
    });

    cy.on('mouseout', 'node', function (evt) {
        if (animRunning) return;
        var node = evt.target;

        // Restaurar estilos originales
        node.removeStyle('border-width border-color background-color z-index');

        // Quitar la clase highlighted para ocultar de nuevo en Cytoscape y detener animación
        var connectedEdges = node.connectedEdges();
        connectedEdges.removeClass('highlighted');

        // Restaurar estilos de nodos conectados
        var connectedNodes = node.neighborhood('node');
        connectedNodes.removeStyle('border-color border-width z-index');

        // Ocultar infoBox con animación SOLO si no hay nodo seleccionado
        if (!selectedNode) {
            infoBox.style.opacity = 0;
            infoBox.style.pointerEvents = 'none';
            setTimeout(function () {
                if (infoBox.style.opacity === '0') {
                    infoBox.style.display = 'none';
                }
            }, 300);
        } else {
            // Si hay un nodo seleccionado, restaurar su info
            var selId = selectedNode.id();
            var selHTML = buildInfoHTML(selId);
            if (selHTML) {
                infoBox.innerHTML = selHTML;
                infoBox.style.pointerEvents = 'auto';
            }
        }
    });

    // Controles de zoom
    document.getElementById('zoom-in').addEventListener('click', function () {
        cy.zoom({
            level: cy.zoom() * 1.2,
            renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 }
        });
    });

    document.getElementById('zoom-out').addEventListener('click', function () {
        cy.zoom({
            level: cy.zoom() * 0.8,
            renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 }
        });
    });

    // Función de reset
    document.getElementById('reset').addEventListener('click', function () {
        cy.fit();
        cy.center();
        cy.zoom(1);
    });

    // Función de pantalla completa simplificada
    document.getElementById('fullscreen').addEventListener('click', function () {
        var elem = document.getElementById('cy');

        if (!document.fullscreenElement) {
            try {
                // Intentar entrar en fullscreen con diferentes métodos
                if (elem.requestFullscreen) {
                    elem.requestFullscreen();
                } else if (elem.mozRequestFullScreen) { /* Firefox */
                    elem.mozRequestFullScreen();
                } else if (elem.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
                    elem.webkitRequestFullscreen();
                } else if (elem.msRequestFullscreen) { /* IE/Edge */
                    elem.msRequestFullscreen();
                }
                this.textContent = 'Salir';
            } catch (err) {
                console.error('Error al intentar pantalla completa:', err);
            }
        } else {
            try {
                // Intentar salir de fullscreen con diferentes métodos
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.mozCancelFullScreen) { /* Firefox */
                    document.mozCancelFullScreen();
                } else if (document.webkitExitFullscreen) { /* Chrome, Safari & Opera */
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) { /* IE/Edge */
                    document.msExitFullscreen();
                }
                this.textContent = 'Pantalla Completa';
            } catch (err) {
                console.error('Error al salir de pantalla completa:', err);
            }
        }
    });

    // Asegurar que el texto del botón es correcto al inicio
    document.getElementById('fullscreen').textContent = 'Pantalla Completa';

    // Detectar cambios en el estado de pantalla completa
    document.addEventListener('fullscreenchange', updateFullscreenButton);
    document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
    document.addEventListener('mozfullscreenchange', updateFullscreenButton);
    document.addEventListener('MSFullscreenChange', updateFullscreenButton);

    function updateFullscreenButton() {
        var button = document.getElementById('fullscreen');
        var cyElem = document.getElementById('cy');
        if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
            button.textContent = 'Salir';
            cyElem.style.backgroundColor = '#121212';
            cyElem.style.backgroundImage = "url('img/background.png')";
            cyElem.style.backgroundSize = 'cover';
            cyElem.style.backgroundPosition = 'center';
        } else {
            button.textContent = 'Pantalla Completa';
            cyElem.style.backgroundColor = '';
            cyElem.style.backgroundImage = '';
            cyElem.style.backgroundSize = '';
            cyElem.style.backgroundPosition = '';
        }
    }

    // =============================================
    // MODO ANIMACIÓN - Play / Stop
    // =============================================
    var animRunning = false;
    var animCancelled = false;
    var animTimeouts = [];

    // Mapa de categoría -> hijos (generado dinámicamente desde la API)
    var categoryChildrenMap = _apiData.categoryChildren || {};

    var categoryOrder = _apiData.categories || [];

    var playBtn = document.getElementById('anim-play');
    var stopBtn = document.getElementById('anim-stop');
    var categoryLabel = document.getElementById('anim-category-label');
    var animInfoPanel = document.getElementById('anim-info-panel');

    // Aplicar tamaños de fuente desde CONFIG usando CSS variables
    if (animInfoPanel) {
        animInfoPanel.style.setProperty('--anim-title-size', CONFIG.popupTitleFontSize + 'px');
        animInfoPanel.style.setProperty('--anim-subtitle-size', CONFIG.popupSubtitleFontSize + 'px');
        animInfoPanel.style.setProperty('--anim-text-size', CONFIG.popupTextFontSize + 'px');
    }

    function showAnimInfo(nodeId) {
        var info = NODE_INFO[nodeId];
        if (info && animInfoPanel) {
            animInfoPanel.innerHTML = info;
            animInfoPanel.style.display = 'block';
            animInfoPanel.offsetHeight;
            animInfoPanel.classList.add('visible');
        }
    }

    function hideAnimInfo() {
        if (animInfoPanel) {
            animInfoPanel.classList.remove('visible');
            setTimeout(function () {
                if (!animInfoPanel.classList.contains('visible')) {
                    animInfoPanel.style.display = 'none';
                }
            }, 500);
        }
    }

    function animDelay(ms) {
        return new Promise(function (resolve) {
            var t = setTimeout(function () {
                if (animCancelled) return;
                resolve();
            }, ms);
            animTimeouts.push(t);
        });
    }

    function showCategoryLabel(text) {
        // Desactivado - ya no se usa en el modo play
    }

    function hideCategoryLabel() {
        // Desactivado - ya no se usa en el modo play
    }

    // Función para centrar la cámara en un nodo específico con zoom
    function focusOnNode(node, padding) {
        padding = padding || 180;
        cy.stop(); // Detener animaciones previas de cy
        cy.animate({
            fit: { eles: node, padding: padding },
            duration: CONFIG.animTransitionSpeed,
            easing: 'ease-in-out'
        });
    }

    async function runAnimation() {
        animRunning = true;
        animCancelled = false;
        playBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        stopBtn.classList.add('active');
        // También actualizar botones de fullscreen si existen
        updateFullscreenAnimButtons(true);

        // Cerrar cualquier desplegable/hover abierto por el mouse
        infoBox.style.opacity = 0;
        infoBox.style.display = 'none';
        cy.nodes().removeStyle('border-width border-color background-color z-index');
        cy.edges().removeStyle('width line-color target-arrow-color opacity z-index');
        cy.elements().removeClass('highlighted faded');

        // Guardar posiciones originales de todos los nodos
        var originalPositions = {};
        cy.nodes().forEach(function (n) {
            originalPositions[n.id()] = { x: n.position('x'), y: n.position('y') };
        });

        // Paso 1: Preparar - ocultar todo
        cy.elements().removeClass('highlighted faded');
        cy.nodes().style('opacity', 1);
        cy.edges().style('opacity', 1);

        var allChildIds = [];
        categoryOrder.forEach(function (catId) {
            categoryChildrenMap[catId].forEach(function (childId) {
                allChildIds.push(childId);
            });
        });

        // Ocultar hijos y sus edges
        allChildIds.forEach(function (childId) {
            var node = cy.getElementById(childId);
            if (node.length) {
                node.style('opacity', 0);
                node.connectedEdges().style('opacity', 0);
            }
        });

        // Ocultar categorías inicialmente
        categoryOrder.forEach(function (catId) {
            var catNode = cy.getElementById(catId);
            if (catNode.length) {
                catNode.style('opacity', 0);
                catNode.connectedEdges().style('opacity', 0);
            }
        });

        // Centrar en root
        focusOnNode(cy.getElementById('root'), 200);
        showAnimInfo('root');

        await animDelay(CONFIG.animCategoryDelay);
        if (animCancelled) return;

        hideAnimInfo();
        await animDelay(500);
        if (animCancelled) return;

        // Paso 2: Iterar por cada categoría
        for (var i = 0; i < categoryOrder.length; i++) {
            if (animCancelled) return;

            var catId = categoryOrder[i];
            var catNode = cy.getElementById(catId);
            var children = categoryChildrenMap[catId];

            if (!catNode.length) continue;

            // --- FASE 1: Mostrar y enfocar la CATEGORÍA ---
            // (Etiqueta de categoría removida - solo se muestra el info panel)

            // Mostrar el nodo categoría y su edge desde root
            catNode.style('opacity', 1);
            var rootEdge = cy.getElementById('root-' + catId);
            if (rootEdge.length) {
                rootEdge.style('opacity', 1);
            }

            // Highlight de la categoría
            catNode.style({
                'border-color': '#00ffff',
                'border-width': '5px'
            });

            // Centrar cámara en la categoría
            focusOnNode(catNode, 200);

            await animDelay(CONFIG.animTransitionSpeed + 200);
            if (animCancelled) return;

            // Mostrar info panel de la categoría
            showAnimInfo(catId);

            // Esperar el tiempo configurado en la categoría
            await animDelay(CONFIG.animCategoryDelay);
            if (animCancelled) return;

            // Restaurar estilo de categoría
            catNode.removeStyle('border-color border-width');
            hideAnimInfo();
            await animDelay(400);
            if (animCancelled) return;

            // --- FASE 2: Expandir todos los hijos primero (rápido) ---
            var catPos = catNode.position();
            for (var j = 0; j < children.length; j++) {
                var childId = children[j];
                var childNode = cy.getElementById(childId);
                if (!childNode.length) continue;

                // Mover el hijo a la posición de la categoría
                childNode.position({ x: catPos.x, y: catPos.y });
                childNode.style('opacity', 1);

                // Mostrar edge categoría -> hijo
                var catEdge = cy.edges().filter(function (edge) {
                    return edge.data('source') === catId && edge.data('target') === childId;
                });
                catEdge.style('opacity', 1);

                // Animar hacia su posición original
                var origPos = originalPositions[childId];
                if (origPos) {
                    childNode.animate({
                        position: origPos,
                        duration: CONFIG.animNodeExpansionSpeed,
                        easing: 'ease-out'
                    });
                }
            }

            // Esperar a que se expandan
            await animDelay(CONFIG.animNodeExpansionSpeed + 200);
            if (animCancelled) return;

            // --- FASE 3: Recorrer CADA hijo, centrar cámara y mostrar info ---
            for (var j = 0; j < children.length; j++) {
                if (animCancelled) return;

                var childId = children[j];
                var childNode = cy.getElementById(childId);
                if (!childNode.length) continue;

                // Highlight del hijo
                childNode.style({
                    'border-color': '#00ffff',
                    'border-width': '5px'
                });

                // Centrar cámara en ESTE nodo hijo
                focusOnNode(childNode, 250);

                await animDelay(CONFIG.animTransitionSpeed + 100);
                if (animCancelled) return;

                // Mostrar info panel del hijo
                showAnimInfo(childId);

                // Esperar el tiempo configurado por nodo
                await animDelay(CONFIG.animNodeDelay);
                if (animCancelled) return;

                // Ocultar info y restaurar estilo
                hideAnimInfo();
                childNode.removeStyle('border-color border-width');

                await animDelay(300);
                if (animCancelled) return;
            }

            // --- FASE 4: Vista general de la categoría completa ---
            var catCollection = cy.collection().merge(catNode);
            children.forEach(function (cId) {
                catCollection = catCollection.merge(cy.getElementById(cId));
            });

            cy.stop();
            cy.animate({
                fit: { eles: catCollection, padding: 80 },
                duration: CONFIG.animTransitionSpeed,
                easing: 'ease-in-out'
            });

            await animDelay(CONFIG.animTransitionSpeed + 500);
            if (animCancelled) return;

            // (hideCategoryLabel removido)
            await animDelay(500);
            if (animCancelled) return;
        }

        // Final: Mostrar todo el mapa
        // (hideCategoryLabel removido)
        hideAnimInfo();
        cy.stop();
        cy.animate({
            fit: { eles: cy.elements(), padding: 50 },
            duration: 1200,
            easing: 'ease-in-out'
        });

        await animDelay(1500);
        stopAnimation();
    }

    function stopAnimation() {
        animCancelled = true;
        animRunning = false;

        // Limpiar timeouts pendientes
        animTimeouts.forEach(function (t) { clearTimeout(t); });
        animTimeouts = [];

        // Restaurar UI
        playBtn.style.display = 'inline-block';
        stopBtn.style.display = 'none';
        stopBtn.classList.remove('active');
        hideCategoryLabel();
        hideAnimInfo();
        updateFullscreenAnimButtons(false);

        // Restaurar visibilidad de todos los nodos y edges
        cy.nodes().style('opacity', 1);
        cy.edges().style('opacity', 1);
        cy.nodes().removeStyle('border-color border-width');
        cy.elements().removeClass('highlighted faded');

        // Fit todo
        cy.stop();
        cy.animate({
            fit: { eles: cy.elements(), padding: 50 },
            duration: 800,
            easing: 'ease-in-out'
        });
    }

    playBtn.addEventListener('click', function () {
        if (!animRunning) {
            runAnimation();
        }
    });

    stopBtn.addEventListener('click', function () {
        stopAnimation();
    });

    // =============================================
    // CONTROLES EN FULLSCREEN
    // =============================================
    var fsControls = document.getElementById('fullscreen-controls');
    var fsPlayBtn = document.getElementById('fs-anim-play');
    var fsStopBtn = document.getElementById('fs-anim-stop');

    function updateFullscreenAnimButtons(isPlaying) {
        if (!fsPlayBtn || !fsStopBtn) return;
        if (isPlaying) {
            fsPlayBtn.style.display = 'none';
            fsStopBtn.style.display = 'inline-block';
            fsStopBtn.classList.add('active');
        } else {
            fsPlayBtn.style.display = 'inline-block';
            fsStopBtn.style.display = 'none';
            fsStopBtn.classList.remove('active');
        }
    }

    // Mostrar/ocultar controles de fullscreen
    function onFullscreenChange() {
        if (fsControls) {
            if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
                fsControls.style.display = 'flex';
            } else {
                fsControls.style.display = 'none';
            }
        }
    }

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange', onFullscreenChange);
    document.addEventListener('MSFullscreenChange', onFullscreenChange);

    if (fsPlayBtn) {
        fsPlayBtn.addEventListener('click', function () {
            if (!animRunning) {
                runAnimation();
            }
        });
    }

    if (fsStopBtn) {
        fsStopBtn.addEventListener('click', function () {
            stopAnimation();
        });
    }

    var fsExitBtn = document.getElementById('fs-exit');
    if (fsExitBtn) {
        fsExitBtn.addEventListener('click', function () {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        });
    }

    // =============================================
    // DESCARGAR JSON CON TODA LA DATA DEL MAPA
    // =============================================
    function generateMapJSON() {
        var nodes = {};
        var elements = getMapElements();
        var connections = getMapConnections();

        // Recopilar todos los nodos
        elements.forEach(function (el) {
            if (el.data && el.data.id && !el.data.source) {
                nodes[el.data.id] = {
                    id: el.data.id,
                    label: el.data.label || '',
                    type: el.data.type || 'tool',
                    url: el.data.url || null,
                    info: null,
                    connections: {
                        parent: [],
                        children: [],
                        secondary: []
                    }
                };
            }
        });

        // Agregar la info de NODE_INFO
        Object.keys(NODE_INFO).forEach(function (nodeId) {
            if (nodes[nodeId]) {
                // Extraer texto plano del HTML
                var tempDiv = document.createElement('div');
                tempDiv.innerHTML = NODE_INFO[nodeId];
                nodes[nodeId].info = tempDiv.textContent.trim().replace(/\s+/g, ' ');
                nodes[nodeId].infoHTML = NODE_INFO[nodeId];
            }
        });

        // Procesar conexiones de getMapElements (root -> categorías, categorías -> hijos)
        elements.forEach(function (el) {
            if (el.data && el.data.source && el.data.target) {
                var src = el.data.source;
                var tgt = el.data.target;
                var type = el.data.type || 'primary';
                if (nodes[src]) {
                    nodes[src].connections.children.push({ id: tgt, type: type });
                }
                if (nodes[tgt]) {
                    nodes[tgt].connections.parent.push({ id: src, type: type });
                }
            }
        });

        // Procesar conexiones de getMapConnections
        connections.forEach(function (el) {
            if (el.data && el.data.source && el.data.target) {
                var src = el.data.source;
                var tgt = el.data.target;
                var type = el.data.type || 'primary';

                if (type === 'secondary') {
                    if (nodes[src]) {
                        nodes[src].connections.secondary.push(tgt);
                    }
                    if (nodes[tgt]) {
                        nodes[tgt].connections.secondary.push(src);
                    }
                } else {
                    if (nodes[src]) {
                        nodes[src].connections.children.push({ id: tgt, type: type });
                    }
                    if (nodes[tgt]) {
                        nodes[tgt].connections.parent.push({ id: src, type: type });
                    }
                }
            }
        });

        // Eliminar duplicados en secondary
        Object.keys(nodes).forEach(function (nodeId) {
            nodes[nodeId].connections.secondary = [...new Set(nodes[nodeId].connections.secondary)];
        });

        return {
            exportDate: new Date().toISOString(),
            totalNodes: Object.keys(nodes).length,
            categories: categoryOrder,
            categoryChildren: categoryChildrenMap,
            config: CONFIG,
            nodes: nodes
        };
    }

    document.getElementById('download-json').addEventListener('click', function () {
        var data = generateMapJSON();
        var jsonStr = JSON.stringify(data, null, 2);
        var blob = new Blob([jsonStr], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'mapa_herramientas_data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // =============================================
    // BUSCADOR DE NODOS
    // =============================================
    var searchInput = document.getElementById('search-input');
    var searchResults = document.getElementById('search-results');

    // Construir índice de búsqueda con label + info texto plano
    var searchIndex = [];
    cy.nodes().forEach(function (node) {
        var nodeId = node.id();
        var label = node.data('label') || '';
        var infoText = '';
        if (NODE_INFO[nodeId]) {
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = NODE_INFO[nodeId];
            infoText = tempDiv.textContent.trim();
        }
        searchIndex.push({
            id: nodeId,
            label: label,
            infoText: infoText,
            searchText: (label + ' ' + infoText).toLowerCase()
        });
    });

    function performSearch(query) {
        if (!query || query.length < 2) {
            searchResults.classList.remove('visible');
            searchResults.innerHTML = '';
            return;
        }

        var q = query.toLowerCase();
        var matches = searchIndex.filter(function (item) {
            return item.searchText.indexOf(q) !== -1;
        }).slice(0, 10); // Máximo 10 resultados

        if (matches.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item"><span style="color:rgba(255,255,255,0.5);">Sin resultados</span></div>';
            searchResults.classList.add('visible');
            return;
        }

        searchResults.innerHTML = '';
        matches.forEach(function (match) {
            var item = document.createElement('div');
            item.className = 'search-result-item';

            // Extraer un fragmento de info relevante
            var snippet = '';
            if (match.infoText) {
                var idx = match.infoText.toLowerCase().indexOf(q);
                if (idx !== -1) {
                    var start = Math.max(0, idx - 30);
                    var end = Math.min(match.infoText.length, idx + q.length + 50);
                    snippet = (start > 0 ? '...' : '') + match.infoText.substring(start, end) + (end < match.infoText.length ? '...' : '');
                } else {
                    snippet = match.infoText.substring(0, 80) + (match.infoText.length > 80 ? '...' : '');
                }
            }

            item.innerHTML = '<div class="result-label">' + match.label + '</div>' +
                (snippet ? '<div class="result-info">' + snippet + '</div>' : '');

            item.addEventListener('click', function () {
                navigateToNode(match.id);
                searchInput.value = '';
                searchResults.classList.remove('visible');
                searchResults.innerHTML = '';
            });

            searchResults.appendChild(item);
        });

        searchResults.classList.add('visible');
    }

    function navigateToNode(nodeId) {
        var node = cy.getElementById(nodeId);
        if (!node.length) return;

        // Limpiar estados previos
        cy.elements().removeClass('highlighted faded');
        cy.nodes().removeStyle('border-color border-width');

        // Highlight del nodo encontrado
        node.style({
            'border-color': '#00ffff',
            'border-width': '5px'
        });

        // Centrar cámara en el nodo
        cy.stop();
        cy.animate({
            fit: { eles: node, padding: 200 },
            duration: 800,
            easing: 'ease-in-out'
        });

        // Mostrar info del nodo
        var nodeInfo = NODE_INFO[nodeId];
        if (nodeInfo) {
            infoBox.innerHTML = nodeInfo;
            infoBox.style.display = 'block';
            setTimeout(function () {
                infoBox.style.opacity = 1;
            }, 10);
        }

        // Quitar highlight después de 3 segundos
        setTimeout(function () {
            node.removeStyle('border-color border-width');
        }, 3000);
    }

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            performSearch(this.value);
        });

        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                searchResults.classList.remove('visible');
                searchResults.innerHTML = '';
                searchInput.blur();
            }
            if (e.key === 'Enter') {
                var firstResult = searchResults.querySelector('.search-result-item');
                if (firstResult) {
                    firstResult.click();
                }
            }
        });

        // Cerrar resultados al hacer clic fuera
        document.addEventListener('click', function (e) {
            if (!e.target.closest('#search-container')) {
                searchResults.classList.remove('visible');
            }
        });
    }

    // =============================================
    // DEBUG MODAL & FPS COUNTER
    // =============================================
    let showDebug = false;
    let lastTime = performance.now();
    let frameCount = 0;
    let fps = 0;

    const debugModal = document.createElement('div');
    debugModal.id = 'debug-modal';
    debugModal.innerHTML = `
        <h4>Debug Info</h4>
        <div class="debug-item"><span>FPS:</span> <span id="debug-fps" class="debug-value">0</span></div>
        <div class="debug-item"><span>Nodos:</span> <span class="debug-value">${cy.nodes().length}</span></div>
        <div class="debug-item"><span>Edges:</span> <span class="debug-value">${cy.edges().length}</span></div>
    `;
    document.body.appendChild(debugModal);

    const fpsDisplay = document.getElementById('debug-fps');

    function updateFPS() {
        const now = performance.now();
        frameCount++;
        
        if (now - lastTime >= 1000) {
            fps = Math.round((frameCount * 1000) / (now - lastTime));
            if (showDebug && fpsDisplay) {
                fpsDisplay.textContent = fps;
                // Color coding for performance
                if (fps < 30) fpsDisplay.style.color = '#ff4444';
                else if (fps < 50) fpsDisplay.style.color = '#ffff00';
                else fpsDisplay.style.color = '#00ff00';
            }
            frameCount = 0;
            lastTime = now;
        }
        
        requestAnimationFrame(updateFPS);
    }

    updateFPS();

    document.addEventListener('keydown', function(e) {
        if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            // No activar si el foco está en un input
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
                return;
            }
            
            showDebug = !showDebug;
            debugModal.style.display = showDebug ? 'block' : 'none';
        }
    });

    // Ya no es necesario ocultarlos manualmente, está en el stylesheet
});
