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
        }
    }

    switchTo(id) {
        if (!this.characters.has(id) || this.activeCharacterId === id) return;

        const previous = this.getActiveCharacter();
        if (previous) previous.setVisible(false);

        this.activeCharacterId = id;
        const next = this.getActiveCharacter();
        if (next) next.setVisible(true);
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

    update(deltaTime, world) {
        for (const [id, character] of this.characters) {
            character.update(deltaTime, world, id === this.activeCharacterId);
        }
    }
}
