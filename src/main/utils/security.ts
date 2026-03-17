/**
 * Canvas Drop Submit - 安全工具函数
 * @module main/utils/security
 * @description 提供文件名净化、URL验证、路径验证等安全功能
 */

import path from 'path';

/**
 * 允许的 Canvas 域名列表
 */
export const ALLOWED_CANVAS_HOSTS = [
  'oc.sjtu.edu.cn',
  'canvas.instructure.com',
  'canvas.sjtu.edu.cn',
];

/**
 * 净化文件名，移除路径遍历字符和危险字符
 * @param filename - 原始文件名
 * @returns 净化后的文件名
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed_file';
  }

  // 移除路径分隔符和危险字符
  let sanitized = filename
    .replace(/[\\/:*?"<>|]/g, '_') // 替换 Windows 非法字符
    .replace(/\.{2,}/g, '_') // 替换多个连续点号
    .replace(/^[.\\/]+/, '') // 移除开头的点、斜杠和反斜杠
    .trim();

  // 确保不为空
  if (!sanitized) {
    sanitized = 'unnamed_file';
  }

  // 限制文件名长度（避免文件系统限制）
  const MAX_LENGTH = 200;
  if (sanitized.length > MAX_LENGTH) {
    const ext = sanitized.includes('.')
      ? sanitized.slice(sanitized.lastIndexOf('.'))
      : '';
    sanitized = sanitized.slice(0, MAX_LENGTH - ext.length) + ext;
  }

  return sanitized;
}

/**
 * 验证 Canvas URL 是否合法
 * @param url - 要验证的 URL
 * @param allowedHosts - 允许的域名列表（可选，默认使用 ALLOWED_CANVAS_HOSTS）
 * @returns 是否为合法的 Canvas URL
 */
export function isValidCanvasUrl(
  url: string,
  allowedHosts: string[] = ALLOWED_CANVAS_HOSTS
): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // 允许相对路径（以 / 开头）- 这些会被视为 Canvas 内部链接
  if (url.startsWith('/')) {
    return true;
  }

  try {
    const urlObj = new URL(url);
    // 只允许 HTTPS 协议
    if (urlObj.protocol !== 'https:') {
      return false;
    }
    return allowedHosts.includes(urlObj.hostname);
  } catch {
    return false;
  }
}

/**
 * 验证下载路径是否在允许的范围内
 * @param targetPath - 要验证的目标路径
 * @param allowedBasePath - 允许的基础路径（通常是用户主目录）
 * @returns 是否为合法的下载路径
 */
export function isValidDownloadPath(
  targetPath: string,
  allowedBasePath: string
): boolean {
  if (!targetPath || !allowedBasePath) {
    return false;
  }

  try {
    const resolvedPath = path.resolve(targetPath);
    const resolvedBase = path.resolve(allowedBasePath);

    // 确保目标路径在允许的基础路径下
    // 注意：使用 path.sep 确保跨平台兼容性
    const normalizedPath = resolvedPath + path.sep;
    const normalizedBase = resolvedBase + path.sep;

    return normalizedPath.startsWith(normalizedBase);
  } catch {
    return false;
  }
}

/**
 * 安全的路径拼接
 * @param basePath - 基础路径
 * @param filename - 文件名
 * @returns 安全的完整路径
 */
export function safeJoinPath(basePath: string, filename: string): string {
  const sanitized = sanitizeFilename(filename);
  return path.join(basePath, sanitized);
}
