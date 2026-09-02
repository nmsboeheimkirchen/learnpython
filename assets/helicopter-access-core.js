(() => {
    "use strict";

    const NOISE_CHARACTER = "?";
    const PASSWORD_LENGTH = 256;
    const LOWERCASE_CHARACTERS = "abcdefghijklmnopqrstuvwxyz";
    const UPPERCASE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const DIGIT_CHARACTERS = "0123456789";
    const SPECIAL_CHARACTERS = "!#$%&()*+,-./:;<=>@[]^_{|}~";
    const PASSWORD_CHARACTERS = LOWERCASE_CHARACTERS + UPPERCASE_CHARACTERS + DIGIT_CHARACTERS + SPECIAL_CHARACTERS;
    const FAILURES = Object.freeze({
        RECEIVE_REQUIRED: "RECEIVE_REQUIRED",
        WRONG_PASSWORD: "WRONG_PASSWORD"
    });

    function pick(characters, value) {
        return characters[value % characters.length];
    }

    function createRandomPassword(randomSource = window.crypto) {
        if (!randomSource || typeof randomSource.getRandomValues !== "function") {
            throw new Error("Sicherer Zufallsgenerator nicht verfügbar.");
        }

        const entropy = new Uint32Array(PASSWORD_LENGTH * 2 - 1);
        randomSource.getRandomValues(entropy);
        const password = [
            pick(LOWERCASE_CHARACTERS, entropy[0]),
            pick(UPPERCASE_CHARACTERS, entropy[1]),
            pick(DIGIT_CHARACTERS, entropy[2]),
            pick(SPECIAL_CHARACTERS, entropy[3])
        ];
        for (let index = password.length; index < PASSWORD_LENGTH; index += 1) {
            password.push(pick(PASSWORD_CHARACTERS, entropy[index]));
        }

        let entropyIndex = PASSWORD_LENGTH;
        for (let index = password.length - 1; index > 0; index -= 1) {
            const swapIndex = entropy[entropyIndex] % (index + 1);
            entropyIndex += 1;
            [password[index], password[swapIndex]] = [password[swapIndex], password[index]];
        }
        return password.join("");
    }

    function createState(password = createRandomPassword()) {
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
        createRandomPassword,
        createState
    });
})();
