export const GRAPHICS_PRESETS = ['low', 'medium', 'high', 'ultra'];

export const DEFAULT_SETTINGS = {
    language: 'hu',
    graphicsPreset: 'high',
    textureQuality: 'high',
    characterQuality: 'high',
    enemyQuality: 'high',
    brightness: 100,
    hdr: true,
    dlss: false,
    upscale: 'off',
    nativeResolution: true,
    renderScale: 1,
    resolution: 'auto',
    useDedicatedGPU: true,
    masterVolume: 80,
    musicVolume: 70,
    effectsVolume: 85,
    ambientVolume: 60,
    difficulty: 'normal',
    enemyAggression: 'medium',
    enemyDamage: 'medium',
    playerSurvivability: 'medium'
};

export const LANGUAGES = {
    hu: 'Magyar',
    en: 'English',
    de: 'Deutsch',
    fr: 'Français',
    es: 'Español',
    it: 'Italiano',
    pt: 'Português',
    pl: 'Polski',
    tr: 'Türkçe',
    ja: '日本語'
};

export const TRANSLATIONS = {
    hu: {
        title: 'Warcraft Odyssey',
        newGame: 'Új játék',
        continueGame: 'Folytatás',
        settings: 'Beállítások',
        start: 'Belépés a játékba',
        graphics: 'Grafika',
        audio: 'Hang',
        gameplay: 'Játékmenet',
        language: 'Nyelv',
        characterSelect: 'Karakter kiválasztása',
        saveSettings: 'Mentés',
        resetSettings: 'Alapérték',
        hudPrompt: 'WASD mozgás | Shift futás | C guggolás | Space ugrás | I inventory | 1 kard | Bal klikk támadás | M térkép'
    },
    en: { title: 'Warcraft Odyssey', newGame: 'New Game', continueGame: 'Continue', settings: 'Settings', start: 'Enter Game', graphics: 'Graphics', audio: 'Audio', gameplay: 'Gameplay', language: 'Language', characterSelect: 'Character Select', saveSettings: 'Save', resetSettings: 'Default', hudPrompt: 'WASD Move | Shift Run | C Crouch | Space Jump | I Inventory | 1 Sword | Left Click Attack | M Map' },
    de: { title: 'Warcraft Odyssey', newGame: 'Neues Spiel', continueGame: 'Fortsetzen', settings: 'Einstellungen', start: 'Spiel starten', graphics: 'Grafik', audio: 'Audio', gameplay: 'Gameplay', language: 'Sprache', characterSelect: 'Charakterwahl', saveSettings: 'Speichern', resetSettings: 'Standard', hudPrompt: 'WASD Bewegen | Shift Rennen | C Ducken | Leertaste Springen | I Inventar | 1 Schwert | Linksklick Angriff | M Karte' },
    fr: { title: 'Warcraft Odyssey', newGame: 'Nouvelle partie', continueGame: 'Continuer', settings: 'Paramètres', start: 'Entrer dans le jeu', graphics: 'Graphismes', audio: 'Audio', gameplay: 'Gameplay', language: 'Langue', characterSelect: 'Choix du personnage', saveSettings: 'Enregistrer', resetSettings: 'Par défaut', hudPrompt: 'ZQSD Déplacement | Shift Courir | C S’accroupir | Espace Saut | I Inventaire | 1 Épée | Clic gauche Attaque | M Carte' },
    es: { title: 'Warcraft Odyssey', newGame: 'Nueva partida', continueGame: 'Continuar', settings: 'Ajustes', start: 'Entrar al juego', graphics: 'Gráficos', audio: 'Audio', gameplay: 'Jugabilidad', language: 'Idioma', characterSelect: 'Selección de personaje', saveSettings: 'Guardar', resetSettings: 'Predeterminado', hudPrompt: 'WASD Mover | Shift Correr | C Agacharse | Espacio Saltar | I Inventario | 1 Espada | Clic izquierdo Ataque | M Mapa' },
    it: { title: 'Warcraft Odyssey', newGame: 'Nuova partita', continueGame: 'Continua', settings: 'Impostazioni', start: 'Entra nel gioco', graphics: 'Grafica', audio: 'Audio', gameplay: 'Gameplay', language: 'Lingua', characterSelect: 'Selezione personaggio', saveSettings: 'Salva', resetSettings: 'Predefinito', hudPrompt: 'WASD Movimento | Shift Corsa | C Accovacciati | Spazio Salta | I Inventario | 1 Spada | Click sinistro Attacco | M Mappa' },
    pt: { title: 'Warcraft Odyssey', newGame: 'Novo jogo', continueGame: 'Continuar', settings: 'Configurações', start: 'Entrar no jogo', graphics: 'Gráficos', audio: 'Áudio', gameplay: 'Jogabilidade', language: 'Idioma', characterSelect: 'Seleção de personagem', saveSettings: 'Salvar', resetSettings: 'Padrão', hudPrompt: 'WASD Mover | Shift Correr | C Agachar | Espaço Pular | I Inventário | 1 Espada | Clique esquerdo Ataque | M Mapa' },
    pl: { title: 'Warcraft Odyssey', newGame: 'Nowa gra', continueGame: 'Kontynuuj', settings: 'Ustawienia', start: 'Wejdź do gry', graphics: 'Grafika', audio: 'Dźwięk', gameplay: 'Rozgrywka', language: 'Język', characterSelect: 'Wybór postaci', saveSettings: 'Zapisz', resetSettings: 'Domyślne', hudPrompt: 'WASD Ruch | Shift Bieg | C Kucanie | Spacja Skok | I Ekwipunek | 1 Miecz | Lewy klik Atak | M Mapa' },
    tr: { title: 'Warcraft Odyssey', newGame: 'Yeni oyun', continueGame: 'Devam et', settings: 'Ayarlar', start: 'Oyuna gir', graphics: 'Grafik', audio: 'Ses', gameplay: 'Oynanış', language: 'Dil', characterSelect: 'Karakter seçimi', saveSettings: 'Kaydet', resetSettings: 'Varsayılan', hudPrompt: 'WASD Hareket | Shift Koş | C Eğil | Space Zıpla | I Envanter | 1 Kılıç | Sol tık Saldırı | M Harita' },
    ja: { title: 'Warcraft Odyssey', newGame: 'ニューゲーム', continueGame: '続きから', settings: '設定', start: 'ゲーム開始', graphics: 'グラフィック', audio: 'オーディオ', gameplay: 'ゲームプレイ', language: '言語', characterSelect: 'キャラクター選択', saveSettings: '保存', resetSettings: '初期化', hudPrompt: 'WASD 移動 | Shift 走る | C しゃがむ | Space ジャンプ | I インベントリ | 1 剣 | 左クリック 攻撃 | M マップ' }
};

export class GameSettingsStore {
    constructor(storageKey = 'warkraftos.settings.v2') {
        this.storageKey = storageKey;
        this.settings = this.load();
    }

    load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return { ...DEFAULT_SETTINGS };
            return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
        } catch {
            return { ...DEFAULT_SETTINGS };
        }
    }

    save(nextSettings) {
        this.settings = { ...this.settings, ...nextSettings };
        localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
        return this.settings;
    }

    get() {
        return { ...this.settings };
    }

    clearSaves() {
        localStorage.removeItem('warkraftos.savegame.v1');
    }

    saveGameState(state) {
        localStorage.setItem('warkraftos.savegame.v1', JSON.stringify(state));
    }

    loadGameState() {
        try {
            const raw = localStorage.getItem('warkraftos.savegame.v1');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    clearAll() {
        try {
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem('warkraftos.savegame.v1');
        } catch {}
        this.settings = { ...DEFAULT_SETTINGS };
    }
}


export function t(language, key) {
    const pack = TRANSLATIONS[language] || TRANSLATIONS.en;
    return pack[key] || TRANSLATIONS.en[key] || key;
}
