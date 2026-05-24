// ═══════════════════════════════════════════════════════════════
//  CONFIG — All configurable variables for Nube de Universos
//  Edit this file to tweak the experience without touching logic.
//  Values can be overridden from the Admin Panel (space-config API).
// ═══════════════════════════════════════════════════════════════

function _deepMerge(target, source) {
    for (const key in source) {
        if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key] || typeof target[key] !== 'object') target[key] = {};
            _deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

function resolveOriginBasePath() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const reserved = new Set(['api', 'nube_data', 'js', 'css', 'img', 'favicon.ico']);
    const app = parts[0];
    if (app === 'mapai' || app === 'diploia') {
        const tenant = parts[1] && !reserved.has(parts[1]) && !parts[1].includes('.') ? parts[1] : null;
        const base = `/${app}`;
        const basePath = tenant ? `${base}/${tenant}` : base;
        const host = String(window.location.hostname || '').toLowerCase();
        if (host === 'fullscreencode.com' || host.endsWith('.fullscreencode.com')) {
            const apiOrigin = (window.__DIPLOIA_API_ORIGIN__ ? String(window.__DIPLOIA_API_ORIGIN__) : 'https://vps-4455523-x.dattaweb.com').replace(/\/+$/, '');
            const remoteBase = app === 'mapai' ? '/diploia' : '/diploia/diploia';
            const remotePath = tenant && app === 'mapai' ? `${remoteBase}/${tenant}` : remoteBase;
            return apiOrigin + remotePath;
        }
        return window.location.origin + basePath;
    }
    return window.location.origin;
}

export async function loadSpaceConfig() {
    // Last update: 2026-03-09T13:38:00
    try {
        const basePath = resolveOriginBasePath();
        const urlParams = new URLSearchParams(window.location.search);
        const project = urlParams.get('project') || 'diplomatura';
        const url = `${basePath}/api/space-config?project=${encodeURIComponent(project)}`;

        const res = await fetch(url);
        if (!res.ok) return;
        const saved = await res.json();
        if (saved && typeof saved === 'object' && Object.keys(saved).length > 0) {
            _deepMerge(CONFIG, saved);
        }
    } catch (e) {
        // Silently use defaults if server is unreachable
    }
}

export const CONFIG = {

    // ── Data ──────────────────────────────────────────────────
    // URL dinámica: usa la API del servidor en vez del archivo estático
    // Generated at: 2026-03-09T13:38:00
    dataUrl: (() => {
        const basePath = resolveOriginBasePath();
        const urlParams = new URLSearchParams(window.location.search);
        const project = urlParams.get('project') || 'diplomatura';
        return `${basePath}/api/nodes?project=${encodeURIComponent(project)}`;
    })(),

    // ── Category Colors (hex) ────────────────────────────────
    categoryColors: {
        engines: 0xff6b35,
        frameworks: 0x00d4ff,
        ia: 0xb44dff,
        shaders: 0x00ff88,
        db: 0xffd700,
        ides: 0xff4d8b,
        languages: 0x00c9a7,
        llm: 0xe864ff,
        frontend: 0x4d94ff,
        os: 0x8bff4d,
        soportes: 0xff9f43,
        protocolos: 0x54e0ff,
        'software-multimedia': 0xff6688,
        entornos: 0x88cc44,
        glosario: 0xccaa88,
    },

    // ── Planet Texture ───────────────────────────────────────
    planetTexture: {
        size: 512,          // canvas resolution (px)
        noiseScale: 4.5,    // feature size on sphere — higher = bigger blobs
        octaves: 8,         // FBM octaves — more = finer detail
        darkBase: 0.0,      // minimum brightness (0–1) for darkest areas
        brightRange: 3.0,   // how much brighter the brightest areas get
        contrast: 1.4,      // S-curve contrast multiplier (1 = normal, >1 = more contrast)
    },

    // ── Sun (central node) ───────────────────────────────────
    sun: {
        radius: 50,
        color: 0xffcc44,
        emissiveColor: 0xffaa00,
        emissiveIntensity: 1.0,
        glowInnerRadius: 65,
        glowOuterRadius: 100,
        lightIntensity: 3,
        lightRange: 5000,
        labelFontSize: 18,
    },

    // ── Category Nucleus (category sphere) ───────────────────
    nucleus: {
        radius: 50,
        emissiveIntensity: 0.6,
        glowInnerRadius: 36,
        glowOuterRadius: 55,
        lightIntensity: 1.5,
        lightRange: 600,
        labelFontSize: 16,
        labelOffsetY: 45,
    },

    // ── Planets (tool nodes) ─────────────────────────────────
    planet: {
        radius: 30,
        emissiveIntensity: 0.35,
        glowRadius: 20,
        labelFontSize: 12,
        labelOffsetY: 20,
        colorLerpToWhite: 0.3,     // how much to lighten planet color
    },

    // ── Orbits ───────────────────────────────────────────────
    orbit: {
        baseRadius: 90,      // minimum orbit radius
        radiusStep: 50,      // extra radius per layer (ci % 3)
        radiusRandom: 20,      // random jitter added to radius
        speedMin: 0.15,    // minimum orbit angular speed
        speedRandom: 0.25,    // random extra speed
        tiltRange: 0.5,     // max tilt deviation (±half)
        verticalFactor: 0.25,    // vertical amplitude as fraction of radius
        ringInner: 88,
        ringOuter: 90,
    },

    // ── Universe Layout ──────────────────────────────────────
    layout: {
        ringRadius: 1800,    // distance of categories from sun
        categoryZMin: -2000,   // min random Y offset for each category group
        categoryZMax: 2000,   // max random Y offset for each category group
    },

    // ── Starfield ────────────────────────────────────────────
    stars: {
        count: 25000,
        minDistance: 3000,
        maxDistance: 30000,
        baseSize: 4,
        sizeMin: 1.5,
        sizeRandom: 4.0,
        twinkleSpeedMin: 0.5,
        twinkleSpeedRandom: 3.0,
        opacity: 1.0,
    },

    // ── Camera / Orbit View ──────────────────────────────────
    camera: {
        fov: 60,
        near: 0.1,
        far: 50000,
        initialPosition: { x: 0, y: 200, z: 9000 },
        // Global home position — camera always returns here (0,0 = center)
        homePosition: { x: 0, y: 0 },
        transitionSpeed: 0.04,
        zoomMin: 0.3,
        zoomMax: 4,
        zoomStep: 0.25,
        orbitDamping: 0.06,
        orbitRotateSpeed: 0.5,
        orbitMinDistance: 30,
        orbitMaxDistance: 8000,
        // Distance multiplier when navigating to a category
        navDistMultiplier: 350,
        navOffsetX: 0.6,
        navOffsetY: 0.35,
        navOffsetZ: 10.7,
    },

    // ── Camera Follow (CAMARA mode) ──────────────────────────
    follow: {
        distance: 60,      // distance from planet
        heightOffset: 20,      // height above planet
        yawSpeed: 1.5,     // yaw rotation speed (rad/s)
        pitchSpeed: 1.0,     // pitch rotation speed (rad/s)
        pitchMin: -1.2,    // min pitch (radians, looking down)
        pitchMax: 1.2,     // max pitch (radians, looking up)
        lerpSpeed: 0.08,    // how fast camera catches up to planet
        mouseSensitivity: 0.003,   // mouse look sensitivity
        maxRotationSpeed: 2.5,     // max angular velocity (rad/s) for orbital rotation
        zoomSpeed: 20,      // Q/E zoom speed (units/s) in orbital mode
        zoomMin: 10,      // min follow distance
        zoomMax: 2000,    // max follow distance
    },

    // ── Spaceship (NAVE mode) ────────────────────────────────
    ship: {
        maxSpeed: 3000,
        acceleration: 1000,
        drag: 0.97,
        turnSpeed: 2.0,
        boostMultiplier: 2,
        throttleAccelRate: 2,       // how fast throttle ramps up
        throttleBrakeRate: 3,       // how fast throttle ramps down
        throttleDecay: 0.95,    // passive throttle decay
        mouseSensitivity: 0.002,
        pitchMin: -Math.PI / 2 + 0.1,
        pitchMax: Math.PI / 2 - 0.1,
        respawnDistance: 15000,   // if ship is farther than this from origin, respawn at center
        // Model rotation offset (radians) — tweak to fix initial orientation
        offsetRotX: 0,
        offsetRotY: Math.PI,
        offsetRotZ: 0,
        // Model position offset relative to camera (for "ship in front" view)
        modelOffsetX: 0,
        modelOffsetY: -5,
        modelOffsetZ: -10,
        modelScale: 0.4,
    },

    // ── Game Scoring ───────────────────────────────────────────
    game: {
        gameTime: 60,
        showConnections: false,  // whether connection lines are visible by default
        pointsRouteVisit: 0,      // no points for visiting (points come from quiz now)
        pointsRandomVisit: 0,     // no points for visiting
        pointsRouteCorrect: 300,   // points for correct answer on route planet question
        pointsRandomCorrect: 50,   // points for correct answer on random planet question
        pointsWrong: -100,         // points for ANY wrong quiz answer
        evalTimePerQuestion: 30,    // seconds allowed per evaluation question
        collectTime: 1.2,    // seconds to hold crosshair on objective planet to collect
        forceEndKey: 'b',    // key to force-end exploration (go to evaluation)

        // Planet Visitor mode scoring
        pvPointsPerVisit: 100,     // points for each planet visited
        pvPointsCorrect: 200,     // points for correct quiz answer
        pvPointsWrong: -50,       // points for wrong quiz answer
        pvTotalPlanets: 10,       // number of planets to visit
        pvStopDistance: 120,     // camera stop distance when warping to a planet in PV mode
        pvInfoFontSize: 14,       // font size (px) for the planet info panel in PV mode
        pvArrivalDelay: 500,     // ms to wait after arriving at a planet before showing the planet info
        pvInfoDisplayTime: 5,     // seconds showing the planet description before the selection menu
        pvAutoAdvanceTime: 5,    // seconds before auto-advancing to a random planet (selection screen)
    },

    // ── Presentation ──────────────────────────────────────────
    presentation: {
        autoRandomShader: true,
        shaderColor1: 0x00ffff,
        shaderColor2: 0x9900ff,
        shaderSpeed: 0.1,
        shaderScale: 3.0,
        shaderDistortion: 0.1,
        shaderBrightness: 0.8,
    },

    // ── Energy Field (selected planet aura) ─────────────────
    energyField: {
        innerRadius: 1.7,    // multiplier of planet radius
        outerRadius: 2.4,    // multiplier of planet radius
        color: null,   // null = use planet/category color
        innerOpacity: 0.2,     // Lowered from 0.55
        outerOpacity: 0.22,
        pulseSpeed: 2.5,    // pulse animation speed
        pulseAmplitude: 0.3,    // how much opacity varies
        rotationSpeed: 0.8,    // rotation speed (rad/s)
    },

    // ── Scene ────────────────────────────────────────────────
    scene: {
        fogColor: 0x06060e,
        fogDensity: 0.00015,
        ambientColor: 0x111122,
        ambientIntensity: 0.5,
        toneExposure: 1.2,
    },

    // ── Waypoint Line (game mode next-planet indicator) ─────
    waypoint: {
        color: 0x00ffcc,
        opacity: 0.6,
        dashSize: 40,
        gapSize: 20,
        glowColor: 0x00ffcc,
        glowOpacity: 0.25,
        pulseSpeed: 3.0,     // pulse speed for the line
    },

    // ── Connection Lines ─────────────────────────────────────
    connections: {
        primaryOpacity: 0.18,
        primaryActiveOpacity: 0.35,
        primaryDimOpacity: 0.06,
        secondaryOpacity: 0.04,
        secondaryActiveOpacity: 0.12,
        secondaryDimOpacity: 0.02,
        secondaryColor: 0x4488cc,
        sunLineOpacity: 0.08,
        // Active planet connection glow
        activeGlowOpacity: 0.85,
        activeGlowColor: 0x00ffff,
        activeLineWidth: 3,
        // Energy sphere trace animation
        traceDuration: 5.5,    // seconds for sphere to travel the connection (higher = slower)
        traceSphereRadius: 10,     // radius of the energy sphere
        traceSphereGlowMult: 2.5,    // glow sphere radius = traceSphereRadius * this multiplier
    },

    // ── Planet Selection & Hover ─────────────────────────────
    selection: {
        emissiveIntensity: 1.5,
        scaleFactor: 1.15,
        hoverEmissive: 1.2,
        hoverScale: 1.1,
        hoverSelectedEmissive: 2.0,
        hoverSelectedScale: 1.25,
    },
};
