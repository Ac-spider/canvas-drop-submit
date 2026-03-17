import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Assignment, AssignmentGroup } from '../../shared/types';
import {
  extractAttachmentsFromHtml,
  getAttachmentIcon,
  type AssignmentAttachment,
} from '../utils/assignmentUtils';
import { LatexRenderer } from './LatexRenderer';
import { truncateForPreview } from '../utils/latexUtils';

/**
 * 作业筛选类型
 */
type AssignmentFilter = 'all' | 'pending' | 'submitted' | 'graded';

/**
 * AssignmentList 组件 Props 接口
 */
interface AssignmentListProps {
  /** 课程ID */
  courseId: number;
  /** 选择作业回调 */
  onSelectAssignment: (assignment: Assignment) => void;
  /** Canvas API Token */
  apiToken: string;
}

/**
 * 格式化日期显示
 * @param dateString ISO 8601 日期字符串
 * @returns 格式化后的日期字符串
 */
const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '无截止日期';

  const date = new Date(dateString);
  const now = new Date();
  const isOverdue = date < now;

  const formatted = date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return isOverdue ? `${formatted} (已逾期)` : formatted;
};

/**
 * 获取提交状态样式
 * @param assignment 作业对象
 * @returns Tailwind CSS 类名字符串
 */
const getSubmissionStatusClass = (assignment: Assignment): string => {
  // 严格检查：只有当 workflow_state 为 graded 且 score 存在时才显示"已评分"
  if (
    assignment.submission?.workflow_state === 'graded' &&
    assignment.submission?.score !== undefined &&
    assignment.submission?.score !== null
  ) {
    return 'bg-green-100 text-green-800';
  }
  if (assignment.submission?.workflow_state === 'submitted') {
    return 'bg-blue-100 text-blue-800';
  }
  if (assignment.submission?.missing) {
    return 'bg-red-100 text-red-800';
  }
  if (assignment.submission?.late) {
    return 'bg-yellow-100 text-yellow-800';
  }
  return 'bg-gray-100 text-gray-800';
};

/**
 * 获取提交状态文本
 * @param assignment 作业对象
 * @returns 状态文本
 */
const getSubmissionStatusText = (assignment: Assignment): string => {
  // 严格检查：只有当 workflow_state 为 graded 且 score 存在时才显示"已评分"
  if (
    assignment.submission?.workflow_state === 'graded' &&
    assignment.submission?.score !== undefined &&
    assignment.submission?.score !== null
  ) {
    return '已评分';
  }
  if (assignment.submission?.workflow_state === 'submitted') {
    return '已提交';
  }
  if (assignment.submission?.missing) {
    return '缺交';
  }
  if (assignment.submission?.late) {
    return '逾期';
  }
  return '未提交';
};

/**
 * 检查作业是否可提交
 * @param assignment 作业对象
 * @returns 是否可提交
 */
const isSubmittable = (assignment: Assignment): boolean => {
  const now = new Date();

  if (assignment.lock_at && new Date(assignment.lock_at) < now) {
    return false;
  }

  if (assignment.unlock_at && new Date(assignment.unlock_at) > now) {
    return false;
  }

  return assignment.submission_types.includes('online_upload');
};

/**
 * AssignmentList 组件
 *
 * 显示选定课程的待提交作业列表，支持选择作业进行提交。
 *
 * @param props - 组件属性
 * @returns React 组件
 */
export function AssignmentList({
  courseId,
  onSelectAssignment,
  apiToken,
}: AssignmentListProps): JSX.Element {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [filter, setFilter] = useState<AssignmentFilter>('all');
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<number | null>(null);
  const [downloadingAttachments, setDownloadingAttachments] = useState<Set<string>>(new Set());
  const [downloadPath, setDownloadPath] = useState<string | null>(null);

  /**
   * 加载课程特定的下载路径
   */
  useEffect(() => {
    const loadDownloadPath = async () => {
      try {
        const savedPath = await window.electronAPI?.getCourseDownloadPath?.(courseId);
        setDownloadPath(savedPath || null);
      } catch (err) {
        console.warn('加载课程下载路径失败:', err);
        setDownloadPath(null);
      }
    };
    loadDownloadPath();
  }, [courseId]);

  /**
   * 获取作业列表
   */
  const fetchAssignments = useCallback(async () => {
    if (!courseId || !apiToken) {
      setError('缺少课程ID或API Token');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 通过主进程代理请求，避免CORS问题
      const result = await window.electronAPI.getAssignmentGroups(apiToken, courseId);

      if (!result.success) {
        throw new Error(result.error || '获取作业列表失败');
      }

      const data = result.data as AssignmentGroup[];

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

      setAssignments(allAssignments);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取作业列表失败');
    } finally {
      setIsLoading(false);
    }
  }, [courseId, apiToken]);

  /**
   * 处理作业选择
   */
  const handleSelectAssignment = useCallback(
    (assignment: Assignment) => {
      if (!isSubmittable(assignment)) {
        return;
      }

      setSelectedAssignmentId(assignment.id);
      onSelectAssignment(assignment);
    },
    [onSelectAssignment]
  );

  /**
   * 处理作业展开/收起
   */
  const handleToggleExpand = useCallback((e: React.MouseEvent, assignmentId: number) => {
    e.stopPropagation();
    setExpandedAssignmentId((prev) => (prev === assignmentId ? null : assignmentId));
  }, []);

  /**
   * 下载附件
   * 支持Canvas文件链接（相对路径），会自动调用API获取带verifier的下载URL
   */
  const downloadAttachment = useCallback(async (attachment: AssignmentAttachment) => {
    setDownloadingAttachments((prev) => new Set(prev).add(attachment.id));
    try {
      // 直接使用原始URL，主进程会处理相对路径和Canvas文件链接
      // 主进程会调用 Canvas API 获取带 verifier 的下载 URL
      // 使用课程下载路径，如果没有设置则使用系统默认路径
      const result = await window.electronAPI?.downloadFile?.(
        attachment.url,
        attachment.name,
        downloadPath || undefined,
        apiToken // 传递 API Token 用于 Canvas 文件认证
      );

      if (result?.success) {
        return true;
      } else {
        console.error(`下载失败: ${attachment.name}`, result?.error);
        return false;
      }
    } catch (err) {
      console.error(`下载失败: ${attachment.name}`, err);
      return false;
    } finally {
      setDownloadingAttachments((prev) => {
        const newSet = new Set(prev);
        newSet.delete(attachment.id);
        return newSet;
      });
    }
  }, [apiToken, downloadPath]);

  // 加载作业列表
  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // 根据筛选条件过滤作业
  const filteredAssignments = useMemo(() => {
    switch (filter) {
      case 'pending':
        return assignments.filter(
          (a) =>
            !a.submission ||
            (a.submission.workflow_state !== 'submitted' &&
              a.submission.workflow_state !== 'graded')
        );
      case 'submitted':
        return assignments.filter(
          (a) =>
            a.submission?.workflow_state === 'submitted' ||
            a.submission?.workflow_state === 'graded'
        );
      case 'graded':
        return assignments.filter(
          (a) =>
            a.submission?.workflow_state === 'graded' &&
            a.submission?.score !== undefined
        );
      case 'all':
      default:
        return assignments;
    }
  }, [assignments, filter]);

  // 加载中状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <span className="ml-3 text-gray-600">加载作业列表...</span>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-red-700">{error}</p>
        <button
          onClick={fetchAssignments}
          className="mt-2 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          重试
        </button>
      </div>
    );
  }

  // 空状态
  if (assignments.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-gray-500">暂无作业</p>
      </div>
    );
  }

  // 筛选按钮配置
  const filterButtons: { key: AssignmentFilter; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待提交' },
    { key: 'submitted', label: '已提交' },
    { key: 'graded', label: '已评分' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">作业列表</h2>
        <span className="text-sm text-gray-500">
          共 {filteredAssignments.length} 个作业
        </span>
      </div>

      {/* 筛选按钮 */}
      <div className="flex flex-wrap gap-2">
        {filterButtons.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {filteredAssignments.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-gray-500">
              {filter === 'all'
                ? '暂无作业'
                : filter === 'pending'
                ? '暂无待提交作业'
                : filter === 'submitted'
                ? '暂无已提交作业'
                : '暂无已评分作业'}
            </p>
          </div>
        ) : (
          filteredAssignments.map((assignment) => {
            const isSelected = selectedAssignmentId === assignment.id;
            const isExpanded = expandedAssignmentId === assignment.id;
            const canSubmit = isSubmittable(assignment);
            const attachments = extractAttachmentsFromHtml(assignment.description);

            return (
              <div
                key={assignment.id}
                className={`
                  overflow-hidden rounded-lg border transition-all
                  ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                      : 'border-gray-200 bg-white'
                  }
                `}
              >
                {/* 作业头部 - 可点击选择 */}
                <div
                  onClick={() => handleSelectAssignment(assignment)}
                  className={`
                    cursor-pointer p-4
                    ${!canSubmit ? 'cursor-not-allowed opacity-60' : ''}
                    ${!isSelected && canSubmit ? 'hover:bg-gray-50' : ''}
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3
                          className={`font-medium text-gray-900 ${
                            isExpanded ? '' : 'truncate'
                          }`}
                          title={assignment.name}
                        >
                          {assignment.name}
                        </h3>
                        {/* 展开/收起按钮 */}
                        {assignment.description && (
                          <button
                            onClick={(e) => handleToggleExpand(e, assignment.id)}
                            className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title={isExpanded ? '收起详情' : '展开详情'}
                          >
                            <svg
                              className={`h-4 w-4 transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* 描述预览（未展开时） */}
                      {!isExpanded && assignment.description && (
                        <div className="mt-1 line-clamp-2 text-sm text-gray-600">
                          <LatexRenderer
                            html={truncateForPreview(assignment.description, 200)}
                          />
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getSubmissionStatusClass(
                            assignment
                          )}`}
                        >
                          {getSubmissionStatusText(assignment)}
                        </span>

                        <span className="text-xs text-gray-500">
                          截止: {formatDate(assignment.due_at)}
                        </span>

                        {assignment.submission_types.length > 0 && (
                          <span
                            className={`max-w-[150px] truncate text-xs text-gray-400 ${
                              isExpanded ? '' : ''
                            }`}
                            title={assignment.submission_types.join(', ')}
                          >
                            提交方式: {assignment.submission_types.join(', ')}
                          </span>
                        )}

                        {/* 附件数量指示器 */}
                        {attachments.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                            <span>📎</span>
                            <span>
                              {attachments.length} 个附件
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500">
                        <svg
                          className="h-4 w-4 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  {!canSubmit && (
                    <div className="mt-2 text-xs text-red-500">
                      {assignment.lock_at && new Date(assignment.lock_at) < new Date()
                        ? '作业已锁定'
                        : assignment.unlock_at &&
                          new Date(assignment.unlock_at) > new Date()
                        ? '作业尚未解锁'
                        : '不支持在线提交'}
                    </div>
                  )}
                </div>

                {/* 展开的内容区域 */}
                {isExpanded && assignment.description && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    {/* 完整描述 */}
                    <div className="prose prose-sm max-w-none text-gray-700">
                      <LatexRenderer html={assignment.description} />
                    </div>

                    {/* 附件列表 */}
                    {attachments.length > 0 && (
                      <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-3">
                        <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-purple-900">
                          <span>📎</span>
                          <span>作业附件 ({attachments.length})</span>
                        </h4>
                        <div className="space-y-2">
                          {attachments.map((attachment) => (
                            <div
                              key={attachment.id}
                              className="flex items-center justify-between rounded-md bg-white px-3 py-2 shadow-sm"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="text-lg">
                                  {getAttachmentIcon(attachment.type)}
                                </span>
                                <span
                                  className="truncate text-sm text-gray-700"
                                  title={attachment.name}
                                >
                                  {attachment.name}
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadAttachment(attachment);
                                }}
                                disabled={downloadingAttachments.has(attachment.id)}
                                className="ml-2 shrink-0 rounded p-1.5 text-purple-600 hover:bg-purple-100 disabled:opacity-50"
                                title="下载附件"
                              >
                                {downloadingAttachments.has(attachment.id) ? (
                                  <svg
                                    className="h-4 w-4 animate-spin"
                                    viewBox="0 0 24 24"
                                  >
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                      fill="none"
                                    />
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                    />
                                  </svg>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default AssignmentList;
