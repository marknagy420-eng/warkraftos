import * as THREE from 'three';

export function createHealthBar(width = 1, height = 0.15, color = 0xff0000) {
    const group = new THREE.Group();
    
    const bgGeo = new THREE.PlaneGeometry(width, height);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const background = new THREE.Mesh(bgGeo, bgMat);
    group.add(background);
    
    const fgGeo = new THREE.PlaneGeometry(width, height);
    const fgMat = new THREE.MeshBasicMaterial({ color: color });
    const foreground = new THREE.Mesh(fgGeo, fgMat);
    foreground.position.z = 0.01;
    group.add(foreground);
    
    group.updateHealth = (percent) => {
        foreground.scale.x = Math.max(0, percent);
        foreground.position.x = -(1 - percent) * (width / 2);
    };
    
    return group;
}

export function getRandomPosition(radius) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    return new THREE.Vector3(
        Math.cos(angle) * r,
        0,
        Math.sin(angle) * r
    );
}

export function distance2D(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
}
