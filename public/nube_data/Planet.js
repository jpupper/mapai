import * as THREE from 'three';
import { CONFIG } from './config.js';

const CFG = CONFIG;

// ═══════════════════════════════════════════════
//  CLASS: Planet (represents any node: sun, nucleus, tool)
// ═══════════════════════════════════════════════
export class Planet {
    constructor(mesh, node, category = null) {
        this.mesh = mesh;
        this.node = node;
        this.category = category;
        this.isActive = false;
        this._origEmissive = mesh.material ? mesh.material.emissiveIntensity : 0;
        this._origScale = mesh.scale.clone();
        this.type = node.type || 'tool';
        // Energy field meshes (created on activate)
        this._energyFieldInner = null;
        this._energyFieldOuter = null;
    }

    get id() { return this.node.id; }
    get label() { return this.node.label || this.node.id; }

    _getColor() {
        const CAT_COLORS = CFG.categoryColors;
        if (this.category) return new THREE.Color(CAT_COLORS[this.category] || 0x00ffff);
        if (this.type === 'category') return new THREE.Color(CAT_COLORS[this.id] || 0x00ffff);
        if (this.id === 'root') return new THREE.Color(CFG.sun.color);
        return new THREE.Color(0x00ffff);
    }

    _createEnergyField() {
        this._removeEnergyField();
        const E = CFG.energyField;
        const pRadius = this.mesh.geometry?.parameters?.radius || 30;
        const color = E.color ? new THREE.Color(E.color) : this._getColor();

        // Inner rotating shell
        const innerGeo = new THREE.IcosahedronGeometry(pRadius * E.innerRadius, 1);
        const innerMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0, // Start invisible for fade-in
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            wireframe: true,
        });
        this._energyFieldInner = new THREE.Mesh(innerGeo, innerMat);
        this.mesh.add(this._energyFieldInner);
        this._fadeIn = 0;

        // Outer pulsing shell REMOVED as per user request
        // const outerGeo = new THREE.IcosahedronGeometry(pRadius * E.outerRadius, 0);
        // ...
    }

    _removeEnergyField() {
        if (this._energyFieldInner) {
            this.mesh.remove(this._energyFieldInner);
            this._energyFieldInner.geometry.dispose();
            this._energyFieldInner.material.dispose();
            this._energyFieldInner = null;
        }
        // Outer field removed from creation, so no need to remove here.
        if (this._energyFieldOuter) {
            this.mesh.remove(this._energyFieldOuter);
            this._energyFieldOuter.geometry.dispose();
            this._energyFieldOuter.material.dispose();
            this._energyFieldOuter = null;
        }
    }

    updateEnergyField(time) {
        if (!this._energyFieldInner) return;
        const E = CFG.energyField;

        // Fade-in logic
        if (this._fadeIn < 1.0) {
            this._fadeIn += 0.025; // Fade in over ~40 frames
            if (this._fadeIn > 1.0) this._fadeIn = 1.0;
        }

        // Rotate inner wireframe shell
        this._energyFieldInner.rotation.y = time * E.rotationSpeed;
        this._energyFieldInner.rotation.x = time * E.rotationSpeed * 0.7;
        // Pulse inner opacity
        const pulse = Math.sin(time * E.pulseSpeed) * E.pulseAmplitude;
        this._energyFieldInner.material.opacity = (E.innerOpacity + pulse * 0.5) * this._fadeIn;
    }

    activate() {
        this.isActive = true;
        if (this.mesh.material) {
            this.mesh.material.emissiveIntensity = CFG.selection.emissiveIntensity;
        }
        this.mesh.scale.copy(this._origScale).multiplyScalar(CFG.selection.scaleFactor);
        this._createEnergyField();
    }

    deactivate() {
        this.isActive = false;
        if (this.mesh.material) {
            this.mesh.material.emissiveIntensity = this._origEmissive;
        }
        this.mesh.scale.copy(this._origScale);
        this._removeEnergyField();
    }

    hover() {
        if (!this.mesh.material) return;
        if (this.isActive) {
            this.mesh.material.emissiveIntensity = CFG.selection.hoverSelectedEmissive;
            this.mesh.scale.copy(this._origScale).multiplyScalar(CFG.selection.hoverSelectedScale);
        } else {
            this.mesh.material.emissiveIntensity = CFG.selection.hoverEmissive;
            this.mesh.scale.copy(this._origScale).multiplyScalar(CFG.selection.hoverScale);
        }
    }

    unhover() {
        if (!this.mesh.material) return;
        if (this.isActive) {
            this.mesh.material.emissiveIntensity = CFG.selection.emissiveIntensity;
            this.mesh.scale.copy(this._origScale).multiplyScalar(CFG.selection.scaleFactor);
        } else {
            this.mesh.material.emissiveIntensity = this._origEmissive;
            this.mesh.scale.copy(this._origScale);
        }
    }

    getWorldPosition() {
        const v = new THREE.Vector3();
        this.mesh.getWorldPosition(v);
        return v;
    }

    getConnectedIds() {
        const sec = this.node.connections?.secondary || [];
        const children = (this.node.connections?.children || []).map(c => c.id || c);
        return [...sec, ...children];
    }
}
