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
        $q = $db->prepare("SELECT j.*, p.email, p.expires_at FROM mail_jobs j JOIN pending_registrations p ON p.id=j.registration_id JOIN class_invitations i ON i.code_hash=p.invitation_hash WHERE j.available_at<=? AND (j.state='queued' OR (j.state='sending' AND j.lease_until<=?)) AND p.expires_at>? AND i.active=1 AND i.expires_at>? ORDER BY j.created_at,j.id LIMIT 1");
        $q->execute([$now, $now, $now + 3600, $now]);
        $job = $q->fetch();
        if (!$job) { $db->commit(); return null; }
        $job['lease_id'] = bin2hex(random_bytes(16));
        $db->prepare("UPDATE mail_jobs SET state='sending',lease_until=?,lease_id=?,attempts=attempts+1 WHERE id=?")
            ->execute([$now + 300, $job['lease_id'], $job['id']]);
        // Persist quota use BEFORE contacting the mail transport: crashes still count.
        $db->prepare('INSERT INTO mail_attempts (id,attempted_at) VALUES (?,?)')->execute([bin2hex(random_bytes(16)), $now]);
        $db->prepare('UPDATE pending_registrations SET token_expires_at=? WHERE id=?')
            ->execute([min($now + 86400, (int) $job['expires_at']), $job['registration_id']]);
        $db->commit();
        return $job;
    } catch (\Throwable $error) { if ($db->inTransaction()) $db->rollBack(); throw $error; }
}

function dispatchMail(\PDO $db, array $config, ?callable $testSender = null, ?int $testNow = null): bool
{
    if (!$config['registration_enabled']) return false;
    if (($testSender || $testNow !== null) && $config['environment'] !== 'development') throw new \RuntimeException('Test transport forbidden');
    $now = $testNow ?? time();
    $job = claimMail($db, $config, $now);
    if (!$job) return false;
    // Fragment tokens never reach access logs or Referer headers. Confirmation needs POST.
    $link = $config['origin'] . '/index.html#verify=' . $job['token'];
    $body = "Willkommen bei AGENT PY!\n\nBitte bestaetige deine E-Mail-Adresse:\n$link\n\nDer Link ist 24 Stunden gueltig (hoechstens bis zum Ablauf deiner Anmeldung).\nFalls du dich nicht angemeldet hast, ignoriere diese Nachricht.\n";
    $accepted = false;
    try {
        if ($testSender) $accepted = $testSender($job['email'], $body) === true;
        elseif ($config['mail_transport'] === 'sendmail') {
            $accepted = mail($job['email'], 'AGENT PY: E-Mail bestaetigen', $body,
                ['From' => 'AGENT PY <' . $config['mail_from'] . '>', 'Content-Type' => 'text/plain; charset=UTF-8']);
        } else throw new \RuntimeException('No production mail transport');
    } catch (\Throwable) { $accepted = false; }
    // Transport acceptance is not proof of inbox delivery. A crash after acceptance can
    // cause a repeated mail, but the token is the same and can only be consumed once.
    if ($accepted) {
        $db->prepare("UPDATE mail_jobs SET state='sent',token='',lease_until=0 WHERE id=? AND lease_id=?")
            ->execute([$job['id'], $job['lease_id']]);
    } else {
        $db->prepare("UPDATE mail_jobs SET state='queued',available_at=?,lease_until=0 WHERE id=? AND lease_id=?")
            ->execute([$now + min(3600, 60 * (2 ** min(6, (int) $job['attempts']))), $job['id'], $job['lease_id']]);
    }
    return true;
}
