/**
 * 课程列表状态管理 - useReducer 版本
 * @module hooks/useCourseListReducer
 * @description 使用 useReducer + 不可变数据模式，根治排序状态混乱问题
 */

import { useReducer, useCallback, useMemo, useEffect } from 'react';
import type { Course } from '../../shared/types';
import {
  extractUniqueTerms,
  filterCoursesByTerm,
  getLatestTerm,
} from '../utils/termUtils';

// ============================================================================
// 类型定义
// ============================================================================

/** 排序映射类型：courseId -> orderIndex */
export type OrderMapping = ReadonlyMap<number, number>;

/** 学期排序状态：term -> OrderMapping */
export type TermOrderState = ReadonlyMap<string, OrderMapping>;

/** 完整状态接口 */
export interface CourseListState {
  /** 所有课程（原始数据） */
  readonly courses: readonly Course[];
  /** 加载状态 */
  readonly isLoading: boolean;
  /** 错误信息 */
  readonly error: string | null;
  /** 选中的课程ID */
  readonly selectedCourseId: number | null;
  /** 当前选中的学期 */
  readonly selectedTerm: string;
  /** 学期排序状态 */
  readonly termOrderState: TermOrderState;
  /** 是否已初始化（从存储加载完成） */
  readonly isInitialized: boolean;
}

/** Action 类型 */
export type CourseListAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: { courses: Course[]; latestTerm: string | null } }
  | { type: 'FETCH_ERROR'; payload: string }
  | { type: 'SELECT_COURSE'; payload: number }
  | { type: 'SELECT_TERM'; payload: string }
  | { type: 'REORDER_COURSES'; payload: { term: string; courseIds: number[] } }
  | { type: 'LOAD_ORDER_STATE'; payload: TermOrderState }
  | { type: 'RESET' };

// ============================================================================
// 初始状态
// ============================================================================

const initialState: CourseListState = {
  courses: [],
  isLoading: false,
  error: null,
  selectedCourseId: null,
  selectedTerm: 'all',
  termOrderState: new Map(),
  isInitialized: false,
};

// ============================================================================
// Reducer 纯函数
// ============================================================================

/**
 * 创建新的排序映射
 * @param courseIds - 按顺序排列的课程ID数组
 * @returns 不可变的 OrderMapping
 */
function createOrderMapping(courseIds: readonly number[]): OrderMapping {
  const map = new Map<number, number>();
  courseIds.forEach((id, index) => {
    map.set(id, index);
  });
  return map;
}

/**
 * CourseList Reducer
 * 所有状态更新都返回新的不可变对象
 */
export function courseListReducer(
  state: CourseListState,
  action: CourseListAction
): CourseListState {
  switch (action.type) {
    case 'FETCH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'FETCH_SUCCESS': {
      const { courses, latestTerm } = action.payload;
      return {
        ...state,
        courses,
        isLoading: false,
        error: null,
        selectedTerm: latestTerm || state.selectedTerm,
      };
    }

    case 'FETCH_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };

    case 'SELECT_COURSE':
      return {
        ...state,
        selectedCourseId: action.payload,
      };

    case 'SELECT_TERM':
      return {
        ...state,
        selectedTerm: action.payload,
      };

    case 'REORDER_COURSES': {
      const { term, courseIds } = action.payload;
      const newOrderMapping = createOrderMapping(courseIds);

      // 创建新的 termOrderState（不可变更新）
      const newTermOrderState = new Map(state.termOrderState);
      newTermOrderState.set(term, newOrderMapping);

      return {
        ...state,
        termOrderState: newTermOrderState,
      };
    }

    case 'LOAD_ORDER_STATE':
      return {
        ...state,
        termOrderState: action.payload,
        isInitialized: true,
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ============================================================================
// 选择器函数（Selector Pattern）
// ============================================================================

/**
 * 获取可用学期列表
 */
export function selectAvailableTerms(state: CourseListState): string[] {
  return extractUniqueTerms([...state.courses]);
}

/**
 * 获取筛选后的课程
 */
export function selectFilteredCourses(state: CourseListState): Course[] {
  return filterCoursesByTerm([...state.courses], state.selectedTerm);
}

/**
 * 获取排序后的课程
 * 核心修复：使用 Map 结构确保排序稳定性
 */
export function selectSortedCourses(state: CourseListState): Course[] {
  const filtered = selectFilteredCourses(state);
  const orderMapping = state.termOrderState.get(state.selectedTerm);

  if (!orderMapping || orderMapping.size === 0) {
    return filtered;
  }

  return [...filtered].sort((a, b) => {
    const orderA = orderMapping.get(a.id);
    const orderB = orderMapping.get(b.id);

    // 有明确排序值的排在前面
    if (orderA !== undefined && orderB !== undefined) {
      return orderA - orderB;
    }
    if (orderA !== undefined) return -1;
    if (orderB !== undefined) return 1;

    // 都没有排序值，按 ID 排序作为后备
    return a.id - b.id;
  });
}

/**
 * 获取课程统计信息
 */
export function selectCourseStats(state: CourseListState): {
  total: number;
  filtered: number;
  termCount: number;
} {
  return {
    total: state.courses.length,
    filtered: selectFilteredCourses(state).length,
    termCount: selectAvailableTerms(state).length,
  };
}

// ============================================================================
// Hook
// ============================================================================

export interface UseCourseListReducerReturn {
  // 状态
  state: CourseListState;
  // 派生状态
  availableTerms: string[];
  filteredCourses: Course[];
  sortedCourses: Course[];
  stats: { total: number; filtered: number; termCount: number };
  // Action dispatchers
  fetchCourses: (apiToken: string) => Promise<void>;
  selectCourse: (courseId: number) => void;
  selectTerm: (term: string) => void;
  reorderCourses: (courseIds: number[]) => void;
  reset: () => void;
}

/**
 * 课程列表 Reducer Hook
 *
 * 特性：
 * 1. 使用 useReducer 集中管理状态
 * 2. 所有状态不可变
 * 3. 使用 Selector Pattern 优化性能
 * 4. 自动持久化排序状态
 */
export function useCourseListReducer(
  apiToken: string
): UseCourseListReducerReturn {
  const [state, dispatch] = useReducer(courseListReducer, initialState);

  // --------------------------------------------------------------------------
  // 派生状态（使用 useMemo 缓存）
  // --------------------------------------------------------------------------

  const availableTerms = useMemo(
    () => selectAvailableTerms(state),
    [state.courses]
  );

  const filteredCourses = useMemo(
    () => selectFilteredCourses(state),
    [state.courses, state.selectedTerm]
  );

  const sortedCourses = useMemo(
    () => selectSortedCourses(state),
    [state.courses, state.selectedTerm, state.termOrderState]
  );

  const stats = useMemo(
    () => selectCourseStats(state),
    [state.courses, state.selectedTerm]
  );

  // --------------------------------------------------------------------------
  // Action Creators
  // --------------------------------------------------------------------------

  const fetchCourses = useCallback(async (token: string) => {
    dispatch({ type: 'FETCH_START' });

    try {
      const result = await window.electronAPI.getCourses(token);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch courses');
      }

      const courses = (result.data as Course[]).filter(
        (c) => c.workflow_state !== 'deleted'
      );

      const latestTerm = getLatestTerm(courses);

      dispatch({
        type: 'FETCH_SUCCESS',
        payload: { courses, latestTerm },
      });

      // 加载排序状态
      const terms = extractUniqueTerms(courses);
      const termOrderState = new Map<string, OrderMapping>();

      for (const term of terms) {
        const order = await window.electronAPI?.getCourseOrder?.(term);
        if (order?.length) {
          termOrderState.set(term, createOrderMapping(order));
        }
      }

      dispatch({ type: 'LOAD_ORDER_STATE', payload: termOrderState });
    } catch (err) {
      dispatch({
        type: 'FETCH_ERROR',
        payload: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, []);

  const selectCourse = useCallback((courseId: number) => {
    dispatch({ type: 'SELECT_COURSE', payload: courseId });
  }, []);

  const selectTerm = useCallback((term: string) => {
    dispatch({ type: 'SELECT_TERM', payload: term });
  }, []);

  const reorderCourses = useCallback(
    (courseIds: number[]) => {
      // 乐观更新本地状态
      dispatch({
        type: 'REORDER_COURSES',
        payload: { term: state.selectedTerm, courseIds },
      });

      // 异步保存到存储
      window.electronAPI?.setCourseOrder?.(state.selectedTerm, courseIds)
        .catch(console.error);
    },
    [state.selectedTerm]
  );

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // --------------------------------------------------------------------------
  // 初始加载
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (apiToken) {
      fetchCourses(apiToken);
    }
  }, [apiToken, fetchCourses]);

  return {
    state,
    availableTerms,
    filteredCourses,
    sortedCourses,
    stats,
    fetchCourses,
    selectCourse,
    selectTerm,
    reorderCourses,
    reset,
  };
}

export default useCourseListReducer;
