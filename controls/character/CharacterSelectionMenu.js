export class CharacterSelectionMenu {
    constructor(characterManager, language = 'en') {
        this.language = language;
        this.characterManager = characterManager;
        this.container = document.createElement('div');
        this.container.id = 'character-selection-menu';
        this.container.style.position = 'fixed';
        this.container.style.left = '20px';
        this.container.style.bottom = '20px';
        this.container.style.background = 'rgba(0,0,0,0.55)';
        this.container.style.border = '1px solid #666';
        this.container.style.borderRadius = '8px';
        this.container.style.padding = '10px';
        this.container.style.fontFamily = "'DarkMystic', 'Times New Roman', serif";
        this.container.style.color = '#fff';
        this.container.style.zIndex = '980';

        const title = document.createElement('div');
        title.textContent = this.language === 'hu' ? 'KARAKTEREK' : 'CHARACTERS';
        title.style.fontSize = '12px';
        title.style.marginBottom = '8px';
        this.container.appendChild(title);

        this.buttonsWrap = document.createElement('div');
        this.buttonsWrap.style.display = 'flex';
        this.buttonsWrap.style.gap = '6px';
        this.buttonsWrap.style.flexWrap = 'wrap';
        this.container.appendChild(this.buttonsWrap);

        document.body.appendChild(this.container);
    }

    render() {
        this.buttonsWrap.innerHTML = '';
        const entries = this.characterManager.getCharacterList();
        entries.forEach((entry) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = entry.label;
            button.style.padding = '6px 8px';
            button.style.border = '1px solid #8aa2ff';
            button.style.background = this.characterManager.activeCharacterId === entry.id ? '#394f9f' : '#222';
            button.style.color = '#fff';
            button.style.cursor = 'pointer';
            button.addEventListener('click', () => {
                this.characterManager.switchTo(entry.id);
                this.render();
            });
            this.buttonsWrap.appendChild(button);
        });
    }
}
