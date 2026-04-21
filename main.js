import * as THREE from 'three';
import { Player } from './controls/Player.js';
import { CharacterManager } from './controls/character/CharacterManager.js';
import { CharacterSelectionMenu } from './controls/character/CharacterSelectionMenu.js';
import { LegacyCharacterAdapter } from './controls/character/LegacyCharacterAdapter.js';
import { ModularCharacter } from './controls/character/ModularCharacter.js';
import { World } from './World.js';
import { UI } from './UI.js';
import { CONFIG } from './config.js';
import { StartMenu } from './StartMenu.js';
import { DEFAULT_SETTINGS, GameSettingsStore, t } from './settings.js';

THREE.Cache.enabled = true;

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.settingsStore = new GameSettingsStore();
        this.settings = { ...DEFAULT_SETTINGS, ...this.settingsStore.get() };
        this.savedGameState = this.settingsStore.loadGameState();

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
        this.renderer = this.buildRenderer();
        this.applyGraphicsSettings(this.settings);
        document.body.appendChild(this.renderer.domElement);

        this.clock = new THREE.Clock();
        this.ui = null;
        this.player = null;
        this.characterManager = null;
        this.characterMenu = null;
        this.world = null;
        this.isStarted = false;
        this.mapVisible = false;
        this.mapStaticMarkers = [];

        this.setupMapOverlay();
        this.setupEventListeners();
        this.initStartFlow();
        this.animate();
    }

    buildRenderer() {
        const preferHighPerformance = !!this.settings.useDedicatedGPU;
        const renderer = new THREE.WebGLRenderer({
            antialias: this.settings.graphicsPreset !== 'low',
            powerPreference: preferHighPerformance ? 'high-performance' : 'low-power'
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = this.settings.graphicsPreset !== 'low';
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = this.settings.hdr ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
        renderer.toneMappingExposure = this.settings.brightness / 100;
        return renderer;
    }

    async initStartFlow() {
        const gpuInfo = await this.detectGPU();
        this.startMenu = new StartMenu({
            settings: this.settings,
            hasSave: !!this.savedGameState,
            gpuInfo,
            onApplySettings: (nextSettings) => {
                this.settings = this.settingsStore.save(nextSettings);
                this.applyGraphicsSettings(this.settings);
                this.applyAudioSettings(this.settings);
                this.applyLanguage(this.settings.language);
                this.applyDifficulty(this.settings);
            },
            onStart: ({ mode, characterId }) => {
                if (mode === 'new') this.settingsStore.clearSaves();
                this.startGame({ mode, characterId });
            }
        });
        this.applyLanguage(this.settings.language);
    }

    async detectGPU() {
        try {
            let adapterName = 'WebGL';
            if (navigator.gpu?.requestAdapter) {
                const adapter = await navigator.gpu.requestAdapter();
                if (adapter?.info?.description) adapterName = adapter.info.description;
            }
            const gl = this.renderer.getContext();
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            const webglRenderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown GPU';
            return { text: `GPU: ${adapterName} | Renderer: ${webglRenderer}` };
        } catch {
            return { text: 'GPU detection unavailable in this browser' };
        }
    }

    applyGraphicsSettings(settings) {
        const presetScale = { low: 0.65, medium: 0.8, high: 1, ultra: 1.2 };
        const upscaleScale = { off: 1, quality: 0.95, balanced: 0.8, performance: 0.67 };

        let pixelRatio = Math.min(window.devicePixelRatio || 1, presetScale[settings.graphicsPreset] ?? 1);
        pixelRatio *= upscaleScale[settings.upscale] ?? 1;
        if (!settings.nativeResolution) pixelRatio *= 0.8;
        if (settings.dlss) pixelRatio *= 0.85;

        this.renderer.setPixelRatio(Math.max(0.5, Math.min(pixelRatio, 1.7)));
        this.renderer.shadowMap.enabled = settings.graphicsPreset !== 'low';
        this.renderer.shadowMap.type = settings.graphicsPreset === 'ultra' ? THREE.VSMShadowMap : THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = settings.hdr ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
        this.renderer.toneMappingExposure = settings.brightness / 100;

        if (this.world?.applyQualitySettings) this.world.applyQualitySettings(settings);
        if (this.characterManager?.applyQualitySettings) this.characterManager.applyQualitySettings(settings);
    }

    applyAudioSettings(settings) {
        window.dispatchEvent(new CustomEvent('audio-settings-changed', { detail: settings }));
    }

    applyLanguage(language) {
        window.dispatchEvent(new CustomEvent('language-changed', { detail: { language } }));
        if (this.startMenu?.root?.isConnected) return;
        const prompt = document.getElementById('game-prompt');
        if (prompt) prompt.textContent = t(language, 'hudPrompt');
    }

    applyDifficulty(settings) {
        window.dispatchEvent(new CustomEvent('difficulty-settings-changed', { detail: settings }));
    }

    startGame({ mode = 'new', characterId = 'fbx-warrior' } = {}) {
        if (this.isStarted) return;
        this.ui = new UI(this.settings.language);
        this.player = new Player(this.scene, this.camera, this.renderer.domElement);
        this.world = new World(this.scene, this.settings);

        this.characterManager = new CharacterManager();
        this.characterManager.addCharacter('fbx-warrior', new ModularCharacter(this.scene, this.camera, this.renderer.domElement), { visible: true });
        this.characterManager.addCharacter('legacy', new LegacyCharacterAdapter(this.player), { visible: false });
        this.characterManager.switchTo(characterId);

        const spawn = this.world.getPlayerSpawnPoint?.();
        if (spawn) {
            this.player.mesh.position.copy(spawn);
            const modular = this.characterManager.characters.get('fbx-warrior');
            modular?.setSpawnPoint?.(spawn);
        }

        if (mode === 'continue' && this.savedGameState?.position) {
            const activeCharacter = this.characterManager.getActiveCharacter();
            activeCharacter?.mesh?.position?.set(
                this.savedGameState.position.x,
                this.savedGameState.position.y,
                this.savedGameState.position.z
            );
        }

        this.characterMenu = new CharacterSelectionMenu(this.characterManager, this.settings.language);
        this.characterMenu.render();
        this.rebuildMapStaticMarkers();

        this.applyGraphicsSettings(this.settings);
        this.applyDifficulty(this.settings);
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

        map.append(title, this.mapPlayerDot);
        document.body.appendChild(map);
        this.mapElement = map;
    }

    updateMapPlayerMarker() {
        const active = this.characterManager?.getActiveCharacter();
        if (!active || !this.mapPlayerDot) return;
        const worldRadius = 500;
        const px = Math.max(-worldRadius, Math.min(worldRadius, active.mesh.position.x));
        const pz = Math.max(-worldRadius, Math.min(worldRadius, active.mesh.position.z));
        const left = (px / (worldRadius * 2) + 0.5) * 100;
        const top = (pz / (worldRadius * 2) + 0.5) * 100;
        this.mapPlayerDot.style.left = `${left}%`;
        this.mapPlayerDot.style.top = `${top}%`;
    }

    toMapPercent(pos, worldRadius = 500) {
        const x = Math.max(-worldRadius, Math.min(worldRadius, pos.x));
        const z = Math.max(-worldRadius, Math.min(worldRadius, pos.z));
        return {
            left: (x / (worldRadius * 2) + 0.5) * 100,
            top: (z / (worldRadius * 2) + 0.5) * 100
        };
    }

    addMapMarker(x, z, style = {}) {
        if (!this.mapElement) return;
        const marker = document.createElement('div');
        marker.style.position = 'absolute';
        marker.style.width = style.width || '8px';
        marker.style.height = style.height || '8px';
        marker.style.borderRadius = style.borderRadius || '2px';
        marker.style.background = style.background || '#fff';
        marker.style.border = style.border || '1px solid #111';
        marker.style.transform = 'translate(-50%, -50%)';

        const mapPos = this.toMapPercent({ x, z });
        marker.style.left = `${mapPos.left}%`;
        marker.style.top = `${mapPos.top}%`;
        this.mapElement.appendChild(marker);
        this.mapStaticMarkers.push(marker);
    }

    rebuildMapStaticMarkers() {
        this.mapStaticMarkers.forEach((m) => m.remove());
        this.mapStaticMarkers = [];

        const points = this.world?.getMapPoints?.();
        if (!points) return;

        this.addMapMarker(points.ruins.x, points.ruins.z, { background: '#7f8c8d', width: '14px', height: '14px', borderRadius: '50%' });
        points.huts.forEach((h) => this.addMapMarker(h.x, h.z, { background: '#d35400', width: '10px', height: '10px' }));
        points.pathTrees.forEach((t, i) => {
            if (i % 2 === 0) this.addMapMarker(t.x, t.z, { background: '#1e8449', width: '6px', height: '6px', borderRadius: '50%' });
        });
    }

    setupEventListeners() {
        window.addEventListener('beforeunload', () => {
            const activeCharacter = this.characterManager?.getActiveCharacter();
            if (activeCharacter?.mesh?.position) {
                this.settingsStore.saveGameState({
                    position: {
                        x: activeCharacter.mesh.position.x,
                        y: activeCharacter.mesh.position.y,
                        z: activeCharacter.mesh.position.z
                    },
                    timestamp: Date.now()
                });
            }
        });

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.applyGraphicsSettings(this.settings);
        });

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyM') {
                this.mapVisible = !this.mapVisible;
                this.mapElement.style.display = this.mapVisible ? 'block' : 'none';
                if (this.mapVisible) this.rebuildMapStaticMarkers();
            }
        });

        window.addEventListener('player-attack', () => {
            if (!this.characterManager || !this.world) return;
            const activeCharacter = this.characterManager.getActiveCharacter();
            if (!activeCharacter) return;
            const player = activeCharacter.player || activeCharacter;

            const camForward = new THREE.Vector3(0, 0, -1);
            camForward.applyQuaternion(this.camera.quaternion);
            camForward.y = 0;
            camForward.normalize();

            this.world.enemies.forEach(enemy => {
                if (!enemy.isDead) {
                    const toEnemy = new THREE.Vector3().subVectors(enemy.mesh.position, player.mesh.position);
                    const dist = toEnemy.length();
                    toEnemy.normalize();
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

        const deltaTime = Math.min(Math.max(this.clock.getDelta(), 1 / 240), 0.1);

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
