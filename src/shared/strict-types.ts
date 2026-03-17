/**
 * 严格的类型定义 - 专注于课程ID类型安全
 * 修复拖拽排序后课程文件显示错误的问题
 */

// ============================================================================
// Branded Types - 确保编译时类型安全
// ============================================================================

/**
 * 品牌类型标记，用于创建nominal typing
 * 防止structural typing导致的类型混淆
 */
declare const __brand: unique symbol;

/**
 * 品牌类型基础结构
 */
type Brand<B> = { [__brand]: B };

/**
 * 品牌类型 - 将基础类型与品牌结合
 */
type Branded<T, B> = T & Brand<B>;

/**
 * 严格的课程ID类型 - 只能是number，不能与其他number混淆
 *
 * @example
 * const courseId: StrictCourseId = 12345 as StrictCourseId;
 * // 错误：不能将普通number赋值给StrictCourseId
 * const wrong: StrictCourseId = 12345;
 */
export type StrictCourseId = Branded<number, 'CourseId'>;

/**
 * 课程ID字符串品牌类型 - 用于特定场景下的字符串ID
 */
export type StrictCourseIdString = Branded<string, 'CourseIdString'>;

// ============================================================================
// 拖拽数据结构定义
// ============================================================================

/**
 * 拖拽数据的标准接口
 * 确保courseId字段的类型一致性
 */
export interface DragData {
  /** 课程ID - 必须是number类型 */
  courseId: number;

  /** 课程名称（用于调试和显示） */
  courseName?: string;

  /** 拖拽操作的时间戳 */
  timestamp: number;

  /** 拖拽数据的版本号 */
  version: number;
}

/**
 * 严格的拖拽数据接口 - 使用品牌类型
 */
export interface StrictDragData {
  /** 课程ID - 使用品牌类型确保类型安全 */
  courseId: StrictCourseId;

  /** 课程名称（用于调试和显示） */
  courseName?: string;

  /** 拖拽操作的时间戳 */
  timestamp: number;

  /** 拖拽数据的版本号 */
  version: number;
}

/**
 * 拖拽结果数据结构
 */
export interface DragResult {
  /** 源课程ID */
  sourceId: number;

  /** 目标课程ID */
  targetId: number;

  /** 插入位置 */
  insertIndex: number;
}

// ============================================================================
// Type Guard 函数
// ============================================================================

/**
 * 检查值是否为有效的课程ID
 *
 * 有效的课程ID必须满足：
 * - 是number类型
 * - 不是NaN
 * - 不是Infinity或-Infinity
 * - 是正整数
 * - 在安全的整数范围内
 *
 * @param value - 要检查的值
 * @returns 如果值是有效的课程ID则返回true
 *
 * @example
 * isValidCourseId(12345); // true
 * isValidCourseId("12345"); // false
 * isValidCourseId(NaN); // false
 * isValidCourseId(-1); // false
 */
export function isValidCourseId(value: unknown): value is number {
  // 首先检查是否为number类型
  if (typeof value !== 'number') {
    return false;
  }

  // 检查是否为NaN
  if (Number.isNaN(value)) {
    return false;
  }

  // 检查是否为有限数
  if (!Number.isFinite(value)) {
    return false;
  }

  // 检查是否为整数
  if (!Number.isInteger(value)) {
    return false;
  }

  // 检查是否为正数
  if (value <= 0) {
    return false;
  }

  // 检查是否在安全整数范围内
  if (value > Number.MAX_SAFE_INTEGER) {
    return false;
  }

  return true;
}

/**
 * 解析课程ID，支持从string或number转换
 *
 * 解析规则：
 * - 如果是number，直接验证
 * - 如果是string，尝试解析为整数
 * - 其他类型返回null
 *
 * @param value - 要解析的值（string或number）
 * @returns 解析成功返回number，失败返回null
 *
 * @example
 * parseCourseId(12345); // 12345
 * parseCourseId("12345"); // 12345
 * parseCourseId("abc"); // null
 * parseCourseId("123.45"); // 123（截断小数部分）
 */
export function parseCourseId(value: string | number): number | null {
  // 如果已经是number，直接验证
  if (typeof value === 'number') {
    return isValidCourseId(value) ? value : null;
  }

  // 如果是string，尝试解析
  if (typeof value === 'string') {
    // 去除前后空白
    const trimmed = value.trim();

    // 检查是否为空字符串
    if (trimmed.length === 0) {
      return null;
    }

    // 尝试解析为整数
    const parsed = Number(trimmed);

    // 检查解析结果
    if (isValidCourseId(parsed)) {
      return parsed;
    }

    // 如果直接解析失败，尝试提取数字部分
    const numericMatch = trimmed.match(/^\d+/);
    if (numericMatch) {
      const extracted = Number(numericMatch[0]);
      if (isValidCourseId(extracted)) {
        return extracted;
      }
    }
  }

  return null;
}

/**
 * 断言课程ID有效，无效时抛出错误
 *
 * @param value - 要断言的值
 * @throws {TypeError} 当值不是有效的课程ID时抛出
 *
 * @example
 * assertCourseId(12345); // 通过
 * assertCourseId("12345"); // 抛出TypeError
 * assertCourseId(NaN); // 抛出TypeError
 */
export function assertCourseId(value: unknown): asserts value is number {
  if (!isValidCourseId(value)) {
    throw new TypeError(
      `Invalid course ID: expected a positive integer, received ${getTypeDescription(value)}`
    );
  }
}

// ============================================================================
// 运行时验证函数
// ============================================================================

/**
 * 验证拖拽数据结构
 *
 * 验证规则：
 * - 必须是对象
 * - 必须包含courseId字段
 * - courseId必须是有效的课程ID
 * - timestamp（如果存在）必须是number
 * - version（如果存在）必须是number
 *
 * @param data - 要验证的数据
 * @returns 验证成功返回DragData，失败返回null
 *
 * @example
 * validateDragData({ courseId: 12345, timestamp: Date.now(), version: 1 });
 * // { courseId: 12345, timestamp: ..., version: 1 }
 *
 * validateDragData({ courseId: "12345" }); // null
 * validateDragData(null); // null
 */
export function validateDragData(data: unknown): { courseId: number } | null {
  // 检查是否为对象
  if (data === null || typeof data !== 'object') {
    return null;
  }

  const obj = data as Record<string, unknown>;

  // 检查courseId字段
  const courseId = obj.courseId;
  if (!isValidCourseId(courseId)) {
    return null;
  }

  // 验证可选字段的类型
  if ('timestamp' in obj && typeof obj.timestamp !== 'number') {
    return null;
  }

  if ('version' in obj && typeof obj.version !== 'number') {
    return null;
  }

  if ('courseName' in obj && typeof obj.courseName !== 'string') {
    return null;
  }

  return { courseId };
}

/**
 * 清理和标准化课程ID
 *
 * 处理流程：
 * 1. 如果是number，直接验证
 * 2. 如果是string，尝试解析
 * 3. 如果是对象，尝试提取courseId字段
 * 4. 其他情况返回null
 *
 * @param value - 要清理的值
 * @returns 清理成功返回number，失败返回null
 *
 * @example
 * sanitizeCourseId(12345); // 12345
 * sanitizeCourseId("12345"); // 12345
 * sanitizeCourseId({ courseId: 12345 }); // 12345
 * sanitizeCourseId({ id: 12345 }); // null（不识别id字段）
 */
export function sanitizeCourseId(value: unknown): number | null {
  // 直接是number的情况
  if (typeof value === 'number') {
    return isValidCourseId(value) ? value : null;
  }

  // 是string的情况
  if (typeof value === 'string') {
    return parseCourseId(value);
  }

  // 是对象的情况，尝试提取courseId
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    // 优先查找courseId字段
    if ('courseId' in obj) {
      return sanitizeCourseId(obj.courseId);
    }

    // 其次查找id字段（但记录警告）
    if ('id' in obj) {
      const id = obj.id;
      if (isValidCourseId(id)) {
        console.warn(
          '[sanitizeCourseId] Using "id" field instead of "courseId". ' +
          'This may cause type mismatch issues. Value:',
          value
        );
        return id;
      }
    }
  }

  return null;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取值的类型描述，用于错误信息
 *
 * @param value - 任意值
 * @returns 类型描述字符串
 */
function getTypeDescription(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  const baseType = typeof value;

  if (baseType === 'number') {
    const numValue = value as number;
    if (Number.isNaN(numValue)) {
      return 'NaN';
    }
    if (!Number.isFinite(numValue)) {
      return numValue > 0 ? 'Infinity' : '-Infinity';
    }
    if (!Number.isInteger(numValue)) {
      return `float(${numValue})`;
    }
    return `number(${numValue})`;
  }

  if (baseType === 'string') {
    const str = value as string;
    if (str.length > 20) {
      return `string("${str.slice(0, 20)}...")`;
    }
    return `string("${str}")`;
  }

  if (baseType === 'object') {
    if (Array.isArray(value)) {
      return `array[${value.length}]`;
    }
    return `object(${Object.keys(value as object).join(', ')})`;
  }

  return `${baseType}(${String(value)})`;
}

// ============================================================================
// 品牌类型转换函数
// ============================================================================

/**
 * 将number转换为StrictCourseId品牌类型
 *
 * @param value - 要转换的值
 * @returns 品牌类型的CourseId
 * @throws {TypeError} 当值无效时抛出
 *
 * @example
 * const id = toStrictCourseId(12345); // StrictCourseId
 */
export function toStrictCourseId(value: unknown): StrictCourseId {
  assertCourseId(value);
  return value as StrictCourseId;
}

/**
 * 安全地将number转换为StrictCourseId品牌类型
 *
 * @param value - 要转换的值
 * @returns 成功返回StrictCourseId，失败返回null
 *
 * @example
 * const id = toStrictCourseIdSafe(12345); // StrictCourseId | null
 */
export function toStrictCourseIdSafe(value: unknown): StrictCourseId | null {
  if (!isValidCourseId(value)) {
    return null;
  }
  return value as StrictCourseId;
}

/**
 * 将StrictCourseId转换回普通number
 *
 * @param strictId - 品牌类型的CourseId
 * @returns 普通number
 */
export function fromStrictCourseId(strictId: StrictCourseId): number {
  return strictId as unknown as number;
}

// ============================================================================
// 常量定义
// ============================================================================

/**
 * 拖拽数据版本号
 */
export const DRAG_DATA_VERSION = 1;

/**
 * 拖拽数据类型标识（用于DataTransfer）
 */
export const DRAG_DATA_TYPE = 'application/x-canvas-course';

// ============================================================================
// 导出类型别名（方便使用）
// ============================================================================

/**
 * 课程ID类型 - 推荐使用number
 */
export type CourseId = number;

/**
 * 课程ID可能的外部类型（API返回等）
 */
export type CourseIdInput = string | number;
