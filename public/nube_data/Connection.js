import * as THREE from 'three';
import { CONFIG } from './config.js';

const CFG = CONFIG;

// ═══════════════════════════════════════════════
//  CLASS: Connection
// ═══════════════════════════════════════════════
export class Connection {
    constructor(line, fromPlanet, toPlanet, type = 'primary', color = null) {
        this.line = line;
        this.from = fromPlanet;
        this.to = toPlanet;
        this.type = type;
        this.color = color;
        this.glowLine = null;
        // Energy sphere tracing state
        this.tracing = false;
        this.traceProgress = 0;
        this.traceDuration = CFG.connections.traceDuration || 0.6;
        this.traceSphere = null;
        this.traceFromPlanet = null;
        this._savedOpacity = 0;
    }

    updatePositions() {
        const sp = this.from.getWorldPosition();
        const tp = this.to.getWorldPosition();
        const p = this.line.geometry.attributes.position.array;
        p[0] = sp.x; p[1] = sp.y; p[2] = sp.z;
        p[3] = tp.x; p[4] = tp.y; p[5] = tp.z;
        this.line.geometry.attributes.position.needsUpdate = true;
        if (this.glowLine) {
            const gp = this.glowLine.geometry.attributes.position.array;
            gp[0] = sp.x; gp[1] = sp.y; gp[2] = sp.z;
            gp[3] = tp.x; gp[4] = tp.y; gp[5] = tp.z;
            this.glowLine.geometry.attributes.position.needsUpdate = true;
        }
    }

    setOpacity(opacity) { this.line.material.opacity = opacity; }
    show() { this.line.visible = true; }
    hide() {
        this.line.visible = false;
        if (this.glowLine) this.glowLine.visible = false;
        this.stopTrace();
    }

    showGlow(scene) {
        if (this.glowLine) { this.glowLine.visible = true; return; }
        const sp = this.from.getWorldPosition();
        const tp = this.to.getWorldPosition();
        const geo = new THREE.BufferGeometry().setFromPoints([sp, tp]);
        const mat = new THREE.LineBasicMaterial({
            color: CFG.connections.activeGlowColor, transparent: true,
            opacity: CFG.connections.activeGlowOpacity,
            blending: THREE.AdditiveBlending, depthWrite: false,
            linewidth: CFG.connections.activeLineWidth,
        });
        this.glowLine = new THREE.Line(geo, mat);
        scene.add(this.glowLine);
    }

    hideGlow() { if (this.glowLine) this.glowLine.visible = false; }
    involvesId(id) { return this.from.id === id || this.to.id === id; }
    involvesPlanet(planet) { return this.from === planet || this.to === planet; }

    // Start energy sphere trace animation from activePlanet toward the other end
    startTrace(scene, activePlanet) {
        this.tracing = true;
        this.traceProgress = 0;
        this.traceFromPlanet = (this.from === activePlanet) ? this.from : this.to;
        // Hide the line initially — it draws progressively behind the sphere
        this._savedOpacity = this.line.material.opacity;
        this.line.material.opacity = 0;
        this.line.visible = false;
        if (this.glowLine) this.glowLine.visible = false;
        // Create or reuse energy sphere
        const radius = CFG.connections.traceSphereRadius || 10;
        const glowMult = CFG.connections.traceSphereGlowMult || 2.5;
        if (this.traceSphere) {
            // Dispose old geometry in case radius changed
            scene.remove(this.traceSphere);
            this.traceSphere.geometry.dispose();
            this.traceSphere.material.dispose();
            if (this.traceSphere.children.length > 0) {
                this.traceSphere.children[0].geometry.dispose();
                this.traceSphere.children[0].material.dispose();
            }
            this.traceSphere = null;
        }
        const sphereColor = this.color ? new THREE.Color(this.color) : new THREE.Color(CFG.connections.activeGlowColor);
        const sGeo = new THREE.SphereGeometry(radius, 16, 16);
        const sMat = new THREE.MeshBasicMaterial({
            color: sphereColor, transparent: true, opacity: 0.9,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        this.traceSphere = new THREE.Mesh(sGeo, sMat);
        // Add glow around sphere
        const glowGeo = new THREE.SphereGeometry(radius * glowMult, 12, 12);
        const glowMat = new THREE.MeshBasicMaterial({
            color: sphereColor, transparent: true, opacity: 0.25,
            blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
        });
        this.traceSphere.add(new THREE.Mesh(glowGeo, glowMat));
        scene.add(this.traceSphere);
        this.traceSphere.visible = true;
        const startPos = this.traceFromPlanet.getWorldPosition();
        this.traceSphere.position.copy(startPos);
    }

    // Update trace animation each frame; returns true if still tracing
    updateTrace(dt) {
        if (!this.tracing) return false;
        this.traceProgress += dt / this.traceDuration;
        if (this.traceProgress >= 1) this.traceProgress = 1;
        const t = this.traceProgress;
        // Ease out
        const ease = 1 - Math.pow(1 - t, 3);
        const sp = this.traceFromPlanet.getWorldPosition();
        const toPlanet = (this.traceFromPlanet === this.from) ? this.to : this.from;
        const tp = toPlanet.getWorldPosition();
        // Move sphere along the path from origin to destination
        const currentPos = sp.clone().lerp(tp, ease);
        this.traceSphere.position.copy(currentPos);
        // Line draws from ORIGIN PLANET to SPHERE current position (not to destination)
        const p = this.line.geometry.attributes.position.array;
        p[0] = sp.x; p[1] = sp.y; p[2] = sp.z;
        p[3] = currentPos.x; p[4] = currentPos.y; p[5] = currentPos.z;
        this.line.geometry.attributes.position.needsUpdate = true;
        this.line.material.opacity = this._savedOpacity * Math.min(1, ease * 1.5);
        this.line.visible = true;
        if (t >= 1) {
            // Trace complete — sphere arrived at destination
            // NOW snap the line to connect origin → destination fully
            this.tracing = false;
            this.line.material.opacity = this._savedOpacity;
            p[3] = tp.x; p[4] = tp.y; p[5] = tp.z;
            this.line.geometry.attributes.position.needsUpdate = true;
            if (this.glowLine) this.glowLine.visible = true;
            this.traceSphere.visible = false;
            return false;
        }
        return true;
    }

    stopTrace() {
        this.tracing = false;
        if (this.traceSphere) this.traceSphere.visible = false;
    }
}
