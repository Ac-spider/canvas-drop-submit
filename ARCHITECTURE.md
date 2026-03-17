# Canvas Drop Submit - 架构规划文档

## 1. 项目概述

Electron + React + TypeScript 桌面应用，用于简化 Canvas 作业提交流程。

## 2. API 端点详细规范

### 2.1 获取课程列表

**端点**: `GET /api/v1/courses`

**查询参数**:
```typescript
interface GetCoursesParams {
  enrollment_state?: 'active' | 'invited_or_pending' | 'completed';
  include?: Array<'term' | 'teachers' | 'total_students' | 'course_image'>;
  per_page?: number;  // 默认10，建议50-100
  page?: number;
}
```

**关键响应字段**:
```typescript
interface Course {
  id: number;
  name: string;
  course_code: string;
  workflow_state: 'unpublished' | 'available' | 'completed' | 'deleted';
  term?: {
    id: number;
    name: string;
    start_at: string | null;
    end_at: string | null;
  };
  teachers?: Array<{
    id: number;
    display_name: string;
  }>;
}
```

**错误处理**:
- 401: Token无效或过期 → 提示重新登录
- 403: 权限不足 → 检查用户角色

---

### 2.2 获取作业列表

**端点**: `GET /api/v1/courses/:course_id/assignments`

**查询参数**:
```typescript
interface GetAssignmentsParams {
  bucket?: 'upcoming' | 'past' | 'overdue' | 'undated' | 'unsubmitted';
  include?: Array<'submission' | 'can_submit' | 'score_statistics'>;
  order_by?: 'position' | 'name' | 'due_at';
  per_page?: number;
}
```

**关键响应字段**:
```typescript
interface Assignment {
  id: number;
  name: string;
  description: string;  // HTML格式
  due_at: string | null;
  lock_at: string | null;
  unlock_at: string | null;
  published: boolean;
  submission_types: SubmissionType[];
  allowed_extensions: string[];
  points_possible: number;
  submission?: Submission;  // 当include[]=submission时
  can_submit?: boolean;     // 当include[]=can_submit时
}

type SubmissionType =
  | 'online_upload'
  | 'online_text_entry'
  | 'online_url'
  | 'media_recording'
  | 'student_annotation'
  | 'on_paper'
  | 'none';
```

**状态判断逻辑**:
```typescript
// 是否已提交
const isSubmitted = assignment.submission?.workflow_state === 'submitted';

// 是否逾期
const isOverdue = assignment.due_at && new Date(assignment.due_at) < new Date();

// 是否可提交
const canSubmit = assignment.can_submit ?? (
  !assignment.locked_for_user &&
  !assignment.submission_types.includes('none') &&
  !assignment.submission_types.includes('on_paper')
);
```

---

### 2.3 文件上传流程（三步）

#### 步骤1: 预请求

**端点**: `POST /api/v1/courses/:course_id/files`

**请求参数**:
```typescript
interface InitiateUploadParams {
  name: string;           // 文件名
  size: number;           // 文件大小（字节）
  content_type?: string;  // MIME类型
  on_duplicate?: 'overwrite' | 'rename';  // 默认: overwrite
}
```

**响应**:
```typescript
interface InitiateUploadResponse {
  upload_url: string;     // S3上传URL
  upload_params: Record<string, string>;  // S3签名参数
  id?: number;            // 文件ID（部分响应包含）
}
```

**注意**: 签名有效期 **30分钟**

#### 步骤2: S3上传

**请求**: POST到 `upload_url`

**关键规则**:
- 不要发送 Authorization header
- 必须按原样包含所有 `upload_params`
- `file` 参数必须是最后一个

#### 步骤3: 确认上传

**端点**: 从S3响应的 `Location` header 获取

**请求**: POST到确认URL，必须设置 `Content-Length: 0`

**响应**: 完整的 File 对象

```typescript
interface File {
  id: number;
  url: string;
  display_name: string;
  size: number;
  content_type: string;
}
```

---

### 2.4 提交作业

**端点**: `POST /api/v1/courses/:course_id/assignments/:assignment_id/submissions`

**请求参数**:
```typescript
interface CreateSubmissionParams {
  'submission[submission_type]': 'online_upload' | 'online_text_entry' | 'online_url';
  'submission[file_ids][]'?: number[];  // online_upload时使用
  'submission[body]'?: string;          // online_text_entry时使用
  'submission[url]'?: string;           // online_url时使用
  'comment[text_comment]'?: string;     // 可选评论
}
```

**响应**: Submission 对象

```typescript
interface Submission {
  id: number;
  assignment_id: number;
  attempt: number;
  submission_type: string;
  submitted_at: string;
  workflow_state: 'submitted' | 'unsubmitted' | 'graded';
  late: boolean;
  missing: boolean;
  attachments?: File[];
}
```

**错误处理**:
- 400: 参数无效或文件不存在
- 403: 无权限提交（未注册或注册已结束）
- 422: 作业配置不允许此提交类型

---

## 3. 类型定义汇总

```typescript
// src/shared/types.ts

export interface Course {
  id: number;
  name: string;
  course_code: string;
  workflow_state: string;
  term?: Term;
  teachers?: UserDisplay[];
}

export interface Term {
  id: number;
  name: string;
  start_at: string | null;
  end_at: string | null;
}

export interface UserDisplay {
  id: number;
  display_name: string;
}

export interface Assignment {
  id: number;
  name: string;
  description: string;
  due_at: string | null;
  lock_at: string | null;
  unlock_at: string | null;
  published: boolean;
  submission_types: string[];
  allowed_extensions: string[];
  points_possible: number;
  submission?: Submission;
  can_submit?: boolean;
  locked_for_user?: boolean;
  html_url: string;
}

export interface Submission {
  id: number;
  assignment_id: number;
  attempt: number;
  submission_type: string;
  submitted_at: string;
  workflow_state: string;
  late: boolean;
  missing: boolean;
  attachments?: File[];
}

export interface File {
  id: number;
  url: string;
  display_name: string;
  size: number;
  content_type: string;
}

export interface CanvasError {
  errors: Array<{ message: string }> | Record<string, any>;
}
```

---

## 4. 开发任务流

### Phase 1: 基础架构 ✅
1. [x] 初始化 Electron + React + TypeScript 项目
2. [x] 配置 electron-vite 和 electron-builder
3. [x] 配置 Tailwind CSS
4. [x] 设置 electron-store 用于加密存储

### Phase 2: Electron 主进程 ✅
1. [x] 创建主进程入口 `src/main/index.ts`
2. [x] 创建预加载脚本 `src/main/preload.ts`
3. [x] 暴露安全API: `canvasAPI`, `storeAPI`

### Phase 3: Canvas API 封装 ✅
1. [x] 创建 `src/renderer/hooks/useCanvas.ts`
2. [x] 实现 `getCourses()` 方法
3. [x] 实现 `getAssignments(courseId)` 方法
4. [x] 实现 `uploadFile(courseId, file)` 三步流程
5. [x] 实现 `submitAssignment(courseId, assignmentId, fileIds)` 方法

### Phase 4: UI 组件 ✅
1. [x] 创建 `Login.tsx` - API Token 输入
2. [x] 创建 `CourseList.tsx` - 课程列表
3. [x] 创建 `AssignmentList.tsx` - 作业列表
4. [x] 创建 `DropZone.tsx` - 拖拽区域

### Phase 5: 拖拽功能 ✅
1. [x] 创建 `useDragDrop.ts` hook
2. [x] 实现文件拖拽检测
3. [x] 使用 `webUtils.getPathForFile()` 获取路径
4. [x] 实现拖拽视觉反馈

### Phase 6: 集成与测试 ✅
1. [x] 集成所有组件
2. [x] 错误处理和边界情况
3. [x] 构建测试

### Phase 7: 学期筛选功能 ✅
1. [x] 创建 `src/renderer/utils/termUtils.ts` - 学期工具函数
2. [x] 实现学期名称解析（支持多种格式）
3. [x] 实现学期排序和筛选
4. [x] 更新 `CourseList.tsx` 添加学期筛选UI
5. [x] 自动选择最新学期

### Phase 8: CORS 修复 ✅
1. [x] 将 API 请求从渲染进程移到主进程
2. [x] 添加 IPC 处理器代理 Canvas API 请求
3. [x] 更新组件使用 IPC 替代直接 fetch

### Phase 9: 课程拖拽排序持久化 ✅
1. [x] 实现课程拖拽排序功能（HTML5 Drag and Drop API）
2. [x] 使用 electron-store 持久化保存课程排序
3. [x] 修复课程ID类型不匹配问题（Canvas API 返回字符串ID）
4. [x] 按学期独立存储排序状态

---

## 5. 关键实现细节

### 5.0 课程拖拽排序持久化

#### 5.0.1 问题背景

课程拖拽排序后刷新页面会回到原始状态，排序没有持久化保存。根本原因是：

1. **学期键不一致**：存储和加载时使用的学期名称键可能不匹配
2. **课程ID类型不匹配**：Canvas API 返回的 `course.id` 是字符串，但存储的排序数组是数字

#### 5.0.2 解决方案

**统一使用原始学期名称作为键**：

```typescript
// CourseList.tsx - 保存排序时
const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
  // ... 从 DOM 读取顺序

  // 获取当前学期中任意课程的原始学期名称作为存储键
  const originalTermName = filteredCourses[0]?.term?.name || selectedTerm;

  // 更新 React 状态并保存到存储
  setCourseOrder((prev) => ({ ...prev, [originalTermName]: newOrder }));
  window.electronAPI?.setCourseOrder?.(originalTermName, newOrder)
    .catch(console.error);
}, [filteredCourses, selectedTerm]);
```

**统一课程ID类型为数字**：

```typescript
// CourseList.tsx - 应用排序时
// 注意：Canvas API 返回的 course.id 可能是字符串，需要统一转换为数字
const courseMap = new Map(filteredCourses.map(c => [
  parseCourseId(String(c.id)), // 统一转换为数字
  c
]));

// 根据保存的顺序排序
for (const courseId of termOrder) {
  const course = courseMap.get(courseId); // courseId 是数字
  if (course) {
    orderedCourses.push(course);
  }
}
```

#### 5.0.3 关键代码位置

- **存储排序**: `src/renderer/components/CourseList.tsx` - `handleDrop` 函数
- **加载排序**: `src/renderer/components/CourseList.tsx` - `fetchCourses` 函数
- **应用排序**: `src/renderer/components/CourseList.tsx` - 排序 `useEffect`
- **类型转换**: `src/shared/strict-types.ts` - `parseCourseId` 函数

#### 5.0.4 IPC 存储接口

```typescript
// 主进程 IPC 处理器 (src/main/index.ts)
ipcMain.handle('store:getCourseOrder', async (_, term: string) => {
  return store.get(`courseOrder.${term}`, []);
});

ipcMain.handle('store:setCourseOrder', async (_, term: string, courseIds: number[]) => {
  store.set(`courseOrder.${term}`, courseIds);
});

// 预加载脚本暴露 (src/main/preload.ts)
getCourseOrder: async (term: string): Promise<number[]> => {
  return ipcRenderer.invoke('store:getCourseOrder', term);
},
setCourseOrder: async (term: string, courseIds: number[]): Promise<void> => {
  await ipcRenderer.invoke('store:setCourseOrder', term, courseIds);
},
```

---

## 5. 关键实现细节

### 5.1 学期筛选功能

#### 5.1.1 学期名称解析

```typescript
// src/renderer/utils/termUtils.ts

export function parseTermName(termName: string): {
  startYear: number;
  endYear: number;
  semester: number;
  isValid: boolean;
} {
  // 支持 "2025-2026-2" 格式
  const hyphenFormat = termName.match(/^(\d{4})-(\d{4})-(\d)$/);
  if (hyphenFormat) {
    return {
      startYear: parseInt(hyphenFormat[1], 10),
      endYear: parseInt(hyphenFormat[2], 10),
      semester: parseInt(hyphenFormat[3], 10),
      isValid: true,
    };
  }

  // 支持 "2025-2026 Spring" 格式
  const seasonFormat = termName.match(/^(\d{4})-(\d{4})\s+(Spring|Fall|Summer)$/i);
  if (seasonFormat) {
    const seasonMap: Record<string, number> = {
      fall: 1, autumn: 1,
      winter: 2, spring: 2,
      summer: 3,
    };
    return {
      startYear: parseInt(seasonFormat[1], 10),
      endYear: parseInt(seasonFormat[2], 10),
      semester: seasonMap[seasonFormat[3].toLowerCase()] || 1,
      isValid: true,
    };
  }

  return { startYear: 0, endYear: 0, semester: 0, isValid: false };
}
```

#### 5.1.2 课程列表学期筛选

```typescript
// CourseList.tsx 中使用
const availableTerms = useMemo(() => extractUniqueTerms(courses), [courses]);
const filteredCourses = useMemo(() =>
  filterCoursesByTerm(courses, selectedTerm),
  [courses, selectedTerm]
);

// 自动选择最新学期
useEffect(() => {
  const latestTerm = getLatestTerm(courses);
  if (latestTerm) setSelectedTerm(latestTerm);
}, [courses]);
```

---

### 5.2 IPC 代理模式（解决 CORS）

开发模式下，渲染进程运行在 `http://localhost:5173`，直接请求 Canvas API 会触发 CORS 限制。

#### 5.2.1 主进程 IPC 处理器

```typescript
// src/main/index.ts

ipcMain.handle('canvas:getCourses', async (_, token: string) => {
  const response = await fetch(
    'https://oc.sjtu.edu.cn/api/v1/courses?include[]=teachers&include[]=term&per_page=100',
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json+canvas-string-ids',
      },
    }
  );
  const data = await response.json();
  return { success: true, data };
});
```

#### 5.2.2 预加载脚本暴露 API

```typescript
// src/main/preload.ts

const electronAPI = {
  getCourses: async (token: string) => {
    return ipcRenderer.invoke('canvas:getCourses', token);
  },
  getAssignmentGroups: async (token: string, courseId: number) => {
    return ipcRenderer.invoke('canvas:getAssignmentGroups', token, courseId);
  },
  // ... 其他 IPC 方法
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
```

#### 5.2.3 渲染进程使用

```typescript
// 替代直接 fetch
const result = await window.electronAPI.getCourses(apiToken);
if (result.success) {
  setCourses(result.data);
}
```

---

### 5.3 文件上传完整流程

```typescript
async function uploadFile(
  canvasUrl: string,
  token: string,
  courseId: number,
  file: File
): Promise<number> {
  // Step 1: 预请求（通过 IPC 代理）
  const preResult = await window.electronAPI.uploadFilePre(
    token, courseId, file.name, file.size
  );
  if (!preResult.success) throw new Error(preResult.error);
  const { upload_url, upload_params } = preResult.data;

  // Step 2: S3上传（直接上传到 S3，无 CORS 限制）
  const s3FormData = new FormData();
  Object.entries(upload_params).forEach(([key, value]) => {
    s3FormData.append(key, value as string);
  });
  s3FormData.append('file', file);

  const s3Response = await fetch(upload_url, {
    method: 'POST',
    body: s3FormData
  });

  const location = s3Response.headers.get('Location');
  if (!location) throw new Error('S3上传失败');

  // Step 3: 确认（通过 IPC 代理）
  const fileId = extractFileIdFromLocation(location);
  const confirmResult = await window.electronAPI.uploadFileConfirm(token, fileId);
  if (!confirmResult.success) throw new Error(confirmResult.error);

  return confirmResult.data.id;
}
```

### 5.2 错误处理模式

```typescript
async function handleCanvasResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error: CanvasError = await response.json();
    const message = Array.isArray(error.errors)
      ? error.errors[0]?.message
      : JSON.stringify(error.errors);

    switch (response.status) {
      case 401:
        throw new Error('API Token 无效或已过期，请重新设置');
      case 403:
        throw new Error('无权限执行此操作');
      case 404:
        throw new Error('资源不存在');
      default:
        throw new Error(message || `请求失败: ${response.statusText}`);
    }
  }
  return response.json();
}
```

### 5.3 拖拽文件路径获取

```typescript
// Electron 28+ 使用 webUtils.getPathForFile()
const handleDrop = (event: DragEvent) => {
  event.preventDefault();
  const files: string[] = [];

  for (const item of event.dataTransfer?.items || []) {
    const file = item.getAsFile();
    if (file) {
      const path = (window as any).electron.webUtils.getPathForFile(file);
      files.push(path);
    }
  }
};
```

---

## 6. 项目结构

```
canvas-drop-submit/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 主进程入口，IPC 处理器
│   │   └── preload.ts           # 预加载脚本，暴露安全 API
│   ├── renderer/                # React 前端
│   │   ├── components/
│   │   │   ├── Login.tsx        # API Token 输入
│   │   │   ├── CourseList.tsx   # 课程列表（含学期筛选）
│   │   │   ├── AssignmentList.tsx # 作业列表
│   │   │   └── DropZone.tsx     # 拖拽区域
│   │   ├── utils/
│   │   │   └── termUtils.ts     # 学期工具函数
│   │   ├── hooks/
│   │   │   ├── useCanvas.ts     # Canvas API 封装
│   │   │   └── useDragDrop.ts   # 拖拽功能
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx  # 认证上下文
│   │   ├── types/
│   │   │   └── canvas.ts        # 类型定义
│   │   ├── App.tsx              # 主应用组件
│   │   ├── index.tsx            # 渲染进程入口
│   │   └── index.html
│   └── shared/
│       └── types.ts             # 共享类型定义
├── out/                         # 构建输出
├── resources/                   # 应用资源
├── package.json
├── electron.vite.config.ts
└── tsconfig.json
```

---

## 8. 踩坑记录

### 2025-03-17 - 课程拖拽排序不保存问题

**问题现象**:
- 课程拖拽排序后，刷新页面会回到原始状态
- 排序没有持久化保存

**根本原因**:
1. **学期键不一致**：存储时使用的学期名称键与加载时不一致
2. **课程ID类型不匹配**：Canvas API 返回的 `course.id` 是字符串（如 `"88319"`），但存储的排序数组是数字（如 `88319`）
   - `courseMap.get(courseId)` 无法找到匹配的课程
   - 因为 `courseMap` 的键是字符串，而 `termOrder` 中的值是数字

**解决方案**:
1. 使用 `filteredCourses[0]?.term?.name` 获取原始学期名称作为存储键
2. 使用 `parseCourseId(String(c.id))` 统一将字符串ID转换为数字

**关键代码**:
```typescript
// 构建 courseMap 时统一转换为数字
const courseMap = new Map(filteredCourses.map(c => [
  parseCourseId(String(c.id)), // 字符串转数字
  c
]));

// 查找时使用数字ID
const course = courseMap.get(courseId); // courseId 是数字
```

### 2025-03-16 - 高阶学术英语课程拖拽排序Bug

**问题现象**:
- 高阶学术英语课程的文件与其他课程显示位置不一致
- 拖拽排序后，高阶学术英语的文件一栏显示为其他课程

**根本原因**:
- 课程ID在拖拽数据传递过程中类型不一致（string vs number）
- `SortableCourseItem` 中使用 `String(course.id)` 将ID转为字符串
- `CourseList` 中比较时直接使用 `c.id`（number）与 `dataset.courseId`（string）比较
- 类型不匹配导致查找索引失败，排序逻辑混乱

**解决方案**：
1. 使用 `parseCourseId` 统一解析课程ID（避免 `Number()` 产生 NaN）
2. 实时 DOM 重排：`dragover` 时用 `insertBefore`，`drop` 时从 DOM 读取顺序

---

## 9. 安全注意事项

1. **API Token 加密**: 使用 electron-store 的 encryption 功能
2. **CSP 策略**: 配置严格的内容安全策略
3. **Context Isolation**: 启用 contextIsolation，使用 contextBridge
4. **文件验证**: 上传前检查文件类型和大小
5. **IPC 安全**: 所有 API 请求通过主进程代理，避免在渲染进程暴露敏感信息

---

## 10. 问题排查记录

### 10.1 文件拖拽路径获取问题 (2026-03-17)

**问题**: `webUtils.getPathForFile` 在预加载脚本中不可用

**解决方案**: 直接使用 File 对象的 `path` 属性

```typescript
// DropZone.tsx
const filePath = (file as File & { path?: string }).path || '';
```

**参考**: 详见 `docs/TROUBLESHOOTING.md`

### 10.2 Canvas API 404 错误 (2026-03-17)

**问题**: 调用 `/api/v1/users/self/files` 返回 404 HTML 页面

**原因**: 上海交通大学 Canvas 实例禁用了用户级别文件上传

**解决方案**: 移除用户级别上传回退逻辑，直接显示友好错误提示

```typescript
if (response.status === 401) {
  return {
    success: false,
    error: '您没有该课程的文件上传权限。请检查：1) API Token 是否有效；2) 您是否已注册该课程；3) 课程是否允许文件上传。',
    status: 401,
  };
}
```

**参考**: 详见 `docs/TROUBLESHOOTING.md`

---

## 11. 参考文档

- [Canvas LMS REST API](https://canvas.instructure.com/doc/api/)
- [Canvas File Uploads](https://canvas.instructure.com/doc/api/file.file_uploads.html)
- [Electron webUtils](https://www.electronjs.org/docs/latest/api/web-utils)
- [electron-vite](https://electron-vite.org/)
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [CORS in Electron](https://www.electronjs.org/docs/latest/tutorial/security#cross-origin-requests)
- [项目问题排查指南](./docs/TROUBLESHOOTING.md)
