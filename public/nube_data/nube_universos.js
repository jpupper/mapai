import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG, loadSpaceConfig } from './config.js';
import { Planet } from './Planet.js';
import { Connection } from './Connection.js';
import { CameraController } from './CameraController.js';
import { EnergyParticleSystem } from './EnergyParticleSystem.js';
import { GameManager } from './GameManager.js';
import { PlanetVisitorManager } from './PlanetVisitorManager.js';

const CFG = CONFIG;
const CAT_COLORS = CFG.categoryColors;

// ═══════════════════════════════════════════════
//  CLASS: Universe (main application)
// ═══════════════════════════════════════════════
class Universe {
    constructor() {
        this.scene = null; this.camera = null; this.renderer = null;
        this.cam = null; this.raycaster = null; this.mouse = null;
        this.clock = null; this.animTime = 0;
        this.DATA = null; this.categories = []; this.currentCatIndex = 0;
        this.planets = new Map(); this.meshToPlanet = new Map(); this.allMeshes = [];
        this.activePlanet = null;
        this.categoryGroups = {};
        this.connections = []; this.sunLines = [];
        this.allLabelSprites = []; this.labelsVisible = false;
        this.starPoints = null; this.starBaseSizes = null;
        this.starTwinklePhases = null; this.starTwinkleSpeeds = null;
        this.sunMesh = null; this.sunPlanet = null;
        this.particles = null;
        this.currentView = 'global';
        this.showAllConnections = (CFG.game && CFG.game.showConnections) || false;
        this.shipAimedLines = []; this.shipHoveredMesh = null;
        this.keys = { w: false, s: false, a: false, d: false, q: false, e: false, shift: false, space: false };
        this.hoveredPlanet = null; this.tooltip = null;
        this._orbitalWarping = false;
        this._clickTimer = null;
        this._shipTraceConnections = [];
        this._mouseDownPos = { x: 0, y: 0 };
        this._isDrag = false;
        this.shipModel = null;
        this.game = null;
        this.pvGame = null;
        this.THREE = THREE;
    }

    async init() {
        this.clock = new THREE.Clock();
        const resp = await fetch(CFG.dataUrl);
        this.DATA = await resp.json();
        if (this.DATA.config) {
            // Merge per-category distances from nodes_data.json only if space-config didn't already set them
            if (this.DATA.config.categoryDistancesMain && !CFG.categoryDistancesMain) {
                CFG.categoryDistancesMain = this.DATA.config.categoryDistancesMain;
            } else if (this.DATA.config.categoryDistancesMain) {
                // Merge: space-config values take priority, fill missing keys from nodes_data.json
                CFG.categoryDistancesMain = { ...this.DATA.config.categoryDistancesMain, ...CFG.categoryDistancesMain };
            }
            if (this.DATA.config.categoryDistances && !CFG.categoryDistances) {
                CFG.categoryDistances = this.DATA.config.categoryDistances;
            } else if (this.DATA.config.categoryDistances) {
                CFG.categoryDistances = { ...this.DATA.config.categoryDistances, ...CFG.categoryDistances };
            }

            // Optionally merge other global config fields if they exist
            const fields = ['rootNodeSize', 'primaryNodeSize', 'secondaryNodeSize', 'nodeFontSize', 'categoryFontSize', 'rootFontSize', 'primaryDistance', 'secondaryNodeDist'];
            fields.forEach(f => {
                if (this.DATA.config[f] !== undefined) {
                    // Map these to their corresponding CFG structure if necessary
                    // For now, most of these are just being used in admin.js but let's make them available
                    CFG[f] = this.DATA.config[f];
                }
            });
        }
        this.categories = this.DATA.categories;

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(CFG.scene.fogColor, CFG.scene.fogDensity);

        this.camera = new THREE.PerspectiveCamera(CFG.camera.fov, innerWidth / innerHeight, CFG.camera.near, CFG.camera.far);
        const ip = CFG.camera.initialPosition;
        this.camera.position.set(ip.x, ip.y, ip.z);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(innerWidth, innerHeight);
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = CFG.scene.toneExposure;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        this.cam = new CameraController(this.camera, this.renderer, CFG);
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.scene.add(new THREE.AmbientLight(CFG.scene.ambientColor, CFG.scene.ambientIntensity));
        // Directional lights so planets show 3D spherical shading
        const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight1.position.set(1, 1, 1).normalize();
        this.scene.add(dirLight1);
        const dirLight2 = new THREE.DirectionalLight(0x8899ff, 0.5);
        dirLight2.position.set(-1, -0.5, -1).normalize();
        this.scene.add(dirLight2);
        this.particles = new EnergyParticleSystem(this.scene);

        this.createStarfield();
        this.buildCentralSun();
        Universe._buildNoisePool();
        await this.buildUniverses();
        this.buildConnections();
        this.buildSunConnections();
        this.buildCategoryDots();
        // Start at center (Arte Generativo) — not a category
        this.currentCatIndex = -1;
        document.getElementById('cat-label-text').textContent = 'Arte Generativo y Código con IA';
        document.getElementById('cat-label-text').style.color = '#' + new THREE.Color(CFG.sun.color).getHexString();
        document.getElementById('cat-count-text').textContent = `${this.categories.length} universos`;
        this.cam.goHome(true);

        this.loadShipModel();
        this.game = new GameManager(this);
        this.game.bindUI();
        this.pvGame = new PlanetVisitorManager(this);
        this.pvGame.bindUI();
        this.bindEvents();
        this.showSplash();
        this.animate();
    }

    registerPlanet(p) { this.planets.set(p.id, p); this.meshToPlanet.set(p.mesh, p); this.allMeshes.push(p.mesh); }
    getPlanetByMesh(m) { return this.meshToPlanet.get(m) || null; }
    getPlanetById(id) { return this.planets.get(id) || null; }
    isShipMode() { return this.currentView === 'ship' || this.currentView === 'shipCabin'; }

    toggleShipCabin() {
        if (this.currentView === 'ship') {
            this.setViewMode('shipCabin');
        } else if (this.currentView === 'shipCabin') {
            this.setViewMode('ship');
        }
    }

    // ── Load Ship Model ──
    loadShipModel() {
        const loader = new GLTFLoader();
        loader.load('assets/scene.gltf', (gltf) => {
            this.shipModel = gltf.scene;
            this.shipModel.scale.set(15, 15, 15);
            this.shipModel.visible = false;
            // Key light (warm white, from above-front)
            const keyLight = new THREE.DirectionalLight(0xffeedd, 3.0);
            keyLight.position.set(5, 10, 10);
            this.shipModel.add(keyLight);
            // Fill light (cool, from below-side to soften shadows)
            const fillLight = new THREE.DirectionalLight(0xaaccff, 1.0);
            fillLight.position.set(-5, -3, -5);
            this.shipModel.add(fillLight);
            // Point light close to ship for ambient glow
            const ambientPoint = new THREE.PointLight(0xffffff, 1.5, 80);
            ambientPoint.position.set(0, 5, 0);
            this.shipModel.add(ambientPoint);
            // Preserve original textures — only tweak envMapIntensity for better PBR
            // Also disable frustumCulling so model renders when child of camera
            this.shipModel.traverse((child) => {
                child.frustumCulled = false;
                if (child.isMesh && child.material) {
                    child.material.envMapIntensity = 0.4;
                    child.material.needsUpdate = true;
                }
            });
            this.scene.add(this.shipModel);
            this.cam.shipModel = this.shipModel;

            // FIX: If already in ship mode when model finishes loading, attach it now
            if (this.currentView === 'ship') {
                this.cam.initShipWithModel(true);
            }
        }, undefined, (err) => {
            console.warn('Could not load ship model:', err);
        });
    }

    // ── Active Planet ──
    setActivePlanet(planet) {
        if (this.activePlanet) this.activePlanet.deactivate();
        this.activePlanet = planet;
        if (planet) {
            planet.activate();
            this.updateSelectionIndicator(planet);
            this.updateActiveConnections(true);
            if (!this.pvGame || this.pvGame.state === 'idle') this.particles.spawn(planet);
        } else {
            this.hideSelectionIndicator();
            this.updateActiveConnections();
        }
    }

    clearActivePlanet() {
        if (this.activePlanet) this.activePlanet.deactivate();
        this.activePlanet = null;
        this.hideSelectionIndicator();
        this.updateActiveConnections();
    }

    // ── Connection Visibility ──
    updateActiveConnections(triggerTrace = false) {
        const C = CFG.connections;
        const active = this.activePlanet;

        if (this.showAllConnections) {
            // CONEXIONES ON — render ALL connections
            this.connections.forEach(conn => {
                conn.show();
                conn.setOpacity(conn.type === 'primary' ? C.primaryActiveOpacity : C.secondaryActiveOpacity);
                if (active && conn.involvesPlanet(active)) {
                    if (triggerTrace && !conn.tracing) {
                        conn.setOpacity(conn.type === 'primary' ? C.primaryActiveOpacity : C.secondaryActiveOpacity);
                        conn.startTrace(this.scene, active);
                    }
                    conn.showGlow(this.scene);
                } else {
                    conn.hideGlow();
                }
            });
        } else if (active) {
            // CONEXIONES OFF + active planet — only render connections involving active planet
            this.connections.forEach(conn => {
                if (conn.involvesPlanet(active)) {
                    conn.show();
                    conn.setOpacity(conn.type === 'primary' ? C.primaryActiveOpacity : C.secondaryActiveOpacity);
                    if (triggerTrace && !conn.tracing) {
                        conn.startTrace(this.scene, active);
                    }
                    conn.showGlow(this.scene);
                } else {
                    conn.hide();
                }
            });
        } else {
            // CONEXIONES OFF + no active planet — hide all connections
            this.connections.forEach(conn => {
                conn.hide();
            });
        }
    }

    // ── Starfield ──
    createStarfield() {
        const S = CFG.stars; const count = S.count;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            const r = S.minDistance + Math.random() * (S.maxDistance - S.minDistance);
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);
            const b = 0.3 + Math.random() * 0.7; const t = Math.random();
            colors[i * 3] = b * (0.8 + t * 0.2); colors[i * 3 + 1] = b * (0.85 + t * 0.15); colors[i * 3 + 2] = b;
            sizes[i] = S.sizeMin + Math.random() * S.sizeRandom;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        const mat = new THREE.PointsMaterial({ size: S.baseSize, vertexColors: true, transparent: true, opacity: S.opacity, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false });
        this.starPoints = new THREE.Points(geo, mat);
        this.scene.add(this.starPoints);
        this.starBaseSizes = new Float32Array(sizes);
        this.starTwinklePhases = new Float32Array(count);
        this.starTwinkleSpeeds = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            this.starTwinklePhases[i] = Math.random() * Math.PI * 2;
            this.starTwinkleSpeeds[i] = S.twinkleSpeedMin + Math.random() * S.twinkleSpeedRandom;
        }
    }

    // ── Central Sun ──
    buildCentralSun() {
        const S = CFG.sun;
        const sunGroup = new THREE.Group();
        sunGroup.position.set(0, 0, 0);
        this.scene.add(sunGroup);
        const sunGeo = new THREE.SphereGeometry(S.radius, 64, 64);
        const sunMat = new THREE.MeshStandardMaterial({ color: S.color, emissive: S.emissiveColor, emissiveIntensity: S.emissiveIntensity, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.95 });
        this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
        sunGroup.add(this.sunMesh);
        sunGroup.add(new THREE.Mesh(new THREE.SphereGeometry(S.glowInnerRadius, 32, 32), new THREE.MeshBasicMaterial({ color: S.color, transparent: true, opacity: 0.12, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));
        sunGroup.add(new THREE.Mesh(new THREE.SphereGeometry(S.glowOuterRadius, 24, 24), new THREE.MeshBasicMaterial({ color: S.emissiveColor, transparent: true, opacity: 0.05, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));
        sunGroup.add(new THREE.PointLight(S.color, S.lightIntensity, S.lightRange, 1));
        const rootNode = this.DATA.nodes['root'] || { id: 'root', label: 'Arte Generativo y Código con IA', type: 'root' };
        this.sunPlanet = new Planet(this.sunMesh, rootNode, null);
        this.registerPlanet(this.sunPlanet);
        const label = this.createTextSprite('Arte Generativo', S.color, S.labelFontSize);
        label.position.set(0, S.radius + 20, 0); label.visible = false;
        sunGroup.add(label);
        this.allLabelSprites.push(label);
    }

    buildSunConnections() {
        const sunColor = new THREE.Color(CFG.sun.color);
        this.categories.forEach(catId => {
            const catObj = this.categoryGroups[catId];
            if (!catObj) return;
            const catPos = catObj.group.position.clone();
            const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), catPos]);
            const lineMat = new THREE.LineBasicMaterial({ color: sunColor, transparent: true, opacity: CFG.connections.sunLineOpacity, blending: THREE.AdditiveBlending, depthWrite: false });
            const line = new THREE.Line(lineGeo, lineMat);
            this.scene.add(line);
            this.sunLines.push(line);
        });
    }

    createTextSprite(text, color, fontSize = 14) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const font = `${fontSize * 4}px Outfit, sans-serif`;
        ctx.font = font;
        const tw = ctx.measureText(text).width;
        canvas.width = tw + 40; canvas.height = fontSize * 6;
        ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const c = new THREE.Color(color);
        ctx.shadowColor = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
        ctx.shadowBlur = 20; ctx.fillStyle = '#ffffff';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        const texture = new THREE.CanvasTexture(canvas); texture.needsUpdate = true;
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(canvas.width / 8, canvas.height / 8, 1);
        return sprite;
    }

    // ── Build Universes ──
    async buildUniverses() {
        const catCount = this.categories.length;
        const N = CFG.nucleus; const P = CFG.planet; const O = CFG.orbit;
        const ringRadius = CFG.layout.ringRadius;

        for (let i = 0; i < this.categories.length; i++) {
            const catId = this.categories[i];
            const node = this.DATA.nodes[catId]; if (!node) continue;
            const angle = (i / catCount) * Math.PI * 2 - Math.PI / 2;

            // Use per-category distance from sun if available, else fallback to global ringRadius
            const currentRingRadius = (CFG.categoryDistancesMain && CFG.categoryDistancesMain[catId]) || ringRadius;
            const cx = Math.cos(angle) * currentRingRadius; const cz = Math.sin(angle) * currentRingRadius;
            const zMin = CFG.layout.categoryZMin !== undefined ? CFG.layout.categoryZMin : -2000;
            const zMax = CFG.layout.categoryZMax !== undefined ? CFG.layout.categoryZMax : 2000;
            const randomZ = zMin + Math.random() * (zMax - zMin);
            const group = new THREE.Group(); group.position.set(cx, randomZ, cz);
            this.scene.add(group);
            const color = new THREE.Color(CAT_COLORS[catId] || 0xffffff);

            const nucleusGeo = new THREE.SphereGeometry(N.radius, 48, 48);
            const nucleusMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: N.emissiveIntensity, roughness: 0.3, metalness: 0.2, transparent: true, opacity: 0.92 });
            const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
            group.add(nucleus);
            group.add(new THREE.Mesh(new THREE.SphereGeometry(N.glowInnerRadius, 32, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));
            group.add(new THREE.Mesh(new THREE.SphereGeometry(N.glowOuterRadius, 24, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.03, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));
            group.add(new THREE.PointLight(color, N.lightIntensity, N.lightRange, 1.5));

            const nucleusPlanet = new Planet(nucleus, node, null);
            this.registerPlanet(nucleusPlanet);

            const catLabel = this.createTextSprite(node.label || catId, CAT_COLORS[catId] || 0xffffff, N.labelFontSize);
            catLabel.position.set(0, N.labelOffsetY, 0); catLabel.visible = false;
            group.add(catLabel); this.allLabelSprites.push(catLabel);

            const planetMeshes = [];
            const children = this.DATA.categoryChildren[catId] || [];
            const childCount = children.length;

            children.forEach((childId, ci) => {
                const childNode = this.DATA.nodes[childId]; if (!childNode) return;

                // Use per-category planet orbit radius if available, else fallback to default orbit formula
                let orbitRadius;
                if (CFG.categoryDistances && CFG.categoryDistances[catId]) {
                    orbitRadius = CFG.categoryDistances[catId] + (ci % 3) * O.radiusStep + (Math.random() - 0.5) * O.radiusRandom;
                } else {
                    orbitRadius = O.baseRadius + (ci % 3) * O.radiusStep + Math.random() * O.radiusRandom;
                }
                const goldenRatio = (1 + Math.sqrt(5)) / 2;
                const theta = (2 * Math.PI * ci) / goldenRatio + (Math.random() - 0.5) * 0.8;
                const basePhi = Math.acos(1 - (2 * (ci + 0.5)) / childCount);
                const phi = basePhi + (Math.random() - 0.5) * 0.6;
                const orbitAngle = theta;
                const orbitTilt = phi - Math.PI / 2;
                const px = Math.sin(phi) * Math.cos(theta) * orbitRadius;
                const py = Math.cos(phi) * orbitRadius;
                const pz = Math.sin(phi) * Math.sin(theta) * orbitRadius;

                const pGeo = new THREE.SphereGeometry(P.radius, 32, 32);
                const pColor = color.clone().lerp(new THREE.Color(0xffffff), P.colorLerpToWhite);
                const texSeed = Math.abs((childId.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 2654435761) | 0);
                const pTex = this._makePlanetTexture(pColor, texSeed);
                const pMat = new THREE.MeshStandardMaterial({
                    map: pTex,
                    emissive: pColor,
                    emissiveIntensity: P.emissiveIntensity * 0.25,
                    roughness: 0.6,
                    metalness: 0.05,
                    transparent: true,
                    opacity: 0.95
                });
                const planetMesh = new THREE.Mesh(pGeo, pMat); planetMesh.position.set(px, py, pz);
                group.add(planetMesh);
                planetMesh.add(new THREE.Mesh(new THREE.SphereGeometry(P.glowRadius, 16, 16), new THREE.MeshBasicMaterial({ color: pColor, transparent: true, opacity: 0.06, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));

                // Invisible hitbox sphere (2x radius) for easier raycasting
                const hitGeo = new THREE.SphereGeometry(P.radius * 2, 8, 8);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                planetMesh.add(hitMesh);

                planetMesh.userData = { orbitRadius, orbitSpeed: O.speedMin + Math.random() * O.speedRandom, orbitOffset: orbitAngle, orbitTilt, parentGroup: group, categoryId: catId, selfRotSpeed: 0.08 + Math.random() * 0.22 };

                const pLabel = this.createTextSprite(childNode.label || childId, CAT_COLORS[catId] || 0xffffff, P.labelFontSize);
                pLabel.position.set(0, P.labelOffsetY, 0); pLabel.visible = false;
                planetMesh.add(pLabel); this.allLabelSprites.push(pLabel);

                const childPlanet = new Planet(planetMesh, childNode, catId);
                this.registerPlanet(childPlanet);
                // Register hitbox mesh too so raycast hits resolve to this planet
                this.meshToPlanet.set(hitMesh, childPlanet);
                this.allMeshes.push(hitMesh);
                planetMeshes.push(planetMesh);
            });

            const ring = new THREE.Mesh(new THREE.RingGeometry(O.ringInner, O.ringOuter, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.06, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
            ring.rotation.x = -Math.PI / 2; group.add(ring);
            this.categoryGroups[catId] = { group, nucleus, planets: planetMeshes, color };
            if (window._loadingScreen) window._loadingScreen.setProgress(5 + Math.round((i + 1) / catCount * 85));
            await new Promise(r => setTimeout(r, 0));
        }
    }

    // ── Procedural Planet Texture ──
    // Strategy: pre-generate a small pool of grayscale noise canvases (cheap, done once).
    // Per planet: pick a pool slot by seed, then tint it with the planet color in a fast
    // pixel-multiply pass. Total cost per planet ≈ 1 canvas draw call, not a full FBM run.

    static _buildNoisePool() {
        if (Universe._noisePool) return;   // already built
        const T = CFG.planetTexture;
        const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
        const size = isMobile ? 256 : (T.size || 512);
        const oct = isMobile ? 4 : Math.round(T.octaves);
        const scale = T.noiseScale;
        const POOL = 6;   // number of distinct noise patterns
        // Fixed seeds so the pool is always the same across page loads
        const SEEDS = [0x1A2B3C, 0x4D5E6F, 0x7A8B9C, 0xABCDEF, 0x112233, 0x998877];

        const lerp = (a, b, t) => a + (t * t * (3 - 2 * t)) * (b - a);
        const makeNoise3 = (seed) => (x, y, z) => {
            const h3 = (ix, iy, iz) => {
                let h = (ix * 374761393 + iy * 668265263 + iz * 2147483647) ^ seed;
                h = (h ^ (h >>> 13)) * 1274126177;
                return ((h ^ (h >>> 16)) & 0x7fffffff) / 0x7fffffff;
            };
            const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
            const fx = x - ix, fy = y - iy, fz = z - iz;
            const ux = fx * fx * (3 - 2 * fx);
            const uy = fy * fy * (3 - 2 * fy);
            const uz = fz * fz * (3 - 2 * fz);
            return lerp(
                lerp(lerp(h3(ix, iy, iz), h3(ix + 1, iy, iz), ux), lerp(h3(ix, iy + 1, iz), h3(ix + 1, iy + 1, iz), ux), uy),
                lerp(lerp(h3(ix, iy, iz + 1), h3(ix + 1, iy, iz + 1), ux), lerp(h3(ix, iy + 1, iz + 1), h3(ix + 1, iy + 1, iz + 1), ux), uy),
                uz
            );
        };
        const fbm3 = (noise3, x, y, z) => {
            let v = 0, amp = 0.5, freq = 1, max = 0;
            for (let i = 0; i < oct; i++) {
                v += noise3(x * freq, y * freq, z * freq) * amp;
                max += amp; amp *= 0.5; freq *= 2.1;
            }
            return v / max;
        };

        Universe._noisePool = [];
        Universe._noisePoolSize = size;

        for (let p = 0; p < POOL; p++) {
            const noise3 = makeNoise3(SEEDS[p]);
            const brightness = new Float32Array(size * size); // normalised 0-1 per pixel
            const samples = new Float32Array(size * size);
            for (let py = 0; py < size; py++) {
                for (let px = 0; px < size; px++) {
                    const u = px / size;
                    const v = py / size;
                    const theta = u * Math.PI * 2;
                    const phi = v * Math.PI;
                    const sx = Math.sin(phi) * Math.cos(theta) * scale;
                    const sy = Math.sin(phi) * Math.sin(theta) * scale;
                    const sz = Math.cos(phi) * scale;
                    samples[py * size + px] = fbm3(noise3, sx, sy, sz);
                }
            }
            let nMin = Infinity, nMax = -Infinity;
            for (let i = 0; i < samples.length; i++) {
                if (samples[i] < nMin) nMin = samples[i];
                if (samples[i] > nMax) nMax = samples[i];
            }
            const nRange = nMax - nMin || 1;
            const contrast = T.contrast;
            for (let i = 0; i < samples.length; i++) {
                const n01 = (samples[i] - nMin) / nRange;
                const nc = n01 * n01 * (3 - 2 * n01);
                brightness[i] = contrast !== 1.0 ? Math.pow(nc, 1.0 / contrast) : nc;
            }
            Universe._noisePool.push(brightness);
        }
    }

    _makePlanetTexture(baseColor, seed) {
        const T = CFG.planetTexture;
        const cacheKey = `${baseColor.getHexString()}_${seed % 6}`; // slot 0-5 + color
        if (Universe._texCache.has(cacheKey)) return Universe._texCache.get(cacheKey);

        Universe._buildNoisePool();
        const size = Universe._noisePoolSize;
        const brightness = Universe._noisePool[seed % 6];
        const darkBase = T.darkBase;
        const brightRange = T.brightRange;
        const r = baseColor.r, g = baseColor.g, b = baseColor.b;

        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(size, size);
        const d = imgData.data;

        for (let i = 0; i < brightness.length; i++) {
            const bright = darkBase + brightness[i] * brightRange;
            const pi = i * 4;
            d[pi] = Math.min(255, Math.max(0, Math.round(r * 255 * bright)));
            d[pi + 1] = Math.min(255, Math.max(0, Math.round(g * 255 * bright)));
            d[pi + 2] = Math.min(255, Math.max(0, Math.round(b * 255 * bright)));
            d[pi + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        Universe._texCache.set(cacheKey, tex);
        return tex;
    }

    // ── Connections ──
    buildConnections() {
        const C = CFG.connections;
        this.categories.forEach(catId => {
            const catObj = this.categoryGroups[catId]; if (!catObj) return;
            const nucleusPlanet = this.getPlanetById(catId); if (!nucleusPlanet) return;
            catObj.planets.forEach(pMesh => {
                const childPlanet = this.getPlanetByMesh(pMesh); if (!childPlanet) return;
                const sp = nucleusPlanet.getWorldPosition(); const tp = childPlanet.getWorldPosition();
                const lineGeo = new THREE.BufferGeometry().setFromPoints([sp, tp]);
                const lineMat = new THREE.LineBasicMaterial({ color: catObj.color, transparent: true, opacity: C.primaryOpacity, blending: THREE.AdditiveBlending, depthWrite: false });
                const line = new THREE.Line(lineGeo, lineMat);
                this.scene.add(line);
                this.connections.push(new Connection(line, nucleusPlanet, childPlanet, 'primary', catObj.color));
            });
        });

        Object.values(this.DATA.nodes).forEach(node => {
            if (!node.connections || !node.connections.secondary) return;
            const secondaries = node.connections.secondary;
            if (!Array.isArray(secondaries) || secondaries.length === 0) return;
            const sourcePlanet = this.getPlanetById(node.id); if (!sourcePlanet) return;
            secondaries.forEach(targetId => {
                const targetPlanet = this.getPlanetById(targetId); if (!targetPlanet) return;
                const sp = sourcePlanet.getWorldPosition(); const tp = targetPlanet.getWorldPosition();
                const lineGeo = new THREE.BufferGeometry().setFromPoints([sp, tp]);
                const lineMat = new THREE.LineBasicMaterial({ color: C.secondaryColor, transparent: true, opacity: C.secondaryOpacity, blending: THREE.AdditiveBlending, depthWrite: false });
                const line = new THREE.Line(lineGeo, lineMat);
                this.scene.add(line);
                this.connections.push(new Connection(line, sourcePlanet, targetPlanet, 'secondary'));
            });
        });
    }

    // ── HUD ──
    buildCategoryDots() {
        const container = document.getElementById('cat-dots');
        this.categories.forEach((catId, i) => {
            const dot = document.createElement('div'); dot.className = 'cat-dot';
            const color = new THREE.Color(CAT_COLORS[catId] || 0xffffff);
            dot.style.background = '#' + color.getHexString(); dot.style.borderColor = '#' + color.getHexString();
            const label = document.createElement('span'); label.className = 'cat-dot-label';
            const node = this.DATA.nodes[catId]; label.textContent = node ? node.label : catId;
            dot.appendChild(label);
            dot.addEventListener('click', () => this.navigateToCategory(i));
            container.appendChild(dot);
        });
    }

    updateCategoryDots() {
        document.querySelectorAll('.cat-dot').forEach((d, i) => d.classList.toggle('active', i === this.currentCatIndex));
    }

    updateCategoryDotsMode(mode) {
        const c = document.getElementById('cat-dots');
        if (c) c.classList.toggle('expanded', mode === 'camera');
    }

    // ── Navigation ──
    navigateToCategory(index, instant = false) {
        if (this.currentView === 'camera') this.setViewMode('global');
        if (this.currentView !== 'global') return;
        if (this.cam.isTransitioning && !instant) return;
        // Wrap around; -1 means "go to last", length means "go to first"
        if (index < 0) index = this.categories.length - 1;
        if (index >= this.categories.length) index = 0;
        this.currentCatIndex = index;
        const catId = this.categories[index];
        const catObj = this.categoryGroups[catId]; if (!catObj) return;
        const node = this.DATA.nodes[catId];
        const childCount = (this.DATA.categoryChildren[catId] || []).length;
        const color = new THREE.Color(CAT_COLORS[catId] || 0xffffff);
        const labelEl = document.getElementById('cat-label-text');
        labelEl.textContent = node ? node.label : catId;
        labelEl.style.color = '#' + color.getHexString();
        document.getElementById('cat-count-text').textContent = `${childCount} herramienta${childCount !== 1 ? 's' : ''} · ${index + 1}/${this.categories.length}`;
        this.updateCategoryDots();
        this.cam.navigateTo(catObj.group.position, instant);
        this.updateActiveConnections();
    }

    adjustZoom(delta) {
        if (this.currentView === 'camera') {
            // Orbital mode: adjust follow distance to zoom in/out from selected planet
            const F = this.cam.cfg.follow;
            const step = (F.zoomMax - F.zoomMin) * 0.08;
            this.cam.followDistance = Math.max(F.zoomMin, Math.min(F.zoomMax, this.cam.followDistance + delta * step * 10));
            return;
        }
        if (this.currentView !== 'global') return;
        if (!this.cam.adjustZoom(delta)) return;
        const catId = this.categories[this.currentCatIndex];
        const catObj = this.categoryGroups[catId]; if (!catObj) return;
        this.cam.navigateTo(catObj.group.position);
    }

    // ── View Mode ──
    setViewMode(mode) {
        if (mode === 'camera' && !this.activePlanet) {
            const ind = document.getElementById('selection-indicator');
            ind.classList.add('visible');
            document.getElementById('sel-planet-text').textContent = 'Seleccioná un planeta primero';
            document.getElementById('sel-category-text').textContent = '';
            setTimeout(() => { if (!this.activePlanet) ind.classList.remove('visible'); }, 2000);
            return;
        }
        const prevView = this.currentView;
        const isShipToggle = (prevView === 'ship' && mode === 'shipCabin') || (prevView === 'shipCabin' && mode === 'ship');
        this.currentView = mode;
        document.querySelectorAll('#view-mode-toggle .neon-btn').forEach(b => b.classList.remove('active'));
        if (mode === 'global') document.getElementById('btn-view-global').classList.add('active');
        else if (mode === 'camera') document.getElementById('btn-view-camera').classList.add('active');
        else if (mode === 'ship') document.getElementById('btn-view-ship').classList.add('active');
        else if (mode === 'shipCabin') document.getElementById('btn-view-ship-cabin').classList.add('active');

        const orbitHud = document.getElementById('hud');
        const shipHud = document.getElementById('ship-hud');
        const cameraHint = document.getElementById('camera-hint');
        this.updateCategoryDotsMode(mode);

        const isShipLike = (m) => m === 'ship' || m === 'shipCabin';
        if (isShipLike(prevView) && !isShipLike(mode)) {
            this.clearShipAimedLines();
            if (this.shipHoveredMesh) { const hp = this.getPlanetByMesh(this.shipHoveredMesh); if (hp) hp.unhover(); }
            this.shipHoveredMesh = null;
            this.cam.detachShipModel(this.scene);
            if (this.shipModel) this.shipModel.visible = false;
        }
        if (isShipToggle) {
            this.cam.detachShipModel(this.scene);
            if (this.shipModel) this.shipModel.visible = false;
        }

        const navArrows = document.getElementById('nav-arrows');
        const universeInd = document.getElementById('universe-indicator');
        const keyHint = document.getElementById('key-hint');

        if (mode === 'global') {
            this.cam.controls.enabled = true;
            orbitHud.style.display = ''; shipHud.classList.remove('visible');
            if (cameraHint) cameraHint.classList.remove('visible');
            if (document.pointerLockElement) document.exitPointerLock();
            // Restore cockpit elements that may have been hidden by 3rd person mode
            const cockpitFrame = document.getElementById('cockpit-frame');
            if (cockpitFrame) cockpitFrame.style.display = '';
            const crosshair = document.getElementById('ship-crosshair');
            if (crosshair) crosshair.style.display = '';
            this.clearActivePlanet(); this.closeInfoPanel(); this.particles.clear();
            this.cam.isTransitioning = false;
            // Always return to center (Arte Generativo)
            this.currentCatIndex = -1;
            document.getElementById('cat-label-text').textContent = 'Arte Generativo y Código con IA';
            document.getElementById('cat-label-text').style.color = '#' + new THREE.Color(CFG.sun.color).getHexString();
            document.getElementById('cat-count-text').textContent = `${this.categories.length} universos`;
            this.updateCategoryDots();
            this.cam.goHome();
            // Show all global HUD elements
            if (navArrows) navArrows.style.display = '';
            if (universeInd) universeInd.style.display = '';
            if (keyHint) keyHint.style.display = '';
        } else if (mode === 'camera') {
            this.cam.controls.enabled = false;
            orbitHud.style.display = ''; shipHud.classList.remove('visible');
            if (cameraHint) cameraHint.classList.add('visible');
            if (document.pointerLockElement) document.exitPointerLock();
            if (this.activePlanet) this.cam.initFollowFrom(this.activePlanet.getWorldPosition());
            // Hide prev/next and universe label, but keep +/- zoom visible
            if (universeInd) universeInd.style.display = 'none';
            if (keyHint) keyHint.style.display = 'none';
            // Rearrange nav-arrows: hide prev/next, show only zoom buttons
            if (navArrows) {
                navArrows.style.display = '';
                document.getElementById('btn-prev').style.display = 'none';
                document.getElementById('btn-next').style.display = 'none';
                document.getElementById('btn-zin').style.display = '';
                document.getElementById('btn-zout').style.display = '';
            }
        } else if (mode === 'ship') {
            this.cam.controls.enabled = false;
            orbitHud.style.display = 'none'; shipHud.classList.add('visible');
            if (cameraHint) cameraHint.classList.remove('visible');
            this.cam.initShipWithModel(isShipToggle);
            // Hide cockpit frame in 3rd person (you see the ship model instead)
            const cockpitFrame = document.getElementById('cockpit-frame');
            if (cockpitFrame) cockpitFrame.style.display = 'none';
            const crosshair = document.getElementById('ship-crosshair');
            if (crosshair) crosshair.style.display = '';
            const modeLabel = document.getElementById('ship-mode-label');
            if (modeLabel) modeLabel.textContent = 'NAVE';
            if (navArrows) navArrows.style.display = 'none';
            if (universeInd) universeInd.style.display = 'none';
            if (keyHint) keyHint.style.display = 'none';
        } else if (mode === 'shipCabin') {
            this.cam.controls.enabled = false;
            orbitHud.style.display = 'none'; shipHud.classList.add('visible');
            if (cameraHint) cameraHint.classList.remove('visible');
            if (!isShipToggle) this.cam.initShip();
            if (this.shipModel) this.shipModel.visible = false;
            // Show cockpit frame in 1st person
            const cockpitFrame = document.getElementById('cockpit-frame');
            if (cockpitFrame) cockpitFrame.style.display = '';
            const crosshair = document.getElementById('ship-crosshair');
            if (crosshair) crosshair.style.display = '';
            const modeLabel = document.getElementById('ship-mode-label');
            if (modeLabel) modeLabel.textContent = 'CABINA';
            if (navArrows) navArrows.style.display = 'none';
            if (universeInd) universeInd.style.display = 'none';
            if (keyHint) keyHint.style.display = 'none';
        }
        // Restore prev/next visibility when going back to global
        if (mode === 'global') {
            document.getElementById('btn-prev').style.display = '';
            document.getElementById('btn-next').style.display = '';
        }
    }

    // ── Info Panel ──
    showInfoPanel(node) {
        const panel = document.getElementById('info-panel');
        const content = document.getElementById('info-content');
        let html = '';
        if (node.infoHTML) html += node.infoHTML.replace(/\\n/g, '\n');
        else { html += `<h3>${node.label || node.id}</h3>`; if (node.info) html += `<p>${node.info}</p>`; }

        // Agregar la imagen del nodo
        if (!html.includes('img src="img/nodes/')) {
            html += `<div style="text-align:center; margin-top: 15px;"><img src="img/nodes/${node.id}.png" style="max-width: 100%; border-radius: 8px; border: 1px solid rgba(255, 105, 180, 0.4);" onerror="this.style.display='none'"></div>`;
        }

        if (node.url) html += `<p style="margin-top:12px"><a href="${node.url}" target="_blank">🔗 ${node.url}</a></p>`;
        const sec = node.connections?.secondary || [];
        if (sec.length > 0) {
            html += '<p style="margin-top:10px;color:rgba(255,255,255,0.45);font-size:0.78rem">Conexiones:</p>';
            sec.forEach(s => { const sn = this.DATA.nodes[s]; html += `<span class="tag">${sn ? sn.label : s}</span>`; });
        }
        content.innerHTML = html; panel.classList.add('visible');
    }

    closeInfoPanel() { document.getElementById('info-panel').classList.remove('visible'); }

    updateSelectionIndicator(planet) {
        const indicator = document.getElementById('selection-indicator');
        document.getElementById('sel-planet-text').textContent = planet.label;
        let catName = '';
        if (planet.type === 'category') catName = 'Categoría';
        else if (planet.id === 'root') catName = 'Centro del Universo';
        else if (planet.category) { const cn = this.DATA.nodes[planet.category]; catName = cn ? cn.label : planet.category; }
        document.getElementById('sel-category-text').textContent = catName;
        let color = '#fff';
        if (planet.category) color = '#' + new THREE.Color(CAT_COLORS[planet.category] || 0xffffff).getHexString();
        else if (planet.type === 'category') color = '#' + new THREE.Color(CAT_COLORS[planet.id] || 0xffffff).getHexString();
        document.getElementById('sel-planet-text').style.color = color;
        // Set CSS custom property for the spacial UI accent color
        indicator.style.setProperty('--sel-color', color);
        indicator.classList.add('visible');
    }

    hideSelectionIndicator() { document.getElementById('selection-indicator').classList.remove('visible'); }

    // ── Ship Aimed Lines (now uses trace animations) ──
    clearShipAimedLines() {
        this.shipAimedLines.forEach(l => { this.scene.remove(l); l.geometry.dispose(); l.material.dispose(); });
        this.shipAimedLines = [];
        // Stop and clean up ship trace connections
        this._shipTraceConnections.forEach(conn => {
            conn.stopTrace();
            conn.hide();
            if (conn.traceSphere) { this.scene.remove(conn.traceSphere); conn.traceSphere = null; }
            this.scene.remove(conn.line);
            conn.line.geometry.dispose(); conn.line.material.dispose();
            if (conn.glowLine) { this.scene.remove(conn.glowLine); conn.glowLine.geometry.dispose(); conn.glowLine.material.dispose(); }
        });
        this._shipTraceConnections = [];
    }

    buildShipAimedLines(planet) {
        this.clearShipAimedLines();
        const C = CFG.connections;
        // Gather target IDs: secondary connections + children (for categories)
        const targetIds = [];
        const sec = planet.node.connections?.secondary || [];
        targetIds.push(...sec);
        // If this is a category, also include its children
        const children = this.DATA.categoryChildren[planet.id] || [];
        targetIds.push(...children);
        if (targetIds.length === 0) return;
        const sp = planet.getWorldPosition();
        // Determine color for the connections
        let connColor = planet.category ? (CAT_COLORS[planet.category] || 0x00ffff) : (CAT_COLORS[planet.id] || 0x00ffff);
        targetIds.forEach(targetId => {
            const tp = this.getPlanetById(targetId); if (!tp) return;
            const tpos = tp.getWorldPosition();
            const lineGeo = new THREE.BufferGeometry().setFromPoints([sp, tpos]);
            const lineMat = new THREE.LineBasicMaterial({ color: connColor, transparent: true, opacity: C.primaryActiveOpacity, blending: THREE.AdditiveBlending, depthWrite: false, linewidth: 2 });
            const line = new THREE.Line(lineGeo, lineMat);
            this.scene.add(line);
            this.shipAimedLines.push(line);
            // Create a temporary Connection object for the trace animation
            const conn = new Connection(line, planet, tp, 'primary', connColor);
            conn.startTrace(this.scene, planet);
            this._shipTraceConnections.push(conn);
        });
    }

    updateShipRaycast(dt) {
        if (!this.isShipMode()) return;
        if (!this.tooltip) this.tooltip = document.getElementById('hover-tooltip');
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const hits = this.raycaster.intersectObjects(this.allMeshes);
        if (this.shipHoveredMesh) { const hp = this.getPlanetByMesh(this.shipHoveredMesh); if (hp && hp !== this.activePlanet) hp.unhover(); }

        const isGameMode = this.game && this.game.state === 'exploration';
        let aimedPlanet = null;

        if (hits.length > 0) {
            const mesh = hits[0].object;
            const planet = this.getPlanetByMesh(mesh);
            if (planet) {
                aimedPlanet = planet;
                planet.hover();
                if (this.shipHoveredMesh !== mesh) this.buildShipAimedLines(planet);
                this.shipHoveredMesh = mesh;
                this.tooltip.textContent = planet.label;
                this.tooltip.style.left = (innerWidth / 2 + 30) + 'px'; this.tooltip.style.top = (innerHeight / 2 - 12) + 'px';
                this.tooltip.classList.add('visible');
                if (isGameMode) {
                    this.game.showGameInfoPanel(planet.node);
                } else {
                    this.showInfoPanel(planet.node);
                }
                this.updateSelectionIndicator(planet);
                const ch = document.getElementById('ship-crosshair'); if (ch) ch.classList.add('locked');
            }
        } else {
            if (this.shipHoveredMesh) this.clearShipAimedLines();
            this.shipHoveredMesh = null;
            if (this.tooltip) this.tooltip.classList.remove('visible');
            const ch = document.getElementById('ship-crosshair'); if (ch) ch.classList.remove('locked');
            if (isGameMode) {
                this.game.hideGameInfoPanel();
            } else {
                this.closeInfoPanel();
            }
            if (!this.activePlanet) this.hideSelectionIndicator();
        }

        // Game mode: use collection system (hold crosshair on objective)
        if (isGameMode) {
            this.game.updateCollection(dt || 0.016, aimedPlanet);
        }

        // Update ship trace animations (sphere traveling along connections)
        if (this._shipTraceConnections.length > 0) {
            const dt = this.clock.getDelta ? 0.016 : 0.016;
            this._shipTraceConnections.forEach(conn => conn.updateTrace(0.016));
        }
    }

    // ── Ship Respawn ──
    checkShipRespawn() {
        const maxDist = CFG.ship.respawnDistance || 15000;
        if (this.camera.position.length() > maxDist) {
            this.cam.shipVelocity.set(0, 0, 0);
            this.cam.shipThrottle = 0;
            this.cam.shipYaw = 0;
            this.cam.shipPitch = 0;
            this.camera.position.set(0, 200, 50);
            this.showWarpFlash();
        }
    }

    // ── Events ──
    bindEvents() {
        window.addEventListener('resize', () => this.onResize());
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        this.renderer.domElement.addEventListener('click', (e) => this.onClick(e));
        this.renderer.domElement.addEventListener('dblclick', (e) => this.onDoubleClick(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mouseup', () => this.onMouseUp());

        document.getElementById('btn-prev').addEventListener('click', (e) => { e.stopPropagation(); this.navigateToCategory(this.currentCatIndex - 1); });
        document.getElementById('btn-next').addEventListener('click', (e) => { e.stopPropagation(); this.navigateToCategory(this.currentCatIndex + 1); });
        document.getElementById('btn-zin').addEventListener('click', (e) => { e.stopPropagation(); this.adjustZoom(-CFG.camera.zoomStep); });
        document.getElementById('btn-zout').addEventListener('click', (e) => { e.stopPropagation(); this.adjustZoom(CFG.camera.zoomStep); });
        document.getElementById('info-close').addEventListener('click', () => this.closeInfoPanel());

        document.getElementById('btn-view-home').addEventListener('click', () => {
            this.setViewMode('global');
            const splash = document.getElementById('splash-screen');
            if (splash) splash.classList.add('visible');
        });
        document.getElementById('btn-view-global').addEventListener('click', () => this.setViewMode('global'));
        document.getElementById('btn-view-camera').addEventListener('click', () => this.setViewMode('camera'));
        document.getElementById('btn-view-ship').addEventListener('click', () => this.setViewMode('ship'));
        document.getElementById('btn-view-ship-cabin').addEventListener('click', () => this.setViewMode('shipCabin'));

        document.getElementById('btn-show-connections').addEventListener('click', () => {
            this.showAllConnections = !this.showAllConnections;
            const btn = document.getElementById('btn-show-connections');
            btn.classList.toggle('active', this.showAllConnections);
            btn.textContent = this.showAllConnections ? 'Conexiones ON' : 'Conexiones OFF';
            this.updateActiveConnections();
        });

        document.addEventListener('pointerlockchange', () => {
            this.cam.pointerLocked = document.pointerLockElement === this.renderer.domElement;
        });

        this.renderer.domElement.addEventListener('wheel', (e) => {
            if (this.currentView === 'global') { e.preventDefault(); this.adjustZoom(e.deltaY > 0 ? 0.1 : -0.1); }
            else if (this.currentView === 'camera') { e.preventDefault(); this.cam.followDistance = Math.max(20, Math.min(300, this.cam.followDistance + (e.deltaY > 0 ? 5 : -5))); }
        }, { passive: false });
    }

    onResize() {
        this.camera.aspect = innerWidth / innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(innerWidth, innerHeight);
    }

    onKeyDown(e) {
        const k = e.key.toLowerCase();

        // Block ALL input when discovery modal is open
        if (this.game && this.game._discoveryModalOpen) return;

        if (k === 'w') this.keys.w = true; if (k === 's') this.keys.s = true;
        if (k === 'a') this.keys.a = true; if (k === 'd') this.keys.d = true;
        if (k === 'q') this.keys.q = true; if (k === 'e') this.keys.e = true;
        if (k === 'shift') this.keys.shift = true; if (k === ' ') this.keys.space = true;


        if (this.isShipMode()) {
            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
            if (k === 'escape' && document.pointerLockElement) document.exitPointerLock();
            if (k === 'n') {
                if (this.game && this.game.state === 'exploration') {
                    this.game.toggleCamera();
                } else {
                    this.toggleShipCabin();
                }
            }
            if (k === 'v' && !(this.game && this.game.state === 'exploration')) this.setViewMode('global');
            // B key: force-end game (go to evaluation)
            const forceKey = (CONFIG.game.forceEndKey || 'b').toLowerCase();
            if (k === forceKey && this.game && this.game.state === 'exploration') {
                this.game.forceEnd();
            }
            return;
        }
        if (this.currentView === 'camera') {
            if (k === 'escape' || k === 'v') { this.setViewMode('global'); return; }
            return;
        }
        switch (e.key) {
            case 'ArrowLeft': this.navigateToCategory(this.currentCatIndex - 1); break;
            case 'ArrowRight': this.navigateToCategory(this.currentCatIndex + 1); break;
            case 'ArrowUp': e.preventDefault(); this.adjustZoom(-CFG.camera.zoomStep); break;
            case 'ArrowDown': e.preventDefault(); this.adjustZoom(CFG.camera.zoomStep); break;
            case 'Escape': this.closeInfoPanel(); this.clearActivePlanet(); break;
            case 'n': case 'N': this.labelsVisible = !this.labelsVisible; this.allLabelSprites.forEach(s => s.visible = this.labelsVisible); break;
            case 'v': case 'V': if (this.activePlanet) this.setViewMode('camera'); break;
            case 'f': case 'F': this.setViewMode('ship'); break;
            case 'g': case 'G': this.setViewMode('shipCabin'); break;
        }
    }

    onKeyUp(e) {
        const k = e.key.toLowerCase();
        if (k === 'w') this.keys.w = false; if (k === 's') this.keys.s = false;
        if (k === 'a') this.keys.a = false; if (k === 'd') this.keys.d = false;
        if (k === 'q') this.keys.q = false; if (k === 'e') this.keys.e = false;
        if (k === 'shift') this.keys.shift = false; if (k === ' ') this.keys.space = false;
    }

    onClick(e) {
        if (this.isShipMode()) {
            // Don't request pointer lock if discovery modal is open
            if (this.game && this.game._discoveryModalOpen) return;
            this.renderer.domElement.requestPointerLock();
            return;
        }

        // Suppress click if it was a drag (mouse moved > 5px)
        const dx = e.clientX - this._mouseDownPos.x;
        const dy = e.clientY - this._mouseDownPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) return;

        // Delay single-click to avoid conflict with double-click
        if (this._clickTimer) { clearTimeout(this._clickTimer); this._clickTimer = null; }
        const clickX = e.clientX, clickY = e.clientY;
        this._clickTimer = setTimeout(() => {
            this._clickTimer = null;
            this._handleSingleClick(clickX, clickY);
        }, 250);
    }

    _handleSingleClick(clientX, clientY) {
        // Prevent planet changes when in Planet Visitor mode
        if (this.pvGame && this.pvGame.state !== 'idle') {
            return;
        }

        this.mouse.x = (clientX / innerWidth) * 2 - 1;
        this.mouse.y = -(clientY / innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.allMeshes);

        if (hits.length > 0) {
            const mesh = hits[0].object;
            const planet = this.getPlanetByMesh(mesh);
            if (!planet) return;

            if (this.currentView === 'camera') {
                // ORBITAL MODE: always warp to clicked planet (even if same)
                if (this.activePlanet !== planet) this.clearActivePlanet();
                this.showInfoPanel(planet.node);
                const targetPos = planet.getWorldPosition();
                const pRadius = planet.mesh.geometry?.parameters?.radius || CFG.planet.radius;
                const stopDist = Math.max(pRadius * 5, 60);
                this.showWarpFlash();
                this._orbitalWarping = true;
                this.cam.startWarp(targetPos, stopDist, () => {
                    this._orbitalWarping = false;
                    this.setActivePlanet(planet);
                    this.cam.initFollowFrom(planet.getWorldPosition());
                    if (!this.pvGame || this.pvGame.state === 'idle') this.particles.spawn(planet);
                });
            } else if (this.currentView === 'global') {
                // GLOBAL MODE: select planet, show info, move camera close
                if (this.activePlanet === planet) {
                    this.clearActivePlanet(); this.closeInfoPanel();
                } else {
                    this.setActivePlanet(planet);
                    this.showInfoPanel(planet.node);
                }
            }
        } else {
            // Clicked empty space
            if (this.currentView === 'camera') return; // do nothing in orbital
            this.clearActivePlanet(); this.closeInfoPanel();
        }
    }

    onDoubleClick(e) {
        e.preventDefault();
        // Cancel pending single-click so it doesn't interfere
        if (this._clickTimer) { clearTimeout(this._clickTimer); this._clickTimer = null; }

        // Prevent planet changes when in Planet Visitor mode
        if (this.pvGame && this.pvGame.state !== 'idle') {
            return;
        }

        if (this.isShipMode()) {
            // Ship mode: warp to aimed planet
            this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
            const hits = this.raycaster.intersectObjects(this.allMeshes);
            if (hits.length > 0) {
                const planet = this.getPlanetByMesh(hits[0].object);
                if (!planet) return;
                const targetPos = planet.getWorldPosition();
                const isGameMode = this.game && this.game.state === 'exploration';
                if (isGameMode) {
                    this.game.showGameInfoPanel(planet.node);
                } else {
                    if (this.activePlanet !== planet) this.clearActivePlanet();
                    this.showInfoPanel(planet.node);
                }
                const pRadius = planet.mesh.geometry?.parameters?.radius || CFG.planet.radius;
                const stopDist = Math.max(pRadius * 5, 60);
                this.showWarpFlash();
                this.cam.startWarp(targetPos, stopDist, () => {
                    if (!isGameMode) this.setActivePlanet(planet);
                    const isPvMode = this.pvGame && this.pvGame.state !== 'idle';
                    if (!isGameMode && !isPvMode) this.particles.spawn(planet);
                    if (isGameMode) {
                        this.game.onPlanetReached(planet);
                    }
                });
            }
            return;
        }

        // Double-click in camera (orbital) mode: warp to clicked planet
        if (this.currentView === 'camera') {
            this.mouse.x = (e.clientX / innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / innerHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const hits = this.raycaster.intersectObjects(this.allMeshes);
            if (hits.length > 0) {
                const planet = this.getPlanetByMesh(hits[0].object);
                if (!planet) return;
                if (this.activePlanet !== planet) this.clearActivePlanet();
                this.showInfoPanel(planet.node);
                const targetPos = planet.getWorldPosition();
                const pRadius = planet.mesh.geometry?.parameters?.radius || CFG.planet.radius;
                const stopDist = Math.max(pRadius * 5, 60);
                this.showWarpFlash();
                this._orbitalWarping = true;
                this.cam.startWarp(targetPos, stopDist, () => {
                    this._orbitalWarping = false;
                    this.setActivePlanet(planet);
                    this.cam.initFollowFrom(planet.getWorldPosition());
                    this.particles.spawn(planet);
                });
            }
            return;
        }

        // Double-click in global mode: select and switch to camera
        if (this.currentView === 'global') {
            this.mouse.x = (e.clientX / innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / innerHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const hits = this.raycaster.intersectObjects(this.allMeshes);
            if (hits.length > 0) {
                const planet = this.getPlanetByMesh(hits[0].object);
                if (!planet) return;
                this.setActivePlanet(planet);
                this.showInfoPanel(planet.node);
                this.setViewMode('camera');
            }
        }
    }

    showWarpFlash() {
        let overlay = document.getElementById('warp-flash');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'warp-flash';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:150;pointer-events:none;background:radial-gradient(ellipse at center,rgba(0,255,255,0.6) 0%,rgba(108,180,255,0.3) 30%,transparent 70%);opacity:0;transition:opacity 0.15s ease;';
            document.body.appendChild(overlay);
        }
        // Flash in
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            // Add stretch lines effect
            overlay.style.background = 'radial-gradient(ellipse at center, rgba(255,255,255,0.8) 0%, rgba(0,255,255,0.4) 20%, rgba(108,180,255,0.2) 40%, transparent 70%)';
            setTimeout(() => {
                overlay.style.transition = 'opacity 0.6s ease';
                overlay.style.opacity = '0';
                setTimeout(() => {
                    overlay.style.transition = 'opacity 0.15s ease';
                    overlay.style.background = 'radial-gradient(ellipse at center,rgba(0,255,255,0.6) 0%,rgba(108,180,255,0.3) 30%,transparent 70%)';
                }, 600);
            }, 200);
        });
    }

    onMouseDown(e) {
        this._mouseDownPos = { x: e.clientX, y: e.clientY };
        this._isDrag = false;
        if (this.currentView === 'camera') {
            const tag = e.target.tagName;
            const isUI = tag === 'BUTTON' || tag === 'INPUT' || tag === 'A' || e.target.closest('button, input, a, .pv-screen-content, #pv-planet-info, #info-panel, #game-info-panel');
            if (!isUI) {
                this.cam.mouseDown = true;
                this.cam.lastMouseX = e.clientX;
                this.cam.lastMouseY = e.clientY;
            }
        }
    }

    onMouseUp() {
        if (this.currentView === 'camera') this.cam.mouseDown = false;
    }

    _checkDrag(e) {
        const dx = e.clientX - this._mouseDownPos.x;
        const dy = e.clientY - this._mouseDownPos.y;
        return Math.sqrt(dx * dx + dy * dy) > 5;
    }

    onMouseMove(e) {
        if (!this.tooltip) this.tooltip = document.getElementById('hover-tooltip');

        if (this.isShipMode() && this.cam.pointerLocked) {
            this.cam.onMouseMoveShip(e); return;
        }
        if (this.currentView === 'camera' && this.cam.mouseDown) {
            const dx = e.clientX - this.cam.lastMouseX;
            const dy = e.clientY - this.cam.lastMouseY;
            this.cam.onMouseMoveFollow(dx, dy);
            this.cam.lastMouseX = e.clientX; this.cam.lastMouseY = e.clientY;
            return;
        }
        if (this.currentView !== 'global') return;

        this.mouse.x = (e.clientX / innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.allMeshes);

        if (this.hoveredPlanet && this.hoveredPlanet !== this.activePlanet) {
            this.hoveredPlanet.unhover();
        }

        if (hits.length > 0) {
            const planet = this.getPlanetByMesh(hits[0].object);
            if (planet) {
                this.renderer.domElement.style.cursor = 'pointer';
                planet.hover();
                this.hoveredPlanet = planet;
                this.tooltip.textContent = planet.label;
                this.tooltip.style.left = (e.clientX + 16) + 'px';
                this.tooltip.style.top = (e.clientY - 12) + 'px';
                this.tooltip.classList.add('visible');
            }
        } else {
            this.renderer.domElement.style.cursor = 'default';
            this.hoveredPlanet = null;
            this.tooltip.classList.remove('visible');
        }
    }

    // ── Dual Ranking Screen ──
    async _showDualRanking() {
        const rankingScreen = document.getElementById('ranking-screen');
        if (rankingScreen) rankingScreen.classList.add('visible');

        const inputRow = document.getElementById('ranking-input-row');
        if (inputRow) inputRow.style.display = 'none';

        const pvListEl = document.getElementById('ranking-list-pv');
        const shipListEl = document.getElementById('ranking-list');

        const renderColumn = async (ranking, listEl) => {
            if (!listEl) return;
            listEl.innerHTML = '<div class="ranking-loading">Cargando...</div>';
            const rankings = await ranking.getLeaderboard();
            if (rankings.length === 0) {
                listEl.innerHTML = '<div class="ranking-empty">No hay puntajes todav\u00eda</div>';
                return;
            }
            let html = '';
            rankings.slice(0, 10).forEach((entry, i) => {
                const posClass = i === 0 ? 'pos-gold' : i === 1 ? 'pos-silver' : i === 2 ? 'pos-bronze' : '';
                const medal = i === 0 ? '\ud83e\udd47' : i === 1 ? '\ud83e\udd48' : i === 2 ? '\ud83e\udd49' : `${i + 1}.`;
                html += `<div class="ranking-row ${posClass}">`;
                html += `<span class="ranking-pos">${medal}</span>`;
                html += `<span class="ranking-name">${entry.playerName}</span>`;
                html += `<span class="ranking-score">${entry.score}</span>`;
                html += `</div>`;
            });
            listEl.innerHTML = html;
        };

        await Promise.all([
            renderColumn(this.pvGame.ranking, pvListEl),
            renderColumn(this.game.ranking, shipListEl)
        ]);

        const closeBtn = document.getElementById('ranking-close');
        if (closeBtn) {
            const handler = () => {
                rankingScreen.classList.remove('visible');
                closeBtn.removeEventListener('click', handler);
                if (this.game._openedRankingFromSplash) {
                    this.game._openedRankingFromSplash = false;
                    const splash = document.getElementById('splash-screen');
                    if (splash) splash.classList.add('visible');
                }
            };
            closeBtn.addEventListener('click', handler);
        }
    }

    // ── Splash Screen ──
    showSplash() {
        if (window._loadingScreen) {
            window._loadingScreen.complete();
        } else {
            const el = document.getElementById('loading');
            if (el) { el.classList.add('hidden'); setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 1000); }
        }
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            if (splash) {
                splash.classList.add('visible');
                const startBtn = document.getElementById('splash-start');
                if (startBtn) {
                    startBtn.addEventListener('click', () => {
                        splash.classList.remove('visible');
                    });
                }
                const gameBtn = document.getElementById('splash-game');
                if (gameBtn) {
                    gameBtn.addEventListener('click', () => {
                        splash.classList.remove('visible');
                        setTimeout(() => this.game.startGame(), 600);
                    });
                }
                const pvBtn = document.getElementById('splash-pv');
                if (pvBtn) {
                    pvBtn.addEventListener('click', () => {
                        splash.classList.remove('visible');
                        setTimeout(() => this.pvGame.startGame(), 600);
                    });
                }
                const rankingBtn = document.getElementById('splash-ranking');
                if (rankingBtn) {
                    rankingBtn.addEventListener('click', () => {
                        this.game._openedRankingFromSplash = true;
                        splash.classList.remove('visible');
                        this._showDualRanking();
                    });
                }
            }
        }, 600);
    }

    // ── Animation Loop ──
    animate() {
        requestAnimationFrame(() => this.animate());
        const dt = this.clock.getDelta();
        this.animTime += dt;

        // Animate planet orbits
        Object.values(this.categoryGroups).forEach(catObj => {
            catObj.planets.forEach(pm => {
                const u = pm.userData;
                const r = u.orbitRadius;
                const theta = u.orbitOffset + this.animTime * u.orbitSpeed;
                const phi = (u.orbitTilt + Math.PI / 2) + Math.sin(this.animTime * 0.3 + u.orbitOffset) * 0.3;
                pm.position.x = Math.sin(phi) * Math.cos(theta) * r;
                pm.position.y = Math.cos(phi) * r;
                pm.position.z = Math.sin(phi) * Math.sin(theta) * r;
                pm.rotation.y = this.animTime * (u.selfRotSpeed || 0.18);
            });
            const pulse = 0.92 + Math.sin(this.animTime * 1.5) * 0.05;
            catObj.nucleus.material.opacity = pulse;
            const nucleusPlanet = this.getPlanetByMesh(catObj.nucleus);
            if (nucleusPlanet && !nucleusPlanet.isActive && nucleusPlanet !== this.hoveredPlanet) {
                catObj.nucleus.material.emissiveIntensity = CFG.nucleus.emissiveIntensity - 0.1 + Math.sin(this.animTime * 2) * 0.15;
            }
        });

        if (this.sunMesh) {
            const sunP = this.sunPlanet;
            if (sunP && !sunP.isActive && sunP !== this.hoveredPlanet) {
                this.sunMesh.material.emissiveIntensity = 0.8 + Math.sin(this.animTime * 1.2) * 0.3;
            }
            this.sunMesh.material.opacity = 0.9 + Math.sin(this.animTime * 1.8) * 0.05;
        }

        // Twinkling stars
        if (this.starPoints && this.starBaseSizes) {
            const sizeAttr = this.starPoints.geometry.getAttribute('size');
            for (let i = 0; i < this.starBaseSizes.length; i++) {
                const twinkle = Math.sin(this.animTime * this.starTwinkleSpeeds[i] + this.starTwinklePhases[i]);
                sizeAttr.array[i] = this.starBaseSizes[i] * (0.3 + 0.7 * (twinkle * 0.5 + 0.5));
            }
            sizeAttr.needsUpdate = true;
        }

        // Update connection positions
        this.connections.forEach(c => c.updatePositions());

        // Particles
        this.particles.update(dt, this.camera.position);

        // Update energy field animation on active planet (or objective planet in game mode)
        if (this.game && this.game.state === 'exploration') {
            this.game.updateObjectiveEnergyFieldAnim(this.animTime);
        } else if (this.activePlanet) {
            this.activePlanet.updateEnergyField(this.animTime);
        }

        // View-specific updates
        if (this.isShipMode()) {
            // Pause ship controls when discovery modal is open
            const modalOpen = this.game && this.game._discoveryModalOpen;
            // Respawn ship at center if too far away
            this.checkShipRespawn();
            if (this.cam.warping) {
                // Warp animation in progress
                this.cam.updateWarp(dt);
                const speedEl = document.getElementById('ship-speed-value');
                if (speedEl) speedEl.textContent = 'WARP';
                const throttleFill = document.getElementById('ship-throttle-fill');
                if (throttleFill) throttleFill.style.width = '100%';
                const fireEl = document.getElementById('engine-fire');
                if (fireEl) { fireEl.style.height = '80px'; fireEl.style.opacity = '1'; }
            } else if (!modalOpen) {
                // Only update ship movement when modal is NOT open
                const shipData = this.cam.updateShip(dt, this.keys);
                const speedEl = document.getElementById('ship-speed-value');
                if (speedEl) speedEl.textContent = Math.round(shipData.speed);
                const throttleFill = document.getElementById('ship-throttle-fill');
                if (throttleFill) throttleFill.style.width = (Math.abs(shipData.throttle) * 100) + '%';
                const fireEl = document.getElementById('engine-fire');
                if (fireEl) { fireEl.style.height = (Math.max(0, shipData.throttle) * 80) + 'px'; fireEl.style.opacity = shipData.throttle > 0.05 ? '1' : '0'; }
                this.updateShipRaycast(dt);
            }
        } else if (this.currentView === 'camera') {
            if (this.cam.warping) {
                this.cam.updateWarp(dt);
            } else if (this.activePlanet) {
                this.cam.updateFollow(dt, this.activePlanet.getWorldPosition(), this.keys);
            }
        } else {
            // Global mode
            if (this.activePlanet && this.activePlanet.mesh.userData.orbitRadius !== undefined) {
                const wp = this.activePlanet.getWorldPosition();
                this.cam.targetLookAt.copy(wp);
                const radius = this.activePlanet.mesh.geometry?.parameters?.radius || 30;
                const dist = radius * 6;
                const dir = new THREE.Vector3().subVectors(this.camera.position, wp).normalize();
                this.cam.targetPos.copy(wp).add(dir.multiplyScalar(dist));
                this.cam.targetPos.y = Math.max(this.cam.targetPos.y, wp.y + dist * 0.2);
                this.cam.isTransitioning = true;
            }
            this.cam.updateTransition(this.activePlanet);
            this.cam.controls.update();
        }

        // Update connection trace animations
        this.connections.forEach(conn => conn.updateTrace(dt));

        // Update game waypoint line position
        if (this.game && this.game.state === 'exploration') {
            this.game.updateWaypointLinePosition();
        }

        this.renderer.render(this.scene, this.camera);
    }
}

Universe._texCache = new Map();
Universe._noisePool = null;
Universe._noisePoolSize = 512;

// ═══════════════════════════════════════════════
//  APPLY CONFIGURABLE FONT SIZES
// ═══════════════════════════════════════════════
function applyPlanetVisitorFontSizes() {
    const game = CONFIG.game || {};

    // Remove existing font size styles to prevent conflicts
    const existingStyle = document.getElementById('pv-font-styles');
    if (existingStyle) {
        existingStyle.remove();
    }

    const style = document.createElement('style');
    style.id = 'pv-font-styles';
    style.textContent = `
        /* Desktop font sizes for Planet Visitor */
        #pv-planet-info-content {
            font-size: ${game.pvInfoFontSize || 14}px !important;
        }
        #pv-planet-info-content h3 {
            font-size: ${(game.pvInfoFontSize || 14) * 1.2}px !important;
        }
        #pv-planet-info-content p {
            font-size: ${game.pvInfoFontSize || 14}px !important;
            line-height: 1.6 !important;
        }
        #pv-planet-info-content a {
            font-size: ${(game.pvInfoFontSize || 14) * 0.9}px !important;
        }
        
        /* Planet Visitor Panel font sizes (overrides CSS) */
        #pv-planet-info h3 {
            font-size: ${game.pvPanelTitleFontSize || 2.0}rem !important;
        }
        #pv-planet-info p {
            font-size: ${game.pvPanelDescFontSize || 1.15}rem !important;
        }
        
        /* Mobile font sizes for Planet Visitor */
        @media (max-width: 768px) {
            #pv-planet-info h3 {
                font-size: ${game.pvMobileTitleFontSize || 1.2}rem !important;
            }
            #pv-planet-info p {
                font-size: ${game.pvMobileDescFontSize || 1.3}rem !important;
            }
            .pv-option-btn {
                font-size: ${game.pvMobileOptionFontSize || 1.4}rem !important;
            }
            .pv-option-name {
                font-size: ${game.pvMobileOptionFontSize || 1.4}rem !important;
            }
            #pv-eval-description {
                font-size: ${game.pvMobileQuestionFontSize || 0.95}rem !important;
            }
            #pv-eval-options .eval-option-btn {
                font-size: ${game.pvMobileAnswerFontSize || 0.95}rem !important;
            }
        }
    `;
    document.head.appendChild(style);

    // Log para verificar que los valores se están aplicando correctamente
    console.log('Font sizes applied:', {
        pvInfoFontSize: game.pvInfoFontSize,
        pvPanelTitleFontSize: game.pvPanelTitleFontSize,
        pvPanelDescFontSize: game.pvPanelDescFontSize,
        pvMobileTitleFontSize: game.pvMobileTitleFontSize,
        pvMobileDescFontSize: game.pvMobileDescFontSize,
        pvMobileOptionFontSize: game.pvMobileOptionFontSize,
        pvMobileQuestionFontSize: game.pvMobileQuestionFontSize,
        pvMobileAnswerFontSize: game.pvMobileAnswerFontSize,
        source: 'CONFIG.game'
    });
}

// Función para recargar estilos si la configuración cambia dinámicamente
function reloadPlanetVisitorFontSizes() {
    console.log('Reloading Planet Visitor font sizes...');
    applyPlanetVisitorFontSizes();
}

// ═══════════════════════════════════════════════
//  START
// ═══════════════════════════════════════════════
loadSpaceConfig().then(() => {
    applyPlanetVisitorFontSizes();
    const universe = new Universe();
    universe.init().catch(err => {
        console.error('Error loading:', err);
        const loadEl = document.getElementById('loading');
        if (loadEl) loadEl.innerHTML = '<p style="color:#ff6666">Error cargando datos. Verifica que mapa_herramientas_data.json est\u00e9 en la misma carpeta.</p>';
    });
});
