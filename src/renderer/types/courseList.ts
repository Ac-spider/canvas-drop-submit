/**
 * 课程列表类型定义
 * @module renderer/types/courseList
 * @description 课程列表状态管理相关的类型定义
 */

import type { Course } from '../../shared/types';

// ============================================================================
// 排序状态类型
// ============================================================================

/** 排序映射类型：courseId -> orderIndex */
export type OrderMapping = ReadonlyMap<number, number>;

/** 学期排序状态：term -> OrderMapping */
export type TermOrderState = ReadonlyMap<string, OrderMapping>;

// ============================================================================
// 状态接口
// ============================================================================

/** 课程列表完整状态接口 */
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

// ============================================================================
// Action 类型
// ============================================================================

/** 开始获取课程 */
export interface FetchStartAction {
  type: 'FETCH_START';
}

/** 获取课程成功 */
export interface FetchSuccessAction {
  type: 'FETCH_SUCCESS';
  payload: {
    courses: Course[];
    latestTerm: string | null;
  };
}

/** 获取课程失败 */
export interface FetchErrorAction {
  type: 'FETCH_ERROR';
  payload: string;
}

/** 选中课程 */
export interface SelectCourseAction {
  type: 'SELECT_COURSE';
  payload: number;
}

/** 选中学期 */
export interface SelectTermAction {
  type: 'SELECT_TERM';
  payload: string;
}

/** 重新排序课程 */
export interface ReorderCoursesAction {
  type: 'REORDER_COURSES';
  payload: {
    term: string;
    courseIds: number[];
  };
}

/** 加载排序状态 */
export interface LoadOrderStateAction {
  type: 'LOAD_ORDER_STATE';
  payload: TermOrderState;
}

/** 重置状态 */
export interface ResetAction {
  type: 'RESET';
}

/** 所有 Action 类型的联合类型 */
export type CourseListAction =
  | FetchStartAction
  | FetchSuccessAction
  | FetchErrorAction
  | SelectCourseAction
  | SelectTermAction
  | ReorderCoursesAction
  | LoadOrderStateAction
  | ResetAction;

// ============================================================================
// Hook 返回类型
// ============================================================================

/** 课程统计数据 */
export interface CourseStats {
  total: number;
  filtered: number;
  termCount: number;
}

/** useCourseListReducer Hook 返回值 */
export interface UseCourseListReducerReturn {
  /** 完整状态 */
  state: CourseListState;
  /** 可用学期列表 */
  availableTerms: string[];
  /** 筛选后的课程 */
  filteredCourses: Course[];
  /** 排序后的课程 */
  sortedCourses: Course[];
  /** 统计信息 */
  stats: CourseStats;
  /** 获取课程列表 */
  fetchCourses: (apiToken: string) => Promise<void>;
  /** 选中课程 */
  selectCourse: (courseId: number) => void;
  /** 选中学期 */
  selectTerm: (term: string) => void;
  /** 重新排序课程 */
  reorderCourses: (courseIds: number[]) => void;
  /** 重置状态 */
  reset: () => void;
}

// ============================================================================
// 组件 Props 类型
// ============================================================================

/** 课程列表容器组件 Props */
export interface CourseListContainerProps {
  /** API Token */
  apiToken: string;
  /** 选中课程回调 */
  onSelectCourse: (course: Course | null) => void;
}

/** 可排序课程项组件 Props */
export interface SortableCourseItemProps {
  /** 课程数据 */
  course: Course;
  /** 是否选中 */
  isSelected: boolean;
  /** 点击回调 */
  onClick: () => void;
  /** 拖拽开始回调 */
  onDragStart?: () => void;
  /** 拖拽结束回调 */
  onDragEnd?: () => void;
}

// ============================================================================
// 拖拽相关类型
// ============================================================================

/** 拖拽结果 */
export interface DropResult {
  /** 拖拽源索引 */
  source: {
    index: number;
    droppableId: string;
  };
  /** 拖拽目标索引 */
  destination?: {
    index: number;
    droppableId: string;
  };
}

/** 拖拽提供的数据 */
export interface DraggableProvided {
  draggableProps: {
    style?: React.CSSProperties;
    'data-rfd-drag-handle-draggable-id'?: string;
    'data-rfd-draggable-context-id'?: string;
  };
  dragHandleProps: {
    role: string;
    tabIndex: number;
    'aria-describedby': string;
    'data-rfd-drag-handle-context-id': string;
    'data-rfd-drag-handle-id': string;
    draggable: boolean;
    onDragStart: React.DragEventHandler;
  } | null;
  innerRef: (element: HTMLElement | null) => void;
}

/** 拖拽状态快照 */
export interface DraggableStateSnapshot {
  isDragging: boolean;
  isDropAnimating: boolean;
  dropAnimation?: {
    duration: number;
    curve: string;
    moveTo: {
      x: number;
      y: number;
    };
  };
}

/** 可放置区域提供的数据 */
export interface DroppableProvided {
  droppableProps: {
    'data-rfd-droppable-context-id': string;
    'data-rfd-droppable-id': string;
  };
  innerRef: (element: HTMLElement | null) => void;
  placeholder?: React.ReactElement | null;
}

/** 可放置区域状态快照 */
export interface DroppableStateSnapshot {
  isDraggingOver: boolean;
  draggingOverWith?: string;
  draggingFromThisWith?: string;
}
