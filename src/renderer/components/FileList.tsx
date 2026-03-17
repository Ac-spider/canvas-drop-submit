/**
 * Canvas课程文件列表组件
 * @module components/FileList
 * @description 显示课程文件列表，支持筛选、排序和下载
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { CanvasFile, FileFilterType, CanvasModule, ModuleItem } from '../../shared/types';
import { formatFileSize, getFileFilterType } from '../../shared/types';

interface FileListProps {
  courseId: number;
  apiToken: string;
}

type FileSortField = 'name' | 'size' | 'created_at' | 'updated_at';
type FileSortOrder = 'asc' | 'desc';

interface SortConfig {
  field: FileSortField;
  order: FileSortOrder;
}

/**
 * 获取文件图标
 */
function getFileIcon(mimeClass: string): string {
  const iconMap: Record<string, string> = {
    pdf: '📄',
    image: '🖼️',
    code: '💻',
    text: '📝',
    doc: '📃',
    word: '📃',
    video: '🎬',
    audio: '🎵',
    zip: '📦',
  };
  return iconMap[mimeClass] || '📎';
}

/**
 * 获取筛选标签
 */
function getFilterLabel(type: FileFilterType): string {
  const labelMap: Record<FileFilterType, string> = {
    all: '全部',
    pdf: 'PDF',
    image: '图片',
    document: '文档',
    code: '代码',
    other: '其他',
  };
  return labelMap[type];
}

/**
 * 格式化日期
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * 文件去重
 * 根据文件ID去重，保留第一个出现的文件
 */
function deduplicateFiles(files: CanvasFile[]): CanvasFile[] {
  const seen = new Set<number>();
  return files.filter((file) => {
    if (seen.has(file.id)) {
      return false;
    }
    seen.add(file.id);
    return true;
  });
}

/**
 * 课程文件列表组件
 */
export function FileList({ courseId, apiToken }: FileListProps) {
  const [files, setFiles] = useState<CanvasFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FileFilterType>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'updated_at', order: 'desc' });
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [downloadingFiles, setDownloadingFiles] = useState<Set<number>>(new Set());
  const [downloadPath, setDownloadPath] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);

  /**
   * 加载课程特定的下载路径
   */
  useEffect(() => {
    const loadDownloadPath = async () => {
      try {
        const savedPath = await window.electronAPI?.getCourseDownloadPath?.(courseId);
        setDownloadPath(savedPath || null);
      } catch (err) {
        console.warn('加载课程下载路径失败:', err);
        setDownloadPath(null);
      }
    };
    loadDownloadPath();
  }, [courseId]);

  /**
   * 从Modules中获取文件
   * 某些课程（如高阶学术英语）将文件存储在Modules中而不是标准Files区域
   */
  const loadFilesFromModules = useCallback(async (): Promise<CanvasFile[]> => {
    const moduleFiles: CanvasFile[] = [];

    try {
      // 1. 获取课程模块列表
      const modulesResult = await window.electronAPI?.getModules?.(apiToken, courseId);
      if (!modulesResult?.success || !Array.isArray(modulesResult.data)) {
        return moduleFiles;
      }

      const modules = modulesResult.data as CanvasModule[];

      // 2. 遍历每个模块获取项目
      for (const module of modules) {
        const itemsResult = await window.electronAPI?.getModuleItems?.(apiToken, courseId, module.id);
        if (!itemsResult?.success || !Array.isArray(itemsResult.data)) {
          continue;
        }

        const items = itemsResult.data as ModuleItem[];

        // 3. 筛选File类型的项目并获取文件详情
        for (const item of items) {
          if (item.type === 'File' && item.content_id) {
            try {
              const fileResult = await window.electronAPI?.getFileById?.(apiToken, item.content_id);
              if (fileResult?.success) {
                moduleFiles.push(fileResult.data as CanvasFile);
              }
            } catch (fileErr) {
              console.warn(`获取文件详情失败: ${item.content_id}`, fileErr);
            }
          }
        }
      }
    } catch (err) {
      console.log('Modules文件获取失败:', err);
    }

    return moduleFiles;
  }, [apiToken, courseId]);

  /**
   * 加载文件列表
   * 首先尝试获取标准课程文件，如果失败或为空，则尝试从Modules获取
   */
  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    // 清空之前的文件列表，避免显示旧数据
    setFiles([]);

    const allFiles: CanvasFile[] = [];

    // 1. 首先尝试获取标准课程文件
    try {
      const result = await window.electronAPI?.getFiles?.(apiToken, courseId);
      if (result?.success && Array.isArray(result.data)) {
        allFiles.push(...(result.data as CanvasFile[]));
      }
    } catch (err) {
      console.log('标准文件获取失败:', err);
    }

    // 2. 尝试从Modules获取文件（补充或替代）
    try {
      const moduleFiles = await loadFilesFromModules();
      allFiles.push(...moduleFiles);
    } catch (err) {
      console.log('Modules文件获取失败:', err);
    }

    // 3. 去重并设置文件列表
    if (allFiles.length > 0) {
      const uniqueFiles = deduplicateFiles(allFiles);
      setFiles(uniqueFiles);
    }
    // 如果没有获取到文件，不显示错误，只显示空列表
    // 因为很多课程确实没有上传文件到Files/Modules

    setLoading(false);
  }, [apiToken, courseId, loadFilesFromModules]);

  /**
   * 初始加载
   */
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  /**
   * 筛选后的文件列表
   */
  const filteredFiles = useMemo(() => {
    if (filterType === 'all') return files;
    return files.filter((file) => getFileFilterType(file.mime_class) === filterType);
  }, [files, filterType]);

  /**
   * 排序后的文件列表
   */
  const sortedFiles = useMemo(() => {
    const sorted = [...filteredFiles];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortConfig.field) {
        case 'name':
          comparison = a.display_name.localeCompare(b.display_name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'updated_at':
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
      }
      return sortConfig.order === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredFiles, sortConfig]);

  /**
   * 处理排序
   */
  const handleSort = useCallback((field: FileSortField) => {
    setSortConfig((prev) => ({
      field,
      order: prev.field === field && prev.order === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  /**
   * 切换文件选择
   */
  const toggleFileSelection = useCallback((fileId: number) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  }, []);

  /**
   * 全选/取消全选
   */
  const toggleSelectAll = useCallback(() => {
    setSelectedFiles((prev) => {
      if (prev.size === sortedFiles.length) {
        return new Set();
      }
      return new Set(sortedFiles.map((f) => f.id));
    });
  }, [sortedFiles]);

  /**
   * 选择下载目录
   * 保存路径时关联当前课程ID
   */
  const handleSelectDirectory = useCallback(async () => {
    const result = await window.electronAPI?.selectDirectory?.();
    if (result?.success && result.path) {
      setDownloadPath(result.path);
      // 保存到 store，关联当前课程ID
      try {
        await window.electronAPI?.setCourseDownloadPath?.(courseId, result.path);
      } catch (err) {
        console.warn('保存课程下载路径失败:', err);
      }
    }
  }, [courseId]);

  /**
   * 下载单个文件
   */
  const downloadFile = useCallback(async (file: CanvasFile) => {
    setDownloadingFiles((prev) => new Set(prev).add(file.id));
    try {
      const result = await window.electronAPI?.downloadFile?.(
        file.url,
        file.display_name,
        downloadPath || undefined
      );
      if (result?.success) {
        return true;
      } else {
        console.error(`下载失败: ${file.display_name}`, result?.error);
        return false;
      }
    } catch (err) {
      console.error(`下载失败: ${file.display_name}`, err);
      return false;
    } finally {
      setDownloadingFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(file.id);
        return newSet;
      });
    }
  }, [downloadPath]);

  /**
   * 下载选中的文件
   */
  const downloadSelectedFiles = useCallback(async () => {
    const filesToDownload = sortedFiles.filter((f) => selectedFiles.has(f.id));
    if (filesToDownload.length === 0) return;

    setDownloadProgress({ current: 0, total: filesToDownload.length });
    let successCount = 0;

    for (let i = 0; i < filesToDownload.length; i++) {
      const file = filesToDownload[i];
      setDownloadProgress({ current: i + 1, total: filesToDownload.length });
      const success = await downloadFile(file);
      if (success) successCount++;
    }

    setDownloadProgress(null);
    setSelectedFiles(new Set());

    // 显示下载完成提示
    if (successCount === filesToDownload.length) {
      alert(`成功下载 ${successCount} 个文件`);
    } else {
      alert(`下载完成: ${successCount}/${filesToDownload.length} 个文件成功`);
    }
  }, [sortedFiles, selectedFiles, downloadFile]);

  /**
   * 获取排序图标
   */
  const getSortIcon = (field: FileSortField) => {
    if (sortConfig.field !== field) return '↕️';
    return sortConfig.order === 'desc' ? '↓' : '↑';
  };

  const filterTypes: FileFilterType[] = ['all', 'pdf', 'image', 'document', 'code', 'other'];

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">课程文件</h2>
        <button
          onClick={loadFiles}
          disabled={loading}
          className="rounded-md bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-200 disabled:opacity-50"
        >
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          <p className="font-medium">无法加载文件列表</p>
          <p className="mt-1">{error}</p>
          {error.includes('权限') && (
            <p className="mt-2 text-xs text-red-600">
              提示：某些课程可能限制了文件访问权限。您仍然可以正常提交作业。
            </p>
          )}
        </div>
      )}

      {/* 筛选标签 */}
      <div className="flex flex-wrap gap-2">
        {filterTypes.map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterType === type
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {getFilterLabel(type)}
          </button>
        ))}
      </div>

      {/* 下载路径和操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md bg-gray-50 p-3">
        <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
          <span className="shrink-0">下载路径:</span>
          <span className="truncate font-mono text-xs max-w-[150px] sm:max-w-[200px]" title={downloadPath || '默认下载文件夹'}>
            {downloadPath || '默认下载文件夹'}
          </span>
          <button
            onClick={handleSelectDirectory}
            className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
          >
            更改
          </button>
        </div>
        {selectedFiles.size > 0 && (
          <button
            onClick={downloadSelectedFiles}
            disabled={downloadProgress !== null}
            className="rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {downloadProgress
              ? `下载中 ${downloadProgress.current}/${downloadProgress.total}`
              : `下载选中 (${selectedFiles.size})`}
          </button>
        )}
      </div>

      {/* 文件列表 */}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
            <p className="mt-2 text-sm text-gray-500">加载中...</p>
          </div>
        </div>
      ) : sortedFiles.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-md bg-gray-50">
          <p className="text-gray-500">
            {filterType === 'all' ? '该课程暂无文件' : '该分类下暂无文件'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-gray-200">
          {/* 表头 */}
          <div className="flex items-center bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500">
            <div className="flex w-8 items-center justify-center">
              <input
                type="checkbox"
                checked={selectedFiles.size === sortedFiles.length && sortedFiles.length > 0}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => handleSort('name')}
              className="flex flex-1 items-center gap-1 text-left hover:text-gray-700"
            >
              名称 {getSortIcon('name')}
            </button>
            <button
              onClick={() => handleSort('size')}
              className="flex w-20 items-center gap-1 text-right hover:text-gray-700"
            >
              大小 {getSortIcon('size')}
            </button>
            <button
              onClick={() => handleSort('updated_at')}
              className="flex w-24 items-center gap-1 text-right hover:text-gray-700"
            >
              日期 {getSortIcon('updated_at')}
            </button>
            <div className="w-16 text-center">操作</div>
          </div>

          {/* 文件列表 */}
          <div className="max-h-[400px] overflow-y-auto">
            {sortedFiles.map((file) => (
              <div
                key={file.id}
                className={`flex items-center border-t border-gray-100 px-4 py-3 hover:bg-gray-50 ${
                  selectedFiles.has(file.id) ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex w-8 items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(file.id)}
                    onChange={() => toggleFileSelection(file.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="text-lg">{getFileIcon(file.mime_class)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900" title={file.display_name}>
                      {file.display_name}
                    </p>
                    <p className="text-xs text-gray-500">{file.content_type}</p>
                  </div>
                </div>
                <div className="w-20 text-right text-sm text-gray-600">
                  {formatFileSize(file.size)}
                </div>
                <div className="w-24 text-right text-xs text-gray-500">
                  {formatDate(file.updated_at)}
                </div>
                <div className="flex w-16 justify-center">
                  <button
                    onClick={() => downloadFile(file)}
                    disabled={downloadingFiles.has(file.id)}
                    className="rounded p-1 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                    title="下载"
                  >
                    {downloadingFiles.has(file.id) ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 文件统计 */}
      <div className="text-right text-xs text-gray-500">
        共 {sortedFiles.length} 个文件
        {filterType !== 'all' && ` (已筛选)`}
      </div>
    </div>
  );
}
