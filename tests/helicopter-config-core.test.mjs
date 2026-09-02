import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadCore() {
    const window = {};
    const context = vm.createContext({ Array, JSON, Object, window });
    vm.runInContext(
        readFileSync(new URL("../assets/helicopter-config-core.js", import.meta.url), "utf8"),
        context
    );
    return window.HelicopterConfigCore;
}

function targetConfig() {
    return {
        heli: { zugang_offen: true },
        cockpit: {
            hauptdisplay_online: true,
            navigation_online: false,
            rotor_online: false
        },
        hangar: { tor_offen: true }
    };
}

function validateConfig(core, config) {
    return core.validate(JSON.stringify(config));
}

test("the helicopter configuration starts with the agreed grouped Boolean values", () => {
    const core = loadCore();

    assert.deepEqual(JSON.parse(core.START_CONFIG_TEXT), {
        heli: { zugang_offen: false },
        cockpit: {
            hauptdisplay_online: true,
            navigation_online: false,
            rotor_online: false
        },
        hangar: { tor_offen: false }
    });
});

test("semantically correct JSON is accepted independent of formatting and key order", () => {
    const core = loadCore();
    const reordered = `
        {
          "hangar": { "tor_offen": true },
          "cockpit": {
            "rotor_online": false,
            "navigation_online": false,
            "hauptdisplay_online": true
          },
          "heli": { "zugang_offen": true }
        }
    `;

    assert.equal(core.validate(JSON.stringify(targetConfig())).passed, true);
    assert.equal(core.validate(reordered).passed, true);
    assert.equal(core.validate(reordered).failure, null);
});

test("invalid JSON text is rejected before being interpreted as configuration", () => {
    const core = loadCore();

    for (const source of [
        "",
        "{",
        '{"heli":{"zugang_offen":true},}',
        "not JSON",
        null
    ]) {
        const result = core.validate(source);
        assert.equal(result.passed, false);
        assert.equal(result.failure, core.FAILURES.INVALID_JSON);
    }
});

test("the root and every group must keep exactly the agreed fields", () => {
    const core = loadCore();
    const variants = [];

    const extraRoot = targetConfig();
    extraRoot.notiz = "bereit";
    variants.push(extraRoot);

    const missingGroup = targetConfig();
    delete missingGroup.hangar;
    variants.push(missingGroup);

    const extraNestedField = targetConfig();
    extraNestedField.cockpit.funk_online = false;
    variants.push(extraNestedField);

    const missingNestedField = targetConfig();
    delete missingNestedField.cockpit.rotor_online;
    variants.push(missingNestedField);

    const wrongGroupShape = targetConfig();
    wrongGroupShape.heli = [];
    variants.push(wrongGroupShape);

    for (const config of variants) {
        const result = validateConfig(core, config);
        assert.equal(result.passed, false, JSON.stringify(config));
        assert.equal(result.failure, core.FAILURES.STRUCTURE_CHANGED, JSON.stringify(config));
    }
});

test("all configuration values must remain real JSON Booleans", () => {
    const core = loadCore();
    const fields = [
        ["heli", "zugang_offen"],
        ["cockpit", "hauptdisplay_online"],
        ["cockpit", "navigation_online"],
        ["cockpit", "rotor_online"],
        ["hangar", "tor_offen"]
    ];

    for (const [group, field] of fields) {
        const config = targetConfig();
        config[group][field] = "true";
        const result = validateConfig(core, config);
        assert.equal(result.passed, false, `${group}.${field}`);
        assert.equal(result.failure, core.FAILURES.BOOLEAN_REQUIRED, `${group}.${field}`);
    }
});

test("both the helicopter access and the hangar gate must be open", () => {
    const core = loadCore();
    const bothClosed = targetConfig();
    bothClosed.heli.zugang_offen = false;
    bothClosed.hangar.tor_offen = false;
    assert.equal(validateConfig(core, bothClosed).failure, core.FAILURES.TARGETS_CLOSED);

    const helicopterClosed = targetConfig();
    helicopterClosed.heli.zugang_offen = false;
    assert.equal(validateConfig(core, helicopterClosed).failure, core.FAILURES.HELI_CLOSED);

    const hangarClosed = targetConfig();
    hangarClosed.hangar.tor_offen = false;
    assert.equal(validateConfig(core, hangarClosed).failure, core.FAILURES.HANGAR_CLOSED);

    assert.equal(validateConfig(core, targetConfig()).passed, true);
});

test("the three cockpit values may not be changed in this step", () => {
    const core = loadCore();
    const changedValues = [
        ["hauptdisplay_online", false],
        ["navigation_online", true],
        ["rotor_online", true]
    ];

    for (const [field, value] of changedValues) {
        const config = targetConfig();
        config.cockpit[field] = value;
        const result = validateConfig(core, config);
        assert.equal(result.passed, false, field);
        assert.equal(result.failure, core.FAILURES.COCKPIT_CHANGED, field);
    }
});
