import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { PlayerController, ThirdPersonCameraController } from '../rosieControls.js';
import { InputHandler } from './InputHandler.js';
import { AnimationController } from './AnimationController.js';
import { CONFIG } from '../../config.js';

const MODEL_FILE = 'assets/medieval+warrior+3d+model_Clone1@Standing Idle.fbx';

const ANIMATION_FILES = {
    Idle: ['assets/medieval+warrior+3d+model_Clone1@Standing Idle.fbx'],
    Walk: ['assets/medieval+warrior+3d+model_Clone1@Walking.fbx'],
    Run: ['assets/medieval+warrior+3d+model_Clone1@Fast Run.fbx'],
    Jump: ['assets/medieval+warrior+3d+model_Clone1@Jumping.fbx'],
    Crouch: ['assets/medieval+warrior+3d+model_Clone1@Crouching.fbx'],
    DrawSword: ['assets/medieval+warrior+3d+model_Clone1@Draw Sword 2.fbx', 'assets/medieval+warrior+3d+model_Clone1@Sheath Sword 1.fbx'],
    SwordIdle: ['assets/medieval+warrior+3d+model_Clone1@Sword And Shield Idle.fbx', 'assets/medieval+warrior+3d+model_Clone1@Standing Idle.fbx'],
    SwordWalk: ['assets/medieval+warrior+3d+model_Clone1@Sword And Shield Walk.fbx', 'assets/medieval+warrior+3d+model_Clone1@Sword And Shield Run.fbx', 'assets/medieval+warrior+3d+model_Clone1@Walking.fbx'],
    SwordRun: ['assets/medieval+warrior+3d+model_Clone1@Sword And Shield Run.fbx', 'assets/medieval+warrior+3d+model_Clone1@Fast Run.fbx'],
    SwordJump: ['assets/medieval+warrior+3d+model_Clone1@Sword And Shield Jump.fbx', 'assets/medieval+warrior+3d+model_Clone1@Jumping.fbx'],
    AttackSlash: ['assets/medieval+warrior+3d+model_Clone1@Sword And Shield Slash.fbx', 'assets/medieval+warrior+3d+model_Clone1@Sword And Shield Attack.fbx'],
    AttackHeavy: ['assets/medieval+warrior+3d+model_Clone1@Sword And Shield Attack.fbx', 'assets/medieval+warrior+3d+model_Clone1@Two Hand Sword Combo.fbx'],
    Block: ['assets/medieval+warrior+3d+model_Clone1@Sword And Shield Block.fbx', 'assets/medieval+warrior+3d+model_Clone1@Crouching.fbx'],
    Impact: ['assets/medieval+warrior+3d+model_Clone1@Sword And Shield Impact.fbx', 'assets/medieval+warrior+3d+model_Clone1@Crouching.fbx'],
    Death: ['assets/medieval+warrior+3d+model_Clone1@Sword And Shield Death.fbx', 'assets/medieval+warrior+3d+model_Clone1@Crouching.fbx'],
    PowerUp: ['assets/medieval+warrior+3d+model_Clone1@Sword And Shield Power Up.fbx', 'assets/medieval+warrior+3d+model_Clone1@Standing Idle.fbx']
};

export class ModularCharacter {
    constructor(scene, camera, domElement) {
        this.scene = scene;
        this.camera = camera;
        this.domElement = domElement;
        this.displayName = 'FBX Warrior';
        this.cameraRef = camera;

        this.health = CONFIG.PLAYER.MAX_HEALTH;
        this.maxHealth = CONFIG.PLAYER.MAX_HEALTH;
        this.weaponEquipped = false;
        this.isBlocking = false;
        this.isDead = false;
        this.lockedAnimation = null;
        this.lockedAnimationTimer = 0;
        this.lastAttackTime = 0;
        this.spawnPoint = new THREE.Vector3(0, 0, 0);
        this.damageTakenMultiplier = 1;

        this.mesh = new THREE.Group();
        this.mesh.visible = false;
        this.scene.add(this.mesh);

        this.inputHandler = new InputHandler();
        this.animationController = null;
        this.controller = null;

        this.cameraController = new ThirdPersonCameraController(camera, this.mesh, domElement, {
            distance: 5.2,
            height: 2.6,
            rotationSpeed: 0.0032,
            pitchSpeed: 0.0024,
            autoRotationSpeed: 5,
            fixedBehind: false,
            pitch: 0.2
        });
        this.cameraController.enabled = false;

        this.setupCombatInput();
        window.addEventListener('difficulty-settings-changed', (e) => {
            const map = { low: 1.3, medium: 1, high: 0.85, ultra: 0.7 };
            this.damageTakenMultiplier = map[e.detail.playerSurvivability] || 1;
        });
        this.load();
    }

    setupCombatInput() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Digit1' && !e.repeat) {
                this.toggleWeapon();
            }
            if (e.code === 'KeyF' && !e.repeat && this.weaponEquipped) {
                this.attack('AttackHeavy', 0.55);
            }
            if (e.code === 'KeyE' && !e.repeat && this.weaponEquipped && this.health <= this.maxHealth * 0.4) {
                this.playLockedAnimation('PowerUp', 1.2);
                this.health = Math.min(this.maxHealth, this.health + Math.floor(this.maxHealth * 0.5));
                window.dispatchEvent(new CustomEvent('player-health-changed', { detail: { health: this.health, maxHealth: this.maxHealth } }));
            }
        });

        window.addEventListener('mousedown', (e) => {
            if (!this.weaponEquipped) return;
            if (e.button === 0) {
                this.attack('AttackSlash', 0.4);
            }
            if (e.button === 2) {
                e.preventDefault();
                this.isBlocking = true;
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 2) {
                this.isBlocking = false;
            }
        });

        this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    async loadAnimationClip(loader, candidates) {
        for (const file of candidates) {
            try {
                const anim = await loader.loadAsync(file);
                if (anim.animations?.[0]) return anim.animations[0];
            } catch (_) {
                // try next fallback
            }
        }
        return null;
    }

    async load() {
        const loader = new FBXLoader();
        const gltfLoader = new GLTFLoader();
        try {
            const model = await loader.loadAsync(MODEL_FILE);
            const clipsByName = {};

            await Promise.all(Object.entries(ANIMATION_FILES).map(async ([name, files]) => {
                clipsByName[name] = await this.loadAnimationClip(loader, files);
            }));

            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
                if (child.isBone && !this.handBone && /right.*hand|hand.*right|r_hand|hand_r|mixamorig.*righthand/i.test(child.name)) {
                    this.handBone = child;
                }
                if (child.isBone && !this.hipBone && /spine|hips|pelvis/i.test(child.name)) {
                    this.hipBone = child;
                }
            });

            model.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const scale = 3.1 / Math.max(0.001, size.y);
            const minY = box.min.y * scale;
            model.scale.setScalar(scale);
            model.position.y -= minY;
            this.mesh.add(model);

            this.animationController = new AnimationController(model, clipsByName);
            this.controller = new PlayerController(this.mesh, {
                moveSpeed: CONFIG.PLAYER.MOVE_SPEED,
                jumpForce: CONFIG.PLAYER.JUMP_FORCE,
                gravity: CONFIG.PLAYER.GRAVITY,
                groundLevel: 0,
                modelFacingOffset: -Math.PI / 2
            });

            this.animationController.Play('Idle');
            this.loadSword(gltfLoader, loader);
            this.setSpawnPoint(this.spawnPoint);
        } catch (error) {
            console.warn('[ModularCharacter] Failed to load FBX character or animation set.', error);
        }
    }

    loadSword(gltfLoader, fbxLoader) {
        const addSword = (swordObject) => {
            this.sword = swordObject;
            this.sword.scale.setScalar(0.018);
            this.sword.rotation.set(0, Math.PI / 2, Math.PI / 2);
            this.sword.position.set(0.06, 0.03, 0.02);

            this.inventorySword = this.sword.clone();
            this.inventorySword.scale.copy(this.sword.scale);
            this.inventorySword.position.set(0.09, 0.05, -0.08);
            this.inventorySword.rotation.set(0, -Math.PI / 4, Math.PI / 1.7);

            if (this.handBone) this.handBone.add(this.sword);
            else this.mesh.add(this.sword);

            if (this.hipBone) this.hipBone.add(this.inventorySword);
            else this.mesh.add(this.inventorySword);

            this.sword.visible = false;
            this.inventorySword.visible = true;
        };

        gltfLoader.load(
            'assets/medieval sword 3d model.glb',
            (gltf) => addSword(cloneSkeleton(gltf.scene)),
            undefined,
            () => {
                fbxLoader.load(
                    'assets/tripo_convert_a0821ddd-4716-4fa9-bf89-600e19140c5b.fbx',
                    (fbx) => addSword(fbx),
                    undefined,
                    () => {
                        fbxLoader.load(
                            'assets/tripo_convert_a97dfcab-a514-494f-ae17-4a2f4b0d5715.fbx',
                            (fbx) => addSword(fbx),
                            undefined,
                            () => {
                                gltfLoader.load('assets/金色长剑3d模型.glb', (gltf) => addSword(cloneSkeleton(gltf.scene)));
                            }
                        );
                    }
                );
            }
        );
    }

    applyQualitySettings(settings) {
        this.mesh.traverse((child) => {
            if (!child.isMesh) return;
            child.castShadow = settings.graphicsPreset !== 'low';
            child.receiveShadow = settings.graphicsPreset !== 'low';
        });
    }

    setSpawnPoint(spawnPoint) {
        this.spawnPoint.copy(spawnPoint);
        this.mesh.position.copy(spawnPoint);
    }

    setVisible(visible) {
        this.mesh.visible = visible;
        this.cameraController.enabled = visible;
    }

    toggleWeapon() {
        if (this.isDead) return;
        this.weaponEquipped = !this.weaponEquipped;

        if (this.sword) this.sword.visible = this.weaponEquipped;
        if (this.inventorySword) this.inventorySword.visible = !this.weaponEquipped;

        if (this.weaponEquipped) {
            this.playLockedAnimation('DrawSword', 0.65);
        }

        window.dispatchEvent(new CustomEvent('weapon-changed', { detail: { equipped: this.weaponEquipped } }));
    }

    attack(animation = 'AttackSlash', lockDuration = 0.45) {
        const now = Date.now();
        if (this.isDead || now - this.lastAttackTime < CONFIG.PLAYER.ATTACK_COOLDOWN) return;

        this.lastAttackTime = now;
        this.playLockedAnimation(animation, lockDuration);
        window.dispatchEvent(new CustomEvent('player-attack', { detail: { player: this } }));
    }

    playLockedAnimation(name, duration) {
        if (!this.animationController?.actions.get(name)) return;
        this.lockedAnimation = name;
        this.lockedAnimationTimer = duration;
        this.animationController.Play(name);
    }

    takeDamage(amount) {
        if (this.isDead) return;

        if (this.isBlocking) {
            amount = Math.max(1, Math.floor(amount * 0.2));
        }

        this.health -= Math.round(amount * this.damageTakenMultiplier);
        window.dispatchEvent(new CustomEvent('player-health-changed', { detail: { health: this.health, maxHealth: this.maxHealth } }));

        if (this.health <= 0) {
            this.die();
            return;
        }

        if (!this.isBlocking) {
            this.playLockedAnimation('Impact', 0.45);
        }
    }

    die() {
        this.isDead = true;
        this.health = 0;
        this.playLockedAnimation('Death', 1.6);
        setTimeout(() => {
            this.health = this.maxHealth;
            this.isDead = false;
            this.lockedAnimation = null;
            this.mesh.position.copy(this.spawnPoint);
            window.dispatchEvent(new CustomEvent('player-health-changed', { detail: { health: this.health, maxHealth: this.maxHealth } }));
        }, 1700);
    }

    update(deltaTime, world, isActive) {
        if (!isActive) return;
        if (!this.controller) {
            this.cameraController.update(deltaTime, this.mesh.rotation.y);
            return;
        }

        if (world?.getTerrainHeight) {
            this.controller.groundLevel = world.getTerrainHeight(this.mesh.position.x, this.mesh.position.z);
        }

        this.syncInputToController();
        if (!this.isDead) {
            this.controller.update(deltaTime, this.cameraController.rotation);
        }

        if (world?.checkCollisions) {
            const pushBack = world.checkCollisions(this.mesh.position, 1.2);
            if (pushBack) this.mesh.position.add(pushBack);
        }

        this.updateAnimations(deltaTime);
        this.cameraController.update(deltaTime, this.mesh.rotation.y);
    }

    syncInputToController() {
        if (!this.controller) return;
        const keys = this.controller.keys;
        keys.KeyW = this.inputHandler.keys.has('KeyW');
        keys.KeyA = this.inputHandler.keys.has('KeyA');
        keys.KeyS = this.inputHandler.keys.has('KeyS');
        keys.KeyD = this.inputHandler.keys.has('KeyD');
        keys.Space = this.inputHandler.keys.has('Space');
    }

    resolveSwordMoveAnimation() {
        const keys = this.controller.keys;
        // Requested remap (controls unchanged):
        // W -> old A anim, A -> old S anim, S -> old D anim, D -> old W anim.
        if (keys.KeyW) return 'SwordStrafeLeft';
        if (keys.KeyA) return 'SwordBackward';
        if (keys.KeyS) return 'SwordStrafeRight';
        if (keys.KeyD) return 'SwordForward';
        return 'SwordWalk';
    }

    updateAnimations(deltaTime) {
        if (!this.animationController || !this.controller) return;

        if (this.lockedAnimation && this.lockedAnimationTimer > 0) {
            this.lockedAnimationTimer -= deltaTime;
            this.animationController.Play(this.lockedAnimation);
            this.animationController.update(deltaTime);
            return;
        }

        if (this.lockedAnimationTimer <= 0) {
            this.lockedAnimation = null;
        }

        const hasMove = Boolean(
            this.controller.keys.KeyW ||
            this.controller.keys.KeyA ||
            this.controller.keys.KeyS ||
            this.controller.keys.KeyD
        );
        const running = (this.inputHandler.keys.has('ShiftLeft') || this.inputHandler.keys.has('ShiftRight')) && this.controller.keys.KeyW;

        if (this.isDead) {
            this.animationController.Play('Death');
        } else if (this.isBlocking && this.weaponEquipped) {
            this.animationController.Play('Block');
        } else if (!this.controller.isOnGround) {
            this.animationController.Play(this.weaponEquipped ? 'SwordJump' : 'Jump');
        } else if (this.weaponEquipped && hasMove) {
            const swordMoveAnimation = this.resolveSwordMoveAnimation();
            this.animationController.Play(swordMoveAnimation);
            if (this.animationController.currentAnimation !== swordMoveAnimation) {
                this.animationController.Play(running ? 'SwordRun' : 'SwordWalk');
            }
        } else if (hasMove && running) {
            this.animationController.Play('Run');
        } else if (hasMove) {
            this.animationController.Play('Walk');
        } else if (this.inputHandler.keys.has('KeyC')) {
            this.animationController.Play('Crouch');
        } else if (this.weaponEquipped) {
            this.animationController.Play('SwordIdle');
        } else {
            this.animationController.Play('Idle');
        }

        this.animationController.update(deltaTime);
    }
}
