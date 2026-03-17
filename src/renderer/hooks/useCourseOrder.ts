/**
 * 课程排序状态管理 Hook
 * @module hooks/useCourseOrder
 * @description 提供类型安全的课程排序状态管理，支持持久化存储
 */

import { useCallback, useState, useEffect, useRef } from 'react';

/**
 * 学期排序映射类型
 * 使用 Map 结构确保 O(1) 查找效率
 */
export type TermOrderMap = Map<string, Map<number, number>>;

/**
 * 原始排序数据（用于存储）
 */
export interface RawOrderData {
  [term: string]: number[];
}

/**
 * useCourseOrder 返回类型
 */
export interface UseCourseOrderReturn {
  /** 当前学期的排序映射 */
  termOrderMap: Map<number, number> | undefined;
  /** 完整的排序映射 */
  orderMap: TermOrderMap;
  /** 设置特定学期的排序 */
  setTermOrder: (term: string, courseIds: number[]) => void;
  /** 获取特定学期的排序数组 */
  getTermOrderArray: (term: string) => number[];
  /** 检查是否已加载 */
  isLoaded: boolean;
  /** 重新加载排序数据 */
  reload: () => Promise<void>;
}

// 注意：convertToMap 和 convertToRaw 函数已移除，功能内联到主逻辑中

/**
 * 课程排序状态管理 Hook
 *
 * 特性：
 * 1. 使用 Map 结构实现 O(1) 查找效率
 * 2. 自动持久化到 electron-store
 * 3. 支持乐观更新
 * 4. 类型安全
 *
 * @returns UseCourseOrderReturn
 *
 * @example
 * ```typescript
 * function CourseList() {
 *   const { termOrderMap, setTermOrder, isLoaded } = useCourseOrder();
 *
 *   const sortedCourses = useMemo(() => {
 *     if (!termOrderMap) return courses;
 *     return courses.sort((a, b) => {
 *       const orderA = termOrderMap.get(a.id) ?? Infinity;
 *       const orderB = termOrderMap.get(b.id) ?? Infinity;
 *       return orderA - orderB;
 *     });
 *   }, [courses, termOrderMap]);
 *
 *   return (...);
 * }
 * ```
 */
export function useCourseOrder(): UseCourseOrderReturn {
  // ==========================================================================
  // 状态
  // ==========================================================================

  /** 完整的排序映射 */
  const [orderMap, setOrderMap] = useState<TermOrderMap>(new Map());
  /** 是否已从存储加载 */
  const [isLoaded, setIsLoaded] = useState(false);

  /** 用于追踪当前选中的学期（用于 termOrderMap 计算） */
  const currentTermRef = useRef<string>('all');

  // ==========================================================================
  // 加载数据
  // ==========================================================================

  const loadOrderData = useCallback(async (): Promise<void> => {
    try {
      // 从 electron-store 加载所有学期的排序数据
      // 注意：这里假设有一个 getAllCourseOrders API
      // 如果没有，需要逐个学期加载
      const terms = ['all']; // 这里应该动态获取学期列表

      const newMap = new Map<string, Map<number, number>>();

      for (const term of terms) {
        const order = await window.electronAPI?.getCourseOrder?.(term);
        if (order && order.length > 0) {
          const termMap = new Map<number, number>();
          order.forEach((id, index) => termMap.set(id, index));
          newMap.set(term, termMap);
        }
      }

      setOrderMap(newMap);
      setIsLoaded(true);
    } catch (error) {
      console.error('[useCourseOrder] Failed to load order data:', error);
      setIsLoaded(true); // 即使失败也标记为已加载，避免无限等待
    }
  }, []);

  // 初始加载
  useEffect(() => {
    void loadOrderData();
  }, [loadOrderData]);

  // ==========================================================================
  // 操作方法
  // ==========================================================================

  /**
   * 设置特定学期的课程排序
   * 使用乐观更新策略
   */
  const setTermOrder = useCallback(
    (term: string, courseIds: number[]): void => {
      // 1. 乐观更新本地状态
      setOrderMap((prevMap) => {
        const newMap = new Map(prevMap);
        const termMap = new Map<number, number>();

        courseIds.forEach((id, index) => {
          termMap.set(id, index);
        });

        newMap.set(term, termMap);
        return newMap;
      });

      // 2. 异步保存到存储
      window.electronAPI?.setCourseOrder?.(term, courseIds).catch((error) => {
        console.error('[useCourseOrder] Failed to save order:', error);
        // 可选：回滚本地状态或显示错误
      });
    },
    []
  );

  /**
   * 获取特定学期的排序数组
   */
  const getTermOrderArray = useCallback(
    (term: string): number[] => {
      const termMap = orderMap.get(term);
      if (!termMap) return [];

      const entries = Array.from(termMap.entries());
      entries.sort((a, b) => a[1] - b[1]);
      return entries.map(([id]) => id);
    },
    [orderMap]
  );

  // ==========================================================================
  // 派生状态
  // ==========================================================================

  /** 当前学期的排序映射 */
  const termOrderMap = orderMap.get(currentTermRef.current);

  // ==========================================================================
  // 返回
  // ==========================================================================

  return {
    termOrderMap,
    orderMap,
    setTermOrder,
    getTermOrderArray,
    isLoaded,
    reload: loadOrderData,
  };
}

/**
 * 使用课程排序的 Hook（带学期参数版本）
 * @param term - 当前学期
 * @returns 当前学期的排序信息
 */
export function useTermOrder(term: string): {
  orderMap: Map<number, number> | undefined;
  setOrder: (courseIds: number[]) => void;
  getOrderArray: () => number[];
} {
  const { orderMap, setTermOrder, getTermOrderArray } = useCourseOrder();

  const setOrder = useCallback(
    (courseIds: number[]) => {
      setTermOrder(term, courseIds);
    },
    [term, setTermOrder]
  );

  const getOrderArray = useCallback(() => {
    return getTermOrderArray(term);
  }, [term, getTermOrderArray]);

  return {
    orderMap: orderMap.get(term),
    setOrder,
    getOrderArray,
  };
}

export default useCourseOrder;
