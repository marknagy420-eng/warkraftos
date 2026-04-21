export class LegacyCharacterAdapter {
    constructor(player) {
        this.player = player;
        this.mesh = player.mesh;
        this.displayName = 'Original Warrior';
    }

    setVisible(visible) {
        this.mesh.visible = visible;
        if (this.player.cameraController) {
            this.player.cameraController.enabled = visible;
        }
    }

    update(deltaTime, world, isActive) {
        if (!isActive) return;
        this.player.update(deltaTime, world);
    }
}
