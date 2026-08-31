(() => {
    "use strict";

    const DEFAULT_MAX_LEVEL = 8;
    const PORTAL_LOCK_LEVEL = 2;

    function normalizedMaximum(value) {
        const numeric = Number(value);
        return Number.isFinite(numeric) && numeric >= 1
            ? Math.trunc(numeric)
            : DEFAULT_MAX_LEVEL;
    }

    function createState(maxLevel = DEFAULT_MAX_LEVEL) {
        const maximum = normalizedMaximum(maxLevel);
        let level;
        let started;
        let disabled;
        let failed;

        function snapshot() {
            return Object.freeze({
                level,
                maxLevel: maximum,
                started,
                disabled,
                failed
            });
        }

        function reset() {
            level = 0;
            started = false;
            disabled = false;
            failed = false;
            return snapshot();
        }

        function start() {
            if (!failed && !disabled) {
                started = true;
                level = Math.max(1, level);
            }
            return snapshot();
        }

        function advance(steps = 1) {
            if (!started || disabled || failed) return snapshot();
            const numericSteps = Number(steps);
            const amount = Number.isFinite(numericSteps)
                ? Math.max(0, Math.trunc(numericSteps))
                : 0;
            level = Math.min(maximum, level + amount);
            failed = level >= maximum;
            return snapshot();
        }

        function disable() {
            if (!started || failed) return snapshot();
            disabled = true;
            level = 0;
            return snapshot();
        }

        function fail() {
            if (!disabled) {
                started = true;
                failed = true;
                level = maximum;
            }
            return snapshot();
        }

        function isPortalOpen(artifactSecured = false) {
            return !artifactSecured || disabled || (!failed && level < PORTAL_LOCK_LEVEL);
        }

        reset();
        return Object.freeze({
            advance,
            disable,
            fail,
            isPortalOpen,
            reset,
            snapshot,
            start
        });
    }

    window.PixelmuseumAlarmCore = Object.freeze({
        DEFAULT_MAX_LEVEL,
        PORTAL_LOCK_LEVEL,
        createState
    });
})();
