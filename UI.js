import { CONFIG } from './config.js';

export class UI {
    constructor() {
        this.setupHTML();
        this.setupListeners();
    }

    setupHTML() {
        const hud = document.createElement('div');
        hud.id = 'game-hud';
        hud.style.position = 'fixed';
        hud.style.top = '20px';
        hud.style.left = '20px';
        hud.style.color = CONFIG.COLORS.UI_TEXT;
        hud.style.fontFamily = "'Orbitron', sans-serif";
        hud.style.pointerEvents = 'none';
        hud.innerHTML = `
            <div style="background: rgba(0,0,0,0.5); padding: 15px; border-radius: 8px; border: 2px solid #555;">
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">WARRIOR (Lv. 1)</div>
                <div id="hp-bar-container" style="width: 200px; height: 15px; background: #333; border: 1px solid #000; overflow: hidden; margin-bottom: 10px;">
                    <div id="hp-bar" style="width: 100%; height: 100%; background: ${CONFIG.COLORS.UI_HEALTH}; transition: width 0.2s;"></div>
                </div>
                <div id="xp-bar-container" style="width: 200px; height: 8px; background: #333; border: 1px solid #000; overflow: hidden;">
                    <div id="xp-bar" style="width: 0%; height: 100%; background: ${CONFIG.COLORS.UI_EXP}; transition: width 0.2s;"></div>
                </div>
                <div id="gold-display" style="margin-top: 5px; font-size: 14px;">Gold: 0g</div>
            </div>
        `;
        document.body.appendChild(hud);

        const questLog = document.createElement('div');
        questLog.id = 'quest-log';
        questLog.style.position = 'fixed';
        questLog.style.top = '20px';
        questLog.style.right = '20px';
        questLog.style.background = 'rgba(0,0,0,0.5)';
        questLog.style.padding = '15px';
        questLog.style.borderRadius = '8px';
        questLog.style.color = CONFIG.COLORS.UI_TEXT;
        questLog.style.fontFamily = "'Orbitron', sans-serif";
        questLog.style.border = '2px solid #555';
        questLog.style.pointerEvents = 'none';
        questLog.innerHTML = `
            <div style="font-size: 16px; font-weight: bold; border-bottom: 1px solid #777; margin-bottom: 10px;">QUEST LOG</div>
            <div id="quest-text">Clear the Forest: <span id="kill-count">0</span>/5 Goblins</div>
        `;
        document.body.appendChild(questLog);

        const prompt = document.createElement('div');
        prompt.id = 'game-prompt';
        prompt.style.position = 'fixed';
        prompt.style.bottom = '50px';
        prompt.style.width = '100%';
        prompt.style.textAlign = 'center';
        prompt.style.color = CONFIG.COLORS.UI_TEXT;
        prompt.style.fontFamily = "'Orbitron', sans-serif";
        prompt.style.fontSize = '24px';
        prompt.style.textShadow = '2px 2px #000';
        prompt.style.pointerEvents = 'none';
        prompt.innerHTML = 'WASD Move | Space Jump | I Inventory | 1 Sword | Left Click Attack | M Map';
        document.body.appendChild(prompt);

        const inventory = document.createElement('div');
        inventory.id = 'inventory-panel';
        inventory.style.position = 'fixed';
        inventory.style.bottom = '110px';
        inventory.style.right = '20px';
        inventory.style.width = '240px';
        inventory.style.background = 'rgba(0,0,0,0.65)';
        inventory.style.border = '2px solid #666';
        inventory.style.borderRadius = '8px';
        inventory.style.padding = '12px';
        inventory.style.fontFamily = "'Orbitron', sans-serif";
        inventory.style.color = CONFIG.COLORS.UI_TEXT;
        inventory.style.display = 'none';
        inventory.innerHTML = `
            <div style="font-size: 15px; margin-bottom: 8px;">INVENTORY (I)</div>
            <div id="weapon-slot" style="font-size: 13px; opacity: 0.9;">Weapon Slot: Empty</div>
        `;
        document.body.appendChild(inventory);

        this.hpBar = hud.querySelector('#hp-bar');
        this.xpBar = hud.querySelector('#xp-bar');
        this.killCountSpan = questLog.querySelector('#kill-count');
        this.goldDisplay = hud.querySelector('#gold-display');
        this.weaponSlot = inventory.querySelector('#weapon-slot');
        this.inventoryPanel = inventory;
        
        this.gold = 0;
        this.kills = 0;
    }

    setupListeners() {
        window.addEventListener('player-health-changed', (e) => {
            const { health, maxHealth } = e.detail;
            const percent = (health / maxHealth) * 100;
            this.hpBar.style.width = `${Math.max(0, percent)}%`;
        });

        window.addEventListener('enemy-died', () => {
            if (this.kills < 5) {
                this.kills++;
                this.killCountSpan.textContent = this.kills;
                if (this.kills === 5) {
                    this.showMessage("Quest Complete! Village Safe (Bonus Gold)");
                    this.addGold(100);
                }
            }
        });

        window.addEventListener('chest-opened', (e) => {
            const { gold } = e.detail;
            this.addGold(gold);
            this.showMessage(`Found ${gold} gold!`);
        });

        window.addEventListener('inventory-toggle', (e) => {
            const { visible } = e.detail;
            this.inventoryPanel.style.display = visible ? 'block' : 'none';
        });

        window.addEventListener('weapon-changed', (e) => {
            const { equipped } = e.detail;
            this.weaponSlot.textContent = equipped ? 'Weapon Slot: Golden Sword (equipped)' : 'Weapon Slot: Empty';
        });
    }

    addGold(amount) {
        this.gold += amount;
        this.goldDisplay.textContent = `Gold: ${this.gold}g`;
    }

    showMessage(text) {
        const msg = document.createElement('div');
        msg.style.position = 'fixed';
        msg.style.top = '50%';
        msg.style.left = '50%';
        msg.style.transform = 'translate(-50%, -50%)';
        msg.style.color = '#f1c40f';
        msg.style.fontSize = '32px';
        msg.style.fontFamily = "'Orbitron', sans-serif";
        msg.style.textShadow = '4px 4px #000';
        msg.style.pointerEvents = 'none';
        msg.textContent = text;
        document.body.appendChild(msg);

        let opacity = 1;
        const fade = setInterval(() => {
            opacity -= 0.02;
            msg.style.opacity = opacity;
            if (opacity <= 0) {
                clearInterval(fade);
                document.body.removeChild(msg);
            }
        }, 30);
    }
}
