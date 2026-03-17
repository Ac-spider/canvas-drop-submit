# Canvas Drop Submit - 测试配置指南

## 测试文件位置

测试文件已创建：`/mnt/c/Users/liu_j/Desktop/SJTU/AI/Vibe coding/research/canvas-drop-submit/src/__tests__/useDragDrop.test.ts`

## 需要安装的依赖

运行测试前需要安装以下依赖：

```bash
npm install --save-dev jest ts-jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom
```

## 依赖说明

| 包名 | 版本 | 用途 |
|------|------|------|
| jest | ^29.x | 测试框架 |
| ts-jest | ^29.x | TypeScript支持 |
| @testing-library/react | ^14.x | React组件测试工具 |
| @testing-library/jest-dom | ^6.x | 自定义匹配器 |
| jest-environment-jsdom | ^29.x | DOM环境模拟 |

## 现有配置

项目已配置好以下文件：

1. **jest.config.js** - Jest配置文件
2. **src/__tests__/setup.ts** - 测试环境初始化
3. **package.json** - 已包含 `"test": "jest"` 脚本

## 运行测试

安装依赖后，运行以下命令：

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- useDragDrop.test.ts

# 运行带覆盖率报告
npm test -- --coverage

# 运行并监视文件变化
npm test -- --watch
```

## 测试覆盖率预期

根据 `jest.config.js` 中的配置：
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

## useDragDrop测试覆盖范围

### 1. 初始状态测试
- 默认状态验证
- 自定义配置接受

### 2. 拖拽事件处理测试
- `handleDragEnter` - 增加dragCounter，设置dragState
- `handleDragLeave` - 减少dragCounter，归零时重置状态
- `handleDragOver` - 设置dropEffect为'copy'
- `handleDrop` - 处理文件拖拽

### 3. 文件管理测试
- `addFiles` - 添加文件（支持多文件/单文件模式）
- `removeFile` - 移除指定索引文件
- `clearFiles` - 清空所有文件

### 4. 文件验证测试
- 文件大小限制检查
- 文件扩展名验证
- MIME类型验证
- 作业文件上传支持检查

### 5. 错误处理测试
- `DragDropException` 错误类
- 空文件拖拽错误
- 多文件不支持错误
- 路径提取失败错误

### 6. 回调函数测试
- `onFilesAdded` 回调
- `onError` 回调

### 7. 状态管理测试
- `clearError` - 清除错误
- `reset` - 重置所有状态

### 8. 边界情况测试
- 5GB文件大小边界
- 无扩展名文件
- 大小写不同的扩展名
- 嵌套拖拽进入/离开

### 9. 总大小计算测试
- 多文件总大小计算
- 移除文件后更新

### 10. 复杂场景测试
- 混合有效/无效文件
- 完整拖拽流程
- 拖拽离开后的重新进入

## 潜在问题

### 1. 依赖循环风险
`useDragDrop.ts` 第306-307行使用ref存储配置以避免依赖循环：
```typescript
const optionsRef = useRef(options)
optionsRef.current = options
```
这是一个好的实践，但需要注意回调函数（onFilesAdded, onError）的引用稳定性。

### 2. 文件路径获取
在浏览器环境中，`getFilePath` 函数依赖 `window.electronAPI.getPathForFile`。测试中使用 `webkitRelativePath` 作为回退。

### 3. 异步处理
`handleDrop` 是异步函数，测试中使用 `waitFor` 确保状态更新完成。

### 4. 拖拽计数器
`dragCounter` 用于处理嵌套元素的拖拽事件，但在快速操作时可能出现不同步的情况。

## 测试文件结构

```
src/__tests__/
├── setup.ts              # 测试环境配置
├── useDragDrop.test.ts   # 拖拽Hook测试（本次创建）
├── fileUpload.test.ts    # 文件上传测试
└── components.test.tsx   # 组件测试
```

## 注意事项

1. **Electron API Mock**: 测试中需要模拟 `window.electronAPI`
2. **File API**: 使用jsdom环境的File API实现
3. **异步测试**: 使用 `act` 和 `waitFor` 处理异步状态更新
4. **事件模拟**: 完整模拟React.DragEvent接口
