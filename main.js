import * as THREE from 'three';
import { Player } from './controls/Player.js';
import { CharacterManager } from './controls/character/CharacterManager.js';
import { CharacterSelectionMenu } from './controls/character/CharacterSelectionMenu.js';
import { LegacyCharacterAdapter } from './controls/character/LegacyCharacterAdapter.js';
import { ModularCharacter } from './controls/character/ModularCharacter.js';
import { World } from './World.js';
import { UI } from './UI.js';
import { CONFIG } from './config.js';
import { distance2D } from './utils.js';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000); // Increased far plane to 5000
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);

        // THREE.Clock gives reliable per-frame delta for gameplay movement.
        this.clock = new THREE.Clock();

        this.ui = null;
        this.player = null;
        this.characterManager = null;
        this.characterMenu = null;
        this.world = null;
        this.isStarted = false;
        this.mapVisible = false;

        this.setupStartMenu();
        this.setupMapOverlay();
        this.setupEventListeners();
        this.animate();
    }

    setupStartMenu() {
        const menu = document.createElement('div');
        menu.id = 'start-menu';
        menu.style.position = 'fixed';
        menu.style.inset = '0';
        menu.style.display = 'flex';
        menu.style.flexDirection = 'column';
        menu.style.alignItems = 'center';
        menu.style.justifyContent = 'center';
        menu.style.gap = '12px';
        menu.style.background = 'radial-gradient(circle at top, rgba(39,55,95,0.95), rgba(8,12,24,0.95))';
        menu.style.color = '#f5f6ff';
        menu.style.fontFamily = "'Orbitron', sans-serif";
        menu.style.zIndex = '1000';

        const title = document.createElement('h1');
        title.textContent = 'Warcraft Odyssey';
        title.style.margin = '0';
        title.style.letterSpacing = '2px';

        const info = document.createElement('div');
        info.style.fontSize = '14px';
        info.style.opacity = '0.85';
        info.textContent = 'W = támadás + előre | M = térkép | Egér görgő = zoom';

        const startButton = document.createElement('button');
        startButton.textContent = 'Belépés a játékba';
        startButton.style.padding = '12px 22px';
        startButton.style.fontSize = '16px';
        startButton.style.fontFamily = "'Orbitron', sans-serif";
        startButton.style.border = '2px solid #8aa2ff';
        startButton.style.borderRadius = '8px';
        startButton.style.background = '#192549';
        startButton.style.color = '#fff';
        startButton.style.cursor = 'pointer';
        startButton.addEventListener('click', () => {
            this.startGame();
            menu.remove();
        });

        menu.append(title, info, startButton);
        document.body.appendChild(menu);
    }

    startGame() {
        if (this.isStarted) return;
        this.ui = new UI();
        this.player = new Player(this.scene, this.camera, this.renderer.domElement);
        this.world = new World(this.scene);

        this.characterManager = new CharacterManager();
        this.characterManager.addCharacter('legacy', new LegacyCharacterAdapter(this.player), { visible: true });
        this.characterManager.addCharacter('fbx-warrior', new ModularCharacter(this.scene, this.camera, this.renderer.domElement), { visible: false });

        this.characterMenu = new CharacterSelectionMenu(this.characterManager);
        this.characterMenu.render();

        this.isStarted = true;
    }

    setupMapOverlay() {
        const map = document.createElement('div');
        map.id = 'world-map';
        map.style.position = 'fixed';
        map.style.top = '50%';
        map.style.left = '50%';
        map.style.transform = 'translate(-50%, -50%)';
        map.style.width = 'min(70vw, 760px)';
        map.style.height = 'min(70vh, 520px)';
        map.style.border = '3px solid #6d5d43';
        map.style.borderRadius = '12px';
        map.style.boxShadow = '0 24px 60px rgba(0,0,0,0.5)';
        map.style.background = "url('assets/fold.jpg') center/cover";
        map.style.display = 'none';
        map.style.zIndex = '950';
        map.style.overflow = 'hidden';
        map.style.pointerEvents = 'none';

        const title = document.createElement('div');
        title.textContent = 'WORLD MAP (M)';
        title.style.position = 'absolute';
        title.style.top = '8px';
        title.style.left = '50%';
        title.style.transform = 'translateX(-50%)';
        title.style.padding = '4px 10px';
        title.style.background = 'rgba(15, 10, 3, 0.6)';
        title.style.color = '#f8e8c5';
        title.style.fontFamily = "'Orbitron', sans-serif";
        title.style.fontSize = '13px';
        title.style.borderRadius = '6px';

        this.mapPlayerDot = document.createElement('div');
        this.mapPlayerDot.style.position = 'absolute';
        this.mapPlayerDot.style.width = '12px';
        this.mapPlayerDot.style.height = '12px';
        this.mapPlayerDot.style.borderRadius = '50%';
        this.mapPlayerDot.style.background = '#1abc9c';
        this.mapPlayerDot.style.border = '2px solid #eafff9';
        this.mapPlayerDot.style.transform = 'translate(-50%, -50%)';

        const hutPositions = [
            [25, 25], [-25, 25], [25, -25], [-25, -25], [0, 45]
        ];
        hutPositions.forEach(([x, z]) => {
            const marker = document.createElement('div');
            marker.style.position = 'absolute';
            marker.style.width = '10px';
            marker.style.height = '10px';
            marker.style.background = '#d35400';
            marker.style.border = '1px solid #ffe7cf';
            marker.style.transform = 'translate(-50%, -50%)';
            const nx = (x / 150 + 0.5) * 100;
            const nz = (z / 150 + 0.5) * 100;
            marker.style.left = `${nx}%`;
            marker.style.top = `${nz}%`;
            map.appendChild(marker);
        });

        map.append(title, this.mapPlayerDot);
        document.body.appendChild(map);
        this.mapElement = map;
    }

    updateMapPlayerMarker() {
        const active = this.characterManager?.getActiveCharacter();
        if (!active || !this.mapPlayerDot) return;
        const worldRadius = 150;
        const px = Math.max(-worldRadius, Math.min(worldRadius, active.mesh.position.x));
        const pz = Math.max(-worldRadius, Math.min(worldRadius, active.mesh.position.z));
        const left = (px / (worldRadius * 2) + 0.5) * 100;
        const top = (pz / (worldRadius * 2) + 0.5) * 100;
        this.mapPlayerDot.style.left = `${left}%`;
        this.mapPlayerDot.style.top = `${top}%`;
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        });

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyM') {
                this.mapVisible = !this.mapVisible;
                this.mapElement.style.display = this.mapVisible ? 'block' : 'none';
            }
        });

        // Simple Combat System
        window.addEventListener('player-attack', (e) => {
            if (!this.characterManager || !this.world) return;
            const activeCharacter = this.characterManager.getActiveCharacter();
            if (!activeCharacter) return;
            const player = activeCharacter.player || activeCharacter;
            
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
        
        const deltaTime = Math.min(Math.max(this.clock.getDelta(), 1 / 240), 0.1); // keep movement responsive

        if (this.isStarted && this.characterManager && this.world) {
            this.characterManager.update(deltaTime, this.world);
            const activeCharacter = this.characterManager.getActiveCharacter();
            if (activeCharacter) {
                const playerLike = activeCharacter.player || activeCharacter;
                this.world.update(deltaTime, playerLike);
            }
            this.updateMapPlayerMarker();
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

new Game();
