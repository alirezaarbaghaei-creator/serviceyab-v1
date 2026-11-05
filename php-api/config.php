<?php
/**
 * ServiceYab (سرویس‌یاب) API — Database Configuration
 *
 * ONLY database connection credentials live here.
 * All other settings (SMS, exam) are stored in and read from
 * the sy_settings table in the database.
 *
 * Edit these values to match your hosting's MySQL database.
 */

return [
    'db_host' => getenv('SY_DB_HOST') ?: 'localhost',
    'db_name' => getenv('SY_DB_NAME') ?: 'serviceyab',
    'db_user' => getenv('SY_DB_USER') ?: 'serviceyab',
    'db_pass' => getenv('SY_DB_PASS') ?: 'CHANGE_THIS_PASSWORD',
    'db_charset' => 'utf8mb4',
];
