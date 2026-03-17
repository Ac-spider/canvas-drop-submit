/**
 * Canvas API 服务层测试
 * @module __tests__/canvasApi
 * @description 测试 CanvasApiClient 的完整功能
 */

import {
  CanvasApiClient,
  createCanvasApiClient,
  CanvasAPIError,
  FileUploadError,
  CANVAS_API_BASE_URL,
} from '../renderer/services/canvasApi';
import type { Course, Assignment, Submission, FileAttachment } from '../shared/types';

// ============================================================================
// Mock 全局 API
// ============================================================================

global.fetch = jest.fn();

// Mock XMLHttpRequest
type XHRMock = {
  open: jest.Mock;
  send: jest.Mock;
  setRequestHeader: jest.Mock;
  upload: { addEventListener: jest.Mock };
  addEventListener: jest.Mock;
  getResponseHeader: jest.Mock;
  status: number;
  statusText: string;
  responseText: string;
};

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
};

global.XMLHttpRequest = jest.fn(() => mockXHR) as unknown as typeof XMLHttpRequest;

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
});

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
});

const mockSubmission = (id: number, overrides?: Partial<Submission>): Submission => ({
  id,
  submission_type: 'online_upload',
  submitted_at: new Date().toISOString(),
  workflow_state: 'submitted',
  late: false,
  missing: false,
  ...overrides,
});

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
    headers: new Headers({ 'content-type': 'application/json' }),
  }) as Response;

const createMockErrorResponse = (status: number, message?: string): Response =>
  createMockResponse(
    {
      errors: [{ message: message || `HTTP ${status} Error` }],
      message: message || `HTTP ${status} Error`,
    },
    status,
    false
  );

const createMockTextErrorResponse = (status: number, text: string): Response =>
  ({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.reject(new Error('Not JSON')),
    text: () => Promise.resolve(text),
    headers: new Headers({ 'content-type': 'text/plain' }),
  }) as Response;

// ============================================================================
// 测试套件: CanvasApiClient
// ============================================================================

describe('CanvasApiClient', () => {
  const API_TOKEN = '12345~testtoken123456789';
  let client: CanvasApiClient;

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockReset();
    client = createCanvasApiClient(API_TOKEN);
  });

  // ============================================================================
  // 构造函数和配置
  // ============================================================================

  describe('constructor', () => {
    it('should create client with default base URL', () => {
      const defaultClient = createCanvasApiClient(API_TOKEN);
      expect(defaultClient).toBeInstanceOf(CanvasApiClient);
    });

    it('should create client with custom base URL', () => {
      const customClient = new CanvasApiClient({
        apiToken: API_TOKEN,
        baseUrl: 'https://custom.canvas.com/api/v1',
      });
      expect(customClient).toBeInstanceOf(CanvasApiClient);
    });

    it('should allow updating token', () => {
      client.setToken('new-token');
      // Token is private, but we can verify it works by making a request
      (fetch as jest.Mock).mockResolvedValueOnce(createMockResponse({ id: 1 }));
      client.getCourses();
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer new-token',
          }),
        })
      );
    });
  });

  // ============================================================================
  // HTTP 方法
  // ============================================================================

  describe('HTTP methods', () => {
    describe('get', () => {
      it('should send GET request with auth headers', async () => {
        const data = { id: 1, name: 'Test' };
        (fetch as jest.Mock).mockResolvedValueOnce(createMockResponse(data));

        const result = await client.get<typeof data>('/test');

        expect(result).toEqual(data);
        expect(fetch).toHaveBeenCalledWith(
          `${CANVAS_API_BASE_URL}/test`,
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              Authorization: `Bearer ${API_TOKEN}`,
              Accept: 'application/json+canvas-string-ids',
            }),
          })
        );
      });

      it('should handle 401 authentication error', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce(createMockErrorResponse(401, 'Invalid access token'));

        await expect(client.get('/test')).rejects.toThrow('Invalid access token');
      });

      it('should handle non-JSON error response', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce(createMockTextErrorResponse(500, 'Internal Server Error'));

        await expect(client.get('/test')).rejects.toThrow('Internal Server Error');
      });

      it('should handle empty error response', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce(
          createMockResponse(null, 500, false)
        );

        await expect(client.get('/test')).rejects.toThrow(CanvasAPIError);
      });
    });

    describe('post', () => {
      it('should send POST request with JSON body', async () => {
        const data = { id: 1 };
        (fetch as jest.Mock).mockResolvedValueOnce(createMockResponse(data));

        const result = await client.post<typeof data>('/test', { name: 'Test' });

        expect(result).toEqual(data);
        expect(fetch).toHaveBeenCalledWith(
          `${CANVAS_API_BASE_URL}/test`,
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify({ name: 'Test' }),
          })
        );
      });

      it('should send POST request with form data body', async () => {
        const data = { id: 1 };
        (fetch as jest.Mock).mockResolvedValueOnce(createMockResponse(data));

        const formData = new URLSearchParams();
        formData.append('key', 'value');

        await client.post('/test', formData);

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': 'application/x-www-form-urlencoded',
            }),
            body: formData.toString(),
          })
        );
      });
    });
  });

  // ============================================================================
  // API 方法：用户
  // ============================================================================

  describe('validateToken', () => {
    it('should return valid for successful response', async () => {
      const userData = { id: 1, name: 'Test User' };
      (fetch as jest.Mock).mockResolvedValueOnce(createMockResponse(userData));

      const result = await client.validateToken();

      expect(result.valid).toBe(true);
      expect(result.user).toEqual(userData);
    });

    it('should return invalid for 401 response', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(createMockErrorResponse(401, 'Invalid token'));

      const result = await client.validateToken();

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    it('should return invalid for network error', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await client.validateToken();

      expect(result.valid).toBe(false);
      expect(result.error).toBe('网络错误，请检查连接');
    });
  });

  // ============================================================================
  // API 方法：课程
  // ============================================================================

  describe('getCourses', () => {
    it('should fetch courses successfully', async () => {
      const courses = [mockCourse(1), mockCourse(2)];
      (fetch as jest.Mock).mockResolvedValueOnce(createMockResponse(courses));

      const result = await client.getCourses();

      expect(result).toEqual(courses);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/courses?enrollment_state=active'),
        expect.any(Object)
      );
    });
  });

  // ============================================================================
  // API 方法：作业
  // ============================================================================

  describe('getAssignments', () => {
    it('should fetch assignments for course', async () => {
      const assignments = [mockAssignment(1, 101), mockAssignment(2, 101)];
      (fetch as jest.Mock).mockResolvedValueOnce(createMockResponse(assignments));

      const result = await client.getAssignments(101);

      expect(result).toEqual(assignments);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/courses/101/assignments'),
        expect.any(Object)
      );
    });
  });

  describe('submitAssignment', () => {
    it('should submit assignment with file IDs', async () => {
      const submission = mockSubmission(1);
      (fetch as jest.Mock).mockResolvedValueOnce(createMockResponse(submission));

      const result = await client.submitAssignment(101, 201, [301, 302]);

      expect(result).toEqual(submission);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/courses/101/assignments/201/submissions'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('submission%5Bsubmission_type%5D=online_upload'),
        })
      );
    });

    it('should submit assignment with comment', async () => {
      const submission = mockSubmission(1);
      (fetch as jest.Mock).mockResolvedValueOnce(createMockResponse(submission));

      await client.submitAssignment(101, 201, [301], 'My comment');

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('comment%5Btext_comment%5D=My+comment'),
        })
      );
    });
  });

  // ============================================================================
  // API 方法：文件上传
  // ============================================================================

  describe('validateFile', () => {
    it('should throw error for null file', () => {
      expect(() => client.validateFile(null as unknown as File)).toThrow(FileUploadError);
    });

    it('should throw error for file exceeding max size', () => {
      const largeFile = new File([''], 'large.pdf', { type: 'application/pdf' });
      Object.defineProperty(largeFile, 'size', { value: 6 * 1024 * 1024 * 1024 }); // 6GB

      expect(() => client.validateFile(largeFile)).toThrow('文件大小超过限制');
    });

    it('should not throw for valid file', () => {
      const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      expect(() => client.validateFile(validFile)).not.toThrow();
    });
  });

  describe('initiateFileUpload', () => {
    it('should initiate file upload successfully', async () => {
      const preResponse = {
        upload_url: 'https://s3.amazonaws.com/upload',
        upload_params: { key: 'value', signature: 'abc123' },
      };
      (fetch as jest.Mock).mockResolvedValueOnce(createMockResponse(preResponse));

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const result = await client.initiateFileUpload(101, file);

      expect(result).toEqual(preResponse);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/courses/101/files'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"name":"test.pdf"'),
        })
      );
    });
  });

  describe('uploadToS3', () => {
    const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    beforeEach(() => {
      mockXHR.open.mockClear();
      mockXHR.send.mockClear();
      mockXHR.addEventListener.mockClear();
      mockXHR.upload.addEventListener.mockClear();
      mockXHR.getResponseHeader.mockClear();
      mockXHR.status = 200;
      mockXHR.responseText = JSON.stringify({ id: 301, display_name: 'test.pdf', url: 'https://example.com/file', size: 1000 });
    });

    it('should upload file successfully', async () => {
      const uploadPromise = client.uploadToS3(
        'https://s3.amazonaws.com/upload',
        { key: 'value' },
        mockFile
      );

      // Simulate XHR load
      const loadCallback = mockXHR.addEventListener.mock.calls.find(
        (call) => call[0] === 'load'
      )?.[1];

      if (loadCallback) {
        loadCallback();
      }

      const result = await uploadPromise;
      expect(result.id).toBe(301);
    });

    it('should report progress during upload', async () => {
      const progressCallback = jest.fn();

      const uploadPromise = client.uploadToS3(
        'https://s3.amazonaws.com/upload',
        { key: 'value' },
        mockFile,
        progressCallback
      );

      // Simulate progress
      const progressCallbackFn = mockXHR.upload.addEventListener.mock.calls.find(
        (call) => call[0] === 'progress'
      )?.[1];

      if (progressCallbackFn) {
        progressCallbackFn({ lengthComputable: true, loaded: 50, total: 100 });
      }

      // Simulate load
      const loadCallback = mockXHR.addEventListener.mock.calls.find(
        (call) => call[0] === 'load'
      )?.[1];
      if (loadCallback) {
        loadCallback();
      }

      await uploadPromise;
      expect(progressCallback).toHaveBeenCalledWith(50);
    });

    it('should handle upload error', async () => {
      mockXHR.status = 403;

      const uploadPromise = client.uploadToS3(
        'https://s3.amazonaws.com/upload',
        { key: 'value' },
        mockFile
      );

      // Simulate error
      const errorCallback = mockXHR.addEventListener.mock.calls.find(
        (call) => call[0] === 'error'
      )?.[1];

      if (errorCallback) {
        errorCallback();
      }

      await expect(uploadPromise).rejects.toThrow(FileUploadError);
    });

    it('should handle upload abort', async () => {
      const uploadPromise = client.uploadToS3(
        'https://s3.amazonaws.com/upload',
        { key: 'value' },
        mockFile
      );

      // Simulate abort
      const abortCallback = mockXHR.addEventListener.mock.calls.find(
        (call) => call[0] === 'abort'
      )?.[1];

      if (abortCallback) {
        abortCallback();
      }

      await expect(uploadPromise).rejects.toThrow('上传已取消');
    });
  });

  describe('uploadFile', () => {
    const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    beforeEach(() => {
      mockXHR.open.mockClear();
      mockXHR.send.mockClear();
      mockXHR.addEventListener.mockClear();
      mockXHR.upload.addEventListener.mockClear();
      mockXHR.getResponseHeader.mockClear();
      mockXHR.status = 200;
      mockXHR.responseText = JSON.stringify({ id: 301, display_name: 'test.pdf', url: 'https://example.com/file', size: 1000 });
    });

    it('should complete full upload flow', async () => {
      // Step 1: Pre-request
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockResponse({
          upload_url: 'https://s3.amazonaws.com/upload',
          upload_params: { key: 'value' },
        })
      );

      const progressCallback = jest.fn();
      const uploadPromise = client.uploadFile(101, mockFile, progressCallback);

      // Simulate XHR load
      await new Promise((resolve) => setTimeout(resolve, 5));
      const loadCallback = mockXHR.addEventListener.mock.calls.find(
        (call) => call[0] === 'load'
      )?.[1];
      if (loadCallback) {
        loadCallback();
      }

      const result = await uploadPromise;
      expect(result.id).toBe(301);
      expect(progressCallback).toHaveBeenCalledWith(0);
      expect(progressCallback).toHaveBeenCalledWith(10);
      expect(progressCallback).toHaveBeenCalledWith(100);
    });

    it('should throw error for invalid file', async () => {
      const largeFile = new File([''], 'large.pdf', { type: 'application/pdf' });
      Object.defineProperty(largeFile, 'size', { value: 6 * 1024 * 1024 * 1024 });

      await expect(client.uploadFile(101, largeFile)).rejects.toThrow(FileUploadError);
    });
  });

  // ============================================================================
  // 错误处理
  // ============================================================================

  describe('error handling', () => {
    it('should provide specific error messages for HTTP status codes', async () => {
      const testCases = [
        { status: 400, expected: '请求参数错误' },
        { status: 401, expected: 'API Token 无效或已过期' },
        { status: 403, expected: '权限不足，无法访问此资源' },
        { status: 404, expected: '请求的资源不存在' },
        { status: 429, expected: '请求过于频繁，请稍后重试' },
        { status: 500, expected: '服务器内部错误' },
        { status: 999, expected: 'HTTP 999 错误' },
      ];

      for (const { status, expected } of testCases) {
        (fetch as jest.Mock).mockResolvedValueOnce(
          createMockResponse(null, status, false)
        );

        await expect(client.get('/test')).rejects.toThrow(expected);
        jest.clearAllMocks();
      }
    });

    it('should extract error message from Canvas API format', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        createMockResponse({ errors: [{ message: 'Custom error message' }] }, 400, false)
      );

      await expect(client.get('/test')).rejects.toThrow('Custom error message');
    });
  });
});

// ============================================================================
// 错误类测试
// ============================================================================

describe('CanvasAPIError', () => {
  it('should create error with message only', () => {
    const error = new CanvasAPIError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('CanvasAPIError');
    expect(error.statusCode).toBeUndefined();
  });

  it('should create error with status code', () => {
    const error = new CanvasAPIError('Test error', 404);
    expect(error.statusCode).toBe(404);
  });

  it('should create error with response data', () => {
    const response = { errors: [{ message: 'Detailed error' }] };
    const error = new CanvasAPIError('Test error', 400, response);
    expect(error.response).toEqual(response);
  });
});

describe('FileUploadError', () => {
  it('should create error with message and step', () => {
    const error = new FileUploadError('Upload failed', 'pre-request');
    expect(error.message).toBe('Upload failed');
    expect(error.name).toBe('FileUploadError');
    expect(error.step).toBe('pre-request');
  });

  it('should create error with original error', () => {
    const originalError = new Error('Original');
    const error = new FileUploadError('Upload failed', 's3-upload', originalError);
    expect(error.originalError).toBe(originalError);
  });
});
