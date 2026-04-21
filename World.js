import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { CONFIG } from './config.js';
import { Enemy } from './Enemy.js';
import { DeerNPC } from './DeerNPC.js';
import { getRandomPosition } from './utils.js';

export class World {
    constructor(scene, settings = {}) {
        this.settings = settings;
        this.scene = scene;
        this.enemies = [];
        this.chests = [];
        this.huts = []; 
        this.trees = [];
        this.goblinGltf = null;
        this.treeGltf = null;
        this.twistedTreeGltf = null;
        this.hutGltf = null;
        this.grassGltf = null;
        this.deerGltf = null;
        this.deerNpcs = [];
        this.ruinsGltf = null;
        this.wallColliders = [];
        this.pathTreeMarkers = [];
        this.hutMarkers = [];
        this.ruinsPosition = new THREE.Vector3(-420, 0, 0);
        
        // Spatial Database (Grid) for performance optimization
        this.gridSize = 20; 
        this.spatialGrid = new Map();

        this.setupLights();
        this.setupGround();
        this.setupSky();
        this.loadModels();
        this.applyQualitySettings(this.settings);
    }

    addToGrid(obj, type) {
        const gx = Math.floor(obj.position.x / this.gridSize);
        const gz = Math.floor(obj.position.z / this.gridSize);
        const key = `${gx},${gz}`;
        if (!this.spatialGrid.has(key)) this.spatialGrid.set(key, []);
        this.spatialGrid.get(key).push({ ...obj, type });
    }

    getNearbyObjects(pos, radius = 1) {
        const gx = Math.floor(pos.x / this.gridSize);
        const gz = Math.floor(pos.z / this.gridSize);
        let objects = [];
        
        // Check current cell and neighbors
        for (let x = gx - 1; x <= gx + 1; x++) {
            for (let z = gz - 1; z <= gz + 1; z++) {
                const key = `${x},${z}`;
                if (this.spatialGrid.has(key)) {
                    objects.push(...this.spatialGrid.get(key));
                }
            }
        }
        return objects;
    }

    loadModels() {
        const loader = new GLTFLoader();
        
        // Load Tree Model
        loader.load('assets/twisted tree 3d model (1).glb', (gltf) => {
            this.twistedTreeGltf = gltf;
            this.treeGltf = this.treeGltf || gltf;
            this.setupEnvironment();
        }, undefined, () => {
            loader.load('assets/stylizedgeometrictree3dmodel.glb', (gltf) => {
                this.treeGltf = gltf;
                this.setupEnvironment();
            }, undefined, (error) => {
                console.error('Error loading tree model:', error);
                this.setupEnvironment();
            });
        });

        // Load Grass Model
        loader.load('assets/deadgrass3dmodel.glb', (gltf) => {
            this.grassGltf = gltf;
            this.setupGrass();
        });

        // Load Goblin Model
        loader.load(
            'assets/goblin.glb',
            (gltf) => {
                this.goblinGltf = gltf;
                this.setupEnemies();
            },
            null,
            (error) => {
                console.error('Failed to load goblin.glb:', error);
                this.setupEnemies();
            }
        );

        // Load Cottage Model
        loader.load('assets/fantasycottage3dmodel_clone1.glb', (gltf) => {
            this.hutGltf = gltf;
            
            // Calculate minY for the hut so it sits on ground
            let hutMesh = null;
            gltf.scene.traverse(child => {
                if (child.isMesh && !hutMesh) hutMesh = child;
            });
            if (hutMesh) {
                hutMesh.geometry.computeBoundingBox();
                this.hutMinY = hutMesh.geometry.boundingBox.min.y;
            } else {
                this.hutMinY = 0;
            }

            // Place huts once loaded (doubled scale in createHut)
            this.createHut(new THREE.Vector3(25, 0, 25));
            this.createHut(new THREE.Vector3(-25, 0, 25));
            this.createHut(new THREE.Vector3(25, 0, -25));
            this.createHut(new THREE.Vector3(-25, 0, -25));
            this.createHut(new THREE.Vector3(0, 0, 45));
        });

        loader.load('assets/ancient ruins 3d model.glb', (gltf) => {
            this.ruinsGltf = gltf;
            this.createAncientRuins(this.ruinsPosition.clone());
            this.setupRuinsPathTrees();
        });

        // Load passive Deer NPC model
        loader.load(
            'assets/deer+3d+model_Clone1.glb',
            (gltf) => {
                this.deerGltf = gltf;
                this.setupDeerNpcs();
            },
            undefined,
            (error) => {
                console.warn('Failed to load deer+3d+model_Clone1.glb (passive NPC disabled):', error);
            }
        );
    }


    applyQualitySettings(settings) {
        this.settings = { ...this.settings, ...settings };
        const qualityMap = { low: 0.8, medium: 0.9, high: 1, ultra: 1.25 };
        const textureAniso = { low: 1, medium: 2, high: 4, ultra: 8 };
        const scalar = qualityMap[this.settings.textureQuality] || 1;
        this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.0022 / scalar);
        if (this.terrain?.material?.map) {
            this.terrain.material.map.anisotropy = textureAniso[this.settings.textureQuality] || 4;
            this.terrain.material.needsUpdate = true;
        }
        this.enemies.forEach((enemy) => enemy.applyQualitySettings?.(this.settings));
    }

    setupLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.45);
        this.scene.add(ambient);
        
        const directional = new THREE.DirectionalLight(0xffffff, 1.65);
        directional.position.set(100, 200, 100);
        directional.castShadow = true;
        directional.shadow.mapSize.width = 2048;
        directional.shadow.mapSize.height = 2048;
        directional.shadow.camera.left = -300;
        directional.shadow.camera.right = 300;
        directional.shadow.camera.top = 300;
        directional.shadow.camera.bottom = -300;
        directional.shadow.camera.near = 1;
        directional.shadow.camera.far = 700;
        directional.shadow.bias = -0.00015;
        directional.shadow.normalBias = 0.02;
        directional.shadow.radius = 1.2;
        this.scene.add(directional);

        // Fog for atmosphere and performance (draw distance feel)
        this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.002);
    }

    setupGround() {
        const textureLoader = new THREE.TextureLoader();
        const groundTexture = textureLoader.load('assets/fold.jpg');
        groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
        groundTexture.repeat.set(100, 100);

        // Balanced resolution for terrain performance
        const size = CONFIG.WORLD.SIZE;
        const segments = 128; 
        const groundGeo = new THREE.PlaneGeometry(size, size, segments, segments);
        
        // Add mountains using noise-like function
        const vertices = groundGeo.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 1];
            // Simple mountain generation using trig functions
            const d = Math.sqrt(x*x + z*z);
            if (d > 60) { // Keep village area flat (matched with getTerrainHeight)
                const h = (Math.sin(x * 0.015) * Math.cos(z * 0.015) * 12) + 
                          (Math.sin(x * 0.04) * 4) + 
                          (Math.cos(z * 0.04) * 4);
                vertices[i + 2] = Math.max(0, h);
            }
        }
        groundGeo.computeVertexNormals();

        const groundMat = new THREE.MeshStandardMaterial({ 
            map: groundTexture,
            roughness: 0.9,
            flatShading: false
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.terrain = ground; 
    }

    setupSky() {
        // Create a large sky dome
        const skyGeo = new THREE.SphereGeometry(2500, 32, 32);
        const skyMat = new THREE.MeshBasicMaterial({ 
            color: 0x87ceeb, // Sky blue
            side: THREE.BackSide 
        });
        this.sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(this.sky);

        // Add cloud billboards from texture
        this.clouds = new THREE.Group();
        this.scene.add(this.clouds);
        const cloudTexture = new THREE.TextureLoader().load('assets/Clouds-Transparent-Image-1.png');
        for (let i = 0; i < 60; i++) {
            const cloud = new THREE.Sprite(new THREE.SpriteMaterial({
                map: cloudTexture,
                transparent: true,
                depthWrite: false,
                opacity: 0.85
            }));
            const s = 120 + Math.random() * 150;
            cloud.scale.set(s, s * 0.55, 1);
            const pos = getRandomPosition(1500);
            cloud.position.set(pos.x, 200 + Math.random() * 100, pos.z);
            this.clouds.add(cloud);
        }
    }

    getTerrainHeight(x, z) {
        if (!this.terrain) return 0;
        const d = Math.sqrt(x*x + z*z);
        if (d <= 60) return 0; // Slightly larger flat village area
        
        // Softer mountains for easier climbing
        const h = (Math.sin(x * 0.015) * Math.cos(z * 0.015) * 12) + 
                  (Math.sin(x * 0.04) * 4) + 
                  (Math.cos(z * 0.04) * 4);
        return Math.max(0, h);
    }

    setupEnvironment() {
        if (this.treeGltf || this.twistedTreeGltf) {
            this.setupInstancedTrees();
        }

        if (this.pathTreeMarkers.length === 0 && this.ruinsGltf) {
            this.setupRuinsPathTrees();
        }

        // Add Treasure chests
        for (let i = 0; i < CONFIG.WORLD.TREASURE_COUNT; i++) {
            const pos = getRandomPosition(CONFIG.WORLD.SIZE / 2);
            if (pos.length() < 40) {
                i--;
                continue;
            }
            this.createChest(pos);
        }
    }

    setupInstancedTrees() {
        const treeScene = (this.twistedTreeGltf || this.treeGltf).scene;
        let treeMesh = null;
        treeScene.traverse(child => {
            if (child.isMesh && !treeMesh) treeMesh = child;
        });

        if (!treeMesh) return;

        treeMesh.geometry.computeBoundingBox();
        const minY = treeMesh.geometry.boundingBox.min.y;

        const count = CONFIG.WORLD.TREE_COUNT;
        const instancedMesh = new THREE.InstancedMesh(treeMesh.geometry, treeMesh.material, count);
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < count; i++) {
            const pos = getRandomPosition(CONFIG.WORLD.SIZE / 2);
            if (pos.length() < 35) { 
                i--;
                continue;
            }

            const terrainH = this.getTerrainHeight(pos.x, pos.z);
            const s = 8 + Math.random() * 8; // Doubled height (was 4-8, now 8-16)
            dummy.position.set(pos.x, terrainH - (minY * s), pos.z);
            dummy.rotation.y = Math.random() * Math.PI * 2;
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);

            // Add to database
            const treeData = {
                position: new THREE.Vector3(pos.x, terrainH, pos.z),
                radius: 2.0 // Increased collision radius for larger trees
            };
            this.addToGrid(treeData, 'TREE');
        }

        this.scene.add(instancedMesh);
        this.treeInstances = instancedMesh;
    }

    createHut(pos) {
        if (!this.hutGltf) return;

        const hut = cloneSkeleton(this.hutGltf.scene);
        const terrainH = this.getTerrainHeight(pos.x, pos.z);
        
        const scale = 16; 
        hut.scale.set(scale, scale, scale);
        hut.position.set(pos.x, terrainH - (this.hutMinY * scale), pos.z);
        hut.rotation.y = Math.random() * Math.PI * 2;

        hut.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        this.scene.add(hut);
        this.hutMarkers.push(new THREE.Vector3(pos.x, terrainH, pos.z));

        // Add to database
        const hutData = {
            position: new THREE.Vector3(pos.x, terrainH, pos.z),
            radius: 14 
        };
        this.addToGrid(hutData, 'HUT');
    }

    createAncientRuins(pos) {
        if (!this.ruinsGltf) return;

        const ruins = cloneSkeleton(this.ruinsGltf.scene);
        const terrainH = this.getTerrainHeight(pos.x, pos.z);
        const scale = 48;

        ruins.scale.setScalar(scale);
        ruins.position.set(pos.x, terrainH, pos.z);

        ruins.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(ruins);
        ruins.position.y -= box.min.y - terrainH;

        ruins.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.frustumCulled = false;
            }
        });

        this.scene.add(ruins);
        this.addRuinsWallColliders(ruins);
    }


    setupRuinsPathTrees() {
        const source = this.twistedTreeGltf || this.treeGltf;
        if (!source?.scene) return;

        const startX = this.ruinsPosition.x + 40;
        const endX = this.ruinsPosition.x + 320;
        const rowOffset = 14;
        const step = 12;

        for (let x = startX; x <= endX; x += step) {
            this.spawnPathTree(new THREE.Vector3(x, 0, -rowOffset));
            this.spawnPathTree(new THREE.Vector3(x, 0, rowOffset));
        }
    }

    spawnPathTree(pos) {
        const source = this.twistedTreeGltf || this.treeGltf;
        if (!source?.scene) return;

        const tree = cloneSkeleton(source.scene);
        const terrainH = this.getTerrainHeight(pos.x, pos.z);
        const s = 7 + Math.random() * 3;

        tree.scale.setScalar(s);
        tree.position.set(pos.x, terrainH, pos.z);
        tree.rotation.y = Math.random() * Math.PI * 2;

        tree.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(tree);
        tree.position.y -= box.min.y - terrainH;

        tree.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        this.scene.add(tree);
        this.pathTreeMarkers.push(new THREE.Vector3(pos.x, terrainH, pos.z));
        this.addToGrid({ position: new THREE.Vector3(pos.x, terrainH, pos.z), radius: 2.4 }, 'TREE');
    }

    getPlayerSpawnPoint() {
        const terrainH = this.getTerrainHeight(this.ruinsPosition.x, this.ruinsPosition.z);
        return new THREE.Vector3(this.ruinsPosition.x + 8, terrainH, this.ruinsPosition.z + 4);
    }

    getMapPoints() {
        return {
            ruins: this.ruinsPosition.clone(),
            huts: this.hutMarkers.map((h) => h.clone()),
            pathTrees: this.pathTreeMarkers.map((t) => t.clone())
        };
    }
    addRuinsWallColliders(ruins) {
        ruins.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(ruins);
        const minX = box.min.x;
        const maxX = box.max.x;
        const minZ = box.min.z;
        const maxZ = box.max.z;
        const centerX = (minX + maxX) / 2;
        const doorwayHalf = 6;
        const wallThickness = 2.5;

        this.wallColliders.push(
            { minX: minX - wallThickness, maxX: minX + wallThickness, minZ, maxZ },
            { minX: maxX - wallThickness, maxX: maxX + wallThickness, minZ, maxZ },
            { minX: minX, maxX: centerX - doorwayHalf, minZ: minZ - wallThickness, maxZ: minZ + wallThickness },
            { minX: centerX + doorwayHalf, maxX: maxX, minZ: minZ - wallThickness, maxZ: minZ + wallThickness },
            { minX: minX, maxX: centerX - doorwayHalf, minZ: maxZ - wallThickness, maxZ: maxZ + wallThickness },
            { minX: centerX + doorwayHalf, maxX: maxX, minZ: maxZ - wallThickness, maxZ: maxZ + wallThickness }
        );
    }

    setupGrass() {
        if (!this.grassGltf) return;

        let grassMesh = null;
        this.grassGltf.scene.traverse(child => {
            if (child.isMesh && !grassMesh) grassMesh = child;
        });

        if (!grassMesh) return;

        grassMesh.geometry.computeBoundingBox();
        const minY = grassMesh.geometry.boundingBox.min.y;

        const count = 7000; // Balanced count for high performance
        const instancedMesh = new THREE.InstancedMesh(grassMesh.geometry, grassMesh.material, count);
        instancedMesh.receiveShadow = false; // Disable grass shadows for major FPS boost
        instancedMesh.castShadow = false;
        instancedMesh.frustumCulled = true; 

        const dummy = new THREE.Object3D();
        for (let i = 0; i < count; i++) {
            const pos = getRandomPosition(CONFIG.WORLD.SIZE / 2);
            if (pos.length() < 15) {
                i--;
                continue;
            }

            const terrainH = this.getTerrainHeight(pos.x, pos.z);
            const s = 1.5 + Math.random() * 2; // ~half size grass compared to previous setup
            dummy.position.set(pos.x, terrainH - (minY * s), pos.z);
            dummy.rotation.y = Math.random() * Math.PI * 2;
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }

        this.scene.add(instancedMesh);
    }

    checkCollisions(playerPosition, radius = 1) {
        const nearby = this.getNearbyObjects(playerPosition);
        for (const obj of nearby) {
            const dx = playerPosition.x - obj.position.x;
            const dz = playerPosition.z - obj.position.z;
            const distSq = dx * dx + dz * dz;
            const minDist = obj.radius + radius;
            
            if (distSq < minDist * minDist) {
                const dist = Math.sqrt(distSq);
                const angle = Math.atan2(dz, dx);
                const pushDist = minDist - dist;
                return new THREE.Vector3(Math.cos(angle) * pushDist, 0, Math.sin(angle) * pushDist);
            }
        }

        for (const wall of this.wallColliders) {
            const clampedX = Math.max(wall.minX, Math.min(playerPosition.x, wall.maxX));
            const clampedZ = Math.max(wall.minZ, Math.min(playerPosition.z, wall.maxZ));
            const dx = playerPosition.x - clampedX;
            const dz = playerPosition.z - clampedZ;
            const distSq = dx * dx + dz * dz;
            if (distSq >= radius * radius) continue;

            const dist = Math.sqrt(Math.max(0.0001, distSq));
            const push = radius - dist;
            return new THREE.Vector3((dx / dist) * push, 0, (dz / dist) * push);
        }
        return null;
    }

    createChest(pos) {
        const terrainH = this.getTerrainHeight(pos.x, pos.z);
        const chestGeo = new THREE.BoxGeometry(1, 0.6, 0.6);
        const chestMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f });
        const chest = new THREE.Mesh(chestGeo, chestMat);
        chest.position.set(pos.x, terrainH + 0.3, pos.z);
        this.scene.add(chest);
        this.chests.push(chest);
    }

    setupEnemies() {
        for (let i = 0; i < CONFIG.WORLD.GOBLIN_CAMP_COUNT; i++) {
            const campPos = getRandomPosition(CONFIG.WORLD.SIZE / 2);
            if (campPos.length() < 40) {
                i--;
                continue;
            }

            const count = 2 + Math.floor(Math.random() * 2);
            for (let j = 0; j < count; j++) {
                const offset = new THREE.Vector3(
                    (Math.random() - 0.5) * 5,
                    0,
                    (Math.random() - 0.5) * 5
                );
                const pos = campPos.clone().add(offset);
                pos.y = this.getTerrainHeight(pos.x, pos.z);
                const enemy = new Enemy(this.scene, 'GOBLIN', pos, this.goblinGltf);
                enemy.applyQualitySettings?.(this.settings);
                enemy.applyDifficultySettings?.(this.settings);
                this.enemies.push(enemy);
            }
        }
    }

    setupDeerNpcs() {
        if (!this.deerGltf) return;

        for (let i = 0; i < CONFIG.WORLD.DEER_COUNT; i++) {
            const pos = getRandomPosition(CONFIG.WORLD.SIZE / 2);
            if (pos.length() < 30) {
                i--;
                continue;
            }
            pos.y = this.getTerrainHeight(pos.x, pos.z);
            const deer = new DeerNPC(this.scene, pos, this.deerGltf, this);
            this.deerNpcs.push(deer);
        }
    }

    update(deltaTime, player) {
        // Move sky with player to avoid clipping
        if (this.sky) {
            this.sky.position.copy(player.mesh.position);
        }

        this.enemies.forEach(enemy => enemy.update(deltaTime, player, this));
        this.deerNpcs.forEach((deer) => deer.update(deltaTime));
        
        // Check for chest pickup
        this.chests.forEach((chest, index) => {
            if (chest.visible && player.mesh.position.distanceTo(chest.position) < 2) {
                chest.visible = false;
                window.dispatchEvent(new CustomEvent('chest-opened', { detail: { gold: 50 } }));
            }
        });
    }
}
