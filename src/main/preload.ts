/**
 * Electron 预加载脚本
 * @module main/preload
 * @description 安全地暴露Electron API给渲染进程
 */

import { contextBridge, ipcRenderer } from 'electron';

// ============================================================================
// Electron API 暴露给渲染进程
// ============================================================================

// 在预加载脚本上下文中获取 webUtils
// Electron 28+ 中 webUtils 是 electron 模块的一个属性
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const electronModule = require('electron') as any;
const webUtils = electronModule.webUtils;

/**
 * Electron API 对象
 * 通过contextBridge安全地暴露给渲染进程
 */
const electronAPI = {
  /**
   * 获取文件路径（使用Electron内部webUtils.getPathForFile）
   * @param file - Web File对象
   * @returns 文件系统路径
   */
  getPathForFile: (file: File): string => {
    try {
      // 使用Electron 28+的webUtils.getPathForFile
      if (!webUtils) {
        console.error('[preload] webUtils is not available, electronModule:', Object.keys(electronModule));
        throw new Error('webUtils API not available - please check Electron version');
      }
      const path = webUtils.getPathForFile(file);
      console.log('[preload] getPathForFile success:', path);
      return path;
    } catch (error) {
      console.error('[preload] getPathForFile error:', error);
      throw error;
    }
  },

  /**
   * 存储API Token（加密）
   * @param token - Canvas API Token
   */
  storeToken: async (token: string): Promise<void> => {
    await ipcRenderer.invoke('store:setToken', token);
  },

  /**
   * 获取存储的API Token
   * @returns Token或空字符串
   */
  getToken: async (): Promise<string> => {
    return ipcRenderer.invoke('store:getToken');
  },

  /**
   * 清除存储的API Token
   */
  clearToken: async (): Promise<void> => {
    await ipcRenderer.invoke('store:deleteToken');
  },

  /**
   * 读取文件内容
   * @param path - 文件路径
   * @returns 文件内容（Uint8Array）
   */
  readFile: async (path: string): Promise<Uint8Array> => {
    const result = await ipcRenderer.invoke('file:read', path);
    if (result.success) {
      return result.data;
    }
    throw new Error(result.error);
  },

  /**
   * 验证文件是否存在
   * @param path - 文件路径
   */
  validateFile: async (path: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('file:validate', path);
  },

  /**
   * 显示错误对话框
   * @param title - 标题
   * @param message - 消息
   */
  showError: async (title: string, message: string): Promise<void> => {
    await ipcRenderer.invoke('dialog:showError', title, message);
  },

  /**
   * 打开外部链接
   * @param url - URL地址
   */
  openExternal: async (url: string): Promise<void> => {
    await ipcRenderer.invoke('app:openExternal', url);
  },

  /**
   * 验证 Canvas API Token（通过主进程代理，避免CORS）
   * @param token - Canvas API Token
   */
  validateToken: async (token: string): Promise<{ valid: boolean; user?: unknown; error?: string }> => {
    return ipcRenderer.invoke('canvas:validateToken', token);
  },

  /**
   * 获取课程列表（通过主进程代理，避免CORS）
   * @param token - Canvas API Token
   */
  getCourses: async (token: string): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    return ipcRenderer.invoke('canvas:getCourses', token);
  },

  /**
   * 获取作业分组列表（通过主进程代理，避免CORS）
   * @param token - Canvas API Token
   * @param courseId - 课程ID
   */
  getAssignmentGroups: async (token: string, courseId: number): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    return ipcRenderer.invoke('canvas:getAssignmentGroups', token, courseId);
  },

  /**
   * 文件上传预请求（通过主进程代理，避免CORS）
   * @param token - Canvas API Token
   * @param courseId - 课程ID
   * @param fileName - 文件名
   * @param fileSize - 文件大小
   */
  uploadFilePre: async (token: string, courseId: number, fileName: string, fileSize: number): Promise<{ success: boolean; data?: unknown; error?: string; fallbackToUserUpload?: boolean }> => {
    return ipcRenderer.invoke('canvas:uploadFilePre', token, courseId, fileName, fileSize);
  },

  /**
   * 文件上传预请求 - 用户级别（备用方案）
   * 当课程文件上传无权限时使用
   * @param token - Canvas API Token
   * @param fileName - 文件名
   * @param fileSize - 文件大小
   */
  uploadFilePreUser: async (token: string, fileName: string, fileSize: number): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    return ipcRenderer.invoke('canvas:uploadFilePreUser', token, fileName, fileSize);
  },

  /**
   * 文件上传确认（通过主进程代理，避免CORS）
   * @param token - Canvas API Token
   * @param fileId - 文件ID
   */
  uploadFileConfirm: async (token: string, fileId: number): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    return ipcRenderer.invoke('canvas:uploadFileConfirm', token, fileId);
  },

  /**
   * 提交作业（通过主进程代理，避免CORS）
   * @param token - Canvas API Token
   * @param courseId - 课程ID
   * @param assignmentId - 作业ID
   * @param fileIds - 文件ID列表
   */
  submitAssignment: async (token: string, courseId: number, assignmentId: number, fileIds: number[]): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    return ipcRenderer.invoke('canvas:submitAssignment', token, courseId, assignmentId, fileIds);
  },

  /**
   * 获取课程文件列表（通过主进程代理，避免CORS）
   * @param token - Canvas API Token
   * @param courseId - 课程ID
   */
  getFiles: async (token: string, courseId: number): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    return ipcRenderer.invoke('canvas:getFiles', token, courseId);
  },

  /**
   * 下载文件（通过主进程代理，避免CORS）
   * @param url - 文件URL
   * @param filename - 文件名
   * @param savePath - 保存路径（可选）
   * @param token - Canvas API Token（下载Canvas文件时需要）
   */
  downloadFile: async (url: string, filename: string, savePath?: string, token?: string): Promise<{ success: boolean; path?: string; error?: string }> => {
    return ipcRenderer.invoke('file:download', url, filename, savePath, token);
  },

  /**
   * 上传文件到指定URL（Canvas文件上传第二步）
   * @param url - 上传目标URL
   * @param fileData - 文件数据（Uint8Array）
   * @param uploadParams - 上传表单参数
   */
  uploadFileToUrl: async (url: string, fileData: Uint8Array, uploadParams: Record<string, string>): Promise<{ success: boolean; data?: string; error?: string }> => {
    return ipcRenderer.invoke('file:uploadToUrl', url, fileData, uploadParams);
  },

  /**
   * 选择下载目录
   */
  selectDirectory: async (): Promise<{ success: boolean; path?: string; canceled?: boolean }> => {
    return ipcRenderer.invoke('dialog:selectDirectory');
  },

  /**
   * 获取课程排序
   * @param term - 学期名称
   */
  getCourseOrder: async (term: string): Promise<number[]> => {
    return ipcRenderer.invoke('store:getCourseOrder', term);
  },

  /**
   * 保存课程排序
   * @param term - 学期名称
   * @param courseIds - 课程ID数组
   */
  setCourseOrder: async (term: string, courseIds: number[]): Promise<void> => {
    await ipcRenderer.invoke('store:setCourseOrder', term, courseIds);
  },

  /**
   * 获取课程下载路径
   * @param courseId - 课程ID
   * @returns 下载路径或null
   */
  getCourseDownloadPath: async (courseId: number): Promise<string | null> => {
    return ipcRenderer.invoke('store:getCourseDownloadPath', courseId);
  },

  /**
   * 设置课程下载路径
   * @param courseId - 课程ID
   * @param path - 下载路径
   */
  setCourseDownloadPath: async (courseId: number, path: string): Promise<void> => {
    await ipcRenderer.invoke('store:setCourseDownloadPath', courseId, path);
  },

  /**
   * 获取课程模块列表（通过主进程代理，避免CORS）
   * @param token - Canvas API Token
   * @param courseId - 课程ID
   */
  getModules: async (token: string, courseId: number): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    return ipcRenderer.invoke('canvas:getModules', token, courseId);
  },

  /**
   * 获取模块项目列表（通过主进程代理，避免CORS）
   * @param token - Canvas API Token
   * @param courseId - 课程ID
   * @param moduleId - 模块ID
   */
  getModuleItems: async (token: string, courseId: number, moduleId: number): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    return ipcRenderer.invoke('canvas:getModuleItems', token, courseId, moduleId);
  },

  /**
   * 通过ID获取文件详情（通过主进程代理，避免CORS）
   * @param token - Canvas API Token
   * @param fileId - 文件ID
   */
  getFileById: async (token: string, fileId: number): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    return ipcRenderer.invoke('canvas:getFileById', token, fileId);
  },

  /**
   * 检查 Canvas 网页登录状态
   */
  checkWebLogin: async (): Promise<{ loggedIn: boolean; error?: string; needLogin?: boolean; message?: string }> => {
    return ipcRenderer.invoke('canvas:checkWebLogin');
  },

  /**
   * 打开 Canvas 登录窗口
   * 启动浏览器并导航到 Canvas 登录页面，让用户手动登录
   */
  openLoginWindow: async (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('canvas:openLoginWindow');
  },

  /**
   * 使用 Playwright 通过网页提交作业
   * @param courseId - 课程ID
   * @param assignmentId - 作业ID
   * @param filePaths - 文件路径数组
   * @param fileNames - 自定义文件名数组（可选，用于自动改名）
   */
  submitAssignmentViaWeb: async (
    courseId: number,
    assignmentId: number,
    filePaths: string[],
    fileNames?: string[]
  ): Promise<{ success: boolean; error?: string; needLogin?: boolean }> => {
    return ipcRenderer.invoke('canvas:submitAssignmentViaWeb', courseId, assignmentId, filePaths, fileNames);
  },
};

// ============================================================================
// 暴露API给渲染进程
// ============================================================================

/**
 * 通过contextBridge暴露API
 * 确保渲染进程和主进程的安全隔离
 */
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// ============================================================================
// 类型声明
// ============================================================================

declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}

export type ElectronAPI = typeof electronAPI;
