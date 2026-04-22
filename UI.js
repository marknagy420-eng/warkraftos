import { CONFIG } from './config.js';
import { QUESTS } from './quests.js';

export class UI {
    constructor(language = 'en') {
        this.language = language;
        this.stats = { health: 100, food: 100, water: 100, energy: 100, fatigue: 0 };
        this.inventory = new Map();
        this.setupHTML();
        this.setupListeners();
        this.startNeedsLoop();
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
            <div id="quest-title" style="font-size: 14px; margin-bottom: 6px;"></div>
            <div id="quest-state" style="font-size: 12px; opacity: 0.85; margin-bottom: 8px;"></div>
            <ul id="quest-objectives" style="margin: 0; padding-left: 18px; font-size: 12px;"></ul>
            <div id="quest-text" style="margin-top: 8px;">Clear the Forest: <span id="kill-count">0</span>/5 Goblins</div>
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
        prompt.innerHTML = 'WASD Move | Shift Run | C Crouch | Space Jump | I Inventory | 1 Sword | Left Click Attack | M Map';
        this.prompt = prompt;
        document.body.appendChild(prompt);

        const inventory = document.createElement('div');
        inventory.id = 'inventory-panel';
        inventory.style.position = 'fixed';
        inventory.style.inset = '7% 10%';
        inventory.style.background = 'linear-gradient(160deg, rgba(10,10,10,0.92), rgba(58,24,8,0.82))';
        inventory.style.border = '2px solid rgba(240,132,48,0.55)';
        inventory.style.borderRadius = '12px';
        inventory.style.padding = '18px';
        inventory.style.fontFamily = "'Orbitron', sans-serif";
        inventory.style.color = CONFIG.COLORS.UI_TEXT;
        inventory.style.display = 'none';
        inventory.style.zIndex = '1200';
        inventory.style.backdropFilter = 'blur(2px)';
        inventory.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <div style="font-size: 24px; color:#ff8f33; letter-spacing:1px;">INVENTORY</div>
                <div style="font-size: 13px; opacity:0.85;">[I] Close</div>
            </div>
            <div style="display:grid; grid-template-columns: 1.8fr 1fr; gap:16px;">
                <div>
                    <div style="font-size:13px; margin-bottom:8px; color:#ffc58d;">Character Inventory</div>
                    <div id="inventory-grid" style="display:grid; grid-template-columns: repeat(6, minmax(0,1fr)); gap:8px;"></div>
                    <div id="weapon-slot" style="font-size: 13px; opacity: 0.9; margin-top:12px;">Weapon Slot: Empty</div>
                </div>
                <div>
                    <div style="font-size:13px; color:#ffc58d; margin-bottom:8px;">Vitals</div>
                    <div id="needs-panel" style="display:grid; gap:8px;"></div>
                    <button id="eat-meat-btn" style="margin-top:12px; width:100%; background:#3d2a1a; color:#ffdbbf; border:1px solid #ad6b35; padding:8px; cursor:pointer;">Eat Meat (E)</button>
                </div>
            </div>
        `;
        document.body.appendChild(inventory);

        this.hpBar = hud.querySelector('#hp-bar');
        this.xpBar = hud.querySelector('#xp-bar');
        this.killCountSpan = questLog.querySelector('#kill-count');
        this.questTitle = questLog.querySelector('#quest-title');
        this.questState = questLog.querySelector('#quest-state');
        this.questObjectives = questLog.querySelector('#quest-objectives');
        this.goldDisplay = hud.querySelector('#gold-display');
        this.weaponSlot = inventory.querySelector('#weapon-slot');
        this.inventoryPanel = inventory;
        this.inventoryGrid = inventory.querySelector('#inventory-grid');
        this.needsPanel = inventory.querySelector('#needs-panel');
        this.eatButton = inventory.querySelector('#eat-meat-btn');
        
        this.gold = 0;
        this.kills = 0;
        this.activeQuest = QUESTS.Q001_ShadowAwakening;
        this.activeQuestStateId = 'START';
        this.renderQuestState();
        this.renderInventory();
        this.renderNeeds();
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
            this.addItem('gold', Math.floor(gold / 10), '🪙');
            this.showMessage(`Found ${gold} gold!`);
        });

        window.addEventListener('item-collected', (e) => {
            const { itemId, amount, icon } = e.detail;
            this.addItem(itemId, amount, icon);
            this.showMessage(`Collected: ${itemId} +${amount}`);
        });

        window.addEventListener('inventory-toggle', (e) => {
            const { visible } = e.detail;
            this.inventoryPanel.style.display = visible ? 'block' : 'none';
        });

        window.addEventListener('weapon-changed', (e) => {
            const { equipped } = e.detail;
            this.weaponSlot.textContent = equipped ? 'Weapon Slot: Golden Sword (equipped)' : 'Weapon Slot: Empty';
        });

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyE' && this.inventoryPanel.style.display !== 'none') {
                this.consumeFood();
            }
        });

        this.eatButton.addEventListener('click', () => this.consumeFood());

        window.addEventListener('language-changed', (e) => {
            this.language = e.detail.language;
            const textMap = {
                hu: 'WASD mozgás | Shift futás | C guggolás | Space ugrás | I inventory | 1 kard | Bal klikk támadás | M térkép',
                en: 'WASD Move | Shift Run | C Crouch | Space Jump | I Inventory | 1 Sword | Left Click Attack | M Map'
            };
            this.prompt.textContent = textMap[this.language] || textMap.en;
        });
    }

    addGold(amount) {
        this.gold += amount;
        this.goldDisplay.textContent = `Gold: ${this.gold}g`;
    }

    addItem(itemId, amount = 1, icon = '📦') {
        const prev = this.inventory.get(itemId) || { amount: 0, icon };
        prev.amount += amount;
        prev.icon = icon || prev.icon;
        this.inventory.set(itemId, prev);
        this.renderInventory();
    }

    consumeFood() {
        const meat = this.inventory.get('meat');
        if (!meat || meat.amount <= 0) {
            this.showMessage('No meat in inventory!');
            return;
        }
        meat.amount -= 1;
        if (meat.amount <= 0) this.inventory.delete('meat');
        this.stats.food = Math.min(100, this.stats.food + 28);
        this.stats.energy = Math.min(100, this.stats.energy + 16);
        this.stats.fatigue = Math.max(0, this.stats.fatigue - 10);
        this.renderInventory();
        this.renderNeeds();
        this.showMessage('You ate roasted rib.');
    }

    renderInventory() {
        if (!this.inventoryGrid) return;
        this.inventoryGrid.innerHTML = '';
        const entries = [...this.inventory.entries()];
        const maxSlots = 24;
        for (let i = 0; i < maxSlots; i++) {
            const slot = document.createElement('div');
            slot.style.border = '1px solid rgba(210,210,210,0.4)';
            slot.style.height = '62px';
            slot.style.borderRadius = '6px';
            slot.style.background = 'rgba(13,13,13,0.45)';
            slot.style.display = 'flex';
            slot.style.alignItems = 'center';
            slot.style.justifyContent = 'center';
            slot.style.fontSize = '28px';
            const entry = entries[i];
            if (entry) {
                const [name, data] = entry;
                slot.textContent = data.icon || '📦';
                const qty = document.createElement('div');
                qty.textContent = `${data.amount}`;
                qty.style.position = 'absolute';
                qty.style.fontSize = '12px';
                qty.style.marginTop = '42px';
                slot.style.position = 'relative';
                slot.title = `${name} (${data.amount})`;
                slot.appendChild(qty);
            }
            this.inventoryGrid.appendChild(slot);
        }
    }

    renderNeeds() {
        const bars = [
            ['Health', this.stats.health, '#ff5f4d'],
            ['Food', this.stats.food, '#ff9f33'],
            ['Water', this.stats.water, '#5fc9ff'],
            ['Energy', this.stats.energy, '#e5ff57'],
            ['Fatigue', this.stats.fatigue, '#b792ff']
        ];
        this.needsPanel.innerHTML = '';
        bars.forEach(([label, value, color]) => {
            const row = document.createElement('div');
            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:2px;">
                    <span>${label}</span><span>${Math.round(value)}/100</span>
                </div>
                <div style="height:8px; background:#222; border:1px solid #000;">
                    <div style="height:100%; width:${Math.max(0, value)}%; background:${color}; transition:width .2s;"></div>
                </div>
            `;
            this.needsPanel.appendChild(row);
        });
    }

    startNeedsLoop() {
        setInterval(() => {
            this.stats.food = Math.max(0, this.stats.food - 0.18);
            this.stats.water = Math.max(0, this.stats.water - 0.22);
            this.stats.energy = Math.max(0, this.stats.energy - 0.12);
            this.stats.fatigue = Math.min(100, this.stats.fatigue + 0.15);
            if (this.stats.food < 10 || this.stats.water < 10) {
                this.stats.health = Math.max(1, this.stats.health - 0.25);
            }
            this.renderNeeds();
        }, 1000);
    }

    renderQuestState() {
        if (!this.activeQuest) return;
        const state = this.activeQuest.states.find((s) => s.id === this.activeQuestStateId) || this.activeQuest.states[0];
        this.questTitle.textContent = this.activeQuest.title;
        this.questState.textContent = `State: ${state.id}`;
        this.questObjectives.innerHTML = '';
        (state.objectives || []).forEach((objective) => {
            const li = document.createElement('li');
            li.textContent = objective;
            this.questObjectives.appendChild(li);
        });
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
