(() => {
    "use strict";

    const NOISE_CHARACTER = "?";
    const PASSWORD_LENGTH = 256;
    const SPECIAL_CHARACTERS = "!#$%&()*+,-./:;<=>@[]^_{|}~";
    // Public teaching material, not a credential. Decoding reveals a readable reward.
    const PASSPHRASE = "Um Mitternacht tanzen 17 Gurken im Raumanzug auf dem Schuldach. Ein pinker Pinguin serviert dem Helikopter warmes Eis, waehrend die Direktorin mit einem Toaster Schach spielt. Agent, bring die singende Socke sicher heim und vergiss den Wackelpudding nicht!";
    const FAILURES = Object.freeze({
        RECEIVE_REQUIRED: "RECEIVE_REQUIRED",
        WRONG_PASSWORD: "WRONG_PASSWORD"
    });

    function createPassphrase() {
        return PASSPHRASE;
    }

    function createState(password = createPassphrase()) {
        if (typeof password !== "string" || password.length !== PASSWORD_LENGTH || password.includes(NOISE_CHARACTER)) {
            throw new TypeError(`Das Bordcomputer-Passwort muss aus ${PASSWORD_LENGTH} Zeichen ohne ${NOISE_CHARACTER} bestehen.`);
        }

        const signal = [...password].join(NOISE_CHARACTER);
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
            return signal;
        }

        function check(candidate) {
            sequence += 1;
            let failure = null;
            if (candidate === password) {
                failure = null;
            } else if (receiveCount < 1) {
                failure = FAILURES.RECEIVE_REQUIRED;
            } else {
                failure = FAILURES.WRONG_PASSWORD;
            }

            const accepted = failure === null;
            accessGranted = accessGranted || accepted;
            lastFailure = accepted ? null : failure;
            checkAttempts.push({
                sequence,
                accepted
            });
            return accepted;
        }

        reset();
        return Object.freeze({ check, receive, reset, snapshot });
    }

    window.HelicopterAccessCore = Object.freeze({
        FAILURES,
        NOISE_CHARACTER,
        PASSWORD_LENGTH,
        SPECIAL_CHARACTERS,
        createPassphrase,
        createState
    });
})();
