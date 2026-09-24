import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { buildHostingerRelease, releaseFiles } from '../scripts/build-hostinger-release.mjs';

function fixture() {
    const root = mkdtempSync(join(tmpdir(), 'agentpy-hostinger-'));
    const source = join(root, 'source');
    const files = {
        'index.html': '<script src="assets/app.js?v=old"></script><link href="assets/style.css" rel="stylesheet"><script src="https://cdn.example.test/app.js"></script>',
        'assets/app.js': '// code', 'assets/style.css': 'body {}', 'assets/data/account-config.js': 'window.AgentAccountConfig = { enabled: false };',
        'assets/vendor/1.2.3/LICENSE': 'license', 'assets/vendor/1.2.3/runtime.js': '// versioned vendor',
        'assets/password': 'DO_NOT_PUBLISH', 'assets/password.txt': 'DO_NOT_PUBLISH', 'assets/config.php': 'DO_NOT_PUBLISH',
        'notes.txt': 'DO_NOT_PUBLISH', '.env': 'DO_NOT_PUBLISH', 'server/config.local.php': 'DO_NOT_PUBLISH',
        'server/src/bootstrap.php': '<?php // bootstrap', 'server/src/auth.php': '<?php // auth', 'server/src/storage.php': '<?php // storage',
        'server/src/account-management.php': '<?php // accounts and migration',
        'server/src/registration.php': '<?php // registration', 'server/src/mail.php': '<?php // mail worker',
        'server/registration-schema.sql': '-- registration schema',
        'server/recovery-schema.sql': '-- recovery schema', 'server/src/recovery.php': '<?php // recovery',
        'server/src/smtp.php': '<?php // SMTP adapter',
        'server/src/teachers.php': '<?php // teacher functions', 'server/teacher-schema.sql': '-- teacher schema', 'server/membership-schema.sql': '-- membership schema',
        'server/vendor/phpmailer/Exception.php': '<?php // vendor', 'server/vendor/phpmailer/PHPMailer.php': '<?php // vendor',
        'server/vendor/phpmailer/SMTP.php': '<?php // vendor', 'server/vendor/phpmailer/LICENSE': 'license', 'server/vendor/phpmailer/README.agentpy.md': 'provenance',
        'server/bin/mail-worker.php': '<?php // stable private cron dispatcher',
        'server/public/api/index.php': '<?php // API', 'server/bin/manage.php': '<?php // management', 'server/schema.sql': '-- schema',
    };
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(join(source, path, '..'), { recursive: true }); writeFileSync(join(source, path), content);
    }
    return { root, source, destination: join(root, 'release'), releaseId: 'test-release' };
}

test('Hostinger release separates private PHP from webroot and cannot copy passwords', () => {
    const options = fixture(); buildHostingerRelease(options);
    const files = releaseFiles(options.destination);
    assert.deepEqual(files.filter(path => path.startsWith('public/') && path.endsWith('.php')), ['public/api/index.php']);
    for (const path of files) assert.doesNotMatch(readFileSync(join(options.destination, path), 'utf8'), /DO_NOT_PUBLISH/);
    assert.ok(existsSync(join(options.destination, 'app/src/bootstrap.php')));
    assert.ok(existsSync(join(options.destination, 'public/assets/vendor/1.2.3/runtime.js')));
    assert.match(readFileSync(join(options.destination, 'public/api/index.php'), 'utf8'), /agentpy-private.*|releases\/test-release\/app\/public\/api\/index.php/);
    const context = { window: {} }; vm.runInNewContext(readFileSync(join(options.destination, 'public/assets/data/account-config.js'), 'utf8'), context);
    assert.equal(context.window.AgentAccountConfig.enabled, true);
    assert.equal(context.window.AgentAccountConfig.shell, true);
    assert.equal(context.window.AgentAccountConfig.saveMode, 'attempts');
    assert.match(readFileSync(join(options.source, 'assets/data/account-config.js'), 'utf8'), /enabled: false/);
});

test('release pins local script versions and hashes every shipped file', () => {
    const options = fixture(); buildHostingerRelease({ ...options, saveMode: 'completion-only' });
    const html = readFileSync(join(options.destination, 'public/index.html'), 'utf8');
    assert.match(html, /assets\/app.js\?v=old&amp;release=test-release/);
    assert.match(html, /assets\/style.css\?release=test-release/);
    assert.match(html, /src="https:\/\/cdn.example.test\/app.js"/);
    const manifest = JSON.parse(readFileSync(join(options.destination, 'manifest.json'), 'utf8'));
    assert.equal(manifest.saveMode, 'completion-only');
    assert.equal(Object.keys(manifest.files).length, releaseFiles(options.destination).length - 1);
    for (const [path, record] of Object.entries(manifest.files)) {
        const bytes = readFileSync(join(options.destination, path));
        assert.equal(record.bytes, bytes.length); assert.equal(record.sha256, createHash('sha256').update(bytes).digest('hex'));
    }
    assert.match(readFileSync(join(options.destination, 'public/.htaccess'), 'utf8'), /no-cache, must-revalidate/);
});

test('release rejects unsafe identifiers, invalid save modes, nonempty outputs and linked assets', () => {
    for (const releaseId of ['../escape', "x';bad", 'bad/id', 'a'.repeat(65), ''])
        assert.throws(() => buildHostingerRelease({ ...fixture(), releaseId }), /Invalid release ID/);
    assert.throws(() => buildHostingerRelease({ ...fixture(), saveMode: 'every-keypress' }), /Invalid save mode/);
    const options = fixture(); buildHostingerRelease(options);
    assert.throws(() => buildHostingerRelease(options), /empty/);
    const linked = fixture(); const target = join(linked.root, 'outside'); mkdirSync(target);
    writeFileSync(join(target, 'secret.js'), 'DO_NOT_PUBLISH');
    symlinkSync(target, join(linked.source, 'assets', 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => buildHostingerRelease(linked), /Symbolic links/);
});
