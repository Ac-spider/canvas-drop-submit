# Canvas Drop Submit - Windows 打包问题记录

## 推荐打包流程（已验证）

### 前置条件

确保 package.json 中包含以下配置：

```json
{
  "build": {
    "win": {
      "signAndEditExecutable": false,
      "target": [
        {
          "target": "dir",
          "arch": ["x64"]
        }
      ]
    }
  }
}
```

> **关键配置**: `signAndEditExecutable: false` 禁用代码签名，避免 winCodeSign 符号链接权限问题。

### 打包步骤

#### 步骤 1：构建应用

```bash
npm run build
```

此命令执行：
1. `npm run typecheck` - TypeScript 类型检查
2. `electron-vite build` - 构建主进程、预加载脚本和渲染进程

输出目录：`out/`
- `out/main/index.js` - 主进程代码
- `out/preload/index.js` - 预加载脚本
- `out/renderer/` - 渲染进程代码

#### 步骤 2：打包 Windows 应用

```bash
npx electron-builder --win
```

或使用本地版本：

```bash
node_modules/.bin/electron-builder --win
```

输出目录：`dist/win-unpacked/`

#### 步骤 3：验证打包结果

```bash
ls dist/win-unpacked/
# 应包含：
# - Canvas Drop Submit.exe  (主程序)
# - resources/app.asar      (应用代码)
# - 各种 DLL 和资源文件
```

### 完整一键打包命令

```bash
npm run build && npx electron-builder --win
```

---

## 常见问题

### 问题 1：winCodeSign 符号链接权限错误

**错误信息：**
```
ERROR: Cannot create symbolic link : 客户端没有所需的特权 :
  C:\Users\...\electron-builder\Cache\winCodeSign\xxx\darwin\10.12\lib\libcrypto.dylib
```

**解决方案：**
已在 package.json 中添加 `"signAndEditExecutable": false`，完全跳过代码签名步骤。

### 问题 2：无法下载 electron-builder 二进制文件

**错误信息：**
```
Get "https://github.com/...": dial tcp ...: connectex: A connection attempt failed
```

**解决方案：**
设置代理环境变量：
```bash
set HTTP_PROXY=http://127.0.0.1:7890
set HTTPS_PROXY=http://127.0.0.1:7890
```

### 问题 3：CSP 限制导致 API 请求失败

**错误信息：**
```
Refused to connect to 'https://oc.sjtu.edu.cn/api/v1/courses'
because it violates the following Content Security Policy directive
```

**解决方案：**
修改 `src/renderer/index.html` 中的 CSP 配置：
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https:;" />
```
`connect-src 'self' https:` 允许连接到任何 HTTPS 域名。

---

## 打包输出说明

### 目录结构

```
dist/
└── win-unpacked/                  ← 解压即用的应用程序
    ├── Canvas Drop Submit.exe     ← 主程序（双击运行）
    ├── resources/
    │   └── app.asar              ← 应用代码和资源
    ├── *.dll                      ← 系统依赖库
    └── locales/                   ← 语言文件
```

### 与安装版区别

| 特性 | dir 目标 (当前) | portable 目标 |
|------|----------------|---------------|
| 输出形式 | 文件夹 | 单个 exe |
| 需要 NSIS | 否 | 是 |
| 需要签名 | 否 | 是 |
| 使用方式 | 解压后运行 | 双击运行 |
| 适合场景 | 开发测试、个人使用 | 分发给他人 |

---

## 发布建议

### 个人使用

直接使用 `dist/win-unpacked/Canvas Drop Submit.exe`。

### 分发给他人

将 `dist/win-unpacked/` 文件夹压缩为 zip：
```bash
cd dist && zip -r "Canvas Drop Submit.zip" win-unpacked/
```

用户解压后运行 `Canvas Drop Submit.exe` 即可。

### 处理 Windows 安全警告

首次运行时可能显示：
```
Windows 已保护你的电脑
Microsoft Defender SmartScreen 阻止了无法识别的应用启动。
```

点击"更多信息" → "仍要运行"即可。

---

## 相关文件位置

- **源代码**: `src/renderer/index.html` (CSP 配置)
- **构建配置**: `package.json` (build 字段)
- **构建输出**: `out/`
- **打包输出**: `dist/win-unpacked/`
- **缓存目录**: `%LOCALAPPDATA%\electron-builder\Cache\`

---

## 历史问题（已解决）

### 之前的尝试（不推荐）

以下方法**不再需要使用**，仅作记录：

1. ~~以管理员身份运行~~ - 不需要，已禁用签名
2. ~~启用 Windows 开发者模式~~ - 不需要，已禁用签名
3. ~~使用 electron-packager~~ - 不需要，electron-builder 已可用
4. ~~手动解压 winCodeSign~~ - 不需要，已禁用签名

---

## 参考链接

- [electron-builder 文档](https://www.electron.build/)
- [electron-builder Windows 配置](https://www.electron.build/configuration/win)
- [Electron CSP 文档](https://www.electronjs.org/docs/latest/tutorial/security#content-security-policy)
