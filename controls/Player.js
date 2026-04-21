// Kanonikus Player implementáció: ezt használja a játék runtime.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { PlayerController, ThirdPersonCameraController } from './rosieControls.js';
import { CONFIG } from './config.js';

export class Player {
    constructor(scene, camera, domElement) {
        this.scene = scene;
        this.camera = camera;
        this.health = CONFIG.PLAYER.MAX_HEALTH;
        this.maxHealth = CONFIG.PLAYER.MAX_HEALTH;
        this.xp = 0;
        this.level = 1;
        this.isAttacking = false;
        this.lastAttackTime = 0;
        this.isJumping = false;
        this.isRunning = false;
        this.isLanding = false;
        this.wasOnGround = true;
        this.inventoryVisible = false;
        this.weaponEquipped = false;
        this.sword = null;
        this.swordHand = null;
        this.swordIdlePose = {
            position: new THREE.Vector3(-0.4, -0.1, 0.14),
            rotation: new THREE.Euler(Math.PI, -Math.PI / 2, -Math.PI / 1.5, 'XYZ')
        };
        this.swordSwingPose = {
            position: new THREE.Vector3(0.2, -0.12, -0.26),
            rotation: new THREE.Euler(Math.PI * 0.75, -Math.PI / 2, Math.PI / 2, 'XYZ')
        };
        this.attackAnimationDuration = 0.2;
        this.attackElapsed = 0;

        // Idle variation system
        this.idleTimer = 0;
        this.nextIdleVariationTime = this._randomIdleDelay();
        this.isPlayingIdleVariation = false;

        this.mixer = null;
        this.actions = {};
        this.currentAction = null;
        this.currentAnimName = null;

        // Egységes, kanonikus animáció mapping (root/controls között ne legyen eltérés).
        this.animationClipMap = {
            idle: { name: 'NlaTrack.003', index: 3, keywords: ['idle', 'breath', 'stand'] },
            walk: { name: 'NlaTrack.005', index: 5, keywords: ['walk', 'move', 'locomotion'], required: true },
            run: { name: 'NlaTrack.006', index: 6, keywords: ['run', 'sprint', 'jog'] }
        };

        // Container mesh
        this.mesh = new THREE.Group();
        this.scene.add(this.mesh);

        // Load Player GLB
        const loader = new GLTFLoader();
        Promise.all([
            loader.loadAsync('assets/15dd3a19-9030-49b7-a43b-e19073e3cca5.glb'),
            loader.loadAsync('assets/15dd3a19-9030-49b7-a43b-e19073e3cca5-1.glb').catch(() => null)
        ]).then(([characterGltf, animationGltf]) => {
            this.model = cloneSkeleton(characterGltf.scene);

            // Auto-scale to a larger player silhouette
            this.model.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(this.model);
            const size = box.getSize(new THREE.Vector3());
            const s = 3.1 / size.y;
            this.model.scale.set(s, s, s);

            // Center and ground
            const box2 = new THREE.Box3().setFromObject(this.model);
            this.model.position.y -= box2.min.y;

            // Fix materials and shadows
            this.model.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.frustumCulled = false;
                }
            });

            this.mesh.add(this.model);

            // --- Animation Discovery ---
            const clips = characterGltf.animations?.length > 0
                ? characterGltf.animations
                : (animationGltf?.animations || []);

            if (clips.length > 0) {
                this.mixer = new THREE.AnimationMixer(this.model);
                const clipNames = clips.map((c) => c.name);
                console.log('Player GLB clips:', clipNames);

                const resolveClip = (state) => {
                    const map = this.animationClipMap[state];
                    if (!map) return null;

                    const byExactName = clips.find((c) => c.name === map.name);
                    if (byExactName) return byExactName;

                    if (Number.isInteger(map.index) && clips[map.index]) {
                        const byIndex = clips[map.index];
                        console.warn(
                            `[Player] ${state} exact név (${map.name}) nem található, index fallback: ` +
                            `${map.index} -> ${byIndex.name}`
                        );
                        return byIndex;
                    }

                    if (Array.isArray(map.keywords) && map.keywords.length > 0) {
                        const byKeyword = clips.find((c) => {
                            const lowerName = c.name.toLowerCase();
                            return map.keywords.some((keyword) => lowerName.includes(keyword));
                        });
                        if (byKeyword) return byKeyword;
                    }

                    return null;
                };

                for (const state of Object.keys(this.animationClipMap)) {
                    const map = this.animationClipMap[state];
                    let clip = resolveClip(state);

                    if (!clip) continue;

                    const action = this.mixer.clipAction(clip);
                    this.actions[state] = action;
                    console.log(`  -> Mapped [${state}]: "${clip.name}"`);
                }
            } else {
                console.warn('No animations found in player GLB!');
            }

            this.loadSwordModel(loader);
        }).catch((error) => {
            console.error('Player model loading failed:', error);
        });

        // Controls
        this.controller = new PlayerController(this.mesh, {
            moveSpeed: CONFIG.PLAYER.MOVE_SPEED,
            jumpForce: CONFIG.PLAYER.JUMP_FORCE,
            gravity: CONFIG.PLAYER.GRAVITY,
            groundLevel: 0,
            modelFacingOffset: -Math.PI / 2
        });

        this.cameraController = new ThirdPersonCameraController(camera, this.mesh, domElement, {
            distance: 5.2,
            height: 2.6,
            rotationSpeed: 0.0032,
            pitchSpeed: 0.0024,
            autoRotationSpeed: 5.0,
            fixedBehind: false,
            pitch: 0.2
        });

        this.setupInput();
    }

    _randomIdleDelay() {
        return 10 + Math.random() * 15; // 10–25 seconds
    }

    setupInput() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') this.jump();
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.setRunning(true);
            if (e.code === 'Digit1' && !e.repeat) this.toggleWeapon();
            if (e.code === 'KeyI' && !e.repeat) this.toggleInventory();
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.setRunning(false);
        });

        window.addEventListener('mousedown', (e) => {
            if (e.button === 0 && this.weaponEquipped) {
                this.attack();
            }
        });
    }

    setRunning(running) {
        this.isRunning = running;
        if (this.controller) {
            this.controller.moveSpeed = CONFIG.PLAYER.MOVE_SPEED;
        }
    }

    playAnimation(name, fadeDuration = 0.2) {
        const action = this.actions[name];
        if (!action || this.currentAnimName === name) return;

        action.enabled = true;
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(1);
        action.reset().play();

        if (this.currentAction) {
            this.currentAction.crossFadeTo(action, fadeDuration, true);
        }

        this.currentAction = action;
        this.currentAnimName = name;
    }

    jump() {
        if (this.controller && this.controller.isOnGround) {
            this.controller.velocity.y = CONFIG.PLAYER.JUMP_FORCE;
        }
    }

    attack() {
        const now = Date.now();
        if (now - this.lastAttackTime < CONFIG.PLAYER.ATTACK_COOLDOWN) return;

        this.isAttacking = true;
        this.lastAttackTime = now;
        this.attackElapsed = 0;
        this.isPlayingIdleVariation = false;

        window.dispatchEvent(new CustomEvent('player-attack', { detail: { player: this } }));
    }

    takeDamage(amount) {
        this.health -= amount;
        window.dispatchEvent(new CustomEvent('player-health-changed', { detail: { health: this.health, maxHealth: this.maxHealth } }));
        if (this.health <= 0) this.die();
    }

    die() {
        this.health = this.maxHealth;
        this.mesh.position.set(0, 0, 0);
        window.dispatchEvent(new CustomEvent('player-health-changed', { detail: { health: this.health, maxHealth: this.maxHealth } }));
    }

    updateMovementAnimation() {
        if (!this.mixer) return;

        const hasMoveInput = Boolean(
            this.controller?.keys?.KeyW ||
            this.controller?.keys?.KeyA ||
            this.controller?.keys?.KeyS ||
            this.controller?.keys?.KeyD
        );

        const isOnGround = this.controller?.isOnGround;

        if (hasMoveInput && isOnGround) {
            if (this.isRunning && this.actions.run) {
                this.playAnimation('run', 0.15);
            } else {
                this.playAnimation('walk', 0.15);
            }
        } else if (isOnGround && this.actions.idle) {
            this.playAnimation('idle', 0.2);
        } else if (this.currentAction) {
            this.currentAction.fadeOut(0.15);
            this.currentAction = null;
            this.currentAnimName = null;
        }
    }

    updateIdleVariation(deltaTime) {
        if (!this.actions.idle || this.currentAnimName !== 'idle') return;

        this.idleTimer += deltaTime;
        if (this.idleTimer < this.nextIdleVariationTime) return;

        this.idleTimer = 0;
        this.nextIdleVariationTime = this._randomIdleDelay();
        const idleAction = this.actions.idle;
        idleAction.timeScale = 0.95 + Math.random() * 0.15;
    }

    update(deltaTime, world) {
        if (this.mixer) this.mixer.update(deltaTime);

        if (world && world.getTerrainHeight) {
            this.controller.groundLevel = world.getTerrainHeight(this.mesh.position.x, this.mesh.position.z);
        }

        this.controller.update(deltaTime, this.cameraController.rotation);
        this.cameraController.update(deltaTime, this.mesh.rotation.y);

        if (world && world.checkCollisions) {
            const pushBack = world.checkCollisions(this.mesh.position, 1.2);
            if (pushBack) {
                this.mesh.position.add(pushBack);
            }
        }

        this.updateMovementAnimation();
        this.updateIdleVariation(deltaTime);
        this.updateSwordAnimation(deltaTime);
    }

    updateSwordAnimation(deltaTime) {
        if (!this.sword) return;

        const applySwordPose = (position, rotation) => {
            this.sword.position.copy(position);
            this.sword.rotation.set(rotation.x, rotation.y, rotation.z);
        };

        if (!this.weaponEquipped) {
            this.isAttacking = false;
            this.attackElapsed = 0;
            applySwordPose(this.swordIdlePose.position, this.swordIdlePose.rotation);
            return;
        }

        if (this.isAttacking) {
            this.attackElapsed += deltaTime;
            const rawProgress = this.attackElapsed / this.attackAnimationDuration;
            const progress = THREE.MathUtils.clamp(rawProgress, 0, 1);
            const easedProgress = Math.sin(progress * Math.PI);

            this.sword.position.lerpVectors(
                this.swordIdlePose.position,
                this.swordSwingPose.position,
                easedProgress
            );
            this.sword.rotation.set(
                THREE.MathUtils.lerp(this.swordIdlePose.rotation.x, this.swordSwingPose.rotation.x, easedProgress),
                THREE.MathUtils.lerp(this.swordIdlePose.rotation.y, this.swordSwingPose.rotation.y, easedProgress),
                THREE.MathUtils.lerp(this.swordIdlePose.rotation.z, this.swordSwingPose.rotation.z, easedProgress)
            );

            if (progress >= 1) {
                this.isAttacking = false;
                this.attackElapsed = 0;
            }
            return;
        }

        applySwordPose(this.swordIdlePose.position, this.swordIdlePose.rotation);
    }

    toggleInventory() {
        this.inventoryVisible = !this.inventoryVisible;
        window.dispatchEvent(new CustomEvent('inventory-toggle', { detail: { visible: this.inventoryVisible } }));
    }

    toggleWeapon() {
        this.weaponEquipped = !this.weaponEquipped;
        if (this.sword) {
            this.sword.visible = this.weaponEquipped;
        }
        window.dispatchEvent(new CustomEvent('weapon-changed', { detail: { equipped: this.weaponEquipped } }));
    }

    loadSwordModel(loader) {
        loader.load(
            'assets/金色长剑3d模型.glb',
            (gltf) => {
                this.sword = cloneSkeleton(gltf.scene);
                this.sword.scale.set(0.5, 0.5, 0.5);
                this.sword.position.copy(this.swordIdlePose.position);
                this.sword.rotation.set(
                    this.swordIdlePose.rotation.x,
                    this.swordIdlePose.rotation.y,
                    this.swordIdlePose.rotation.z
                );
                this.sword.visible = false;

                this.swordHand = null;
                this.model.traverse((child) => {
                    if (!this.swordHand && child.isBone && /right.*hand|hand.*right|r_hand|hand_r|mixamorig.*righthand/i.test(child.name)) {
                        this.swordHand = child;
                    }
                });
                if (!this.swordHand) {
                    this.model.traverse((child) => {
                        if (!this.swordHand && child.isBone && /hand|wrist/i.test(child.name)) {
                            this.swordHand = child;
                        }
                    });
                }
                if (!this.swordHand) {
                    this.model.traverse((child) => {
                        if (!this.swordHand && child.isBone && /arm/i.test(child.name)) {
                            this.swordHand = child;
                        }
                    });
                }

                if (this.swordHand) {
                    this.swordHand.add(this.sword);
                } else {
                    this.model.add(this.sword);
                    this.sword.position.set(0.22, 1.1, 0.15);
                }
            },
            undefined,
            () => {
                console.warn('Sword model could not be loaded: assets/金色长剑3d模型.glb');
            }
        );
    }
}
