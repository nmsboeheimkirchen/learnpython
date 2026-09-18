import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicAssetTypes = new Set(['.js', '.css', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.mp3', '.wav']);

export function buildStaticSite({ source = repoRoot, destination, commit = null }) {
    if (!destination) throw new Error('An explicit output directory is required.');
    const output = resolve(destination);
    if (existsSync(output) && readdirSync(output).length) throw new Error('Output directory must be empty.');
    if (commit !== null && !/^[a-f0-9]{40}$/i.test(commit)) throw new Error('Invalid commit marker.');
    mkdirSync(output, { recursive: true });
    for (const entry of readdirSync(source, { withFileTypes: true })) {
        if (entry.isFile() && (entry.name.endsWith('.html') || ['LICENSE', 'robots.txt', 'sitemap.xml'].includes(entry.name))) {
            cpSync(join(source, entry.name), join(output, entry.name));
        }
    }
    cpSync(join(source, 'assets'), join(output, 'assets'), {
        recursive: true,
        filter: (path) => {
            if (lstatSync(path).isSymbolicLink()) throw new Error('Symbolic links are not allowed in public assets.');
            if (basename(path).startsWith('.')) return false;
            if (lstatSync(path).isDirectory()) return true;
            const extension = extname(path).toLowerCase();
            return ['LICENSE', 'SHA256SUMS'].includes(basename(path)) || publicAssetTypes.has(extension);
        },
    });
    // The productive museum finale still uses these shared prototype runtime files.
    for (const name of ['finale.js', 'finale.css']) {
        if (existsSync(join(source, 'prototypes', name))) {
            mkdirSync(join(output, 'prototypes'), { recursive: true });
            cpSync(join(source, 'prototypes', name), join(output, 'prototypes', name));
        }
    }
    writeFileSync(join(output, '.nojekyll'), '');
    if (commit) {
        mkdirSync(join(output, 'deploy-meta'));
        writeFileSync(join(output, 'deploy-meta', `${commit}.txt`), `${commit}\n`);
    }
    return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const output = buildStaticSite({
        destination: process.argv[2] || join(repoRoot, '.cache/site-pages'),
        commit: process.env.GITHUB_SHA || null,
    });
    console.log(`Static site prepared: ${output}`);
}
