/**
 * Course ID 类型安全边界测试
 * @module __tests__/courseId-boundary
 * @description 测试课程ID在拖拽排序等场景下的类型安全问题
 *
 * 背景：存在一个Bug，拖拽排序后"高阶学术英语"课程的文件一栏显示为其他课程。
 * 诊断发现可能是课程ID类型不匹配（string vs number）导致。
 */

import type { Course } from '../shared/types';
import { isCourse } from '../shared/types';

// ============================================================================
// 测试辅助函数
// ============================================================================

/**
 * 创建模拟课程对象
 */
function createMockCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 89231,
    name: '高阶学术英语',
    course_code: 'ENGL2001',
    teachers: [],
    enrollments: [],
    term: { id: 1, name: '2025-2026-2' },
    ...overrides,
  } as Course;
}

/**
 * 模拟拖拽数据传递 - 使用 dataTransfer.setData/getData
 */
class MockDataTransfer {
  private data: Map<string, string> = new Map();

  setData(format: string, data: string): void {
    this.data.set(format, data);
  }

  getData(format: string): string {
    return this.data.get(format) ?? '';
  }

  clearData(): void {
    this.data.clear();
  }
}

// ============================================================================
// 类型守卫和验证函数（待测试）
// ============================================================================

/**
 * 安全地将课程ID转换为number类型
 * @param value - 可能是string或number的课程ID
 * @returns number类型的课程ID
 * @throws 当无法转换为有效数字时抛出错误
 */
function parseCourseId(value: unknown): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid course ID: ${String(value)}`);
    }
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      throw new Error('Course ID cannot be empty string');
    }
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      throw new Error(`Cannot parse course ID: "${value}"`);
    }
    if (parsed < 0) {
      throw new Error(`Course ID cannot be negative: ${parsed}`);
    }
    return parsed;
  }

  throw new Error(`Unsupported course ID type: ${typeof value}`);
}

/**
 * 类型守卫：检查值是否为有效的课程ID
 */
function isValidCourseId(value: unknown): value is number {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return false;
    const parsed = Number(trimmed);
    return !Number.isNaN(parsed) && Number.isFinite(parsed) && parsed >= 0;
  }
  return false;
}

/**
 * 断言函数：确保值为有效的课程ID
 */
function assertValidCourseId(value: unknown): asserts value is number {
  if (!isValidCourseId(value)) {
    throw new Error(`Assertion failed: "${String(value)}" is not a valid course ID`);
  }
}

/**
 * 安全比较两个课程ID（处理string和number类型）
 */
function compareCourseId(a: unknown, b: unknown): boolean {
  try {
    const parsedA = parseCourseId(a);
    const parsedB = parseCourseId(b);
    return parsedA === parsedB;
  } catch {
    return false;
  }
}

/**
 * 模拟拖拽排序后的课程顺序处理
 */
function processCourseOrder(
  sortedCourses: Course[],
  draggedId: unknown,
  newIndex: number
): { success: boolean; newOrder: number[]; error?: string } {
  try {
    // 验证并转换draggedId
    const courseId = parseCourseId(draggedId);

    // 查找课程索引
    const oldIndex = sortedCourses.findIndex(c => c.id === courseId);

    if (oldIndex === -1) {
      return {
        success: false,
        newOrder: [],
        error: `Course with ID ${courseId} not found`,
      };
    }

    if (oldIndex === newIndex) {
      return {
        success: true,
        newOrder: sortedCourses.map(c => c.id),
      };
    }

    // 重新排序
    const newSortedCourses = [...sortedCourses];
    const [removed] = newSortedCourses.splice(oldIndex, 1);
    const adjustedIndex = oldIndex < newIndex ? newIndex - 1 : newIndex;
    newSortedCourses.splice(adjustedIndex, 0, removed);

    return {
      success: true,
      newOrder: newSortedCourses.map(c => c.id),
    };
  } catch (error) {
    return {
      success: false,
      newOrder: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// 测试套件
// ============================================================================

describe('课程ID类型边界测试', () => {
  // ==========================================================================
  // 1. 课程ID类型边界测试
  // ==========================================================================

  describe('课程ID类型转换测试', () => {
    describe('字符串类型转换', () => {
      it('应该正确转换字符串"89231"为数字89231', () => {
        const result = parseCourseId('89231');
        expect(result).toBe(89231);
        expect(typeof result).toBe('number');
      });

      it('应该正确处理带空格的字符串" 89231 "', () => {
        const result = parseCourseId(' 89231 ');
        expect(result).toBe(89231);
      });

      it('应该正确处理字符串"0"', () => {
        const result = parseCourseId('0');
        expect(result).toBe(0);
      });

      it('应该正确转换非常大的数字字符串', () => {
        const largeId = String(Number.MAX_SAFE_INTEGER);
        const result = parseCourseId(largeId);
        expect(result).toBe(Number.MAX_SAFE_INTEGER);
      });
    });

    describe('数字类型通过验证', () => {
      it('应该正确通过数字89231', () => {
        const result = parseCourseId(89231);
        expect(result).toBe(89231);
      });

      it('应该正确处理数字0', () => {
        const result = parseCourseId(0);
        expect(result).toBe(0);
      });

      it('应该正确处理Number.MAX_SAFE_INTEGER', () => {
        const result = parseCourseId(Number.MAX_SAFE_INTEGER);
        expect(result).toBe(Number.MAX_SAFE_INTEGER);
      });

      it('应该正确处理Number.MIN_SAFE_INTEGER以上的正数', () => {
        const result = parseCourseId(1);
        expect(result).toBe(1);
      });
    });

    describe('无效值处理', () => {
      it('应该对null抛出错误', () => {
        expect(() => parseCourseId(null)).toThrow('Unsupported course ID type: object');
      });

      it('应该对undefined抛出错误', () => {
        expect(() => parseCourseId(undefined)).toThrow('Unsupported course ID type: undefined');
      });

      it('应该对空字符串抛出错误', () => {
        expect(() => parseCourseId('')).toThrow('Course ID cannot be empty string');
      });

      it('应该对纯空格字符串抛出错误', () => {
        expect(() => parseCourseId('   ')).toThrow('Course ID cannot be empty string');
      });

      it('应该对非数字字符串抛出错误', () => {
        expect(() => parseCourseId('abc')).toThrow('Cannot parse course ID: "abc"');
      });

      it('应该对混合字符串抛出错误', () => {
        expect(() => parseCourseId('89231abc')).toThrow('Cannot parse course ID: "89231abc"');
      });

      it('应该对对象抛出错误', () => {
        expect(() => parseCourseId({ id: 89231 })).toThrow('Unsupported course ID type: object');
      });

      it('应该对数组抛出错误', () => {
        expect(() => parseCourseId([89231])).toThrow('Unsupported course ID type: object');
      });

      it('应该对布尔值抛出错误', () => {
        expect(() => parseCourseId(true)).toThrow('Unsupported course ID type: boolean');
      });

      it('应该对Symbol抛出错误', () => {
        expect(() => parseCourseId(Symbol('89231'))).toThrow('Unsupported course ID type: symbol');
      });

      it('应该对BigInt抛出错误（如果超出安全范围）', () => {
        const bigInt = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1);
        expect(() => parseCourseId(bigInt)).toThrow('Unsupported course ID type: bigint');
      });
    });

    describe('边界值测试', () => {
      it('应该正确处理0', () => {
        expect(parseCourseId(0)).toBe(0);
        expect(parseCourseId('0')).toBe(0);
      });

      it('应该对-1抛出错误', () => {
        // 数字类型的负数在number分支处理，抛出Invalid course ID
        expect(() => parseCourseId(-1)).toThrow('Invalid course ID: -1');
      });

      it('应该对负数字符串抛出错误', () => {
        expect(() => parseCourseId('-1')).toThrow('Course ID cannot be negative: -1');
      });

      it('应该正确处理Number.MAX_SAFE_INTEGER', () => {
        const max = Number.MAX_SAFE_INTEGER; // 9007199254740991
        expect(parseCourseId(max)).toBe(max);
      });

      it('应该正确处理Number.MAX_SAFE_INTEGER的字符串形式', () => {
        const max = Number.MAX_SAFE_INTEGER;
        expect(parseCourseId(String(max))).toBe(max);
      });

      it('应该对Infinity抛出错误', () => {
        expect(() => parseCourseId(Infinity)).toThrow('Invalid course ID: Infinity');
      });

      it('应该对-Infinity抛出错误', () => {
        expect(() => parseCourseId(-Infinity)).toThrow('Invalid course ID: -Infinity');
      });

      it('应该对NaN抛出错误', () => {
        expect(() => parseCourseId(NaN)).toThrow('Invalid course ID: NaN');
      });

      it('应该对"NaN"字符串抛出错误', () => {
        expect(() => parseCourseId('NaN')).toThrow('Cannot parse course ID: "NaN"');
      });

      it('应该对"Infinity"字符串抛出错误', () => {
        // Infinity字符串会被Number()解析为Infinity，然后在isFinite检查中失败
        expect(() => parseCourseId('Infinity')).toThrow('Cannot parse course ID: "Infinity"');
      });

      it('应该对浮点数正确处理（截断或保留）', () => {
        // 根据实现，可能需要处理浮点数
        expect(parseCourseId(89231.0)).toBe(89231);
        expect(parseCourseId('89231.0')).toBe(89231);
      });
    });
  });

  // ==========================================================================
  // 2. 拖拽数据传递测试
  // ==========================================================================

  describe('拖拽数据传递测试', () => {
    describe('拖拽开始时的数据设置', () => {
      it('应该正确设置string类型的courseId到dataTransfer', () => {
        const dataTransfer = new MockDataTransfer();
        const courseId = 89231;

        // 模拟拖拽开始时设置数据（转换为string）
        dataTransfer.setData('text/plain', String(courseId));

        expect(dataTransfer.getData('text/plain')).toBe('89231');
      });

      it('应该正确处理从number到string的隐式转换', () => {
        const dataTransfer = new MockDataTransfer();
        const courseId: number = 89231;

        // 模拟实际代码中的做法
        dataTransfer.setData('text/plain', String(courseId));

        const retrieved = dataTransfer.getData('text/plain');
        expect(typeof retrieved).toBe('string');
        expect(retrieved).toBe('89231');
      });
    });

    describe('拖拽放置时的数据读取', () => {
      it('应该正确读取并转换string类型的courseId', () => {
        const dataTransfer = new MockDataTransfer();
        dataTransfer.setData('text/plain', '89231');

        const rawId = dataTransfer.getData('text/plain');
        const parsedId = parseCourseId(rawId);

        expect(typeof rawId).toBe('string');
        expect(typeof parsedId).toBe('number');
        expect(parsedId).toBe(89231);
      });

      it('应该处理读取到的空字符串', () => {
        const dataTransfer = new MockDataTransfer();
        // 未设置数据时返回空字符串
        const rawId = dataTransfer.getData('text/plain');

        expect(rawId).toBe('');
        expect(() => parseCourseId(rawId)).toThrow('Course ID cannot be empty string');
      });
    });

    describe('类型不匹配时的行为', () => {
      it('应该处理string和number类型不匹配的情况', () => {
        const courseId = 89231;
        const stringId = '89231';

        // 直接使用===比较会失败
        expect(courseId === stringId).toBe(false);

        // 使用parseCourseId后比较成功
        expect(courseId === parseCourseId(stringId)).toBe(true);
      });

      it('应该处理dataTransfer.getData返回的string类型', () => {
        const dataTransfer = new MockDataTransfer();
        const originalId: number = 89231;

        // 设置时转换为string
        dataTransfer.setData('text/plain', String(originalId));

        // 获取时是string
        const retrievedId = dataTransfer.getData('text/plain');

        // 比较前需要转换
        expect(typeof retrievedId).toBe('string');
        expect(parseCourseId(retrievedId)).toBe(originalId);
      });
    });
  });

  // ==========================================================================
  // 3. 防御性编程测试
  // ==========================================================================

  describe('防御性编程测试', () => {
    describe('类型守卫函数 isValidCourseId', () => {
      it('应该对有效数字返回true', () => {
        expect(isValidCourseId(89231)).toBe(true);
        expect(isValidCourseId(0)).toBe(true);
        expect(isValidCourseId(Number.MAX_SAFE_INTEGER)).toBe(true);
      });

      it('应该对有效数字字符串返回true', () => {
        expect(isValidCourseId('89231')).toBe(true);
        expect(isValidCourseId('0')).toBe(true);
        expect(isValidCourseId(String(Number.MAX_SAFE_INTEGER))).toBe(true);
      });

      it('应该对无效值返回false', () => {
        expect(isValidCourseId(null)).toBe(false);
        expect(isValidCourseId(undefined)).toBe(false);
        expect(isValidCourseId('')).toBe(false);
        expect(isValidCourseId('abc')).toBe(false);
        expect(isValidCourseId(-1)).toBe(false);
        expect(isValidCourseId('-1')).toBe(false);
        expect(isValidCourseId(NaN)).toBe(false);
        expect(isValidCourseId(Infinity)).toBe(false);
        expect(isValidCourseId({})).toBe(false);
        expect(isValidCourseId([])).toBe(false);
      });

      it('应该对带空格的字符串返回true（会trim）', () => {
        expect(isValidCourseId(' 89231 ')).toBe(true);
      });
    });

    describe('断言函数 assertValidCourseId', () => {
      it('应该对有效值不抛出错误', () => {
        expect(() => assertValidCourseId(89231)).not.toThrow();
        expect(() => assertValidCourseId('89231')).not.toThrow();
      });

      it('应该对无效值抛出错误', () => {
        expect(() => assertValidCourseId(null)).toThrow(
          'Assertion failed: "null" is not a valid course ID'
        );
        expect(() => assertValidCourseId(undefined)).toThrow(
          'Assertion failed: "undefined" is not a valid course ID'
        );
        expect(() => assertValidCourseId('')).toThrow(
          'Assertion failed: "" is not a valid course ID'
        );
        expect(() => assertValidCourseId('abc')).toThrow(
          'Assertion failed: "abc" is not a valid course ID'
        );
      });

      it('应该正确narrow类型', () => {
        const value: unknown = '89231';
        assertValidCourseId(value);
        // 类型narrow后，value在TypeScript中被推断为number类型
        // 但运行时typeof仍然是string，因为我们没有修改原值
        // 这里验证的是类型守卫通过，value可以被当作number使用
        expect(isValidCourseId(value)).toBe(true);
      });
    });

    describe('数据验证函数 compareCourseId', () => {
      it('应该正确比较相同值的string和number', () => {
        expect(compareCourseId('89231', 89231)).toBe(true);
        expect(compareCourseId(89231, '89231')).toBe(true);
      });

      it('应该正确比较相同类型的值', () => {
        expect(compareCourseId(89231, 89231)).toBe(true);
        expect(compareCourseId('89231', '89231')).toBe(true);
      });

      it('应该正确识别不同值', () => {
        expect(compareCourseId(89231, 89232)).toBe(false);
        expect(compareCourseId('89231', '89232')).toBe(false);
      });

      it('应该对无效值返回false', () => {
        expect(compareCourseId(null, 89231)).toBe(false);
        expect(compareCourseId(89231, undefined)).toBe(false);
        expect(compareCourseId('abc', 89231)).toBe(false);
      });

      it('应该处理边界值比较', () => {
        expect(compareCourseId(0, '0')).toBe(true);
        expect(compareCourseId(-1, '-1')).toBe(false); // 负数被认为是无效的
        expect(compareCourseId(Number.MAX_SAFE_INTEGER, String(Number.MAX_SAFE_INTEGER))).toBe(true);
      });
    });
  });

  // ==========================================================================
  // 4. 集成场景测试
  // ==========================================================================

  describe('集成场景测试', () => {
    describe('高阶学术英语课程拖拽排序场景', () => {
      // 模拟"高阶学术英语"课程数据
      const createAdvancedEnglishCourse = (): Course =>
        createMockCourse({
          id: 89231,
          name: '高阶学术英语',
          course_code: 'ENGL2001',
        });

      const createOtherCourses = (): Course[] => [
        createMockCourse({ id: 12345, name: '数据结构与算法', course_code: 'CS201' }),
        createMockCourse({ id: 67890, name: '线性代数', course_code: 'MATH102' }),
        createMockCourse({ id: 11111, name: '大学物理', course_code: 'PHY101' }),
      ];

      it('应该正确处理高阶学术英语课程的拖拽排序', () => {
        const courses = [createAdvancedEnglishCourse(), ...createOtherCourses()];

        // 模拟拖拽高阶学术英语课程（ID为89231）到索引2的位置
        // 初始顺序: [89231, 12345, 67890, 11111]
        const draggedId = '89231'; // 从dataTransfer.getData获取的是string
        const newIndex = 2;

        const result = processCourseOrder(courses, draggedId, newIndex);

        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
        // 89231从索引0移动到索引2，调整后插入位置为1（因为先删除再插入）
        // 删除后: [12345, 67890, 11111]
        // 插入到索引1: [12345, 89231, 67890, 11111]
        expect(result.newOrder).toEqual([12345, 89231, 67890, 11111]);
      });

      it('应该正确处理number类型的draggedId', () => {
        const courses = [createAdvancedEnglishCourse(), ...createOtherCourses()];

        // 直接使用number类型
        // 初始顺序: [89231, 12345, 67890, 11111]
        const draggedId = 89231;
        const newIndex = 3; // 拖拽到最后

        const result = processCourseOrder(courses, draggedId, newIndex);

        expect(result.success).toBe(true);
        // 89231从索引0移动，adjustedIndex = 2（因为 oldIndex < newIndex）
        // 删除后: [12345, 67890, 11111]
        // 插入到索引2: [12345, 67890, 89231, 11111]
        expect(result.newOrder).toEqual([12345, 67890, 89231, 11111]);
      });

      it('应该处理无效的string类型的courseId', () => {
        const courses = [createAdvancedEnglishCourse(), ...createOtherCourses()];

        // 无效的courseId
        const draggedId = 'invalid_id';
        const newIndex = 1;

        const result = processCourseOrder(courses, draggedId, newIndex);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Cannot parse course ID');
      });

      it('应该处理找不到course的情况', () => {
        const courses = [createAdvancedEnglishCourse(), ...createOtherCourses()];

        // 不存在的courseId
        const draggedId = '99999';
        const newIndex = 1;

        const result = processCourseOrder(courses, draggedId, newIndex);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Course with ID 99999 not found');
      });

      it('应该保持courseId类型为number在newOrder中', () => {
        const courses = [createAdvancedEnglishCourse(), ...createOtherCourses()];

        const result = processCourseOrder(courses, '89231', 2);

        expect(result.success).toBe(true);
        // 验证所有ID都是number类型
        result.newOrder.forEach(id => {
          expect(typeof id).toBe('number');
        });
      });
    });

    describe('CourseList组件中的类型安全', () => {
      it('应该正确处理从HTMLElement.dataset读取的string类型courseId', () => {
        // 模拟HTMLElement.dataset.courseId
        const datasetCourseId = '89231';

        // 模拟查找课程
        const courses: Course[] = [
          createMockCourse({ id: 89231, name: '高阶学术英语' }),
          createMockCourse({ id: 12345, name: '其他课程' }),
        ];

        // 使用parseCourseId转换后查找
        const courseId = parseCourseId(datasetCourseId);
        const course = courses.find(c => c.id === courseId);

        expect(course).toBeDefined();
        expect(course?.name).toBe('高阶学术英语');
      });

      it('应该正确处理dataTransfer.getData返回的string与course.id比较', () => {
        const dataTransfer = new MockDataTransfer();
        const course: Course = createMockCourse({ id: 89231 });

        // 设置拖拽数据
        dataTransfer.setData('text/plain', String(course.id));

        // 获取并比较
        const draggedId = dataTransfer.getData('text/plain');

        // 错误的比较方式（string vs number）
        const wrongMatch = draggedId === course.id;
        expect(wrongMatch).toBe(false);

        // 正确的比较方式
        const correctMatch = parseCourseId(draggedId) === course.id;
        expect(correctMatch).toBe(true);
      });
    });

    describe('存储和加载courseOrder的类型安全', () => {
      it('应该确保存储的courseOrder中所有ID都是number类型', () => {
        const courses: Course[] = [
          createMockCourse({ id: 89231 }),
          createMockCourse({ id: 12345 }),
          createMockCourse({ id: 67890 }),
        ];

        // 模拟存储前的处理
        const courseOrder = courses.map(c => c.id);

        // 验证类型
        courseOrder.forEach(id => {
          expect(typeof id).toBe('number');
        });

        // 验证值
        expect(courseOrder).toEqual([89231, 12345, 67890]);
      });

      it('应该处理从存储加载后可能的string类型ID', () => {
        // 模拟从存储加载的数据（可能是JSON解析后的，包含string）
        const loadedOrder: unknown[] = ['89231', '12345', '67890'];

        // 验证并转换
        const validatedOrder = loadedOrder.map(id => {
          if (typeof id === 'string' || typeof id === 'number') {
            return parseCourseId(id);
          }
          throw new Error(`Invalid course ID type in stored order: ${typeof id}`);
        });

        expect(validatedOrder).toEqual([89231, 12345, 67890]);
        validatedOrder.forEach(id => {
          expect(typeof id).toBe('number');
        });
      });
    });

    describe('实际Bug场景复现和修复验证', () => {
      it('应该复现并修复string vs number导致的错误匹配', () => {
        // 模拟课程列表
        const courses: Course[] = [
          createMockCourse({ id: 89231, name: '高阶学术英语' }),
          createMockCourse({ id: 89232, name: '其他类似课程' }),
        ];

        // 模拟从dataTransfer获取的string类型ID
        const draggedIdString = '89231';

        // 错误的做法：直接比较（可能导致类型不匹配问题）
        const wrongFind = courses.find(c => c.id === draggedIdString);
        expect(wrongFind).toBeUndefined(); // 找不到！

        // 正确的做法：先转换再比较
        const draggedIdNumber = parseCourseId(draggedIdString);
        const correctFind = courses.find(c => c.id === draggedIdNumber);
        expect(correctFind).toBeDefined();
        expect(correctFind?.name).toBe('高阶学术英语');
      });

      it('应该验证Course类型守卫函数的正确性', () => {
        // 有效的Course对象
        const validCourse = createMockCourse({ id: 89231 });
        expect(isCourse(validCourse)).toBe(true);

        // id为string的"Course"对象（可能从API或存储错误解析）
        const invalidCourse = {
          ...validCourse,
          id: '89231', // 错误的类型
        };
        expect(isCourse(invalidCourse)).toBe(false);

        // id为number的Course对象
        const validCourse2 = {
          ...validCourse,
          id: 89231,
        };
        expect(isCourse(validCourse2)).toBe(true);
      });
    });
  });

  // ==========================================================================
  // 5. 额外边界情况测试
  // ==========================================================================

  describe('额外边界情况测试', () => {
    it('应该处理包含前导零的字符串', () => {
      expect(parseCourseId('0089231')).toBe(89231);
      expect(parseCourseId('000')).toBe(0);
    });

    it('应该处理科学计数法字符串', () => {
      expect(parseCourseId('8.9231e4')).toBe(89231);
      expect(parseCourseId('1e10')).toBe(10000000000);
    });

    it('应该处理十六进制字符串', () => {
      // JavaScript的Number()会解析十六进制字符串
      expect(parseCourseId('0x15D2F')).toBe(89391); // 0x15D2F = 89391
      expect(parseCourseId('0xABC')).toBe(2748); // 0xABC = 2748
    });

    it('应该处理八进制字符串', () => {
      // 现代JavaScript中，0前缀的数字按十进制处理
      expect(parseCourseId('0256')).toBe(256);
    });

    it('应该处理极大但仍在安全范围内的数字', () => {
      const largeButSafe = Number.MAX_SAFE_INTEGER - 1;
      expect(parseCourseId(largeButSafe)).toBe(largeButSafe);
      expect(parseCourseId(String(largeButSafe))).toBe(largeButSafe);
    });

    it('应该处理超出安全范围的数字', () => {
      const unsafe = Number.MAX_SAFE_INTEGER + 1;
      // 注意：Number.MAX_SAFE_INTEGER + 1 仍然可以被表示，只是精度可能有问题
      expect(parseCourseId(unsafe)).toBe(unsafe);
    });

    it('应该处理小数形式的ID', () => {
      // JavaScript的Number()会解析浮点数，parseCourseId接受它们
      expect(parseCourseId(89231.7)).toBe(89231.7); // 保持原值，不截断
      expect(parseCourseId('89231.7')).toBe(89231.7);
      expect(parseCourseId(89231.0)).toBe(89231); // 但89231.0会被转为89231
    });

    it('应该处理包含Unicode空格的字符串', () => {
      const idWithUnicodeSpace = '\u00A089231\u00A0'; // 不间断空格
      expect(parseCourseId(idWithUnicodeSpace)).toBe(89231);
    });
  });
});

// ============================================================================
// 导出测试辅助函数供其他测试使用
// ============================================================================

export {
  createMockCourse,
  MockDataTransfer,
  parseCourseId,
  isValidCourseId,
  assertValidCourseId,
  compareCourseId,
  processCourseOrder,
};
