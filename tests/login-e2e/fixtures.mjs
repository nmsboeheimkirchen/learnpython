import { expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Only disposable localhost fixtures; no production transport or user accounts.
export function fixture(action, input = {}) {
    const state = JSON.parse(readFileSync('.cache/login-browser-fixture.json','utf8'));
    const portable = resolve('.cache/php-runtime/php-8.5.10/php.exe');
    const php = process.env.PHP_BINARY || (existsSync(portable) ? portable : 'php');
    const args = php === portable ? ['-n','-d',`extension_dir=${dirname(php)}/ext`,'-d','extension=pdo_sqlite'] : [];
    const result = spawnSync(php,[...args,'tests/backend-fixture.php',action],{
        encoding:'utf8',windowsHide:true,input:JSON.stringify(input),env:{...process.env,
            AGENTPY_CONFIG:'',AGENTPY_ENVIRONMENT:'development',AGENTPY_ORIGIN:'http://127.0.0.1:4174',
            AGENTPY_DSN:state.dsn,AGENTPY_DB_USER:'',AGENTPY_DB_PASSWORD:'',AGENTPY_SESSION_PATH:state.sessions,
            AGENTPY_REGISTRATION_ENABLED:'true',AGENTPY_PASSWORD_RESET_ENABLED:'true',AGENTPY_MAIL_TRANSPORT:'test',AGENTPY_MAIL_FROM:'noreply@example.test'}
    });
    expect(result.status,result.stderr).toBe(0);return JSON.parse(result.stdout || '{}');
}
