package com.novel.downloader;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.DownloadListener;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MainActivity";
    private static final String API_BASE = "http://127.0.0.1:18423";

    private WebView webView;
    private ProgressBar progressBar;
    private View loadingView;
    private TextView loadingText;
    private BroadcastReceiver readyReceiver;
    private boolean serviceReady = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 沉浸式状态栏
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        } else {
            getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);
        }

        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        progressBar = findViewById(R.id.progress_bar);
        loadingView = findViewById(R.id.loading_view);
        loadingText = findViewById(R.id.loading_text);

        setupWebView();
        registerReadyReceiver();
        requestNotificationsPermission();
        startBinaryService();

        // 加载本地毛玻璃 UI（搜索/下载/书架/阅读器/设置/配置全功能）
        webView.postDelayed(() -> {
            showLoading(false);
            webView.loadUrl("file:///android_asset/index.html");
        }, 500);
    }
    
    private void requestNotificationsPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) 
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, 
                    new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 
                    1001);
            }
        }
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setUserAgentString(
            "Mozilla/5.0 (Linux; Android) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36");

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                try {
                    // 使用系统下载管理器处理文件下载
                    android.app.DownloadManager.Request request = new android.app.DownloadManager.Request(android.net.Uri.parse(url));
                    request.setMimeType(mimeType);
                    request.addRequestHeader("User-Agent", userAgent);
                    request.setDescription("正在下载文件...");
                    
                    String fileName = android.webkit.URLUtil.guessFileName(url, contentDisposition, mimeType);
                    request.setTitle(fileName);
                    request.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    
                    // 根据Android版本选择最佳存储策略
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        // Android 10+: 直接写入公共 Download/番茄小说 目录
                        request.setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS, "番茄小说/" + fileName);
                    } else {
                        // Android 9及以下：使用公共下载目录
                        request.setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS, "番茄小说/" + fileName);
                    }
                    
                    request.setAllowedNetworkTypes(android.app.DownloadManager.Request.NETWORK_WIFI | android.app.DownloadManager.Request.NETWORK_MOBILE);
                    
                    android.app.DownloadManager dm = (android.app.DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    if (dm != null) {
                        long downloadId = dm.enqueue(request);
                        Log.d(TAG, "Download started with ID: " + downloadId);
                        
                        // 显示Toast提示用户
                        android.widget.Toast.makeText(MainActivity.this, 
                            "开始下载: " + fileName, 
                            android.widget.Toast.LENGTH_SHORT).show();
                    } else {
                        Log.e(TAG, "DownloadManager not available");
                        showErrorToast("下载服务不可用");
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Download failed", e);
                    showErrorToast("下载失败: " + e.getMessage());
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // 本地文件和 API 请求正常加载
                if (url.startsWith("file:///") || url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost")) {
                    return false;
                }
                // 外部链接也在 WebView 中打开
                view.loadUrl(url);
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // 本地页面加载完成后隐藏 loading
                if (url.startsWith("file:///")) {
                    showLoading(false);
                }
            }

            @Override
            public void onReceivedError(WebView view, int errorCode,
                                        String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
            }
        });
    }

    private void registerReadyReceiver() {
        readyReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if ("BINARY_SERVICE_READY".equals(intent.getAction())) {
                    serviceReady = true;
                }
            }
        };
        IntentFilter filter = new IntentFilter("BINARY_SERVICE_READY");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(readyReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(readyReceiver, filter);
        }
    }

    private void startBinaryService() {
        Intent serviceIntent = new Intent(this, BinaryService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    private void showLoading(boolean show) {
        if (show) {
            loadingView.setVisibility(View.VISIBLE);
            progressBar.setVisibility(View.VISIBLE);
            webView.setVisibility(View.GONE);
        } else {
            loadingView.setVisibility(View.GONE);
            progressBar.setVisibility(View.GONE);
            webView.setVisibility(View.VISIBLE);
        }
    }
    
    private void showErrorToast(String message) {
        android.widget.Toast.makeText(this, message, android.widget.Toast.LENGTH_LONG).show();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (readyReceiver != null) {
            try {
                unregisterReceiver(readyReceiver);
            } catch (Exception ignored) {}
        }
    }
}