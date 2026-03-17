import React, { useState, useCallback, useRef, DragEvent } from 'react';

/**
 * 文件信息接口
 */
interface FileInfo {
  name: string;
  size: number;
  path: string;
}

/**
 * DropZone组件Props接口
 */
interface DropZoneProps {
  /** 作业ID */
  assignmentId: number;
  /** 课程ID */
  courseId: number;
  /** Canvas API Token */
  apiToken: string;
  /** 作业名称 */
  assignmentName: string;
  /** 上传完成回调 */
  onUploadComplete: () => void;
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的字符串
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * 拖拽上传区域组件
 *
 * 支持多文件拖拽上传，显示上传进度，完成后触发回调
 *
 * @param props - 组件属性
 * @returns React组件
 */
/**
 * 获取文件扩展名
 * @param filename 文件名
 * @returns 扩展名（包含点号）
 */
const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(lastDot) : '';
};

/**
 * 生成新文件名
 * @param originalName 原始文件名
 * @param assignmentName 作业名称
 * @returns 新文件名
 */
const generateNewFileName = (originalName: string, assignmentName: string): string => {
  const ext = getFileExtension(originalName);
  // 清理作业名称中的非法字符
  const cleanName = assignmentName.replace(/[\\/:*?"<>|]/g, '_');
  return `${cleanName}${ext}`;
};

export const DropZone: React.FC<DropZoneProps> = ({
  assignmentId: _assignmentId,
  courseId: _courseId,
  apiToken: _apiToken,
  assignmentName,
  onUploadComplete,
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [useRenameToAssignment, setUseRenameToAssignment] = useState<boolean>(false);

  const dropRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef<number>(0);

  /**
   * 处理拖拽进入事件
   */
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;

    if (e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  /**
   * 处理拖拽离开事件
   */
  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;

    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  /**
   * 处理拖拽悬停事件
   */
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // 必须设置 dropEffect 才能允许放置
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  /**
   * 处理文件选择
   */
  const handleFiles = useCallback((fileList: FileList | null) => {
    console.log('handleFiles called:', fileList);
    if (!fileList || fileList.length === 0) {
      console.log('No files in fileList');
      return;
    }

    // 检查 electronAPI 是否可用
    if (!window.electronAPI) {
      console.error('[DropZone] window.electronAPI is undefined');
      setError('应用初始化未完成，请刷新页面或重启应用');
      return;
    }

    if (!window.electronAPI.getPathForFile) {
      console.error('[DropZone] window.electronAPI.getPathForFile is undefined');
      setError('文件API未加载，请刷新页面或重启应用');
      return;
    }

    const newFiles: FileInfo[] = [];

    Array.from(fileList).forEach((file) => {
      console.log('Processing file:', file.name, 'path:', (file as File & { path?: string }).path);
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

    console.log('Adding new files:', newFiles);
    setFiles((prev) => [...prev, ...newFiles]);
    setError(null);
  }, []);

  /**
   * 处理拖拽放下事件
   */
  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      console.log('handleDrop called');
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;

      const { files: droppedFiles } = e.dataTransfer;
      console.log('Dropped files:', droppedFiles);
      handleFiles(droppedFiles);
    },
    [handleFiles]
  );

  /**
   * 处理文件输入选择
   */
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      // 重置input以允许重复选择相同文件
      e.target.value = '';
    },
    [handleFiles]
  );

  /**
   * 移除已选择的文件
   */
  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * 清空所有文件
   */
  const clearFiles = useCallback(() => {
    setFiles([]);
    setUploadProgress({});
    setError(null);
  }, []);

  /**
   * 更新上传进度
   */
  const updateProgress = useCallback((fileName: string, progress: number) => {
    setUploadProgress((prev) => ({
      ...prev,
      [fileName]: progress,
    }));
  }, []);

  /**
   * 执行文件上传
   * 使用 Playwright 模拟网页提交，绕过 API 限制
   * 复用用户已有的浏览器登录状态
   */
  const handleUpload = useCallback(async () => {
    if (files.length === 0) {
      setError('请先选择文件');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // 步骤1: 检查网页登录状态（会自动启动/连接浏览器）
      updateProgress('login', 10);
      const loginStatus = await window.electronAPI.checkWebLogin();

      if (!loginStatus.loggedIn) {
        if (loginStatus.needLogin) {
          // 浏览器已打开但用户未登录 Canvas
          setError(loginStatus.message || '请在打开的浏览器中登录 Canvas，然后再次点击上传');
          return;
        }
        throw new Error(loginStatus.error || '登录检查失败');
      }

      // 步骤2: 准备文件路径和自定义文件名
      updateProgress('prepare', 30);
      const filePaths = files.map((file) => file.path);
      const fileNames = useRenameToAssignment
        ? files.map((file) =>
            assignmentName ? generateNewFileName(file.name, assignmentName) : file.name
          )
        : undefined;

      // 步骤3: 使用 Playwright 提交作业
      updateProgress('submit', 50);
      const submitResult = await window.electronAPI.submitAssignmentViaWeb(
        _courseId,
        _assignmentId,
        filePaths,
        fileNames
      );

      if (!submitResult.success) {
        if (submitResult.needLogin) {
          // 需要重新登录
          setError('登录已过期，请在浏览器中重新登录后重试');
          return;
        }
        throw new Error(submitResult.error || '提交失败');
      }

      // 所有文件上传完成
      for (const file of files) {
        updateProgress(file.name, 100);
      }

      onUploadComplete();
      clearFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试');
    } finally {
      setIsUploading(false);
    }
  }, [
    files,
    _courseId,
    _assignmentId,
    assignmentName,
    useRenameToAssignment,
    onUploadComplete,
    clearFiles,
    updateProgress,
  ]);

  return (
    <div className="w-full space-y-4">
      {/* 拖拽区域 */}
      <div
        ref={dropRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-8
          flex flex-col items-center justify-center
          cursor-pointer transition-all duration-200
          ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
          }
          ${isUploading ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input
          id="file-input"
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
          disabled={isUploading}
        />

        {/* 上传图标 */}
        <svg
          className={`w-12 h-12 mb-3 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>

        {/* 提示文字 */}
        <p className="text-sm text-gray-600 text-center">
          <span className="font-medium text-blue-600">点击选择文件</span>
          {' 或拖拽文件到此处'}
        </p>
        <p className="text-xs text-gray-400 mt-1">支持多文件上传</p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 文件名修改选项 */}
      {files.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useRenameToAssignment}
              onChange={(e) => setUseRenameToAssignment(e.target.checked)}
              disabled={isUploading}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">使用作业名称作为文件名</span>
          </label>
          {useRenameToAssignment && assignmentName && (
            <p className="mt-2 text-xs text-blue-600">
              文件将被重命名为: <strong>{assignmentName}</strong>
              {files.length > 0 && files[0]?.name && (
                <span className="text-gray-500">
                  {' '}
                  (例如: {generateNewFileName(files[0].name, assignmentName)})
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-700">
              已选择文件 ({files.length})
            </h3>
            {!isUploading && (
              <button
                onClick={clearFiles}
                className="text-xs text-red-600 hover:text-red-800 transition-colors"
              >
                清空全部
              </button>
            )}
          </div>

          <ul className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    {useRenameToAssignment && assignmentName && (
                      <p className="text-xs text-blue-600">
                        将重命名为: {generateNewFileName(file.name, assignmentName)}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>

                  <div className="flex items-center space-x-3 ml-4">
                    {/* 上传进度 */}
                    {uploadProgress[file.name] !== undefined && (
                      <span className="text-xs text-blue-600">
                        {uploadProgress[file.name]}%
                      </span>
                    )}

                    {/* 删除按钮 */}
                    {!isUploading && (
                      <button
                        onClick={() => removeFile(index)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                        title="移除文件"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* 进度条 */}
                {uploadProgress[file.name] !== undefined && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress[file.name]}%` }}
                      />
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 上传按钮 */}
      {files.length > 0 && (
        <button
          onClick={handleUpload}
          disabled={isUploading}
          className={`
            w-full py-2.5 px-4 rounded-lg font-medium text-sm
            transition-all duration-200
            ${
              isUploading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            }
          `}
        >
          {isUploading ? '上传中...' : `上传 ${files.length} 个文件`}
        </button>
      )}
    </div>
  );
};

export default DropZone;
