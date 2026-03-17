import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import Store from 'electron-store';
import fs from 'fs/promises';
import { Page } from 'playwright';
import type { Course, Assignment, AssignmentGroup, FileUploadPreResponse, FileUploadConfirmResponse, CanvasFile, CanvasModule, ModuleItem } from '../shared/types';
import {
  sanitizeFilename,
  isValidCanvasUrl,
  isValidDownloadPath,
} from './utils/security';
import { browserConnector } from './browserConnector';

/**
 * Canvas Drop Submit - Electron主进程入口
 * @module main/index
 *
 * 负责：
 * - 创建应用窗口
 * - 处理IPC通信
 * - 管理应用生命周期
 * - 加密存储API Token
 */

// ============================================================================
// 加密存储配置
// ============================================================================

/**
 * electron-store 实例，用于加密存储API Token、课程排序和课程下载路径
 */
const store = new Store<{
  apiToken: string;
  courseOrder: Record<string, number[]>; // 按学期存储课程顺序
  courseDownloadPaths: Record<string, string>; // 按课程ID存储下载路径
}>({
  name: 'canvas-drop-submit',
  encryptionKey: 'canvas-drop-submit-secure-key-v1',
});

// ============================================================================
// Playwright 浏览器实例管理（已弃用，使用 BrowserConnector 替代）
// ============================================================================

/**
 * 关闭 Playwright 浏览器（清理资源）
 */
async function closePlaywrightBrowser(): Promise<void> {
  await browserConnector.close();
}

// ============================================================================
// IPC 处理器
// ============================================================================

/**
 * 存储API Token
 */
ipcMain.handle('store:setToken', async (_, token: string) => {
  store.set('apiToken', token);
});

/**
 * 获取API Token
 */
ipcMain.handle('store:getToken', async () => {
  return store.get('apiToken', '');
});

/**
 * 删除API Token
 */
ipcMain.handle('store:deleteToken', async () => {
  store.delete('apiToken');
});

/**
 * 读取文件内容
 */
ipcMain.handle('file:read', async (_, filePath: string) => {
  try {
    const content = await fs.readFile(filePath);
    return { success: true, data: new Uint8Array(content) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '读取文件失败',
    };
  }
});

/**
 * 验证文件是否存在
 */
ipcMain.handle('file:validate', async (_, filePath: string) => {
  try {
    await fs.access(filePath);
    return { success: true };
  } catch {
    return { success: false, error: '文件不存在' };
  }
});

/**
 * 显示错误对话框
 */
ipcMain.handle('dialog:showError', async (_, title: string, message: string) => {
  dialog.showErrorBox(title, message);
});

/**
 * 打开外部链接
 */
ipcMain.handle('app:openExternal', async (_, url: string) => {
  await shell.openExternal(url);
});

/**
 * 验证 Canvas API Token
 * 防御性实现：处理各种错误情况，保留详细错误信息
 */
ipcMain.handle('canvas:validateToken', async (_, token: string) => {
  // 防御性：验证输入
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { valid: false, error: 'Token 不能为空', status: 400 };
  }

  const trimmedToken = token.trim();

  try {
    const response = await fetch('https://oc.sjtu.edu.cn/api/v1/users/self', {
      headers: {
        Authorization: `Bearer ${trimmedToken}`,
        Accept: 'application/json+canvas-string-ids',
      },
    });

    if (response.ok) {
      const user = await response.json();
      return { valid: true, user };
    }

    // 防御性：提取详细错误信息
    let errorMessage: string;
    let errorData: unknown = null;

    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        errorData = await response.json();
        errorMessage = (errorData as { errors?: Array<{ message?: string }> })?.errors?.[0]?.message
          || `HTTP ${response.status}`;
      } else {
        const text = await response.text();
        errorMessage = text || `HTTP ${response.status}`;
        errorData = { rawResponse: text };
      }
    } catch {
      errorMessage = `HTTP ${response.status}`;
    }

    // 根据状态码提供友好的错误信息
    const friendlyMessages: Record<number, string> = {
      401: 'API Token 无效或已过期，请重新生成',
      403: '权限不足，Token 可能没有足够的权限',
      404: '用户不存在',
      429: '请求过于频繁，请稍后再试',
      500: 'Canvas 服务器内部错误',
      502: '网关错误，可能是网络问题',
      503: '服务暂时不可用',
    };

    const friendlyError = friendlyMessages[response.status] || `验证失败: ${errorMessage}`;

    return { valid: false, status: response.status, error: friendlyError, details: errorData };
  } catch (error) {
    // 保留原始错误信息，提供网络错误友好提示
    const errorMessage = error instanceof Error ? error.message : '网络错误';
    const isNetworkError = errorMessage.includes('fetch') ||
                          errorMessage.includes('network') ||
                          errorMessage.includes('ENOTFOUND') ||
                          errorMessage.includes('ETIMEDOUT') ||
                          errorMessage.includes('ECONNREFUSED');

    if (isNetworkError) {
      return {
        valid: false,
        error: '无法连接到 Canvas 服务器，请检查网络连接。如果使用的是校园网，请确保您可以访问 https://oc.sjtu.edu.cn',
        details: errorMessage,
      };
    }

    return { valid: false, error: `网络错误: ${errorMessage}`, details: errorMessage };
  }
});

/**
 * 获取课程列表
 * 通过主进程代理请求，避免CORS问题
 */
ipcMain.handle('canvas:getCourses', async (_, token: string) => {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { success: false, error: 'Token 不能为空' };
  }

  const trimmedToken = token.trim();

  try {
    const response = await fetch(
      'https://oc.sjtu.edu.cn/api/v1/courses?include[]=teachers&include[]=term&include[]=enrollments&per_page=100',
      {
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
          Accept: 'application/json+canvas-string-ids',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        status: response.status,
      };
    }

    const data = (await response.json()) as Course[];
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '网络错误';
    return { success: false, error: errorMessage };
  }
});

/**
 * 获取作业列表
 * 通过主进程代理请求，避免CORS问题
 */
ipcMain.handle('canvas:getAssignments', async (_, token: string, courseId: number) => {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { success: false, error: 'Token 不能为空' };
  }

  const trimmedToken = token.trim();

  try {
    const response = await fetch(
      `https://oc.sjtu.edu.cn/api/v1/courses/${courseId}/assignments?include[]=submission&bucket=upcoming&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
          Accept: 'application/json+canvas-string-ids',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        status: response.status,
      };
    }

    const data = (await response.json()) as Assignment[];
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '网络错误';
    return { success: false, error: errorMessage };
  }
});

/**
 * 获取作业分组列表（包含作业）
 * 通过主进程代理请求，避免CORS问题
 */
ipcMain.handle('canvas:getAssignmentGroups', async (_, token: string, courseId: number) => {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { success: false, error: 'Token 不能为空' };
  }

  const trimmedToken = token.trim();

  try {
    const response = await fetch(
      `https://oc.sjtu.edu.cn/api/v1/courses/${courseId}/assignment_groups?` +
        `exclude_assignment_submission_types[]=wiki_page&` +
        `include[]=assignments&` +
        `include[]=submission&` +
        `override_assignment_dates=true&` +
        `per_page=50`,
      {
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
          Accept: 'application/json+canvas-string-ids',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        status: response.status,
      };
    }

    const data = (await response.json()) as AssignmentGroup[];
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '网络错误';
    return { success: false, error: errorMessage };
  }
});

/**
 * 文件上传预请求 - 课程级别
 * 通过主进程代理请求，避免CORS问题
 */
ipcMain.handle('canvas:uploadFilePre', async (_, token: string, courseId: number, fileName: string, fileSize: number) => {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { success: false, error: 'Token 不能为空' };
  }

  const trimmedToken = token.trim();

  try {
    const params = new URLSearchParams({
      name: fileName,
      size: fileSize.toString(),
      on_duplicate: 'rename',
    });

    const response = await fetch(
      `https://oc.sjtu.edu.cn/api/v1/courses/${courseId}/files?${params.toString()}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
          Accept: 'application/json+canvas-string-ids',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      // 特殊处理401错误 - 用户没有课程文件上传权限
      if (response.status === 401) {
        console.log('Course file upload returned 401, user does not have permission');
        return {
          success: false,
          error: '您没有该课程的文件上传权限。请检查：1) API Token 是否有效；2) 您是否已注册该课程；3) 课程是否允许文件上传。',
          status: 401,
        };
      }

      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        status: response.status,
      };
    }

    const data = (await response.json()) as FileUploadPreResponse;
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '网络错误';
    return { success: false, error: errorMessage };
  }
});

/**
 * 文件上传预请求 - 用户级别（备用方案）
 * 当课程文件上传无权限时使用
 */
ipcMain.handle('canvas:uploadFilePreUser', async (_, token: string, fileName: string, fileSize: number) => {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { success: false, error: 'Token 不能为空' };
  }

  const trimmedToken = token.trim();

  try {
    const params = new URLSearchParams({
      name: fileName,
      size: fileSize.toString(),
      on_duplicate: 'rename',
    });

    const url = `https://oc.sjtu.edu.cn/api/v1/users/self/files?${params.toString()}`;
    console.log('[uploadFilePreUser] Request URL:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${trimmedToken}`,
        Accept: 'application/json+canvas-string-ids',
      },
    });

    console.log('[uploadFilePreUser] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[uploadFilePreUser] Error response:', errorText.substring(0, 500));
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
        status: response.status,
      };
    }

    const data = (await response.json()) as FileUploadPreResponse;
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '网络错误';
    return { success: false, error: errorMessage };
  }
});

/**
 * 文件上传确认
 * 通过主进程代理请求，避免CORS问题
 */
ipcMain.handle('canvas:uploadFileConfirm', async (_, token: string, fileId: number) => {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { success: false, error: 'Token 不能为空' };
  }

  const trimmedToken = token.trim();

  try {
    const response = await fetch(
      `https://oc.sjtu.edu.cn/api/v1/files/${fileId}/status`,
      {
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
          Accept: 'application/json+canvas-string-ids',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        status: response.status,
      };
    }

    const data = (await response.json()) as FileUploadConfirmResponse;
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '网络错误';
    return { success: false, error: errorMessage };
  }
});

/**
 * 提交作业
 * 通过主进程代理请求，避免CORS问题
 */
ipcMain.handle('canvas:submitAssignment', async (_, token: string, courseId: number, assignmentId: number, fileIds: number[]) => {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { success: false, error: 'Token 不能为空' };
  }

  const trimmedToken = token.trim();

  try {
    const body = {
      submission: {
        submission_type: 'online_upload',
        file_ids: fileIds,
      },
    };

    const response = await fetch(
      `https://oc.sjtu.edu.cn/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json+canvas-string-ids',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        status: response.status,
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '网络错误';
    return { success: false, error: errorMessage };
  }
});

/**
 * 从Link Header中提取下一页URL
 * Link header格式: <url>; rel="next", <url>; rel="last"
 */
function extractNextUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;

  // 匹配 rel="next" 的URL
  const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return nextMatch ? nextMatch[1] : null;
}

/**
 * 获取课程文件列表
 * 通过主进程代理请求，避免CORS问题
 * 支持分页获取所有文件
 */
ipcMain.handle('canvas:getFiles', async (_, token: string, courseId: number) => {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { success: false, error: 'Token 不能为空' };
  }

  const trimmedToken = token.trim();

  const allFiles: CanvasFile[] = [];
  let nextUrl: string | null = `https://oc.sjtu.edu.cn/api/v1/courses/${courseId}/files?include[]=user&per_page=100&sort=updated_at&order=desc`;

  // 最多获取10页（1000个文件）防止无限循环
  let pageCount = 0;
  const maxPages = 10;

  try {
    while (nextUrl && pageCount < maxPages) {
      const response = await fetch(nextUrl, {
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
          Accept: 'application/json+canvas-string-ids',
        },
      });

      if (!response.ok) {
        // 特殊处理401错误 - 课程文件访问权限问题
        if (response.status === 401) {
          return {
            success: false,
            error: '您没有权限访问该课程的文件。可能原因：1) 课程文件功能被禁用；2) 需要接受课程邀请；3) 仅教师可访问。',
            status: 401,
            isAuthError: true,
          };
        }

        const errorText = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          status: response.status,
        };
      }

      const data = (await response.json()) as CanvasFile[];
      allFiles.push(...data);

      // 解析Link header获取下一页URL
      const linkHeader = response.headers.get('link');
      nextUrl = extractNextUrl(linkHeader);
      pageCount++;
    }

    return { success: true, data: allFiles };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '网络错误';
    return { success: false, error: errorMessage };
  }
});

/**
 * 获取课程排序
 * 按学期存储的课程ID顺序
 */
ipcMain.handle('store:getCourseOrder', async (_, term: string) => {
  return store.get(`courseOrder.${term}`, []);
});

/**
 * 保存课程排序
 * 按学期存储课程ID顺序
 */
ipcMain.handle('store:setCourseOrder', async (_, term: string, courseIds: number[]) => {
  store.set(`courseOrder.${term}`, courseIds);
});

/**
 * 获取课程下载路径
 * 按课程ID存储独立的下载路径
 */
ipcMain.handle('store:getCourseDownloadPath', async (_, courseId: number) => {
  const paths = store.get('courseDownloadPaths', {});
  return paths[String(courseId)] || null;
});

/**
 * 设置课程下载路径
 * 为指定课程设置独立的下载路径
 */
ipcMain.handle('store:setCourseDownloadPath', async (_, courseId: number, path: string) => {
  const paths = store.get('courseDownloadPaths', {});
  paths[String(courseId)] = path;
  store.set('courseDownloadPaths', paths);
});

/**
 * 从URL中提取Canvas文件ID
 * @param url - 文件URL（相对路径或完整URL）
 * @returns 文件ID或null
 *
 * 支持的格式：
 * - /files/{id}/download
 * - /files/{id}
 * - /courses/{course_id}/files/{file_id}?wrap=1
 * - https://oc.sjtu.edu.cn/courses/{course_id}/files/{file_id}
 */
function extractCanvasFileId(url: string): number | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // 首先尝试匹配 /courses/{course_id}/files/{file_id} 格式
  const courseFileMatch = url.match(/\/courses\/\d+\/files\/(\d+)(?:\?.*)?$/);
  if (courseFileMatch) {
    const id = parseInt(courseFileMatch[1], 10);
    return isNaN(id) ? null : id;
  }

  // 然后匹配 /files/{id}/download 或 /files/{id} 格式
  const fileMatch = url.match(/\/files\/(\d+)(?:\/download)?(?:\?.*)?$/);
  if (fileMatch) {
    const id = parseInt(fileMatch[1], 10);
    return isNaN(id) ? null : id;
  }

  return null;
}

/**
 * 下载文件
 * 通过主进程代理请求，避免CORS问题
 * 支持Canvas文件链接（会自动获取带verifier的下载URL）
 */
ipcMain.handle('file:download', async (_, url: string, filename: string, savePath?: string, token?: string) => {
  try {
    // 验证 URL 是否为合法的 Canvas 域名或相对路径
    if (!isValidCanvasUrl(url)) {
      return {
        success: false,
        error: '无效的下载地址：只允许 Canvas 域名',
      };
    }

    // 确定下载路径
    let downloadPath: string;
    if (savePath) {
      // 验证用户提供的下载路径是否在用户目录下
      const userHome = app.getPath('home');
      if (!isValidDownloadPath(savePath, userHome)) {
        return {
          success: false,
          error: '无效的下载路径：路径必须在用户目录下',
        };
      }
      downloadPath = savePath;
    } else {
      downloadPath = app.getPath('downloads');
    }

    // 净化文件名，防止路径遍历攻击
    const safeFilename = sanitizeFilename(filename);
    const filePath = join(downloadPath, safeFilename);

    // 检查文件是否已存在，如果存在则添加数字后缀
    let finalPath = filePath;
    let counter = 1;
    const ext = safeFilename.includes('.') ? safeFilename.slice(safeFilename.lastIndexOf('.')) : '';
    const baseName = safeFilename.includes('.') ? safeFilename.slice(0, safeFilename.lastIndexOf('.')) : safeFilename;

    while (await fs.access(finalPath).then(() => true).catch(() => false)) {
      finalPath = join(downloadPath, `${baseName} (${counter})${ext}`);
      counter++;
    }

    // 处理 Canvas 文件链接：获取带 verifier 的下载 URL
    let downloadUrl = url;
    const fileId = extractCanvasFileId(url);

    if (fileId && token) {
      // 调用 Canvas API 获取文件详情，包含带 verifier 的下载 URL
      const fileResponse = await fetch(
        `https://oc.sjtu.edu.cn/api/v1/files/${fileId}`,
        {
          headers: {
            Authorization: `Bearer ${token.trim()}`,
            Accept: 'application/json+canvas-string-ids',
          },
        }
      );

      if (!fileResponse.ok) {
        // 特殊处理401错误
        if (fileResponse.status === 401) {
          return {
            success: false,
            error: '无法获取文件下载链接：API Token 无效或已过期',
            status: 401,
          };
        }
        return {
          success: false,
          error: `获取文件信息失败: HTTP ${fileResponse.status}`,
        };
      }

      const fileData = await fileResponse.json() as { url?: string; display_name?: string };
      if (fileData.url) {
        downloadUrl = fileData.url;
      }

      // 使用 API 返回的文件名（如果有）
      if (fileData.display_name && !filename) {
        const newSafeFilename = sanitizeFilename(fileData.display_name);
        finalPath = join(downloadPath, newSafeFilename);
        // 重新检查文件是否存在
        counter = 1;
        const newExt = newSafeFilename.includes('.') ? newSafeFilename.slice(newSafeFilename.lastIndexOf('.')) : '';
        const newBaseName = newSafeFilename.includes('.') ? newSafeFilename.slice(0, newSafeFilename.lastIndexOf('.')) : newSafeFilename;

        while (await fs.access(finalPath).then(() => true).catch(() => false)) {
          finalPath = join(downloadPath, `${newBaseName} (${counter})${newExt}`);
          counter++;
        }
      }
    } else if (fileId && !token) {
      return {
        success: false,
        error: '下载 Canvas 文件需要提供 API Token',
      };
    }

    // 验证最终的下载 URL
    if (!isValidCanvasUrl(downloadUrl) && !downloadUrl.startsWith('http')) {
      return {
        success: false,
        error: '无效的下载地址',
      };
    }

    // 下载文件
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      return {
        success: false,
        error: `下载失败: HTTP ${response.status}`,
      };
    }

    const buffer = await response.arrayBuffer();
    await fs.writeFile(finalPath, Buffer.from(buffer));

    return { success: true, path: finalPath };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '下载失败';
    return { success: false, error: errorMessage };
  }
});

/**
 * 选择下载目录
 */
ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: '选择下载目录',
  });

  if (result.canceled) {
    return { success: false, canceled: true };
  }

  return { success: true, path: result.filePaths[0] };
});

/**
 * 获取课程模块列表
 * 通过主进程代理请求，避免CORS问题
 */
ipcMain.handle('canvas:getModules', async (_, token: string, courseId: number) => {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { success: false, error: 'Token 不能为空' };
  }

  const trimmedToken = token.trim();

  try {
    const response = await fetch(
      `https://oc.sjtu.edu.cn/api/v1/courses/${courseId}/modules?include[]=items&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
          Accept: 'application/json+canvas-string-ids',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        status: response.status,
      };
    }

    const data = (await response.json()) as CanvasModule[];
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '网络错误';
    return { success: false, error: errorMessage };
  }
});

/**
 * 获取模块项目列表
 * 通过主进程代理请求，避免CORS问题
 */
ipcMain.handle('canvas:getModuleItems', async (_, token: string, courseId: number, moduleId: number) => {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { success: false, error: 'Token 不能为空' };
  }

  const trimmedToken = token.trim();

  try {
    const response = await fetch(
      `https://oc.sjtu.edu.cn/api/v1/courses/${courseId}/modules/${moduleId}/items?include[]=content_details&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
          Accept: 'application/json+canvas-string-ids',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        status: response.status,
      };
    }

    const data = (await response.json()) as ModuleItem[];
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '网络错误';
    return { success: false, error: errorMessage };
  }
});

/**
 * 上传文件到指定URL（用于Canvas文件上传第二步）
 * @param url - 上传目标URL（Canvas预请求返回的upload_url）
 * @param fileData - 文件数据（Uint8Array）
 * @param uploadParams - 上传表单参数（Canvas预请求返回的upload_params）
 */
ipcMain.handle('file:uploadToUrl', async (_, url: string, fileData: Uint8Array, uploadParams: Record<string, string>) => {
  try {
    // 构建FormData
    const formData = new FormData();

    // 先添加所有upload_params（签名等参数必须在文件之前）
    for (const [key, value] of Object.entries(uploadParams)) {
      formData.append(key, value);
    }

    // 添加文件数据 - 将Uint8Array转换为Buffer再创建Blob
    const buffer = Buffer.from(fileData);
    const blob = new Blob([buffer]);
    // Canvas使用'file'作为文件字段名
    formData.append('file', blob);

    // 发送POST请求到S3/Canvas存储
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        status: response.status,
      };
    }

    // 返回响应（可能是XML或JSON，取决于上传目标）
    const responseText = await response.text();
    return { success: true, data: responseText };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '上传失败';
    return { success: false, error: errorMessage };
  }
});

/**
 * 通过ID获取文件详情
 * 用于从Modules中的File类型项目获取完整文件信息
 */
ipcMain.handle('canvas:getFileById', async (_, token: string, fileId: number) => {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { success: false, error: 'Token 不能为空' };
  }

  const trimmedToken = token.trim();

  try {
    const response = await fetch(
      `https://oc.sjtu.edu.cn/api/v1/files/${fileId}`,
      {
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
          Accept: 'application/json+canvas-string-ids',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        status: response.status,
      };
    }

    const data = (await response.json()) as CanvasFile;
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '网络错误';
    return { success: false, error: errorMessage };
  }
});

// ============================================================================
// 窗口管理
// ============================================================================

// 保持全局窗口引用，防止被垃圾回收
let mainWindow: BrowserWindow | null = null;

/**
 * 创建主窗口
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Canvas Drop Submit',
    webPreferences: {
      // 使用预加载脚本，不直接暴露Node API
      preload: join(__dirname, '../preload/index.js'),
      // 安全设置
      nodeIntegration: false,
      contextIsolation: true,
      // 允许文件拖拽
      webSecurity: true,
    },
    // 窗口样式
    titleBarStyle: 'default',
    show: false, // 加载完成后再显示
  });

  // 加载应用
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    // 开发模式：加载Vite开发服务器
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    // 打开开发者工具
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式：加载打包后的文件
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // 加载完成后显示窗口
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  // 窗口关闭时清理引用
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 拦截外部链接，使用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });
}

/**
 * 应用就绪时创建窗口
 */
app.whenReady().then(() => {
  // 设置应用ID（Windows）
  electronApp.setAppUserModelId('com.electron.canvas-drop-submit');

  // 开发模式下F12打开开发者工具
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createWindow();

  // macOS: 点击dock图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * 所有窗口关闭时退出应用（Windows/Linux）
 */
app.on('window-all-closed', async () => {
  // 关闭 Playwright 浏览器
  await closePlaywrightBrowser();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================================================
// Playwright 网页提交 IPC 处理器
// ============================================================================

/**
 * 检查 Canvas 网页登录状态
 * 通过连接到用户的浏览器并检查登录状态，如果未登录则自动点击登录按钮
 */
ipcMain.handle('canvas:checkWebLogin', async () => {
  try {
    console.log('[checkWebLogin] 开始检查登录状态...');
    const page = await browserConnector.connect();
    console.log('[checkWebLogin] 浏览器已连接，当前URL:', page.url());

    // 先导航到 Canvas 主页检查登录状态
    await page.goto('https://oc.sjtu.edu.cn/', { timeout: 30000, waitUntil: 'networkidle' });
    console.log('[checkWebLogin] 导航到Canvas主页后URL:', page.url());

    const currentUrl = page.url();
    const isLoggedIn = !currentUrl.includes('/login') && !currentUrl.includes('/cas');
    console.log('[checkWebLogin] 登录状态:', isLoggedIn);

    if (!isLoggedIn) {
      // 未登录，导航到 Canvas 登录页面并自动点击登录按钮
      console.log('[checkWebLogin] 未登录，导航到登录页面...');
      await page.goto('https://oc.sjtu.edu.cn/login/canvas', { timeout: 60000, waitUntil: 'networkidle' });
      console.log('[checkWebLogin] 已导航到登录页面，当前URL:', page.url());

      // 等待1秒后点击
      console.log('[checkWebLogin] 等待1秒...');
      await page.waitForTimeout(500);

      // 尝试自动点击"校内用户登录"按钮
      try {
        console.log('[checkWebLogin] 尝试点击校内用户登录按钮...');

        // 等待 #jaccount 元素出现
        await page.waitForSelector('#jaccount', { timeout: 15000, state: 'visible' });
        console.log('[checkWebLogin] 找到 #jaccount 元素');

        // 获取 #jaccount 元素及其父元素 <a> 标签
        const linkInfo = await page.evaluate(() => {
          const jaccountElement = document.querySelector('#jaccount');
          if (!jaccountElement) return null;

          // 找到父元素 <a> 标签
          const linkElement = jaccountElement.closest('a');
          if (!linkElement) return null;

          return {
            href: linkElement.getAttribute('href'),
            hasClickHandler: !!(linkElement as HTMLElement).onclick || !!(jaccountElement as HTMLElement).onclick,
          };
        });

        console.log('[checkWebLogin] 登录链接信息:', linkInfo);

        if (linkInfo?.href) {
          // 直接导航到登录链接，这样最可靠
          const fullUrl = linkInfo.href.startsWith('http')
            ? linkInfo.href
            : `https://oc.sjtu.edu.cn${linkInfo.href}`;

          console.log('[checkWebLogin] 直接导航到登录链接:', fullUrl);
          await page.goto(fullUrl, { timeout: 60000, waitUntil: 'networkidle' });
        } else {
          // 回退：直接点击元素
          console.log('[checkWebLogin] 未找到链接，直接点击 #jaccount 元素');
          await page.click('#jaccount');

          // 等待导航
          try {
            await page.waitForNavigation({ timeout: 30000, waitUntil: 'networkidle' });
          } catch {
            console.log('[checkWebLogin] 等待导航超时，检查当前URL');
          }
        }

        console.log('[checkWebLogin] 点击后当前URL:', page.url());

        // 等待一段时间让插件自动登录
        console.log('[checkWebLogin] 等待8秒让插件自动登录...');
        await page.waitForTimeout(8000);

        // 再次检查登录状态
        const finalUrl = page.url();
        const nowLoggedIn = !finalUrl.includes('/login') && !finalUrl.includes('/cas');
        console.log('[checkWebLogin] 最终登录状态:', nowLoggedIn, 'URL:', finalUrl);

        if (nowLoggedIn) {
          console.log('[checkWebLogin] 登录成功');
          await browserConnector.disconnect();
          return { loggedIn: true };
        }

        // 仍在登录页面，提示用户手动登录
        console.log('[checkWebLogin] 仍在登录页面，提示用户手动登录');
        return {
          loggedIn: false,
          needLogin: true,
          message: '请在打开的浏览器中完成登录，然后再次点击上传',
        };
      } catch (clickErr) {
        console.log('[checkWebLogin] 自动点击失败:', clickErr);
        // 点击失败，提示用户手动登录
        return {
          loggedIn: false,
          needLogin: true,
          message: '请在打开的浏览器中点击"校内用户登录"并完成登录',
        };
      }
    }

    // 已登录，断开连接但保持浏览器运行
    console.log('[checkWebLogin] 已登录，断开连接');
    await browserConnector.disconnect();

    return { loggedIn: true };
  } catch (error) {
    console.error('[checkWebLogin] 错误:', error);
    const errorMessage = error instanceof Error ? error.message : '检查登录状态失败';
    return { loggedIn: false, error: errorMessage };
  }
});

/**
 * 打开 Canvas 登录窗口
 * 启动浏览器并导航到 Canvas 登录页面，让用户手动登录
 */
ipcMain.handle('canvas:openLoginWindow', async () => {
  try {
    const page = await browserConnector.connect();

    // 导航到 Canvas 登录页面
    await page.goto('https://oc.sjtu.edu.cn/login/canvas', { timeout: 60000 });

    // 等待用户登录成功（通过检测 URL 变化）
    await page.waitForFunction(
      () => {
        const url = window.location.href;
        return !url.includes('/login') && !url.includes('/cas');
      },
      { timeout: 300000 } // 5分钟超时
    );

    // 登录成功，断开连接但保持浏览器运行
    await browserConnector.disconnect();

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '登录失败';
    return { success: false, error: errorMessage };
  }
});

/**
 * 使用 Playwright 通过网页提交作业
 * 复用用户已有的浏览器登录状态
 */
ipcMain.handle(
  'canvas:submitAssignmentViaWeb',
  async (
    _,
    courseId: number,
    assignmentId: number,
    filePaths: string[],
    fileNames?: string[]
  ) => {
    let page: Page | null = null;

    try {
      // 连接到用户的浏览器
      page = await browserConnector.connect();

      // 打开作业页面
      const assignmentUrl = `https://oc.sjtu.edu.cn/courses/${courseId}/assignments/${assignmentId}`;
      await page.goto(assignmentUrl, { timeout: 60000, waitUntil: 'networkidle' });

      // 检查是否需要登录
      const currentPageUrl = page.url();
      console.log('[submitAssignmentViaWeb] 当前页面URL:', currentPageUrl);

      if (currentPageUrl.includes('/login') || currentPageUrl.includes('/cas')) {
        console.log('[submitAssignmentViaWeb] 未登录，导航到登录页面...');

        // 先导航到 Canvas 登录页面
        console.log('[submitAssignmentViaWeb] 导航到 Canvas 登录页面...');
        await page.goto('https://oc.sjtu.edu.cn/login/canvas', { timeout: 60000, waitUntil: 'networkidle' });

        // 等待页面加载
        await page.waitForTimeout(500);

        // 点击"校内用户登录"按钮（#jaccount div）
        console.log('[submitAssignmentViaWeb] 点击校内用户登录按钮...');
        try {
          // 等待 #jaccount 元素出现
          await page.waitForSelector('#jaccount', { timeout: 10000 });
          console.log('[submitAssignmentViaWeb] 找到 #jaccount 元素');

          // 获取 #jaccount 的位置并点击中心（因为 <a> 标签宽度为0，<div> 才是实际可点击区域）
          const clickPosition = await page.evaluate(() => {
            const jaccountElement = document.querySelector('#jaccount');
            if (jaccountElement) {
              const rect = jaccountElement.getBoundingClientRect();
              return {
                x: rect.x + rect.width / 2,
                y: rect.y + rect.height / 2
              };
            }
            return null;
          });

          if (clickPosition) {
            console.log('[submitAssignmentViaWeb] 点击坐标:', clickPosition);

            // 使用 Promise.race 同时等待点击和导航
            // 因为点击后页面会跳转，需要捕获新页面
            await Promise.all([
              page.waitForNavigation({ timeout: 30000, waitUntil: 'networkidle' }).catch(() => {
                console.log('[submitAssignmentViaWeb] 等待导航超时或没有发生导航');
              }),
              page.mouse.click(clickPosition.x, clickPosition.y)
            ]);
          } else {
            // 回退：直接点击元素
            console.log('[submitAssignmentViaWeb] 无法获取坐标，尝试直接点击 #jaccount');
            await Promise.all([
              page.waitForNavigation({ timeout: 30000, waitUntil: 'networkidle' }).catch(() => {
                console.log('[submitAssignmentViaWeb] 等待导航超时或没有发生导航');
              }),
              page.click('#jaccount')
            ]);
          }

          console.log('[submitAssignmentViaWeb] 已点击校内用户登录按钮，当前URL:', page.url());
        } catch (err) {
          console.log('[submitAssignmentViaWeb] 点击失败:', err);
          // 不直接导航到 openid_connect，因为会重置页面
          // 让用户手动处理登录
          return {
            success: false,
            error: '自动点击登录按钮失败，请手动点击"校内用户登录"按钮完成登录',
            needLogin: true,
          };
        }

        // 等待跳转到 jAccount 登录页面
        console.log('[submitAssignmentViaWeb] 等待页面跳转...');
        await page.waitForTimeout(500);

        console.log('[submitAssignmentViaWeb] 当前URL:', page.url());

        // 等待5秒钟让插件自动输入账号密码
        console.log('[submitAssignmentViaWeb] 等待5秒钟让插件自动输入账号密码...');
        await page.waitForTimeout(500);

        // 检查是否已登录（URL不再包含/login）
        const currentUrl = page.url();
        console.log('[submitAssignmentViaWeb] 当前URL:', currentUrl);
        if (currentUrl.includes('/login') || currentUrl.includes('/cas')) {
          // 如果还在登录页面，可能是插件还没完成登录，再等待一会儿
          console.log('[submitAssignmentViaWeb] 仍在登录页面，继续等待10秒...');
          await page.waitForTimeout(10000);
        }

        // 再次检查是否已登录
        const finalUrl = page.url();
        if (finalUrl.includes('/login') || finalUrl.includes('/cas')) {
          return {
            success: false,
            error: '登录超时，请手动登录Canvas后重试',
            needLogin: true,
          };
        }

        console.log('[submitAssignmentViaWeb] 登录成功，继续提交作业...');

        // 重新导航到作业页面
        await page.goto(assignmentUrl, { timeout: 60000, waitUntil: 'networkidle' });
        await page.waitForTimeout(500);
      }

      // 检查作业是否已经提交
      const submittedIndicator = await page.$('.submission_status.submitted, .submission-details');
      if (submittedIndicator) {
        // 作业已提交，询问是否重新提交
        const result = await dialog.showMessageBox({
          type: 'question',
          buttons: ['重新提交', '取消'],
          defaultId: 1,
          title: '作业已提交',
          message: '该作业已经提交过了。您确定要重新提交吗？',
        });

        if (result.response === 1) {
          return { success: false, error: '用户取消提交' };
        }
      }

      // 点击"提交作业"按钮
      const submitButtonSelectors = [
        'a.submit_assignment_link',
        'button.submit_assignment_link',
        '.submit_assignment_link',
        'a:has-text("提交作业")',
        'button:has-text("提交作业")',
        'a:has-text("Submit Assignment")',
        'button:has-text("Submit Assignment")',
        '[data-testid="submit-assignment-button"]',
        '.btn-primary:has-text("提交")',
        '.btn-primary:has-text("Submit")',
      ];

      let submitButton = null;
      for (const selector of submitButtonSelectors) {
        try {
          submitButton = await page.$(selector);
          if (submitButton) {
            console.log('[submitAssignmentViaWeb] Found submit button with selector:', selector);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!submitButton) {
        // 调试：输出页面内容帮助诊断
        console.log('[submitAssignmentViaWeb] Page URL:', page.url());
        const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
        console.log('[submitAssignmentViaWeb] Page text snippet:', pageText);
        return { success: false, error: '未找到"提交作业"按钮，请检查作业是否可提交' };
      }

      await submitButton.click();

      // 等待提交表单加载 - 增加等待时间确保页面完全加载
      await page.waitForTimeout(500);

      // 调试：输出当前页面信息
      console.log('[submitAssignmentViaWeb] Current URL after click:', page.url());

      // 等待提交表单区域显示（Canvas 使用 display:none/block 切换）
      console.log('[submitAssignmentViaWeb] Waiting for submit assignment form...');
      try {
        // Playwright 使用 state: 'visible' 而不是 visible: true
        await page.waitForSelector('#submit_assignment', { state: 'visible', timeout: 10000 });
        console.log('[submitAssignmentViaWeb] Submit assignment form is now visible');
      } catch (err) {
        console.log('[submitAssignmentViaWeb] Timeout waiting for #submit_assignment, continuing anyway...');
      }

      // 等待文件上传区域出现
      // Canvas 使用特殊的附件上传系统，需要点击"添加其它文件"按钮
      const fileInputSelectors = [
        'input[type="file"][name="attachments[]"]',
        'input[type="file"][name="attachment"]',
        'input[type="file"][name="file"]',
        'input[type="file"]',
        '#submission_attachment',
        '#attachment_uploaded_data',
        '#submission_attachments input[type="file"]',
        '.file-upload input[type="file"]',
        '[data-testid="file-input"]',
        'input[name="attachments[]"]',
        'input[name="attachment"]',
      ];

      // Canvas 的文件上传系统：直接查找文件输入框并上传
      console.log('[submitAssignmentViaWeb] Looking for file input...');

      // 等待一下确保表单完全渲染
      await page.waitForTimeout(500);

      // 首先尝试找到并点击"上传文件"按钮
      const uploadFileButtonSelectors = [
        'button:has-text("上传文件")',
        'button:has-text("Upload File")',
        '.Button:has-text("上传文件")',
        '.Button:has-text("Upload File")',
        '[data-testid="upload-file-button"]',
        'button[type="button"]:has(.icon-upload)',
      ];

      let uploadFileButton = null;
      for (const selector of uploadFileButtonSelectors) {
        try {
          uploadFileButton = await page.$(selector);
          if (uploadFileButton) {
            console.log('[submitAssignmentViaWeb] Found upload file button with selector:', selector);
            break;
          }
        } catch {
          continue;
        }
      }

      // 如果找到了"上传文件"按钮，点击它
      if (uploadFileButton) {
        console.log('[submitAssignmentViaWeb] Clicking upload file button...');
        await uploadFileButton.click();
        // 等待文件选择对话框出现
        await page.waitForTimeout(500);
      } else {
        // 备选方案：尝试"添加其它文件"按钮
        console.log('[submitAssignmentViaWeb] Upload file button not found, trying add another file button...');
        const addFileButtonSelectors = [
          '.add_another_file_link',
          'button:has-text("添加其它文件")',
          'button:has-text("Add Another File")',
          'a:has-text("添加其它文件")',
          'a:has-text("Add Another File")',
          '.Button--link:has(.icon-add)',
        ];

        let addFileButton = null;
        for (const selector of addFileButtonSelectors) {
          try {
            addFileButton = await page.$(selector);
            if (addFileButton) {
              console.log('[submitAssignmentViaWeb] Found add file button with selector:', selector);
              break;
            }
          } catch {
            continue;
          }
        }

        if (addFileButton) {
          console.log('[submitAssignmentViaWeb] Clicking add file button...');
          await addFileButton.click();
          await page.waitForTimeout(500);
        }
      }

      // 现在查找文件输入框
      let fileInput = null;
      for (const selector of fileInputSelectors) {
        try {
          fileInput = await page.$(selector);
          if (fileInput) {
            console.log('[submitAssignmentViaWeb] Found file input with selector:', selector);
            break;
          }
        } catch (err) {
          console.log('[submitAssignmentViaWeb] Selector failed:', selector, err);
          continue;
        }
      }

      // 如果还是没找到，尝试等待文件输入框动态创建
      if (!fileInput) {
        console.log('[submitAssignmentViaWeb] Waiting for file input to be created...');
        try {
          // 等待文件输入框出现（最多等待1秒）
          await page.waitForFunction(() => {
            const inputs = document.querySelectorAll('input[type="file"]');
            return inputs.length > 0;
          }, { timeout: 1000 });

          // 重新查找
          for (const selector of fileInputSelectors) {
            try {
              fileInput = await page.$(selector);
              if (fileInput) {
                console.log('[submitAssignmentViaWeb] Found file input after waiting with selector:', selector);
                break;
              }
            } catch (err) {
              continue;
            }
          }
        } catch (waitErr) {
          console.log('[submitAssignmentViaWeb] Timeout waiting for file input creation');
        }
      }

      if (!fileInput) {
        // 调试：尝试查找页面上所有的 input 元素
        console.log('[submitAssignmentViaWeb] Trying to find all file inputs...');
        const allInputs = await page.$$('input');
        console.log('[submitAssignmentViaWeb] Total input elements found:', allInputs.length);

        for (let i = 0; i < Math.min(allInputs.length, 20); i++) {
          const input = allInputs[i];
          const type = await input.evaluate(el => (el as HTMLInputElement).type);
          const name = await input.evaluate(el => (el as HTMLInputElement).name);
          const id = await input.evaluate(el => (el as HTMLInputElement).id);
          const style = await input.evaluate(el => {
            const computed = window.getComputedStyle(el);
            return `display:${computed.display},visibility:${computed.visibility}`;
          });
          console.log(`[submitAssignmentViaWeb] Input ${i}: type=${type}, name=${name}, id=${id}, style=${style}`);
        }

        // 检查是否有 iframe
        console.log('[submitAssignmentViaWeb] Checking for iframes...');
        const frames = page.frames();
        console.log('[submitAssignmentViaWeb] Number of frames:', frames.length);

        for (let i = 0; i < frames.length; i++) {
          const frame = frames[i];
          console.log(`[submitAssignmentViaWeb] Checking frame ${i}...`);
          try {
            for (const selector of fileInputSelectors) {
              const frameInput = await frame.$(selector);
              if (frameInput) {
                fileInput = frameInput;
                console.log(`[submitAssignmentViaWeb] Found file input in frame ${i} with selector:`, selector);
                break;
              }
            }
            if (fileInput) break;
          } catch (err) {
            console.log(`[submitAssignmentViaWeb] Frame ${i} check failed:`, err);
          }
        }

        if (!fileInput) {
          return { success: false, error: '未找到文件上传区域，请检查作业是否支持文件上传' };
        }
      }

      // 上传文件
      for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i];
        const customFileName = fileNames?.[i];

        // 如果需要重命名文件，创建临时文件
        let uploadPath = filePath;
        if (customFileName) {
          const tempDir = app.getPath('temp');
          const originalExt = filePath.includes('.')
            ? filePath.slice(filePath.lastIndexOf('.'))
            : '';

          // 检查 customFileName 是否已经包含扩展名
          const finalFileName = customFileName.endsWith(originalExt)
            ? customFileName
            : `${customFileName}${originalExt}`;

          const tempPath = join(tempDir, finalFileName);

          // 复制文件到临时位置
          await fs.copyFile(filePath, tempPath);
          uploadPath = tempPath;
        }

        // 上传文件
        if (!fileInput) {
          return { success: false, error: '未找到文件上传区域' };
        }
        await fileInput.setInputFiles(uploadPath);

        // 等待上传完成 - 检测上传进度或完成标志
        // Canvas 会在上传完成后显示文件名和删除按钮
        console.log('[submitAssignmentViaWeb] 等待文件上传完成...');
        try {
          // 等待文件列表中出现上传的文件名，或上传完成标志
          // 检测条件：出现 .file-name 元素或 .attachment 元素
          await page.waitForFunction(
            () => {
              // 检查是否有文件显示在列表中
              const fileNames = document.querySelectorAll('.file-name, .attachment-name, .uploaded-file');
              return fileNames.length > 0;
            },
            { timeout: 300000 } // 5分钟超时，大文件上传可能需要较长时间
          );
          console.log('[submitAssignmentViaWeb] 文件上传完成');
        } catch {
          // 如果检测不到上传完成标志，继续执行（可能页面结构不同）
          console.log('[submitAssignmentViaWeb] 未检测到上传完成标志，继续执行');
        }

        // 清理临时文件
        if (uploadPath !== filePath) {
          try {
            await fs.unlink(uploadPath);
          } catch {
            // 忽略清理错误
          }
        }

        // 如果还有下一个文件，可能需要点击"添加另一个文件"按钮
        if (i < filePaths.length - 1) {
          const addAnotherButton = await page.$('a:has-text("添加另一个文件"), a:has-text("Add Another File")');
          if (addAnotherButton) {
            await addAnotherButton.click();
            await page.waitForTimeout(500);

            // 重新获取文件输入框
            for (const selector of fileInputSelectors) {
              try {
                fileInput = await page.$(selector);
                if (fileInput) break;
              } catch {
                continue;
              }
            }
          }
        }
      }

      // 文件上传完成，但不自动提交，让用户手动决定是否提交
      // 断开连接，保持浏览器运行
      await browserConnector.disconnect();

      return { success: true, message: '文件已上传，请手动点击提交按钮完成提交' };
    } catch (error) {
      // 断开连接
      await browserConnector.disconnect();

      const errorMessage = error instanceof Error ? error.message : '提交失败';
      return { success: false, error: errorMessage };
    }
  }
);

