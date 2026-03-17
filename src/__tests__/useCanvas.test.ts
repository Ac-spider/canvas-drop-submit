/**
 * Canvas API Hook 单元测试
 * @module __tests__/useCanvas
 * @description 测试 useCanvas Hook（合并版本）
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useCanvas, CanvasAPIError, FileUploadError } from '../renderer/hooks/useCanvas'
import type { Course, Assignment, Submission, LocalFileInfo } from '../shared/types'

// ============================================================================
// Mock 全局 API
// ============================================================================

global.fetch = jest.fn()

// Mock XMLHttpRequest
type XHRMock = {
  open: jest.Mock
  send: jest.Mock
  setRequestHeader: jest.Mock
  upload: { addEventListener: jest.Mock }
  addEventListener: jest.Mock
  getResponseHeader: jest.Mock
  status: number
  statusText: string
  responseText: string
}

const mockXHR: XHRMock = {
  open: jest.fn(),
  send: jest.fn(),
  setRequestHeader: jest.fn(),
  upload: { addEventListener: jest.fn() },
  addEventListener: jest.fn(),
  getResponseHeader: jest.fn(),
  status: 200,
  statusText: 'OK',
  responseText: '',
}

global.XMLHttpRequest = jest.fn(() => mockXHR) as unknown as typeof XMLHttpRequest

// Mock window.electronAPI
declare global {
  interface Window {
    electronAPI?: {
      readFile?: (path: string) => Promise<Buffer | null>
    }
  }
}

Object.defineProperty(window, 'electronAPI', {
  value: {
    readFile: jest.fn().mockResolvedValue(Buffer.from('test file content')),
  },
  writable: true,
})

// ============================================================================
// 测试数据工厂
// ============================================================================

const mockCourse = (id: number, overrides?: Partial<Course>): Course => ({
  id,
  name: `Test Course ${id}`,
  course_code: `TEST${id}`,
  teachers: [{ id: 1, display_name: 'Test Teacher' }],
  term: { id: 1, name: '2024 Spring' },
  ...overrides,
})

const mockAssignment = (id: number, _courseId: number, overrides?: Partial<Assignment>): Assignment => ({
  id,
  name: `Test Assignment ${id}`,
  description: '<p>Test description</p>',
  due_at: '2024-12-31T23:59:59Z',
  submission_types: ['online_upload'],
  has_submitted_submissions: false,
  points_possible: 100,
  grading_type: 'points',
  ...overrides,
})

const mockSubmission = (id: number, overrides?: Partial<Submission>): Submission => ({
  id,
  submission_type: 'online_upload',
  submitted_at: new Date().toISOString(),
  workflow_state: 'submitted',
  late: false,
  missing: false,
  ...overrides,
})

// Note: mockFile helper removed as File objects are created directly in tests

// ============================================================================
// fetch Mock 辅助函数
// ============================================================================

const createMockResponse = <T>(data: T, status = 200, ok = true): Response =>
  ({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers(),
  }) as Response

const createMockErrorResponse = (status: number, message?: string): Response =>
  createMockResponse(
    {
      errors: [{ message: message || `HTTP ${status} Error` }],
      message: message || `HTTP ${status} Error`,
    },
    status,
    false
  )

// ============================================================================
// 测试套件: useCanvas Hook
// ============================================================================

describe('useCanvas Hook', () => {
  const API_TOKEN = '12345~testtoken123456789'

  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetch as jest.Mock).mockReset()
  })

  // ============================================================================
  // getCourses 测试
  // ============================================================================

  describe('getCourses', () => {
    it('should fetch courses successfully', async () => {
      const courses = [mockCourse(1), mockCourse(2)]
      ;(fetch as jest.Mock).mockResolvedValueOnce(createMockResponse(courses))

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      let fetchedCourses: Course[] | undefined
      await act(async () => {
        fetchedCourses = await result.current.getCourses()
      })

      expect(fetchedCourses).toEqual(courses)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/courses?enrollment_state=active'),
        expect.any(Object)
      )
    })

    it('should set loading state during fetch', async () => {
      (fetch as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockResponse([])), 10))
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      act(() => {
        result.current.getCourses()
      })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => expect(result.current.isLoading).toBe(false))
    })

    it('should handle 401 authentication error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockErrorResponse(401, 'Invalid access token')
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await expect(result.current.getCourses()).rejects.toThrow(CanvasAPIError)
      expect(result.current.error).toBeInstanceOf(CanvasAPIError)
      expect((result.current.error as CanvasAPIError | null)?.statusCode).toBe(401)
      expect(result.current.isLoading).toBe(false)
    })

    it('should handle 403 permission error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockErrorResponse(403, 'Insufficient permissions')
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await expect(result.current.getCourses()).rejects.toThrow(CanvasAPIError)
      expect((result.current.error as CanvasAPIError | null)?.statusCode).toBe(403)
    })

    it('should handle 404 not found error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockErrorResponse(404, 'Resource not found')
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await expect(result.current.getCourses()).rejects.toThrow(CanvasAPIError)
      expect((result.current.error as CanvasAPIError | null)?.statusCode).toBe(404)
    })

    it('should handle 429 rate limit error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockErrorResponse(429, 'Rate limit exceeded')
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await expect(result.current.getCourses()).rejects.toThrow(CanvasAPIError)
      expect((result.current.error as CanvasAPIError | null)?.statusCode).toBe(429)
    })

    it('should handle 500 server error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockErrorResponse(500, 'Internal server error')
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await expect(result.current.getCourses()).rejects.toThrow(CanvasAPIError)
      expect((result.current.error as CanvasAPIError | null)?.statusCode).toBe(500)
    })

    it('should handle network timeout', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network timeout'))

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await expect(result.current.getCourses()).rejects.toThrow()
      expect(result.current.error).toBeInstanceOf(CanvasAPIError)
    })
  })

  // ============================================================================
  // getAssignments 测试
  // ============================================================================

  describe('getAssignments', () => {
    it('should fetch assignments successfully', async () => {
      const assignments = [mockAssignment(1, 101), mockAssignment(2, 101)]
      const assignmentGroups = [
        {
          id: 1,
          name: 'Homework',
          position: 1,
          group_weight: 50,
          assignments: assignments,
        },
      ]
      ;(fetch as jest.Mock).mockResolvedValueOnce(createMockResponse(assignmentGroups))

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      let fetchedAssignments: Assignment[] | undefined
      await act(async () => {
        fetchedAssignments = await result.current.getAssignments(101)
      })

      expect(fetchedAssignments).toEqual(assignments)
      expect(result.current.isLoading).toBe(false)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/courses/101/assignment_groups'),
        expect.any(Object)
      )
    })

    it('should set loading state during fetch', async () => {
      (fetch as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockResponse([{ id: 1, name: 'Group', position: 1, group_weight: 100, assignments: [] }])), 10))
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      act(() => {
        result.current.getAssignments(101)
      })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => expect(result.current.isLoading).toBe(false))
    })

    it('should handle 401 authentication error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockErrorResponse(401, 'Invalid access token')
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await expect(result.current.getAssignments(101)).rejects.toThrow(CanvasAPIError)
      expect((result.current.error as CanvasAPIError | null)?.statusCode).toBe(401)
    })

    it('should handle 403 permission error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockErrorResponse(403, 'Cannot access this course')
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await expect(result.current.getAssignments(101)).rejects.toThrow(CanvasAPIError)
      expect((result.current.error as CanvasAPIError | null)?.statusCode).toBe(403)
    })

    it('should handle 404 course not found', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockErrorResponse(404, 'Course not found')
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await expect(result.current.getAssignments(999)).rejects.toThrow(CanvasAPIError)
      expect((result.current.error as CanvasAPIError | null)?.statusCode).toBe(404)
    })

    it('should handle 429 rate limit error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockErrorResponse(429, 'Rate limit exceeded')
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await expect(result.current.getAssignments(101)).rejects.toThrow(CanvasAPIError)
      expect((result.current.error as CanvasAPIError | null)?.statusCode).toBe(429)
    })

    it('should handle 500 server error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockErrorResponse(500, 'Internal server error')
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await expect(result.current.getAssignments(101)).rejects.toThrow(CanvasAPIError)
      expect((result.current.error as CanvasAPIError | null)?.statusCode).toBe(500)
    })

    it('should handle network error', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await expect(result.current.getAssignments(101)).rejects.toThrow()
      expect(result.current.error).toBeInstanceOf(CanvasAPIError)
    })
  })

  // ============================================================================
  // submitAssignment 测试
  // ============================================================================

  describe('submitAssignment', () => {
    it('should submit assignment with file IDs successfully', async () => {
      const submission = mockSubmission(1)
      ;(fetch as jest.Mock).mockResolvedValueOnce(createMockResponse(submission))

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      let submitted: typeof submission | undefined
      await act(async () => {
        submitted = await result.current.submitAssignment(101, 201, [301, 302])
      })

      expect(submitted).toEqual(submission)
      expect(result.current.isLoading).toBe(false)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/courses/101/assignments/201/submissions'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
          body: expect.stringContaining('submission%5Bsubmission_type%5D=online_upload'),
        })
      )
    })

    it('should submit assignment with comment', async () => {
      const submission = mockSubmission(1)
      ;(fetch as jest.Mock).mockResolvedValueOnce(createMockResponse(submission))

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await act(async () => {
        await result.current.submitAssignment(101, 201, [301], 'My comment')
      })

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('comment%5Btext_comment%5D=My%20comment'),
        })
      )
    })

    it('should set loading state during submission', async () => {
      (fetch as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockResponse(mockSubmission(1))), 10))
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      act(() => {
        result.current.submitAssignment(101, 201, [301])
      })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => expect(result.current.isLoading).toBe(false))
    })

    it('should handle 401 authentication error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockErrorResponse(401, 'Invalid access token')
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await expect(result.current.submitAssignment(101, 201, [301])).rejects.toThrow(CanvasAPIError)
      expect((result.current.error as CanvasAPIError | null)?.statusCode).toBe(401)
    })

    it('should handle 403 permission error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockErrorResponse(403, 'Cannot submit to this assignment')
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await expect(result.current.submitAssignment(101, 201, [301])).rejects.toThrow(CanvasAPIError)
      expect((result.current.error as CanvasAPIError | null)?.statusCode).toBe(403)
    })

    it('should handle 404 assignment not found', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockErrorResponse(404, 'Assignment not found')
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await expect(result.current.submitAssignment(101, 999, [301])).rejects.toThrow(CanvasAPIError)
      expect((result.current.error as CanvasAPIError | null)?.statusCode).toBe(404)
    })

    it('should handle 422 validation error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockErrorResponse(422, 'File IDs are required')
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await expect(result.current.submitAssignment(101, 201, [])).rejects.toThrow(CanvasAPIError)
      expect((result.current.error as CanvasAPIError | null)?.statusCode).toBe(422)
    })

    it('should handle 429 rate limit error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockErrorResponse(429, 'Rate limit exceeded')
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await expect(result.current.submitAssignment(101, 201, [301])).rejects.toThrow(CanvasAPIError)
      expect((result.current.error as CanvasAPIError | null)?.statusCode).toBe(429)
    })

    it('should handle 500 server error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockErrorResponse(500, 'Internal server error')
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await expect(result.current.submitAssignment(101, 201, [301])).rejects.toThrow(CanvasAPIError)
      expect((result.current.error as CanvasAPIError | null)?.statusCode).toBe(500)
    })

    it('should handle network error', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await expect(result.current.submitAssignment(101, 201, [301])).rejects.toThrow()
      expect(result.current.error).toBeInstanceOf(CanvasAPIError)
    })
  })

  // ============================================================================
  // uploadFile 测试
  // ============================================================================

  describe('uploadFile', () => {
    const mockFileUpload = new File(['test content'], 'test.pdf', { type: 'application/pdf' })

    beforeEach(() => {
      // Reset XHR mocks
      mockXHR.open.mockClear()
      mockXHR.send.mockClear()
      mockXHR.addEventListener.mockClear()
      mockXHR.upload.addEventListener.mockClear()
      mockXHR.getResponseHeader.mockClear()
    })

    it('should upload file successfully (three-step process)', async () => {
      // Step 1: Pre-request
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockResponse({
          upload_url: 'https://s3.amazonaws.com/upload',
          upload_params: { key: 'value', signature: 'abc123' },
        })
      )

      // Step 3: Confirm upload
      ;(fetch as jest.Mock).mockResolvedValueOnce(
        createMockResponse({
          id: 301,
          url: 'https://oc.sjtu.edu.cn/files/301',
          display_name: 'test.pdf',
        })
      )

      // Mock XHR for Step 2
      mockXHR.getResponseHeader.mockReturnValue('https://oc.sjtu.edu.cn/api/v1/files/301')
      mockXHR.status = 200

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      // Trigger XHR load callback
      let uploadPromise: Promise<any>
      await act(async () => {
        uploadPromise = result.current.uploadFile(101, mockFileUpload)

        // Simulate XHR events
        await new Promise((resolve) => setTimeout(resolve, 5))

        // Get the load callback and trigger it
        const loadCallback = mockXHR.addEventListener.mock.calls.find(
          (call) => call[0] === 'load'
        )?.[1]
        if (loadCallback) {
          loadCallback()
        }
      })

      const uploadResult = await uploadPromise!
      expect(uploadResult).toBeDefined()
      expect(uploadResult.id).toBe(301)
    })

    it('should report progress during upload', async () => {
      const progressCallback = jest.fn()

      // Step 1: Pre-request
      ;(fetch as jest.Mock).mockResolvedValueOnce(
        createMockResponse({
          upload_url: 'https://s3.amazonaws.com/upload',
          upload_params: { key: 'value' },
        })
      )

      // Step 3: Confirm upload
      ;(fetch as jest.Mock).mockResolvedValueOnce(
        createMockResponse({
          id: 301,
          url: 'https://oc.sjtu.edu.cn/files/301',
          display_name: 'test.pdf',
        })
      )

      mockXHR.getResponseHeader.mockReturnValue('https://oc.sjtu.edu.cn/api/v1/files/301')

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await act(async () => {
        const uploadPromise = result.current.uploadFile(101, mockFileUpload, progressCallback)
        await new Promise((resolve) => setTimeout(resolve, 5))

        // Trigger progress event
        const progressCallbackFn = mockXHR.upload.addEventListener.mock.calls.find(
          (call) => call[0] === 'progress'
        )?.[1]
        if (progressCallbackFn) {
          progressCallbackFn({ lengthComputable: true, loaded: 50, total: 100 })
        }

        // Trigger load event
        const loadCallback = mockXHR.addEventListener.mock.calls.find(
          (call) => call[0] === 'load'
        )?.[1]
        if (loadCallback) {
          loadCallback()
        }

        await uploadPromise
      })

      expect(progressCallback).toHaveBeenCalled()
    })

    it('should handle pre-request failure', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockErrorResponse(400, 'Invalid file parameters')
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await expect(result.current.uploadFile(101, mockFileUpload)).rejects.toThrow(CanvasAPIError)
    })

    it('should handle S3 upload failure', async () => {
      // Step 1: Pre-request succeeds
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockResponse({
          upload_url: 'https://s3.amazonaws.com/upload',
          upload_params: { key: 'value' },
        })
      )

      mockXHR.status = 403
      mockXHR.statusText = 'Forbidden'

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await act(async () => {
        const uploadPromise = result.current.uploadFile(101, mockFileUpload)
        await new Promise((resolve) => setTimeout(resolve, 5))

        // Trigger error event
        const errorCallback = mockXHR.addEventListener.mock.calls.find(
          (call) => call[0] === 'error'
        )?.[1]
        if (errorCallback) {
          errorCallback()
        }

        await expect(uploadPromise).rejects.toThrow()
      })
    })

    it('should handle missing Location header', async () => {
      // Step 1: Pre-request
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockResponse({
          upload_url: 'https://s3.amazonaws.com/upload',
          upload_params: { key: 'value' },
        })
      )

      mockXHR.getResponseHeader.mockReturnValue(null)
      mockXHR.status = 200

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await act(async () => {
        const uploadPromise = result.current.uploadFile(101, mockFileUpload)
        await new Promise((resolve) => setTimeout(resolve, 5))

        const loadCallback = mockXHR.addEventListener.mock.calls.find(
          (call) => call[0] === 'load'
        )?.[1]
        if (loadCallback) {
          loadCallback()
        }

        await expect(uploadPromise).rejects.toThrow()
      })
    })

    it('should handle upload abort', async () => {
      // Step 1: Pre-request
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockResponse({
          upload_url: 'https://s3.amazonaws.com/upload',
          upload_params: { key: 'value' },
        })
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await act(async () => {
        const uploadPromise = result.current.uploadFile(101, mockFileUpload)
        await new Promise((resolve) => setTimeout(resolve, 5))

        // Trigger abort event
        const abortCallback = mockXHR.addEventListener.mock.calls.find(
          (call) => call[0] === 'abort'
        )?.[1]
        if (abortCallback) {
          abortCallback()
        }

        await expect(uploadPromise).rejects.toThrow()
      })
    })

    it('should cancel previous upload when starting new one', async () => {
      // Step 1: Pre-request
      (fetch as jest.Mock).mockResolvedValue(
        createMockResponse({
          upload_url: 'https://s3.amazonaws.com/upload',
          upload_params: { key: 'value' },
        })
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      // Start first upload
      const firstUpload = result.current.uploadFile(101, mockFileUpload)

      // Start second upload (should abort first)
      result.current.uploadFile(101, mockFileUpload)

      await expect(firstUpload).rejects.toThrow()
    })
  })

  // ============================================================================
  // clearError 测试
  // ============================================================================

  describe('clearError', () => {
    it('should clear error state', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockErrorResponse(401, 'Invalid token')
      )

      const { result } = renderHook(() => useCanvas(API_TOKEN))

      await act(async () => {
        try {
          await result.current.getCourses()
        } catch {
          // Expected to throw
        }
      })

      expect(result.current.error).not.toBeNull()

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })
})

// ============================================================================
// CanvasAPIError 类测试
// ============================================================================

describe('CanvasAPIError', () => {
  it('should create error with message only', () => {
    const error = new CanvasAPIError('Test error')
    expect(error.message).toBe('Test error')
    expect(error.name).toBe('CanvasAPIError')
    expect(error.statusCode).toBeUndefined()
  })

  it('should create error with status code', () => {
    const error = new CanvasAPIError('Test error', 404)
    expect(error.message).toBe('Test error')
    expect(error.statusCode).toBe(404)
  })

  it('should create error with response data', () => {
    const response = { errors: [{ message: 'Detailed error' }] }
    const error = new CanvasAPIError('Test error', 400, response)
    expect(error.response).toEqual(response)
  })
})

// ============================================================================
// FileUploadError 类测试
// ============================================================================

describe('FileUploadError', () => {
  it('should create error with message and step', () => {
    const error = new FileUploadError('Upload failed', 'pre-request')
    expect(error.message).toBe('Upload failed')
    expect(error.name).toBe('FileUploadError')
    expect(error.step).toBe('pre-request')
  })

  it('should create error with step information', () => {
    const error = new FileUploadError('Upload failed', 's3-upload')
    expect(error.message).toBe('Upload failed')
    expect(error.step).toBe('s3-upload')
  })
})
