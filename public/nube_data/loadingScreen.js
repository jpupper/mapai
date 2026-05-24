// ═══════════════════════════════════════════════
//  LOADING SCREEN
// ═══════════════════════════════════════════════
(function () {
    const PHRASES = [
        "Populando el universo de conocimiento…",
        "Cambiando el aceite de la nave…",
        "Haciendo vibecoding del juego entero…",
        "Compilando 120 tecnologías del futuro…",
        "Calibrando los motores de warp…",
        "Generando texturas procedurales de planetas…",
        "Conectando universos paralelos…",
        "Cargando shaders cuánticos…",
        "Inicializando el campo gravitacional…",
        "Despertando la inteligencia artificial…",
        "Sincronizando órbitas planetarias…",
        "Activando el sistema de navegación estelar…",
        "Renderizando la nube de conocimiento…",
    ];

    // Spawn background stars
    const starsEl = document.getElementById('loading-stars');
    if (starsEl) {
        for (let i = 0; i < 120; i++) {
            const s = document.createElement('div');
            s.className = 'loading-star';
            const size = 1 + Math.random() * 2.5;
            s.style.cssText = [
                'width:' + size + 'px', 'height:' + size + 'px',
                'left:' + (Math.random() * 100) + '%',
                'top:' + (Math.random() * 100) + '%',
                '--dur:' + (2 + Math.random() * 4) + 's',
                '--delay:-' + (Math.random() * 4) + 's',
                'opacity:' + (0.1 + Math.random() * 0.5)
            ].join(';');
            starsEl.appendChild(s);
        }
    }

    // Phrase rotator
    const phraseEl = document.getElementById('loading-phrase');
    let phraseIdx = 0;
    function nextPhrase() {
        if (!phraseEl) return;
        phraseEl.classList.add('fade-out');
        setTimeout(function () {
            phraseIdx = (phraseIdx + 1) % PHRASES.length;
            phraseEl.textContent = PHRASES[phraseIdx];
            phraseEl.classList.remove('fade-out');
        }, 420);
    }
    var phraseInterval = setInterval(nextPhrase, 2200);

    // Progress bar
    var fillEl = document.getElementById('loading-bar-fill');
    var glowEl = document.getElementById('loading-bar-glow');
    var pctEl  = document.getElementById('loading-bar-pct');
    var progress = 0;
    var targetProgress = 0;
    var rafId = null;
    var finished = false;

    function setProgress(pct) {
        pct = Math.min(100, Math.max(0, pct));
        if (fillEl) fillEl.style.width = pct + '%';
        if (glowEl) glowEl.style.left = 'calc(' + pct + '% - 20px)';
        if (pctEl)  pctEl.textContent = Math.round(pct) + '%';
    }

    function animateProgress() {
        if (progress < targetProgress) {
            progress += (targetProgress - progress) * 0.08 + 0.15;
            if (progress > targetProgress) progress = targetProgress;
            setProgress(progress);
        }
        if (!finished || progress < 100) {
            rafId = requestAnimationFrame(animateProgress);
        }
    }
    rafId = requestAnimationFrame(animateProgress);

    window._loadingScreen = {
        setProgress: function (pct) {
            if (!finished) targetProgress = Math.min(90, pct);
        },
        complete: function () {
            clearInterval(phraseInterval);
            finished = true;
            targetProgress = 100;
            if (phraseEl) {
                phraseEl.classList.add('fade-out');
                setTimeout(function () {
                    phraseEl.textContent = '¡Universo listo para explorar!';
                    phraseEl.classList.remove('fade-out');
                }, 420);
            }
            setTimeout(function () {
                var loadEl = document.getElementById('loading');
                if (loadEl) {
                    loadEl.classList.add('hidden');
                    setTimeout(function () { if (loadEl.parentNode) loadEl.parentNode.removeChild(loadEl); }, 1000);
                }
                if (rafId) cancelAnimationFrame(rafId);
            }, 700);
        }
    };
})();
