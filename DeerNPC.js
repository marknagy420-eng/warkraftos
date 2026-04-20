import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

export class DeerNPC {
    constructor(scene, position, deerGltf, world) {
        this.scene = scene;
        this.world = world;
        this.mesh = new THREE.Group();
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);

        this.speed = 1.7 + Math.random() * 0.8;
        this.homePosition = position.clone();
        this.wanderRadius = 12 + Math.random() * 18;
        this.pauseTimer = 0;
        this.target = null;
        this.modelFacingOffset = Math.PI / 2;

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
        if (this.pauseTimer > 0) {
            this.pauseTimer -= deltaTime;
            this.setMovingAnimation(false);
            if (this.mixer) this.mixer.update(deltaTime);
            return;
        }

        if (!this.target) {
            this.pickNextTarget();
        }

        const toTarget = new THREE.Vector3().subVectors(this.target, this.mesh.position);
        toTarget.y = 0;
        const dist = toTarget.length();

        if (dist < 0.5) {
            this.target = null;
            this.pauseTimer = 0.8 + Math.random() * 1.8;
            this.setMovingAnimation(false);
            if (this.mixer) this.mixer.update(deltaTime);
            return;
        }

        toTarget.normalize();
        this.mesh.position.x += toTarget.x * this.speed * deltaTime;
        this.mesh.position.z += toTarget.z * this.speed * deltaTime;
        this.mesh.position.y = this.world.getTerrainHeight(this.mesh.position.x, this.mesh.position.z);

        const targetRotation = Math.atan2(toTarget.x, toTarget.z) + this.modelFacingOffset;
        let diff = targetRotation - this.mesh.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.mesh.rotation.y += diff * Math.min(10 * deltaTime, 1);

        this.setMovingAnimation(true);
        if (this.mixer) this.mixer.update(deltaTime);
    }
}
