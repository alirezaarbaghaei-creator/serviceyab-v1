<?php
/**
 * سرویس‌یاب (ServiceYab) JSON API — single-entry PHP backend (Phase 1)
 *
 * Upload this entire `php-api/` folder to your hosting (e.g. inside public_html/api/).
 * The frontend talks to this file via POST with a JSON body: { "action": "...", ...params }
 *
 * On first run it automatically creates all required MySQL tables.
 *
 * Actions:
 *  Auth:   otp_send, otp_verify, password_login, me, set_password, update_account, signout
 *  Profile: profile_get, profile_save
 *  Exam:   exam_status, exam_start, exam_state, exam_save_progress, exam_submit, exam_result
 *  Admin:  admin_stats, admin_applicants_list, admin_applicant_get, admin_applicant_set_status,
 *          admin_applicants_export, admin_questions_list/create/update/delete/toggle,
 *          admin_exam_get, admin_exam_save, admin_settings_get, admin_settings_update,
 *          admin_user_create, admin_user_update, admin_user_delete
 */

error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', '0');
set_time_limit(120);
ini_set('max_execution_time', '120');

// ─── CORS ─────────────────────────────────────────────────────
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Client-Info');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ─── Config ───────────────────────────────────────────────────
$config = require __DIR__ . '/config.php';

// ─── Database ─────────────────────────────────────────────────
function db(): PDO {
    global $config;
    static $pdo = null;
    if ($pdo !== null) return $pdo;
    $dsn = "mysql:host={$config['db_host']};dbname={$config['db_name']};charset={$config['db_charset']}";
    try {
        $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        json_error('خطا در اتصال به دیتابیس', 500);
    }
    return $pdo;
}

// ─── Helpers ──────────────────────────────────────────────────
function json_out($data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $msg, int $status = 400): void {
    json_out(['error' => $msg], $status);
}

function body(): array {
    static $b = null;
    if ($b === null) {
        $raw = file_get_contents('php://input');
        $b = json_decode($raw, true) ?? [];
    }
    return $b;
}

function action(): string {
    $a = body()['action'] ?? '';
    if ($a) return $a;
    return $_GET['action'] ?? '';
}

function gen_uuid(): string {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function gen_token(): string {
    return bin2hex(random_bytes(32));
}

function gen_otp(): string {
    return str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

function hash_password(string $pw): string {
    return hash('sha256', $pw);
}

function get_auth_token(): ?string {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $h, $m)) return trim($m[1]);
    return null;
}

function now_iso(): string {
    return date('Y-m-d H:i:s');
}

// ─── Table Auto-Creation ──────────────────────────────────────
function init_tables(): void {
    $pdo = db();
    $ddl = [
        "CREATE TABLE IF NOT EXISTS sy_users (
            id CHAR(36) PRIMARY KEY,
            phone VARCHAR(20) UNIQUE NOT NULL,
            full_name TEXT DEFAULT '',
            password_hash TEXT NULL,
            is_admin TINYINT(1) DEFAULT 0,
            status VARCHAR(20) DEFAULT 'new',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS sy_otp_codes (
            id CHAR(36) PRIMARY KEY,
            phone VARCHAR(20) NOT NULL,
            code VARCHAR(6) NOT NULL,
            expires_at DATETIME NOT NULL,
            used TINYINT(1) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_otp_phone (phone)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS sy_sessions (
            token VARCHAR(64) PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            phone VARCHAR(20) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            INDEX idx_sessions_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS sy_settings (
            id INT PRIMARY KEY DEFAULT 1,
            sms_api_key TEXT DEFAULT '',
            sms_pattern_code TEXT DEFAULT '',
            sms_line_number TEXT DEFAULT '',
            exam_instructions TEXT DEFAULT '',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT single_row CHECK (id = 1)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS sy_profiles (
            id CHAR(36) PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            city TEXT DEFAULT '',
            contact_extra TEXT DEFAULT '',
            education_field TEXT DEFAULT '',
            education_degree TEXT DEFAULT '',
            education_center TEXT DEFAULT '',
            courses TEXT DEFAULT '',
            skill_areas TEXT DEFAULT '',
            skill_level TEXT DEFAULT '',
            experience TEXT DEFAULT '',
            tools TEXT DEFAULT '',
            description TEXT DEFAULT '',
            profile_complete TINYINT(1) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_profiles_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS sy_questions (
            id CHAR(36) PRIMARY KEY,
            text LONGTEXT NOT NULL,
            option1 TEXT DEFAULT '',
            option2 TEXT DEFAULT '',
            option3 TEXT DEFAULT '',
            option4 TEXT DEFAULT '',
            correct_option INT DEFAULT 1,
            is_active TINYINT(1) DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS sy_exams (
            id INT PRIMARY KEY DEFAULT 1,
            title TEXT DEFAULT 'آزمون تخصصی تعمیرات بردهای الکترونیکی',
            duration_minutes INT DEFAULT 30,
            question_count INT DEFAULT 20,
            pass_score_percent INT DEFAULT 60,
            max_attempts INT DEFAULT 1,
            show_result_to_user TINYINT(1) DEFAULT 1,
            require_profile_complete TINYINT(1) DEFAULT 1,
            is_active TINYINT(1) DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT single_exam_row CHECK (id = 1)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS sy_attempts (
            id CHAR(36) PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            exam_id INT DEFAULT 1,
            status VARCHAR(20) DEFAULT 'in_progress',
            question_ids LONGTEXT,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            finished_at DATETIME NULL,
            score INT DEFAULT 0,
            total INT DEFAULT 0,
            passed TINYINT(1) DEFAULT 0,
            INDEX idx_attempts_user (user_id),
            INDEX idx_attempts_exam (exam_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS sy_attempt_answers (
            id CHAR(36) PRIMARY KEY,
            attempt_id CHAR(36) NOT NULL,
            question_id CHAR(36) NOT NULL,
            selected_option INT DEFAULT 0,
            is_correct TINYINT(1) DEFAULT 0,
            answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_attempt_question (attempt_id, question_id),
            INDEX idx_answers_attempt (attempt_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    ];

    foreach ($ddl as $sql) {
        $pdo->exec($sql);
    }

    // Insert default settings row ONLY on first run (when empty)
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM sy_settings WHERE id = 1");
    $stmt->execute();
    if ((int)$stmt->fetchColumn() === 0) {
        $pdo->prepare("INSERT INTO sy_settings (id, sms_api_key, sms_pattern_code, sms_line_number, exam_instructions) VALUES (1, '', '', '', '')")
            ->execute();
    }

    // Insert default exam settings row (inactive until admin configures it)
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM sy_exams WHERE id = 1");
    $stmt->execute();
    if ((int)$stmt->fetchColumn() === 0) {
        $pdo->prepare("INSERT INTO sy_exams (id, title, duration_minutes, question_count, pass_score_percent, max_attempts, show_result_to_user, require_profile_complete, is_active)
            VALUES (1, 'آزمون تخصصی تعمیرات بردهای الکترونیکی', 30, 20, 60, 1, 1, 1, 0)")
            ->execute();
    }

    // Insert default admin user (phone: 09120000000, password: admin123)
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM sy_users WHERE phone = '09120000000'");
    $stmt->execute();
    if ((int)$stmt->fetchColumn() === 0) {
        $adminId = 'a0000000-0000-0000-0000-000000000001';
        $pdo->prepare("INSERT INTO sy_users (id, phone, full_name, is_admin, password_hash)
            VALUES (?, '09120000000', 'مدیر سیستم', 1, ?)")
            ->execute([$adminId, hash_password('admin123')]);
    } else {
        // Ensure existing admin stays admin
        $pdo->prepare("UPDATE sy_users SET is_admin = 1 WHERE phone = '09120000000'")->execute();
    }
}

// ─── Settings (cached) ────────────────────────────────────────
function get_settings(): array {
    static $cached = null;
    if ($cached !== null) return $cached;
    $stmt = db()->prepare("SELECT * FROM sy_settings WHERE id = 1");
    $stmt->execute();
    $row = $stmt->fetch();
    $cached = $row ?: [
        'sms_api_key' => '', 'sms_pattern_code' => '', 'sms_line_number' => '',
        'exam_instructions' => '',
    ];
    return $cached;
}

function get_exam(): array {
    $stmt = db()->prepare("SELECT * FROM sy_exams WHERE id = 1");
    $stmt->execute();
    return $stmt->fetch() ?: [
        'title' => 'آزمون تخصصی تعمیرات بردهای الکترونیکی',
        'duration_minutes' => 30, 'question_count' => 20, 'pass_score_percent' => 60,
        'max_attempts' => 1, 'show_result_to_user' => 1, 'require_profile_complete' => 1,
        'is_active' => 0,
    ];
}

// ─── Profile completeness (ماده ۵-۴: الزامی‌های پایه) ─────────
// Required: city (الف), education_field + education_degree (ب), skill_areas + skill_level (ج)
function compute_profile_complete(array $p): bool {
    $required = ['city', 'education_field', 'education_degree', 'skill_areas', 'skill_level'];
    foreach ($required as $f) {
        if (trim((string)($p[$f] ?? '')) === '') return false;
    }
    return true;
}

// ─── Public user shape (never leaks password hash / status of others) ──
function user_public(array $user): array {
    return [
        'id' => $user['id'],
        'phone' => $user['phone'],
        'full_name' => $user['full_name'] ?? '',
        'is_admin' => (bool)($user['is_admin'] ?? 0),
        'status' => $user['status'] ?? 'new',
        'created_at' => $user['created_at'] ?? null,
    ];
}

// ─── Session / Auth ───────────────────────────────────────────
function get_session_user(): ?array {
    $token = get_auth_token();
    if (!$token) return null;
    $stmt = db()->prepare("SELECT user_id, expires_at FROM sy_sessions WHERE token = ? LIMIT 1");
    $stmt->execute([$token]);
    $sess = $stmt->fetch();
    if (!$sess) return null;
    if (strtotime($sess['expires_at']) < time()) return null;
    $stmt = db()->prepare("SELECT * FROM sy_users WHERE id = ? LIMIT 1");
    $stmt->execute([$sess['user_id']]);
    $user = $stmt->fetch();
    if (!$user) return null;
    $user['is_admin'] = (bool)($user['is_admin'] ?? 0);
    return $user;
}

function create_session(string $userId, string $phone): string {
    $token = gen_token();
    $expires = date('Y-m-d H:i:s', time() + 30 * 86400);
    db()->prepare("INSERT INTO sy_sessions (token, user_id, phone, expires_at) VALUES (?, ?, ?, ?)")
        ->execute([$token, $userId, $phone, $expires]);
    return $token;
}

// ─── SMS ──────────────────────────────────────────────────────
function send_sms(string $phone, string $code): bool {
    $s = get_settings();
    if (!$s['sms_api_key'] || !$s['sms_pattern_code']) return false;
    $payload = json_encode([
        'code' => $s['sms_pattern_code'],
        'attributes' => ['code' => $code],
        'recipient' => $phone,
        'line_number' => $s['sms_line_number'],
        'number_format' => 'english',
    ]);
    $ch = curl_init('https://api.iranpayamak.com/ws/v1/sms/pattern');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Api-Key: ' . $s['sms_api_key'],
        ],
    ]);
    curl_exec($ch);
    $ok = curl_getinfo($ch, CURLINFO_HTTP_CODE) < 400;
    curl_close($ch);
    return $ok;
}

// ─── JSON field helpers ───────────────────────────────────────
function j_encode($v): string {
    return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function j_decode(string $v, $default = null) {
    $d = json_decode($v, true);
    return $d !== null ? $d : ($default ?? []);
}

// ─── Attempt helpers ──────────────────────────────────────────
function attempt_refresh_expiry(array $attempt): array {
    // Auto-expire attempts whose time is up (server clock is the only truth)
    if ($attempt['status'] === 'in_progress' && strtotime($attempt['expires_at']) <= time()) {
        finalize_attempt_expired($attempt);
        $attempt['status'] = 'expired';
    }
    return $attempt;
}

function finalize_attempt_expired(array $attempt): void {
    // Grade whatever was answered and close the attempt
    grade_attempt($attempt['id']);
    db()->prepare("UPDATE sy_attempts SET status = 'expired', finished_at = ? WHERE id = ?")
        ->execute([now_iso(), $attempt['id']]);
}

function grade_attempt(string $attemptId): array {
    // Grade all recorded answers against the answer key, store is_correct, return [score, total]
    $stmt = db()->prepare("SELECT id, question_id, selected_option FROM sy_attempt_answers WHERE attempt_id = ?");
    $stmt->execute([$attemptId]);
    $answers = $stmt->fetchAll();
    if (!$answers) return [0, 0];

    $qIds = array_column($answers, 'question_id');
    $ph = implode(',', array_fill(0, count($qIds), '?'));
    $stmt = db()->prepare("SELECT id, correct_option FROM sy_questions WHERE id IN ($ph)");
    $stmt->execute($qIds);
    $key = [];
    foreach ($stmt->fetchAll() as $q) $key[$q['id']] = (int)$q['correct_option'];

    $score = 0;
    foreach ($answers as $a) {
        $correct = isset($key[$a['question_id']]) && (int)$a['selected_option'] === $key[$a['question_id']] ? 1 : 0;
        if ((int)$a['is_correct'] !== $correct) {
            db()->prepare("UPDATE sy_attempt_answers SET is_correct = ? WHERE id = ?")
                ->execute([$correct, $a['id']]);
        }
        $score += $correct;
    }
    return [$score, count($answers)];
}

function get_attempt_answers(string $attemptId): array {
    $stmt = db()->prepare("SELECT question_id, selected_option FROM sy_attempt_answers WHERE attempt_id = ?");
    $stmt->execute([$attemptId]);
    $map = [];
    foreach ($stmt->fetchAll() as $a) $map[$a['question_id']] = (int)$a['selected_option'];
    return $map;
}

// Statuses the admin can set (ماده ۸-۶)
function is_valid_status(string $s): bool {
    return in_array($s, ['new', 'in_review', 'approved', 'rejected'], true);
}

// ─── Main ─────────────────────────────────────────────────────
try {
    init_tables();
    $act = action();
    $b = body();

    // ─── Ping (health check) ─────────────────────────────────
    if ($act === 'ping') {
        json_out(['success' => true, 'message' => 'pong']);
    }

    // ─── OTP: Send ────────────────────────────────────────────
    if ($act === 'otp_send') {
        $phone = (string)($b['phone'] ?? '');
        if (!preg_match('/^09\d{9}$/', $phone)) json_error('شماره موبایل نامعتبر', 400);
        $stmt = db()->prepare("SELECT COUNT(*) FROM sy_otp_codes WHERE phone = ? AND created_at > ?");
        $stmt->execute([$phone, date('Y-m-d H:i:s', time() - 600)]);
        if ((int)$stmt->fetchColumn() >= 5) json_error('تعداد درخواست زیاد است. کمی صبر کنید.', 429);
        $stmt = db()->prepare("SELECT id FROM sy_users WHERE phone = ? LIMIT 1");
        $stmt->execute([$phone]);
        $isExisting = (bool)$stmt->fetch();
        $code = gen_otp();
        $expires = date('Y-m-d H:i:s', time() + 120);
        db()->prepare("INSERT INTO sy_otp_codes (id, phone, code, expires_at, used) VALUES (?, ?, ?, ?, 0)")
            ->execute([gen_uuid(), $phone, $code, $expires]);
        $smsSent = send_sms($phone, $code);
        json_out(['success' => true, 'message' => 'کد تایید ارسال شد', 'sms_sent' => $smsSent, 'is_existing_user' => $isExisting, 'code' => $smsSent ? null : $code]);
    }

    // ─── OTP: Verify ──────────────────────────────────────────
    if ($act === 'otp_verify') {
        $phone = (string)($b['phone'] ?? '');
        $code = (string)($b['code'] ?? '');
        $fullName = (string)($b['full_name'] ?? '');
        $password = (string)($b['password'] ?? '');
        if (!preg_match('/^09\d{9}$/', $phone)) json_error('شماره موبایل نامعتبر', 400);
        $stmt = db()->prepare("SELECT id, used, expires_at FROM sy_otp_codes WHERE phone = ? AND code = ? AND used = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([$phone, $code, now_iso()]);
        $otp = $stmt->fetch();
        if (!$otp) json_error('کد تایید اشتباه یا منقضی شده', 400);
        db()->prepare("UPDATE sy_otp_codes SET used = 1 WHERE id = ?")->execute([$otp['id']]);

        $stmt = db()->prepare("SELECT * FROM sy_users WHERE phone = ? LIMIT 1");
        $stmt->execute([$phone]);
        $user = $stmt->fetch();
        $isNewUser = false;
        if (!$user) {
            if (!trim($fullName)) json_error('نام و نام خانوادگی الزامی است', 400);
            if (strlen($password) < 4) json_error('رمز عبور باید حداقل ۴ کاراکتر باشد', 400);
            $isNewUser = true;
            $newId = gen_uuid();
            $hash = hash_password($password);
            db()->prepare("INSERT INTO sy_users (id, phone, full_name, password_hash, status) VALUES (?, ?, ?, ?, 'new')")
                ->execute([$newId, $phone, $fullName, $hash]);
            // Create the empty applicant profile row (ماده ۵: حساب کاربری + پرونده)
            db()->prepare("INSERT INTO sy_profiles (id, user_id) VALUES (?, ?)")
                ->execute([gen_uuid(), $newId]);
            $user = ['id' => $newId, 'phone' => $phone, 'full_name' => $fullName, 'is_admin' => 0, 'status' => 'new', 'created_at' => now_iso()];
        } else {
            if ($fullName && !$user['full_name']) {
                db()->prepare("UPDATE sy_users SET full_name = ? WHERE id = ?")->execute([$fullName, $user['id']]);
                $user['full_name'] = $fullName;
            }
        }
        $token = create_session($user['id'], $phone);
        json_out([
            'success' => true,
            'session' => [
                'access_token' => $token,
                'user' => user_public($user),
            ],
            'is_new_user' => $isNewUser,
        ]);
    }

    // ─── Password Login ───────────────────────────────────────
    if ($act === 'password_login') {
        $phone = (string)($b['phone'] ?? '');
        $password = (string)($b['password'] ?? '');
        if (!preg_match('/^09\d{9}$/', $phone)) json_error('شماره موبایل نامعتبر', 400);
        if (!$password) json_error('رمز عبور را وارد کنید', 400);
        $stmt = db()->prepare("SELECT * FROM sy_users WHERE phone = ? LIMIT 1");
        $stmt->execute([$phone]);
        $user = $stmt->fetch();
        if (!$user || !$user['password_hash']) json_error('شماره موبایل یا رمز عبور اشتباه است', 401);
        $hashed = hash_password($password);
        if ($hashed !== $user['password_hash'] && $password !== $user['password_hash']) {
            json_error('شماره موبایل یا رمز عبور اشتباه است', 401);
        }
        $token = create_session($user['id'], $user['phone']);
        json_out([
            'success' => true,
            'session' => [
                'access_token' => $token,
                'user' => user_public($user),
            ],
        ]);
    }

    // ─── Auth: me ─────────────────────────────────────────────
    if ($act === 'me') {
        $user = get_session_user();
        if (!$user) json_error('احراز هویت نشده', 401);
        json_out(['user' => user_public($user)]);
    }

    // ─── Auth: signout ────────────────────────────────────────
    if ($act === 'signout') {
        $token = get_auth_token();
        if ($token) db()->prepare("DELETE FROM sy_sessions WHERE token = ?")->execute([$token]);
        json_out(['success' => true]);
    }

    // ─── Auth: set password ───────────────────────────────────
    if ($act === 'set_password') {
        $user = get_session_user();
        if (!$user) json_error('احراز هویت نشده', 401);
        $password = (string)($b['password'] ?? '');
        if (strlen($password) < 4) json_error('رمز عبور باید حداقل ۴ کاراکتر باشد', 400);
        db()->prepare("UPDATE sy_users SET password_hash = ? WHERE id = ?")
            ->execute([hash_password($password), $user['id']]);
        json_out(['success' => true]);
    }

    // ─── Auth: update account (name only — phone is the identity) ──
    if ($act === 'update_account') {
        $user = get_session_user();
        if (!$user) json_error('احراز هویت نشده', 401);
        $fullName = trim((string)($b['full_name'] ?? ''));
        if (!$fullName) json_error('نام نمی‌تواند خالی باشد', 400);
        db()->prepare("UPDATE sy_users SET full_name = ? WHERE id = ?")->execute([$fullName, $user['id']]);
        json_out(['success' => true, 'user' => array_merge(user_public($user), ['full_name' => $fullName])]);
    }

    // ─── Require auth for everything below ────────────────────
    $user = get_session_user();
    if (!$user) json_error('احراز هویت نشده', 401);
    $uid = $user['id'];

    // ─── Profile: get (own) ───────────────────────────────────
    if ($act === 'profile_get') {
        $stmt = db()->prepare("SELECT * FROM sy_profiles WHERE user_id = ? LIMIT 1");
        $stmt->execute([$uid]);
        $profile = $stmt->fetch();
        if (!$profile) {
            db()->prepare("INSERT INTO sy_profiles (id, user_id) VALUES (?, ?)")->execute([gen_uuid(), $uid]);
            $stmt = db()->prepare("SELECT * FROM sy_profiles WHERE user_id = ? LIMIT 1");
            $stmt->execute([$uid]);
            $profile = $stmt->fetch();
        }
        json_out(['data' => $profile]);
    }

    // ─── Profile: save (own) — ماده ۵-۴/۵-۵ ──────────────────
    if ($act === 'profile_save') {
        $stmt = db()->prepare("SELECT id FROM sy_profiles WHERE user_id = ? LIMIT 1");
        $stmt->execute([$uid]);
        if (!$stmt->fetch()) {
            db()->prepare("INSERT INTO sy_profiles (id, user_id) VALUES (?, ?)")->execute([gen_uuid(), $uid]);
        }
        $fields = [
            'city', 'contact_extra',
            'education_field', 'education_degree', 'education_center', 'courses',
            'skill_areas', 'skill_level', 'experience', 'tools',
            'description',
        ];
        $sets = []; $vals = [];
        foreach ($fields as $f) {
            if (array_key_exists($f, $b)) { $sets[] = "$f = ?"; $vals[] = trim((string)$b[$f]); }
        }
        // Compute completeness from the merged record
        $stmt = db()->prepare("SELECT * FROM sy_profiles WHERE user_id = ? LIMIT 1");
        $stmt->execute([$uid]);
        $current = $stmt->fetch() ?: [];
        $merged = array_merge($current, array_combine(
            array_map(fn($s) => explode(' =', $s)[0], $sets),
            $vals
        ));
        $complete = compute_profile_complete($merged) ? 1 : 0;
        $sets[] = 'profile_complete = ?'; $vals[] = $complete;

        $vals[] = $uid;
        db()->prepare("UPDATE sy_profiles SET " . implode(', ', $sets) . " WHERE user_id = ?")->execute($vals);
        json_out(['success' => true, 'profile_complete' => (bool)$complete]);
    }

    // ─── Exam: status (can I take it? attempts used? profile complete?) ──
    if ($act === 'exam_status') {
        $exam = get_exam();
        $stmt = db()->prepare("SELECT COUNT(*) FROM sy_attempts WHERE user_id = ? AND status IN ('completed','expired')");
        $stmt->execute([$uid]);
        $usedAttempts = (int)$stmt->fetchColumn();
        // An unfinished in_progress attempt can be resumed
        $stmt = db()->prepare("SELECT * FROM sy_attempts WHERE user_id = ? AND status = 'in_progress' ORDER BY started_at DESC LIMIT 1");
        $stmt->execute([$uid]);
        $active = $stmt->fetch();
        if ($active) $active = attempt_refresh_expiry($active);

        $stmt = db()->prepare("SELECT profile_complete FROM sy_profiles WHERE user_id = ? LIMIT 1");
        $stmt->execute([$uid]);
        $profileComplete = (bool)$stmt->fetchColumn();

        $activeQuestionCount = 0;
        if ((bool)$exam['is_active']) {
            $activeQuestionCount = (int)db()->query("SELECT COUNT(*) FROM sy_questions WHERE is_active = 1")->fetchColumn();
        }

        json_out([
            'data' => [
                'exam' => [
                    'title' => $exam['title'],
                    'duration_minutes' => (int)$exam['duration_minutes'],
                    'question_count' => (int)$exam['question_count'],
                    'is_active' => (bool)$exam['is_active'],
                    'require_profile_complete' => (bool)$exam['require_profile_complete'],
                    'show_result_to_user' => (bool)$exam['show_result_to_user'],
                    'pass_score_percent' => (int)$exam['pass_score_percent'],
                    'max_attempts' => (int)$exam['max_attempts'],
                ],
                'profile_complete' => $profileComplete,
                'used_attempts' => $usedAttempts,
                'remaining_attempts' => max(0, (int)$exam['max_attempts'] - $usedAttempts),
                'available_questions' => $activeQuestionCount,
                'active_attempt' => $active ? [
                    'id' => $active['id'],
                    'expires_at' => $active['expires_at'],
                    'started_at' => $active['started_at'],
                ] : null,
            ],
        ]);
    }

    // ─── Exam: start (creates attempt with a random question snapshot) ──
    if ($act === 'exam_start') {
        $exam = get_exam();
        if (!(bool)$exam['is_active']) json_error('آزمون در حال حاضر فعال نیست', 403);

        // Profile completeness gate (ماده ۶/۷)
        if ((bool)$exam['require_profile_complete']) {
            $stmt = db()->prepare("SELECT profile_complete FROM sy_profiles WHERE user_id = ? LIMIT 1");
            $stmt->execute([$uid]);
            if (!(bool)$stmt->fetchColumn()) json_error('ابتدا اطلاعات پروفایل خود را کامل کنید', 403);
        }

        // Attempts limit (ماده ۷-۶)
        $stmt = db()->prepare("SELECT COUNT(*) FROM sy_attempts WHERE user_id = ? AND status IN ('completed','expired')");
        $stmt->execute([$uid]);
        if ((int)$stmt->fetchColumn() >= (int)$exam['max_attempts']) {
            json_error('تعداد دفعات مجاز شرکت در آزمون به پایان رسیده است', 403);
        }

        // Resume the in_progress attempt instead of creating a new one
        $stmt = db()->prepare("SELECT * FROM sy_attempts WHERE user_id = ? AND status = 'in_progress' ORDER BY started_at DESC LIMIT 1");
        $stmt->execute([$uid]);
        $active = $stmt->fetch();
        if ($active) {
            $active = attempt_refresh_expiry($active);
            if ($active['status'] === 'in_progress') {
                json_out(['data' => ['attempt_id' => $active['id'], 'expires_at' => $active['expires_at'], 'resumed' => true]]);
            }
        }

        // Pick N random active questions (server-side snapshot — ماده ۷-۳)
        $n = min((int)$exam['question_count'], 50);
        $stmt = db()->prepare("SELECT id FROM sy_questions WHERE is_active = 1 ORDER BY RAND() LIMIT " . max(1, $n));
        $stmt->execute();
        $ids = array_column($stmt->fetchAll(), 'id');
        if (count($ids) === 0) json_error('در حال حاضر سؤالی برای آزمون ثبت نشده است', 403);

        $attemptId = gen_uuid();
        $duration = max(1, (int)$exam['duration_minutes']);
        $expires = date('Y-m-d H:i:s', time() + $duration * 60);
        db()->prepare("INSERT INTO sy_attempts (id, user_id, exam_id, status, question_ids, expires_at) VALUES (?, ?, 1, 'in_progress', ?, ?)")
            ->execute([$attemptId, $uid, j_encode($ids), $expires]);
        json_out(['data' => ['attempt_id' => $attemptId, 'expires_at' => $expires, 'resumed' => false]]);
    }

    // ─── Exam: state (questions without correct answers + saved responses) ──
    if ($act === 'exam_state') {
        $attemptId = (string)($b['attempt_id'] ?? '');
        $stmt = db()->prepare("SELECT * FROM sy_attempts WHERE id = ? AND user_id = ? LIMIT 1");
        $stmt->execute([$attemptId, $uid]);
        $attempt = $stmt->fetch();
        if (!$attempt) json_error('آزمون یافت نشد', 404);
        $attempt = attempt_refresh_expiry($attempt);

        $qIds = j_decode($attempt['question_ids'], []);
        $questions = [];
        if ($qIds) {
            $ph = implode(',', array_fill(0, count($qIds), '?'));
            $stmt = db()->prepare("SELECT id, text, option1, option2, option3, option4 FROM sy_questions WHERE id IN ($ph)");
            $stmt->execute($qIds);
            // Keep the original snapshot order
            $byId = [];
            foreach ($stmt->fetchAll() as $q) $byId[$q['id']] = $q;
            foreach ($qIds as $i => $qid) {
                if (isset($byId[$qid])) {
                    $q = $byId[$qid];
                    $q['index'] = $i;
                    $questions[] = $q;
                }
            }
        }
        json_out([
            'data' => [
                'attempt_id' => $attempt['id'],
                'status' => $attempt['status'],
                'expires_at' => $attempt['expires_at'],
                'started_at' => $attempt['started_at'],
                'questions' => $questions,
                'answers' => $attempt['status'] === 'in_progress' ? get_attempt_answers($attempt['id']) : [],
            ],
        ]);
    }

    // ─── Exam: save progress (one answer at a time) ───────────
    if ($act === 'exam_save_progress') {
        $attemptId = (string)($b['attempt_id'] ?? '');
        $questionId = (string)($b['question_id'] ?? '');
        $selected = max(0, min(4, (int)($b['selected_option'] ?? 0)));
        $stmt = db()->prepare("SELECT * FROM sy_attempts WHERE id = ? AND user_id = ? AND status = 'in_progress' LIMIT 1");
        $stmt->execute([$attemptId, $uid]);
        $attempt = $stmt->fetch();
        if (!$attempt) json_error('آزمون فعال یافت نشد', 404);
        if (strtotime($attempt['expires_at']) <= time()) {
            finalize_attempt_expired($attempt);
            json_error('زمان آزمون به پایان رسیده است', 410);
        }
        // Only answers to questions inside this attempt's snapshot are accepted
        $qIds = j_decode($attempt['question_ids'], []);
        if (!in_array($questionId, $qIds, true)) json_error('سؤال متعلق به این آزمون نیست', 400);

        $stmt = db()->prepare("SELECT id FROM sy_attempt_answers WHERE attempt_id = ? AND question_id = ? LIMIT 1");
        $stmt->execute([$attemptId, $questionId]);
        $existing = $stmt->fetch();
        if ($existing) {
            db()->prepare("UPDATE sy_attempt_answers SET selected_option = ?, answered_at = ? WHERE id = ?")
                ->execute([$selected, now_iso(), $existing['id']]);
        } else {
            db()->prepare("INSERT INTO sy_attempt_answers (id, attempt_id, question_id, selected_option) VALUES (?, ?, ?, ?)")
                ->execute([gen_uuid(), $attemptId, $questionId, $selected]);
        }
        json_out(['success' => true]);
    }

    // ─── Exam: submit (grade server-side against the answer key) ──
    if ($act === 'exam_submit') {
        $attemptId = (string)($b['attempt_id'] ?? '');
        $stmt = db()->prepare("SELECT * FROM sy_attempts WHERE id = ? AND user_id = ? LIMIT 1");
        $stmt->execute([$attemptId, $uid]);
        $attempt = $stmt->fetch();
        if (!$attempt) json_error('آزمون یافت نشد', 404);
        if ($attempt['status'] !== 'in_progress') {
            json_out(['data' => ['status' => $attempt['status'], 'already' => true]]);
        }
        if (strtotime($attempt['expires_at']) <= time()) {
            finalize_attempt_expired($attempt);
            json_error('زمان آزمون به پایان رسیده بود و پاسخ‌ها بر اساس پاسخ‌های ثبت‌شده تصحیح شد', 410);
        }

        [$score, $answered] = grade_attempt($attemptId);
        $qIds = j_decode($attempt['question_ids'], []);
        $total = count($qIds);
        $passScore = (int)get_exam()['pass_score_percent'];
        $percent = $total > 0 ? round($score * 100 / $total) : 0;
        $passed = $percent >= $passScore ? 1 : 0;
        db()->prepare("UPDATE sy_attempts SET status = 'completed', finished_at = ?, score = ?, total = ?, passed = ? WHERE id = ?")
            ->execute([now_iso(), $score, $total, $passed, $attemptId]);
        json_out(['data' => ['status' => 'completed', 'score' => $score, 'total' => $total, 'percent' => $percent, 'passed' => (bool)$passed]]);
    }

    // ─── Exam: result (own, subject to show_result_to_user policy) ──
    if ($act === 'exam_result') {
        $attemptId = (string)($b['attempt_id'] ?? '');
        $stmt = db()->prepare("SELECT * FROM sy_attempts WHERE id = ? AND user_id = ? LIMIT 1");
        $stmt->execute([$attemptId, $uid]);
        $attempt = $stmt->fetch();
        if (!$attempt) json_error('آزمون یافت نشد', 404);
        $exam = get_exam();
        $attempt = attempt_refresh_expiry($attempt);
        $out = [
            'attempt_id' => $attempt['id'],
            'status' => $attempt['status'],
            'started_at' => $attempt['started_at'],
            'finished_at' => $attempt['finished_at'],
        ];
        if (in_array($attempt['status'], ['completed', 'expired'], true)) {
            $out['total'] = (int)$attempt['total'];
            if ((bool)$exam['show_result_to_user']) {
                $out['score'] = (int)$attempt['score'];
                $out['passed'] = (bool)$attempt['passed'];
                $out['show_result'] = true;
            } else {
                // سیاست نمایش نمره — ماده ۳-۲ بند ۸ / ۷-۶: کاربر فقط وضعیت شرکت را می‌بیند
                $out['show_result'] = false;
            }
        }
        json_out(['data' => $out]);
    }

    // ─── Admin guard for everything below ─────────────────────
    if (strpos($act, 'admin_') === 0) {
        if (!$user['is_admin']) json_error('دسترسی غیرمجاز', 403);
    }

    // ─── Admin: stats (ماده ۸-۲: ۶ آمار پایه) ─────────────────
    if ($act === 'admin_stats') {
        $stats = [];
        $stats['total_applicants'] = (int)db()->query("SELECT COUNT(*) FROM sy_users WHERE is_admin = 0")->fetchColumn();
        $stats['new_applicants'] = (int)db()->query("SELECT COUNT(*) FROM sy_users WHERE is_admin = 0 AND status = 'new'")->fetchColumn();
        $stats['in_review'] = (int)db()->query("SELECT COUNT(*) FROM sy_users WHERE is_admin = 0 AND status = 'in_review'")->fetchColumn();
        $stats['approved'] = (int)db()->query("SELECT COUNT(*) FROM sy_users WHERE is_admin = 0 AND status = 'approved'")->fetchColumn();
        $stats['rejected'] = (int)db()->query("SELECT COUNT(*) FROM sy_users WHERE is_admin = 0 AND status = 'rejected'")->fetchColumn();
        $stats['exam_participants'] = (int)db()->query("SELECT COUNT(DISTINCT user_id) FROM sy_attempts WHERE status IN ('completed','expired')")->fetchColumn();
        json_out(['data' => $stats]);
    }

    // ─── Admin: applicants list (search + filters + paging — ماده ۸-۳/۸-۴) ──
    if ($act === 'admin_applicants_list') {
        $conds = ["u.is_admin = 0"];
        $vals = [];
        $search = trim((string)($b['search'] ?? ''));
        if ($search !== '') {
            $conds[] = "(u.full_name LIKE ? OR u.phone LIKE ?)";
            $like = "%$search%";
            $vals[] = $like; $vals[] = $like;
        }
        if (!empty($b['status']) && is_valid_status((string)$b['status'])) {
            $conds[] = "u.status = ?";
            $vals[] = (string)$b['status'];
        }
        if (!empty($b['city'])) {
            $conds[] = "p.city LIKE ?";
            $vals[] = "%" . trim((string)$b['city']) . "%";
        }
        $examStatus = (string)($b['exam_status'] ?? '');
        if ($examStatus === 'none') {
            $conds[] = "a.id IS NULL";
        } elseif ($examStatus === 'completed') {
            $conds[] = "a.status IN ('completed','expired')";
        }
        $sql = "SELECT u.id, u.phone, u.full_name, u.status, u.created_at, p.city, p.profile_complete,
                a.id AS attempt_id, a.status AS attempt_status, a.score AS attempt_score, a.total AS attempt_total, a.passed AS attempt_passed
                FROM sy_users u
                LEFT JOIN sy_profiles p ON p.user_id = u.id
                LEFT JOIN sy_attempts a ON a.user_id = u.id AND a.status IN ('completed','expired')
                WHERE " . implode(' AND ', $conds) . "
                ORDER BY u.created_at DESC
                LIMIT 500";
        $stmt = db()->prepare($sql);
        $stmt->execute($vals);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['profile_complete'] = (bool)($r['profile_complete'] ?? 0);
            $r['attempt_score'] = $r['attempt_score'] !== null ? (int)$r['attempt_score'] : null;
            $r['attempt_total'] = $r['attempt_total'] !== null ? (int)$r['attempt_total'] : null;
            $r['attempt_passed'] = $r['attempt_passed'] !== null ? (bool)((int)$r['attempt_passed']) : null;
        }
        json_out(['data' => $rows, 'total' => count($rows)]);
    }

    // ─── Admin: applicant full file (ماده ۸-۵) ────────────────
    if ($act === 'admin_applicant_get') {
        $applicantId = (string)($b['id'] ?? '');
        $stmt = db()->prepare("SELECT id, phone, full_name, status, created_at FROM sy_users WHERE id = ? AND is_admin = 0 LIMIT 1");
        $stmt->execute([$applicantId]);
        $applicant = $stmt->fetch();
        if (!$applicant) json_error('متقاضی یافت نشد', 404);
        $stmt = db()->prepare("SELECT * FROM sy_profiles WHERE user_id = ? LIMIT 1");
        $stmt->execute([$applicantId]);
        $profile = $stmt->fetch() ?: null;
        $stmt = db()->prepare("SELECT id, status, started_at, finished_at, score, total, passed, expires_at FROM sy_attempts WHERE user_id = ? ORDER BY started_at DESC");
        $stmt->execute([$applicantId]);
        $attempts = $stmt->fetchAll();
        foreach ($attempts as &$a) {
            $a['score'] = (int)$a['score'];
            $a['total'] = (int)$a['total'];
            $a['passed'] = (bool)((int)$a['passed']);
            // Answer detail per question (پاسخ‌های ثبت‌شده — ماده ۷-۶)
            $stmt = db()->prepare("SELECT aa.question_id, aa.selected_option, aa.is_correct, q.text, q.option1, q.option2, q.option3, q.option4, q.correct_option
                FROM sy_attempt_answers aa LEFT JOIN sy_questions q ON q.id = aa.question_id
                WHERE aa.attempt_id = ?");
            $stmt->execute([$a['id']]);
            $a['answers'] = $stmt->fetchAll();
        }
        json_out(['data' => ['applicant' => $applicant, 'profile' => $profile, 'attempts' => $attempts]]);
    }

    // ─── Admin: set applicant status (ماده ۸-۶) ───────────────
    if ($act === 'admin_applicant_set_status') {
        $applicantId = (string)($b['id'] ?? '');
        $status = (string)($b['status'] ?? '');
        if (!is_valid_status($status)) json_error('وضعیت نامعتبر است', 400);
        $stmt = db()->prepare("UPDATE sy_users SET status = ? WHERE id = ? AND is_admin = 0");
        $stmt->execute([$status, $applicantId]);
        json_out(['success' => true]);
    }

    // ─── Admin: applicants CSV export (ماده ۸-۷) ──────────────
    if ($act === 'admin_applicants_export') {
        $stmt = db()->prepare("SELECT u.phone, u.full_name, u.status, u.created_at, p.city, p.education_field, p.education_degree, p.skill_areas, p.skill_level, p.profile_complete,
            a.status AS attempt_status, a.score AS attempt_score, a.total AS attempt_total, a.passed AS attempt_passed
            FROM sy_users u
            LEFT JOIN sy_profiles p ON p.user_id = u.id
            LEFT JOIN sy_attempts a ON a.user_id = u.id AND a.status IN ('completed','expired')
            WHERE u.is_admin = 0
            ORDER BY u.created_at DESC
            LIMIT 5000");
        $stmt->execute();
        $rows = $stmt->fetchAll();
        $headers = ['نام و نام خانوادگی', 'شماره تماس', 'شهر', 'تاریخ ثبت‌نام', 'وضعیت بررسی', 'وضعیت آزمون', 'نمره آزمون', 'حداکثر نمره', 'قبولی', 'رشته تحصیلی', 'مقطع', 'زمینه مهارتی', 'سطح مهارت', 'تکمیل پروفایل'];
        $statusFa = ['new' => 'جدید', 'in_review' => 'در حال بررسی', 'approved' => 'تأیید اولیه', 'rejected' => 'ردشده'];
        $examStatusFa = ['completed' => 'شرکت کرده', 'expired' => 'شرکت کرده (پایان زمان)'];
        $lines = [implode(',', array_map(fn($h) => '"' . str_replace('"', '""', $h) . '"', $headers))];
        foreach ($rows as $r) {
            $examLabel = $r['attempt_status'] ? ($examStatusFa[$r['attempt_status']] ?? $r['attempt_status']) : 'شرکت نکرده';
            $score = $r['attempt_score'] !== null ? $r['attempt_score'] . '/' . $r['attempt_total'] : '';
            $cells = [
                $r['full_name'], $r['phone'], $r['city'], $r['created_at'],
                $statusFa[$r['status']] ?? $r['status'],
                $examLabel, $score, '', $r['attempt_passed'] !== null ? ((int)$r['attempt_passed'] ? 'قبول' : 'مردود') : '',
                $r['education_field'], $r['education_degree'], $r['skill_areas'], $r['skill_level'],
                ((int)($r['profile_complete'] ?? 0)) ? 'کامل' : 'ناقص',
            ];
            $lines[] = implode(',', array_map(fn($c) => '"' . str_replace('"', '""', (string)$c) . '"', $cells));
        }
        // UTF-8 BOM so Excel opens Persian text correctly
        json_out(['data' => implode("\n", $lines)]);
    }

    // ─── Admin: questions CRUD (ماده ۷-۴، سقف ۵۰) ─────────────
    if ($act === 'admin_questions_list') {
        $search = trim((string)($b['search'] ?? ''));
        $sql = "SELECT * FROM sy_questions";
        $vals = [];
        if ($search !== '') {
            $sql .= " WHERE text LIKE ?";
            $vals[] = "%$search%";
        }
        $sql .= " ORDER BY created_at DESC LIMIT 100";
        $stmt = db()->prepare($sql);
        $stmt->execute($vals);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) $r['is_active'] = (bool)((int)$r['is_active']);
        json_out(['data' => $rows, 'total' => count($rows)]);
    }

    if ($act === 'admin_questions_create') {
        $count = (int)db()->query("SELECT COUNT(*) FROM sy_questions")->fetchColumn();
        if ($count >= 50) json_error('حداکثر ۵۰ سؤال قابل ثبت است (بند ۷-۲)', 400);
        $text = trim((string)($b['text'] ?? ''));
        $opts = [(string)($b['option1'] ?? ''), (string)($b['option2'] ?? ''), (string)($b['option3'] ?? ''), (string)($b['option4'] ?? '')];
        $correct = (int)($b['correct_option'] ?? 1);
        if (!$text) json_error('متن سؤال الزامی است', 400);
        if (count(array_filter($opts, fn($o) => trim($o) !== '')) < 2) json_error('حداقل دو گزینه لازم است', 400);
        if ($correct < 1 || $correct > 4 || trim($opts[$correct - 1]) === '') json_error('پاسخ صحیح نامعتبر است', 400);
        $id = gen_uuid();
        db()->prepare("INSERT INTO sy_questions (id, text, option1, option2, option3, option4, correct_option, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            ->execute([$id, $text, $opts[0], $opts[1], $opts[2], $opts[3], $correct, !empty($b['is_active']) ? 1 : 0]);
        json_out(['data' => ['id' => $id]]);
    }

    if ($act === 'admin_questions_update') {
        $id = (string)($b['id'] ?? '');
        $text = trim((string)($b['text'] ?? ''));
        $opts = [(string)($b['option1'] ?? ''), (string)($b['option2'] ?? ''), (string)($b['option3'] ?? ''), (string)($b['option4'] ?? '')];
        $correct = (int)($b['correct_option'] ?? 1);
        if (!$text) json_error('متن سؤال الزامی است', 400);
        if (count(array_filter($opts, fn($o) => trim($o) !== '')) < 2) json_error('حداقل دو گزینه لازم است', 400);
        if ($correct < 1 || $correct > 4 || trim($opts[$correct - 1]) === '') json_error('پاسخ صحیح نامعتبر است', 400);
        db()->prepare("UPDATE sy_questions SET text = ?, option1 = ?, option2 = ?, option3 = ?, option4 = ?, correct_option = ?, is_active = ? WHERE id = ?")
            ->execute([$text, $opts[0], $opts[1], $opts[2], $opts[3], $correct, !empty($b['is_active']) ? 1 : 0, $id]);
        json_out(['success' => true]);
    }

    if ($act === 'admin_questions_toggle') {
        $id = (string)($b['id'] ?? '');
        $active = !empty($b['is_active']) ? 1 : 0;
        db()->prepare("UPDATE sy_questions SET is_active = ? WHERE id = ?")->execute([$active, $id]);
        json_out(['success' => true]);
    }

    if ($act === 'admin_questions_delete') {
        db()->prepare("DELETE FROM sy_questions WHERE id = ?")->execute([(string)($b['id'] ?? '')]);
        json_out(['success' => true]);
    }

    // ─── Admin: exam settings get/save (ماده ۷-۴) ─────────────
    if ($act === 'admin_exam_get') {
        json_out(['data' => get_exam()]);
    }

    if ($act === 'admin_exam_save') {
        $title = trim((string)($b['title'] ?? ''));
        if (!$title) json_error('عنوان آزمون الزامی است', 400);
        $duration = max(1, min(300, (int)($b['duration_minutes'] ?? 30)));
        $qCount = max(1, min(50, (int)($b['question_count'] ?? 20)));
        $passScore = max(0, min(100, (int)($b['pass_score_percent'] ?? 60)));
        $maxAttempts = max(1, min(10, (int)($b['max_attempts'] ?? 1)));
        db()->prepare("UPDATE sy_exams SET title = ?, duration_minutes = ?, question_count = ?, pass_score_percent = ?, max_attempts = ?, show_result_to_user = ?, require_profile_complete = ?, is_active = ? WHERE id = 1")
            ->execute([
                $title, $duration, $qCount, $passScore, $maxAttempts,
                !empty($b['show_result_to_user']) ? 1 : 0,
                !empty($b['require_profile_complete']) ? 1 : 0,
                !empty($b['is_active']) ? 1 : 0,
            ]);
        json_out(['success' => true]);
    }

    // ─── Admin: settings (SMS + exam instructions) ────────────
    if ($act === 'admin_settings_get') {
        json_out(['data' => get_settings()]);
    }

    if ($act === 'admin_settings_update') {
        $sets = []; $vals = [];
        foreach (['sms_api_key', 'sms_pattern_code', 'sms_line_number', 'exam_instructions'] as $f) {
            if (array_key_exists($f, $b)) { $sets[] = "$f = ?"; $vals[] = (string)$b[$f]; }
        }
        if ($sets) {
            $vals[] = 1;
            db()->prepare("UPDATE sy_settings SET " . implode(', ', $sets) . " WHERE id = ?")->execute($vals);
        }
        json_out(['success' => true]);
    }

    // ─── Admin: extra admin accounts (بند ۸-۱ — ساخت حساب مدیر) ──
    if ($act === 'admin_user_create') {
        $phone = (string)($b['phone'] ?? '');
        $password = (string)($b['password'] ?? '');
        $fullName = trim((string)($b['full_name'] ?? ''));
        if (!preg_match('/^09\d{9}$/', $phone)) json_error('شماره موبایل نامعتبر', 400);
        if (strlen($password) < 4) json_error('رمز عبور باید حداقل ۴ کاراکتر باشد', 400);
        if (!$fullName) json_error('نام الزامی است', 400);
        $stmt = db()->prepare("SELECT id FROM sy_users WHERE phone = ? LIMIT 1");
        $stmt->execute([$phone]);
        if ($stmt->fetch()) json_error('این شماره قبلاً ثبت شده است', 400);
        $id = gen_uuid();
        db()->prepare("INSERT INTO sy_users (id, phone, full_name, password_hash, is_admin, status) VALUES (?, ?, ?, ?, ?, 'new')")
            ->execute([$id, $phone, $fullName, hash_password($password), !empty($b['is_admin']) ? 1 : 0]);
        json_out(['data' => ['id' => $id]]);
    }

    if ($act === 'admin_user_update') {
        $id = (string)($b['id'] ?? '');
        $sets = []; $vals = [];
        if (array_key_exists('full_name', $b) && trim((string)$b['full_name']) !== '') {
            $sets[] = 'full_name = ?'; $vals[] = trim((string)$b['full_name']);
        }
        if (array_key_exists('password', $b) && (string)$b['password'] !== '') {
            $sets[] = 'password_hash = ?'; $vals[] = hash_password((string)$b['password']);
        }
        if ($sets) {
            $vals[] = $id;
            db()->prepare("UPDATE sy_users SET " . implode(', ', $sets) . " WHERE id = ?")->execute($vals);
        }
        json_out(['success' => true]);
    }

    if ($act === 'admin_user_delete') {
        $id = (string)($b['id'] ?? '');
        if ($id === $uid) json_error('حساب خودتان قابل حذف نیست', 400);
        db()->prepare("DELETE FROM sy_users WHERE id = ? AND is_admin = 0")->execute([$id]);
        db()->prepare("DELETE FROM sy_profiles WHERE user_id = ?")->execute([$id]);
        json_out(['success' => true]);
    }

    json_error('اکشن نامعتبر', 404);
} catch (PDOException $e) {
    json_error('خطای داخلی سرور', 500);
} catch (Exception $e) {
    json_error('خطای داخلی سرور', 500);
}
