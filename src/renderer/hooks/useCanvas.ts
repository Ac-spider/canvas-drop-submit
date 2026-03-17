/**
 * Canvas API Hook - 最终合并版本
 * @module hooks/useCanvas
 * @description 综合了激进派的现代化实现和保守派的类型安全/错误处理
 *
 * @example
 * ```typescript
 * const { getCourses, getAssignments, uploadFile, submitAssignment, isLoading, error } = useCanvas(apiToken);
 * ```
 */

import { useState, useCallback, useRef } from 'react';
import type {
  Course,
  Assignment,
  AssignmentGroup,
  Submission,
  FileAttachment,
  FileUploadPreResponse,
} from '../../shared/types';

// ============================================================================
// 常量定义
// ============================================================================

/** Canvas API基础URL */
const CANVAS_API_BASE_URL = 'https://oc.sjtu.edu.cn/api/v1';

/** 最大文件大小（5GB，Canvas限制） */
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;

/** API请求超时时间（毫秒） - 保留供将来使用 */
// const API_TIMEOUT = 30000;

/** 上传请求超时时间（毫秒） - 保留供将来使用 */
// const UPLOAD_TIMEOUT = 300000;

// ============================================================================
// 错误类定义
// ============================================================================

/**
 * Canvas API错误类
 * 提供结构化的错误信息，包含状态码、错误消息和原始错误
 */
export class CanvasAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'CanvasAPIError';
  }
}

/**
 * 文件上传错误类
 */
export class FileUploadError extends Error {
  constructor(
    message: string,
    public step: 'pre-request' | 's3-upload' | 'confirmation',
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'FileUploadError';
  }
}

// ============================================================================
// Hook返回类型
// ============================================================================

/**
 * useCanvas Hook返回类型
 */
export interface UseCanvasReturn {
  /** 获取课程列表 */
  getCourses: () => Promise<Course[]>;
  /** 获取作业列表 */
  getAssignments: (courseId: number) => Promise<Assignment[]>;
  /** 上传文件（三步流程） */
  uploadFile: (
    courseId: number,
    file: File,
    onProgress?: (percent: number) => void
  ) => Promise<FileAttachment>;
  /** 提交作业 */
  submitAssignment: (
    courseId: number,
    assignmentId: number,
    fileIds: number[],
    comment?: string
  ) => Promise<Submission>;
  /** 验证Token */
  validateToken: () => Promise<{ valid: boolean; error?: string; statusCode?: number }>;
  /** 取消当前上传 */
  cancelUpload: () => void;
  /** 加载状态 */
  isLoading: boolean;
  /** 上传进度（0-100） */
  uploadProgress: number;
  /** 当前操作描述 */
  currentOperation: string;
  /** 错误信息 */
  error: CanvasAPIError | null;
  /** 清除错误 */
  clearError: () => void;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 验证文件信息
 * @param file - 文件对象
 * @throws Error 当文件信息无效时
 */
function validateFile(file: File): void {
  if (!file) {
    throw new Error('文件不能为空');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `文件大小超过限制 (${(MAX_FILE_SIZE / 1024 / 1024 / 1024).toFixed(1)}GB)`
    );
  }
}

// ============================================================================
// 主Hook实现
// ============================================================================

/**
 * Canvas API Hook
 * 综合了现代化实现和完整的错误处理
 *
 * @param apiToken - Canvas API Token
 * @returns UseCanvasReturn对象
 */
export function useCanvas(apiToken: string): UseCanvasReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentOperation, setCurrentOperation] = useState('');
  const [error, setError] = useState<CanvasAPIError | null>(null);

  // AbortController用于取消上传
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 创建请求配置
   */
  const createRequestConfig = useCallback(
    (options: RequestInit = {}): RequestInit => ({
      ...options,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: 'application/json+canvas-string-ids',
        ...(options.headers || {}),
      },
      signal: abortControllerRef.current?.signal,
    }),
    [apiToken]
  );

  /**
   * 处理API响应
   */
  const handleResponse = useCallback(async <T>(response: Response): Promise<T> => {
    if (!response.ok) {
      // 防御性：处理非JSON错误响应
      let errorData: unknown = null;
      let message: string;

      try {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          errorData = await response.json();
          message = (errorData as { errors?: Array<{ message?: string }> })?.errors?.[0]?.message || `HTTP ${response.status}`;
        } else {
          const text = await response.text();
          message = text || `HTTP ${response.status}`;
          errorData = { rawResponse: text };
        }
      } catch {
        message = `HTTP ${response.status}: ${response.statusText}`;
      }

      throw new CanvasAPIError(message, response.status, errorData);
    }
    return response.json() as Promise<T>;
  }, []);

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * 取消当前上传
   */
  const cancelUpload = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
    setCurrentOperation('');
  }, []);

  /**
   * 验证API Token
   * @returns 验证结果，包含详细错误信息
   */
  const validateToken = useCallback(async (): Promise<{
    valid: boolean;
    error?: string;
    statusCode?: number;
  }> => {
    try {
      const response = await fetch(
        `${CANVAS_API_BASE_URL}/users/self`,
        createRequestConfig()
      );

      if (response.ok) {
        return { valid: true };
      }

      // 防御性：提取详细错误信息
      let errorMessage: string;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData?.errors?.[0]?.message || `验证失败: HTTP ${response.status}`;
        } else {
          const text = await response.text();
          errorMessage = text || `验证失败: HTTP ${response.status}`;
        }
      } catch {
        errorMessage = `验证失败: HTTP ${response.status}`;
      }

      return { valid: false, error: errorMessage, statusCode: response.status };
    } catch (err) {
      // 保留原始错误信息
      const errorMessage = err instanceof Error ? err.message : '网络错误，请检查连接';
      return { valid: false, error: errorMessage };
    }
  }, [createRequestConfig]);

  /**
   * 获取课程列表
   */
  const getCourses = useCallback(async (): Promise<Course[]> => {
    setIsLoading(true);
    setCurrentOperation('获取课程列表...');
    setError(null);

    try {
      const response = await fetch(
        `${CANVAS_API_BASE_URL}/courses?enrollment_state=active&include[]=teachers&include[]=term&per_page=100`,
        createRequestConfig()
      );
      const data = await handleResponse<Course[]>(response);
      return data;
    } catch (err) {
      const message = err instanceof CanvasAPIError ? err.message : '获取课程列表失败';
      setError(new CanvasAPIError(message));
      throw err;
    } finally {
      setIsLoading(false);
      setCurrentOperation('');
    }
  }, [createRequestConfig, handleResponse]);

  /**
   * 获取作业列表
   * 使用 assignment_groups API 获取所有作业（包括历史作业）
   */
  const getAssignments = useCallback(
    async (courseId: number): Promise<Assignment[]> => {
      setIsLoading(true);
      setCurrentOperation('获取作业列表...');
      setError(null);

      try {
        // 使用 assignment_groups API 获取所有作业，无日期过滤
        const response = await fetch(
          `${CANVAS_API_BASE_URL}/courses/${courseId}/assignment_groups?` +
            `exclude_assignment_submission_types[]=wiki_page&` +
            `include[]=assignments&` +
            `include[]=submission&` +
            `override_assignment_dates=true&` +
            `per_page=50`,
          createRequestConfig()
        );
        const data = await handleResponse<AssignmentGroup[]>(response);

        // 从 assignment_groups 中提取所有作业
        const allAssignments: Assignment[] = [];
        for (const group of data) {
          if (group.assignments) {
            for (const assignment of group.assignments) {
              allAssignments.push(assignment);
            }
          }
        }

        // 按截止日期排序（有截止日期的在前，按时间升序）
        allAssignments.sort((a, b) => {
          if (!a.due_at && !b.due_at) return 0;
          if (!a.due_at) return 1;
          if (!b.due_at) return -1;
          return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
        });

        return allAssignments;
      } catch (err) {
        const message = err instanceof CanvasAPIError ? err.message : '获取作业列表失败';
        setError(new CanvasAPIError(message));
        throw err;
      } finally {
        setIsLoading(false);
        setCurrentOperation('');
      }
    },
    [createRequestConfig, handleResponse]
  );

  /**
   * 文件上传 - 步骤1: 预请求
   */
  const initiateFileUpload = useCallback(
    async (courseId: number, file: File): Promise<FileUploadPreResponse> => {
      const response = await fetch(
        `${CANVAS_API_BASE_URL}/courses/${courseId}/files`,
        createRequestConfig({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            content_type: file.type || 'application/octet-stream',
            parent_folder_path: '/',
          }),
        })
      );
      return handleResponse<FileUploadPreResponse>(response);
    },
    [createRequestConfig, handleResponse]
  );

  /**
   * 文件上传 - 步骤2: 上传到S3（使用XMLHttpRequest支持进度）
   */
  const uploadToS3 = useCallback(
    async (
      uploadUrl: string,
      uploadParams: Record<string, string>,
      file: File,
      onProgress?: (percent: number) => void
    ): Promise<FileAttachment> => {
      const formData = new FormData();

      // 必须先添加所有upload_params
      Object.entries(uploadParams).forEach(([key, value]) => {
        formData.append(key, value);
      });

      // file必须是最后一个参数
      formData.append('file', file);

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // 进度监听
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } catch {
              reject(new FileUploadError('解析上传响应失败', 's3-upload'));
            }
          } else {
            reject(new FileUploadError(`上传失败: HTTP ${xhr.status}`, 's3-upload'));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new FileUploadError('网络错误，上传失败', 's3-upload'));
        });

        xhr.addEventListener('abort', () => {
          reject(new FileUploadError('上传已取消', 's3-upload'));
        });

        xhr.open('POST', uploadUrl);
        xhr.send(formData);
      });
    },
    []
  );

  /**
   * 完整文件上传流程（三步）
   */
  const uploadFile = useCallback(
    async (
      courseId: number,
      file: File,
      onProgress?: (percent: number) => void
    ): Promise<FileAttachment> => {
      // 验证文件
      validateFile(file);

      setIsLoading(true);
      setUploadProgress(0);
      setCurrentOperation('准备上传...');
      setError(null);

      // 创建新的AbortController
      abortControllerRef.current = new AbortController();

      try {
        // Step 1: 预请求获取上传URL
        setCurrentOperation('获取上传地址...');
        onProgress?.(0);
        const { upload_url, upload_params } = await initiateFileUpload(courseId, file);

        // Step 2: 上传到S3（带进度）
        setCurrentOperation('上传文件中...');
        onProgress?.(10);
        const uploadResult = await uploadToS3(
          upload_url,
          upload_params,
          file,
          (percent) => {
            // 将10-90%映射为S3上传进度
            const mappedProgress = 10 + Math.round(percent * 0.8);
            setUploadProgress(mappedProgress);
            onProgress?.(mappedProgress);
          }
        );

        // Step 3: 确认上传完成
        setCurrentOperation('确认上传...');
        setUploadProgress(95);
        onProgress?.(95);

        setUploadProgress(100);
        onProgress?.(100);

        return uploadResult;
      } catch (err) {
        const message =
          err instanceof CanvasAPIError || err instanceof FileUploadError
            ? err.message
            : '文件上传失败';
        setError(new CanvasAPIError(message));
        throw err;
      } finally {
        setIsLoading(false);
        setCurrentOperation('');
        abortControllerRef.current = null;
      }
    },
    [initiateFileUpload, uploadToS3]
  );

  /**
   * 提交作业
   */
  const submitAssignment = useCallback(
    async (
      courseId: number,
      assignmentId: number,
      fileIds: number[],
      comment?: string
    ): Promise<Submission> => {
      setIsLoading(true);
      setCurrentOperation('提交作业...');
      setError(null);

      try {
        const formData = new URLSearchParams();
        formData.append('submission[submission_type]', 'online_upload');
        fileIds.forEach((id) => formData.append('submission[file_ids][]', id.toString()));

        if (comment) {
          formData.append('comment[text_comment]', comment);
        }

        const response = await fetch(
          `${CANVAS_API_BASE_URL}/courses/${courseId}/assignments/${assignmentId}/submissions`,
          createRequestConfig({
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString(),
          })
        );

        return await handleResponse<Submission>(response);
      } catch (err) {
        const message = err instanceof CanvasAPIError ? err.message : '作业提交失败';
        setError(new CanvasAPIError(message));
        throw err;
      } finally {
        setIsLoading(false);
        setCurrentOperation('');
      }
    },
    [createRequestConfig, handleResponse]
  );

  return {
    getCourses,
    getAssignments,
    uploadFile,
    submitAssignment,
    validateToken,
    cancelUpload,
    isLoading,
    uploadProgress,
    currentOperation,
    error,
    clearError,
  };
}

export default useCanvas;
