import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
test('README ends with the account rules reference and keeps details out of the overview',()=>{
    const readme=readFileSync(resolve(root,'README.md'),'utf8').trim();
    assert.match(readme.split('\n').at(-1),/\]\(ACCOUNT-SYSTEM\.md\)$/);
    assert.match(readme,/Lehrer:innen-Backend/);
    assert.doesNotMatch(readme,/Zwischen verschiedenen Geräten oder Browsern findet keine Synchronisierung statt/);
});
test('system documentation links point to real files, including new transfer implementation and tests',()=>{
    for(const file of ['README.md','ACCOUNT-SYSTEM.md']){
        const body=readFileSync(resolve(root,file),'utf8');
        for(const match of body.matchAll(/\]\(([^)]+)\)/g)){
            const target=match[1].split('#')[0];if(!target||/^https?:/.test(target))continue;
            assert.ok(existsSync(resolve(root,target)),`${file}: missing ${target}`);
        }
    }
    const rules=readFileSync(resolve(root,'ACCOUNT-SYSTEM.md'),'utf8');
    for(const path of ['server/src/transfers.php','tests/transfer-cases.mjs','tests/login-e2e/transfers.spec.mjs'])assert.ok(rules.includes(`](${path})`),`Document ${path}`);
    assert.match(rules,/kein Nachweis einer Veröffentlichung/);
    assert.match(rules,/Konto-ID ist die Identität/);
});
