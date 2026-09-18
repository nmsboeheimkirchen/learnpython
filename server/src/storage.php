<?php
declare(strict_types=1);

namespace AgentPy;

function course(): array
{
    // This list is checked against the browser's LEVEL_OUTCOMES in the backend tests.
    return [
        'mission1_level1' => ['link-level2'],
        'mission1_level2' => ['link-level3'],
        'mission1_level3' => ['link-m2-title', 'link-m2-l1'],
        'mission1_level4' => ['link-m2-title', 'link-m2-l1'],
        'mission2_level1' => ['link-m2-l2'],
        'mission2_level2' => ['link-m2-l3', 'link-m3-title', 'link-m3-l1'],
        'mission2_level3' => ['link-m3-title', 'link-m3-l1'],
        'mission3_level1' => ['link-m3-l2'],
        'mission3_level2' => ['link-m3-l3'],
        'mission3_level3' => ['link-m4-title', 'link-m4-l1'],
        'mission4_level1' => ['link-m4-l2'],
        'mission4_level2' => ['link-m4-l3'],
        'mission4_level3' => ['link-agent-training-title', 'link-agent-training-l1'],
        'agent_training_level1' => ['link-agent-training-l2'],
        'agent_training_level2' => ['link-agent-training-l3'],
        'agent_training_level3' => ['link-project-choice', 'link-pico-title', 'link-pico-l1', 'link-museum-title', 'link-museum-briefing'],
        'pico_level1_navigation' => ['link-pico-l2'],
        'pico_level2' => ['link-pico-l2a', 'link-pico-l3'],
        'pico_level2a' => ['link-pico-l3'],
        'pico_level3' => ['link-pico-l4'],
        'pico_level4_memory' => ['link-helicopter-escape', 'link-helicopter-level1'],
        'pixelmuseum_briefing' => ['link-museum-finale'],
        'pixelmuseum_finale' => ['link-helicopter-escape', 'link-helicopter-level1'],
        'helikopter_flucht_level1' => ['link-helicopter-level2'],
        'helikopter_flucht_level2' => [],
    ];
}

function emptyState(): array
{
    return [
        'attemptedCodes' => new \stdClass(), 'completedCodes' => new \stdClass(),
        'unlockedIds' => ['link-level1'], 'featureProgress' => new \stdClass(),
    ];
}

function readState(\PDO $db, string $userId, bool $lock = false): array
{
    $sql = 'SELECT revision, document FROM learning_states WHERE user_id = ?';
    if ($lock && $db->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'mysql') $sql .= ' FOR UPDATE';
    $query = $db->prepare($sql);
    $query->execute([$userId]);
    $row = $query->fetch();
    // A missing/broken state must never look like a fresh empty account.
    if (!$row) throw new \RuntimeException('Missing learning state');
    $document = json_decode($row['document'], false, 30, JSON_THROW_ON_ERROR);
    if (!$document instanceof \stdClass || !($document->attemptedCodes ?? null) instanceof \stdClass
        || !($document->completedCodes ?? null) instanceof \stdClass
        || !($document->featureProgress ?? null) instanceof \stdClass
        || !is_array($document->unlockedIds ?? null)) throw new \RuntimeException('Invalid learning state');
    return ['revision' => (int) $row['revision'], 'data' => $document];
}

function writeState(\PDO $db, string $userId, array $body): array
{
    exactFields($body, ['operationId', 'expectedRevision', 'command']);
    if (!is_string($body['operationId']) || !preg_match('/^[a-zA-Z0-9_-]{16,64}$/D', $body['operationId'])
        || !is_int($body['expectedRevision']) || $body['expectedRevision'] < 0
        || !$body['command'] instanceof \stdClass) throw new ApiError(422, 'INVALID_COMMAND');
    $command = (array) $body['command'];
    $hash = hash('sha256', json_encode($body, JSON_THROW_ON_ERROR));
    $db->beginTransaction();
    try {
        if ($db->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'sqlite') {
            // SQLite has no FOR UPDATE: acquire its write lock before reading the revision.
            $db->prepare('UPDATE learning_states SET revision = revision WHERE user_id = ?')->execute([$userId]);
        }
        $state = readState($db, $userId, true);
        $receipt = $db->prepare('SELECT request_hash FROM write_receipts WHERE user_id = ? AND operation_id = ?');
        $receipt->execute([$userId, $body['operationId']]);
        $previousHash = $receipt->fetchColumn();
        if ($previousHash !== false) {
            if (!hash_equals($previousHash, $hash)) throw new ApiError(409, 'OPERATION_ID_REUSED');
            $db->commit();
            return ['state' => $state, 'replayed' => true];
        }
        if ($state['revision'] !== $body['expectedRevision']) throw new ApiError(409, 'REVISION_CONFLICT');
        $data = $state['data'];
        $type = $command['type'] ?? null;
        if ($type === 'attempt' || $type === 'complete') {
            exactFields($command, ['type', 'levelId', 'code']);
            if (!is_string($command['levelId']) || !array_key_exists($command['levelId'], course())
                || !is_string($command['code']) || strlen($command['code']) > 32768)
                throw new ApiError(422, 'INVALID_LEVEL_CODE');
            $id = $command['levelId'];
            if ($type === 'attempt') $data->attemptedCodes->$id = $command['code'];
            if ($type === 'complete') {
                $data->completedCodes->$id = $command['code'];
                $data->attemptedCodes->$id = $command['code'];
                $data->unlockedIds = array_values(array_unique(array_merge($data->unlockedIds, course()[$id])));
            }
        } elseif ($type === 'unlocks') {
            exactFields($command, ['type', 'unlockIds']);
            $known = array_unique(array_merge(['link-level1'], ...array_values(course())));
            if (!is_array($command['unlockIds']) || count($command['unlockIds']) > count($known))
                throw new ApiError(422, 'INVALID_UNLOCKS');
            foreach ($command['unlockIds'] as $id) {
                if (!is_string($id) || !in_array($id, $known, true)) throw new ApiError(422, 'INVALID_UNLOCKS');
            }
            // Explicit skip links remain a learning aid, not an assessed completion.
            $data->unlockedIds = array_values(array_unique(array_merge($data->unlockedIds, $command['unlockIds'])));
        } elseif ($type === 'feature') {
            exactFields($command, ['type', 'featureId', 'value']);
            if ($command['featureId'] !== 'pixelmuseum' || !$command['value'] instanceof \stdClass)
                throw new ApiError(422, 'INVALID_FEATURE');
            $value = (array) $command['value'];
            exactFields($value, ['version', 'count', 'levels']);
            if ($value['version'] !== 1 || !$value['levels'] instanceof \stdClass)
                throw new ApiError(422, 'INVALID_FEATURE');
            $knownIssues = ['SEARCH_NEEDS_DRONE', 'FUND_NOT_STORED', 'INVENTORY_PARAMETER', 'PYTHON_ERROR',
                'KEYCARD_ORDER', 'KEYCARD_MISSING', 'ARTIFACT_MISSING', 'HACK_TOO_EARLY', 'HACK_WRONG_PLACE',
                'HACK_WRONG_CODE', 'HACK_TOO_LATE', 'PORTAL_LOCKED', 'ALARM_TOO_SLOW', 'ALARM_STRATEGY',
                'PORTAL_NOT_REACHED', 'INVENTORY_OUTPUT'];
            $count = 0;
            foreach ($value['levels'] as $issue => $level) {
                if (!in_array($issue, $knownIssues, true) || !is_int($level) || $level < 1 || $level > 3)
                    throw new ApiError(422, 'INVALID_FEATURE');
                $count += $level;
            }
            if ($value['count'] !== $count) throw new ApiError(422, 'INVALID_FEATURE');
            $data->featureProgress->pixelmuseum = (object) $value;
        } elseif ($type === 'reset') {
            exactFields($command, ['type']);
            $data = (object) emptyState();
        } else {
            throw new ApiError(422, 'UNKNOWN_COMMAND');
        }
        $document = json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        if (strlen($document) > 2 * 1024 * 1024) throw new ApiError(413, 'STATE_TOO_LARGE');
        $revision = $state['revision'] + 1;
        $update = $db->prepare('UPDATE learning_states SET document = ?, revision = ?, updated_at = ? WHERE user_id = ? AND revision = ?');
        $update->execute([$document, $revision, time(), $userId, $state['revision']]);
        if ($update->rowCount() !== 1) throw new ApiError(409, 'REVISION_CONFLICT');
        $db->prepare('INSERT INTO write_receipts (user_id, operation_id, request_hash, revision, created_at) VALUES (?, ?, ?, ?, ?)')
            ->execute([$userId, $body['operationId'], $hash, $revision, time()]);
        $db->commit();
        return ['state' => ['revision' => $revision, 'data' => $data], 'replayed' => false];
    } catch (\Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    }
}
