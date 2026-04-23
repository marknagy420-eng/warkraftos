import * as THREE from 'three';

export class AnimationController {
    constructor(model, clipsByName = {}) {
        this.mixer = new THREE.AnimationMixer(model);
        this.actions = new Map();
        this.currentAnimation = null;

        Object.entries(clipsByName).forEach(([name, clip]) => {
            if (!clip) return;
            const action = this.mixer.clipAction(clip);
            const oneShot = /Jump|Attack|Heavy|Slash|Block|Impact|Death|PowerUp|Spin|CrouchToStand|Magic/i.test(name);
            action.clampWhenFinished = oneShot;
            action.loop = oneShot ? THREE.LoopOnce : THREE.LoopRepeat;
            this.actions.set(name, action);
        });
    }

    update(deltaTime) {
        this.mixer.update(deltaTime);
    }

    Play(animationName) {
        if (this.currentAnimation === animationName) return;
        const next = this.actions.get(animationName);
        if (!next) return;

        next.enabled = true;
        next.setEffectiveTimeScale(1);
        next.setEffectiveWeight(1);
        if (!next.isRunning()) {
            next.reset();
        }
        next.play();

        if (this.currentAnimation) {
            this.CrossFade(this.currentAnimation, animationName, 0.18);
        }

        this.currentAnimation = animationName;
    }

    Stop(animationName) {
        const action = this.actions.get(animationName);
        if (!action) return;
        action.stop();
        if (this.currentAnimation === animationName) {
            this.currentAnimation = null;
        }
    }

    CrossFade(fromAnimationName, toAnimationName, duration) {
        const from = this.actions.get(fromAnimationName);
        const to = this.actions.get(toAnimationName);
        if (!to) return;
        if (!from) {
            to.reset().play();
            return;
        }
        from.crossFadeTo(to, duration, true);
    }
}
