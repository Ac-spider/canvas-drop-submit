import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import type { Course } from '../../shared/types';
import {
  extractUniqueTerms,
  filterCoursesByTerm,
  getLatestTerm,
  getTermDisplayName,
} from '../utils/termUtils';
import { SortableCourseItem } from './SortableCourseItem';
import { parseCourseId } from '../../shared/strict-types';

interface CourseListProps {
  /** Callback when a course is selected */
  onSelectCourse: (courseId: number) => void;
  /** Canvas API token for authentication */
  apiToken: string;
}

/**
 * CourseList Component
 *
 * Displays a list of user's active courses from Canvas LMS.
 * Allows selecting a course to view its assignments.
 * Uses native HTML5 Drag and Drop API for sorting.
 */
export function CourseList({ onSelectCourse, apiToken }: CourseListProps): JSX.Element {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<string>('all');
  const [courseOrder, setCourseOrder] = useState<Record<string, number[]>>({});
  // 使用本地状态管理排序后的课程列表，用于拖拽排序
  const [sortedCourses, setSortedCourses] = useState<Course[]>([]);
  // 当前正在拖拽的课程ID
  const [draggingCourseId, setDraggingCourseId] = useState<number | null>(null);

  // 列表容器的ref
  const listRef = useRef<HTMLDivElement>(null);

  const fetchCourses = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // 通过主进程代理请求，避免CORS问题
      const result = await window.electronAPI.getCourses(apiToken);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch courses');
      }

      const data = result.data as Course[];

      // 过滤掉已删除的课程，但保留其他所有状态的课程
      const filteredData = data.filter((course) => course.workflow_state !== 'deleted');

      setCourses(filteredData);

      // 自动选择最新学期
      const latestTerm = getLatestTerm(filteredData);
      if (latestTerm) {
        setSelectedTerm(latestTerm);
      }

      // 加载所有学期的课程排序
      const terms = extractUniqueTerms(filteredData);
      const orderMap: Record<string, number[]> = {};
      for (const term of terms) {
        const order = await window.electronAPI?.getCourseOrder?.(term);
        console.log('[CourseList] Loading order for term:', term, 'order:', order);
        if (order && order.length > 0) {
          orderMap[term] = order;
        }
      }
      console.log('[CourseList] Final orderMap:', orderMap);
      setCourseOrder(orderMap);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch courses';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [apiToken]);

  useEffect(() => {
    void fetchCourses();
  }, [fetchCourses]);

  // 使用 useMemo 计算可用学期列表和筛选后的课程
  const availableTerms = useMemo(() => extractUniqueTerms(courses), [courses]);

  const filteredCourses = useMemo(() => {
    return filterCoursesByTerm(courses, selectedTerm);
  }, [courses, selectedTerm]);

  // 当筛选条件或课程数据变化时，应用排序
  useEffect(() => {
    // 使用原始学期名称作为键，与保存时保持一致
    const termKey = filteredCourses[0]?.term?.name || selectedTerm;
    console.log('[CourseList] Applying order for termKey:', termKey, 'available keys:', Object.keys(courseOrder));
    const termOrder = courseOrder[termKey];
    console.log('[CourseList] termOrder:', termOrder, 'filteredCourses count:', filteredCourses.length);
    if (!termOrder || termOrder.length === 0) {
      console.log('[CourseList] No order found, using filteredCourses');
      setSortedCourses(filteredCourses);
      return;
    }

    // 根据保存的顺序排序
    // 注意：Canvas API 返回的 course.id 可能是字符串，需要统一转换为数字
    const courseMap = new Map(filteredCourses.map(c => [parseCourseId(String(c.id)), c]));
    const orderedCourses: Course[] = [];
    const remainingCourses = [...filteredCourses];

    console.log('[CourseList] courseMap keys:', Array.from(courseMap.keys()));
    console.log('[CourseList] termOrder:', termOrder);

    // 先按保存的顺序添加
    for (const courseId of termOrder) {
      const course = courseMap.get(courseId);
      console.log('[CourseList] Looking for courseId:', courseId, 'found:', course?.id);
      if (course) {
        orderedCourses.push(course);
        const index = remainingCourses.findIndex(c => parseCourseId(String(c.id)) === courseId);
        if (index !== -1) {
          remainingCourses.splice(index, 1);
        }
      }
    }

    // 添加新加入的课程（不在排序列表中的）
    const finalCourses = [...orderedCourses, ...remainingCourses];
    console.log('[CourseList] Final sorted courses:', finalCourses.map(c => c.id));
    setSortedCourses(finalCourses);
  }, [filteredCourses, courseOrder, selectedTerm]);

  const handleCourseClick = useCallback(
    (courseId: number): void => {
      setSelectedCourseId(courseId);
      onSelectCourse(courseId);
    },
    [onSelectCourse]
  );

  const handleTermChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>): void => {
    setSelectedTerm(event.target.value);
  }, []);

  // 处理拖拽经过容器 - 实时重排 DOM
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const container = listRef.current;
    if (!container) return;

    const draggingElement = container.querySelector('[data-dragging="true"]');
    if (!draggingElement) return;

    const afterElement = getDragAfterElement(container, e.clientY);

    if (afterElement == null) {
      container.appendChild(draggingElement);
    } else {
      container.insertBefore(draggingElement, afterElement);
    }
  }, []);

  // 处理拖拽进入容器
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
  }, []);

  // 处理放置 - 从 DOM 读取最终顺序并同步状态
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();

    const container = listRef.current;
    if (!container) {
      setDraggingCourseId(null);
      return;
    }

    // 从 DOM 读取当前顺序
    const courseElements = container.querySelectorAll('[data-course-id]');
    const newOrder: number[] = [];

    courseElements.forEach((el) => {
      const idStr = (el as HTMLElement).dataset.courseId;
      const parsedId = idStr ? parseCourseId(idStr) : null;
      if (parsedId !== null) {
        newOrder.push(parsedId);
      }
    });

    // 根据新顺序重新排列课程
    // 注意：Canvas API 返回的 course.id 可能是字符串，需要统一转换为数字
    const courseMap = new Map(filteredCourses.map(c => [parseCourseId(String(c.id)), c]));
    const newSortedCourses: Course[] = [];

    for (const courseId of newOrder) {
      const course = courseMap.get(courseId);
      if (course) {
        newSortedCourses.push(course);
      }
    }

    // 如果有课程在新顺序中找不到（理论上不应该发生），追加到末尾
    const remainingCourses = filteredCourses.filter(c => !newOrder.includes(parseCourseId(String(c.id)) || -1));
    newSortedCourses.push(...remainingCourses);

    // 获取当前学期中任意课程的原始学期名称作为存储键
    const originalTermName = filteredCourses[0]?.term?.name || selectedTerm;
    console.log('[CourseList] Saving order for term:', originalTermName, 'order:', newOrder);

    // 更新 React 状态
    setSortedCourses(newSortedCourses);
    setCourseOrder((prev) => ({ ...prev, [originalTermName]: newOrder }));

    // 保存到存储
    window.electronAPI?.setCourseOrder?.(originalTermName, newOrder)
      .then(async () => {
        console.log('[CourseList] Order saved successfully');
        // 验证保存是否成功
        const verify = await window.electronAPI?.getCourseOrder?.(originalTermName);
        console.log('[CourseList] Verification - saved order:', verify);
      })
      .catch((err) => console.error('[CourseList] Failed to save order:', err));

    setDraggingCourseId(null);
  }, [filteredCourses, selectedTerm]);

  // 核心计算函数：根据鼠标的 Y 坐标，计算应该把拖拽的元素放在哪个元素前面
  const getDragAfterElement = (container: HTMLDivElement, y: number): Element | null => {
    // 获取容器内所有未在拖拽状态的课程项
    const draggableElements = [...container.querySelectorAll('[data-course-id]:not([data-dragging="true"])')];

    // 遍历这些元素，找到距离鼠标 Y 坐标最近的那个元素
    return draggableElements.reduce<{ offset: number; element: Element | null }>(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        // 计算鼠标 Y 坐标与该元素中心点的垂直距离
        const offset = y - box.top - box.height / 2;

        // 我们只关心在鼠标下方的元素 (offset < 0)
        // 并且找到距离鼠标最近的那个 (offset > closest.offset)
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      },
      { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
  };

  // 处理拖拽开始（从子组件传递上来）
  const handleDragStart = useCallback((courseId: number): void => {
    setDraggingCourseId(courseId);
  }, []);

  // 处理拖拽结束（从子组件传递上来）
  const handleDragEnd = useCallback((): void => {
    // 拖拽结束时会触发 handleDrop，状态更新在 handleDrop 中处理
    // 这里只处理拖拽取消的情况（没有触发 drop）
    setTimeout(() => {
      setDraggingCourseId((current) => {
        if (current !== null) {
          // 如果拖拽结束后状态仍未清除，说明可能没有触发 drop
          // 重新同步 DOM 顺序与 React 状态
          return null;
        }
        return current;
      });
    }, 0);
  }, []);

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">My Courses</h2>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-lg bg-gray-200"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">My Courses</h2>
        </div>
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          <p className="font-medium">Error loading courses</p>
          <p className="mt-1 text-sm">{error}</p>
          <button
            onClick={() => void fetchCourses()}
            className="mt-3 rounded-md bg-red-100 px-3 py-1 text-sm font-medium text-red-700 transition-colors hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">My Courses</h2>
        </div>
        <div className="rounded-lg bg-gray-50 p-6 text-center">
          <p className="text-gray-600">No active courses found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header with title and term filter */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-gray-800">My Courses</h2>
        <select
          value={selectedTerm}
          onChange={handleTermChange}
          className="w-auto rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">All Terms</option>
          {availableTerms.map((term) => (
            <option key={term} value={term}>
              {getTermDisplayName(term)}
            </option>
          ))}
        </select>
      </div>

      {/* Statistics */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <span>
          {selectedTerm === 'all'
            ? `Total ${courses.length} courses`
            : `${filteredCourses.length} of ${courses.length} courses`}
        </span>
        <span>·</span>
        <span>{availableTerms.length} terms</span>
      </div>

      {/* Course list with drag and drop */}
      <div
        ref={listRef}
        className="space-y-2 relative"
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDrop={handleDrop}
      >
        {sortedCourses.map((course) => (
          <div
            key={course.id}
            data-course-id={String(course.id)}
            data-dragging={draggingCourseId === course.id}
          >
            <SortableCourseItem
              course={course}
              isSelected={selectedCourseId === course.id}
              onClick={() => handleCourseClick(course.id)}
              onDragStart={() => handleDragStart(course.id)}
              onDragEnd={handleDragEnd}
            />
          </div>
        ))}
      </div>

      {/* Empty state when filtering returns no results */}
      {sortedCourses.length === 0 && selectedTerm !== 'all' && (
        <div className="mt-4 rounded-lg bg-gray-50 p-6 text-center">
          <p className="text-gray-600">
            No courses found for this term.
          </p>
        </div>
      )}
    </div>
  );
}
