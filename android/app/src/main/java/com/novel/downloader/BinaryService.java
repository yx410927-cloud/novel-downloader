package com.novel.downloader;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;

public class BinaryService extends Service {
    private static final String TAG = "BinaryService";
    private static final String CHANNEL_ID = "novel_downloader";
    private static final int NOTIFICATION_ID = 1;
    // 二进制文件默认端口是 18423
    public static final String WEB_URL = "http://127.0.0.1:18423";
    
    private Process binaryProcess;
    private PowerManager.WakeLock wakeLock;
    private Thread monitorThread;
    
    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        acquireWakeLock();
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, buildNotification("正在启动服务..."));
        
        if (binaryProcess == null) {
            startBinary();
        }
        
        return START_STICKY;
    }
    
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        releaseWakeLock();
        stopBinary();
    }
    
    private void startBinary() {
        new Thread(() -> {
            try {
                File workDir = new File(getFilesDir(), "novel_data");
                workDir.mkdirs();
                
                // 1. 复制二进制文件
                File binaryFile = new File(workDir, "fqjxzq");
                if (!binaryFile.exists()) {
                    copyBinaryFromAssets(binaryFile);
                }
                binaryFile.setExecutable(true, false);
                binaryFile.setReadable(true, false);
                
                // 2. 创建默认 config.yml（如果不存在）
                File configFile = new File(workDir, "config.yml");
                if (!configFile.exists()) {
                    createDefaultConfig(configFile);
                }
                
                // 3. 创建下载输出目录
                new File(workDir, "output").mkdirs();
                new File(workDir, "downloads").mkdirs();
                
                // 创建公共 Download 目录（config.yml 的 save_path）
                File publicDownloadDir = new File("/storage/emulated/0/Download/番茄小说");
                if (!publicDownloadDir.exists()) {
                    publicDownloadDir.mkdirs();
                    Log.i(TAG, "Created public download dir: " + publicDownloadDir.getAbsolutePath());
                }
                
                // 4. 启动二进制文件
                ProcessBuilder pb = new ProcessBuilder(binaryFile.getAbsolutePath());
                pb.directory(workDir);
                
                // 设置环境变量
                pb.environment().put("HOME", workDir.getAbsolutePath());
                pb.environment().put("TOMATO_WEB_ADDR", "127.0.0.1:18423");
                
                // 清理可能干扰的环境变量
                pb.environment().remove("http_proxy");
                pb.environment().remove("https_proxy");
                pb.environment().remove("HTTP_PROXY");
                pb.environment().remove("HTTPS_PROXY");
                
                pb.redirectErrorStream(true);
                
                Log.i(TAG, "=== Starting binary ===");
                Log.i(TAG, "Binary path: " + binaryFile.getAbsolutePath());
                Log.i(TAG, "Work dir: " + workDir.getAbsolutePath());
                Log.i(TAG, "Config: " + configFile.getAbsolutePath());
                
                binaryProcess = pb.start();
                
                // 读取全部输出并记录日志
                BufferedReader reader = new BufferedReader(
                    new InputStreamReader(binaryProcess.getInputStream()));
                String line;
                StringBuilder outputLog = new StringBuilder();
                while ((line = reader.readLine()) != null) {
                    Log.d(TAG, "BIN: " + line);
                    outputLog.append(line).append("\n");
                    
                    // 检测服务启动成功
                    if (line.contains("listening") || line.contains("Web UI") 
                        || line.contains("started") || line.contains("18423")) {
                        Log.i(TAG, "=== Service detected as ready ===");
                        notifyServiceReady();
                    }
                }
                
                // 进程退出
                int exitCode = binaryProcess.exitValue();
                Log.w(TAG, "Binary exited with code: " + exitCode);
                Log.w(TAG, "Last output:\n" + outputLog.toString());
                
            } catch (Exception e) {
                Log.e(TAG, "Failed to start binary", e);
            }
        }).start();
        
        // 启动就绪检测线程
        startReadyCheckThread();
        startMonitorThread();
    }
    
    private void createDefaultConfig(File configFile) throws IOException {
        String defaultConfig = "# 番茄小说下载器配置\n" +
            "novel_format: txt\n" +
            "jpeg_quality: 80\n" +
            "first_line_indent_em: 2\n" +
            "max_workers: 4\n" +
            "request_timeout: 30\n" +
            "min_wait_time: 500\n" +
            "max_wait_time: 2000\n" +
            "min_connect_timeout: 5\n" +
            "media_download_workers: 2\n" +
            "segment_comments_top_n: 5\n" +
            "segment_comments_workers: 2\n" +
            "preferred_book_name_field: book_name\n" +
            "save_path: /storage/emulated/0/Download/番茄小说\n" +
            "allow_overwrite_files: true\n";
        
        FileOutputStream fos = new FileOutputStream(configFile);
        fos.write(defaultConfig.getBytes());
        fos.close();
        Log.i(TAG, "Created default config.yml");
    }
    
    private void startReadyCheckThread() {
        new Thread(() -> {
            for (int i = 0; i < 60; i++) { // 最多等3分钟
                try {
                    Thread.sleep(3000);
                    if (isHttpServerRunning()) {
                        Log.i(TAG, "=== HTTP server confirmed ready ===");
                        notifyServiceReady();
                        updateNotification("服务运行中 - " + WEB_URL);
                        return;
                    }
                    if (i % 5 == 4) {
                        Log.d(TAG, "Waiting for server... (" + ((i+1)*3) + "s)");
                        updateNotification("正在启动服务... (" + ((i+1)*3) + "s)");
                    }
                } catch (InterruptedException e) {
                    return;
                }
            }
            Log.w(TAG, "HTTP server did not start in time");
            updateNotification("服务启动失败，请重试");
        }).start();
    }
    
    private boolean isHttpServerRunning() {
        try {
            URL url = new URL(WEB_URL + "/api/status");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(2000);
            conn.setReadTimeout(2000);
            conn.setRequestMethod("GET");
            int code = conn.getResponseCode();
            conn.disconnect();
            return code == 200;
        } catch (Exception e) {
            return false;
        }
    }
    
    private void notifyServiceReady() {
        Intent intent = new Intent("BINARY_SERVICE_READY");
        intent.putExtra("url", WEB_URL);
        sendBroadcast(intent);
    }
    
    private void copyBinaryFromAssets(File destFile) throws IOException {
        InputStream is = getAssets().open("tomato_downloader");
        FileOutputStream os = new FileOutputStream(destFile);
        byte[] buffer = new byte[8192];
        int len;
        while ((len = is.read(buffer)) != -1) {
            os.write(buffer, 0, len);
        }
        os.close();
        is.close();
        Log.i(TAG, "Binary copied, size: " + destFile.length() + " bytes");
    }
    
    private void startMonitorThread() {
        monitorThread = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    Thread.sleep(10000);
                    if (binaryProcess != null) {
                        try {
                            binaryProcess.exitValue();
                            Log.w(TAG, "Binary process exited, restarting...");
                            binaryProcess = null;
                            startBinary();
                            break;
                        } catch (IllegalThreadStateException e) {
                            // Process still running
                        }
                    }
                } catch (InterruptedException e) {
                    break;
                }
            }
        });
        monitorThread.start();
    }
    
    private void stopBinary() {
        if (monitorThread != null) {
            monitorThread.interrupt();
        }
        if (binaryProcess != null) {
            binaryProcess.destroy();
            try {
                binaryProcess.waitFor(5, java.util.concurrent.TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                binaryProcess.destroyForcibly();
            }
            binaryProcess = null;
        }
    }
    
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "小说下载器", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("保持番茄小说下载服务运行");
            NotificationManager nm = getSystemService(NotificationManager.class);
            nm.createNotificationChannel(channel);
        }
    }
    
    private Notification buildNotification(String text) {
        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_IMMUTABLE);
        
        return new Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("番茄小说下载器")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(pi)
            .setOngoing(true)
            .build();
    }
    
    private void updateNotification(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        nm.notify(NOTIFICATION_ID, buildNotification(text));
    }
    
    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, TAG);
        wakeLock.acquire(10 * 60 * 1000L); // 10分钟超时
    }
    
    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
    }
}