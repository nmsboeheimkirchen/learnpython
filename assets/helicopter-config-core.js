(() => {
    "use strict";

    const START_CONFIG_TEXT = `{
  "heli": {
    "zugang_offen": false
  },
  "cockpit": {
    "hauptdisplay_online": true,
    "navigation_online": false,
    "rotor_online": false
  },
  "hangar": {
    "tor_offen": false
  }
}`;

    const FAILURES = Object.freeze({
        INVALID_JSON: "INVALID_JSON",
        STRUCTURE_CHANGED: "STRUCTURE_CHANGED",
        BOOLEAN_REQUIRED: "BOOLEAN_REQUIRED",
        COCKPIT_CHANGED: "COCKPIT_CHANGED",
        TARGETS_CLOSED: "TARGETS_CLOSED",
        HELI_CLOSED: "HELI_CLOSED",
        HANGAR_CLOSED: "HANGAR_CLOSED"
    });

    function isObject(value) {
        return value !== null && typeof value === "object" && !Array.isArray(value);
    }

    function hasExactKeys(value, expectedKeys) {
        if (!isObject(value)) return false;
        const keys = Object.keys(value).sort();
        const expected = [...expectedKeys].sort();
        return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
    }

    function result(passed, failure = null) {
        return Object.freeze({ passed, failure });
    }

    function validate(source) {
        if (typeof source !== "string") return result(false, FAILURES.INVALID_JSON);

        let config;
        try {
            config = JSON.parse(source);
        } catch (_error) {
            return result(false, FAILURES.INVALID_JSON);
        }

        if (
            !hasExactKeys(config, ["heli", "cockpit", "hangar"]) ||
            !hasExactKeys(config.heli, ["zugang_offen"]) ||
            !hasExactKeys(config.cockpit, ["hauptdisplay_online", "navigation_online", "rotor_online"]) ||
            !hasExactKeys(config.hangar, ["tor_offen"])
        ) {
            return result(false, FAILURES.STRUCTURE_CHANGED);
        }

        const booleanValues = [
            config.heli.zugang_offen,
            config.cockpit.hauptdisplay_online,
            config.cockpit.navigation_online,
            config.cockpit.rotor_online,
            config.hangar.tor_offen
        ];
        if (booleanValues.some(value => typeof value !== "boolean")) {
            return result(false, FAILURES.BOOLEAN_REQUIRED);
        }

        if (
            config.cockpit.hauptdisplay_online !== true ||
            config.cockpit.navigation_online !== false ||
            config.cockpit.rotor_online !== false
        ) {
            return result(false, FAILURES.COCKPIT_CHANGED);
        }

        if (!config.heli.zugang_offen && !config.hangar.tor_offen) {
            return result(false, FAILURES.TARGETS_CLOSED);
        }
        if (!config.heli.zugang_offen) return result(false, FAILURES.HELI_CLOSED);
        if (!config.hangar.tor_offen) return result(false, FAILURES.HANGAR_CLOSED);
        return result(true);
    }

    window.HelicopterConfigCore = Object.freeze({
        FAILURES,
        START_CONFIG_TEXT,
        validate
    });
})();
