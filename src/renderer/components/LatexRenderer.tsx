import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { preprocessLatexInHtml, truncateForPreview } from '../utils/latexUtils';

export { truncateForPreview };

interface LatexRendererProps {
  html: string;
  className?: string;
}

/**
 * LaTeX 渲染组件
 * 使用 react-markdown + remark-math + rehype-katex 渲染包含 LaTeX 公式的内容
 *
 * 将 Canvas HTML 中的数学公式图片转换为可渲染的 LaTeX
 */
export function LatexRenderer({ html, className }: LatexRendererProps): JSX.Element {
  // 转换 HTML 中的数学公式
  const processed = useMemo(() => {
    return preprocessLatexInHtml(html);
  }, [html]);

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}

export default LatexRenderer;
