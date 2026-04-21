/**
 * Stateless rule set + small state holder.
 * Priority order is explicit and only transitions when target state changes.
 */
export class CharacterStateMachine {
    constructor() {
        this.currentState = 'Idle';
        this.stateBeforeJump = 'Idle';
        this.isJumpLocked = false;
        this.priority = ['Jump', 'Run', 'Walk', 'Crouch', 'Idle'];
    }

    evaluate(input) {
        // Jump hard-lock: animation/controller decides when to unlock.
        if (this.isJumpLocked) {
            return this.currentState;
        }

        if (input.jumpPressed) {
            this.stateBeforeJump = this.currentState;
            this.isJumpLocked = true;
            this.currentState = 'Jump';
            return this.currentState;
        }

        // Required priority: Jump > Run > Walk > Crouch > Idle
        if (input.isRunCombo) {
            this.currentState = 'Run';
        } else if (input.hasMove) {
            this.currentState = 'Walk';
        } else if (input.isCrouching) {
            this.currentState = 'Crouch';
        } else {
            this.currentState = 'Idle';
        }

        return this.currentState;
    }

    notifyJumpFinished() {
        this.isJumpLocked = false;
        this.currentState = this.stateBeforeJump || 'Idle';
        return this.currentState;
    }
}
