import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { PlayerController, ThirdPersonCameraController } from '../rosieControls.js';
import { InputHandler } from './InputHandler.js';
import { AnimationController } from './AnimationController.js';
import { CONFIG } from '../../config.js';

const MODEL_FILE = 'assets/medieval+warrior+3d+model_Clone1@Standing Idle.fbx';

const ANIMATION_FILES = {
    Idle: 'assets/medieval+warrior+3d+model_Clone1@Standing Idle.fbx',
    Walk: 'assets/medieval+warrior+3d+model_Clone1@Walking.fbx',
    Run: 'assets/medieval+warrior+3d+model_Clone1@Fast Run.fbx',
    Jump: 'assets/medieval+warrior+3d+model_Clone1@Jumping.fbx',
    Crouch: 'assets/medieval+warrior+3d+model_Clone1@Crouching.fbx'
};

export class ModularCharacter {
    constructor(scene, camera, domElement) {
        this.scene = scene;
        this.camera = camera;
        this.domElement = domElement;
        this.displayName = 'FBX Warrior';

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

        this.load();
    }

    getRequiredAnimationFileNames() {
        return {
            Idle: 'medieval+warrior+3d+model_Clone1@Standing Idle.fbx',
            Walk: 'medieval+warrior+3d+model_Clone1@Walking.fbx',
            Run: 'medieval+warrior+3d+model_Clone1@Fast Run.fbx',
            Jump: 'medieval+warrior+3d+model_Clone1@Jumping.fbx',
            Crouch: 'medieval+warrior+3d+model_Clone1@Crouching.fbx'
        };
    }

    validateAnimationSet() {
        const required = this.getRequiredAnimationFileNames();
        for (const [state, fileName] of Object.entries(required)) {
            if (!ANIMATION_FILES[state] || !ANIMATION_FILES[state].endsWith(fileName)) {
                throw new Error(`[ModularCharacter] Missing required animation file mapping for "${state}" -> "${fileName}".`);
            }
        }
    }

    async load() {
        const loader = new FBXLoader();
        try {
            this.validateAnimationSet();
            const [model, idle, walk, run, jump, crouch] = await Promise.all([
                loader.loadAsync(MODEL_FILE),
                loader.loadAsync(ANIMATION_FILES.Idle),
                loader.loadAsync(ANIMATION_FILES.Walk),
                loader.loadAsync(ANIMATION_FILES.Run),
                loader.loadAsync(ANIMATION_FILES.Jump),
                loader.loadAsync(ANIMATION_FILES.Crouch)
            ]);

            const clipsByName = {
                Idle: idle.animations[0],
                Walk: walk.animations[0],
                Run: run.animations[0],
                Jump: jump.animations[0],
                Crouch: crouch.animations[0]
            };

            let minY = 0;
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
                if (child.isBone && !this.handBone && /right.*hand|hand.*right|r_hand|hand_r|mixamorig.*righthand/i.test(child.name)) {
                    this.handBone = child;
                }
            });

            model.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const scale = 3.1 / Math.max(0.001, size.y);
            minY = box.min.y * scale;
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
        } catch (error) {
            console.warn('[ModularCharacter] Failed to load FBX character or animation set.', error);
        }
    }

    setVisible(visible) {
        this.mesh.visible = visible;
        this.cameraController.enabled = visible;
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
        this.controller.update(deltaTime, this.cameraController.rotation);

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

    updateAnimations(deltaTime) {
        if (!this.animationController || !this.controller) return;
        const hasMove = Boolean(
            this.controller.keys.KeyW ||
            this.controller.keys.KeyA ||
            this.controller.keys.KeyS ||
            this.controller.keys.KeyD
        );
        const running = (this.inputHandler.keys.has('ShiftLeft') || this.inputHandler.keys.has('ShiftRight')) && this.controller.keys.KeyW;

        if (!this.controller.isOnGround) {
            this.animationController.Play('Jump');
        } else if (hasMove && running) {
            this.animationController.Play('Run');
        } else if (hasMove) {
            this.animationController.Play('Walk');
        } else if (this.inputHandler.keys.has('KeyC')) {
            this.animationController.Play('Crouch');
        } else {
            this.animationController.Play('Idle');
        }

        this.animationController.update(deltaTime);
    }
}
