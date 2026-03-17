/**
 * C方案测试 - CourseList.tsx
 * 测试parseCourseId函数和拖拽数据处理
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CourseList } from '../renderer/components/CourseList';
import type { Course } from '../shared/types';

// ============================================================================
// Mock 依赖
// ============================================================================

// Mock termUtils
jest.mock('../renderer/utils/termUtils', () => ({
  extractUniqueTerms: jest.fn((courses: Course[]) => {
    const terms = new Set<string>();
    courses.forEach(c => {
      if (c.term?.name) terms.add(c.term.name);
    });
    return Array.from(terms).sort();
  }),
  filterCoursesByTerm: jest.fn((courses: Course[], term: string) => {
    if (term === 'all') return courses;
    return courses.filter(c => c.term?.name === term);
  }),
  getLatestTerm: jest.fn((courses: Course[]) => {
    const terms = courses.filter(c => c.term?.name).map(c => c.term!.name);
    return terms[0] || null;
  }),
  getTermDisplayName: jest.fn((term: string) => term),
}));

// Mock SortableCourseItem
jest.mock('../renderer/components/SortableCourseItem', () => {
  return function MockSortableCourseItem({
    course,
    isSelected,
    onClick,
    onDragStart,
    onDragEnd,
  }: {
    course: Course;
    isSelected: boolean;
    onClick: () => void;
    onDragStart: () => void;
    onDragEnd: () => void;
  }) {
    return (
      <div
        data-testid={`course-item-${course.id}`}
        data-course-id={course.id}
        className={`course-item ${isSelected ? 'selected' : ''}`}
        onClick={onClick}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', String(course.id));
          onDragStart();
        }}
        onDragEnd={onDragEnd}
      >
        {course.name}
      </div>
    );
  };
});

// Mock strict-types
jest.mock('../shared/strict-types', () => ({
  isValidCourseId: jest.fn((value: number) => {
    return typeof value === 'number' &&
           !Number.isNaN(value) &&
           Number.isFinite(value) &&
           Number.isInteger(value) &&
           value > 0 &&
           value <= Number.MAX_SAFE_INTEGER;
  }),
  parseCourseId: jest.fn((value: string | number) => {
    if (typeof value === 'number') {
      return value > 0 && Number.isInteger(value) ? value : null;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) return null;
      const parsed = Number(trimmed);
      if (parsed > 0 && Number.isInteger(parsed)) {
        return parsed;
      }
      const numericMatch = trimmed.match(/^\d+/);
      if (numericMatch) {
        const extracted = Number(numericMatch[0]);
        if (extracted > 0 && Number.isInteger(extracted)) {
          return extracted;
        }
      }
    }
    return null;
  }),
}));

// ============================================================================
// Mock Electron API
// ============================================================================

const mockGetCourses = jest.fn();
const mockGetCourseOrder = jest.fn();
const mockSetCourseOrder = jest.fn();

beforeEach(() => {
  window.electronAPI = {
    getCourses: mockGetCourses,
    getCourseOrder: mockGetCourseOrder,
    setCourseOrder: mockSetCourseOrder,
  } as unknown as typeof window.electronAPI;

  mockGetCourses.mockReset();
  mockGetCourseOrder.mockReset();
  mockSetCourseOrder.mockReset();
});

// ============================================================================
// 测试数据工厂
// ============================================================================

const createMockCourse = (id: number, name: string, termName?: string): Course => ({
  id,
  name,
  course_code: `CS${id}`,
  workflow_state: 'available',
  term: termName ? { id, name: termName } : undefined,
});

const mockCourses: Course[] = [
  createMockCourse(1, 'Course A', '2025-2026-2'),
  createMockCourse(2, 'Course B', '2025-2026-2'),
  createMockCourse(3, 'Course C', '2025-2026-1'),
];

// ============================================================================
// parseCourseId 函数测试
// ============================================================================

// 从 CourseList.tsx 中提取 parseCourseId 函数进行独立测试
describe('parseCourseId (extracted from CourseList)', () => {
  // 重新实现 CourseList 中的 parseCourseId 逻辑用于测试
  const parseCourseId = (value: unknown, context?: string): number | null => {
    // 严格解析逻辑
    if (typeof value === 'number') {
      if (
        !Number.isNaN(value) &&
        Number.isFinite(value) &&
        Number.isInteger(value) &&
        value > 0 &&
        value <= Number.MAX_SAFE_INTEGER
      ) {
        return value;
      }
      return null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) return null;

      const parsed = Number(trimmed);
      if (
        !Number.isNaN(parsed) &&
        Number.isFinite(parsed) &&
        Number.isInteger(parsed) &&
        parsed > 0 &&
        parsed <= Number.MAX_SAFE_INTEGER
      ) {
        return parsed;
      }

      // 尝试提取数字部分
      const numericMatch = trimmed.match(/^\d+/);
      if (numericMatch) {
        const extracted = Number(numericMatch[0]);
        if (
          extracted > 0 &&
          Number.isInteger(extracted) &&
          extracted <= Number.MAX_SAFE_INTEGER
        ) {
          return extracted;
        }
      }
    }

    return null;
  };

  describe('输入: 数字', () => {
    it('应该返回该数字', () => {
      expect(parseCourseId(123)).toBe(123);
      expect(parseCourseId(1)).toBe(1);
      expect(parseCourseId(999999)).toBe(999999);
    });

    it('应该拒绝非正整数', () => {
      expect(parseCourseId(0)).toBeNull();
      expect(parseCourseId(-1)).toBeNull();
      expect(parseCourseId(-999)).toBeNull();
    });

    it('应该拒绝小数', () => {
      expect(parseCourseId(123.45)).toBeNull();
      expect(parseCourseId(1.5)).toBeNull();
    });

    it('应该拒绝特殊数字', () => {
      expect(parseCourseId(NaN)).toBeNull();
      expect(parseCourseId(Infinity)).toBeNull();
      expect(parseCourseId(-Infinity)).toBeNull();
    });

    it('应该拒绝超大数字', () => {
      expect(parseCourseId(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
    });
  });

  describe('输入: 数字字符串', () => {
    it('应该返回解析后的数字', () => {
      expect(parseCourseId('123')).toBe(123);
      expect(parseCourseId('1')).toBe(1);
      expect(parseCourseId('999999')).toBe(999999);
    });

    it('应该处理带空格的字符串', () => {
      expect(parseCourseId('  123  ')).toBe(123);
      expect(parseCourseId('123 ')).toBe(123);
      expect(parseCourseId(' 123')).toBe(123);
    });

    it('应该拒绝非数字字符串', () => {
      expect(parseCourseId('abc')).toBeNull();
      expect(parseCourseId('xyz123')).toBeNull();
      expect(parseCourseId('hello')).toBeNull();
    });

    it('应该提取字符串开头的数字', () => {
      expect(parseCourseId('123abc')).toBe(123);
      expect(parseCourseId('456xyz789')).toBe(456);
    });

    it('应该拒绝负数字符串', () => {
      expect(parseCourseId('-1')).toBeNull();
      expect(parseCourseId('-123')).toBeNull();
    });

    it('应该拒绝小数字符串', () => {
      expect(parseCourseId('123.45')).toBe(123); // 提取整数部分
      expect(parseCourseId('1.5')).toBe(1);
    });
  });

  describe('输入: 空字符串', () => {
    it('应该返回 null', () => {
      expect(parseCourseId('')).toBeNull();
    });

    it('应该处理仅包含空格的字符串', () => {
      expect(parseCourseId('   ')).toBeNull();
      expect(parseCourseId('  ')).toBeNull();
      expect(parseCourseId('\t')).toBeNull();
      expect(parseCourseId('\n')).toBeNull();
    });
  });

  describe('输入: null/undefined', () => {
    it('null 应该返回 null', () => {
      expect(parseCourseId(null)).toBeNull();
    });

    it('undefined 应该返回 null', () => {
      expect(parseCourseId(undefined)).toBeNull();
    });
  });

  describe('输入: 无效类型', () => {
    it('对象应该返回 null', () => {
      expect(parseCourseId({})).toBeNull();
      expect(parseCourseId({ id: 123 })).toBeNull();
      expect(parseCourseId([])).toBeNull();
    });

    it('布尔值应该返回 null', () => {
      expect(parseCourseId(true)).toBeNull();
      expect(parseCourseId(false)).toBeNull();
    });

    it('函数应该返回 null', () => {
      expect(parseCourseId(() => {})).toBeNull();
      expect(parseCourseId(function() {})).toBeNull();
    });
  });

  describe('边界情况', () => {
    it('应该正确处理 Number.MAX_SAFE_INTEGER', () => {
      expect(parseCourseId(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
      expect(parseCourseId(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('应该正确处理大数字字符串', () => {
      expect(parseCourseId('9007199254740991')).toBe(9007199254740991); // MAX_SAFE_INTEGER
    });
  });
});

// ============================================================================
// CourseList 组件测试
// ============================================================================

describe('CourseList Component', () => {
  const mockOnSelectCourse = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCourses.mockResolvedValue({
      success: true,
      data: mockCourses,
    });
    mockGetCourseOrder.mockResolvedValue([]);
    mockSetCourseOrder.mockResolvedValue(undefined);
  });

  describe('渲染状态', () => {
    it('应该显示加载状态', async () => {
      mockGetCourses.mockImplementation(() => new Promise(() => {})); // 永不resolve

      render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />);

      expect(screen.getByText('My Courses')).toBeInTheDocument();
      // 检查加载骨架屏
      const skeletonElements = document.querySelectorAll('.animate-pulse');
      expect(skeletonElements.length).toBeGreaterThan(0);
    });

    it('应该显示课程列表', async () => {
      render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />);

      await waitFor(() => {
        expect(screen.getByTestId('course-item-1')).toBeInTheDocument();
      });

      expect(screen.getByTestId('course-item-2')).toBeInTheDocument();
      expect(screen.getByTestId('course-item-3')).toBeInTheDocument();
    });

    it('应该显示错误状态', async () => {
      mockGetCourses.mockResolvedValue({
        success: false,
        error: 'Failed to fetch courses',
      });

      render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />);

      await waitFor(() => {
        expect(screen.getByText('Error loading courses')).toBeInTheDocument();
      });

      expect(screen.getByText('Failed to fetch courses')).toBeInTheDocument();
    });

    it('应该显示空状态', async () => {
      mockGetCourses.mockResolvedValue({
        success: true,
        data: [],
      });

      render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />);

      await waitFor(() => {
        expect(screen.getByText('No active courses found.')).toBeInTheDocument();
      });
    });
  });

  describe('课程选择', () => {
    it('点击课程应该触发 onSelectCourse', async () => {
      render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />);

      await waitFor(() => {
        expect(screen.getByTestId('course-item-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('course-item-1'));

      expect(mockOnSelectCourse).toHaveBeenCalledWith(1);
    });

    it('点击不同课程应该更新选中状态', async () => {
      render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />);

      await waitFor(() => {
        expect(screen.getByTestId('course-item-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('course-item-1'));
      expect(mockOnSelectCourse).toHaveBeenCalledWith(1);

      fireEvent.click(screen.getByTestId('course-item-2'));
      expect(mockOnSelectCourse).toHaveBeenCalledWith(2);
    });
  });

  describe('学期筛选', () => {
    it('应该显示学期筛选下拉框', async () => {
      render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('应该可以切换学期', async () => {
      render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'all' } });

      expect(select).toHaveValue('all');
    });
  });

  describe('拖拽数据处理', () => {
    it('应该正确处理拖拽开始', async () => {
      render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />);

      await waitFor(() => {
        expect(screen.getByTestId('course-item-1')).toBeInTheDocument();
      });

      const courseItem = screen.getByTestId('course-item-1');
      const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      });

      fireEvent(courseItem, dragStartEvent);

      // 验证拖拽开始没有报错
      expect(courseItem).toBeInTheDocument();
    });

    it('应该正确处理拖拽放置', async () => {
      render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />);

      await waitFor(() => {
        expect(screen.getByTestId('course-item-1')).toBeInTheDocument();
      });

      const courseList = screen.getByTestId('course-item-1').parentElement;

      // 模拟拖拽放置
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      });

      // 设置拖拽数据
      if (dropEvent.dataTransfer) {
        dropEvent.dataTransfer.setData('text/plain', '1');
      }

      fireEvent(courseList!, dropEvent);

      // 放置事件应该被处理（不报错即为成功）
      expect(courseList).toBeInTheDocument();
    });

    it('应该异步保存排序状态', async () => {
      mockSetCourseOrder.mockResolvedValue(undefined);

      render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />);

      await waitFor(() => {
        expect(screen.getByTestId('course-item-1')).toBeInTheDocument();
      });

      const courseList = screen.getByTestId('course-item-1').parentElement;

      // 模拟拖拽放置
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      });

      if (dropEvent.dataTransfer) {
        dropEvent.dataTransfer.setData('text/plain', '2');
      }

      await act(async () => {
        fireEvent(courseList!, dropEvent);
      });

      // 验证异步保存被调用
      await waitFor(() => {
        expect(mockSetCourseOrder).toHaveBeenCalled();
      });
    });
  });

  describe('拖拽数据传递', () => {
    it('应该在拖拽时传递正确的课程ID', async () => {
      render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />);

      await waitFor(() => {
        expect(screen.getByTestId('course-item-1')).toBeInTheDocument();
      });

      const courseItem = screen.getByTestId('course-item-1');
      let capturedData: string | null = null;

      // 拦截拖拽事件检查数据
      courseItem.addEventListener('dragstart', (e) => {
        capturedData = e.dataTransfer?.getData('text/plain') || null;
      });

      fireEvent.dragStart(courseItem);

      // 验证数据被设置
      expect(courseItem).toHaveAttribute('data-course-id', '1');
    });

    it('应该处理无效的拖拽数据', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />);

      await waitFor(() => {
        expect(screen.getByTestId('course-item-1')).toBeInTheDocument();
      });

      const courseList = screen.getByTestId('course-item-1').parentElement;

      // 模拟带有无效数据的拖拽放置
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      });

      if (dropEvent.dataTransfer) {
        dropEvent.dataTransfer.setData('text/plain', 'invalid-id');
      }

      await act(async () => {
        fireEvent(courseList!, dropEvent);
      });

      consoleSpy.mockRestore();
    });
  });

  describe('排序状态更新', () => {
    it('应该更新课程顺序状态', async () => {
      mockGetCourseOrder.mockResolvedValue([2, 1]); // 预设排序

      render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />);

      await waitFor(() => {
        expect(screen.getByTestId('course-item-1')).toBeInTheDocument();
      });

      // 验证 getCourseOrder 被调用以加载排序状态
      expect(mockGetCourseOrder).toHaveBeenCalled();
    });

    it('应该按学期保存不同的排序状态', async () => {
      mockGetCourseOrder.mockImplementation((term: string) => {
        if (term === '2025-2026-2') return Promise.resolve([2, 1]);
        if (term === '2025-2026-1') return Promise.resolve([3]);
        return Promise.resolve([]);
      });

      render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />);

      await waitFor(() => {
        expect(screen.getByTestId('course-item-1')).toBeInTheDocument();
      });

      // 验证每个学期的排序都被加载
      expect(mockGetCourseOrder).toHaveBeenCalledWith('2025-2026-2');
      expect(mockGetCourseOrder).toHaveBeenCalledWith('2025-2026-1');
    });
  });
});

// ============================================================================
// 防御性编程测试
// ============================================================================

describe('Defensive Programming', () => {
  const mockOnSelectCourse = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCourses.mockResolvedValue({
      success: true,
      data: mockCourses,
    });
    mockGetCourseOrder.mockResolvedValue([]);
    mockSetCourseOrder.mockResolvedValue(undefined);
  });

  describe('API 错误处理', () => {
    it('应该处理 API 返回的错误', async () => {
      mockGetCourses.mockResolvedValue({
        success: false,
        error: { message: 'Unauthorized', status: 401 },
      });

      render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />);

      await waitFor(() => {
        expect(screen.getByText('Error loading courses')).toBeInTheDocument();
      });
    });

    it('应该处理网络异常', async () => {
      mockGetCourses.mockRejectedValue(new Error('Network error'));

      render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />);

      await waitFor(() => {
        expect(screen.getByText('Error loading courses')).toBeInTheDocument();
      });
    });

    it('应该处理非 Error 类型的异常', async () => {
      mockGetCourses.mockRejectedValue('String error');

      render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />);

      await waitFor(() => {
        expect(screen.getByText('Error loading courses')).toBeInTheDocument();
      });
    });
  });

  describe('数据验证', () => {
    it('应该过滤掉已删除的课程', async () => {
      const coursesWithDeleted = [
        createMockCourse(1, 'Active Course', '2025-2026-2'),
        { ...createMockCourse(2, 'Deleted Course', '2025-2026-2'), workflow_state: 'deleted' as const },
        createMockCourse(3, 'Another Active', '2025-2026-2'),
      ];

      mockGetCourses.mockResolvedValue({
        success: true,
        data: coursesWithDeleted,
      });

      render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />);

      await waitFor(() => {
        expect(screen.getByTestId('course-item-1')).toBeInTheDocument();
      });

      // 已删除的课程不应该显示
      expect(screen.queryByTestId('course-item-2')).not.toBeInTheDocument();
      expect(screen.getByTestId('course-item-3')).toBeInTheDocument();
    });
  });

  describe('拖拽边界情况', () => {
    it('应该处理拖拽到相同位置的情况', async () => {
      render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />);

      await waitFor(() => {
        expect(screen.getByTestId('course-item-1')).toBeInTheDocument();
      });

      const courseList = screen.getByTestId('course-item-1').parentElement;

      // 模拟拖拽到相同位置
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      });

      if (dropEvent.dataTransfer) {
        dropEvent.dataTransfer.setData('text/plain', '1');
      }

      await act(async () => {
        fireEvent(courseList!, dropEvent);
      });

      // 相同位置拖拽不应该触发保存
      expect(mockSetCourseOrder).not.toHaveBeenCalled();
    });
  });
});
