/**
 * Canvas Drop Submit - 作业附件解析工具
 * @module utils/assignmentUtils
 * @description 从作业描述（HTML）中提取附件链接
 */

/**
 * 作业附件类型
 */
export interface AssignmentAttachment {
  /** 附件唯一标识（从URL中提取或生成） */
  id: string;
  /** 文件名 */
  name: string;
  /** 文件URL */
  url: string;
  /** 文件类型 */
  type: 'pdf' | 'doc' | 'docx' | 'ppt' | 'pptx' | 'xls' | 'xlsx' | 'image' | 'other';
  /** 文件扩展名 */
  extension: string;
}

/**
 * 从文件名或URL中提取文件扩展名
 * @param filename - 文件名或URL
 * @returns 小写的扩展名（不含点）
 */
function getFileExtension(filename: string): string {
  const match = filename.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * 根据扩展名判断文件类型
 * @param extension - 文件扩展名（不含点）
 * @returns 文件类型
 */
function getFileType(extension: string): AssignmentAttachment['type'] {
  const typeMap: Record<string, AssignmentAttachment['type']> = {
    pdf: 'pdf',
    doc: 'doc',
    docx: 'docx',
    ppt: 'ppt',
    pptx: 'pptx',
    xls: 'xls',
    xlsx: 'xlsx',
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    gif: 'image',
    bmp: 'image',
    svg: 'image',
    webp: 'image',
  };
  return typeMap[extension] || 'other';
}

/**
 * 获取文件类型显示图标
 * @param type - 文件类型
 * @returns 图标字符
 */
export function getAttachmentIcon(type: AssignmentAttachment['type']): string {
  const iconMap: Record<AssignmentAttachment['type'], string> = {
    pdf: '📄',
    doc: '📝',
    docx: '📝',
    ppt: '📊',
    pptx: '📊',
    xls: '📈',
    xlsx: '📈',
    image: '🖼️',
    other: '📎',
  };
  return iconMap[type];
}

/**
 * 从URL中提取文件名
 * @param url - 文件URL
 * @returns 文件名
 */
function extractFilenameFromUrl(url: string): string {
  try {
    // 尝试从URL路径中提取文件名
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || '';

    // URL解码
    const decoded = decodeURIComponent(filename);

    // 移除查询参数（如果有）
    return decoded.replace(/\?.*$/, '');
  } catch {
    // 如果URL解析失败，尝试直接从字符串提取
    const match = url.match(/\/([^/]+?)(?:\?.*)?$/);
    return match ? decodeURIComponent(match[1]) : url;
  }
}

/**
 * 生成附件唯一ID
 * @param url - 文件URL
 * @returns ID字符串
 */
function generateAttachmentId(url: string): string {
  // 使用URL的最后部分作为ID基础
  const parts = url.split('/');
  const lastPart = parts[parts.length - 1] || url;
  // 移除查询参数并清理
  const clean = lastPart.split('?')[0].replace(/[^a-zA-Z0-9]/g, '');
  return clean || String(Math.random()).slice(2, 10);
}

/**
 * 从HTML描述中提取附件链接
 *
 * 支持的链接格式：
 * 1. 标准链接：<a href="...">filename.pdf</a>
 * 2. Canvas文件链接：包含 /files/ 或 download?filename= 的链接
 * 3. 图片链接：<img src="...">（会被识别为image类型）
 *
 * @param html - HTML格式的作业描述
 * @returns 附件列表
 */
export function extractAttachmentsFromHtml(html: string | undefined | null): AssignmentAttachment[] {
  if (!html || typeof html !== 'string') {
    return [];
  }

  const attachments: AssignmentAttachment[] = [];
  const seenUrls = new Set<string>();

  // 1. 提取 <a> 标签中的链接
  const anchorRegex = /<a[^>]+href="([^"]+)"[^>]*>([^<]*)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorRegex.exec(html)) !== null) {
    const url = match[1];
    const linkText = match[2].trim();

    // 跳过非文件链接（如页面内锚点、javascript等）
    if (
      url.startsWith('#') ||
      url.startsWith('javascript:') ||
      url.startsWith('mailto:') ||
      url.startsWith('tel:')
    ) {
      continue;
    }

    // 跳过已处理的URL
    if (seenUrls.has(url)) {
      continue;
    }

    // 判断是否为文件链接
    // 1. 链接文本包含文件扩展名
    // 2. URL包含 /files/ 或 download 关键词
    // 3. URL以常见文件扩展名结尾
    const extensionFromUrl = getFileExtension(url);
    const extensionFromText = getFileExtension(linkText);
    const isFileUrl =
      extensionFromUrl ||
      extensionFromText ||
      url.includes('/files/') ||
      url.includes('download') ||
      url.includes('/file_contents/');

    if (isFileUrl) {
      seenUrls.add(url);

      // 确定文件名
      let filename = linkText;
      if (!filename || !filename.includes('.')) {
        // 如果链接文本不包含文件名，尝试从URL提取
        filename = extractFilenameFromUrl(url);
      }

      // 如果仍然没有扩展名，尝试从URL获取
      const extension = extensionFromText || extensionFromUrl || 'unknown';
      if (!filename.includes('.') && extension !== 'unknown') {
        filename = `${filename}.${extension}`;
      }

      attachments.push({
        id: generateAttachmentId(url),
        name: filename || '未命名文件',
        url,
        type: getFileType(extension),
        extension,
      });
    }
  }

  // 2. 提取 <img> 标签中的图片链接（作为可选附件）
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
  while ((match = imgRegex.exec(html)) !== null) {
    const url = match[1];

    // 跳过数据URI和已处理的URL
    if (url.startsWith('data:') || seenUrls.has(url)) {
      continue;
    }

    // 跳过数学公式图片（Canvas equation_images）
    if (url.includes('equation_images')) {
      continue;
    }

    seenUrls.add(url);

    const extension = getFileExtension(url) || 'jpg';
    const filename = extractFilenameFromUrl(url) || `image-${attachments.length + 1}.${extension}`;

    attachments.push({
      id: generateAttachmentId(url),
      name: filename,
      url,
      type: 'image',
      extension,
    });
  }

  // 3. 提取 Canvas 特定的文件引用（如 file_ref 数据属性）
  const fileRefRegex = /data-file-id="(\d+)"[^>]*data-file-name="([^"]+)"/gi;
  while ((match = fileRefRegex.exec(html)) !== null) {
    const fileId = match[1];
    const filename = match[2];

    // 构建Canvas文件URL（相对路径，需要结合课程信息）
    const url = `/files/${fileId}/download`;

    if (!seenUrls.has(url)) {
      seenUrls.add(url);

      const extension = getFileExtension(filename);
      attachments.push({
        id: fileId,
        name: filename,
        url,
        type: getFileType(extension),
        extension,
      });
    }
  }

  return attachments;
}

/**
 * 检查作业描述中是否包含附件
 * @param html - HTML格式的作业描述
 * @returns 是否包含附件
 */
export function hasAttachments(html: string | undefined | null): boolean {
  if (!html || typeof html !== 'string') {
    return false;
  }

  // 快速检查：是否包含文件链接的特征
  const hasFileLink =
    /<a[^>]+href="[^"]*(?:\/files\/|download|\.pdf|\.doc|\.docx|\.ppt|\.pptx)"/i.test(html);
  // 只检查非数学公式的图片
  const hasImg = /<img[^>]+src="[^"]*(?:\/files\/|download|[^"]*\.(?:jpg|jpeg|png|gif|bmp|svg|webp))"/i.test(html);

  return hasFileLink || hasImg;
}

/**
 * 从Canvas文件URL中提取文件ID
 * 支持的格式：
 * - /files/123/download
 * - /files/123
 * - /courses/88113/files/12783782?wrap=1
 * - https://oc.sjtu.edu.cn/courses/88113/files/12783782
 * - https://oc.sjtu.edu.cn/files/123/download
 *
 * @param url - Canvas文件URL
 * @returns 文件ID或null
 */
export function extractFileIdFromUrl(url: string): number | null {
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
 * 判断URL是否为Canvas文件链接
 * 支持的格式：
 * - /files/123
 * - /files/123/download
 * - /courses/88113/files/12783782?wrap=1
 * - https://oc.sjtu.edu.cn/courses/88113/files/12783782
 *
 * @param url - 要检查的URL
 * @returns 是否为Canvas文件链接
 */
export function isCanvasFileUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // 检查是否是Canvas文件链接（相对路径或完整URL）
  // 支持 /courses/{course_id}/files/{file_id} 格式
  if (/\/courses\/\d+\/files\/\d+/.test(url)) {
    return true;
  }

  // 支持 /files/{file_id} 格式
  if (/\/files\/\d+/.test(url)) {
    return true;
  }

  return false;
}

/**
 * 过滤特定类型的附件
 * @param attachments - 附件列表
 * @param types - 要保留的文件类型
 * @returns 过滤后的附件列表
 */
export function filterAttachmentsByType(
  attachments: AssignmentAttachment[],
  types: AssignmentAttachment['type'][]
): AssignmentAttachment[] {
  return attachments.filter((att) => types.includes(att.type));
}

/**
 * 获取PDF附件
 * @param attachments - 附件列表
 * @returns PDF附件列表
 */
export function getPdfAttachments(attachments: AssignmentAttachment[]): AssignmentAttachment[] {
  return filterAttachmentsByType(attachments, ['pdf']);
}

/**
 * 格式化附件大小（如果已知）
 * @param bytes - 字节数
 * @returns 格式化后的字符串
 */
export function formatAttachmentSize(bytes: number | undefined): string {
  if (bytes === undefined || bytes === null) {
    return '';
  }
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
