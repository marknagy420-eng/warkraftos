import { LANGUAGES, GRAPHICS_PRESETS, DEFAULT_SETTINGS, t } from './settings.js';

const CHARACTER_OPTIONS = [
    {
        id: 'fbx-warrior',
        name: 'FBX Warrior',
        role: 'Közelharci tank',
        desc: 'Erős kardforgató. Jó védekezés, stabil életerő és frontvonalas harc.'
    },
    {
        id: 'legacy',
        name: 'Legacy Ranger',
        role: 'Gyors felderítő',
        desc: 'Gyorsabb mozgásérzet, egyszerűbb modell, alacsonyabb gépigény.'
    }
];

export class StartMenu {
    constructor({ settings, gpuInfo, onApplySettings, onStart }) {
        this.settings = { ...DEFAULT_SETTINGS, ...settings };
        this.gpuInfo = gpuInfo;
        this.onApplySettings = onApplySettings;
        this.onStart = onStart;
        this.selectedCharacter = 'fbx-warrior';

        this.build();
        this.renderLanguage();
    }

    build() {
        this.root = document.createElement('div');
        this.root.id = 'start-menu';
        Object.assign(this.root.style, {
            position: 'fixed',
            inset: '0',
            display: 'grid',
            gridTemplateColumns: '1.1fr 1fr',
            gap: '18px',
            alignItems: 'stretch',
            background: 'radial-gradient(circle at top, rgba(39,55,95,0.95), rgba(8,12,24,0.97))',
            color: '#f5f6ff',
            fontFamily: "'DarkMystic', 'Times New Roman', serif",
            zIndex: '1000',
            padding: '22px'
        });

        this.left = document.createElement('div');
        this.left.style.display = 'flex';
        this.left.style.flexDirection = 'column';
        this.left.style.gap = '14px';
        this.left.style.background = 'rgba(10,14,30,0.7)';
        this.left.style.border = '1px solid #44538c';
        this.left.style.borderRadius = '12px';
        this.left.style.padding = '16px';

        this.right = document.createElement('div');
        this.right.style.display = 'flex';
        this.right.style.flexDirection = 'column';
        this.right.style.gap = '10px';
        this.right.style.background = 'rgba(10,14,30,0.8)';
        this.right.style.border = '1px solid #44538c';
        this.right.style.borderRadius = '12px';
        this.right.style.padding = '16px';

        this.buildLeft();
        this.buildRight();

        this.root.append(this.left, this.right);
        document.body.appendChild(this.root);
    }

    buildLeft() {
        this.title = document.createElement('h1');
        this.title.style.margin = '0';

        this.info = document.createElement('div');
        this.info.style.fontSize = '13px';
        this.info.style.opacity = '0.88';
        this.info.textContent = this.gpuInfo?.text || 'GPU info unavailable';

        const charsTitle = document.createElement('h3');
        charsTitle.style.margin = '6px 0';
        charsTitle.textContent = t(this.settings.language, 'characterSelect');

        this.charactersGrid = document.createElement('div');
        this.charactersGrid.style.display = 'grid';
        this.charactersGrid.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))';
        this.charactersGrid.style.gap = '10px';

        CHARACTER_OPTIONS.forEach((char) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.style.background = 'rgba(24,34,62,0.85)';
            card.style.border = '1px solid #6173b0';
            card.style.borderRadius = '10px';
            card.style.color = '#fff';
            card.style.padding = '10px';
            card.style.textAlign = 'left';
            card.style.cursor = 'pointer';
            card.innerHTML = `<div style="font-size:18px; margin-bottom:4px;">⚔️</div><b>${char.name}</b><div style="font-size:12px; opacity:.9; margin-top:4px;">${char.role}</div><div style="font-size:11px; opacity:.75; margin-top:4px;">${char.desc}</div>`;
            card.addEventListener('click', () => {
                this.selectedCharacter = char.id;
                this.paintCharacterCards();
            });
            char.card = card;
            this.charactersGrid.appendChild(card);
        });

        this.startBtn = this.makeButton('', () => {
            this.onStart({ characterId: this.selectedCharacter });
            this.destroy();
        });
        this.startBtn.style.fontSize = '16px';
        this.startBtn.style.padding = '12px 16px';

        this.left.append(this.title, this.info, charsTitle, this.charactersGrid, this.startBtn);
        this.paintCharacterCards();
    }

    buildRight() {
        this.langSelect = this.makeSelect(Object.entries(LANGUAGES).map(([code, label]) => ({ value: code, label })));
        this.langSelect.value = this.settings.language;
        this.langSelect.addEventListener('change', () => {
            this.settings.language = this.langSelect.value;
            this.renderLanguage();
            this.fireApply();
        });

        const makeQuality = (key) => {
            const s = this.makeSelect(GRAPHICS_PRESETS.map((v) => ({ value: v, label: v.toUpperCase() })));
            s.value = this.settings[key] || 'high';
            s.addEventListener('change', () => {
                this.settings[key] = s.value;
                this.fireApply();
            });
            return s;
        };

        const makeRange = (key, min, max) => {
            const input = document.createElement('input');
            input.type = 'range';
            input.min = String(min);
            input.max = String(max);
            input.value = String(this.settings[key]);
            input.addEventListener('input', () => {
                this.settings[key] = Number(input.value);
                this.fireApply();
            });
            return input;
        };

        const makeToggle = (key) => {
            const c = document.createElement('input');
            c.type = 'checkbox';
            c.checked = !!this.settings[key];
            c.addEventListener('change', () => {
                this.settings[key] = c.checked;
                this.fireApply();
            });
            return c;
        };

        const makeDifficulty = (key, options) => {
            const s = this.makeSelect(options.map((value) => ({ value, label: value })));
            s.value = this.settings[key];
            s.addEventListener('change', () => {
                this.settings[key] = s.value;
                this.fireApply();
            });
            return s;
        };

        const upscaleOptions = this.makeSelect([
            { value: 'off', label: 'Off' },
            { value: 'quality', label: 'Quality Upscale' },
            { value: 'balanced', label: 'Balanced Upscale' },
            { value: 'performance', label: 'Performance Upscale' },
        ]);
        upscaleOptions.value = this.settings.upscale;
        upscaleOptions.addEventListener('change', () => {
            this.settings.upscale = upscaleOptions.value;
            this.fireApply();
        });

        const resolutionOptions = this.makeSelect([
            { value: 'auto', label: 'Auto' },
            { value: '1920x1080', label: '1920x1080' },
            { value: '2560x1440', label: '2560x1440' },
            { value: '3840x2160', label: '3840x2160' }
        ]);
        resolutionOptions.value = this.settings.resolution;
        resolutionOptions.addEventListener('change', () => {
            this.settings.resolution = resolutionOptions.value;
            this.fireApply();
        });

        const graphics = document.createElement('div');
        graphics.innerHTML = '<h3 style="margin:0 0 8px 0">Graphics</h3>';
        graphics.append(
            this.row('Preset', makeQuality('graphicsPreset')),
            this.row('Texture quality', makeQuality('textureQuality')),
            this.row('Character quality', makeQuality('characterQuality')),
            this.row('Enemy quality', makeQuality('enemyQuality')),
            this.row('Brightness', makeRange('brightness', 40, 130)),
            this.row('HDR', makeToggle('hdr')),
            this.row('DLSS mode', makeToggle('dlss')),
            this.row('Upscale', upscaleOptions),
            this.row('Native resolution', makeToggle('nativeResolution')),
            this.row('Resolution', resolutionOptions),
            this.row('Dedicated GPU', makeToggle('useDedicatedGPU'))
        );

        const audio = document.createElement('div');
        audio.innerHTML = '<h3 style="margin:4px 0 8px 0">Audio</h3>';
        audio.append(
            this.row('Master', makeRange('masterVolume', 0, 100)),
            this.row('Music', makeRange('musicVolume', 0, 100)),
            this.row('Effects', makeRange('effectsVolume', 0, 100)),
            this.row('Ambient', makeRange('ambientVolume', 0, 100))
        );

        const gameplay = document.createElement('div');
        gameplay.innerHTML = '<h3 style="margin:4px 0 8px 0">Gameplay</h3>';
        gameplay.append(
            this.row('Difficulty', makeDifficulty('difficulty', ['easy', 'normal', 'hard', 'extreme'])),
            this.row('Enemy aggression', makeDifficulty('enemyAggression', ['low', 'medium', 'high', 'ultra'])),
            this.row('Enemy damage', makeDifficulty('enemyDamage', ['low', 'medium', 'high', 'ultra'])),
            this.row('Player survivability', makeDifficulty('playerSurvivability', ['low', 'medium', 'high', 'ultra']))
        );

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '8px';
        const resetBtn = this.makeButton('', () => {
            this.settings = { ...DEFAULT_SETTINGS, language: this.settings.language };
            this.fireApply();
            this.destroy();
            new StartMenu({
                settings: this.settings,
                gpuInfo: this.gpuInfo,
                onApplySettings: this.onApplySettings,
                onStart: this.onStart
            });
        });
        this.resetBtn = resetBtn;
        actions.append(resetBtn);

        this.right.append(this.row('Language', this.langSelect), graphics, audio, gameplay, actions);
    }

    fireApply() {
        this.onApplySettings?.(this.settings);
    }

    row(label, control) {
        const wrap = document.createElement('label');
        wrap.style.display = 'grid';
        wrap.style.gridTemplateColumns = '1fr auto';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '10px';
        wrap.style.fontSize = '12px';
        wrap.style.marginBottom = '6px';
        const text = document.createElement('span');
        text.textContent = label;
        control.style.minWidth = '140px';
        wrap.append(text, control);
        return wrap;
    }

    makeSelect(options) {
        const s = document.createElement('select');
        s.style.background = '#121b38';
        s.style.color = '#fff';
        s.style.border = '1px solid #677ab8';
        s.style.borderRadius = '6px';
        s.style.padding = '4px';
        options.forEach((opt) => {
            const node = document.createElement('option');
            node.value = opt.value;
            node.textContent = opt.label;
            s.appendChild(node);
        });
        return s;
    }

    makeButton(label, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.style.padding = '8px 12px';
        btn.style.border = '1px solid #8aa2ff';
        btn.style.borderRadius = '8px';
        btn.style.background = '#192549';
        btn.style.color = '#fff';
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', onClick);
        return btn;
    }

    paintCharacterCards() {
        CHARACTER_OPTIONS.forEach((char) => {
            char.card.style.border = this.selectedCharacter === char.id ? '2px solid #9cc0ff' : '1px solid #6173b0';
            char.card.style.transform = this.selectedCharacter === char.id ? 'scale(1.01)' : 'scale(1)';
        });
    }

    renderLanguage() {
        this.title.textContent = t(this.settings.language, 'title');
        this.startBtn.textContent = t(this.settings.language, 'start');
        this.resetBtn.textContent = t(this.settings.language, 'resetSettings');
    }

    destroy() {
        this.root?.remove();
    }
}
