<?php
declare(strict_types=1);

namespace AgentPy;

function smtpMessage(array $config, string $to, string $subject, string $body): \PHPMailer\PHPMailer\PHPMailer
{
    require_once dirname(__DIR__).'/vendor/phpmailer/Exception.php';
    require_once dirname(__DIR__).'/vendor/phpmailer/PHPMailer.php';
    require_once dirname(__DIR__).'/vendor/phpmailer/SMTP.php';
    $path=$config['smtp_password_file'];
    if (!$path || is_link($path) || !is_file($path) || filesize($path)>4096)
        throw new \RuntimeException('SMTP credential unavailable');
    $password=rtrim((string)file_get_contents($path),"\r\n");
    if ($password==='' || $password==='REPLACE_WITH_MAILBOX_PASSWORD' || str_contains($password,"\0"))
        throw new \RuntimeException('SMTP credential unavailable');
    $mail=new \PHPMailer\PHPMailer\PHPMailer(true);
    $mail->isSMTP();
    $mail->Host=$config['smtp_host']; $mail->Port=$config['smtp_port'];
    $mail->SMTPSecure=$config['smtp_encryption'];
    $mail->SMTPAuth=true; $mail->Username=$config['smtp_user']; $mail->Password=$password;
    $mail->SMTPDebug=0; $mail->Timeout=15;
    $mail->getSMTPInstance()->Timelimit=20;
    // Never turn off TLS/certificate validation, including during preflight.
    $mail->SMTPOptions=['ssl'=>['verify_peer'=>true,'verify_peer_name'=>true,'allow_self_signed'=>false]];
    $mail->CharSet='UTF-8'; $mail->Encoding='quoted-printable'; $mail->XMailer='';
    $mail->setFrom($config['mail_from'],'AGENT PY');
    $mail->Sender=$config['mail_from'];
    $mail->addAddress($to); $mail->Subject=$subject; $mail->Body=$body;
    return $mail;
}
