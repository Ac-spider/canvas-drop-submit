/**
 * 测试 assignmentUtils 中的新函数
 */
import { extractFileIdFromUrl, isCanvasFileUrl } from '../renderer/utils/assignmentUtils';

describe('assignmentUtils', () => {
  describe('extractFileIdFromUrl', () => {
    it('should extract file ID from relative path /files/123/download', () => {
      expect(extractFileIdFromUrl('/files/123/download')).toBe(123);
    });

    it('should extract file ID from relative path /files/123', () => {
      expect(extractFileIdFromUrl('/files/123')).toBe(123);
    });

    it('should extract file ID from full URL', () => {
      expect(extractFileIdFromUrl('https://oc.sjtu.edu.cn/files/456/download')).toBe(456);
    });

    it('should extract file ID from URL with query params', () => {
      expect(extractFileIdFromUrl('/files/789/download?verifier=abc123')).toBe(789);
    });

    it('should return null for non-file URLs', () => {
      expect(extractFileIdFromUrl('https://example.com/some/path')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(extractFileIdFromUrl('')).toBeNull();
    });

    it('should return null for invalid input', () => {
      expect(extractFileIdFromUrl(null as unknown as string)).toBeNull();
    });

    // 新增：测试 /courses/{course_id}/files/{file_id} 格式
    it('should extract file ID from /courses/{course_id}/files/{file_id} path', () => {
      expect(extractFileIdFromUrl('/courses/88113/files/12783782')).toBe(12783782);
    });

    it('should extract file ID from /courses/{course_id}/files/{file_id}?wrap=1 path', () => {
      expect(extractFileIdFromUrl('/courses/88113/files/12783782?wrap=1')).toBe(12783782);
    });

    it('should extract file ID from full URL with courses path', () => {
      expect(extractFileIdFromUrl('https://oc.sjtu.edu.cn/courses/88113/files/12783782?wrap=1')).toBe(12783782);
    });
  });

  describe('isCanvasFileUrl', () => {
    it('should return true for relative file path', () => {
      expect(isCanvasFileUrl('/files/123/download')).toBe(true);
    });

    it('should return true for full Canvas URL', () => {
      expect(isCanvasFileUrl('https://oc.sjtu.edu.cn/files/456/download')).toBe(true);
    });

    it('should return true for files path without download', () => {
      expect(isCanvasFileUrl('/files/123')).toBe(true);
    });

    it('should return false for non-file URLs', () => {
      expect(isCanvasFileUrl('https://example.com/some/path')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isCanvasFileUrl('')).toBe(false);
    });

    // 新增：测试 /courses/{course_id}/files/{file_id} 格式
    it('should return true for /courses/{course_id}/files/{file_id} path', () => {
      expect(isCanvasFileUrl('/courses/88113/files/12783782')).toBe(true);
    });

    it('should return true for /courses/{course_id}/files/{file_id}?wrap=1 path', () => {
      expect(isCanvasFileUrl('/courses/88113/files/12783782?wrap=1')).toBe(true);
    });

    it('should return true for full URL with courses path', () => {
      expect(isCanvasFileUrl('https://oc.sjtu.edu.cn/courses/88113/files/12783782?wrap=1')).toBe(true);
    });
  });
});
