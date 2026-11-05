package com.kateb.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.kateb.app.plugins.CafeBazaarBillingPlugin;
import com.kateb.app.plugins.DownloadsPlugin;
import com.kateb.app.plugins.OtpAutofillPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // UPDATE FIX: an APK update replaces the bundled web assets, but the
        // WebView's HTTP cache can keep serving the OLD index.html/JS on first
        // launch — the user then has to "clear cache / clear data" to see the
        // new version. So once per versionCode: wipe WebView + app caches.
        // The JS layer (appUpdate.ts) does the same for CacheStorage; this
        // covers the native HTTP cache it cannot reach.
        try {
            long vc = getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
            android.content.SharedPreferences prefs =
                getSharedPreferences("kateb_update", MODE_PRIVATE);
            long last = prefs.getLong("last_version_code", -1);
            if (last != vc) {
                // NOTE: never clear cookies / localStorage here — that would
                // log the user out (equivalent of "clear data"). Only the
                // HTTP/WebView cache is stale after an update.
                try {
                    android.webkit.WebView wv = new android.webkit.WebView(getApplicationContext());
                    wv.clearCache(true);
                    wv.destroy();
                } catch (Exception ignored) {}
                deleteDatabase("webview.db");
                deleteDatabase("webviewCache.db");
                try {
                    java.io.File webviewCache = new java.io.File(getCacheDir(), "WebView");
                    deleteRecursive(webviewCache);
                } catch (Exception ignored) {}
                prefs.edit().putLong("last_version_code", vc).apply();
            }
        } catch (Exception ignored) {}

        // FIX (pay): registerPlugin() only appends to BridgeActivity.bridgeBuilder,
        // and that builder is consumed inside super.onCreate() ->
        // load() -> bridgeBuilder.create(). Registering AFTER super.onCreate()
        // therefore never reaches the live Bridge, and the web layer gets
        // "CafeBazaarBilling plugin is not implemented on android" -> the
        // checkout falls back to "کافه‌بازار روی این دستگاه نصب یا در دسترس نیست".
        // The same rule applies to DownloadsPlugin and SmsAutofillPlugin: they must
        // be registered before super.onCreate() or the web layer gets
        // "X plugin is not implemented on android" back — the PDF export falls back
        // to the share sheet, and OTP autofill silently never fills anything in.
        registerPlugin(CafeBazaarBillingPlugin.class);
        registerPlugin(DownloadsPlugin.class);
        registerPlugin(OtpAutofillPlugin.class);
        super.onCreate(savedInstanceState);
    }

    private static void deleteRecursive(java.io.File f) {
        if (f == null || !f.exists()) return;
        if (f.isDirectory()) {
            java.io.File[] children = f.listFiles();
            if (children != null) {
                for (java.io.File c : children) deleteRecursive(c);
            }
        }
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }
}
