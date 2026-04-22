import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
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
        this.flowerGltf = null;
        this.coinGltf = null;
        this.roastedRibGltf = null;
        this.deerGltf = null;
        this.deerNpcs = [];
        this.interactables = [];
        this.ruinsGltf = null;
        this.cityDistrictGltf = null;
        this.cityDistrict = null;
        this.wallColliders = [];
        this.structureColliders = [];
        this.pathTreeMarkers = [];
        this.hutMarkers = [];
        this.ruinsPosition = new THREE.Vector3(-420, 0, 0);
        this.districtPosition = new THREE.Vector3(-40, 0, -35);
        this.noSpawnZones = [];
        
        // Spatial Database (Grid) for performance optimization
        this.gridSize = 20; 
        this.spatialGrid = new Map();

        this.loadingManager = new THREE.LoadingManager();
        this.modelLoader = new GLTFLoader(this.loadingManager);
        this.textureLoader = new THREE.TextureLoader(this.loadingManager);
        this.exrLoader = new EXRLoader(this.loadingManager);

        this.setupLights();
        this.setupGround();
        this.setupSky();
        this.setupInteractionInput();
        this.loadModels();
        this.applyQualitySettings(this.settings);
    }

    setupInteractionInput() {
        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            if (e.code === 'KeyF') this.tryPickupNearest();
        });
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
        const loader = this.modelLoader;
        
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
        loader.load('assets/daisy-like+flower+3d+model.glb', (gltf) => {
            this.flowerGltf = gltf;
            this.setupHerbFlowers();
        });
        loader.load('assets/gold+coin+3d+model.glb', (gltf) => {
            this.coinGltf = gltf;
            this.setupCoins();
        });
        loader.load('assets/roasted+pork+rib+3d+model.glb', (gltf) => {
            this.roastedRibGltf = gltf;
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
            this.refreshNoSpawnZones();
        });

        loader.load('assets/ancient ruins 3d model.glb', (gltf) => {
            this.ruinsGltf = gltf;
            this.createAncientRuins(this.ruinsPosition.clone());
            this.setupRuinsPathTrees();
            this.refreshNoSpawnZones();
        });

        const districtAssetCandidates = [
            'assets/e54ed42d-ef68-4559-b887-d32c76877ed1.glb',
            'assets/f50669c8-b9a7-488f-b870-beca07416d60.glb'
        ];
        this.loadFirstAvailableGltf(districtAssetCandidates, (gltf) => {
            this.cityDistrictGltf = gltf;
            this.createCityDistrict(this.districtPosition.clone());
            this.refreshNoSpawnZones();
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
        const shadowMapSize = { low: 512, medium: 768, high: 1024, ultra: 1536 };
        const scalar = qualityMap[this.settings.textureQuality] || 1;
        this.scene.fog = new THREE.FogExp2(0x20232c, 0.003 / scalar);
        if (this.terrain?.material?.map) {
            this.terrain.material.map.anisotropy = textureAniso[this.settings.textureQuality] || 4;
            this.terrain.material.needsUpdate = true;
        }
        if (this.directionalLight) {
            const size = shadowMapSize[this.settings.graphicsPreset] || 1024;
            this.directionalLight.castShadow = this.settings.graphicsPreset !== 'low';
            if (this.directionalLight.shadow.mapSize.width !== size) {
                this.directionalLight.shadow.mapSize.set(size, size);
                this.directionalLight.shadow.needsUpdate = true;
            }
        }
        this.enemies.forEach((enemy) => enemy.applyQualitySettings?.(this.settings));
    }

    applyDifficultySettings(settings) {
        this.settings = { ...this.settings, ...settings };
        this.enemies.forEach((enemy) => enemy.applyDifficultySettings?.(this.settings));
    }

    setupLights() {
        const ambient = new THREE.AmbientLight(0x525466, 0.25);
        this.scene.add(ambient);
        
        const directional = new THREE.DirectionalLight(0xb8c2d9, 1.2);
        directional.position.set(90, 230, 70);
        directional.castShadow = true;
        directional.shadow.mapSize.width = 3072;
        directional.shadow.mapSize.height = 3072;
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
        this.directionalLight = directional;

        const rimLight = new THREE.DirectionalLight(0x5f6782, 0.5);
        rimLight.position.set(-140, 110, -80);
        rimLight.castShadow = true;
        rimLight.shadow.mapSize.width = 2048;
        rimLight.shadow.mapSize.height = 2048;
        rimLight.shadow.camera.left = -260;
        rimLight.shadow.camera.right = 260;
        rimLight.shadow.camera.top = 260;
        rimLight.shadow.camera.bottom = -260;
        rimLight.shadow.camera.near = 1;
        rimLight.shadow.camera.far = 700;
        rimLight.shadow.bias = -0.0002;
        this.scene.add(rimLight);
        this.rimLight = rimLight;

        // Fog for atmosphere and performance (draw distance feel)
        this.scene.fog = new THREE.FogExp2(0x20232c, 0.003);
    }

    setupGround() {
        const groundTexture = this.loadFirstAvailableTexture([
            'assets/Ground068_2K-JPG.jpg',
            'assets/Ground068_2K-JPG_Color.jpg',
            'assets/Ground068_2K-JPG_BaseColor.jpg',
            'assets/fold.jpg'
        ]);
        groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
        groundTexture.repeat.set(80, 80);
        groundTexture.minFilter = THREE.LinearMipmapLinearFilter;
        groundTexture.magFilter = THREE.LinearFilter;

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
        this.activeSkyKey = null;
        this.activeSkyTexture = null;
        this.nextSkyTexture = null;
        this.skyTransition = 1;
        this.nightVariantKey = null;
        this.skyTextureCandidates = {
            dawn: ['assets/DaySkyHDRI042B_1K_HDR.exr', 'assets/DaySkyHDRI042B_1K.exr'],
            day: ['assets/DaySkyHDRI027B_4K_HDR.exr'],
            sunset: ['assets/MorningSkyHDRI011B_4K_HDR.exr'],
            nightA: ['assets/NightSkyHDRI007_4K_HDR.exr'],
            nightB: ['assets/NightSkyHDRI001_4K_HDR.exr']
        };
        this.skyTextures = new Map();
        this.setupSkyBlendDome();
        this.loadSkySet();
    }

    setupSkyBlendDome() {
        const skyGeo = new THREE.SphereGeometry(2500, 32, 32);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                map1: { value: null },
                map2: { value: null },
                mixFactor: { value: 1.0 },
                tint: { value: new THREE.Color(0x1d2230) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D map1;
                uniform sampler2D map2;
                uniform float mixFactor;
                uniform vec3 tint;
                varying vec2 vUv;
                void main() {
                    vec3 c1 = texture2D(map1, vUv).rgb;
                    vec3 c2 = texture2D(map2, vUv).rgb;
                    vec3 mixedSky = mix(c1, c2, mixFactor);
                    float hasTex = step(0.001, dot(c1 + c2, vec3(1.0)));
                    gl_FragColor = vec4(mix(tint, mixedSky, hasTex), 1.0);
                }
            `,
            side: THREE.BackSide,
            depthWrite: false
        });
        this.sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(this.sky);
    }

    setupFallbackClouds() {
        this.clouds = new THREE.Group();
        this.scene.add(this.clouds);
        const cloudTexture = this.textureLoader.load('assets/Clouds-Transparent-Image-1.png');
        cloudTexture.generateMipmaps = false;
        cloudTexture.minFilter = THREE.LinearFilter;
        const cloudCount = this.settings.graphicsPreset === "low" ? 20 : this.settings.graphicsPreset === "medium" ? 35 : 50;
        for (let i = 0; i < cloudCount; i++) {
            const cloud = new THREE.Sprite(new THREE.SpriteMaterial({
                map: cloudTexture,
                transparent: true,
                depthWrite: false,
                opacity: 0.45
            }));
            const s = 120 + Math.random() * 150;
            cloud.scale.set(s, s * 0.55, 1);
            const pos = getRandomPosition(1500);
            cloud.position.set(pos.x, 200 + Math.random() * 100, pos.z);
            this.clouds.add(cloud);
        }
    }

    loadFirstAvailableGltf(candidates, onLoad) {
        const tryLoad = (index = 0) => {
            if (index >= candidates.length) return;
            this.modelLoader.load(
                candidates[index],
                onLoad,
                undefined,
                () => tryLoad(index + 1)
            );
        };
        tryLoad();
    }

    loadFirstAvailableExr(candidates, onLoad, onError) {
        const tryLoad = (index = 0) => {
            if (index >= candidates.length) {
                onError?.();
                return;
            }
            this.exrLoader.load(
                candidates[index],
                onLoad,
                undefined,
                () => tryLoad(index + 1)
            );
        };
        tryLoad();
    }

    loadSkySet() {
        const entries = Object.entries(this.skyTextureCandidates);
        let pending = entries.length;
        let loadedAny = false;
        entries.forEach(([key, candidates]) => {
            this.loadFirstAvailableExr(candidates, (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                texture.colorSpace = THREE.LinearSRGBColorSpace;
                this.skyTextures.set(key, texture);
                loadedAny = true;
                pending--;
                if (pending === 0) this.finishSkyLoading(loadedAny);
            }, () => {
                pending--;
                if (pending === 0) this.finishSkyLoading(loadedAny);
            });
        });
    }

    finishSkyLoading(loadedAny) {
        if (!loadedAny) {
            this.setupFallbackClouds();
            return;
        }
        const initial = this.skyTextures.get('dawn') || [...this.skyTextures.values()][0];
        if (!initial) return;
        this.activeSkyTexture = initial;
        this.nextSkyTexture = initial;
        this.sky.material.uniforms.map1.value = initial;
        this.sky.material.uniforms.map2.value = initial;
        this.scene.environment = initial;
        this.scene.background = null;
    }

    loadFirstAvailableTexture(candidates) {
        const texture = this.textureLoader.load(candidates[candidates.length - 1]);
        let settled = false;
        const tryLoad = (index = 0) => {
            if (index >= candidates.length || settled) return;
            this.textureLoader.load(
                candidates[index],
                (loaded) => {
                    settled = true;
                    texture.image = loaded.image;
                    texture.needsUpdate = true;
                },
                undefined,
                () => tryLoad(index + 1)
            );
        };
        tryLoad(0);
        return texture;
    }

    getSkyKeyForHour(hour) {
        if (hour >= 5 && hour < 8) return 'dawn';
        if (hour >= 8 && hour < 17) return 'day';
        if (hour >= 17 && hour < 20) return 'sunset';
        if (hour >= 20 || hour < 5) {
            if (!this.nightVariantKey || Math.random() < 0.02) {
                this.nightVariantKey = Math.random() < 0.65 ? 'nightA' : 'nightB';
            }
            return this.nightVariantKey;
        }
        return 'day';
    }

    setTimeOfDay(hour) {
        this.currentHour = hour;
        const targetKey = this.getSkyKeyForHour(hour);
        const targetTexture = this.skyTextures.get(targetKey);
        if (targetTexture && this.sky?.material?.uniforms && targetKey !== this.activeSkyKey) {
            this.activeSkyKey = targetKey;
            this.sky.material.uniforms.map1.value = this.activeSkyTexture || targetTexture;
            this.sky.material.uniforms.map2.value = targetTexture;
            this.nextSkyTexture = targetTexture;
            this.skyTransition = 0;
        }
        this.applyDayLighting(hour);
    }

    applyDayLighting(hour) {
        const t = (hour % 24) / 24;
        const sun = Math.max(0, Math.sin(t * Math.PI * 2 - Math.PI / 2));
        this.directionalLight.intensity = 0.25 + sun * 1.15;
        this.rimLight.intensity = 0.15 + sun * 0.45;
        this.scene.fog.density = THREE.MathUtils.lerp(0.006, 0.0022, sun);
    }


    getWorldDensityMultiplier() {
        const densityByPreset = { low: 0.3, medium: 0.52, high: 0.72, ultra: 0.86 };
        return densityByPreset[this.settings.graphicsPreset] ?? densityByPreset.high;
    }

    getScaledWorldCount(baseCount) {
        return Math.max(0, Math.floor(baseCount * this.getWorldDensityMultiplier()));
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
        const treasureCount = this.getScaledWorldCount(CONFIG.WORLD.TREASURE_COUNT);
        for (let i = 0; i < treasureCount; i++) {
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

        const count = this.getScaledWorldCount(CONFIG.WORLD.TREE_COUNT);
        const instancedMesh = new THREE.InstancedMesh(treeMesh.geometry, treeMesh.material, count);
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < count; i++) {
            const pos = getRandomPosition(CONFIG.WORLD.SIZE / 2);
            if (pos.length() < 35 || this.isInNoSpawnZone(pos.x, pos.z, 8)) { 
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
                const highShadows = this.settings.graphicsPreset === 'ultra' || this.settings.graphicsPreset === 'high';
                child.castShadow = highShadows;
                child.receiveShadow = highShadows;
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

    createCityDistrict(pos) {
        if (!this.cityDistrictGltf) return;

        const district = cloneSkeleton(this.cityDistrictGltf.scene);
        const terrainH = this.getTerrainHeight(pos.x, pos.z);
        const scale = 192;

        district.scale.setScalar(scale);
        district.position.set(pos.x, terrainH, pos.z);
        district.rotation.y = -Math.PI / 2;
        district.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(district);
        district.position.y -= box.min.y - terrainH;

        district.traverse((child) => {
            if (!child.isMesh) return;
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false;
            const clippingGround = terrainH + 0.01;
            child.material = child.material.clone();
            child.material.clippingPlanes = [
                new THREE.Plane(new THREE.Vector3(0, 1, 0), -clippingGround)
            ];
            child.material.clipShadows = true;
        });

        district.updateMatrixWorld(true);
        this.scene.add(district);
        this.cityDistrict = district;
        this.addStructureMeshColliders(district);
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
                const highShadows = this.settings.graphicsPreset === 'ultra' || this.settings.graphicsPreset === 'high';
                child.castShadow = highShadows;
                child.receiveShadow = highShadows;
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
        this.addStructureMeshColliders(ruins);
    }

    addStructureMeshColliders(root) {
        root.updateMatrixWorld(true);
        root.traverse((child) => {
            if (!child.isMesh) return;
            const box = new THREE.Box3().setFromObject(child);
            if (box.isEmpty()) return;
            if ((box.max.x - box.min.x) < 1 || (box.max.z - box.min.z) < 1) return;
            this.structureColliders.push(box);
        });
    }

    refreshNoSpawnZones() {
        this.noSpawnZones = [];
        this.hutMarkers.forEach((h) => this.noSpawnZones.push({ x: h.x, z: h.z, radius: 18 }));
        this.noSpawnZones.push({ x: this.ruinsPosition.x, z: this.ruinsPosition.z, radius: 54 });
        this.noSpawnZones.push({ x: this.districtPosition.x, z: this.districtPosition.z, radius: 120 });
    }

    isInNoSpawnZone(x, z, extraRadius = 0) {
        return this.noSpawnZones.some((zone) => {
            const dx = x - zone.x;
            const dz = z - zone.z;
            const min = zone.radius + extraRadius;
            return (dx * dx + dz * dz) < min * min;
        });
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

        const grassByPreset = { low: 1200, medium: 2200, high: 3200, ultra: 4200 };
        const count = grassByPreset[this.settings.graphicsPreset] || 3000;
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

        for (const box of this.structureColliders) {
            const expanded = box.clone().expandByScalar(radius);
            if (
                playerPosition.x < expanded.min.x || playerPosition.x > expanded.max.x ||
                playerPosition.z < expanded.min.z || playerPosition.z > expanded.max.z
            ) {
                continue;
            }

            const left = Math.abs(playerPosition.x - expanded.min.x);
            const right = Math.abs(expanded.max.x - playerPosition.x);
            const top = Math.abs(playerPosition.z - expanded.min.z);
            const bottom = Math.abs(expanded.max.z - playerPosition.z);
            const minPush = Math.min(left, right, top, bottom);

            if (minPush === left) return new THREE.Vector3(-(left || 0.01), 0, 0);
            if (minPush === right) return new THREE.Vector3((right || 0.01), 0, 0);
            if (minPush === top) return new THREE.Vector3(0, 0, -(top || 0.01));
            return new THREE.Vector3(0, 0, (bottom || 0.01));
        }
        return null;
    }

    createChest(pos) {
        const terrainH = this.getTerrainHeight(pos.x, pos.z);
        const coin = this.coinGltf ? cloneSkeleton(this.coinGltf.scene) : null;
        if (coin) {
            coin.scale.setScalar(0.75);
            coin.position.set(pos.x, terrainH + 0.6, pos.z);
            coin.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = false;
                    child.receiveShadow = false;
                }
            });
            this.scene.add(coin);
            this.chests.push(coin);
            return;
        }
        const fallback = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: 0xf1c40f }));
        fallback.position.set(pos.x, terrainH + 0.3, pos.z);
        this.scene.add(fallback);
        this.chests.push(fallback);
    }

    setupEnemies() {
        const campCount = this.getScaledWorldCount(CONFIG.WORLD.GOBLIN_CAMP_COUNT);
        for (let i = 0; i < campCount; i++) {
            const campPos = getRandomPosition(CONFIG.WORLD.SIZE / 2);
            if (campPos.length() < 40 || this.isInNoSpawnZone(campPos.x, campPos.z, 20)) {
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

        const deerCount = this.getScaledWorldCount(CONFIG.WORLD.DEER_COUNT);
        for (let i = 0; i < deerCount; i++) {
            const pos = getRandomPosition(CONFIG.WORLD.SIZE / 2);
            if (pos.length() < 30 || this.isInNoSpawnZone(pos.x, pos.z, 12)) {
                i--;
                continue;
            }
            pos.y = this.getTerrainHeight(pos.x, pos.z);
            const deer = new DeerNPC(this.scene, pos, this.deerGltf, this);
            this.deerNpcs.push(deer);
        }
    }

    update(deltaTime, player) {
        this.lastPlayer = player;
        // Move sky with player to avoid clipping
        if (this.sky) {
            this.sky.position.copy(player.mesh.position);
        }
        if (this.sky?.material?.uniforms && this.skyTransition < 1) {
            this.skyTransition = Math.min(1, this.skyTransition + deltaTime * 0.35);
            this.sky.material.uniforms.mixFactor.value = this.skyTransition;
            if (this.skyTransition >= 1 && this.nextSkyTexture) {
                this.activeSkyTexture = this.nextSkyTexture;
                this.scene.environment = this.activeSkyTexture;
            }
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

    addInteractable({ mesh, itemId, amount = 1, radius = 2, icon = '' }) {
        this.interactables.push({ mesh, itemId, amount, radius, icon, active: true });
    }

    tryPickupNearest(playerLike = null) {
        const active = playerLike || this.lastPlayer;
        if (!active?.mesh) return;
        let nearest = null;
        let nearestDist = Infinity;
        for (const item of this.interactables) {
            if (!item.active || !item.mesh?.parent) continue;
            const dist = active.mesh.position.distanceTo(item.mesh.position);
            if (dist < item.radius && dist < nearestDist) {
                nearest = item;
                nearestDist = dist;
            }
        }
        if (!nearest) return;
        nearest.active = false;
        this.scene.remove(nearest.mesh);
        window.dispatchEvent(new CustomEvent('item-collected', {
            detail: { itemId: nearest.itemId, amount: nearest.amount, icon: nearest.icon }
        }));
    }

    setupHerbFlowers() {
        if (!this.flowerGltf || !this.grassGltf) return;
        const herbCountByPreset = { low: 120, medium: 220, high: 320, ultra: 420 };
        const count = herbCountByPreset[this.settings.graphicsPreset] || 220;
        for (let i = 0; i < count; i++) {
            const pos = getRandomPosition(CONFIG.WORLD.SIZE / 2);
            if (pos.length() < 20 || this.isInNoSpawnZone(pos.x, pos.z, 6)) {
                i--;
                continue;
            }
            const flower = cloneSkeleton(this.flowerGltf.scene);
            const terrainH = this.getTerrainHeight(pos.x, pos.z);
            flower.scale.setScalar(0.45 + Math.random() * 0.2);
            flower.position.set(pos.x, terrainH, pos.z);
            flower.rotation.y = Math.random() * Math.PI * 2;
            this.scene.add(flower);
            this.addInteractable({ mesh: flower, itemId: 'herb', amount: 1, radius: 2.2, icon: '🌼' });
        }
    }

    setupCoins() {
        if (!this.coinGltf) return;
        this.chests.forEach((chest) => this.scene.remove(chest));
        this.chests = [];
        const treasureCount = this.getScaledWorldCount(CONFIG.WORLD.TREASURE_COUNT);
        for (let i = 0; i < treasureCount; i++) {
            const pos = getRandomPosition(CONFIG.WORLD.SIZE / 2);
            if (pos.length() < 40 || this.isInNoSpawnZone(pos.x, pos.z, 8)) {
                i--;
                continue;
            }
            this.createChest(pos);
        }
    }

    spawnMeatDrops(position) {
        if (!this.roastedRibGltf) return;
        const count = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
            const drop = cloneSkeleton(this.roastedRibGltf.scene);
            const scale = 0.15 + Math.random() * 0.08;
            drop.scale.setScalar(scale);
            const ox = (Math.random() - 0.5) * 2;
            const oz = (Math.random() - 0.5) * 2;
            const x = position.x + ox;
            const z = position.z + oz;
            const y = this.getTerrainHeight(x, z);
            drop.position.set(x, y + 0.08, z);
            this.scene.add(drop);
            this.addInteractable({ mesh: drop, itemId: 'meat', amount: 1, radius: 2, icon: '🍖' });
        }
    }
}
