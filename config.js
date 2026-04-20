export const CONFIG = {
    PLAYER: {
        MOVE_SPEED: 8,
        JUMP_FORCE: 12,
        GRAVITY: 30,
        GROUND_LEVEL: 0,
        MAX_HEALTH: 100,
        ATTACK_RANGE: 2.5,
        ATTACK_COOLDOWN: 600, // ms
        DAMAGE: 15,
    },
    ENEMY: {
        GOBLIN: {
            HEALTH: 40,
            DAMAGE: 8,
            MOVE_SPEED: 4,
            DETECTION_RANGE: 15,
            ATTACK_RANGE: 2,
            ATTACK_COOLDOWN: 1500,
            XP_REWARD: 20,
        }
    },
    WORLD: {
        SIZE: 1000,
        TREE_COUNT: 800,
        TREASURE_COUNT: 50,
        GOBLIN_CAMP_COUNT: 25,
    },
    COLORS: {
        UI_HEALTH: '#e74c3c',
        UI_MANA: '#3498db',
        UI_EXP: '#f1c40f',
        UI_TEXT: '#ecf0f1',
        ENEMY_HEALTH: '#c0392b',
    }
};
