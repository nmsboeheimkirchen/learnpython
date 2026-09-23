<?php
declare(strict_types=1);

namespace AgentPy;

function dailyMailLimitReached(\PDO $db, array $config, int $now): bool
{
    $query = $db->prepare('SELECT COUNT(*) FROM mail_attempts WHERE attempted_at>?');
    $query->execute([$now - 86400]);
    return (int) $query->fetchColumn() >= $config['mail_per_day'];
}

// MAIL-TRANSPORT-LIMIT: change configuration, queue pacing, public notice and tests
// together when moving to SMTP. Do not remove durable jobs or abuse protection.
function claimMail(\PDO $db, array $config, int $now): ?array
{
    $db->beginTransaction();
    try {
        $db->prepare('UPDATE mail_dispatch_lock SET touched_at=? WHERE id=1')->execute([$now]);
        $db->prepare('DELETE FROM mail_attempts WHERE attempted_at<=?')->execute([$now - 86400]);
        $db->prepare('DELETE FROM pending_registrations WHERE expires_at<=?')->execute([$now]);
        $counts = $db->prepare('SELECT COUNT(*) FROM mail_attempts WHERE attempted_at>?');
        foreach ([60 => $config['mail_per_minute'], 86400 => $config['mail_per_day']] as $window => $limit) {
            $counts->execute([$now - $window]);
            if ((int) $counts->fetchColumn() >= $limit) { $db->commit(); return null; }
        }
        $q = $db->prepare("SELECT j.*, p.email, p.display_name AS name, p.expires_at FROM mail_jobs j JOIN pending_registrations p ON p.id=j.registration_id JOIN class_invitations i ON i.code_hash=p.invitation_hash WHERE j.available_at<=? AND (j.state='queued' OR (j.state='sending' AND j.lease_until<=?)) AND p.expires_at>? AND i.active=1 AND i.expires_at>p.created_at ORDER BY j.created_at,j.id LIMIT 1");
        $q->execute([$now, $now, $now + 3600]);
        $job = $config['registration_enabled'] ? $q->fetch() : false;
        if ($job) { $job['mail_table']='mail_jobs'; $job['kind']='verify'; }
        if ($config['password_reset_enabled'] ?? false) {
            $db->prepare('DELETE FROM password_resets WHERE expires_at<=? OR (token_expires_at>0 AND token_expires_at<=?)')->execute([$now,$now]);
            $db->prepare('DELETE FROM recovery_mail_jobs WHERE expires_at<=?')->execute([$now]);
            $q=$db->prepare("SELECT j.*,u.email,u.display_name AS name FROM recovery_mail_jobs j JOIN users u ON u.id=j.user_id LEFT JOIN password_resets r ON r.id=j.reset_id WHERE u.active=1 AND j.available_at<=? AND j.expires_at>? AND (j.state='queued' OR (j.state='sending' AND j.lease_until<=?)) AND (j.kind='reset-notice' OR (r.expires_at>? AND (r.token_expires_at=0 OR r.token_expires_at>?))) ORDER BY j.created_at,j.id LIMIT 1");
            $q->execute([$now,$now,$now,$now,$now]); $recovery=$q->fetch();
            // Both types share the same lock, FIFO selection, minute/day budget and retry rules.
            if ($recovery && (!$job || [$recovery['created_at'],$recovery['id']] < [$job['created_at'],$job['id']])) {
                $job=$recovery; $job['mail_table']='recovery_mail_jobs';
            }
        }
        if (!$job) { $db->commit(); return null; }
        $job['lease_id'] = bin2hex(random_bytes(16));
        $db->prepare("UPDATE " . $job['mail_table'] . " SET state='sending',lease_until=?,lease_id=?,attempts=attempts+1 WHERE id=?")
            ->execute([$now + 300, $job['lease_id'], $job['id']]);
        // Persist quota use BEFORE contacting the mail transport: crashes still count.
        $db->prepare('INSERT INTO mail_attempts (id,attempted_at) VALUES (?,?)')->execute([bin2hex(random_bytes(16)), $now]);
        if ($job['kind']==='verify') {
            $db->prepare('UPDATE pending_registrations SET token_expires_at=? WHERE id=?')
                ->execute([min($now + 86400, (int) $job['expires_at']), $job['registration_id']]);
        } elseif ($job['kind']==='reset') {
            // One hour from the FIRST delivery attempt. Retries never extend validity.
            $db->prepare('UPDATE password_resets SET token_expires_at=? WHERE id=? AND token_expires_at=0')
                ->execute([min($now+3600,(int)$job['expires_at']),$job['reset_id']]);
        }
        $db->commit();
        return $job;
    } catch (\Throwable $error) { if ($db->inTransaction()) $db->rollBack(); throw $error; }
}

function dispatchMail(\PDO $db, array $config, ?callable $testSender = null, ?int $testNow = null): bool
{
    if (!$config['registration_enabled'] && !($config['password_reset_enabled'] ?? false)) return false;
    if (($testSender || $testNow !== null) && $config['environment'] !== 'development') throw new \RuntimeException('Test transport forbidden');
    $now = $testNow ?? time();
    $job = claimMail($db, $config, $now);
    if (!$job) return false;
    // Fragment tokens never reach access logs or Referer headers. Confirmation needs POST.
    $link = $config['origin'] . '/index.html#verify=' . $job['token'];
    $body = "Willkommen bei AGENT PY!\n\nBitte bestaetige deine E-Mail-Adresse:\n$link\n\nDer Link ist 24 Stunden gueltig (hoechstens bis zum Ablauf deiner Anmeldung).\nFalls du dich nicht angemeldet hast, ignoriere diese Nachricht.\n";
    $subject='AGENT PY: E-Mail bestaetigen';
    if ($job['kind']==='reset') {
        $link=$config['origin'].'/index.html#reset='.$job['token'];
        $subject='AGENT PY: Passwort zuruecksetzen';
        $body="Hier kannst du ein neues Passwort fuer dein AGENT-PY-Konto festlegen:\n$link\n\nDer Link gilt eine Stunde ab dem ersten Versandversuch und nur einmal. Wenn du kein neues Passwort angefordert hast, ignoriere diese Nachricht. Dein Passwort bleibt dann unveraendert.\n";
    } elseif ($job['kind']==='reset-notice') {
        $subject='AGENT PY: Passwort wurde geaendert';
        $body="Das Passwort fuer dein AGENT-PY-Konto wurde soeben zurueckgesetzt. Alte Sitzungen wurden beendet; dein Lernstand bleibt erhalten.\n\nFalls du das nicht selbst warst, fordere auf ".$config['origin']." ein neues Passwort an und informiere deine Lehrperson.\n";
    }
    $body = "Hallo " . preg_replace('/\\s+/u', ' ', trim($job['name'])) . "!\n\n" . $body;
    $accepted = false;
    try {
        if ($testSender) $accepted = $testSender($job['email'], $body) === true;
        elseif ($config['mail_transport'] === 'smtp') $accepted = smtpMessage($config,$job['email'],$subject,$body)->send();
        elseif ($config['mail_transport'] === 'sendmail') {
            $accepted = mail($job['email'], $subject, $body,
                ['From' => 'AGENT PY <' . $config['mail_from'] . '>', 'Content-Type' => 'text/plain; charset=UTF-8']);
        } else throw new \RuntimeException('No production mail transport');
    } catch (\Throwable) { $accepted = false; }
    // Transport acceptance is not proof of inbox delivery. A crash after acceptance can
    // cause a repeated mail, but the token is the same and can only be consumed once.
    if ($accepted) {
        $db->prepare("UPDATE " . $job['mail_table'] . " SET state='sent',token='',lease_until=0 WHERE id=? AND lease_id=?")
            ->execute([$job['id'], $job['lease_id']]);
    } else {
        $db->prepare("UPDATE " . $job['mail_table'] . " SET state='queued',available_at=?,lease_until=0 WHERE id=? AND lease_id=?")
            ->execute([$now + min(3600, 60 * (2 ** min(6, (int) $job['attempts']))), $job['id'], $job['lease_id']]);
    }
    return true;
}
