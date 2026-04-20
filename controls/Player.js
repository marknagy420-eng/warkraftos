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
            idle: { name: 'NlaTrack.002', index: 2, required: true },
            walk: { name: 'NlaTrack.005', index: 5, required: true },
            run: { name: 'NlaTrack.003', index: 3, required: true },
            attack: { name: 'NlaTrack', index: 0, required: true },
            jump: { name: 'NlaTrack.004', index: 4, required: false },
            land: { name: 'NlaTrack.001', index: 1, required: false },
            look_around: { name: 'NlaTrack.006', index: 6, required: false }
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

            // Auto-scale to ~2 units height
            this.model.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(this.model);
            const size = box.getSize(new THREE.Vector3());
            const s = 2 / size.y;
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

                    return null;
                };

                let idleClip = resolveClip('idle');
                if (!idleClip) {
                    idleClip = clips[0] || null;
                    if (idleClip) {
                        console.warn(
                            `[Player] idle clip hiányzik (${this.animationClipMap.idle.name}), ` +
                            `biztonsági fallback az első clipre: ${idleClip.name}`
                        );
                    }
                }

                for (const state of Object.keys(this.animationClipMap)) {
                    const map = this.animationClipMap[state];
                    let clip = resolveClip(state);

                    if (!clip && idleClip) {
                        console.warn(
                            `[Player] ${state} clip hiányzik (name=${map.name}, index=${map.index}), idle fallback: ${idleClip.name}`
                        );
                        clip = idleClip;
                    }

                    if (!clip) continue;

                    const action = this.mixer.clipAction(clip);
                    if (['jump', 'land', 'attack', 'look_around'].includes(state)) {
                        action.setLoop(THREE.LoopOnce, 1);
                        action.clampWhenFinished = true;
                    }
                    this.actions[state] = action;
                    console.log(`  -> Mapped [${state}]: "${clip.name}"`);
                }

                if (!this.actions.idle && idleClip) {
                    this.actions.idle = this.mixer.clipAction(idleClip);
                    console.warn(`[Player] idle action biztonsági fallback: ${idleClip.name}`);
                }

                // Listen for animation finish events (for look_around return-to-idle)
                this.mixer.addEventListener('finished', (e) => {
                    if (this.isPlayingIdleVariation && this.actions.look_around &&
                        e.action === this.actions.look_around) {
                        this.isPlayingIdleVariation = false;
                        this.idleTimer = 0;
                        this.nextIdleVariationTime = this._randomIdleDelay();
                        this.playAnimation('idle', 0.4);
                    }
                });

                this.playAnimation('idle');
            } else {
                console.warn('No animations found in player GLB!');
            }
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
            if (e.code === 'KeyW' && !e.repeat) this.attack();
            if (e.code === 'Space') this.jump();
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.setRunning(true);
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.setRunning(false);
        });
    }

    setRunning(running) {
        this.isRunning = running;
        if (this.controller) {
            this.controller.moveSpeed = running
                ? CONFIG.PLAYER.MOVE_SPEED * 1.8
                : CONFIG.PLAYER.MOVE_SPEED;
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
            this.isPlayingIdleVariation = false;
            this.playAnimation('jump', 0.15);
        }
    }

    attack() {
        const now = Date.now();
        if (now - this.lastAttackTime < CONFIG.PLAYER.ATTACK_COOLDOWN) return;

        this.isAttacking = true;
        this.lastAttackTime = now;
        this.isPlayingIdleVariation = false;

        if (this.actions.attack) {
            this.playAnimation('attack', 0.1);
            setTimeout(() => {
                this.isAttacking = false;
                this.updateMovementAnimation();
            }, 600);
        } else {
            this.isAttacking = false;
        }

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
        if (this.isAttacking || !this.mixer) {
            if (this.controller) this.wasOnGround = this.controller.isOnGround;
            return;
        }

        const isOnGround = this.controller.isOnGround;
        const justLanded = !this.wasOnGround && isOnGround;
        this.wasOnGround = isOnGround;

        const hVel = new THREE.Vector3(this.controller.velocity.x, 0, this.controller.velocity.z);
        const speed = hVel.length();
        const isMoving = speed > 0.5;

        // --- Landing ---
        if (justLanded) {
            this.isPlayingIdleVariation = false;
            if (this.actions.land && speed < 1.0) {
                this.isLanding = true;
                this.playAnimation('land', 0.1);
                setTimeout(() => {
                    this.isLanding = false;
                    this.updateMovementAnimation();
                }, 400);
            }
        }

        // If locked in landing, only break out if moving
        if (this.isLanding) {
            if (speed >= 1.0) {
                this.isLanding = false;
            } else {
                return;
            }
        }

        // --- Airborne ---
        if (!isOnGround) {
            this.isPlayingIdleVariation = false;
            this.idleTimer = 0;
            this.playAnimation('jump', 0.2);
            return;
        }

        // --- Moving: walk / run blend by speed ---
        if (isMoving) {
            this.isPlayingIdleVariation = false;
            this.idleTimer = 0;
            this.nextIdleVariationTime = this._randomIdleDelay();

            const isForwardPressed = Boolean(this.controller.keys?.KeyW);
            const shouldPlayRun = isForwardPressed && this.isRunning && speed > CONFIG.PLAYER.MOVE_SPEED * 1.1;

            if (shouldPlayRun) {
                this.playAnimation('run', 0.3);
            } else {
                this.playAnimation('walk', 0.3);
            }
            return;
        }

        // --- Idle: "wait" with random "look_around" variation ---
        if (!this.isPlayingIdleVariation) {
            this.playAnimation('idle', justLanded ? 0.5 : 0.3);
        }
    }

    updateIdleVariation(deltaTime) {
        if (!this.mixer) return;
        if (this.isAttacking || this.isLanding) return;

        const hVel = new THREE.Vector3(this.controller.velocity.x, 0, this.controller.velocity.z);
        const isMoving = hVel.length() > 0.5;
        const isOnGround = this.controller.isOnGround;

        // Only count idle time when standing still on the ground
        if (!isMoving && isOnGround && !this.isPlayingIdleVariation) {
            this.idleTimer += deltaTime;

            if (this.idleTimer >= this.nextIdleVariationTime && this.actions.look_around) {
                this.isPlayingIdleVariation = true;
                this.idleTimer = 0;
                this.playAnimation('look_around', 0.5);
                // The 'finished' event on the mixer handles returning to idle
            }
        } else if (isMoving || !isOnGround) {
            // Reset if player starts moving
            this.idleTimer = 0;
            this.nextIdleVariationTime = this._randomIdleDelay();
            if (this.isPlayingIdleVariation) {
                this.isPlayingIdleVariation = false;
            }
        }
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
    }
}
