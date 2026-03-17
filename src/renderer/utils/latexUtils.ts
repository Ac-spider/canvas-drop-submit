/**
 * LaTeX 处理工具函数
 * 用于从 Canvas HTML 中提取和转换数学公式
 */

/**
 * 从 Canvas equation_images URL 中提取 LaTeX 代码
 * 例如: /equation_images/S%255Csubset%255Cmathbb%257BR%257D%255En?scale=1
 * 提取: S\subset\mathbb{R}^n
 *
 * URL 编码过程:
 * 1. LaTeX: S\subset\mathbb{R}^n
 * 2. encodeURIComponent: S%5Csubset%5Cmathbb%7BR%7D%5En
 * 3. 再次编码: S%255Csubset%255Cmathbb%257BR%257D%255En
 */
export function extractLatexFromUrl(url: string): string | null {
  try {
    // 匹配 equation_images 路径
    const match = url.match(/\/equation_images\/([^?]+)/);
    if (!match) {
      return null;
    }

    // 获取编码后的 LaTeX 代码
    const encoded = match[1];

    // 进行双重 URL 解码（Canvas 对 LaTeX 进行了双重编码）
    let latex = decodeURIComponent(encoded);
    // 有些情况下可能只编码了一次，尝试再次解码
    try {
      latex = decodeURIComponent(latex);
    } catch {
      // 如果第二次解码失败，使用第一次的结果
    }

    return latex;
  } catch {
    return null;
  }
}

/**
 * 从 alt 属性中提取 LaTeX 代码
 * alt 格式: "LaTeX: S\\subset\\mathbb{R}^n"
 */
export function extractLatexFromAlt(alt: string): string | null {
  const match = alt.match(/^LaTeX:\s*(.+)$/);
  return match ? match[1] : null;
}

/**
 * 判断 LaTeX 是否是显示模式（行间公式）
 * 根据内容特征判断
 */
function isDisplayMode(latex: string): boolean {
  const displayPatterns = [
    /^\\begin\{(align|equation|gather|multline|eqnarray)/,
    /^\\\[/,
    /\\\]$/,
    /\\\\\s*$/m, // 行尾有换行符
  ];
  return displayPatterns.some((pattern) => pattern.test(latex.trim()));
}

/**
 * 将 Canvas HTML 中的数学图片转换为 LaTeX 标记
 * 将 <img src="...equation_images..." alt="LaTeX: ..."> 转换为 $...$ 或 $$...$$
 */
export function convertCanvasMathToLatex(html: string): string {
  if (!html) {
    return '';
  }

  // 创建临时 DOM 解析器
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 查找所有 equation_images 图片
  const mathImages = doc.querySelectorAll('img[src*="equation_images"]');

  mathImages.forEach((img) => {
    const src = img.getAttribute('src') || '';
    const alt = img.getAttribute('alt') || '';
    const title = img.getAttribute('title') || '';

    // 尝试从 alt 属性提取 LaTeX
    let latex = extractLatexFromAlt(alt);

    // 如果 alt 中没有，尝试从 URL 提取
    if (!latex) {
      latex = extractLatexFromUrl(src);
    }

    // 如果 title 中有 LaTeX 代码，优先使用
    if (title && title.includes('\\')) {
      latex = title;
    }

    if (latex) {
      // 判断是行内公式还是行间公式
      const isDisplay = isDisplayMode(latex);
      const delimiter = isDisplay ? '$$' : '$';

      // 创建文本节点替换图片
      const textNode = doc.createTextNode(`${delimiter}${latex}${delimiter}`);
      img.parentNode?.replaceChild(textNode, img);
    }
  });

  // 返回处理后的 HTML
  return doc.body.innerHTML;
}

/**
 * 清理 HTML 以便 react-markdown 处理
 * 移除不必要的属性，保留基本结构
 */
export function sanitizeForMarkdown(html: string): string {
  if (!html) {
    return '';
  }

  // 首先转换数学公式图片
  let processed = convertCanvasMathToLatex(html);

  // 移除 script 标签
  processed = processed.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // 移除 style 标签
  processed = processed.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // 移除事件处理属性
  processed = processed.replace(/\son\w+="[^"]*"/gi, '');

  // 将 HTML 实体转换回字符
  processed = processed.replace(/&nbsp;/g, ' ');
  processed = processed.replace(/&lt;/g, '<');
  processed = processed.replace(/&gt;/g, '>');
  processed = processed.replace(/&amp;/g, '&');

  return processed;
}

/**
 * 将 HTML 转换为 Markdown 格式
 * react-markdown 可以处理基本的 HTML 标签，
 * 但我们需要确保数学公式被正确标记
 */
export function htmlToMarkdown(html: string): string {
  if (!html) {
    return '';
  }

  // 先处理数学公式
  let markdown = sanitizeForMarkdown(html);

  // 将 <br>, <br/> 转换为换行符
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');

  // 将 <p> 标签转换为换行段落
  markdown = markdown.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
  markdown = markdown.replace(/<p[^>]*>/gi, '');
  markdown = markdown.replace(/<\/p>/gi, '');

  return markdown;
}

/**
 * 预处理 HTML，确保 LaTeX 公式能被正确渲染
 * 处理嵌套在 HTML 标签中的 $...$ 和 $$...$$ 公式
 */
export function preprocessLatexInHtml(html: string): string {
  if (!html) {
    return '';
  }

  // 首先转换 Canvas 数学图片为 LaTeX
  let processed = convertCanvasMathToLatex(html);

  // 处理 HTML 实体
  processed = processed.replace(/&nbsp;/g, ' ');
  processed = processed.replace(/&lt;/g, '<');
  processed = processed.replace(/&gt;/g, '>');
  processed = processed.replace(/&amp;/g, '&');

  // 创建一个临时的 div 来解析 HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(processed, 'text/html');

  // 递归处理文本节点
  const processNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();

      // 处理子节点
      let content = '';
      element.childNodes.forEach((child) => {
        content += processNode(child);
      });

      // 对于块级元素，添加换行
      if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].includes(tagName)) {
        return `\n${content}\n`;
      }

      // 对于行内元素，保持原样
      if (tagName === 'strong' || tagName === 'b') {
        // 如果内容为空或只有空白，跳过
        if (!content.trim()) return content;
        return `**${content}**`;
      }
      if (tagName === 'em' || tagName === 'i') {
        // 如果内容为空或只有空白，跳过
        if (!content.trim()) return content;
        return `*${content}*`;
      }
      if (tagName === 'span') {
        // span 标签直接返回内容
        return content;
      }

      return content;
    }

    return '';
  };

  // 处理 body 的所有子节点
  let result = '';
  doc.body.childNodes.forEach((node) => {
    result += processNode(node);
  });

  // 清理多余的星号和空格
  result = result.replace(/\*\*\s*\*\*/g, ''); // 移除 ** **
  result = result.replace(/\*\*\s+/g, '**'); // 移除 ** 后的空格
  result = result.replace(/\s+\*\*/g, '**'); // 移除 ** 前的空格
  result = result.replace(/\*\*\*\*/g, ''); // 移除 ****
  result = result.replace(/\*\*\s*$/gm, ''); // 移除行尾的 **
  result = result.replace(/^\s*\*\*/gm, ''); // 移除行首的 **

  // 清理多余换行
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

/**
 * 为预览截断文本，确保不截断在格式标记中间
 * @param text - 要截断的文本
 * @param maxLength - 最大长度
 * @returns 截断后的文本
 */
export function truncateForPreview(text: string, maxLength: number = 200): string {
  if (!text || text.length <= maxLength) {
    return text;
  }

  // 先进行预处理
  const processed = preprocessLatexInHtml(text);

  if (processed.length <= maxLength) {
    return processed;
  }

  // 截断到 maxLength
  let truncated = processed.slice(0, maxLength);

  // 检查是否有未闭合的 **
  const openBoldCount = (truncated.match(/\*\*/g) || []).length;
  if (openBoldCount % 2 !== 0) {
    // 有未闭合的 **，尝试找到最后一个完整的 ** 对
    const lastDoubleStar = truncated.lastIndexOf('**');
    if (lastDoubleStar > 0) {
      truncated = truncated.slice(0, lastDoubleStar);
    }
  }

  // 检查是否有未闭合的 *
  const openItalicCount = (truncated.match(/(?<!\*)\*(?!\*)/g) || []).length;
  if (openItalicCount % 2 !== 0) {
    // 有未闭合的 *，尝试找到最后一个完整的 * 对
    const lastSingleStar = truncated.lastIndexOf('*');
    if (lastSingleStar > 0) {
      truncated = truncated.slice(0, lastSingleStar);
    }
  }

  // 检查是否有未闭合的 $
  const openMathCount = (truncated.match(/\$/g) || []).length;
  if (openMathCount % 2 !== 0) {
    // 有未闭合的 $，尝试找到最后一个完整的 $ 对
    const lastDollar = truncated.lastIndexOf('$');
    if (lastDollar > 0) {
      truncated = truncated.slice(0, lastDollar);
    }
  }

  return truncated + '...';
}
