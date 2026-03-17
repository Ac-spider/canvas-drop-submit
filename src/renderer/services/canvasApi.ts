/**
 * Canvas API 服务层
 * @module services/canvasApi
 * @description 集中管理所有 Canvas API 调用，提供统一的错误处理和类型安全
 */

import type {
  Course,
  Assignment,
  Submission,
  FileAttachment,
  FileUploadPreResponse,
} from '../../shared/types';

// ============================================================================
// 常量定义
// ============================================================================

const CANVAS_API_BASE_URL = 'https://oc.sjtu.edu.cn/api/v1';
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

// ============================================================================
// 错误类定义
// ============================================================================

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
// 类型定义
// ============================================================================

export interface ApiClientConfig {
  apiToken: string;
  baseUrl?: string;
}

export interface RequestConfig extends RequestInit {
  skipAuth?: boolean;
}

// ============================================================================
// Canvas API 客户端类
// ============================================================================

export class CanvasApiClient {
  private apiToken: string;
  private baseUrl: string;

  constructor(config: ApiClientConfig) {
    this.apiToken = config.apiToken;
    this.baseUrl = config.baseUrl || CANVAS_API_BASE_URL;
  }

  /**
   * 更新 API Token
   */
  setToken(token: string): void {
    this.apiToken = token;
  }

  /**
   * 创建请求配置
   */
  private createRequestConfig(options: RequestConfig = {}): RequestInit {
    const { skipAuth, ...fetchOptions } = options;

    return {
      ...fetchOptions,
      headers: {
        ...(skipAuth ? {} : { Authorization: `Bearer ${this.apiToken}` }),
        Accept: 'application/json+canvas-string-ids',
        ...(fetchOptions.headers || {}),
      },
    };
  }

  /**
   * 处理 API 响应
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await this.parseErrorResponse(response);
      const message = this.extractErrorMessage(errorData, response.status);
      throw new CanvasAPIError(message, response.status, errorData);
    }

    // 处理 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    // 尝试解析 JSON，失败则返回文本
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json() as Promise<T>;
    }

    return response.text() as unknown as Promise<T>;
  }

  /**
   * 解析错误响应
   */
  private async parseErrorResponse(response: Response): Promise<unknown> {
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    } catch {
      return null;
    }
  }

  /**
   * 提取错误消息
   */
  private extractErrorMessage(errorData: unknown, statusCode: number): string {
    if (typeof errorData === 'string') {
      return errorData;
    }

    if (errorData && typeof errorData === 'object') {
      // Canvas API 标准错误格式
      if ('errors' in errorData && Array.isArray((errorData as { errors: unknown[] }).errors)) {
        const errors = (errorData as { errors: Array<{ message?: string }> }).errors;
        if (errors.length > 0 && errors[0]?.message) {
          return errors[0].message;
        }
      }

      // 简单消息格式
      if ('message' in errorData && typeof (errorData as { message: string }).message === 'string') {
        return (errorData as { message: string }).message;
      }
    }

    // 默认 HTTP 状态消息
    const statusMessages: Record<number, string> = {
      400: '请求参数错误',
      401: 'API Token 无效或已过期',
      403: '权限不足，无法访问此资源',
      404: '请求的资源不存在',
      409: '请求冲突，资源可能已存在',
      422: '请求数据验证失败',
      429: '请求过于频繁，请稍后重试',
      500: '服务器内部错误',
      502: '网关错误',
      503: '服务暂时不可用',
    };

    return statusMessages[statusCode] || `HTTP ${statusCode} 错误`;
  }

  /**
   * 发送 GET 请求
   */
  async get<T>(endpoint: string, options: RequestConfig = {}): Promise<T> {
    const response = await fetch(
      `${this.baseUrl}${endpoint}`,
      this.createRequestConfig({ ...options, method: 'GET' })
    );
    return this.handleResponse<T>(response);
  }

  /**
   * 发送 POST 请求
   */
  async post<T>(
    endpoint: string,
    body: unknown,
    options: RequestConfig = {}
  ): Promise<T> {
    const isFormData = body instanceof URLSearchParams;

    const response = await fetch(
      `${this.baseUrl}${endpoint}`,
      this.createRequestConfig({
        ...options,
        method: 'POST',
        headers: {
          'Content-Type': isFormData
            ? 'application/x-www-form-urlencoded'
            : 'application/json',
          ...(options.headers || {}),
        },
        body: isFormData ? body.toString() : JSON.stringify(body),
      })
    );
    return this.handleResponse<T>(response);
  }

  // ============================================================================
  // API 方法：用户
  // ============================================================================

  /**
   * 验证 API Token
   */
  async validateToken(): Promise<{ valid: boolean; user?: unknown; error?: string }> {
    try {
      const user = await this.get<unknown>('/users/self');
      return { valid: true, user };
    } catch (error) {
      if (error instanceof CanvasAPIError) {
        return { valid: false, error: error.message };
      }
      return { valid: false, error: '网络错误，请检查连接' };
    }
  }

  // ============================================================================
  // API 方法：课程
  // ============================================================================

  /**
   * 获取课程列表
   * 注意：不使用 enrollment_state 过滤，以显示所有课程（包括 invited, accepted, completed 等状态）
   */
  async getCourses(): Promise<Course[]> {
    const courses = await this.get<Course[]>(
      '/courses?include[]=teachers&include[]=term&include[]=enrollments&per_page=100'
    );
    // 过滤掉已删除的课程
    return courses.filter((course) => course.workflow_state !== 'deleted');
  }

  // ============================================================================
  // API 方法：作业
  // ============================================================================

  /**
   * 获取作业列表
   */
  async getAssignments(courseId: number): Promise<Assignment[]> {
    return this.get<Assignment[]>(
      `/courses/${courseId}/assignments?bucket=upcoming&include[]=submission&per_page=50`
    );
  }

  /**
   * 提交作业
   */
  async submitAssignment(
    courseId: number,
    assignmentId: number,
    fileIds: number[],
    comment?: string
  ): Promise<Submission> {
    const formData = new URLSearchParams();
    formData.append('submission[submission_type]', 'online_upload');
    fileIds.forEach((id) => formData.append('submission[file_ids][]', id.toString()));

    if (comment) {
      formData.append('comment[text_comment]', comment);
    }

    return this.post<Submission>(
      `/courses/${courseId}/assignments/${assignmentId}/submissions`,
      formData
    );
  }

  // ============================================================================
  // API 方法：文件上传
  // ============================================================================

  /**
   * 验证文件
   */
  validateFile(file: File): void {
    if (!file) {
      throw new FileUploadError('文件不能为空', 'pre-request');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new FileUploadError(
        `文件大小超过限制 (${(MAX_FILE_SIZE / 1024 / 1024 / 1024).toFixed(1)}GB)`,
        'pre-request'
      );
    }
  }

  /**
   * 文件上传 - 步骤1: 预请求
   */
  async initiateFileUpload(
    courseId: number,
    file: File
  ): Promise<FileUploadPreResponse> {
    return this.post<FileUploadPreResponse>(`/courses/${courseId}/files`, {
      name: file.name,
      size: file.size,
      content_type: file.type || 'application/octet-stream',
      parent_folder_path: '/',
    });
  }

  /**
   * 文件上传 - 步骤2: 上传到 S3
   */
  async uploadToS3(
    uploadUrl: string,
    uploadParams: Record<string, string>,
    file: File,
    onProgress?: (percent: number) => void,
    abortSignal?: AbortSignal
  ): Promise<FileAttachment> {
    const formData = new FormData();

    // 必须先添加所有 upload_params
    Object.entries(uploadParams).forEach(([key, value]) => {
      formData.append(key, value);
    });

    // file 必须是最后一个参数
    formData.append('file', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // 监听中止信号
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          xhr.abort();
        });
      }

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
            const data = JSON.parse(xhr.responseText) as FileAttachment;
            resolve(data);
          } catch {
            reject(
              new FileUploadError('解析上传响应失败', 's3-upload')
            );
          }
        } else {
          reject(
            new FileUploadError(
              `上传失败: HTTP ${xhr.status}`,
              's3-upload'
            )
          );
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
  }

  /**
   * 完整文件上传流程（三步）
   */
  async uploadFile(
    courseId: number,
    file: File,
    onProgress?: (percent: number) => void,
    abortSignal?: AbortSignal
  ): Promise<FileAttachment> {
    // 验证文件
    this.validateFile(file);

    // 步骤1: 预请求
    onProgress?.(0);
    const { upload_url, upload_params } = await this.initiateFileUpload(
      courseId,
      file
    );

    // 步骤2: 上传到 S3
    onProgress?.(10);
    const result = await this.uploadToS3(
      upload_url,
      upload_params,
      file,
      (percent) => {
        // 将 10-90% 映射为 S3 上传进度
        const mappedProgress = 10 + Math.round(percent * 0.8);
        onProgress?.(mappedProgress);
      },
      abortSignal
    );

    // 步骤3: 完成
    onProgress?.(100);
    return result;
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createCanvasApiClient(
  apiToken: string
): CanvasApiClient {
  return new CanvasApiClient({ apiToken });
}

export { CANVAS_API_BASE_URL, MAX_FILE_SIZE };
