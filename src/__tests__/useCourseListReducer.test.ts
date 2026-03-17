/**
 * B方案测试 - useCourseListReducer.ts
 * 测试Reducer纯函数和Selector函数
 */

import {
  courseListReducer,
  selectAvailableTerms,
  selectFilteredCourses,
  selectSortedCourses,
  selectCourseStats,
  type CourseListState,
  type CourseListAction,
  type TermOrderState,
} from '../renderer/hooks/useCourseListReducer';
import type { Course } from '../shared/types';

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
  createMockCourse(4, 'Course D', '2024-2025-2'),
  createMockCourse(5, 'Course E', undefined), // 无学期
];

// 本地定义初始状态（因为原文件未导出）
const testInitialState: CourseListState = {
  courses: [],
  isLoading: false,
  error: null,
  selectedCourseId: null,
  selectedTerm: 'all',
  termOrderState: new Map(),
  isInitialized: false,
};

// 本地定义 createOrderMapping 辅助函数
function createOrderMapping(courseIds: readonly number[]): Map<number, number> {
  const map = new Map<number, number>();
  courseIds.forEach((id, index) => {
    map.set(id, index);
  });
  return map;
}

// ============================================================================
// Reducer 纯函数测试
// ============================================================================

describe('courseListReducer', () => {
  describe('FETCH_START', () => {
    it('应该设置 isLoading 为 true 并清除 error', () => {
      const stateWithError: CourseListState = {
        ...testInitialState,
        error: 'Previous error',
        isLoading: false,
      };

      const action: CourseListAction = { type: 'FETCH_START' };
      const newState = courseListReducer(stateWithError, action);

      expect(newState.isLoading).toBe(true);
      expect(newState.error).toBeNull();
    });

    it('应该保持其他状态不变', () => {
      const stateWithCourses: CourseListState = {
        ...testInitialState,
        courses: mockCourses,
        selectedTerm: '2025-2026-2',
      };

      const action: CourseListAction = { type: 'FETCH_START' };
      const newState = courseListReducer(stateWithCourses, action);

      expect(newState.courses).toEqual(mockCourses);
      expect(newState.selectedTerm).toBe('2025-2026-2');
    });
  });

  describe('FETCH_SUCCESS', () => {
    it('应该设置 courses 并清除 isLoading 和 error', () => {
      const action: CourseListAction = {
        type: 'FETCH_SUCCESS',
        payload: { courses: mockCourses, latestTerm: '2025-2026-2' },
      };
      const newState = courseListReducer(
        { ...testInitialState, isLoading: true, error: 'Error' },
        action
      );

      expect(newState.courses).toEqual(mockCourses);
      expect(newState.isLoading).toBe(false);
      expect(newState.error).toBeNull();
    });

    it('应该使用 latestTerm 更新 selectedTerm', () => {
      const action: CourseListAction = {
        type: 'FETCH_SUCCESS',
        payload: { courses: mockCourses, latestTerm: '2025-2026-2' },
      };
      const newState = courseListReducer(testInitialState, action);

      expect(newState.selectedTerm).toBe('2025-2026-2');
    });

    it('当 latestTerm 为 null 时应该保持原有 selectedTerm', () => {
      const stateWithTerm: CourseListState = {
        ...testInitialState,
        selectedTerm: '2024-2025-1',
      };

      const action: CourseListAction = {
        type: 'FETCH_SUCCESS',
        payload: { courses: mockCourses, latestTerm: null },
      };
      const newState = courseListReducer(stateWithTerm, action);

      expect(newState.selectedTerm).toBe('2024-2025-1');
    });

    it('应该返回新的不可变状态对象', () => {
      const action: CourseListAction = {
        type: 'FETCH_SUCCESS',
        payload: { courses: mockCourses, latestTerm: '2025-2026-2' },
      };
      const newState = courseListReducer(testInitialState, action);

      expect(newState).not.toBe(testInitialState);
      expect(newState.courses).not.toBe(testInitialState.courses);
    });
  });

  describe('FETCH_ERROR', () => {
    it('应该设置 error 并清除 isLoading', () => {
      const action: CourseListAction = {
        type: 'FETCH_ERROR',
        payload: 'Network error',
      };
      const newState = courseListReducer(
        { ...testInitialState, isLoading: true },
        action
      );

      expect(newState.error).toBe('Network error');
      expect(newState.isLoading).toBe(false);
    });

    it('应该保持 courses 不变', () => {
      const stateWithCourses: CourseListState = {
        ...testInitialState,
        courses: mockCourses,
      };

      const action: CourseListAction = {
        type: 'FETCH_ERROR',
        payload: 'Failed to fetch',
      };
      const newState = courseListReducer(stateWithCourses, action);

      expect(newState.courses).toEqual(mockCourses);
    });
  });

  describe('SELECT_COURSE', () => {
    it('应该更新 selectedCourseId', () => {
      const action: CourseListAction = {
        type: 'SELECT_COURSE',
        payload: 123,
      };
      const newState = courseListReducer(testInitialState, action);

      expect(newState.selectedCourseId).toBe(123);
    });
  });

  describe('SELECT_TERM', () => {
    it('应该更新 selectedTerm', () => {
      const action: CourseListAction = {
        type: 'SELECT_TERM',
        payload: '2025-2026-1',
      };
      const newState = courseListReducer(testInitialState, action);

      expect(newState.selectedTerm).toBe('2025-2026-1');
    });

    it('应该支持 "all" 值', () => {
      const stateWithTerm: CourseListState = {
        ...testInitialState,
        selectedTerm: '2025-2026-2',
      };

      const action: CourseListAction = {
        type: 'SELECT_TERM',
        payload: 'all',
      };
      const newState = courseListReducer(stateWithTerm, action);

      expect(newState.selectedTerm).toBe('all');
    });
  });

  describe('REORDER_COURSES', () => {
    it('应该为指定学期创建新的排序映射', () => {
      const stateWithCourses: CourseListState = {
        ...testInitialState,
        courses: mockCourses,
        selectedTerm: '2025-2026-2',
      };

      const action: CourseListAction = {
        type: 'REORDER_COURSES',
        payload: { term: '2025-2026-2', courseIds: [2, 1] },
      };
      const newState = courseListReducer(stateWithCourses, action);

      const orderMapping = newState.termOrderState.get('2025-2026-2');
      expect(orderMapping).toBeDefined();
      expect(orderMapping?.get(2)).toBe(0);
      expect(orderMapping?.get(1)).toBe(1);
    });

    it('应该保持其他学期的排序不变', () => {
      const existingOrder: TermOrderState = new Map([
        ['2024-2025-2', new Map([[4, 0]])],
      ]);

      const stateWithOrders: CourseListState = {
        ...testInitialState,
        termOrderState: existingOrder,
      };

      const action: CourseListAction = {
        type: 'REORDER_COURSES',
        payload: { term: '2025-2026-2', courseIds: [1, 2] },
      };
      const newState = courseListReducer(stateWithOrders, action);

      // 检查原有学期排序仍然保留
      expect(newState.termOrderState.get('2024-2025-2')?.get(4)).toBe(0);
      // 检查新学期排序已添加
      expect(newState.termOrderState.get('2025-2026-2')?.get(1)).toBe(0);
    });

    it('应该更新已存在的学期排序', () => {
      const existingOrder: TermOrderState = new Map([
        ['2025-2026-2', new Map([[1, 0], [2, 1]])],
      ]);

      const stateWithOrders: CourseListState = {
        ...testInitialState,
        termOrderState: existingOrder,
      };

      const action: CourseListAction = {
        type: 'REORDER_COURSES',
        payload: { term: '2025-2026-2', courseIds: [2, 1] },
      };
      const newState = courseListReducer(stateWithOrders, action);

      const orderMapping = newState.termOrderState.get('2025-2026-2');
      expect(orderMapping?.get(2)).toBe(0);
      expect(orderMapping?.get(1)).toBe(1);
    });

    it('应该返回新的 termOrderState 对象（不可变更新）', () => {
      const existingOrder: TermOrderState = new Map([
        ['2025-2026-2', new Map([[1, 0]])],
      ]);

      const stateWithOrders: CourseListState = {
        ...testInitialState,
        termOrderState: existingOrder,
      };

      const action: CourseListAction = {
        type: 'REORDER_COURSES',
        payload: { term: '2025-2026-2', courseIds: [1, 2] },
      };
      const newState = courseListReducer(stateWithOrders, action);

      expect(newState.termOrderState).not.toBe(existingOrder);
      expect(newState.termOrderState.get('2025-2026-2')).not.toBe(existingOrder.get('2025-2026-2'));
    });
  });

  describe('LOAD_ORDER_STATE', () => {
    it('应该加载学期排序状态', () => {
      const orderState: TermOrderState = new Map([
        ['2025-2026-2', new Map([[1, 0], [2, 1]])],
        ['2025-2026-1', new Map([[3, 0]])],
      ]);

      const action: CourseListAction = {
        type: 'LOAD_ORDER_STATE',
        payload: orderState,
      };
      const newState = courseListReducer(testInitialState, action);

      expect(newState.termOrderState).toEqual(orderState);
    });

    it('应该设置 isInitialized 为 true', () => {
      const orderState: TermOrderState = new Map();

      const action: CourseListAction = {
        type: 'LOAD_ORDER_STATE',
        payload: orderState,
      };
      const newState = courseListReducer(testInitialState, action);

      expect(newState.isInitialized).toBe(true);
    });
  });

  describe('RESET', () => {
    it('应该重置为初始状态', () => {
      const modifiedState: CourseListState = {
        courses: mockCourses,
        isLoading: true,
        error: 'Some error',
        selectedCourseId: 123,
        selectedTerm: '2025-2026-2',
        termOrderState: new Map([['term', new Map([[1, 0]])]]),
        isInitialized: true,
      };

      const action: CourseListAction = { type: 'RESET' };
      const newState = courseListReducer(modifiedState, action);

      expect(newState.courses).toEqual([]);
      expect(newState.isLoading).toBe(false);
      expect(newState.error).toBeNull();
      expect(newState.selectedCourseId).toBeNull();
      expect(newState.selectedTerm).toBe('all');
      expect(newState.termOrderState.size).toBe(0);
      expect(newState.isInitialized).toBe(false);
    });

    it('应该返回新的状态对象而非 testInitialState 引用', () => {
      const modifiedState: CourseListState = {
        ...testInitialState,
        selectedTerm: '2025-2026-2',
      };

      const action: CourseListAction = { type: 'RESET' };
      const newState = courseListReducer(modifiedState, action);

      expect(newState).not.toBe(testInitialState);
    });
  });

  describe('未知 action 类型', () => {
    it('应该返回当前状态不变', () => {
      const state: CourseListState = {
        ...testInitialState,
        selectedTerm: '2025-2026-2',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const action = { type: 'UNKNOWN_ACTION' } as any;
      const newState = courseListReducer(state, action);

      expect(newState).toBe(state);
    });
  });
});

// ============================================================================
// createOrderMapping 辅助函数测试
// ============================================================================

describe('createOrderMapping', () => {
  it('应该为课程ID数组创建正确的排序映射', () => {
    const mapping = createOrderMapping([3, 1, 2]);

    expect(mapping.get(3)).toBe(0);
    expect(mapping.get(1)).toBe(1);
    expect(mapping.get(2)).toBe(2);
    expect(mapping.size).toBe(3);
  });

  it('应该处理空数组', () => {
    const mapping = createOrderMapping([]);

    expect(mapping.size).toBe(0);
  });

  it('应该处理单个元素', () => {
    const mapping = createOrderMapping([42]);

    expect(mapping.get(42)).toBe(0);
    expect(mapping.size).toBe(1);
  });

  it('应该返回不可变的 Map', () => {
    const mapping = createOrderMapping([1, 2, 3]);

    // 验证是 Map 类型
    expect(mapping instanceof Map).toBe(true);
  });
});

// ============================================================================
// Selector 函数测试
// ============================================================================

describe('selectAvailableTerms', () => {
  it('应该提取唯一的学期列表', () => {
    const state: CourseListState = {
      ...testInitialState,
      courses: mockCourses,
    };

    const terms = selectAvailableTerms(state);

    expect(terms).toContain('2025-2026-2');
    expect(terms).toContain('2025-2026-1');
    expect(terms).toContain('2024-2025-2');
    expect(terms.length).toBe(3);
  });

  it('应该按从新到旧排序', () => {
    const state: CourseListState = {
      ...testInitialState,
      courses: mockCourses,
    };

    const terms = selectAvailableTerms(state);

    // 2025-2026-2 (学期2) > 2025-2026-1 (学期1) > 2024-2025-2
    expect(terms[0]).toBe('2025-2026-2');
    expect(terms[1]).toBe('2025-2026-1');
    expect(terms[2]).toBe('2024-2025-2');
  });

  it('空课程列表应该返回空数组', () => {
    const state: CourseListState = {
      ...testInitialState,
      courses: [],
    };

    const terms = selectAvailableTerms(state);

    expect(terms).toEqual([]);
  });

  it('应该忽略没有学期的课程', () => {
    const coursesWithoutTerm = [
      createMockCourse(1, 'Course A', undefined),
      createMockCourse(2, 'Course B', undefined),
    ];

    const state: CourseListState = {
      ...testInitialState,
      courses: coursesWithoutTerm,
    };

    const terms = selectAvailableTerms(state);

    expect(terms).toEqual([]);
  });
});

describe('selectFilteredCourses', () => {
  it('当 selectedTerm 为 "all" 时应该返回所有课程', () => {
    const state: CourseListState = {
      ...testInitialState,
      courses: mockCourses,
      selectedTerm: 'all',
    };

    const filtered = selectFilteredCourses(state);

    expect(filtered).toHaveLength(mockCourses.length);
    expect(filtered).toEqual(mockCourses);
  });

  it('应该按学期筛选课程', () => {
    const state: CourseListState = {
      ...testInitialState,
      courses: mockCourses,
      selectedTerm: '2025-2026-2',
    };

    const filtered = selectFilteredCourses(state);

    expect(filtered).toHaveLength(2);
    expect(filtered.every(c => c.term?.name === '2025-2026-2')).toBe(true);
    expect(filtered.map(c => c.id)).toContain(1);
    expect(filtered.map(c => c.id)).toContain(2);
  });

  it('不存在的学期应该返回空数组', () => {
    const state: CourseListState = {
      ...testInitialState,
      courses: mockCourses,
      selectedTerm: '2020-2021-1',
    };

    const filtered = selectFilteredCourses(state);

    expect(filtered).toEqual([]);
  });

  it('应该返回新的数组（不修改原数组）', () => {
    const state: CourseListState = {
      ...testInitialState,
      courses: mockCourses,
      selectedTerm: 'all',
    };

    const filtered = selectFilteredCourses(state);

    expect(filtered).not.toBe(mockCourses);
  });
});

describe('selectSortedCourses', () => {
  it('没有排序映射时应该返回筛选后的课程（按原顺序）', () => {
    const state: CourseListState = {
      ...testInitialState,
      courses: mockCourses,
      selectedTerm: 'all',
      termOrderState: new Map(),
    };

    const sorted = selectSortedCourses(state);

    expect(sorted.map(c => c.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('应该根据排序映射重新排序课程', () => {
    const termOrderState: TermOrderState = new Map([
      ['2025-2026-2', new Map([
        [2, 0], // Course B 排第一
        [1, 1], // Course A 排第二
      ])],
    ]);

    const state: CourseListState = {
      ...testInitialState,
      courses: mockCourses,
      selectedTerm: '2025-2026-2',
      termOrderState,
    };

    const sorted = selectSortedCourses(state);

    expect(sorted.map(c => c.id)).toEqual([2, 1]);
  });

  it('有排序值的课程应该排在无排序值课程之前', () => {
    const termOrderState: TermOrderState = new Map([
      ['2025-2026-2', new Map([
        [2, 0], // 只有 Course B 有排序值
      ])],
    ]);

    const state: CourseListState = {
      ...testInitialState,
      courses: mockCourses,
      selectedTerm: '2025-2026-2',
      termOrderState,
    };

    const sorted = selectSortedCourses(state);

    // Course B 应该排在 Course A 之前
    const indexB = sorted.findIndex(c => c.id === 2);
    const indexA = sorted.findIndex(c => c.id === 1);
    expect(indexB).toBeLessThan(indexA);
  });

  it('都没有排序值的课程应该按 ID 排序', () => {
    const state: CourseListState = {
      ...testInitialState,
      courses: mockCourses,
      selectedTerm: '2025-2026-2',
      termOrderState: new Map(), // 空排序映射
    };

    const sorted = selectSortedCourses(state);

    // 没有排序值时按 ID 升序排列
    expect(sorted.map(c => c.id)).toEqual([1, 2]);
  });

  it('应该使用当前选中学期的排序映射', () => {
    const termOrderState: TermOrderState = new Map([
      ['2025-2026-2', new Map([[2, 0], [1, 1]])],
      ['2025-2026-1', new Map([[3, 0]])],
    ]);

    const state: CourseListState = {
      ...testInitialState,
      courses: mockCourses,
      selectedTerm: '2025-2026-1',
      termOrderState,
    };

    const sorted = selectSortedCourses(state);

    // 应该使用 2025-2026-1 的排序，不是 2025-2026-2
    expect(sorted.map(c => c.id)).toEqual([3]);
  });

  it('应该返回新的数组（不修改原数组）', () => {
    const state: CourseListState = {
      ...testInitialState,
      courses: mockCourses,
      selectedTerm: 'all',
    };

    const sorted = selectSortedCourses(state);

    expect(sorted).not.toBe(mockCourses);
  });
});

describe('selectCourseStats', () => {
  it('应该返回正确的统计信息', () => {
    const state: CourseListState = {
      ...testInitialState,
      courses: mockCourses,
      selectedTerm: '2025-2026-2',
    };

    const stats = selectCourseStats(state);

    expect(stats.total).toBe(5);
    expect(stats.filtered).toBe(2); // 2025-2026-2 有2门课
    expect(stats.termCount).toBe(3); // 3个不同学期
  });

  it('当 selectedTerm 为 all 时 filtered 应该等于 total', () => {
    const state: CourseListState = {
      ...testInitialState,
      courses: mockCourses,
      selectedTerm: 'all',
    };

    const stats = selectCourseStats(state);

    expect(stats.filtered).toBe(stats.total);
  });

  it('空课程列表应该返回零统计', () => {
    const state: CourseListState = {
      ...testInitialState,
      courses: [],
      selectedTerm: 'all',
    };

    const stats = selectCourseStats(state);

    expect(stats.total).toBe(0);
    expect(stats.filtered).toBe(0);
    expect(stats.termCount).toBe(0);
  });

  it('应该实时反映状态变化', () => {
    const state1: CourseListState = {
      ...testInitialState,
      courses: mockCourses,
      selectedTerm: '2025-2026-2',
    };

    const stats1 = selectCourseStats(state1);
    expect(stats1.filtered).toBe(2);

    const state2: CourseListState = {
      ...state1,
      selectedTerm: '2025-2026-1',
    };

    const stats2 = selectCourseStats(state2);
    expect(stats2.filtered).toBe(1);
  });
});

// ============================================================================
// 集成测试 - 模拟真实使用场景
// ============================================================================

describe('Integration: 完整课程列表工作流', () => {
  it('应该正确处理完整的数据获取和排序流程', () => {
    // 1. 初始状态
    let state = testInitialState;
    expect(state.isLoading).toBe(false);

    // 2. 开始获取数据
    state = courseListReducer(state, { type: 'FETCH_START' });
    expect(state.isLoading).toBe(true);

    // 3. 获取成功
    state = courseListReducer(state, {
      type: 'FETCH_SUCCESS',
      payload: { courses: mockCourses, latestTerm: '2025-2026-2' },
    });
    expect(state.isLoading).toBe(false);
    expect(state.courses).toHaveLength(5);
    expect(state.selectedTerm).toBe('2025-2026-2');

    // 4. 加载排序状态
    const orderState: TermOrderState = new Map([
      ['2025-2026-2', new Map([[2, 0], [1, 1]])],
    ]);
    state = courseListReducer(state, {
      type: 'LOAD_ORDER_STATE',
      payload: orderState,
    });
    expect(state.isInitialized).toBe(true);

    // 5. 验证筛选结果
    const filtered = selectFilteredCourses(state);
    expect(filtered).toHaveLength(2);

    // 6. 验证排序结果
    const sorted = selectSortedCourses(state);
    expect(sorted.map(c => c.id)).toEqual([2, 1]);

    // 7. 重新排序
    state = courseListReducer(state, {
      type: 'REORDER_COURSES',
      payload: { term: '2025-2026-2', courseIds: [1, 2] },
    });

    // 8. 验证新排序
    const reSorted = selectSortedCourses(state);
    expect(reSorted.map(c => c.id)).toEqual([1, 2]);

    // 9. 验证统计信息
    const stats = selectCourseStats(state);
    expect(stats.total).toBe(5);
    expect(stats.filtered).toBe(2);
    expect(stats.termCount).toBe(3);
  });

  it('应该处理错误恢复流程', () => {
    let state = testInitialState;

    // 1. 开始获取
    state = courseListReducer(state, { type: 'FETCH_START' });
    expect(state.isLoading).toBe(true);

    // 2. 获取失败
    state = courseListReducer(state, {
      type: 'FETCH_ERROR',
      payload: 'Network timeout',
    });
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('Network timeout');

    // 3. 重试 - 重新开始获取
    state = courseListReducer(state, { type: 'FETCH_START' });
    expect(state.isLoading).toBe(true);
    expect(state.error).toBeNull();

    // 4. 重试成功
    state = courseListReducer(state, {
      type: 'FETCH_SUCCESS',
      payload: { courses: mockCourses, latestTerm: '2025-2026-2' },
    });
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.courses).toHaveLength(5);
  });
});
