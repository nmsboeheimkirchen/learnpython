(() => {
    "use strict";

    const NOISE_CHARACTER = "?";
    const SIGNAL_PARTS = Object.freeze(["s?e?", "r?u?", "#?7"]);
    const FAILURES = Object.freeze({
        RECEIVE_REQUIRED: "RECEIVE_REQUIRED",
        TRANSFORM_REQUIRED: "TRANSFORM_REQUIRED",
        WRONG_PASSWORD: "WRONG_PASSWORD"
    });

    function interceptedSignal() {
        return SIGNAL_PARTS.join("");
    }

    function decodedSignal() {
        return interceptedSignal().split(NOISE_CHARACTER).join("");
    }

    function createState() {
        let sequence;
        let receiveCount;
        let checkAttempts;
        let accessGranted;
        let lastFailure;

        function snapshot() {
            return Object.freeze({
                sequence,
                receiveCount,
                checkCount: checkAttempts.length,
                checkAttempts: Object.freeze(checkAttempts.map(attempt => Object.freeze({ ...attempt }))),
                accessGranted,
                lastFailure
            });
        }

        function reset() {
            sequence = 0;
            receiveCount = 0;
            checkAttempts = [];
            accessGranted = false;
            lastFailure = null;
            return snapshot();
        }

        function receive() {
            sequence += 1;
            receiveCount += 1;
            return interceptedSignal();
        }

        function check(candidate, trustedTransform = false) {
            sequence += 1;
            let failure = null;
            if (receiveCount < 1) {
                failure = FAILURES.RECEIVE_REQUIRED;
            } else if (!trustedTransform) {
                failure = FAILURES.TRANSFORM_REQUIRED;
            } else if (candidate !== decodedSignal()) {
                failure = FAILURES.WRONG_PASSWORD;
            }

            const accepted = failure === null;
            accessGranted = accessGranted || accepted;
            lastFailure = accepted ? null : failure;
            checkAttempts.push({
                sequence,
                accepted,
                trustedTransform: Boolean(trustedTransform)
            });
            return accepted;
        }

        reset();
        return Object.freeze({ check, receive, reset, snapshot });
    }

    window.HelicopterAccessCore = Object.freeze({
        FAILURES,
        NOISE_CHARACTER,
        createState
    });
})();
