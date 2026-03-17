# Canvas Drop Submit - 问题排查与解决方案

## 概述

本文档记录了 Canvas Drop Submit 应用开发过程中遇到的关键问题及其解决方案，供后续开发和维护参考。

---

## 问题 1: 拖拽文件时 `window.electronAPI` 未定义

### 问题描述

用户在作业提交入口拖拽文件时遇到错误：
```
DropZone.tsx:145 Error getting file path: Error: Cannot read properties of undefined (reading 'getPathForFile')
```

### 根本原因

1. **预加载脚本中 `webUtils` 不可用**: `webUtils` 是 Electron 28+ 提供的 API，但在预加载脚本中通过 `require('electron')` 获取的模块不包含 `webUtils`
2. **开发模式时序问题**: 在开发模式下（使用 Vite HMR），页面重新加载时可能导致 `window.electronAPI` 暂时不可用

### 诊断过程

1. 首先尝试在预加载脚本中使用 `import * as electron from 'electron'` 然后访问 `(electron as any).webUtils`，失败
2. 尝试使用 `require('electron')` 动态获取，仍然失败
3. 打印 `electronModule` 的所有键，发现只有 `['contextBridge', 'crashReporter', 'ipcRenderer', 'nativeImage', 'webFrame']`，没有 `webUtils`

### 解决方案

**直接使用 File 对象的 `path` 属性**

在 Electron 中，当用户从文件系统拖拽文件到应用窗口时，File 对象会自动包含 `path` 属性：

```typescript
// DropZone.tsx
Array.from(fileList).forEach((file) => {
  // 在 Electron 中，拖拽的 File 对象会自动包含 path 属性
  const filePath = (file as File & { path?: string }).path || '';

  if (!filePath) {
    console.error('File path is empty for:', file.name);
    setError(`无法获取文件路径: ${file.name}`);
    return;
  }

  newFiles.push({
    name: file.name,
    size: file.size,
    path: filePath,
  });
});
```

### 经验教训

- `webUtils.getPathForFile()` 是 Electron 官方推荐的获取文件路径的方法，但需要在渲染进程中通过 `contextBridge` 暴露
- 在预加载脚本中无法直接访问 `webUtils`
- 对于拖拽文件场景，File 对象的 `path` 属性是可靠的替代方案

---

## 问题 2: Canvas API 返回 404 HTML 页面

### 问题描述

调用 `POST /api/v1/users/self/files` 返回 HTTP 404，返回内容是 HTML 页面（"页面未找到"），而不是 JSON 错误：

```
HTTP 404: <!DOCTYPE html> <html class="scripts-not-loaded" dir="ltr" lang="zh-Hans">...
```

### 根本原因

1. **API 端点不存在**: 上海交通大学 Canvas 实例 (`oc.sjtu.edu.cn`) 禁用了用户级别文件上传端点 `/api/v1/users/self/files`
2. **权限配置**: 学校 Canvas 管理员可能配置了自定义路由规则，禁用了用户级别文件上传，只允许课程级别上传

### 诊断过程

1. 首先检查请求 URL 和参数是否正确
2. 添加日志输出请求的 URL 和响应状态
3. 发现返回的是 HTML 404 页面而不是 JSON 错误，说明端点不存在
4. 通过 agent 研究确认 Canvas API 文档中 `users/self/files` 端点在某些实例中可能被禁用

### 解决方案

**移除用户级别上传回退逻辑**

当课程级别上传返回 401 时，不再尝试用户级别上传，而是直接显示友好的错误提示：

```typescript
// src/main/index.ts
ipcMain.handle('canvas:uploadFilePre', async (_, token: string, courseId: number, fileName: string, fileSize: number) => {
  // ...
  if (!response.ok) {
    // 特殊处理401错误 - 用户没有课程文件上传权限
    if (response.status === 401) {
      console.log('Course file upload returned 401, user does not have permission');
      return {
        success: false,
        error: '您没有该课程的文件上传权限。请检查：1) API Token 是否有效；2) 您是否已注册该课程；3) 课程是否允许文件上传。',
        status: 401,
      };
    }
    // ...
  }
});
```

同时移除前端 fallback 逻辑：

```typescript
// DropZone.tsx (移除以下代码)
// 如果课程文件上传无权限，尝试用户级别上传
if (!preResponse.success && preResponse.fallbackToUserUpload) {
  console.log('Course file upload failed, trying user file upload...');
  preResponse = await window.electronAPI.uploadFilePreUser(
    _apiToken,
    uploadFileName,
    file.size
  );
}
```

### 经验教训

- 不同 Canvas 实例可能有不同的 API 端点配置
- 学校 Canvas 可能禁用某些 API 功能
- 返回 HTML 而不是 JSON 通常意味着端点不存在或权限不足
- 应该提供清晰的错误信息帮助用户排查问题

---

## 问题 3: 文件上传预请求参数传递

### 问题描述

Canvas 文件上传预请求需要正确的参数格式，否则可能返回错误。

### 解决方案

使用查询参数传递文件信息：

```typescript
const params = new URLSearchParams({
  name: fileName,
  size: fileSize.toString(),
  on_duplicate: 'rename',
});

const response = await fetch(
  `https://oc.sjtu.edu.cn/api/v1/courses/${courseId}/files?${params.toString()}`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${trimmedToken}`,
      Accept: 'application/json+canvas-string-ids',
    },
  }
);
```

### Canvas 文件上传三步流程

1. **预请求** (Step 1): 获取上传 URL 和参数
   ```
   POST /api/v1/courses/{course_id}/files?name=xxx&size=xxx&on_duplicate=rename
   ```

2. **实际上传** (Step 2): 上传到 S3/Canvas 存储
   - 不包含 `Authorization` 头
   - 使用 `FormData` 传递参数和文件
   - `file` 字段必须是最后一个参数

3. **确认上传** (Step 3): 确认文件上传完成
   ```
   GET /api/v1/files/{file_id}/status
   ```

---

## 问题 4: TypeScript 类型定义冲突

### 问题描述

在预加载脚本中，TypeScript 无法识别 `webUtils` 类型。

### 解决方案

使用类型断言：

```typescript
// 在预加载脚本中获取 webUtils
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const electronModule = require('electron') as any;
const webUtils = electronModule.webUtils;
```

或者直接在渲染进程中使用 File 对象的 path 属性（推荐）。

---

## 通用调试技巧

### 1. 检查 Electron 模块可用性

```typescript
const electronModule = require('electron') as any;
console.log('electronModule keys:', Object.keys(electronModule));
```

### 2. 检查 File 对象属性

```typescript
console.log('File object:', {
  name: file.name,
  size: file.size,
  path: (file as File & { path?: string }).path,
  type: file.type,
});
```

### 3. 检查 API 响应

```typescript
console.log('Response status:', response.status);
console.log('Response headers:', Object.fromEntries(response.headers.entries()));
const responseText = await response.text();
console.log('Response body:', responseText.substring(0, 500));
```

### 4. 使用 Agent 进行并行研究

对于复杂问题，可以启动多个 agent 并行研究：
- 一个研究 Canvas API 文档
- 一个研究 Electron 最佳实践
- 一个研究错误排查方法

---

## 参考资源

- [Canvas LMS REST API Documentation](https://canvas.instructure.com/doc/api/)
- [Electron webUtils API](https://www.electronjs.org/docs/latest/api/web-utils)
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [File Uploads | Instructure Developer Documentation](https://developerdocs.instructure.com/services/canvas/basics/file.file_uploads)

---

## 更新日志

### 2026-03-17
- 修复 `DropZone.tsx` 文件路径获取问题
- 移除用户级别文件上传回退逻辑
- 添加友好的错误提示信息
- 创建本文档
