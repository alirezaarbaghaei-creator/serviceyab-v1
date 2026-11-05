package com.kateb.app.plugins;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;
import android.util.Log;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Picks the OTP out of the SMS notification that the messaging app posts.
 *
 * WHY THIS INSTEAD OF RECEIVE_SMS
 * ───────────────────────────────
 * The broadcast route (SMS_RECEIVED) needs the RECEIVE_SMS runtime permission,
 * and that dialog has to be answered before the message arrives. On device the
 * dialog was still up while the SMS was delivered, so nothing was listening and
 * the code was dropped — and on Cafe Bazaar RECEIVE_SMS is a sensitive
 * permission that needs a declaration form on top of it.
 *
 * Reading the notification sidesteps both problems:
 *
 *   - No permission is declared at all. Notification access is granted by the
 *     user in Settings (one toggle, one time), not through a runtime dialog, and
 *     it is not in the sensitive-permission family that triggers store review
 *     questions. The APK asks the user for nothing at install time.
 *   - No Google Play Services. SMS Retriever and User Consent both live there
 *     and neither is usable here (Retriever needs an 11-char app hash that a
 *     pre-approved IranPayamak pattern template cannot carry; Consent simply is
 *     not installed on a large share of these devices).
 *   - No race. The system binds this service for as long as access is granted,
 *     so there is no window in which it starts listening too late. That was the
 *     entire failure of the receiver approach.
 *
 * It only READS notification text and never cancels anything, so the SMS still
 * reaches the messaging app and its notification displays as normal.
 */
public class OtpNotificationListener extends NotificationListenerService {

    private static final String TAG = "KatebSmsAutofill";

    /**
     * A run of 4-6 digits not glued to other digits.
     *
     * The guards are load-bearing: an Iranian mobile number (09123456789) and an
     * operator line number (3000xxxx) are both long digit runs, so without
     * (?<!\d) / (?!\d) the matcher would "find a code" inside them. With the
    /**
     * Persian/Arabic digit code points mapped to their ASCII values.
     *
     * Iranian SMS providers send the OTP with Persian digits (۰۱۲۳۴۵۶۷۸۹) as
     * often as ASCII, and the receiver regex only understands ASCII, so those
     * messages matched nothing. Normalizing first makes both work.
     */
    private static final String PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
    private static final String ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

    /**
     * Keywords that introduce an OTP, in the languages/layouts these SMS use.
     *
     * The code is rarely the only digits in the message: a sender line number
     * (3000xxxx), a year, or a customer id can all precede it. Anchoring on the
     * word that actually means "code" is what makes extraction pick the right
     * run instead of the first one, which is what made it "detect wrong".
     *
     * Persian "کد" is matched without the tail so "کد", "کد ورود", "کد تایید"
     * all hit; the Latin keywords cover the rare English template. The trailing
     * class eats the separator that usually follows (a space, colon, or ZWNJ).
     */
    private static final Pattern CODE_KEYWORD =
        Pattern.compile("(?i)(?:کد|رمز|پویش|ورود|تایید|code|otp|pin|verification)[\\s\\u200c:：]*");

    /**
     * A standalone run of 4-6 ASCII digits.
     *
     * The guards are load-bearing: an Iranian mobile number (09123456789) and an
     * operator line number (3000xxxx) are both long digit runs, so without
     * (?<!\\d) / (?!\\d) the matcher would "find a code" inside them. With the
     * guards no run inside a 10+ digit number can match.
     */
    private static final Pattern CODE_RUN = Pattern.compile("(?<!\\d)\\d{4,6}(?!\\d)");

    /**
     * Live bridge to the plugin instance currently registered.
     *
     * The system binds this service in its own lifetime, independent of whether
     * the WebView is up, so it cannot reach JS on its own. OtpAutofillPlugin sets
     * this on start() and clears it on stop(), which gives the "only while the
     * OTP screen is open" window for free: with the bridge null the service
     * observes and discards.
     *
     * Volatile because it is written from the plugin (main thread) and read from
     * the system's binder thread here.
     */
    private static volatile OtpAutofillPlugin bridge;

    /** Called by OtpAutofillPlugin from start()/stop(). */
    static void setBridge(OtpAutofillPlugin plugin) {
        bridge = plugin;
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        OtpAutofillPlugin target = bridge;
        if (target == null) return;

        String raw = extractText(sbn.getNotification());
        if (TextUtils.isEmpty(raw)) return;

        // Normalize BEFORE matching: a code sent as Persian digits (۱۲۳۴) is not
        // visible to \d at all, so the whole extraction would silently fail.
        String text = normalizeDigits(raw);

        String code = extractCode(text);
        if (code == null) {
            Log.d(TAG, "notification seen, no code pattern. length=" + text.length());
            return;
        }

        Log.d(TAG, "onReceive fired, body length=" + text.length() + ", captured OTP=" + code);
        target.emitCode(code);
    }

    /**
     * Picks the OTP out of one notification's text.
     *
     * Strategy, in order of trust:
     *   1. A digit run that follows a code keyword (کد/رمز/otp/...) — by far the
     *      common case and the only one that survives a message that also carries
     *      a phone number, a year, or a customer id, because those do not sit
     *      right after the word "code".
     *   2. If no keyword is present at all, fall back to the first standalone
     *      6-digit run (and only 6 — see below). This keeps providers whose
     *      template has no keyword working, at the cost of some imprecision —
     *      but it only runs when (1) found nothing, so the common case is never
     *      degraded by it.
     *
     * A run of exactly 6 is preferred over a 4-5 run when both are candidates
     * after the same keyword, because the login screen requires 6 digits and a
     * truncated pick would be rejected as "کد اشتباه".
     *
     * Returns null when nothing plausible is found; the caller then simply does
     * not autofill and leaves the field for manual entry.
     */
    private String extractCode(String text) {
        // 1) Keyword-anchored: prefer a 6-digit run, then any 4-6 run.
        Matcher kw = CODE_KEYWORD.matcher(text);
        while (kw.find()) {
            int from = kw.end();
            Matcher run = CODE_RUN.matcher(text.substring(from));
            String fallback = null;
            while (run.find()) {
                String candidate = run.group();
                if (candidate.length() == 6) return candidate;
                if (fallback == null) fallback = candidate;
            }
            // A keyword was found but its digits were part of a longer number;
            // keep this candidate and let a later keyword try to beat it.
            if (fallback != null) return fallback;
        }

        // 2) No keyword anywhere: fall back to the first standalone digit run,
        //    but ONLY if it is exactly 6 digits. The login screen requires 6,
        //    and a 4-5 digit fallback would be a near-certain wrong pick (a year
        //    like 1403, or the tail of a line number). Better to autofill nothing
        //    than to fill a code that is guaranteed to fail.
        Matcher any = Pattern.compile("(?<!\\d)\\d{6}(?!\\d)").matcher(text);
        if (any.find()) return any.group();

        return null;
    }

    /**
     * Rewrites Persian (۰-۹) and Arabic-Indic (٠-٩) digits to ASCII 0-9.
     *
     * The two ranges are handled explicitly rather than with Character.digit(),
     * because Character.digit() also maps things this must not touch and returns
     * -1 for the rest, which would corrupt the text. Only the code points that
     * are genuinely digits are converted; everything else is left as-is so the
     * keyword regex still sees the original wording.
     */
    private String normalizeDigits(String input) {
        if (input == null || input.isEmpty()) return input;
        StringBuilder sb = new StringBuilder(input.length());
        for (int i = 0; i < input.length(); i++) {
            char c = input.charAt(i);
            int p = PERSIAN_DIGITS.indexOf(c);
            if (p >= 0) { sb.append((char) ('0' + p)); continue; }
            int a = ARABIC_DIGITS.indexOf(c);
            if (a >= 0) { sb.append((char) ('0' + a)); continue; }
            sb.append(c);
        }
        return sb.toString();
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // Nothing to do: the OTP is taken from the posted notification, and a
        // removed one is never a code we still need. Declared only so this reads
        // as a deliberate NotificationListenerService, not a partial override.
    }

    /**
     * Flattens every text carrier a notification can use into one string.
     *
     * Messaging apps disagree about which one they fill in: stock AOSP puts the
     * body in EXTRA_TEXT, Samsung and Huawei often use EXTRA_BIG_TEXT or an
     * EXTRA_TEXT_LINES array for the collapsed/expanded forms, and the title can
     * carry the sender or part of the body. Trying all of them is what makes the
     * matcher work across ROMs instead of only on the developer's phone.
     */
    private String extractText(Notification n) {
        if (n == null || n.extras == null) return "";

        StringBuilder sb = new StringBuilder();

        CharSequence title = n.extras.getCharSequence(Notification.EXTRA_TITLE);
        if (title != null) sb.append(title).append(' ');

        CharSequence big = n.extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        if (big != null) sb.append(big).append(' ');

        CharSequence text = n.extras.getCharSequence(Notification.EXTRA_TEXT);
        if (text != null) sb.append(text).append(' ');

        CharSequence sub = n.extras.getCharSequence(Notification.EXTRA_SUB_TEXT);
        if (sub != null) sb.append(sub).append(' ');

        // MessagingStyle notifications store the individual messages here rather
        // than in EXTRA_TEXT, so a plain read sees an empty body on the devices
        // that use it.
        CharSequence[] lines = n.extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (lines != null) {
            for (CharSequence line : lines) {
                if (line != null) sb.append(line).append(' ');
            }
        }

        // EXTRA_MESSAGES also holds the structured MessagingStyle history as
        // Bundles of "text" keys. It is deliberately not walked: the flattened
        // fields above already cover the cases that matter, and parsing it would
        // mean guessing per-ROM Bundle shapes.

        return sb.toString();
    }
}
