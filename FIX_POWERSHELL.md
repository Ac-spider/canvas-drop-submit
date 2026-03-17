# PowerShell 执行策略解决方案

## 问题
PowerShell 默认禁止运行脚本，导致无法执行 npm 命令。

## 解决方案（选择一种）

### 方法 1: 临时允许当前会话（推荐，最安全）
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
npm run dev
```

### 方法 2: 允许当前用户运行脚本
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
npm run dev
```

### 方法 3: 使用 CMD 代替 PowerShell
按 `Win + R`，输入 `cmd` 回车，然后在 CMD 中运行：
```cmd
cd "C:\Users\liu_j\Desktop\SJTU\AI\Vibe coding\research\canvas-drop-submit"
npm run dev
```

### 方法 4: 使用 Windows Terminal (管理员)
1. 右键点击 Windows Terminal → 以管理员身份运行
2. 运行：
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
3. 然后正常使用 `npm run dev`

## 推荐步骤

1. 打开 PowerShell
2. 运行：
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
   ```
3. 然后运行：
   ```powershell
   cd "C:\Users\liu_j\Desktop\SJTU\AI\Vibe coding\research\canvas-drop-submit"
   npm run dev
   ```

## 如果还是不行

直接使用 CMD（命令提示符）：
1. 按 `Win + R`
2. 输入 `cmd` 回车
3. 输入：
   ```cmd
   cd "C:\Users\liu_j\Desktop\SJTU\AI\Vibe coding\research\canvas-drop-submit"
   npm run dev
   ```
