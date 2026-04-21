import * as THREE from 'three';
import { CONFIG } from '../../config.js';

export class CharacterController {
    constructor(mesh, stateMachine, animationController, inputHandler) {
        this.mesh = mesh;
        this.stateMachine = stateMachine;
        this.animationController = animationController;
        this.inputHandler = inputHandler;

        this.walkSpeed = CONFIG.PLAYER.MOVE_SPEED;
        this.runSpeed = CONFIG.PLAYER.MOVE_SPEED * 1.75;
        this.crouchSpeed = CONFIG.PLAYER.MOVE_SPEED * 0.55;
        this.jumpVelocity = CONFIG.PLAYER.JUMP_FORCE;
        this.gravity = CONFIG.PLAYER.GRAVITY;

        this.velocity = new THREE.Vector3();
        this.isOnGround = true;
        this.rotationOffset = -Math.PI / 2;
        this.lastState = null;
    }

    update(deltaTime, cameraYaw, world) {
        const input = this.inputHandler.snapshot();
        const state = this.stateMachine.evaluate(input);

        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);

        let moveX = 0;
        let moveZ = 0;
        if (input.hasW) { moveX += forward.x; moveZ += forward.z; }
        if (input.hasS) { moveX -= forward.x; moveZ -= forward.z; }
        if (input.hasA) { moveX -= right.x; moveZ -= right.z; }
        if (input.hasD) { moveX += right.x; moveZ += right.z; }

        const move = new THREE.Vector3(moveX, 0, moveZ);
        if (move.lengthSq() > 0) move.normalize();

        let moveSpeed = this.walkSpeed;
        if (state === 'Run') moveSpeed = this.runSpeed;
        if (state === 'Crouch') moveSpeed = this.crouchSpeed;

        this.velocity.x = move.x * moveSpeed;
        this.velocity.z = move.z * moveSpeed;

        const ground = world?.getTerrainHeight
            ? world.getTerrainHeight(this.mesh.position.x, this.mesh.position.z)
            : 0;

        if (this.mesh.position.y > ground) {
            this.velocity.y -= this.gravity * deltaTime;
            this.isOnGround = false;
        } else {
            this.mesh.position.y = ground;
            this.velocity.y = Math.max(this.velocity.y, 0);
            this.isOnGround = true;
        }

        if (state === 'Jump' && this.isOnGround) {
            this.velocity.y = this.jumpVelocity;
            this.isOnGround = false;
        }

        this.mesh.position.x += this.velocity.x * deltaTime;
        this.mesh.position.y += this.velocity.y * deltaTime;
        this.mesh.position.z += this.velocity.z * deltaTime;

        if (world?.checkCollisions) {
            const pushBack = world.checkCollisions(this.mesh.position, 1.2);
            if (pushBack) {
                this.mesh.position.add(pushBack);
            }
        }

        const horizontal = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
        if (horizontal.lengthSq() > 0.0001) {
            const targetYaw = Math.atan2(horizontal.x, horizontal.z) + this.rotationOffset;
            let diff = targetYaw - this.mesh.rotation.y;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.mesh.rotation.y += diff * Math.min(1, deltaTime * 15);
        }

        const jumpAction = this.animationController.actions.get('Jump');
        if (this.stateMachine.isJumpLocked && jumpAction && jumpAction.time >= jumpAction.getClip().duration - 0.03) {
            this.stateMachine.notifyJumpFinished();
        }

        if (state !== this.lastState) {
            this.animationController.Play(state);
            this.lastState = state;
        }

        this.animationController.update(deltaTime);
    }
}
