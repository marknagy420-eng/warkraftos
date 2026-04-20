// Kanonikus vezérlő-stack implementáció: ezt használja a játék runtime.
import * as THREE from 'three';
import { MobileControls } from './rosieMobileControls.js';

/**
 * PlayerController - Handles player movement and physics
 */
class PlayerController {
  constructor(player, options = {}) {
    this.player = player;

    // Configuration
    this.moveSpeed = options.moveSpeed || 10;
    this.jumpForce = options.jumpForce || 15;
    this.gravity = options.gravity || 30;
    this.groundLevel = options.groundLevel || 1; // Assuming base ground is at y=0, player bottom at y=0.4

    // State
    this.velocity = new THREE.Vector3();
    this.isOnGround = true;
    this.canJump = true;
    this.keys = {};
    this.cameraMode = 'third-person'; // Default camera mode
    this.modelFacingOffset = options.modelFacingOffset ?? Math.PI / 2;

    // Setup input handlers
    this.setupInput();

    // Initialize mobile controls (handles its own detection and activation)
    this.mobileControls = new MobileControls(this);
  }

  setupInput() {
    window.addEventListener('keydown', (e) => {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      this.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('blur', () => {
      this.keys = {};
    });
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
  }

  getMoveDirection() {
    let moveX = 0;
    let moveZ = 0;

    if (this.keys['KeyW']) moveZ -= 1;
    if (this.keys['KeyS']) moveZ += 1;
    if (this.keys['KeyA']) moveX -= 1;
    if (this.keys['KeyD']) moveX += 1;

    // Mobile support
    if (this.mobileControls && this.mobileControls.joystickActive) {
        moveX += this.mobileControls.joystickVector.x;
        moveZ += -this.mobileControls.joystickVector.y;
    }

    const direction = new THREE.Vector3(moveX, 0, moveZ);
    if (direction.lengthSq() > 0) {
        direction.normalize();
        // Rotate direction to be relative to camera
        // (Note: this assumes we have access to the camera's rotation, 
        // but it's simpler to just return the local direction if we want the camera to follow)
        // Wait, if the camera follows the direction, and the direction is relative to camera, 
        // we might get a feedback loop.
        
        // Actually, if we want "Auto-Follow", usually we want the camera to rotate 
        // if we are moving "sideways" relative to it.
    }
    return direction;
  }

  /**
   * Updates the player's state, velocity, and position.
   * @param {number} deltaTime Time elapsed since the last frame.
   * @param {number} cameraRotation The current horizontal rotation (yaw) of the active camera.
   */
  update(deltaTime, cameraRotation) {
    const dt = Math.max(deltaTime || 0, 1 / 240);
    // Apply gravity
    // Check if the player's base (center y - half height approx) is above ground
    // Note: Player model base is roughly at world y = player.position.y
    if (this.player.position.y > this.groundLevel) {
      this.velocity.y -= this.gravity * dt;
      this.isOnGround = false;
    } else {
      // Clamp player to ground level and reset vertical velocity
      this.velocity.y = Math.max(0, this.velocity.y); // Stop downward velocity, allow upward (jump)
      this.player.position.y = this.groundLevel;
      this.isOnGround = true;
      this.canJump = true; // Can jump again once grounded
    }

    // Handle jumping
    if (this.keys['Space'] && this.isOnGround && this.canJump) {
      this.velocity.y = this.jumpForce;
      this.isOnGround = false;
      this.canJump = false; // Prevent double jumps until grounded again
    }

    // --- Horizontal Movement ---

    let moveX = 0;
    let moveZ = 0;

    // Calculate movement direction vectors relative to the camera's horizontal rotation
    // Forward direction (local -Z) rotated by camera yaw
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation);
    // Right direction (local +X) rotated by camera yaw
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation);

    const currentMoveSpeed = this.moveSpeed;

    if (this.keys['KeyW']) { moveX += forward.x; moveZ += forward.z; }
    if (this.keys['KeyS']) { moveX -= forward.x; moveZ -= forward.z; }
    if (this.keys['KeyA']) { moveX -= right.x; moveZ -= right.z; }
    if (this.keys['KeyD']) { moveX += right.x; moveZ += right.z; }

    const moveDirection = new THREE.Vector3(moveX, 0, moveZ);
    if (moveDirection.lengthSq() > 0) {
        moveDirection.normalize();
    }

    const targetVelocityX = moveDirection.x * currentMoveSpeed;
    const targetVelocityZ = moveDirection.z * currentMoveSpeed;

    // Apply acceleration for smooth speed transitions (helps animation blending)
    const accel = this.isOnGround ? 12 : 6;
    this.velocity.x += (targetVelocityX - this.velocity.x) * accel * dt;
    this.velocity.z += (targetVelocityZ - this.velocity.z) * accel * dt;


    // --- Update Player Position ---
    this.player.position.x += this.velocity.x * dt;
    this.player.position.y += this.velocity.y * dt;
    this.player.position.z += this.velocity.z * dt;


    // --- Update Player Rotation ---
    // Both animations should follow movement direction (character rotates toward movement)
    if (this.cameraMode === 'third-person') {
      const horizontalVelocity = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
      if (horizontalVelocity.lengthSq() > 0.1) {
        const targetRotation = Math.atan2(horizontalVelocity.x, horizontalVelocity.z) + this.modelFacingOffset;
        
        let diff = targetRotation - this.player.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        // Smoothly rotate character to face movement direction
        this.player.rotation.y += diff * 15 * dt;
      }
    }
  }

  destroy() {
    // Clean up mobile controls
    this.mobileControls.destroy();
  }
}

/**
 * ThirdPersonCameraController - Handles third-person camera positioning and rotation
 */
class ThirdPersonCameraController {
  constructor(camera, target, domElement, options = {}) {
    this.camera = camera;
    this.target = target;
    this.domElement = domElement;

    // Configuration
    this.distance = options.distance || 8;
    this.minDistance = options.minDistance || 2.5;
    this.maxDistance = options.maxDistance || 12;
    this.height = options.height || 4;
    this.rotationSpeed = options.rotationSpeed || 0.003;
    this.pitchSpeed = options.pitchSpeed || 0.003;
    this.autoRotationSpeed = options.autoRotationSpeed || 4.0; // Faster camera following player rotation
    this.fixedBehind = options.fixedBehind ?? false;

    // State
    this.rotation = 0; // Yaw (0 = behind player facing -Z)
    this.pitch = options.pitch ?? 0.2; // Pitch (radians)
    this.isDragging = false;
    this.mousePosition = { x: 0, y: 0 };
    this.enabled = true;

    // Setup controls
    this.setupControls();
  }

  setupControls() {
    if (this.fixedBehind) {
      return;
    }

    // Pointer lock for immersive 3rd person
    this.domElement.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0) { // Left click
        this.domElement.requestPointerLock();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      
      if (document.pointerLockElement === this.domElement) {
        // Pointer lock mode
        this.rotation -= e.movementX * this.rotationSpeed;
        this.pitch += e.movementY * this.pitchSpeed;
        this.pitch = Math.max(-0.5, Math.min(1.2, this.pitch)); // Clamp pitch
      } else if (this.isDragging) {
        // Fallback drag mode
        const deltaX = e.clientX - this.mousePosition.x;
        const deltaY = e.clientY - this.mousePosition.y;
        this.rotation -= deltaX * this.rotationSpeed;
        this.pitch += deltaY * this.pitchSpeed;
        this.pitch = Math.max(-0.5, Math.min(1.2, this.pitch));
        this.mousePosition = { x: e.clientX, y: e.clientY };
      }
    });

    this.domElement.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== this.domElement) {
        this.isDragging = true;
        this.mousePosition = { x: e.clientX, y: e.clientY };
      }
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.domElement.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      const zoomStep = e.deltaY * 0.01;
      this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance + zoomStep));
    }, { passive: false });

    // Touch controls
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      let touchStart = null;
      this.domElement.addEventListener('touchstart', (e) => {
        if (!this.enabled || e.touches.length !== 1) return;
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      });
      this.domElement.addEventListener('touchmove', (e) => {
        if (!this.enabled || !touchStart || e.touches.length !== 1) return;
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStart.x;
        const deltaY = touch.clientY - touchStart.y;
        this.rotation -= deltaX * this.rotationSpeed * 2;
        this.pitch += deltaY * this.pitchSpeed * 2;
        this.pitch = Math.max(-0.5, Math.min(1.2, this.pitch));
        touchStart = { x: touch.clientX, y: touch.clientY };
      });
    }
  }

  enable() { this.enabled = true; }
  disable() { this.enabled = false; this.isDragging = false; }

  update(deltaTime = 0.016, playerYaw = null) {
    if (!this.enabled) return 0;

    if (this.fixedBehind && typeof playerYaw === 'number') {
      this.rotation = playerYaw + Math.PI;
    } else if (typeof playerYaw === 'number' &&
        document.pointerLockElement !== this.domElement && !this.isDragging) {
      // Keep camera naturally behind the character unless the user is actively rotating camera.
      const desiredBehind = playerYaw + Math.PI;
      let diff = desiredBehind - this.rotation;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.rotation += diff * this.autoRotationSpeed * deltaTime;
    }

    // Calculate camera position using spherical coordinates
    // Yaw: this.rotation, Pitch: this.pitch
    const x = Math.sin(this.rotation) * Math.cos(this.pitch) * this.distance;
    const y = Math.sin(this.pitch) * this.distance + this.height;
    const z = Math.cos(this.rotation) * Math.cos(this.pitch) * this.distance;

    const offset = new THREE.Vector3(x, y, z);

    // Position camera
    this.camera.position.copy(this.target.position).add(offset);

    // Look at target (slightly above pivot)
    this.camera.lookAt(
      this.target.position.x,
      this.target.position.y + 1.5,
      this.target.position.z
    );

    return this.rotation;
  }

  destroy() {}
}

/**
 * FirstPersonCameraController - Handles first-person camera controls
 */
class FirstPersonCameraController {
  constructor(camera, player, domElement, options = {}) {
    this.camera = camera;
    this.player = player;
    this.domElement = domElement;

    // Configuration
    this.eyeHeight = options.eyeHeight || 1.6;
    this.mouseSensitivity = options.mouseSensitivity || 0.002;

    // State
    this.enabled = false;
    this.rotationY = 0;
    this.rotationX = 0;

    // Setup mouse controls
    this.setupMouseControls();
  }

  setupMouseControls() {
    // Desktop pointer lock
    this.domElement.addEventListener('click', () => {
      if (this.enabled && document.pointerLockElement !== this.domElement) {
        this.domElement.requestPointerLock();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || document.pointerLockElement !== this.domElement) return;

      this.rotationY -= e.movementX * this.mouseSensitivity;
      this.rotationX -= e.movementY * this.mouseSensitivity;

      // Limit vertical rotation
      this.rotationX = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, this.rotationX));
    });

    // Touch controls for mobile (only if mobile)
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      let touchStart = null;

      // Helper function to check if touch is over mobile UI elements
      const isTouchOverMobileUI = (touch) => {
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        return element && (
          element.id === 'mobile-game-controls' ||
          element.id === 'virtual-joystick' ||
          element.id === 'virtual-joystick-knob' ||
          element.id === 'jump-button' ||
          element.closest('#mobile-game-controls')
        );
      };

      this.domElement.addEventListener('touchstart', (e) => {
        if (!this.enabled || e.touches.length !== 1) return;

        // Don't handle touch if it's over mobile UI
        if (isTouchOverMobileUI(e.touches[0])) return;

        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        e.preventDefault();
      });

      this.domElement.addEventListener('touchmove', (e) => {
        if (!this.enabled || !touchStart || e.touches.length !== 1) return;

        // Don't handle touch if it started over mobile UI
        if (isTouchOverMobileUI(e.touches[0])) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStart.x;
        const deltaY = touch.clientY - touchStart.y;

        this.rotationY -= deltaX * this.mouseSensitivity * 2;
        this.rotationX -= deltaY * this.mouseSensitivity * 2;
        this.rotationX = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, this.rotationX));

        touchStart = { x: touch.clientX, y: touch.clientY };
        e.preventDefault();
      });

      this.domElement.addEventListener('touchend', (e) => {
        touchStart = null;
        e.preventDefault();
      });
    }
  }

  enable() {
    this.enabled = true;

    // Note: rotationY will be set by setCameraMode before this is called
    this.rotationX = 0;

    // Hide player when in first-person mode
    this.hidePlayer();
  }

  disable() {
    this.enabled = false;

    // Show player when exiting first-person mode
    this.showPlayer();

    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }

  hidePlayer() {
    // Store current player model visibility state
    this.originalVisibility = [];
    this.player.traverse(child => {
      if (child.isMesh) {
        this.originalVisibility.push({
          object: child,
          visible: child.visible
        });
        child.visible = false;
      }
    });
  }

  showPlayer() {
    // Restore player model visibility
    if (this.originalVisibility) {
      this.originalVisibility.forEach(item => {
        item.object.visible = item.visible;
      });
      this.originalVisibility = null;
    }
  }

  update() {
    if (!this.enabled) return 0;

    // Set player rotation to match camera's horizontal rotation
    this.player.rotation.y = this.rotationY;

    // Position camera at player eye height
    this.camera.position.x = this.player.position.x;
    this.camera.position.y = this.player.position.y + this.eyeHeight;
    this.camera.position.z = this.player.position.z;

    // Set camera rotation
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.x = this.rotationX;
    this.camera.rotation.y = this.rotationY;

    return this.rotationY;
  }
}

export { PlayerController, ThirdPersonCameraController, FirstPersonCameraController };
