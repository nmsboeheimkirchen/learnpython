// Operator-only transport preflight. No passwords, tokens or configuration are printed.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

const action = process.argv[2];
if (!['inspect', 'send-test', 'install-worker', 'worker-status', 'run-worker'].includes(action)) throw new Error('Use inspect, send-test, install-worker, worker-status or run-worker');
let input = {};
if (action === 'install-worker') input.source = readFileSync(new URL('../server/bin/mail-worker.php', import.meta.url), 'utf8');
if (action === 'send-test') {
    let text = ''; for await (const chunk of process.stdin) text += chunk;
    input = JSON.parse(text);
    if (!/^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+$/.test(input.to || '') || input.from !== 'noreply@agentpy.bildungdigital.at') throw new Error('Explicit recipient and approved sender required');
}
const keyDir=join(process.env.USERPROFILE || process.env.HOME,'.ssh');
const args=['-F',process.platform==='win32'?'NUL':'/dev/null','-T','-p','65002','-i',join(keyDir,'agentpy_hostinger'),
    '-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','IdentityAgent=none','-o','ForwardAgent=no','-o','ClearAllForwardings=yes',
    '-o','StrictHostKeyChecking=yes','-o','HostKeyAlgorithms=ssh-ed25519','-o','UpdateHostKeys=no',
    '-o',`UserKnownHostsFile=${join(keyDir,'agentpy_hostinger_known_hosts')}`,'-o','ConnectTimeout=15','u535472856@195.35.49.40'];
const source = `
ini_set('display_errors','0');
$input=json_decode(base64_decode('${Buffer.from(JSON.stringify(input)).toString('base64')}'),true,10,JSON_THROW_ON_ERROR);
$root='/home/u535472856/domains/agentpy.bildungdigital.at';
if(realpath($root)!==$root) throw new RuntimeException('Unexpected target');
if('${action}'==='inspect') {
    $release=json_decode(file_get_contents($root.'/public_html/release.json'),true,10,JSON_THROW_ON_ERROR);
    echo json_encode(['release'=>$release,'php'=>PHP_VERSION,'mailAvailable'=>function_exists('mail'),'sendmailConfigured'=>(bool)ini_get('sendmail_path'),'cronAvailable'=>trim((string)shell_exec('command -v crontab'))!=='']);
} elseif ('${action}'==='install-worker') {
    $tools=$root.'/agentpy-private/tools';
    if(realpath($tools)!==$tools)throw new RuntimeException('Unexpected tools path');
    $path=$tools.'/mail-worker.php';
    if(is_link($path))throw new RuntimeException('Linked worker');
    if(file_exists($path)) {
        if(!hash_equals(hash('sha256',$input['source']),hash_file('sha256',$path)))throw new RuntimeException('Existing worker differs; inspect before replacing');
    } else {
        umask(0077);$file=fopen($path,'xb');
        if(!$file||fwrite($file,$input['source'])!==strlen($input['source']))throw new RuntimeException('Worker install failed');
        fclose($file);chmod($path,0600);
    }
    echo json_encode(['installed'=>true,'sha256'=>hash_file('sha256',$path)]);
} elseif ('${action}'==='run-worker') {
    require $root.'/agentpy-private/tools/mail-worker.php';
} elseif ('${action}'==='worker-status') {
    $path=$root.'/agentpy-private/mail-worker-status.json';
    if(!is_file($path)){echo json_encode(['hasRun'=>false]);}
    else {
        $status=json_decode(file_get_contents($path),true,10,JSON_THROW_ON_ERROR);
        echo json_encode(['hasRun'=>true,'releaseId'=>$status['releaseId'],'ranAt'=>$status['ranAt'],'processed'=>$status['processed']]);
    }
} else {
    if(!filter_var($input['to'],FILTER_VALIDATE_EMAIL)||$input['from']!=='noreply@agentpy.bildungdigital.at')throw new RuntimeException('Invalid mail');
    $accepted=mail($input['to'],'AGENT PY: Versandtest Phase 1',"Hallo Michael,\n\ndies ist die vereinbarte Testmail fuer die Neuanmeldung bei AGENT PY.\nSie prueft nur den Mailversand; dein Konto und Lernstand wurden nicht veraendert.\nBitte bestaetige den Empfang im Codex-Chat und erwaehne, ob die Nachricht im Posteingang oder Spam-Ordner angekommen ist.\n",['From'=>'AGENT PY <'.$input['from'].'>','Content-Type'=>'text/plain; charset=UTF-8']);
    echo json_encode(['acceptedByTransport'=>$accepted,'inboxDeliveryNotYetConfirmed'=>true]);
}`;
try {
    const encoded=Buffer.from(source).toString('base64');
    const result=execFileSync('ssh',[...args,`/opt/alt/php83/usr/bin/php -r 'eval(base64_decode("${encoded}"));'`],{encoding:'utf8',windowsHide:true,timeout:45000,stdio:['ignore','pipe','pipe']});
    console.log(result);
} catch { throw new Error('Hostinger mail preflight failed; no credentials printed'); }
