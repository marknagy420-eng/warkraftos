import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { ThirdPersonCameraController } from '../rosieControls.js';
import { InputHandler } from './InputHandler.js';
import { CharacterStateMachine } from './CharacterStateMachine.js';
import { AnimationController } from './AnimationController.js';
import { CharacterController } from './CharacterController.js';

const MODEL_FILE = 'assets/tripo_convert_a97dfcab-a514-494f-ae17-4a2f4b0d5715.fbx';

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
        this.stateMachine = new CharacterStateMachine();
        this.animationController = null;
        this.characterController = null;

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

            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            model.scale.setScalar(0.01);
            this.mesh.add(model);

            this.animationController = new AnimationController(model, clipsByName);
            this.characterController = new CharacterController(this.mesh, this.stateMachine, this.animationController, this.inputHandler);
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
        if (!this.characterController) {
            this.cameraController.update(deltaTime, this.mesh.rotation.y);
            return;
        }

        this.characterController.update(deltaTime, this.cameraController.rotation, world);
        this.cameraController.update(deltaTime, this.mesh.rotation.y);
    }
}
