import { useState, useCallback, useEffect } from 'react';
import { Login } from './components/Login';
import { CourseList } from './components/CourseList';
import { AssignmentList } from './components/AssignmentList';
import { DropZone } from './components/DropZone';
import { FileList } from './components/FileList';
import type { Assignment } from '../shared/types';

/**
 * 应用主组件
 *
 * 管理全局状态：
 * - API Token（登录状态）
 * - 选中的课程
 * - 选中的作业
 */
function App() {
  const [apiToken, setApiToken] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * 初始化时从存储加载 Token
   */
  useEffect(() => {
    const loadStoredToken = async () => {
      try {
        const storedToken = await window.electronAPI?.getToken?.();
        if (storedToken) {
          // 验证存储的 Token 是否有效
          const result = await window.electronAPI?.validateToken?.(storedToken);
          if (result?.valid) {
            setApiToken(storedToken);
          } else {
            // Token 无效，清除存储
            await window.electronAPI?.clearToken?.();
          }
        }
      } catch (err) {
        console.error('Failed to load stored token:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredToken();
  }, []);

  /**
   * 登录成功处理
   */
  const handleLoginSuccess = useCallback(async (token: string) => {
    // Token 已经在 Login 组件中验证并存储，这里只需更新状态
    setApiToken(token);
  }, []);

  /**
   * 选择课程
   */
  const handleSelectCourse = useCallback((courseId: number) => {
    setSelectedCourseId(courseId);
    setSelectedAssignment(null);
  }, []);

  /**
   * 选择作业
   */
  const handleSelectAssignment = useCallback((assignment: Assignment) => {
    setSelectedAssignment(assignment);
  }, []);

  /**
   * 上传完成
   */
  const handleUploadComplete = useCallback(() => {
    // 刷新作业列表
    setSelectedAssignment(null);
    setTimeout(() => {
      if (selectedCourseId) {
        // 重新选择以刷新
        const currentId = selectedCourseId;
        setSelectedCourseId(null);
        setTimeout(() => setSelectedCourseId(currentId), 0);
      }
    }, 500);
  }, [selectedCourseId]);

  /**
   * 退出登录
   */
  const handleLogout = useCallback(async () => {
    await window.electronAPI?.clearToken?.();
    setApiToken('');
    setSelectedCourseId(null);
    setSelectedAssignment(null);
  }, []);

  // 加载中状态
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg
            className="mx-auto h-8 w-8 animate-spin text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-600">正在加载...</p>
        </div>
      </div>
    );
  }

  // 未登录状态
  if (!apiToken) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Canvas Drop Submit</h1>
            <button
              onClick={handleLogout}
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              退出登录
            </button>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* 左侧：课程列表 */}
          <div className="min-w-0 md:col-span-1">
            <div className="overflow-hidden rounded-lg bg-white p-4 shadow">
              <CourseList
                apiToken={apiToken}
                onSelectCourse={handleSelectCourse}
              />
            </div>
          </div>

          {/* 中间：作业列表 */}
          <div className="min-w-0 md:col-span-1">
            {selectedCourseId ? (
              <div className="overflow-hidden rounded-lg bg-white p-4 shadow">
                <AssignmentList
                  apiToken={apiToken}
                  courseId={selectedCourseId}
                  onSelectAssignment={handleSelectAssignment}
                />
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg bg-white shadow">
                <p className="text-gray-500">请从左侧选择一个课程</p>
              </div>
            )}
          </div>

          {/* 右侧：文件列表和上传区 */}
          <div className="min-w-0 md:col-span-2">
            {selectedCourseId ? (
              <div className="space-y-6">
                {/* 文件列表 */}
                <div className="rounded-lg bg-white p-4 shadow">
                  <FileList
                    apiToken={apiToken}
                    courseId={selectedCourseId}
                  />
                </div>

                {/* 拖拽上传区 */}
                {selectedAssignment && (
                  <div className="rounded-lg bg-white p-4 shadow">
                    <h3 className="mb-4 text-lg font-semibold text-gray-900">
                      提交作业：{selectedAssignment.name}
                    </h3>
                    <DropZone
                      apiToken={apiToken}
                      courseId={selectedCourseId}
                      assignmentId={selectedAssignment.id}
                      assignmentName={selectedAssignment.name}
                      onUploadComplete={handleUploadComplete}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg bg-white shadow">
                <p className="text-gray-500">请从左侧选择一个课程</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
