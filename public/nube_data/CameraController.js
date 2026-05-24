import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ═══════════════════════════════════════════════
//  CLASS: CameraController
// ═══════════════════════════════════════════════
export class CameraController {
    constructor(camera, renderer, cfg) {
        this.camera = camera;
        this.cfg = cfg;
        this.controls = new OrbitControls(camera, renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = cfg.camera.orbitDamping;
        this.controls.rotateSpeed = cfg.camera.orbitRotateSpeed;
        this.controls.minDistance = cfg.camera.orbitMinDistance;
        this.controls.maxDistance = cfg.camera.orbitMaxDistance;
        this.controls.enablePan = false;

        this.targetPos = new THREE.Vector3();
        this.targetLookAt = new THREE.Vector3();
        this.currentLookAt = new THREE.Vector3();
        this.isTransitioning = false;
        this.zoomLevel = 1;

        // Follow
        this.followYaw = 0;
        this.followPitch = 0.3;
        this.followDistance = cfg.follow.distance;
        this.followYawVel = 0;
        this.followPitchVel = 0;
        this.mouseDown = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this._prevPlanetPos = new THREE.Vector3();
        this._followInitialized = false;

        // Ship
        this.shipVelocity = new THREE.Vector3();
        this.shipThrottle = 0;
        this.shipYaw = 0;
        this.shipPitch = 0;
        this.pointerLocked = false;

        // Ship model reference (set externally after GLTF load)
        this.shipModel = null;

        // Warp (ship mode teleport to planet)
        this.warping = false;
        this.warpTarget = null;
        this.warpStart = null;
        this.warpTime = 0;
        this.warpDuration = 2.0;       // seconds
        this.warpCallback = null;
        this._warpLookQuat = new THREE.Quaternion();
    }

    goHome(instant = false) {
        const home = this.cfg.camera.homePosition;
        const dist = this.cfg.camera.navDistMultiplier * this.zoomLevel;
        this.targetPos.set(home.x, dist * 1.2, home.y);
        this.targetLookAt.set(home.x, 0, home.y);
        if (instant) {
            this.camera.position.copy(this.targetPos);
            this.controls.target.copy(this.targetLookAt);
            this.currentLookAt.copy(this.targetLookAt);
            this.controls.update();
        } else {
            this.currentLookAt.copy(this.controls.target);
            this.isTransitioning = true;
        }
    }

    navigateTo(position, instant = false) {
        const dist = this.cfg.camera.navDistMultiplier * this.zoomLevel;
        this.targetPos.set(position.x, dist * 1.2, position.z);
        this.targetLookAt.copy(position);
        if (instant) {
            this.camera.position.copy(this.targetPos);
            this.controls.target.copy(this.targetLookAt);
            this.currentLookAt.copy(this.targetLookAt);
            this.controls.update();
        } else {
            this.currentLookAt.copy(this.controls.target);
            this.isTransitioning = true;
        }
    }

    adjustZoom(delta) {
        const old = this.zoomLevel;
        this.zoomLevel = Math.max(this.cfg.camera.zoomMin, Math.min(this.cfg.camera.zoomMax, this.zoomLevel + delta));
        return this.zoomLevel !== old;
    }

    updateTransition(activePlanet) {
        if (!this.isTransitioning) return;
        this.camera.position.lerp(this.targetPos, this.cfg.camera.transitionSpeed);
        this.currentLookAt.lerp(this.targetLookAt, this.cfg.camera.transitionSpeed);
        this.controls.target.copy(this.currentLookAt);
        if (!activePlanet || activePlanet.mesh.userData.orbitRadius === undefined) {
            if (this.camera.position.distanceTo(this.targetPos) < 2) this.isTransitioning = false;
        }
    }

    initFollowFrom(targetWorldPos) {
        this.followYawVel = 0;
        this.followPitchVel = 0;
        this.mouseDown = false;
        const diff = new THREE.Vector3().subVectors(this.camera.position, targetWorldPos);
        this.followYaw = Math.atan2(diff.x, diff.z);
        this.followPitch = Math.atan2(diff.y, Math.sqrt(diff.x * diff.x + diff.z * diff.z));
        const F = this.cfg.follow;
        // Clamp distance so the first updateFollow frame doesn't jump
        this.followDistance = Math.max(F.zoomMin || 20, Math.min(F.zoomMax || 400, diff.length()));
        // Initialize prevPlanetPos to current so orbital compensation doesn't fire on frame 1
        this._prevPlanetPos.copy(targetWorldPos);
        this._followInitialized = false;  // skip orbital delta on the very first updateFollow frame
    }

    updateFollow(dt, targetWorldPos, keys) {
        const F = this.cfg.follow;
        if (keys.a) this.followYawVel += F.yawSpeed * dt;
        if (keys.d) this.followYawVel -= F.yawSpeed * dt;
        if (keys.w) this.followPitchVel += F.pitchSpeed * dt;
        if (keys.s) this.followPitchVel -= F.pitchSpeed * dt;
        // Q/E zoom in orbital mode
        const zSpeed = F.zoomSpeed || 8;
        if (keys.e) this.followDistance = Math.max(F.zoomMin || 20, this.followDistance - zSpeed * dt * 10);
        if (keys.q) this.followDistance = Math.min(F.zoomMax || 400, this.followDistance + zSpeed * dt * 10);

        // Clamp rotation speed to maxRotationSpeed
        const maxRot = F.maxRotationSpeed || 2.5;
        this.followYawVel = Math.max(-maxRot, Math.min(maxRot, this.followYawVel));
        this.followPitchVel = Math.max(-maxRot, Math.min(maxRot, this.followPitchVel));

        this.followYaw += this.followYawVel;
        this.followPitch += this.followPitchVel;
        this.followPitch = Math.max(F.pitchMin, Math.min(F.pitchMax, this.followPitch));

        const decay = this.mouseDown ? 0.85 : 0.92;
        this.followYawVel *= decay;
        this.followPitchVel *= decay;
        if (Math.abs(this.followYawVel) < 0.0001) this.followYawVel = 0;
        if (Math.abs(this.followPitchVel) < 0.0001) this.followPitchVel = 0;

        const camOffset = new THREE.Vector3(
            Math.sin(this.followYaw) * Math.cos(this.followPitch) * this.followDistance,
            Math.sin(this.followPitch) * this.followDistance,
            Math.cos(this.followYaw) * Math.cos(this.followPitch) * this.followDistance
        );
        const desiredPos = targetWorldPos.clone().add(camOffset);

        // Compensate for planet's orbital movement so camera doesn't lag/snap
        if (this._followInitialized) {
            const planetDelta = new THREE.Vector3().subVectors(targetWorldPos, this._prevPlanetPos);
            this.camera.position.add(planetDelta);
        }
        this._prevPlanetPos.copy(targetWorldPos);
        this._followInitialized = true;

        this.camera.position.lerp(desiredPos, F.lerpSpeed);
        this.camera.lookAt(targetWorldPos);
    }

    initShip() {
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        this.shipYaw = Math.atan2(dir.x, dir.z);
        this.shipPitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
        this.shipVelocity.set(0, 0, 0);
        this.shipThrottle = 0;
    }

    updateShip(dt, keys) {
        const S = this.cfg.ship;
        if (keys.w || keys.space) {
            this.shipThrottle = Math.min(1, this.shipThrottle + dt * S.throttleAccelRate);
        } else if (keys.s) {
            this.shipThrottle = Math.max(-0.3, this.shipThrottle - dt * S.throttleBrakeRate);
        } else {
            this.shipThrottle *= S.throttleDecay;
            if (Math.abs(this.shipThrottle) < 0.01) this.shipThrottle = 0;
        }
        // Mouse-controlled yaw when pointer locked; keyboard yaw only when not locked
        if (!this.pointerLocked) {
            // Without pointer lock, A/D still rotate
            if (keys.a) this.shipYaw += S.turnSpeed * dt;
            if (keys.d) this.shipYaw -= S.turnSpeed * dt;
        }
        const forward = new THREE.Vector3(
            Math.sin(this.shipYaw) * Math.cos(this.shipPitch),
            Math.sin(this.shipPitch),
            Math.cos(this.shipYaw) * Math.cos(this.shipPitch)
        );
        // Right vector for strafing (A/D move sideways)
        const right = new THREE.Vector3(
            Math.cos(this.shipYaw), 0, -Math.sin(this.shipYaw)
        ).normalize();
        // Forward thrust
        this.shipVelocity.add(forward.clone().multiplyScalar(this.shipThrottle * S.acceleration * dt));
        // Strafe: A = left, D = right
        if (keys.a) this.shipVelocity.add(right.clone().multiplyScalar(S.acceleration * 0.6 * dt));
        if (keys.d) this.shipVelocity.add(right.clone().multiplyScalar(-S.acceleration * 0.6 * dt));
        if (keys.shift) this.shipVelocity.add(forward.clone().multiplyScalar(S.acceleration * S.boostMultiplier * dt));
        if (keys.q) this.shipVelocity.y += S.acceleration * dt;
        if (keys.e) this.shipVelocity.y -= S.acceleration * dt;
        // dt-based drag so speed isn't frame-rate dependent and can actually reach maxSpeed
        const dragFactor = Math.pow(S.drag, dt * 60);
        this.shipVelocity.multiplyScalar(dragFactor);
        const speed = this.shipVelocity.length();
        if (speed > S.maxSpeed) this.shipVelocity.normalize().multiplyScalar(S.maxSpeed);
        this.camera.position.add(this.shipVelocity.clone().multiplyScalar(dt));
        this.camera.lookAt(this.camera.position.clone().add(forward));
        return { speed, throttle: this.shipThrottle };
    }

    startWarp(targetPos, stopDistance, callback, trackedPlanet) {
        this.warping = true;
        this.warpStart = this.camera.position.clone();
        this.warpStopDistance = stopDistance;
        this._warpTrackedPlanet = trackedPlanet || null;
        // Stop at stopDistance from the planet along the approach direction
        const dir = new THREE.Vector3().subVectors(targetPos, this.warpStart).normalize();
        this.warpTarget = targetPos.clone().sub(dir.multiplyScalar(stopDistance));
        this.warpLookAt = targetPos.clone();
        this.warpTime = 0;
        this.warpCallback = callback || null;
        this.shipVelocity.set(0, 0, 0);
        this.shipThrottle = 0;
        // Capture the camera's current quaternion so we can slerp rotation smoothly
        this._warpLookQuat.copy(this.camera.quaternion);
    }

    updateWarp(dt) {
        if (!this.warping) return false;
        this.warpTime += dt;
        const t = Math.min(this.warpTime / this.warpDuration, 1);

        // If tracking a moving planet, recompute the stop-point from the
        // camera's CURRENT position each frame so there is no snap on departure.
        if (this._warpTrackedPlanet) {
            const currentPlanetPos = this._warpTrackedPlanet.getWorldPosition();
            const dir = new THREE.Vector3().subVectors(currentPlanetPos, this.camera.position).normalize();
            this.warpTarget = currentPlanetPos.clone().sub(dir.multiplyScalar(this.warpStopDistance));
            this.warpLookAt = currentPlanetPos.clone();
        }

        // Ease-in-out curve for position speed
        const ease = t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;

        // Move camera incrementally toward warpTarget from its CURRENT position.
        // This avoids the snap caused by lerpVectors(fixedStart, movingTarget, t).
        const posLerpSpeed = Math.max(0.04, ease * 0.18);
        this.camera.position.lerp(this.warpTarget, posLerpSpeed);

        // Smoothly rotate toward the planet using quaternion slerp
        const _m = new THREE.Matrix4();
        _m.lookAt(this.camera.position, this.warpLookAt, this.camera.up);
        const targetQuat = new THREE.Quaternion().setFromRotationMatrix(_m);
        const rotLerpSpeed = Math.max(0.06, ease * 0.22);
        this.camera.quaternion.slerp(targetQuat, rotLerpSpeed);

        // Update shipYaw/shipPitch to match facing direction toward planet
        const faceDir = new THREE.Vector3().subVectors(this.warpLookAt, this.camera.position).normalize();
        this.shipYaw = Math.atan2(faceDir.x, faceDir.z);
        this.shipPitch = Math.asin(Math.max(-1, Math.min(1, faceDir.y)));

        if (t >= 1) {
            this.warping = false;
            this._warpTrackedPlanet = null;
            this.shipVelocity.set(0, 0, 0);
            if (this.warpCallback) this.warpCallback();
            return false;
        }
        return true;
    }

    initShipWithModel(preserveVelocity = false) {
        // Same FPS controls as cabin, but ship model is attached to camera
        if (!preserveVelocity) this.initShip();
        if (this.shipModel) {
            const S = this.cfg.ship;
            // Remove from scene, add as child of camera
            this.shipModel.parent?.remove(this.shipModel);
            this.camera.add(this.shipModel);
            // Position model in front of camera using config offsets
            this.shipModel.position.set(
                S.modelOffsetX || 0,
                S.modelOffsetY || -0.4,
                S.modelOffsetZ || -3.0
            );
            // Apply config rotation offsets
            this.shipModel.rotation.set(
                S.offsetRotX || 0,
                S.offsetRotY || Math.PI,
                S.offsetRotZ || 0
            );
            // Scale down for cockpit-front view
            const sc = S.modelScale || 0.15;
            this.shipModel.scale.set(sc, sc, sc);
            this.shipModel.visible = true;
            // Disable frustum culling so the model renders when attached to camera
            this.shipModel.traverse((child) => {
                child.frustumCulled = false;
            });
        }
    }

    detachShipModel(scene) {
        // Move ship model back to scene (out of camera)
        if (this.shipModel && this.shipModel.parent === this.camera) {
            this.camera.remove(this.shipModel);
            scene.add(this.shipModel);
            this.shipModel.scale.set(15, 15, 15);
            this.shipModel.visible = false;
        }
    }

    onMouseMoveShip(e) {
        const S = this.cfg.ship;
        this.shipYaw -= e.movementX * S.mouseSensitivity;
        this.shipPitch -= e.movementY * S.mouseSensitivity;
        this.shipPitch = Math.max(S.pitchMin, Math.min(S.pitchMax, this.shipPitch));
    }

    onMouseMoveFollow(dx, dy) {
        this.followYawVel -= dx * this.cfg.follow.mouseSensitivity * 2;
        this.followPitchVel += dy * this.cfg.follow.mouseSensitivity * 2;
    }
}
