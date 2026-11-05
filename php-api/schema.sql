-- ============================================================
--  سرویس‌یاب (ServiceYab) — MySQL Database Schema (Phase 1)
--  Run this once in phpMyAdmin or MySQL CLI to create all tables.
--  After running, the PHP API will auto-seed default settings
--  and a default admin user (phone: 09120000000, password: admin123).
--  ⚠️ CHANGE THE ADMIN PASSWORD IMMEDIATELY AFTER FIRST LOGIN.
-- ============================================================

-- 1. Users (applicants + admin)
--    status: new | in_review | approved | rejected  (ماده ۸-۶ قرارداد)
CREATE TABLE IF NOT EXISTS sy_users (
    id CHAR(36) PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    full_name TEXT DEFAULT '',
    password_hash TEXT NULL,
    is_admin TINYINT(1) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. OTP Codes
CREATE TABLE IF NOT EXISTS sy_otp_codes (
    id CHAR(36) PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at DATETIME NOT NULL,
    used TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_otp_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Sessions
CREATE TABLE IF NOT EXISTS sy_sessions (
    token VARCHAR(64) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    INDEX idx_sessions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Settings (single-row table — all secrets stored here)
CREATE TABLE IF NOT EXISTS sy_settings (
    id INT PRIMARY KEY DEFAULT 1,
    sms_api_key TEXT DEFAULT '',
    sms_pattern_code TEXT DEFAULT '',
    sms_line_number TEXT DEFAULT '',
    exam_instructions TEXT DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT single_row CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Applicant Profile (ماده ۵-۴: گروه‌های اطلاعاتی الف تا د)
CREATE TABLE IF NOT EXISTS sy_profiles (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    -- الف) اطلاعات فردی و تماس (full_name + phone روی sy_users هستند)
    city TEXT DEFAULT '',
    contact_extra TEXT DEFAULT '',
    -- ب) اطلاعات آموزشی
    education_field TEXT DEFAULT '',
    education_degree TEXT DEFAULT '',
    education_center TEXT DEFAULT '',
    courses TEXT DEFAULT '',
    -- ج) اطلاعات تخصصی
    skill_areas TEXT DEFAULT '',
    skill_level TEXT DEFAULT '',
    experience TEXT DEFAULT '',
    tools TEXT DEFAULT '',
    -- د) توضیحات تکمیلی
    description TEXT DEFAULT '',
    profile_complete TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_profiles_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Exam Questions (ماده ۷-۲: حداکثر ۵۰ سؤال، سقف در لایه اپ اعمال می‌شود)
CREATE TABLE IF NOT EXISTS sy_questions (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Exam Settings (single-row — دستورالعمل/مدت/تعداد/حدنصاب/سیاست‌ها، ماده ۷-۴)
CREATE TABLE IF NOT EXISTS sy_exams (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Exam Attempts (ماده ۷-۶)
--    status: in_progress | completed | expired
CREATE TABLE IF NOT EXISTS sy_attempts (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Attempt Answers (پاسخ‌های تدریجی برای ادامه آزمون پس از قطع شدن)
CREATE TABLE IF NOT EXISTS sy_attempt_answers (
    id CHAR(36) PRIMARY KEY,
    attempt_id CHAR(36) NOT NULL,
    question_id CHAR(36) NOT NULL,
    selected_option INT DEFAULT 0,
    is_correct TINYINT(1) DEFAULT 0,
    answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_attempt_question (attempt_id, question_id),
    INDEX idx_answers_attempt (attempt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  Default settings row
-- ============================================================
INSERT INTO sy_settings (id, sms_api_key, sms_pattern_code, sms_line_number, exam_instructions)
VALUES (1, '', '', '', '')
ON DUPLICATE KEY UPDATE id = id;

-- ============================================================
--  Default exam settings (غیرفعال تا زمانی که مدیر پیکربندی کند)
-- ============================================================
INSERT INTO sy_exams (id, title, duration_minutes, question_count, pass_score_percent, max_attempts, show_result_to_user, require_profile_complete, is_active)
VALUES (1, 'آزمون تخصصی تعمیرات بردهای الکترونیکی', 30, 20, 60, 1, 1, 1, 0)
ON DUPLICATE KEY UPDATE id = id;

-- ============================================================
--  Default admin user (phone: 09120000000, password: admin123)
--  Password hash is SHA-256 of 'admin123'
--  ⚠️ CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN.
-- ============================================================
INSERT INTO sy_users (id, phone, full_name, is_admin, password_hash)
VALUES ('a0000000-0000-0000-0000-000000000001', '09120000000', 'مدیر سیستم', 1, '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9')
ON DUPLICATE KEY UPDATE is_admin = 1;
