import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildStaticSite } from '../scripts/build-static-site.mjs';

test('a Pages release contains public assets but no PHP source, database, credentials or test fixtures', () => {
    const dir = mkdtempSync(join(tmpdir(), 'agentpy-release-'));
    const source = join(dir, 'source');
    const destination = join(dir, 'output');
    for (const directory of ['assets/images', 'assets/vendor/library/1.2.3', 'prototypes', 'server/src', 'tests', '.cache', '.github']) {
        mkdirSync(join(source, directory), { recursive: true });
    }
    for (const [file, content] of Object.entries({
        'index.html': '<html>Agent Py</html>',
        'assets/runner.js': '// public browser code',
        'assets/vendor/library/1.2.3/runtime.min.js': '// versioned dependency',
        'prototypes/finale.js': '// productive museum runtime',
        'prototypes/finale.css': '/* productive museum styles */',
        'prototypes/private.php': '<?php // not public',
        'assets/images/preview.webp': 'test image bytes',
        'assets/config.php': '<?php /* must never be published statically */',
        '.env': 'DATABASE_PASSWORD=do-not-publish',
        'server/src/bootstrap.php': 'private server code',
        'server/schema.sql': 'private schema',
        'tests/backend-fixture.php': 'test fixture',
        '.cache/test.sqlite': 'database content',
        '.github/workflow.yml': 'workflow',
    })) writeFileSync(join(source, file), content);
    const commit = 'a'.repeat(40);
    buildStaticSite({ source, destination, commit });
    assert.equal(readFileSync(join(destination, 'index.html'), 'utf8'), '<html>Agent Py</html>');
    assert.ok(existsSync(join(destination, 'assets/runner.js')));
    assert.ok(existsSync(join(destination, 'assets/vendor/library/1.2.3/runtime.min.js')));
    assert.ok(existsSync(join(destination, 'prototypes/finale.js')));
    assert.ok(existsSync(join(destination, 'prototypes/finale.css')));
    assert.equal(existsSync(join(destination, 'prototypes/private.php')), false);
    assert.ok(existsSync(join(destination, 'assets/images/preview.webp')));
    assert.equal(readFileSync(join(destination, 'deploy-meta', `${commit}.txt`), 'utf8'), `${commit}\n`);
    for (const file of ['server', 'tests', '.env', '.cache', '.github', 'assets/config.php']) {
        assert.equal(existsSync(join(destination, file)), false, `${file} leaked into public release`);
    }
    assert.throws(() => buildStaticSite({ source, destination }), /must be empty/);
});
