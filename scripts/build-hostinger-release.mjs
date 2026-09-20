import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStaticSite } from './build-static-site.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const privateFiles = ['src/bootstrap.php', 'src/auth.php', 'src/storage.php', 'src/account-management.php', 'src/registration.php', 'src/mail.php', 'public/api/index.php', 'bin/manage.php', 'bin/mail-worker.php', 'schema.sql', 'registration-schema.sql'];

export function releaseFiles(root, prefix = '') {
    return readdirSync(join(root, prefix), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isSymbolicLink()) throw new Error('Symbolic links are not allowed in releases.');
        return entry.isDirectory() ? releaseFiles(root, path) : [path];
    });
}

export function buildHostingerRelease({ source = repoRoot, destination, releaseId, commit = null, saveMode = 'attempts', shell = true }) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(releaseId || '')) throw new Error('Invalid release ID.');
    if (!['attempts', 'completion-only'].includes(saveMode)) throw new Error('Invalid save mode.');
    if (!destination) throw new Error('An explicit output directory is required.');
    const output = resolve(destination);
    if (existsSync(output) && (lstatSync(output).isSymbolicLink() || readdirSync(output).length)) throw new Error('Output must be an empty non-symlink directory.');
    mkdirSync(output, { recursive: true });
    const publicRoot = buildStaticSite({ source, destination: join(output, 'public'), commit });
    if (!existsSync(join(publicRoot, 'index.html'))) throw new Error('Missing public index.html.');
    for (const file of privateFiles) {
        const original = join(source, 'server', file);
        if (!lstatSync(original).isFile() || lstatSync(original).isSymbolicLink()) throw new Error('Private release sources must be regular files.');
        mkdirSync(dirname(join(output, 'app', file)), { recursive: true });
        cpSync(original, join(output, 'app', file));
    }
    writeFileSync(join(publicRoot, 'assets/data/account-config.js'),
        `// Generated pilot release; the repository's guest configuration is unchanged.\nwindow.AgentAccountConfig = Object.freeze(window.AgentAccountConfig || ${JSON.stringify({ enabled: true, endpoint: 'api/index.php', saveMode, shell })});\n`);
    // Tag every local script/stylesheet, including existing v= URLs. External URLs stay unchanged.
    for (const file of readdirSync(publicRoot).filter(name => name.endsWith('.html'))) {
        const path = join(publicRoot, file);
        writeFileSync(path, readFileSync(path, 'utf8').replace(/\b(src|href)=(['"])([^'"<>]+)\2/g, (full, attr, quote, value) => {
            if (/^(?:[a-z]+:|\/\/|#)/i.test(value) || !/\.(?:js|css)(?:[?#]|$)/i.test(value)) return full;
            const url = new URL(value.replaceAll('&amp;', '&'), 'https://release.invalid/');
            url.searchParams.set('release', releaseId);
            const originalPath = value.split(/[?#]/)[0];
            return `${attr}=${quote}${originalPath}${url.search.replaceAll('&', '&amp;')}${url.hash}${quote}`;
        }));
    }
    mkdirSync(join(publicRoot, 'api'));
    writeFileSync(join(publicRoot, 'api/index.php'), `<?php
declare(strict_types=1);
ini_set('display_errors', '0');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
try {
    // public_html/api -> domain directory. No secrets or application source in webroot.
    $private = dirname(__DIR__, 2) . '/agentpy-private';
    putenv('AGENTPY_CONFIG=' . $private . '/config.php');
    require $private . '/releases/${releaseId}/app/public/api/index.php';
} catch (Throwable $error) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo '{"error":{"code":"SERVER_UNAVAILABLE"}}';
}
`);
    writeFileSync(join(publicRoot, '.htaccess'), `Options -Indexes
DirectoryIndex index.html
<FilesMatch "^\\.">
    Require all denied
</FilesMatch>
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options "nosniff"
    <FilesMatch "\\.(html|js|css|json)$">
        Header set Cache-Control "no-cache, must-revalidate"
    </FilesMatch>
</IfModule>
`);
    writeFileSync(join(publicRoot, 'release.json'), JSON.stringify({ releaseId, commit }) + '\n');
    const files = Object.fromEntries(releaseFiles(output).map(path => {
        const bytes = readFileSync(join(output, path));
        return [path, { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }];
    }));
    writeFileSync(join(output, 'manifest.json'), JSON.stringify({ format: 1, releaseId, commit, saveMode, files }, null, 2) + '\n');
    return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [, , destination, releaseId] = process.argv;
    console.log(buildHostingerRelease({ destination, releaseId, commit: process.env.GITHUB_SHA || null, saveMode: process.env.AGENTPY_SAVE_MODE || 'attempts' }));
}
