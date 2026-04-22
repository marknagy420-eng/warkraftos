import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

export class DeerNPC {
    constructor(scene, position, deerGltf, world) {
        this.scene = scene;
        this.world = world;
        this.mesh = new THREE.Group();
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);

        this.speed = 0.9 + Math.random() * 0.35;
        this.homePosition = position.clone();
        this.wanderRadius = 12 + Math.random() * 18;
        this.pauseTimer = 0;
        this.target = null;
        this.modelFacingOffset = Math.PI / 2;
        this.turnSpeed = 1.25 + Math.random() * 0.45;
        this.health = 30;
        this.isDead = false;
        this.fleeTimer = 0;
        this._tmpToTarget = new THREE.Vector3();
        this._tmpForward = new THREE.Vector3();

        this.model = cloneSkeleton(deerGltf.scene);
        this.model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(this.model);
        const size = box.getSize(new THREE.Vector3());
        const scale = 2 / Math.max(size.y, 0.001);
        this.model.scale.set(scale, scale, scale);

        const groundedBox = new THREE.Box3().setFromObject(this.model);
        this.model.position.y -= groundedBox.min.y;

        this.model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        this.mesh.add(this.model);

        this.mixer = null;
        this.moveAction = null;
        if (deerGltf.animations && deerGltf.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(this.model);
            const clip = deerGltf.animations[0];
            this.moveAction = this.mixer.clipAction(clip);
            this.moveAction.play();
            this.moveAction.paused = true;
        }
    }

    pickNextTarget() {
        const angle = Math.random() * Math.PI * 2;
        const dist = 2 + Math.random() * this.wanderRadius;
        const target = new THREE.Vector3(
            this.homePosition.x + Math.cos(angle) * dist,
            0,
            this.homePosition.z + Math.sin(angle) * dist
        );
        target.y = this.world.getTerrainHeight(target.x, target.z);
        this.target = target;
    }

    setMovingAnimation(isMoving) {
        if (!this.moveAction) return;
        this.moveAction.paused = !isMoving;
    }

    update(deltaTime) {
        if (this.isDead) return;

        if (this.pauseTimer > 0) {
            this.pauseTimer -= deltaTime;
            this.setMovingAnimation(false);
            if (this.mixer) this.mixer.update(deltaTime);
            return;
        }

        if (!this.target) {
            this.pickNextTarget();
        }

        this._tmpToTarget.copy(this.target).sub(this.mesh.position);
        this._tmpToTarget.y = 0;
        const dist = this._tmpToTarget.length();

        if (dist < 0.5) {
            this.target = null;
            this.pauseTimer = 0.8 + Math.random() * 1.8;
            this.setMovingAnimation(false);
            if (this.mixer) this.mixer.update(deltaTime);
            return;
        }

        const targetRotation = Math.atan2(this._tmpToTarget.x, this._tmpToTarget.z) + this.modelFacingOffset;
        let diff = targetRotation - this.mesh.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        const maxTurn = this.turnSpeed * deltaTime;
        const clampedTurn = Math.max(-maxTurn, Math.min(maxTurn, diff));
        this.mesh.rotation.y += clampedTurn;

        // Move only forward along deer facing direction (no side stepping).
        const facingAngle = this.mesh.rotation.y - this.modelFacingOffset;
        this._tmpForward.set(Math.sin(facingAngle), 0, Math.cos(facingAngle));
        const forwardAmount = this.speed * deltaTime;
        this.mesh.position.x += this._tmpForward.x * forwardAmount;
        this.mesh.position.z += this._tmpForward.z * forwardAmount;
        this.mesh.position.y = this.world.getTerrainHeight(this.mesh.position.x, this.mesh.position.z);

        this.setMovingAnimation(true);
        if (this.mixer) this.mixer.update(deltaTime);

        if (this.fleeTimer > 0) this.fleeTimer -= deltaTime;
    }

    scareFrom(point) {
        if (this.isDead) return;
        const away = new THREE.Vector3().subVectors(this.mesh.position, point);
        away.y = 0;
        if (away.lengthSq() < 0.0001) away.set(Math.random() - 0.5, 0, Math.random() - 0.5);
        away.normalize();
        const fleeDistance = 12 + Math.random() * 10;
        this.target = this.mesh.position.clone().addScaledVector(away, fleeDistance);
        this.target.y = this.world.getTerrainHeight(this.target.x, this.target.z);
        this.pauseTimer = 0;
        this.fleeTimer = 2.2;
    }

    takeDamage(amount, attackerPosition) {
        if (this.isDead) return false;
        this.health -= amount;
        this.scareFrom(attackerPosition);
        if (this.health <= 0) {
            this.die();
            return true;
        }
        return false;
    }

    die() {
        if (this.isDead) return;
        this.isDead = true;
        this.scene.remove(this.mesh);
        this.mesh.traverse((child) => {
            if (child.isMesh) {
                child.geometry?.dispose?.();
            }
        });
        this.world?.spawnMeatDrops?.(this.mesh.position);
    }
}
