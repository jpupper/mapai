import * as THREE from 'three';
import { CONFIG } from './config.js';

const CFG = CONFIG;
const CAT_COLORS = CFG.categoryColors;

// ═══════════════════════════════════════════════
//  CLASS: EnergyParticleSystem
// ═══════════════════════════════════════════════
export class EnergyParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.points = null;
        this.data = [];
        this.count = 60;
    }

    spawn(planet) {
        this.clear();
        const wp = planet.getWorldPosition();
        let color = 0x00ffff;
        if (planet.category) color = CAT_COLORS[planet.category] || 0x00ffff;
        else if (planet.type === 'category') color = CAT_COLORS[planet.id] || 0x00ffff;

        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(this.count * 3);
        const sizes = new Float32Array(this.count);
        this.data = [];

        for (let i = 0; i < this.count; i++) {
            const off = new THREE.Vector3((Math.random()-0.5)*10,(Math.random()-0.5)*10,(Math.random()-0.5)*10);
            positions[i*3] = wp.x+off.x; positions[i*3+1] = wp.y+off.y; positions[i*3+2] = wp.z+off.z;
            sizes[i] = 1.5 + Math.random()*3;
            this.data.push({ origin: wp.clone().add(off), speed: 40+Math.random()*80, delay: Math.random()*0.8, life: 0, maxLife: 1+Math.random()*0.5, alive: true });
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        const mat = new THREE.PointsMaterial({ color, size: 3, transparent: true, opacity: 0.8, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false });
        this.points = new THREE.Points(geo, mat);
        this.scene.add(this.points);
    }

    clear() {
        if (this.points) {
            this.scene.remove(this.points);
            this.points.geometry.dispose();
            this.points.material.dispose();
            this.points = null;
            this.data = [];
        }
    }

    update(dt, camPos) {
        if (!this.points || this.data.length === 0) return;
        const posA = this.points.geometry.getAttribute('position');
        const sizeA = this.points.geometry.getAttribute('size');
        let allDead = true;
        for (let i = 0; i < this.data.length; i++) {
            const p = this.data[i];
            if (!p.alive) continue;
            p.life += dt;
            if (p.life < p.delay) { allDead = false; continue; }
            const t = (p.life - p.delay) / p.maxLife;
            if (t >= 1) { p.alive = false; sizeA.array[i] = 0; continue; }
            allDead = false;
            const dir = new THREE.Vector3().subVectors(camPos, p.origin).normalize();
            const dist = p.speed * (p.life - p.delay);
            const pos = p.origin.clone().add(dir.multiplyScalar(dist));
            const spiral = (p.life - p.delay) * 4;
            pos.x += Math.sin(spiral+i)*3*(1-t);
            pos.y += Math.cos(spiral+i*1.3)*3*(1-t);
            posA.array[i*3] = pos.x; posA.array[i*3+1] = pos.y; posA.array[i*3+2] = pos.z;
            sizeA.array[i] = (1.5+Math.random()*2)*(1-t*t);
        }
        posA.needsUpdate = true;
        sizeA.needsUpdate = true;
        this.points.material.opacity = 0.8;
        if (allDead) this.clear();
    }
}
