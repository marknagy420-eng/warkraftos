export class InputHandler {
    constructor() {
        this.keys = new Set();
        this.previous = {
            jumpPressed: false
        };
        this.eventTargets = [window, document];

        this.keyAliasByKey = {
            w: 'KeyW',
            a: 'KeyA',
            s: 'KeyS',
            d: 'KeyD',
            ' ': 'Space',
            shift: 'ShiftLeft',
            c: 'KeyC'
        };

        this.getCanonicalCode = (event) => {
            if (event.code && event.code !== 'Unidentified') {
                return event.code;
            }

            const normalizedKey = typeof event.key === 'string'
                ? event.key.toLowerCase()
                : '';

            return this.keyAliasByKey[normalizedKey] || null;
        };

        this.onKeyDown = (event) => {
            const target = event.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return;
            }

            const canonicalCode = this.getCanonicalCode(event);
            if (canonicalCode) {
                this.keys.add(canonicalCode);
            }
        };

        this.onKeyUp = (event) => {
            const canonicalCode = this.getCanonicalCode(event);
            if (canonicalCode) {
                this.keys.delete(canonicalCode);
            }
        };

        this.onBlur = () => {
            this.keys.clear();
            this.previous.jumpPressed = false;
        };

        for (const target of this.eventTargets) {
            target.addEventListener('keydown', this.onKeyDown, true);
            target.addEventListener('keyup', this.onKeyUp, true);
        }
        window.addEventListener('blur', this.onBlur);
        document.addEventListener('visibilitychange', this.onBlur);
    }

    snapshot() {
        const state = this.getState();
        const jumpDown = state.jumpDown;
        const jumpPressed = jumpDown && !this.previous.jumpPressed;
        this.previous.jumpPressed = jumpDown;

        return {
            ...state,
            jumpPressed,
            jumpDown
        };
    }

    getState() {
        const hasW = this.keys.has('KeyW');
        const hasA = this.keys.has('KeyA');
        const hasS = this.keys.has('KeyS');
        const hasD = this.keys.has('KeyD');
        const hasMove = hasW || hasA || hasS || hasD;
        const hasShift = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
        const hasCrouch = this.keys.has('KeyC');
        const jumpDown = this.keys.has('Space');

        return {
            hasW,
            hasA,
            hasS,
            hasD,
            hasMove,
            isRunCombo: hasW && hasShift,
            isCrouching: hasCrouch,
            jumpDown
        };
    }

    destroy() {
        for (const target of this.eventTargets) {
            target.removeEventListener('keydown', this.onKeyDown, true);
            target.removeEventListener('keyup', this.onKeyUp, true);
        }
        window.removeEventListener('blur', this.onBlur);
        document.removeEventListener('visibilitychange', this.onBlur);
    }
}
