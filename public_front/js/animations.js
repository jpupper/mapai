// ═══════════════════════════════════════════
// MapAI — Animations Engine v3.1
// Globe network, topographic particles, map pins
// ═══════════════════════════════════════════
(function() {
  'use strict';

  // ─── HERO CANVAS: Globe + Network ───
  function createHeroNetwork() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, nodes = [], connections = [], mouse = { x: -9999, y: -9999 }, animId;
    let time = 0;

    const PI = Math.PI,
          TAU = PI * 2;

    const COLORS = ['#f59e0b', '#f97316', '#ef4444', '#22d3ee', '#a855f7', '#6c8cff'];
    const NODE_COUNT = 50;

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
    }

    class NetNode {
      constructor() {
        this.reset();
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.radius = 1.5 + Math.random() * 3;
        this.orbitAngle = Math.random() * TAU;
        this.orbitSpeed = 0.002 + Math.random() * 0.005;
        this.orbitRadius = 40 + Math.random() * 120;
        this.orbitCenterX = W / 2;
        this.orbitCenterY = H / 2;
        this.pulsePhase = Math.random() * TAU;
        this.glowIntensity = 0.3 + Math.random() * 0.7;
      }
      reset() {
        this.x = Math.random() * W;
        this.y = Math.random() * H;
      }
      update() {
        this.orbitAngle += this.orbitSpeed;
        // Mix orbital motion with some drift
        this.x += this.vx + Math.cos(this.orbitAngle) * 0.2;
        this.y += this.vy + Math.sin(this.orbitAngle * 0.7) * 0.2;

        // Boundary wrap
        if (this.x < 0 || this.x > W) this.vx *= -1;
        if (this.y < 0 || this.y > H) this.vy *= -1;

        // Clamp
        this.x = Math.max(0, Math.min(W, this.x));
        this.y = Math.max(0, Math.min(H, this.y));
      }
    }

    function init() {
      nodes = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        nodes.push(new NetNode());
      }
      // Build connection cache
      updateConnections();
    }

    function updateConnections() {
      connections = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 180) {
            connections.push({ a: i, b: j, dist: d, alpha: 1 - d / 180 });
          }
        }
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      time += 0.01;

      // ─── Globe glow ───
      const globeRadius = Math.min(W, H) * 0.18;
      const gx = W * 0.35 + Math.sin(time * 0.1) * 20;
      const gy = H * 0.4 + Math.cos(time * 0.08) * 15;

      // Globe atmosphere rings
      for (let i = 0; i < 3; i++) {
        const ringR = globeRadius * (0.7 + i * 0.25);
        ctx.beginPath();
        ctx.arc(gx, gy, ringR, 0, TAU);
        ctx.strokeStyle = `rgba(245,158,11,${0.02 + i * 0.01})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Globe body
      const grad = ctx.createRadialGradient(gx - globeRadius * 0.3, gy - globeRadius * 0.3, 0, gx, gy, globeRadius);
      grad.addColorStop(0, 'rgba(245,158,11,0.04)');
      grad.addColorStop(0.5, 'rgba(245,158,11,0.015)');
      grad.addColorStop(1, 'rgba(245,158,11,0)');
      ctx.beginPath();
      ctx.arc(gx, gy, globeRadius, 0, TAU);
      ctx.fillStyle = grad;
      ctx.fill();

      // Globe grid lines (latitude / longitude)
      ctx.strokeStyle = 'rgba(245,158,11,0.04)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * TAU + time * 0.02;
        ctx.beginPath();
        ctx.arc(gx, gy, globeRadius * 0.5, angle, angle + PI);
        ctx.stroke();
      }
      for (let i = 0; i < 4; i++) {
        const r = globeRadius * (0.2 + i * 0.2);
        ctx.beginPath();
        ctx.arc(gx, gy, r, 0, TAU);
        ctx.stroke();
      }

      // ─── Connection lines ───
      updateConnections();

      for (const c of connections) {
        const na = nodes[c.a];
        const nb = nodes[c.b];
        const alpha = c.alpha * 0.25;

        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        // Bezier curve toward mouse for connected feel
        const mx = mouse.x !== -9999 ? (na.x + nb.x) / 2 + (mouse.x - (na.x + nb.x) / 2) * 0.1 : (na.x + nb.x) / 2;
        const my = mouse.y !== -9999 ? (na.y + nb.y) / 2 + (mouse.y - (na.y + nb.y) / 2) * 0.1 : (na.y + nb.y) / 2;
        ctx.quadraticCurveTo(mx, my, nb.x, nb.y);
        ctx.strokeStyle = `rgba(245,158,11,${alpha})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();

        // Subtle glow on connection
        if (alpha > 0.15) {
          ctx.beginPath();
          ctx.moveTo(na.x, na.y);
          ctx.quadraticCurveTo(mx, my, nb.x, nb.y);
          ctx.strokeStyle = `rgba(245,158,11,${alpha * 0.08})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }

      // ─── Topographic contour hints ───
      for (let i = 0; i < 4; i++) {
        const cy = H * (0.2 + i * 0.2);
        ctx.beginPath();
        for (let x = 0; x < W; x += 2) {
          const y = cy + Math.sin(x * 0.008 + time + i) * 12 + Math.sin(x * 0.02 + time * 0.5 + i * 2) * 6;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(245,158,11,${0.02 - i * 0.003})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // ─── Nodes ───
      for (const n of nodes) {
        n.update();
        const pulse = Math.sin(time * 2 + n.pulsePhase) * 0.3 + 0.7;

        // Glow
        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius * 4);
        grd.addColorStop(0, n.color.replace(')', `,${0.08 * pulse * n.glowIntensity})`).replace('rgb', 'rgba'));
        grd.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * 4, 0, TAU);
        ctx.fillStyle = grd;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * pulse, 0, TAU);
        ctx.fillStyle = n.color;
        ctx.fill();

        // Ring
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * 2.5, 0, TAU);
        ctx.strokeStyle = n.color.replace(')', `,${0.1 * pulse})`).replace('rgb', 'rgba');
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // ─── Mouse connection highlight ───
      if (mouse.x !== -9999 && mouse.y !== -9999) {
        // Find nearest node
        let minD = Infinity, nearest = -1;
        for (let i = 0; i < nodes.length; i++) {
          const d = Math.hypot(nodes[i].x - mouse.x, nodes[i].y - mouse.y);
          if (d < minD) { minD = d; nearest = i; }
        }
        if (nearest >= 0 && minD < 200) {
          const n = nodes[nearest];
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius * 8, 0, TAU);
          ctx.strokeStyle = `rgba(245,158,11,${0.08})`;
          ctx.lineWidth = 1;
          ctx.stroke();

          // Connect to mouse
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(245,158,11,0.05)`;
          ctx.lineWidth = 0.5;
          ctx.setLineDash([3, 6]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // ─── Map pin markers on the globe ───
      const pins = [
        { angle: 0.3, dist: 0.4, color: '#f59e0b', label: 'NODES' },
        { angle: 2.1, dist: 0.55, color: '#22d3ee', label: '3D' },
        { angle: 4.0, dist: 0.35, color: '#a855f7', label: 'GAME' },
        { angle: 5.2, dist: 0.6, color: '#34d399', label: 'DATA' },
      ];
      for (const pin of pins) {
        const px = gx + Math.cos(pin.angle + time * 0.05) * globeRadius * pin.dist;
        const py = gy + Math.sin(pin.angle + time * 0.05) * globeRadius * pin.dist;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, TAU);
        ctx.fillStyle = pin.color;
        ctx.fill();
        // label
        ctx.fillStyle = pin.color.replace(')', ',0.2)').replace('rgb', 'rgba');
        ctx.font = '7px "JetBrains Mono", monospace';
        ctx.fillText(pin.label, px + 5, py + 2);
      }

      animId = requestAnimationFrame(draw);
    }

    function handleMouse(e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }

    function handleLeave() {
      mouse.x = -9999;
      mouse.y = -9999;
    }

    function handleResize() {
      resize();
      // Re-center nodes roughly
      // (orbit centers adjust automatically)
    }

    resize();
    init();
    draw();

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouse);
    document.addEventListener('mouseleave', handleLeave);

    // Cleanup on page unload
    window.addEventListener('beforeunload', function() {
      if (animId) cancelAnimationFrame(animId);
    });
  }

  // ─── TOPO CANVAS: Mini network preview in "Mapa de nodos interactivo" ───
  function createTopoPreview() {
    const canvas = document.getElementById('topo-canvas');
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    const W = canvas.width,
          H = canvas.height;
    let animId;

    const tNodes = [];
    const tCount = 12;
    for (let i = 0; i < tCount; i++) {
      tNodes.push({
        x: 20 + Math.random() * (W - 40),
        y: 20 + Math.random() * (H - 40),
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: 3 + Math.random() * 4,
        color: ['#f59e0b', '#22d3ee', '#a855f7', '#34d399', '#f97316'][Math.floor(Math.random() * 5)]
      });
    }

    function drawTopo() {
      ctx.clearRect(0, 0, W, H);

      // Connections
      for (let i = 0; i < tNodes.length; i++) {
        for (let j = i + 1; j < tNodes.length; j++) {
          const dx = tNodes[i].x - tNodes[j].x;
          const dy = tNodes[i].y - tNodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 100) {
            ctx.beginPath();
            ctx.moveTo(tNodes[i].x, tNodes[i].y);
            ctx.lineTo(tNodes[j].x, tNodes[j].y);
            ctx.strokeStyle = `rgba(245,158,11,${(1 - d / 100) * 0.12})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      for (const n of tNodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 10 || n.x > W - 10) n.vx *= -1;
        if (n.y < 10 || n.y > H - 10) n.vy *= -1;
        n.x = Math.max(10, Math.min(W - 10, n.x));
        n.y = Math.max(10, Math.min(H - 10, n.y));

        // Glow
        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 3);
        grd.addColorStop(0, n.color.replace(')', ',0.06)').replace('rgb', 'rgba'));
        grd.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 2, 0, Math.PI * 2);
        ctx.strokeStyle = n.color.replace(')', ',0.08)').replace('rgb', 'rgba');
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      animId = requestAnimationFrame(drawTopo);
    }

    drawTopo();

    window.addEventListener('beforeunload', function() {
      if (animId) cancelAnimationFrame(animId);
    });
  }

  // ─── SCROLL REVEALS ───
  function initScrollReveals() {
    const els = document.querySelectorAll('.reveal, .reveal-scale, .reveal-left, .reveal-right');
    if (!els.length) return;

    const observer = new IntersectionObserver((entries) => {
      for (const ent of entries) {
        if (ent.isIntersecting) {
          ent.target.classList.add('visible');
          observer.unobserve(ent.target);
        }
      }
    }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

    for (const el of els) observer.observe(el);
  }

  // ─── INIT ───
  document.addEventListener('DOMContentLoaded', function() {
    createHeroNetwork();
    setTimeout(createTopoPreview, 100);
    initScrollReveals();

    // Hide loading overlay
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.style.display = 'none', 800);
    }
  });

})();
