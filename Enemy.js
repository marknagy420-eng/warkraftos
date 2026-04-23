import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { CONFIG } from './config.js';
import { createHealthBar, distance2D } from './utils.js';

const STATE = {
    IDLE: 'idle',
    WALK: 'walk',
    RUN: 'run',
    ATTACK: 'attack',
    HIT: 'hit',
    DYING: 'dying',
    DEAD: 'dead',
};

export class Enemy {
    constructor(scene, type, position, gltf = null) {
        this.scene = scene;
        this.type = type;
        this.baseConfig = { ...CONFIG.ENEMY[type] };
        this.config = { ...this.baseConfig };
        this.health = this.config.HEALTH;
        this.maxHealth = this.config.HEALTH;
        this.lastAttackTime = 0;
        this.isDead = false;
        this.mixer = null;
        this.state = STATE.IDLE;
        this.actions = {};
        this.actionVariants = { idle: [], attack: [] };
        this.currentAction = null;
        this.modelFacingOffset = Math.PI / 2;

        // Outer group for position & manual Y-rotation facing
        this.mesh = new THREE.Group();
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);

        if (gltf && gltf.scene) {
            this.model = cloneSkeleton(gltf.scene);
            this.mesh.add(this.model);

            // Mutant is about 2x the player character height.
            this.model.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(this.model);
            const size = box.getSize(new THREE.Vector3());
            const height = Math.max(size.y, 0.01);
            const s = 6.2 / height;
            this.model.scale.set(s, s, s);

            // Recompute & put feet on ground
            this.model.updateMatrixWorld(true);
            const box2 = new THREE.Box3().setFromObject(this.model);
            this.model.position.y -= box2.min.y;

            // Fix materials
            this.model.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.frustumCulled = false;
                }
            });

            this.setupAnimations(gltf);
        } else {
            // Fallback placeholder
            const bodyGeo = new THREE.CapsuleGeometry(0.5, 0.8, 4, 8);
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x27ae60 });
            this.body = new THREE.Mesh(bodyGeo, bodyMat);
            this.body.position.y = 0.9;
            this.mesh.add(this.body);
        }

        // Health bar
        this.healthBar = createHealthBar(1.5, 0.15, 0xff0000);
        this.healthBar.position.y = 3.2;
        this.mesh.add(this.healthBar);

        this.target = null;
        this.homePosition = position.clone();
        this._tmpDir = new THREE.Vector3();
        this._tmpToTarget = new THREE.Vector3();

    }

    setupAnimations(asset) {
        this.mixer = new THREE.AnimationMixer(this.model);
        const hasBundle = !!asset.animations && !Array.isArray(asset.animations);

        if (hasBundle) {
            const useClip = (fbx) => fbx?.animations?.[0] || null;
            const embedded = asset.animations.embedded || {};
            const addLoopAction = (state, clip) => {
                if (!clip) return;
                const action = this.mixer.clipAction(clip);
                action.enabled = true;
                this.actions[state] = action;
            };
            const addVariant = (kind, clip) => {
                if (!clip) return;
                const action = this.mixer.clipAction(clip);
                action.enabled = true;
                this.actionVariants[kind].push(action);
            };

            addVariant('idle', useClip(asset.animations.idle?.[0]) || embedded.idle);
            addVariant('idle', useClip(asset.animations.idle?.[1]) || embedded.idle);
            addLoopAction(STATE.WALK, useClip(asset.animations.walk?.[0]) || embedded.walk);
            addLoopAction(STATE.RUN, useClip(asset.animations.run?.[0]) || embedded.run || embedded.walk);
            addVariant('attack', useClip(asset.animations.attack?.[0]) || embedded.attack);
            addVariant('attack', useClip(asset.animations.attack?.[1]) || embedded.attack);
            addVariant('attack', useClip(asset.animations.attack?.[2]) || embedded.attack);
            addLoopAction(STATE.HIT, useClip(asset.animations.hit?.[0]) || embedded.hit);
            addLoopAction(STATE.DYING, useClip(asset.animations.death?.[0]) || embedded.death);
        } else if (Array.isArray(asset.animations) && asset.animations.length > 0) {
            const wantedClips = {
                [STATE.IDLE]: ['idle'],
                [STATE.RUN]: ['run', 'walk'],
                [STATE.ATTACK]: ['box_02', 'attack', 'punch', 'box'],
                [STATE.DYING]: ['falling', 'death', 'die', 'fall'],
            };
            for (const [state, candidates] of Object.entries(wantedClips)) {
                for (const candidate of candidates) {
                    const clip = asset.animations.find(a => a.name.toLowerCase() === candidate.toLowerCase())
                        || asset.animations.find(a => a.name.toLowerCase().includes(candidate.toLowerCase()));
                    if (clip) {
                        this.actions[state] = this.mixer.clipAction(clip);
                        break;
                    }
                }
            }
        }

        [this.actionVariants.attack[0], this.actionVariants.attack[1], this.actionVariants.attack[2], this.actions[STATE.DYING], this.actions[STATE.HIT]]
            .filter(Boolean)
            .forEach((action) => {
                action.setLoop(THREE.LoopOnce, 1);
                action.clampWhenFinished = true;
            });

        this.mixer.addEventListener('finished', () => {
            if (this.state === STATE.ATTACK || this.state === STATE.HIT) {
                this.crossFadeTo(STATE.IDLE);
            } else if (this.state === STATE.DYING) {
                this.state = STATE.DEAD;
                setTimeout(() => this.scene.remove(this.mesh), 800);
            }
        });

        this.crossFadeTo(STATE.IDLE);
    }

    applyQualitySettings(settings) {
        if (!this.model) return;
        const low = settings.enemyQuality === 'low';
        this.model.traverse((child) => {
            if (!child.isMesh) return;
            child.castShadow = !low;
            child.receiveShadow = !low;
            child.frustumCulled = !low;
        });
    }

    applyDifficultySettings(settings) {
        const map = { low: 0.7, medium: 1, high: 1.2, ultra: 1.5 };
        this.config.DAMAGE = Math.round(this.baseConfig.DAMAGE * (map[settings.enemyDamage] || 1));
        this.config.MOVE_SPEED = this.baseConfig.MOVE_SPEED * (map[settings.enemyAggression] || 1);
        this.config.DETECTION_RANGE = this.baseConfig.DETECTION_RANGE * (map[settings.enemyAggression] || 1);
    }

    crossFadeTo(newState) {
        const action = this.pickAction(newState);
        if (!action) return;
        if (action === this.currentAction && newState !== STATE.ATTACK) return;

        if (this.currentAction) {
            this.currentAction.fadeOut(0.2);
        }
        action.reset().fadeIn(0.2).play();
        this.currentAction = action;
        this.state = newState;
    }

    pickAction(state) {
        if (state === STATE.IDLE && this.actionVariants.idle.length) {
            return this.actionVariants.idle[Math.floor(Math.random() * this.actionVariants.idle.length)];
        }
        if (state === STATE.ATTACK && this.actionVariants.attack.length) {
            return this.actionVariants.attack[Math.floor(Math.random() * this.actionVariants.attack.length)];
        }
        if (state === STATE.HIT && this.actions[STATE.HIT]) return this.actions[STATE.HIT];
        return this.actions[state];
    }

    setState(newState) {
        if (this.state === STATE.DYING || this.state === STATE.DEAD) return;
        if (this.state === STATE.ATTACK && newState !== STATE.IDLE && newState !== STATE.DYING) return;
        this.crossFadeTo(newState);
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.health -= amount;
        this.healthBar.updateHealth(this.health / this.maxHealth);
        if (this.health <= 0) this.die();
        else if (this.pickAction(STATE.HIT)) this.crossFadeTo(STATE.HIT);
    }

    die() {
        if (this.isDead) return;
        this.isDead = true;

        // Force dying state bypassing setState guards
        if (this.actions[STATE.DYING]) {
            if (this.currentAction) this.currentAction.fadeOut(0.15);
            this.actions[STATE.DYING].reset().fadeIn(0.15).play();
            this.currentAction = this.actions[STATE.DYING];
            this.state = STATE.DYING;
        } else {
            // No death animation — just remove after short delay
            this.state = STATE.DEAD;
            setTimeout(() => this.scene.remove(this.mesh), 300);
        }

        window.dispatchEvent(new CustomEvent('enemy-died', { detail: { enemy: this } }));
    }

    // Manual Y-rotation facing using atan2 instead of lookAt
    facePosition(targetPos) {
        const dx = targetPos.x - this.mesh.position.x;
        const dz = targetPos.z - this.mesh.position.z;
        this.mesh.rotation.y = Math.atan2(dx, dz) + this.modelFacingOffset;
    }

    update(deltaTime, player, world) {
        if (this.state === STATE.DEAD) return;
        if (this.mixer) this.mixer.update(deltaTime);
        if (this.state === STATE.DYING) return;

        // Update vertical position based on terrain
        if (world && world.getTerrainHeight) {
            this.mesh.position.y = world.getTerrainHeight(this.mesh.position.x, this.mesh.position.z);
        }

        const distToPlayer = distance2D(this.mesh.position, player.mesh.position);

        // Detection
        if (distToPlayer < this.config.DETECTION_RANGE) {
            this.target = player;
        } else {
            this.target = null;
        }

        if (this.target) {
            // Face the player using manual atan2
            this.facePosition(player.mesh.position);

            if (distToPlayer > this.config.ATTACK_RANGE) {
                // Chase → run
                this._tmpToTarget.set(
                    player.mesh.position.x - this.mesh.position.x,
                    0,
                    player.mesh.position.z - this.mesh.position.z
                );
                if (this._tmpToTarget.lengthSq() > 0) {
                    this._tmpDir.copy(this._tmpToTarget).normalize();
                    this.mesh.position.add(this._tmpDir.multiplyScalar(this.config.MOVE_SPEED * deltaTime));
                }
                this.setState(STATE.RUN);
            } else {
                // In range → attack
                const now = Date.now();
                if (now - this.lastAttackTime > this.config.ATTACK_COOLDOWN) {
                    this.setState(STATE.ATTACK);
                    this.lastAttackTime = now;
                    setTimeout(() => {
                        if (!this.isDead && this.target) {
                            const d = distance2D(this.mesh.position, player.mesh.position);
                            if (d <= this.config.ATTACK_RANGE + 0.5) {
                                player.takeDamage(this.config.DAMAGE);
                            }
                        }
                    }, 400);
                }
            }
        } else {
            // Return home or idle
            const distToHome = distance2D(this.mesh.position, this.homePosition);
            if (distToHome > 1) {
                this.facePosition(this.homePosition);
                this._tmpToTarget.set(
                    this.homePosition.x - this.mesh.position.x,
                    0,
                    this.homePosition.z - this.mesh.position.z
                );
                if (this._tmpToTarget.lengthSq() > 0) {
                    this._tmpDir.copy(this._tmpToTarget).normalize();
                    this.mesh.position.add(this._tmpDir.multiplyScalar(this.config.MOVE_SPEED * deltaTime));
                }
                this.setState(STATE.RUN);
            } else {
                this.setState(STATE.IDLE);
            }
        }

        // Apply collisions for enemies too so they don't walk through houses/trees
        if (world && world.checkCollisions) {
            const pushBack = world.checkCollisions(this.mesh.position, 1.0);
            if (pushBack) {
                this.mesh.position.add(pushBack);
            }
        }

        // Health bar faces player/camera
        if (player.camera) {
            this.healthBar.quaternion.copy(player.camera.quaternion);
        } else {
            this.healthBar.lookAt(player.mesh.position);
        }
    }
}
