/**
 * useDragDrop Hook 单元测试
 * @module __tests__/useDragDrop
 * @description 测试拖拽Hook的所有功能，包括状态管理、事件处理和文件操作
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useDragDrop, DragDropException, UseDragDropOptions } from '../renderer/hooks/useDragDrop'
import type { LocalFileInfo, Assignment } from '../shared/types'

// ============================================================================
// 测试辅助函数和Mock数据
// ============================================================================

/**
 * 创建模拟的LocalFileInfo对象
 */
function createMockLocalFileInfo(overrides: Partial<LocalFileInfo> = {}): LocalFileInfo {
  return {
    path: '/path/to/file.pdf',
    name: 'file.pdf',
    size: 1024,
    type: 'application/pdf',
    ...overrides,
  }
}

/**
 * 创建模拟的File对象
 */
function createMockFile(overrides: Partial<File> = {}): File {
  const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
  Object.defineProperty(file, 'size', { value: 1024 })
  Object.defineProperty(file, 'webkitRelativePath', { value: '/path/to/test.pdf' })
  return Object.assign(file, overrides)
}

/**
 * 创建模拟的React拖拽事件
 */
function createMockDragEvent(
  type: string,
  overrides: Partial<React.DragEvent> = {}
): React.DragEvent {
  const event = {
    type,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    dataTransfer: {
      files: [] as File[],
      dropEffect: 'none' as const,
      effectAllowed: 'all' as const,
      types: [],
      getData: jest.fn(),
      setData: jest.fn(),
      clearData: jest.fn(),
      setDragImage: jest.fn(),
      addElement: jest.fn(),
    },
    target: null,
    currentTarget: null,
    bubbles: true,
    cancelable: true,
    defaultPrevented: false,
    eventPhase: 0,
    isTrusted: true,
    nativeEvent: new Event(type),
    isDefaultPrevented: () => false,
    isPropagationStopped: () => false,
    persist: jest.fn(),
    ...overrides,
  } as unknown as React.DragEvent

  return event
}

/**
 * 创建模拟的Assignment对象
 */
function createMockAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 1,
    name: 'Test Assignment',
    submission_types: ['online_upload'],
    has_submitted_submissions: false,
    allowed_extensions: ['.pdf', '.doc', '.docx'],
    ...overrides,
  } as Assignment
}

// ============================================================================
// 测试套件
// ============================================================================

describe('useDragDrop', () => {
  // 每个测试前的清理
  beforeEach(() => {
    jest.clearAllMocks()
    // 清理window.electronAPI
    delete (window as unknown as { electronAPI?: unknown }).electronAPI
  })

  // ============================================================================
  // 基础状态测试
  // ============================================================================

  describe('初始状态', () => {
    it('应该返回正确的初始状态', () => {
      const { result } = renderHook(() => useDragDrop())

      expect(result.current.dragState).toBe('idle')
      expect(result.current.droppedFiles).toEqual([])
      expect(result.current.dragCounter).toBe(0)
      expect(result.current.error).toBeNull()
      expect(result.current.isProcessing).toBe(false)
    })

    it('应该接受自定义配置', () => {
      const options: UseDragDropOptions = {
        allowMultiple: false,
        maxFileSize: 1024 * 1024,
        allowedExtensions: ['.pdf'],
      }

      const { result } = renderHook(() => useDragDrop(options))
      expect(result.current.droppedFiles).toEqual([])
    })
  })

  // ============================================================================
  // 拖拽事件处理测试
  // ============================================================================

  describe('拖拽事件处理', () => {
    it('handleDragEnter应该增加dragCounter并设置dragState为dragenter', () => {
      const { result } = renderHook(() => useDragDrop())
      const event = createMockDragEvent('dragenter')

      act(() => {
        result.current.handleDragEnter(event)
      })

      expect(result.current.dragCounter).toBe(1)
      expect(result.current.dragState).toBe('dragenter')
      expect(event.preventDefault).toHaveBeenCalled()
      expect(event.stopPropagation).toHaveBeenCalled()
    })

    it('多次handleDragEnter应该累加dragCounter', () => {
      const { result } = renderHook(() => useDragDrop())
      const event = createMockDragEvent('dragenter')

      act(() => {
        result.current.handleDragEnter(event)
        result.current.handleDragEnter(event)
        result.current.handleDragEnter(event)
      })

      expect(result.current.dragCounter).toBe(3)
    })

    it('handleDragLeave应该减少dragCounter', () => {
      const { result } = renderHook(() => useDragDrop())
      const enterEvent = createMockDragEvent('dragenter')
      const leaveEvent = createMockDragEvent('dragleave')

      act(() => {
        result.current.handleDragEnter(enterEvent)
        result.current.handleDragEnter(enterEvent)
        result.current.handleDragLeave(leaveEvent)
      })

      expect(result.current.dragCounter).toBe(1)
    })

    it('handleDragLeave在counter归零时应该重置dragState为idle', () => {
      const { result } = renderHook(() => useDragDrop())
      const enterEvent = createMockDragEvent('dragenter')
      const leaveEvent = createMockDragEvent('dragleave')

      act(() => {
        result.current.handleDragEnter(enterEvent)
        result.current.handleDragLeave(leaveEvent)
      })

      expect(result.current.dragCounter).toBe(0)
      expect(result.current.dragState).toBe('idle')
    })

    it('handleDragOver应该设置dragState为dragover并设置dropEffect', () => {
      const { result } = renderHook(() => useDragDrop())
      const event = createMockDragEvent('dragover')

      act(() => {
        result.current.handleDragOver(event)
      })

      expect(result.current.dragState).toBe('dragover')
      expect(event.dataTransfer.dropEffect).toBe('copy')
      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('handleDragOver应该在dragenter之后正确工作', () => {
      const { result } = renderHook(() => useDragDrop())
      const enterEvent = createMockDragEvent('dragenter')
      const overEvent = createMockDragEvent('dragover')

      act(() => {
        result.current.handleDragEnter(enterEvent)
        result.current.handleDragOver(overEvent)
      })

      expect(result.current.dragState).toBe('dragover')
    })
  })

  // ============================================================================
  // 文件管理测试
  // ============================================================================

  describe('文件管理', () => {
    it('addFiles应该添加文件到列表', () => {
      const { result } = renderHook(() => useDragDrop())
      const files: LocalFileInfo[] = [
        createMockLocalFileInfo({ name: 'file1.pdf', path: '/path/file1.pdf' }),
        createMockLocalFileInfo({ name: 'file2.pdf', path: '/path/file2.pdf' }),
      ]

      act(() => {
        result.current.addFiles(files)
      })

      expect(result.current.droppedFiles).toHaveLength(2)
      expect(result.current.droppedFiles[0].name).toBe('file1.pdf')
      expect(result.current.droppedFiles[1].name).toBe('file2.pdf')
    })

    it('addFiles在allowMultiple=false时应该替换现有文件', () => {
      const { result } = renderHook(() => useDragDrop({ allowMultiple: false }))
      const files1: LocalFileInfo[] = [
        createMockLocalFileInfo({ name: 'old.pdf', path: '/path/old.pdf' }),
      ]
      const files2: LocalFileInfo[] = [
        createMockLocalFileInfo({ name: 'new.pdf', path: '/path/new.pdf' }),
      ]

      act(() => {
        result.current.addFiles(files1)
        result.current.addFiles(files2)
      })

      expect(result.current.droppedFiles).toHaveLength(1)
      expect(result.current.droppedFiles[0].name).toBe('new.pdf')
    })

    it('addFiles在allowMultiple=true时应该追加文件', () => {
      const { result } = renderHook(() => useDragDrop({ allowMultiple: true }))
      const files1: LocalFileInfo[] = [
        createMockLocalFileInfo({ name: 'file1.pdf', path: '/path/file1.pdf' }),
      ]
      const files2: LocalFileInfo[] = [
        createMockLocalFileInfo({ name: 'file2.pdf', path: '/path/file2.pdf' }),
      ]

      act(() => {
        result.current.addFiles(files1)
        result.current.addFiles(files2)
      })

      expect(result.current.droppedFiles).toHaveLength(2)
      expect(result.current.droppedFiles[0].name).toBe('file1.pdf')
      expect(result.current.droppedFiles[1].name).toBe('file2.pdf')
    })

    it('addFiles空数组不应该修改状态', () => {
      const { result } = renderHook(() => useDragDrop())

      act(() => {
        result.current.addFiles([])
      })

      expect(result.current.droppedFiles).toEqual([])
    })

    it('removeFile应该移除指定索引的文件', () => {
      const { result } = renderHook(() => useDragDrop())
      const files: LocalFileInfo[] = [
        createMockLocalFileInfo({ name: 'file1.pdf', path: '/path/file1.pdf' }),
        createMockLocalFileInfo({ name: 'file2.pdf', path: '/path/file2.pdf' }),
        createMockLocalFileInfo({ name: 'file3.pdf', path: '/path/file3.pdf' }),
      ]

      act(() => {
        result.current.addFiles(files)
        result.current.removeFile(1)
      })

      expect(result.current.droppedFiles).toHaveLength(2)
      expect(result.current.droppedFiles[0].name).toBe('file1.pdf')
      expect(result.current.droppedFiles[1].name).toBe('file3.pdf')
    })

    it('removeFile对无效索引应该发出警告但不报错', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      const { result } = renderHook(() => useDragDrop())

      act(() => {
        result.current.removeFile(-1)
        result.current.removeFile(0)
      })

      expect(consoleSpy).toHaveBeenCalledWith('[useDragDrop] Invalid file index: -1')
      expect(consoleSpy).toHaveBeenCalledWith('[useDragDrop] Invalid file index: 0')

      consoleSpy.mockRestore()
    })

    it('clearFiles应该清空所有文件', () => {
      const { result } = renderHook(() => useDragDrop())
      const files: LocalFileInfo[] = [
        createMockLocalFileInfo({ name: 'file1.pdf' }),
        createMockLocalFileInfo({ name: 'file2.pdf' }),
      ]

      act(() => {
        result.current.addFiles(files)
        result.current.clearFiles()
      })

      expect(result.current.droppedFiles).toEqual([])
    })
  })

  // ============================================================================
  // 文件验证测试
  // ============================================================================

  describe('文件验证', () => {
    it('validateFile应该返回null当文件有效时', () => {
      const { result } = renderHook(() => useDragDrop())
      const file = createMockLocalFileInfo({ size: 1024 })

      const error = result.current.validateFile(file)

      expect(error).toBeNull()
    })

    it('validateFile应该检查文件大小限制', () => {
      const { result } = renderHook(() => useDragDrop({ maxFileSize: 1000 }))
      const file = createMockLocalFileInfo({ size: 2000, name: 'large.pdf' })

      const error = result.current.validateFile(file)

      expect(error).not.toBeNull()
      expect(error?.code).toBe('FILE_TOO_LARGE')
      expect(error?.message).toContain('large.pdf')
    })

    it('validateFile应该检查文件扩展名', () => {
      const { result } = renderHook(() => useDragDrop({ allowedExtensions: ['.pdf', '.doc'] }))
      const file = createMockLocalFileInfo({ name: 'file.txt' })

      const error = result.current.validateFile(file)

      expect(error).not.toBeNull()
      expect(error?.code).toBe('EXTENSION_NOT_ALLOWED')
    })

    it('validateFile应该检查MIME类型', () => {
      const { result } = renderHook(() => useDragDrop({ allowedMimeTypes: ['application/pdf'] }))
      const file = createMockLocalFileInfo({ type: 'image/png' })

      const error = result.current.validateFile(file)

      expect(error).not.toBeNull()
      expect(error?.code).toBe('INVALID_FILE_TYPE')
    })

    it('validateFile应该检查作业的文件上传支持', () => {
      const assignment = createMockAssignment({ submission_types: ['online_text_entry'] })
      const { result } = renderHook(() => useDragDrop({ targetAssignment: assignment }))
      const file = createMockLocalFileInfo()

      const error = result.current.validateFile(file)

      expect(error).not.toBeNull()
      expect(error?.code).toBe('NO_FILE_UPLOAD_SUPPORT')
    })

    it('validateFile应该检查作业的允许扩展名', () => {
      const assignment = createMockAssignment({ allowed_extensions: ['.doc', '.docx'] })
      const { result } = renderHook(() => useDragDrop({ targetAssignment: assignment }))
      const file = createMockLocalFileInfo({ name: 'file.pdf' })

      const error = result.current.validateFile(file)

      expect(error).not.toBeNull()
      expect(error?.code).toBe('EXTENSION_NOT_ALLOWED')
    })

    it('application/octet-stream应该总是通过MIME类型验证', () => {
      const { result } = renderHook(() => useDragDrop({ allowedMimeTypes: ['application/pdf'] }))
      const file = createMockLocalFileInfo({ type: 'application/octet-stream' })

      const error = result.current.validateFile(file)

      expect(error).toBeNull()
    })
  })

  // ============================================================================
  // 拖拽文件处理测试
  // ============================================================================

  describe('拖拽文件处理 (handleDrop)', () => {
    it('空文件拖拽应该设置EMPTY_DROP错误', async () => {
      const { result } = renderHook(() => useDragDrop())
      const event = createMockDragEvent('drop', {
        dataTransfer: { files: [] } as unknown as React.DragEvent['dataTransfer'],
      })

      await act(async () => {
        await result.current.handleDrop(event)
      })

      expect(result.current.error).not.toBeNull()
      expect(result.current.error?.code).toBe('EMPTY_DROP')
      expect(result.current.dragState).toBe('idle')
    })

    it('多文件拖拽在allowMultiple=false时应该设置错误', async () => {
      const { result } = renderHook(() => useDragDrop({ allowMultiple: false }))
      const mockFiles = [createMockFile(), createMockFile()]
      const event = createMockDragEvent('drop', {
        dataTransfer: { files: mockFiles } as unknown as React.DragEvent['dataTransfer'],
      })

      await act(async () => {
        await result.current.handleDrop(event)
      })

      expect(result.current.error).not.toBeNull()
      expect(result.current.error?.code).toBe('MULTIPLE_FILES_NOT_SUPPORTED')
    })

    it('使用webkitRelativePath作为回退路径', async () => {
      const { result } = renderHook(() => useDragDrop())
      const mockFile = createMockFile({
        webkitRelativePath: '/fallback/path/document.pdf',
      } as Partial<File>)
      const event = createMockDragEvent('drop', {
        dataTransfer: { files: [mockFile] } as unknown as React.DragEvent['dataTransfer'],
      })

      await act(async () => {
        await result.current.handleDrop(event)
      })

      await waitFor(() => {
        expect(result.current.droppedFiles).toHaveLength(1)
        expect(result.current.droppedFiles[0].path).toBe('/fallback/path/document.pdf')
      })
    })

    it('使用Electron API获取文件路径', async () => {
      // 模拟Electron API
      (window as unknown as { electronAPI: { getPathForFile: jest.Mock } }).electronAPI = {
        getPathForFile: jest.fn().mockReturnValue('/electron/path/file.pdf'),
      }

      const { result } = renderHook(() => useDragDrop())
      const mockFile = createMockFile()
      const event = createMockDragEvent('drop', {
        dataTransfer: { files: [mockFile] } as unknown as React.DragEvent['dataTransfer'],
      })

      await act(async () => {
        await result.current.handleDrop(event)
      })

      await waitFor(() => {
        expect(result.current.droppedFiles).toHaveLength(1)
        expect(result.current.droppedFiles[0].path).toBe('/electron/path/file.pdf')
      })
    })

    it('无法获取路径时应该设置PATH_EXTRACTION_FAILED错误', async () => {
      const { result } = renderHook(() => useDragDrop())
      const mockFile = createMockFile()
      // 删除webkitRelativePath模拟路径获取失败
      Object.defineProperty(mockFile, 'webkitRelativePath', { value: '' })

      const event = createMockDragEvent('drop', {
        dataTransfer: { files: [mockFile] } as unknown as React.DragEvent['dataTransfer'],
      })

      await act(async () => {
        await result.current.handleDrop(event)
      })

      expect(result.current.error).not.toBeNull()
      expect(result.current.error?.code).toBe('PATH_EXTRACTION_FAILED')
    })

    it('处理多个文件拖拽', async () => {
      const { result } = renderHook(() => useDragDrop({ allowMultiple: true }))
      const mockFiles = [
        createMockFile({ name: 'doc1.pdf', webkitRelativePath: '/path/doc1.pdf' } as Partial<File>),
        createMockFile({ name: 'doc2.pdf', webkitRelativePath: '/path/doc2.pdf' } as Partial<File>),
        createMockFile({ name: 'doc3.pdf', webkitRelativePath: '/path/doc3.pdf' } as Partial<File>),
      ]
      const event = createMockDragEvent('drop', {
        dataTransfer: { files: mockFiles } as unknown as React.DragEvent['dataTransfer'],
      })

      await act(async () => {
        await result.current.handleDrop(event)
      })

      await waitFor(() => {
        expect(result.current.droppedFiles).toHaveLength(3)
        expect(result.current.droppedFiles[0].name).toBe('doc1.pdf')
        expect(result.current.droppedFiles[1].name).toBe('doc2.pdf')
        expect(result.current.droppedFiles[2].name).toBe('doc3.pdf')
      })
    })

    it('isProcessing应该在处理期间为true', async () => {
      const { result } = renderHook(() => useDragDrop())
      const mockFile = createMockFile({
        webkitRelativePath: '/path/file.pdf',
      } as Partial<File>)
      const event = createMockDragEvent('drop', {
        dataTransfer: { files: [mockFile] } as unknown as React.DragEvent['dataTransfer'],
      })

      // 开始处理前
      expect(result.current.isProcessing).toBe(false)

      // 触发drop
      await act(async () => {
        const dropPromise = result.current.handleDrop(event)
        // 在处理期间检查状态
        expect(result.current.isProcessing).toBe(true)
        await dropPromise
      })

      // 处理完成后
      expect(result.current.isProcessing).toBe(false)
    })
  })

  // ============================================================================
  // 回调函数测试
  // ============================================================================

  describe('回调函数', () => {
    it('onFilesAdded在添加文件时应该被调用', () => {
      const onFilesAdded = jest.fn()
      const { result } = renderHook(() => useDragDrop({ onFilesAdded }))
      const files: LocalFileInfo[] = [
        createMockLocalFileInfo({ name: 'file1.pdf' }),
        createMockLocalFileInfo({ name: 'file2.pdf' }),
      ]

      act(() => {
        result.current.addFiles(files)
      })

      expect(onFilesAdded).toHaveBeenCalledTimes(1)
      expect(onFilesAdded).toHaveBeenCalledWith(files)
    })

    it('onError在验证失败时应该被调用', () => {
      const onError = jest.fn()
      const { result } = renderHook(() =>
        useDragDrop({ onError, maxFileSize: 100, allowedExtensions: ['.doc'] })
      )
      const files: LocalFileInfo[] = [
        createMockLocalFileInfo({ name: 'large.pdf', size: 1000 }),
      ]

      act(() => {
        result.current.addFiles(files)
      })

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError.mock.calls[0][0]).toBeInstanceOf(DragDropException)
      expect(onError.mock.calls[0][0].code).toBe('FILE_TOO_LARGE')
    })

    it('onError在空文件拖拽时应该被调用', async () => {
      const onError = jest.fn()
      const { result } = renderHook(() => useDragDrop({ onError }))
      const event = createMockDragEvent('drop', {
        dataTransfer: { files: [] } as unknown as React.DragEvent['dataTransfer'],
      })

      await act(async () => {
        await result.current.handleDrop(event)
      })

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError.mock.calls[0][0].code).toBe('EMPTY_DROP')
    })
  })

  // ============================================================================
  // 状态管理测试
  // ============================================================================

  describe('状态管理', () => {
    it('clearError应该清除错误状态', () => {
      const { result } = renderHook(() => useDragDrop({ maxFileSize: 100 }))
      const files: LocalFileInfo[] = [createMockLocalFileInfo({ size: 1000 })]

      act(() => {
        result.current.addFiles(files)
      })

      expect(result.current.error).not.toBeNull()

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })

    it('reset应该重置所有状态', () => {
      const { result } = renderHook(() => useDragDrop())
      const files: LocalFileInfo[] = [createMockLocalFileInfo()]

      act(() => {
        result.current.addFiles(files)
        result.current.handleDragEnter(createMockDragEvent('dragenter'))
      })

      expect(result.current.droppedFiles).toHaveLength(1)
      expect(result.current.dragCounter).toBe(1)
      expect(result.current.dragState).toBe('dragenter')

      act(() => {
        result.current.reset()
      })

      expect(result.current.dragState).toBe('idle')
      expect(result.current.droppedFiles).toEqual([])
      expect(result.current.dragCounter).toBe(0)
      expect(result.current.error).toBeNull()
      expect(result.current.isProcessing).toBe(false)
    })
  })

  // ============================================================================
  // DragDropException测试
  // ============================================================================

  describe('DragDropException', () => {
    it('应该正确创建DragDropException', () => {
      const file = createMockFile()
      const error = new DragDropException('Test error', 'FILE_TOO_LARGE', file)

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(DragDropException)
      expect(error.message).toBe('Test error')
      expect(error.code).toBe('FILE_TOO_LARGE')
      expect(error.file).toBe(file)
      expect(error.name).toBe('DragDropException')
    })

    it('应该在没有文件的情况下工作', () => {
      const error = new DragDropException('Test error', 'EMPTY_DROP')

      expect(error.message).toBe('Test error')
      expect(error.code).toBe('EMPTY_DROP')
      expect(error.file).toBeUndefined()
    })
  })

  // ============================================================================
  // 边界情况测试
  // ============================================================================

  describe('边界情况', () => {
    it('应该处理非常大的文件', () => {
      const { result } = renderHook(() => useDragDrop())
      const largeFile = createMockLocalFileInfo({
        size: 5 * 1024 * 1024 * 1024, // 5GB - 默认最大值
        name: 'large.zip',
      })

      const error = result.current.validateFile(largeFile)
      expect(error).toBeNull() // 正好等于最大值应该通过
    })

    it('超过5GB的文件应该被阻止', () => {
      const { result } = renderHook(() => useDragDrop())
      const hugeFile = createMockLocalFileInfo({
        size: 5 * 1024 * 1024 * 1024 + 1, // 5GB + 1 byte
        name: 'huge.zip',
      })

      const error = result.current.validateFile(hugeFile)
      expect(error).not.toBeNull()
      expect(error?.code).toBe('FILE_TOO_LARGE')
    })

    it('应该处理没有扩展名的文件', () => {
      const { result } = renderHook(() => useDragDrop({ allowedExtensions: ['.pdf'] }))
      const file = createMockLocalFileInfo({ name: 'README' })

      const error = result.current.validateFile(file)
      expect(error).not.toBeNull()
      expect(error?.code).toBe('EXTENSION_NOT_ALLOWED')
    })

    it('应该处理空扩展名列表', () => {
      const { result } = renderHook(() => useDragDrop({ allowedExtensions: [] }))
      const file = createMockLocalFileInfo({ name: 'file.xyz' })

      const error = result.current.validateFile(file)
      expect(error).toBeNull() // 空列表允许所有
    })

    it('应该处理undefined扩展名列表', () => {
      const { result } = renderHook(() => useDragDrop({ allowedExtensions: undefined }))
      const file = createMockLocalFileInfo({ name: 'file.xyz' })

      const error = result.current.validateFile(file)
      expect(error).toBeNull() // undefined允许所有
    })

    it('应该处理大小写不同的扩展名', () => {
      const { result } = renderHook(() => useDragDrop({ allowedExtensions: ['.PDF', '.Doc'] }))

      const file1 = createMockLocalFileInfo({ name: 'file.pdf' })
      const file2 = createMockLocalFileInfo({ name: 'file.DOC' })

      expect(result.current.validateFile(file1)).toBeNull()
      expect(result.current.validateFile(file2)).toBeNull()
    })

    it('应该正确处理嵌套的拖拽进入/离开', () => {
      const { result } = renderHook(() => useDragDrop())
      const event = createMockDragEvent('dragenter')

      act(() => {
        result.current.handleDragEnter(event)
        result.current.handleDragEnter(event)
        result.current.handleDragEnter(event)
      })
      expect(result.current.dragCounter).toBe(3)
      expect(result.current.dragState).toBe('dragenter')

      const leaveEvent = createMockDragEvent('dragleave')
      act(() => {
        result.current.handleDragLeave(leaveEvent)
      })
      expect(result.current.dragCounter).toBe(2)
      expect(result.current.dragState).toBe('dragenter') // 仍然dragenter状态

      act(() => {
        result.current.handleDragLeave(leaveEvent)
        result.current.handleDragLeave(leaveEvent)
      })
      expect(result.current.dragCounter).toBe(0)
      expect(result.current.dragState).toBe('idle')
    })
  })

  // ============================================================================
  // 总大小计算测试
  // ============================================================================

  describe('文件总大小计算', () => {
    it('应该正确计算多个文件的总大小', () => {
      const { result } = renderHook(() => useDragDrop())
      const files: LocalFileInfo[] = [
        createMockLocalFileInfo({ size: 1024, name: 'file1.pdf' }),
        createMockLocalFileInfo({ size: 2048, name: 'file2.pdf' }),
        createMockLocalFileInfo({ size: 3072, name: 'file3.pdf' }),
      ]

      act(() => {
        result.current.addFiles(files)
      })

      const totalSize = result.current.droppedFiles.reduce((sum, file) => sum + file.size, 0)
      expect(totalSize).toBe(6144) // 1024 + 2048 + 3072
    })

    it('移除文件后总大小应该更新', () => {
      const { result } = renderHook(() => useDragDrop())
      const files: LocalFileInfo[] = [
        createMockLocalFileInfo({ size: 1000, name: 'file1.pdf' }),
        createMockLocalFileInfo({ size: 2000, name: 'file2.pdf' }),
        createMockLocalFileInfo({ size: 3000, name: 'file3.pdf' }),
      ]

      act(() => {
        result.current.addFiles(files)
        result.current.removeFile(1) // 移除第二个文件
      })

      const totalSize = result.current.droppedFiles.reduce((sum, file) => sum + file.size, 0)
      expect(totalSize).toBe(4000) // 1000 + 3000
    })
  })

  // ============================================================================
  // 复杂场景测试
  // ============================================================================

  describe('复杂场景', () => {
    it('应该处理混合有效和无效文件的添加', () => {
      const onFilesAdded = jest.fn()
      const onError = jest.fn()
      const { result } = renderHook(() =>
        useDragDrop({
          onFilesAdded,
          onError,
          maxFileSize: 1500,
          allowedExtensions: ['.pdf'],
        })
      )

      const files: LocalFileInfo[] = [
        createMockLocalFileInfo({ name: 'valid.pdf', size: 1000 }), // 有效
        createMockLocalFileInfo({ name: 'too_large.pdf', size: 2000 }), // 太大
        createMockLocalFileInfo({ name: 'invalid.txt', size: 500 }), // 扩展名无效
        createMockLocalFileInfo({ name: 'valid2.pdf', size: 1000 }), // 有效
      ]

      act(() => {
        result.current.addFiles(files)
      })

      // 应该只添加有效的文件
      expect(result.current.droppedFiles).toHaveLength(2)
      expect(result.current.droppedFiles[0].name).toBe('valid.pdf')
      expect(result.current.droppedFiles[1].name).toBe('valid2.pdf')

      // onFilesAdded应该被调用，但只有有效文件
      expect(onFilesAdded).toHaveBeenCalledTimes(1)
      expect(onFilesAdded.mock.calls[0][0]).toHaveLength(2)

      // 应该报告第一个错误
      expect(onError).toHaveBeenCalledTimes(1)
      expect(result.current.error?.code).toBe('FILE_TOO_LARGE')
    })

    it('完整的拖拽流程：enter -> over -> drop', async () => {
      const onFilesAdded = jest.fn()
      const { result } = renderHook(() => useDragDrop({ onFilesAdded, allowMultiple: true }))

      const mockFiles = [
        createMockFile({
          name: 'document.pdf',
          webkitRelativePath: '/home/user/document.pdf',
        } as Partial<File>),
      ]

      // 1. Drag Enter
      act(() => {
        result.current.handleDragEnter(createMockDragEvent('dragenter'))
      })
      expect(result.current.dragState).toBe('dragenter')
      expect(result.current.dragCounter).toBe(1)

      // 2. Drag Over
      act(() => {
        result.current.handleDragOver(createMockDragEvent('dragover'))
      })
      expect(result.current.dragState).toBe('dragover')

      // 3. Drop
      const dropEvent = createMockDragEvent('drop', {
        dataTransfer: { files: mockFiles } as unknown as React.DragEvent['dataTransfer'],
      })

      await act(async () => {
        await result.current.handleDrop(dropEvent)
      })

      await waitFor(() => {
        expect(result.current.droppedFiles).toHaveLength(1)
        expect(result.current.droppedFiles[0].name).toBe('document.pdf')
        expect(result.current.dragState).toBe('idle')
        expect(result.current.dragCounter).toBe(0)
      })

      expect(onFilesAdded).toHaveBeenCalled()
    })

    it('应该处理拖拽离开后的重新进入', () => {
      const { result } = renderHook(() => useDragDrop())

      // 进入
      act(() => {
        result.current.handleDragEnter(createMockDragEvent('dragenter'))
      })
      expect(result.current.dragState).toBe('dragenter')

      // 离开
      act(() => {
        result.current.handleDragLeave(createMockDragEvent('dragleave'))
      })
      expect(result.current.dragState).toBe('idle')

      // 重新进入
      act(() => {
        result.current.handleDragEnter(createMockDragEvent('dragenter'))
      })
      expect(result.current.dragState).toBe('dragenter')
    })
  })
})
