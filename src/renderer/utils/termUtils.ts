/**
 * Canvas Drop Submit - 学期工具函数
 * @module utils/termUtils
 * @description 提供学期名称解析、标准化和筛选功能
 */

import type { Course } from '../../shared/types';

/**
 * 解析学期名称，提取学年信息
 * 支持格式："2025-2026 Spring"、"2025-2026-2"、"2025 Spring" 等
 *
 * @param termName - 学期名称
 * @returns 解析结果，包含学年信息和学期编号
 */
export function parseTermName(termName: string): {
  startYear: number;
  endYear: number;
  semester: number;
  isValid: boolean;
} {
  const trimmed = termName.trim();

  // 匹配 "2025-2026-2" 或 "2025-2026-1" 格式
  const hyphenFormat = trimmed.match(/^(\d{4})-(\d{4})-(\d)$/);
  if (hyphenFormat) {
    const startYear = parseInt(hyphenFormat[1], 10);
    const endYear = parseInt(hyphenFormat[2], 10);
    const semester = parseInt(hyphenFormat[3], 10);
    return {
      startYear,
      endYear,
      semester,
      isValid: startYear < endYear && semester >= 1 && semester <= 3,
    };
  }

  // 匹配 "2025-2026 Spring"、"2025-2026 Fall" 等格式
  const seasonFormat = trimmed.match(/^(\d{4})-(\d{4})\s+(Spring|Fall|Summer|Autumn|Winter)$/i);
  if (seasonFormat) {
    const startYear = parseInt(seasonFormat[1], 10);
    const endYear = parseInt(seasonFormat[2], 10);
    const season = seasonFormat[3].toLowerCase();
    const semesterMap: Record<string, number> = {
      fall: 1,
      autumn: 1,
      winter: 2,
      spring: 2,
      summer: 3,
    };
    const semester = semesterMap[season] || 1;
    return {
      startYear,
      endYear,
      semester,
      isValid: startYear < endYear,
    };
  }

  // 匹配 "2025 Spring"、"2025 Fall" 等单年格式
  const singleYearFormat = trimmed.match(/^(\d{4})\s+(Spring|Fall|Summer|Autumn|Winter)$/i);
  if (singleYearFormat) {
    const year = parseInt(singleYearFormat[1], 10);
    const season = singleYearFormat[2].toLowerCase();
    const semesterMap: Record<string, number> = {
      fall: 1,
      autumn: 1,
      winter: 2,
      spring: 2,
      summer: 3,
    };
    const semester = semesterMap[season] || 1;
    // 根据学期推断学年
    const startYear = season === 'fall' || season === 'autumn' ? year : year - 1;
    const endYear = startYear + 1;
    return {
      startYear,
      endYear,
      semester,
      isValid: true,
    };
  }

  // 无法识别的格式
  return {
    startYear: 0,
    endYear: 0,
    semester: 0,
    isValid: false,
  };
}

/**
 * 标准化学期名称为 "YYYY-YYYY-N" 格式
 *
 * @param termName - 原始学期名称
 * @returns 标准化的学期名称，如果无法解析则返回原始名称
 */
export function standardizeTermName(termName: string): string {
  const parsed = parseTermName(termName);
  if (!parsed.isValid) {
    return termName;
  }
  return `${parsed.startYear}-${parsed.endYear}-${parsed.semester}`;
}

/**
 * 获取学期用于排序的数值（越大表示越新）
 *
 * @param termName - 学期名称
 * @returns 排序权重值
 */
export function getTermSortWeight(termName: string): number {
  const parsed = parseTermName(termName);
  if (!parsed.isValid) {
    return 0;
  }
  // 使用学年 * 10 + 学期作为权重，确保 2025-2026-2 > 2025-2026-1
  return parsed.startYear * 10 + parsed.semester;
}

/**
 * 比较两个学期的新旧程度
 *
 * @param termA - 学期A名称
 * @param termB - 学期B名称
 * @returns 负数表示A比B旧，正数表示A比B新，0表示相同
 */
export function compareTerms(termA: string, termB: string): number {
  const weightA = getTermSortWeight(termA);
  const weightB = getTermSortWeight(termB);
  return weightA - weightB;
}

/**
 * 从课程列表中提取唯一的学期列表
 *
 * @param courses - 课程列表
 * @returns 唯一的学期名称列表（按从新到旧排序）
 */
export function extractUniqueTerms(courses: Course[]): string[] {
  const termSet = new Set<string>();

  courses.forEach((course) => {
    if (course.term?.name) {
      termSet.add(course.term.name);
    }
  });

  // 转换为数组并按从新到旧排序
  return Array.from(termSet).sort((a, b) => compareTerms(b, a));
}

/**
 * 按学期筛选课程
 *
 * @param courses - 课程列表
 * @param termName - 学期名称（如果为 'all' 则返回所有课程）
 * @returns 筛选后的课程列表
 */
export function filterCoursesByTerm(courses: Course[], termName: string): Course[] {
  if (termName === 'all') {
    return courses;
  }

  return courses.filter((course) => course.term?.name === termName);
}

/**
 * 获取课程所属的学期名称
 *
 * @param course - 课程对象
 * @returns 学期名称，如果没有则返回 'Unknown'
 */
export function getCourseTermName(course: Course): string {
  return course.term?.name || 'Unknown';
}

/**
 * 从课程列表中找出最新的学期
 *
 * @param courses - 课程列表
 * @returns 最新的学期名称，如果没有则返回 null
 */
export function getLatestTerm(courses: Course[]): string | null {
  const terms = extractUniqueTerms(courses);
  return terms.length > 0 ? terms[0] : null;
}

/**
 * 获取学期的显示名称
 *
 * @param termName - 学期名称
 * @returns 标准化学期名称，格式为 YYYY-YYYY-N
 */
export function getTermDisplayName(termName: string): string {
  // 直接返回标准化学期名称，不添加中文说明
  return standardizeTermName(termName);
}

/**
 * 检查学期是否为当前学期（基于当前日期）
 * 注意：这是一个启发式判断，基于学年通常从9月开始
 *
 * @param termName - 学期名称
 * @returns 是否为当前学期
 */
export function isCurrentTerm(termName: string): boolean {
  const parsed = parseTermName(termName);
  if (!parsed.isValid) {
    return false;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // 推断当前应该是哪个学期
  // 9-12月: 秋季学期 (1)
  // 1-5月: 春季学期 (2)
  // 6-8月: 夏季学期 (3)
  let currentSemester: number;
  let academicYearStart: number;

  if (currentMonth >= 9) {
    currentSemester = 1;
    academicYearStart = currentYear;
  } else if (currentMonth <= 5) {
    currentSemester = 2;
    academicYearStart = currentYear - 1;
  } else {
    currentSemester = 3;
    academicYearStart = currentYear - 1;
  }

  return (
    parsed.startYear === academicYearStart && parsed.semester === currentSemester
  );
}
