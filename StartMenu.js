import { LANGUAGES, GRAPHICS_PRESETS, DEFAULT_SETTINGS, t } from './settings.js';

export class StartMenu {
    constructor({ settings, gpuInfo, characters = [], selectedCharacterId = null, onApplySettings, onSelectCharacter, onStart }) {
        this.settings = { ...DEFAULT_SETTINGS, ...settings };
        this.gpuInfo = gpuInfo;
        this.characters = characters;
        this.selectedCharacterId = selectedCharacterId || characters[0]?.id || 'fbx-warrior';
        this.onApplySettings = onApplySettings;
        this.onSelectCharacter = onSelectCharacter;
        this.onStart = onStart;
        this.settingsOpen = false;
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
            gridTemplateColumns: 'minmax(260px, 420px) 1fr',
            alignItems: 'center',
            background: "url('assets/menubg.png') center/cover no-repeat",
            color: '#f5f6ff',
            fontFamily: "'DarkMystic', 'Times New Roman', serif",
            zIndex: '1000',
            padding: '26px'
        });

        this.left = document.createElement('div');
        Object.assign(this.left.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            alignItems: 'stretch',
            maxWidth: '340px',
            marginLeft: '10px'
        });

        this.title = document.createElement('h1');
        this.title.style.margin = '0 0 12px 0';
        this.title.style.textShadow = '0 2px 8px rgba(0,0,0,0.7)';

        this.info = document.createElement('div');
        this.info.style.fontSize = '13px';
        this.info.style.display = 'none';

        this.startBtn = this.makeMenuButton('', () => {
            this.onStart?.(this.selectedCharacterId);
            this.destroy();
        });

        this.settingsBtn = this.makeMenuButton('', () => {
            this.setSettingsOpen(!this.settingsOpen);
        });

        this.characterSelect = this.makeSelect(this.characters.map((item) => ({ value: item.id, label: item.label })));
        this.characterSelect.value = this.selectedCharacterId;
        this.characterSelect.addEventListener('change', () => {
            this.selectedCharacterId = this.characterSelect.value;
            this.onSelectCharacter?.(this.selectedCharacterId);
        });

        this.characterRow = this.row('', this.characterSelect);
        this.characterRow.style.marginTop = '8px';

        [this.title, this.startBtn, this.settingsBtn, this.characterRow].forEach((node) => {
            node.style.background = 'rgba(0, 0, 0, 0.28)';
            node.style.padding = node === this.title ? '8px 12px' : '10px 12px';
            node.style.border = 'none';
            node.style.backdropFilter = 'blur(2px)';
        });
        this.title.style.display = 'inline-block';

        this.left.append(this.title, this.info, this.startBtn, this.settingsBtn, this.characterRow);

        this.settingsPanel = document.createElement('div');
        Object.assign(this.settingsPanel.style, {
            position: 'fixed',
            inset: '0',
            display: 'none',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '20px 30px 28px',
            background: "url('assets/settings.PNG') center/cover no-repeat",
            zIndex: '1010'
        });

        this.settingsBackdrop = document.createElement('div');
        Object.assign(this.settingsBackdrop.style, {
            position: 'absolute',
            inset: '0',
            background: 'rgba(5, 9, 20, 0.78)'
        });

        this.settingsContent = document.createElement('div');
        Object.assign(this.settingsContent.style, {
            position: 'relative',
            maxWidth: '980px',
            width: '100%',
            margin: '0 auto',
            border: '1px solid rgba(125, 153, 255, 0.65)',
            borderRadius: '14px',
            background: 'rgba(8, 14, 30, 0.82)',
            color: '#fff',
            padding: '18px'
        });

        this.buildSettingsContent();
        this.settingsPanel.append(this.settingsBackdrop, this.settingsContent);
        this.root.append(this.left);
        document.body.append(this.root, this.settingsPanel);
    }

    buildSettingsContent() {
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

        const layout = document.createElement('div');
        Object.assign(layout.style, {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '14px'
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
        audio.innerHTML = '<h3 style="margin:0 0 8px 0">Audio</h3>';
        audio.append(
            this.row('Master', makeRange('masterVolume', 0, 100)),
            this.row('Music', makeRange('musicVolume', 0, 100)),
            this.row('Effects', makeRange('effectsVolume', 0, 100)),
            this.row('Ambient', makeRange('ambientVolume', 0, 100))
        );

        const gameplay = document.createElement('div');
        gameplay.innerHTML = '<h3 style="margin:0 0 8px 0">Gameplay</h3>';
        gameplay.append(
            this.row('Difficulty', makeDifficulty('difficulty', ['easy', 'normal', 'hard', 'extreme'])),
            this.row('Enemy aggression', makeDifficulty('enemyAggression', ['low', 'medium', 'high', 'ultra'])),
            this.row('Enemy damage', makeDifficulty('enemyDamage', ['low', 'medium', 'high', 'ultra'])),
            this.row('Player survivability', makeDifficulty('playerSurvivability', ['low', 'medium', 'high', 'ultra'])),
            this.row('Language', this.langSelect)
        );

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '8px';
        actions.style.marginTop = '10px';

        this.resetBtn = this.makeButton('', () => {
            this.settings = { ...DEFAULT_SETTINGS, language: this.settings.language };
            this.fireApply();
            this.destroy();
            new StartMenu({
                settings: this.settings,
                gpuInfo: this.gpuInfo,
                characters: this.characters,
                selectedCharacterId: this.selectedCharacterId,
                onApplySettings: this.onApplySettings,
                onSelectCharacter: this.onSelectCharacter,
                onStart: this.onStart
            });
        });

        this.closeSettingsBtn = this.makeButton('Vissza', () => this.setSettingsOpen(false));

        actions.append(this.resetBtn, this.closeSettingsBtn);
        layout.append(graphics, audio, gameplay);
        this.settingsContent.append(layout, actions);
    }

    setSettingsOpen(open) {
        this.settingsOpen = open;
        this.settingsPanel.style.display = open ? 'flex' : 'none';
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
        s.style.padding = '6px';
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

    makeMenuButton(label, onClick) {
        const btn = this.makeButton(label, onClick);
        btn.style.padding = '12px 14px';
        btn.style.fontSize = '18px';
        btn.style.textAlign = 'left';
        btn.style.background = 'rgba(0, 0, 0, 0.28)';
        btn.style.border = 'none';
        btn.style.borderRadius = '0';
        return btn;
    }

    renderLanguage() {
        this.title.textContent = t(this.settings.language, 'title');
        this.startBtn.textContent = t(this.settings.language, 'start');
        this.settingsBtn.textContent = t(this.settings.language, 'settings');
        this.resetBtn.textContent = t(this.settings.language, 'resetSettings');
        this.closeSettingsBtn.textContent = this.settings.language === 'hu' ? 'Vissza a menübe' : 'Back to menu';
    }

    destroy() {
        this.root?.remove();
        this.settingsPanel?.remove();
    }
}
