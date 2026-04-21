export class InputHandler {
    constructor() {
        this.keys = new Set();
        this.previous = {
            jumpPressed: false
        };

        this.onKeyDown = (event) => {
            const target = event.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return;
            }
            this.keys.add(event.code);
        };

        this.onKeyUp = (event) => {
            this.keys.delete(event.code);
        };

        this.onBlur = () => {
            this.keys.clear();
            this.previous.jumpPressed = false;
        };

        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('blur', this.onBlur);
    }

    snapshot() {
        const hasW = this.keys.has('KeyW');
        const hasA = this.keys.has('KeyA');
        const hasS = this.keys.has('KeyS');
        const hasD = this.keys.has('KeyD');
        const hasMove = hasW || hasA || hasS || hasD;
        const hasShift = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
        const hasCrouch = this.keys.has('KeyC');
        const jumpDown = this.keys.has('Space');
        const jumpPressed = jumpDown && !this.previous.jumpPressed;
        this.previous.jumpPressed = jumpDown;

        return {
            hasW,
            hasA,
            hasS,
            hasD,
            hasMove,
            isRunCombo: hasW && hasShift,
            isCrouching: hasCrouch,
            jumpPressed,
            jumpDown
        };
    }

    destroy() {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('blur', this.onBlur);
    }
}
