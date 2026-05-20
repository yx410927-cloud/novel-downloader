# 📚 小说下载器

一个具有白色毛玻璃UI风格的番茄小说下载器。

## 📱 安装方式

### 方式一：GitHub Actions 自动构建（推荐，无需电脑）

1. **Fork 本项目到你的 GitHub 账号**
   - 点击右上角 `Fork` 按钮

2. **启用 GitHub Actions**
   - 进入你 Fork 的仓库
   - 点击 `Actions` 标签
   - 如果提示启用，点击 `I understand my workflows, go ahead and enable them`

3. **触发构建**
   - 点击 `Build Android APK` workflow
   - 点击右侧 `Run workflow` 按钮
   - 点击绿色 `Run workflow` 按钮

4. **下载 APK**
   - 等待构建完成（约 5-10 分钟）
   - 构建完成后，点击完成的 workflow
   - 在 `Artifacts` 区域下载 `novel-downloader-apk`
   - 解压得到 `app-debug.apk`

5. **安装到手机**
   - 将 APK 传到 Android 手机
   - 打开 APK 文件
   - 允许「安装未知来源应用」
   - 完成安装

### 方式二：本地构建

```bash
# 1. 安装依赖
npm install

# 2. 构建 Web 资源
npm run build

# 3. 同步到 Android 项目
npx cap sync android

# 4. 构建 APK
cd android
./gradlew assembleDebug

# APK 位于: android/app/build/outputs/apk/debug/app-debug.apk
```

## ✨ 功能特性

- 🔍 **搜索小说** - 支持按书名、作者搜索
- 📚 **批量下载** - 选择章节批量下载
- 🎨 **毛玻璃UI** - 白色半透明毛玻璃效果
- 📱 **PWA 支持** - 可添加到手机主屏幕

## 🛠️ 技术栈

- **前端**: React + TypeScript + Vite
- **UI**: CSS Glassmorphism
- **移动端**: Capacitor (Android)
- **图标**: Lucide React

## 📋 环境要求

### 本地构建需要：
- Node.js 18+
- JDK 17+
- Android SDK (API 34)

---

MIT License
