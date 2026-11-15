package com.akw.workspace;

import android.app.DownloadManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.net.Uri;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import org.json.JSONObject;

@CapacitorPlugin(name = "WorkspaceBridge")
public class WorkspaceBridge extends Plugin {
    private SQLiteOpenHelper cache;
    private static final int RESPONSE_LIMIT = 16 * 1024 * 1024;

    @Override public void load() {
        cache = new SQLiteOpenHelper(getContext(), "akw-local.db", null, 1) {
            @Override public void onCreate(SQLiteDatabase db) {
                db.execSQL("CREATE TABLE records (scope TEXT NOT NULL, record_key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(scope, record_key))");
            }
            @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {}
        };
        cache.setWriteAheadLoggingEnabled(true);
    }

    private URI endpoint(String value) {
        if (value == null || !value.startsWith("/v1/") || value.contains("\\")) throw new IllegalArgumentException();
        URI relative = URI.create(value);
        if (relative.isAbsolute() || relative.getRawAuthority() != null || relative.getRawFragment() != null ||
            !relative.normalize().equals(relative) || !relative.getPath().matches("/v1/[a-zA-Z0-9/_-]+")) throw new IllegalArgumentException();
        URI origin = URI.create(BuildConfig.AKW_API_ORIGIN);
        boolean loopback = BuildConfig.DEBUG && "http".equals(origin.getScheme()) && "127.0.0.1".equals(origin.getHost());
        if (origin.getHost() == null || origin.getUserInfo() != null || (!loopback && !"https".equals(origin.getScheme()))) throw new IllegalStateException();
        return origin.resolve(relative);
    }

    @PluginMethod public void request(PluginCall call) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) endpoint(call.getString("path")).toURL().openConnection();
            String method = call.getString("method", "GET");
            if (!method.matches("GET|POST|PATCH")) throw new IllegalArgumentException();
            connection.setRequestMethod(method);
            connection.setInstanceFollowRedirects(false);
            connection.setUseCaches(false);
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(15000);
            String key = call.getString("key");
            if (key != null && key.matches("[a-zA-Z0-9._:-]{1,128}")) connection.setRequestProperty("Idempotency-Key", key);
            String body = call.getString("body");
            if (body != null) {
                byte[] payload = body.getBytes(StandardCharsets.UTF_8);
                if (payload.length > 12 * 1024 * 1024) throw new IllegalArgumentException();
                connection.setDoOutput(true);
                connection.setFixedLengthStreamingMode(payload.length);
                connection.setRequestProperty("Content-Type", "application/json");
                try (var stream = connection.getOutputStream()) { stream.write(payload); }
            }
            int status = connection.getResponseCode();
            try (InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream()) {
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                if (stream != null) {
                    byte[] buffer = new byte[8192];
                    for (int size; (size = stream.read(buffer)) != -1;) {
                        if (bytes.size() + size > RESPONSE_LIMIT) throw new IllegalArgumentException();
                        bytes.write(buffer, 0, size);
                    }
                }
                call.resolve(new JSObject().put("status", status).put("body", bytes.toString("UTF-8")));
            }
        } catch (Exception error) {
            call.reject("无法连接工作台服务。请检查本机 API 和 Android 调试连接。");
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private String scope(PluginCall call) {
        String scope = call.getString("store", "");
        if (!scope.equals("documents") && !scope.equals("metadata")) throw new IllegalArgumentException();
        return scope;
    }

    private String key(PluginCall call) {
        String key = call.getString("key", "");
        if (key.isEmpty() || key.length() > 300) throw new IllegalArgumentException();
        return key;
    }

    private String value(SQLiteDatabase db, String scope, String key) {
        try (Cursor row = db.rawQuery("SELECT value FROM records WHERE scope=? AND record_key=?", new String[]{scope, key})) {
            return row.moveToFirst() ? row.getString(0) : null;
        }
    }

    @PluginMethod public void read(PluginCall call) {
        try {
            String value = value(cache.getReadableDatabase(), scope(call), key(call));
            call.resolve(new JSObject().put("value", value == null ? JSONObject.NULL : value));
        } catch (Exception error) { call.reject("读取本地草稿失败。"); }
    }

    @PluginMethod public void list(PluginCall call) {
        try (Cursor rows = cache.getReadableDatabase().rawQuery("SELECT value FROM records WHERE scope=?", new String[]{scope(call)})) {
            JSArray values = new JSArray();
            while (rows.moveToNext()) values.put(rows.getString(0));
            call.resolve(new JSObject().put("values", values));
        } catch (Exception error) { call.reject("读取本地列表失败。"); }
    }

    @PluginMethod public void compareExchange(PluginCall call) {
        try {
            SQLiteDatabase db = cache.getWritableDatabase();
            String scope = scope(call);
            String key = key(call);
            boolean changed = false;
            db.beginTransaction();
            try {
                if (Objects.equals(value(db, scope, key), call.getString("expected"))) {
                    ContentValues row = new ContentValues();
                    row.put("scope", scope);
                    row.put("record_key", key);
                    row.put("value", call.getString("value"));
                    db.replaceOrThrow("records", null, row);
                    changed = true;
                }
                db.setTransactionSuccessful();
            } finally { db.endTransaction(); }
            call.resolve(new JSObject().put("changed", changed));
        } catch (Exception error) { call.reject("保存本地草稿失败。"); }
    }

    @PluginMethod public void readClipboard(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            ClipboardManager clipboard = getContext().getSystemService(ClipboardManager.class);
            ClipData clip = clipboard.getPrimaryClip();
            call.resolve(new JSObject().put("value", clip == null ? "" : clip.getItemAt(0).coerceToText(getContext()).toString()));
        });
    }

    @PluginMethod public void writeClipboard(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            ClipboardManager clipboard = getContext().getSystemService(ClipboardManager.class);
            clipboard.setPrimaryClip(ClipData.newPlainText("AI Knowledge Workspace", call.getString("value", "")));
            call.resolve();
        });
    }

    @PluginMethod public void openExternal(PluginCall call) {
        try {
            Uri uri = Uri.parse(call.getString("url", ""));
            if ((!Objects.equals(uri.getScheme(), "https") && !Objects.equals(uri.getScheme(), "http")) || uri.getHost() == null) throw new IllegalArgumentException();
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri));
            call.resolve();
        } catch (Exception error) { call.reject("无法打开链接。"); }
    }

    @PluginMethod public void download(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT < 29) throw new IllegalStateException();
            URI uri = endpoint(call.getString("path"));
            DownloadManager manager = getContext().getSystemService(DownloadManager.class);
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(uri.toString()));
            request.setTitle("AI Knowledge Workspace");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            manager.enqueue(request);
            call.resolve();
        } catch (Exception error) { call.reject("无法启动下载。当前调试版要求 Android 10 或更新版本。"); }
    }
}
