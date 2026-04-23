export class CharacterManager {
    constructor() {
        this.characters = new Map();
        this.activeCharacterId = null;
    }

    addCharacter(id, character, { visible = false } = {}) {
        this.characters.set(id, character);
        character.setVisible(visible);
        if (!this.activeCharacterId) {
            this.activeCharacterId = id;
            character.setVisible(true);
            character.onActivate?.();
        }
    }

    switchTo(id) {
        if (!this.characters.has(id) || this.activeCharacterId === id) return;

        const previous = this.getActiveCharacter();
        if (previous) {
            previous.onDeactivate?.();
            previous.setVisible(false);
        }

        this.activeCharacterId = id;
        const next = this.getActiveCharacter();
        if (next) {
            next.setVisible(true);
            next.onActivate?.();
        }
    }

    getActiveCharacter() {
        return this.characters.get(this.activeCharacterId) || null;
    }

    getCharacterList() {
        return [...this.characters.entries()].map(([id, character]) => ({
            id,
            label: character.displayName || id
        }));
    }


    applyQualitySettings(settings) {
        for (const [, character] of this.characters) {
            character.applyQualitySettings?.(settings);
        }
    }

    update(deltaTime, world) {
        for (const [id, character] of this.characters) {
            character.update(deltaTime, world, id === this.activeCharacterId);
        }
    }
}
