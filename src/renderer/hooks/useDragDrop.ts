/**
 * 拖拽Hook - 稳定实现版本
 * @module hooks/useDragDrop
 * @description 提供HTML5 Drag and Drop API的React封装，支持Electron文件路径获取
 *
 * @example
 * ```typescript
 * const { dragState, droppedFiles, error, handleDragOver, handleDrop } = useDragDrop();
 * ```
 */

import { useState, useCallback, useRef } from 'react'
import type { LocalFileInfo, DragState, Assignment } from '../../shared/types'
import { supportsFileUpload, isFileExtensionAllowed } from '../../shared/types'

// ============================================================================
// 错误类定义
// ============================================================================

/**
 * 拖拽操作错误类
 */
export class DragDropException extends Error {
  /** 错误代码 */
  public readonly code: DragDropErrorCode

  /** 相关文件 */
  public readonly file?: File

  constructor(message: string, code: DragDropErrorCode, file?: File) {
    super(message)
    this.name = 'DragDropException'
    this.code = code
    this.file = file

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DragDropException)
    }
  }
}

/** 拖拽错误代码 */
export type DragDropErrorCode =
  | 'EMPTY_DROP'
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'EXTENSION_NOT_ALLOWED'
  | 'PATH_EXTRACTION_FAILED'
  | 'MULTIPLE_FILES_NOT_SUPPORTED'
  | 'NO_FILE_UPLOAD_SUPPORT'

// ============================================================================
// 常量定义
// ============================================================================

/** 最大文件大小（5GB） */
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024

/** 支持的MIME类型白名单 - 保留供将来使用 */
// const SUPPORTED_MIME_TYPES = [
//   'application/pdf',
//   'application/msword',
//   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//   'application/vnd.ms-excel',
//   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
//   'application/vnd.ms-powerpoint',
//   'application/vnd.openxmlformats-officedocument.presentationml.presentation',
//   'text/plain',
//   'text/html',
//   'text/markdown',
//   'image/jpeg',
//   'image/png',
//   'image/gif',
//   'image/webp',
//   'image/svg+xml',
//   'application/zip',
//   'application/x-zip-compressed',
//   'application/octet-stream',
// ]

// ============================================================================
// Hook配置选项
// ============================================================================

/**
 * useDragDrop配置选项
 */
export interface UseDragDropOptions {
  /** 是否允许多文件拖拽 */
  allowMultiple?: boolean

  /** 最大文件大小（字节） */
  maxFileSize?: number

  /** 允许的文件扩展名列表 */
  allowedExtensions?: string[]

  /** 允许的MIME类型列表 */
  allowedMimeTypes?: string[]

  /** 目标作业（用于验证文件上传支持） */
  targetAssignment?: Assignment | null

  /** 文件添加回调 */
  onFilesAdded?: (files: LocalFileInfo[]) => void

  /** 错误回调 */
  onError?: (error: DragDropException) => void
}

/**
 * useDragDrop返回类型
 */
export interface UseDragDropReturn {
  /** 当前拖拽状态 */
  dragState: DragState
  /** 已拖拽的文件列表 */
  droppedFiles: LocalFileInfo[]
  /** 当前拖拽悬停的文件数量 */
  dragCounter: number
  /** 错误信息 */
  error: DragDropException | null
  /** 是否正在处理拖拽 */
  isProcessing: boolean

  // 事件处理器
  /** 处理dragenter事件 */
  handleDragEnter: (event: React.DragEvent) => void
  /** 处理dragleave事件 */
  handleDragLeave: (event: React.DragEvent) => void
  /** 处理dragover事件 */
  handleDragOver: (event: React.DragEvent) => void
  /** 处理drop事件 */
  handleDrop: (event: React.DragEvent) => void

  // 文件管理
  /** 添加文件 */
  addFiles: (files: LocalFileInfo[]) => void
  /** 移除文件 */
  removeFile: (index: number) => void
  /** 清空所有文件 */
  clearFiles: () => void
  /** 验证文件 */
  validateFile: (file: LocalFileInfo) => DragDropException | null

  // 状态管理
  /** 清除错误 */
  clearError: () => void
  /** 重置状态 */
  reset: () => void
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 验证文件扩展名是否在允许列表中
 * @param filename - 文件名
 * @param allowedExtensions - 允许的扩展名列表
 * @returns 是否允许
 */
function validateFileExtension(
  filename: string,
  allowedExtensions?: string[]
): boolean {
  if (!allowedExtensions || allowedExtensions.length === 0) {
    return true
  }

  const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  return allowedExtensions.some((ext) => ext.toLowerCase() === extension)
}

/**
 * 验证MIME类型
 * @param mimeType - MIME类型
 * @param allowedTypes - 允许的MIME类型列表
 * @returns 是否允许
 */
function validateMimeType(
  mimeType: string,
  allowedTypes?: string[]
): boolean {
  if (!allowedTypes || allowedTypes.length === 0) {
    return true
  }

  // application/octet-stream 是通用类型，总是允许
  if (mimeType === 'application/octet-stream') {
    return true
  }

  return allowedTypes.includes(mimeType)
}

/**
 * 从DataTransferItem获取文件路径
 * 使用Electron的webUtils.getPathForFile API
 * @param file - File对象
 * @returns 文件路径或null
 */
async function getFilePath(file: File): Promise<string | null> {
  try {
    // 检查是否在Electron环境中
    const electronAPI = (window as Window & { electronAPI?: { getPathForFile?: (file: File) => string } }).electronAPI;
    if (typeof window !== 'undefined' && electronAPI?.getPathForFile != null) {
      return (window as Window & { electronAPI: { getPathForFile: (file: File) => string } }).electronAPI.getPathForFile(file)
    }

    // 回退：尝试使用webkitRelativePath
    if (file.webkitRelativePath) {
      return file.webkitRelativePath
    }

    // 最后尝试name（仅文件名，无路径）
    return null
  } catch {
    return null
  }
}

/**
 * 将File对象转换为LocalFileInfo
 * @param file - File对象
 * @returns LocalFileInfo对象
 * @throws DragDropException 当无法获取文件路径时
 */
async function fileToLocalFileInfo(file: File): Promise<LocalFileInfo> {
  const path = await getFilePath(file)

  if (!path) {
    throw new DragDropException(
      `Failed to extract file path for: ${file.name}. This may be due to browser security restrictions.`,
      'PATH_EXTRACTION_FAILED',
      file
    )
  }

  return {
    path,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
  }
}

// ============================================================================
// 主Hook实现
// ============================================================================

/**
 * 拖拽Hook
 * 提供完整的HTML5 Drag and Drop API封装
 *
 * @param options - 配置选项
 * @returns UseDragDropReturn对象
 *
 * @example
 * ```typescript
 * function DropZone() {
 *   const {
 *     dragState,
 *     droppedFiles,
 *     handleDragOver,
 *     handleDrop
 *   } = useDragDrop({
 *     allowMultiple: true,
 *     maxFileSize: 100 * 1024 * 1024, // 100MB
 *     allowedExtensions: ['.pdf', '.doc', '.docx']
 *   });
 *
 *   return (
 *     <div
 *       onDragOver={handleDragOver}
 *       onDrop={handleDrop}
 *       className={dragState === 'dragover' ? 'dragging' : ''}
 *     >
 *       {droppedFiles.map(file => <div key={file.path}>{file.name}</div>)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useDragDrop(options: UseDragDropOptions = {}): UseDragDropReturn {
  const {
    allowMultiple = true,
    maxFileSize = MAX_FILE_SIZE,
    allowedExtensions,
    allowedMimeTypes,
    targetAssignment,
    onFilesAdded,
    onError,
  } = options

  // ==========================================================================
  // 状态管理
  // ==========================================================================

  const [dragState, setDragState] = useState<DragState>('idle')
  const [droppedFiles, setDroppedFiles] = useState<LocalFileInfo[]>([])
  const [dragCounter, setDragCounter] = useState(0)
  const [error, setError] = useState<DragDropException | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // 使用ref存储配置，避免依赖循环
  const optionsRef = useRef(options)
  optionsRef.current = options

  // ==========================================================================
  // 验证函数
  // ==========================================================================

  /**
   * 验证单个文件
   * @param file - 本地文件信息
   * @returns 错误对象或null
   */
  const validateFile = useCallback(
    (file: LocalFileInfo): DragDropException | null => {
      // 检查文件大小
      if (file.size > maxFileSize) {
        return new DragDropException(
          `File "${file.name}" exceeds maximum size of ${(maxFileSize / 1024 / 1024).toFixed(2)}MB`,
          'FILE_TOO_LARGE'
        )
      }

      // 检查文件扩展名
      if (!validateFileExtension(file.name, allowedExtensions)) {
        return new DragDropException(
          `File extension not allowed for: ${file.name}. Allowed: ${allowedExtensions?.join(', ')}`,
          'EXTENSION_NOT_ALLOWED'
        )
      }

      // 检查MIME类型
      if (!validateMimeType(file.type, allowedMimeTypes)) {
        return new DragDropException(
          `File type "${file.type}" not supported for: ${file.name}`,
          'INVALID_FILE_TYPE'
        )
      }

      // 检查作业是否支持文件上传
      if (targetAssignment && !supportsFileUpload(targetAssignment)) {
        return new DragDropException(
          'This assignment does not support file uploads',
          'NO_FILE_UPLOAD_SUPPORT'
        )
      }

      // 检查作业的文件扩展名限制
      if (targetAssignment?.allowed_extensions) {
        if (!isFileExtensionAllowed(file.name, targetAssignment.allowed_extensions)) {
          return new DragDropException(
            `File "${file.name}" does not match allowed extensions: ${targetAssignment.allowed_extensions.join(', ')}`,
            'EXTENSION_NOT_ALLOWED'
          )
        }
      }

      return null
    },
    [maxFileSize, allowedExtensions, allowedMimeTypes, targetAssignment]
  )

  // ==========================================================================
  // 文件管理
  // ==========================================================================

  /**
   * 添加文件到列表
   * @param files - 要添加的文件
   */
  const addFiles = useCallback(
    (files: LocalFileInfo[]) => {
      if (!files || files.length === 0) return

      // 验证所有文件
      const validFiles: LocalFileInfo[] = []
      const validationErrors: DragDropException[] = []

      for (const file of files) {
        const validationError = validateFile(file)
        if (validationError) {
          validationErrors.push(validationError)
        } else {
          validFiles.push(file)
        }
      }

      // 报告验证错误
      if (validationErrors.length > 0) {
        setError(validationErrors[0])
        onError?.(validationErrors[0])

        // 如果有多个错误，记录到控制台
        if (validationErrors.length > 1) {
          console.warn(
            `[useDragDrop] Multiple validation errors:`,
            validationErrors.map((e) => e.message)
          )
        }
      }

      // 添加有效文件
      if (validFiles.length > 0) {
        setDroppedFiles((prev) => {
          const newFiles = allowMultiple ? [...prev, ...validFiles] : validFiles
          return newFiles
        })

        onFilesAdded?.(validFiles)
      }
    },
    [allowMultiple, validateFile, onFilesAdded, onError]
  )

  /**
   * 从列表中移除文件
   * @param index - 文件索引
   */
  const removeFile = useCallback((index: number) => {
    if (index < 0 || index >= droppedFiles.length) {
      console.warn(`[useDragDrop] Invalid file index: ${index}`)
      return
    }

    setDroppedFiles((prev) => prev.filter((_, i) => i !== index))
  }, [droppedFiles.length])

  /**
   * 清空所有文件
   */
  const clearFiles = useCallback(() => {
    setDroppedFiles([])
  }, [])

  // ==========================================================================
  // 拖拽事件处理器
  // ==========================================================================

  /**
   * 处理dragenter事件
   * @param event - React拖拽事件
   */
  const handleDragEnter = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()

      setDragCounter((prev) => prev + 1)
      setDragState('dragenter')
    },
    []
  )

  /**
   * 处理dragleave事件
   * @param event - React拖拽事件
   */
  const handleDragLeave = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()

      setDragCounter((prev) => {
        const newCounter = prev - 1
        if (newCounter <= 0) {
          setDragState('idle')
          return 0
        }
        return newCounter
      })
    },
    []
  )

  /**
   * 处理dragover事件
   * @param event - React拖拽事件
   */
  const handleDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()

      // 设置dropEffect以显示正确的拖拽光标
      event.dataTransfer.dropEffect = 'copy'
      setDragState('dragover')
    },
    []
  )

  /**
   * 处理drop事件
   * @param event - React拖拽事件
   */
  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()

      // 重置状态
      setDragState('drop')
      setDragCounter(0)
      setError(null)
      setIsProcessing(true)

      try {
        const { files } = event.dataTransfer

        // 检查是否有文件
        if (!files || files.length === 0) {
          const emptyError = new DragDropException(
            'No files were dropped',
            'EMPTY_DROP'
          )
          setError(emptyError)
          onError?.(emptyError)
          return
        }

        // 检查多文件支持
        if (!allowMultiple && files.length > 1) {
          const multiError = new DragDropException(
            'Multiple files are not supported. Please drop only one file.',
            'MULTIPLE_FILES_NOT_SUPPORTED'
          )
          setError(multiError)
          onError?.(multiError)
          return
        }

        // 转换所有文件
        const filePromises: Promise<LocalFileInfo>[] = []
        for (let i = 0; i < files.length; i++) {
          filePromises.push(fileToLocalFileInfo(files[i]))
        }

        const localFiles = await Promise.all(filePromises)

        // 添加到列表
        addFiles(localFiles)
      } catch (err) {
        const exception =
          err instanceof DragDropException
            ? err
            : new DragDropException(
                err instanceof Error ? err.message : 'Failed to process dropped files',
                'PATH_EXTRACTION_FAILED'
              )
        setError(exception)
        onError?.(exception)
      } finally {
        setIsProcessing(false)
        // 短暂延迟后重置拖拽状态
        setTimeout(() => setDragState('idle'), 100)
      }
    },
    [allowMultiple, addFiles, onError]
  )

  // ==========================================================================
  // 状态管理
  // ==========================================================================

  /**
   * 清除错误状态
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * 重置所有状态
   */
  const reset = useCallback(() => {
    setDragState('idle')
    setDroppedFiles([])
    setDragCounter(0)
    setError(null)
    setIsProcessing(false)
  }, [])

  // ==========================================================================
  // 返回Hook接口
  // ==========================================================================

  return {
    dragState,
    droppedFiles,
    dragCounter,
    error,
    isProcessing,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    addFiles,
    removeFile,
    clearFiles,
    validateFile,
    clearError,
    reset,
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default useDragDrop

