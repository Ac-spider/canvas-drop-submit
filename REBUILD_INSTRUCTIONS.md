# Windows 应用重新打包说明

## 问题
当前打包的 `dist/win-unpacked/Canvas Drop Submit.exe` 使用的是旧的代码，没有包含最新的修复。

## 解决方案

### 方法 1: 在 Windows 上重新打包（推荐）

1. 将整个 `canvas-drop-submit` 文件夹复制到 Windows 电脑
2. 在 Windows 上打开 PowerShell 或 CMD
3. 进入项目目录:
   ```powershell
   cd C:\path\to\canvas-drop-submit
   ```
4. 安装依赖（如果还没有安装）:
   ```powershell
   npm install
   ```
5. 构建并打包:
   ```powershell
   npm run build:win
   ```
6. 打包后的应用将在 `dist/win-unpacked/` 目录中

### 方法 2: 使用开发模式运行

如果不想打包，可以直接在开发模式下运行:

```powershell
cd C:\path\to\canvas-drop-submit
npm run dev
```

### 方法 3: 仅替换资源文件（高级）

如果熟悉 Electron 的 asar 格式，可以手动更新 `app.asar`:

1. 安装 asar 工具:
   ```powershell
   npm install -g asar
   ```

2. 解压 app.asar:
   ```powershell
   cd dist/win-unpacked/resources
   asar extract app.asar app-extracted
   ```

3. 复制新的构建文件:
   - 将 `out/` 目录的内容复制到 `app-extracted/out/`

4. 重新打包:
   ```powershell
   asar pack app-extracted app.asar
   ```

## 修复内容

本次修复解决了以下问题:

1. **DropZone.tsx**: 修复了 `window.electronApi` → `window.electronAPI` 的拼写错误
2. **类型定义**: 移除了重复的类型声明
3. **Token 验证**: 确认验证逻辑正常工作

## 验证 Token

测试用的 Token 是有效的:
- Token: `ryU0dZnkEPMd8PsQOfRNkJAgfPXqF5yfQ3WQKPLP0lqSUpprR27OCq8oS9Xf7COp`
- 用户: 刘济瑞 (ID: 552225)
- API 状态: 正常

## 文件位置

- 源代码: `C:\Users\liu_j\Desktop\SJTU\AI\Vibe coding\research\canvas-drop-submit\`
- 打包输出: `C:\Users\liu_j\Desktop\SJTU\AI\Vibe coding\research\canvas-drop-submit\dist\win-unpacked\`
- 主程序: `Canvas Drop Submit.exe`
