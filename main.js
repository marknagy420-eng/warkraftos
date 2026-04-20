import * as THREE from 'three';
import { Player } from './controls/Player.js';
import { World } from './World.js';
import { UI } from './UI.js';
import { CONFIG } from './config.js';
import { distance2D } from './utils.js';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000); // Increased far plane to 5000
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: false, // Disabling antialiasing for significant performance boost
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(1); // Lock pixel ratio to 1 for performance on high-DPI devices
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap; // Faster shadow maps
        document.body.appendChild(this.renderer.domElement);

        this.clock = new THREE.Timer();
        
        // Initialize Components
        this.ui = new UI();
        this.player = new Player(this.scene, this.camera, this.renderer.domElement);
        this.world = new World(this.scene);
        
        this.setupEventListeners();
        this.animate();
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Simple Combat System
        window.addEventListener('player-attack', (e) => {
            const { player } = e.detail;
            
            // Get camera forward direction to determine attack arc
            const camForward = new THREE.Vector3(0, 0, -1);
            camForward.applyQuaternion(this.camera.quaternion);
            camForward.y = 0;
            camForward.normalize();

            this.world.enemies.forEach(enemy => {
                if (!enemy.isDead) {
                    const toEnemy = new THREE.Vector3().subVectors(enemy.mesh.position, player.mesh.position);
                    const dist = toEnemy.length();
                    toEnemy.normalize();
                    
                    // Dot product check for ~90 degree cone in front of camera
                    const dot = camForward.dot(toEnemy);
                    
                    if (dist < CONFIG.PLAYER.ATTACK_RANGE && dot > 0.5) {
                        enemy.takeDamage(CONFIG.PLAYER.DAMAGE);
                        this.showHitEffect(enemy.mesh.position);
                    }
                }
            });
        });
    }

    showHitEffect(pos) {
        // More robust hit effect without setInterval
        const sphereGeo = new THREE.SphereGeometry(0.5, 12, 12);
        const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
        const hit = new THREE.Mesh(sphereGeo, sphereMat);
        hit.position.copy(pos);
        hit.position.y += 1.5;
        this.scene.add(hit);
        
        const startTime = performance.now();
        const duration = 400;

        const animateHit = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            hit.scale.setScalar(1 + progress * 2);
            hit.material.opacity = 1 - progress;
            
            if (progress < 1) {
                requestAnimationFrame(animateHit);
            } else {
                this.scene.remove(hit);
                hit.geometry.dispose();
                hit.material.dispose();
            }
        };
        requestAnimationFrame(animateHit);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = Math.min(this.clock.getDelta(), 0.1); // Cap deltaTime
        
        this.player.update(deltaTime, this.world);
        this.world.update(deltaTime, this.player);
        
        this.renderer.render(this.scene, this.camera);
    }
}

new Game();
