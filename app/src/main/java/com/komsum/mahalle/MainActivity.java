package com.komsum.mahalle;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 1101;
    private static final int EXPORT_JSON_REQUEST = 1102;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private Uri pendingCameraUri;
    private String pendingExportJson;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(247, 248, 245));
        getWindow().setNavigationBarColor(Color.rgb(247, 248, 245));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return openExternalIfNeeded(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return openExternalIfNeeded(Uri.parse(url));
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView,
                                             ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;

                Intent fileIntent;
                try {
                    fileIntent = params.createIntent();
                } catch (Exception ex) {
                    fileIntent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    fileIntent.addCategory(Intent.CATEGORY_OPENABLE);
                    fileIntent.setType("*/*");
                }

                Intent cameraIntent = null;
                if (acceptsImages(params.getAcceptTypes())) {
                    pendingCameraUri = createCameraUri();
                    if (pendingCameraUri != null) {
                        cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                        cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, pendingCameraUri);
                        cameraIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    }
                }

                try {
                    if (params.isCaptureEnabled() && cameraIntent != null) {
                        startActivityForResult(cameraIntent, FILE_CHOOSER_REQUEST);
                    } else {
                        Intent chooser = new Intent(Intent.ACTION_CHOOSER);
                        chooser.putExtra(Intent.EXTRA_INTENT, fileIntent);
                        chooser.putExtra(Intent.EXTRA_TITLE, "Dosya veya fotoğraf seç");
                        if (cameraIntent != null) {
                            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
                        }
                        startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
                    }
                    return true;
                } catch (Exception ex) {
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this, "Dosya seçici açılamadı.", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl("file:///android_asset/index.html");
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private boolean openExternalIfNeeded(Uri uri) {
        String scheme = uri.getScheme();
        if (scheme == null || scheme.equals("file") || scheme.equals("about")) return false;

        try {
            if (scheme.equals("tel")) {
                startActivity(new Intent(Intent.ACTION_DIAL, uri));
                return true;
            }
            if (scheme.equals("mailto") || scheme.equals("http") || scheme.equals("https")) {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
                return true;
            }
        } catch (Exception ignored) { }
        return false;
    }

    private boolean acceptsImages(String[] acceptTypes) {
        if (acceptTypes == null || acceptTypes.length == 0) return false;
        for (String type : acceptTypes) {
            if (type != null && type.toLowerCase(Locale.ROOT).contains("image")) return true;
        }
        return false;
    }

    private Uri createCameraUri() {
        try {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, "Komsum_" + System.currentTimeMillis() + ".jpg");
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
            values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Komsum");
            return getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        } catch (Exception ex) {
            return null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (filePathCallback == null) return;

            Uri[] result = null;
            if (resultCode == RESULT_OK) {
                if (data != null && data.getData() != null) {
                    result = new Uri[]{data.getData()};
                } else if (pendingCameraUri != null) {
                    result = new Uri[]{pendingCameraUri};
                }
            } else if (pendingCameraUri != null) {
                try { getContentResolver().delete(pendingCameraUri, null, null); } catch (Exception ignored) { }
            }

            filePathCallback.onReceiveValue(result);
            filePathCallback = null;
            pendingCameraUri = null;
            return;
        }

        if (requestCode == EXPORT_JSON_REQUEST) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingExportJson != null) {
                try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
                    if (output != null) {
                        output.write(pendingExportJson.getBytes(StandardCharsets.UTF_8));
                        Toast.makeText(this, "Yedek kaydedildi.", Toast.LENGTH_SHORT).show();
                    }
                } catch (Exception ex) {
                    Toast.makeText(this, "Yedek kaydedilemedi.", Toast.LENGTH_SHORT).show();
                }
            }
            pendingExportJson = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidBridge");
            webView.destroy();
        }
        super.onDestroy();
    }

    private class AndroidBridge {
        @JavascriptInterface
        public void exportJson(String json, String filename) {
            runOnUiThread(() -> {
                pendingExportJson = json;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, filename == null || filename.isEmpty() ? "komsum-yedek.json" : filename);
                try {
                    startActivityForResult(intent, EXPORT_JSON_REQUEST);
                } catch (Exception ex) {
                    pendingExportJson = null;
                    Toast.makeText(MainActivity.this, "Kaydetme ekranı açılamadı.", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void toast(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
        }
    }
}
