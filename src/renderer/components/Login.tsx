import { useState, useCallback } from 'react';

/**
 * Props for the Login component
 */
interface LoginProps {
  /** Callback invoked when token is successfully validated */
  onLoginSuccess: (token: string) => void;
}

/**
 * Login component for Canvas API Token input and validation
 *
 * Provides a secure form for users to input their Canvas API Token,
 * with encryption storage via electron-store and validation state management.
 */
export function Login({ onLoginSuccess }: LoginProps) {
  const [token, setToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  /**
   * Validates the Canvas API token by making a test request (via main process to avoid CORS)
   */
  const validateToken = useCallback(async (apiToken: string): Promise<{ valid: boolean; error?: string }> => {
    try {
      // Use main process proxy to avoid CORS issues
      const result = await window.electronAPI?.validateToken?.(apiToken);

      if (result?.valid) {
        return { valid: true };
      }

      if (result?.error) {
        return { valid: false, error: result.error };
      }

      return { valid: false, error: '验证失败' };
    } catch (err) {
      return { valid: false, error: `验证错误: ${err instanceof Error ? err.message : '未知错误'}` };
    }
  }, []);

  /**
   * Handles form submission
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token.trim()) {
      setError('请输入API Token');
      return;
    }

    setIsLoading(true);

    try {
      const result = await validateToken(token.trim());

      if (result.valid) {
        // Store token securely via preload API
        await window.electronAPI?.storeToken?.(token.trim());
        onLoginSuccess(token.trim());
      } else {
        setError(`API Token 验证失败: ${result.error}`);
      }
    } catch (err) {
      setError('验证过程中发生错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  }, [token, validateToken, onLoginSuccess]);

  /**
   * Toggles token visibility
   */
  const toggleVisibility = useCallback(() => {
    setIsVisible((prev) => !prev);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Canvas Drop Submit</h1>
        <p className="mb-6 text-sm text-gray-600">
          请输入您的Canvas API Token以继续
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="token"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              API Token
            </label>
            <div className="relative">
              <input
                id="token"
                type={isVisible ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="输入您的Canvas API Token"
                disabled={isLoading}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={toggleVisibility}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                aria-label={isVisible ? '隐藏Token' : '显示Token'}
              >
                {isVisible ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              <p className="font-medium">{error}</p>
              {(error.includes('网络') || error.includes('连接') || error.includes('无法连接')) && (
                <p className="mt-1 text-xs text-red-600">
                  提示：请确保您可以访问 https://oc.sjtu.edu.cn，某些网络环境可能需要 VPN
                </p>
              )}
              {(error.includes('401') || error.includes('无效') || error.includes('过期')) && (
                <p className="mt-1 text-xs text-red-600">
                  提示：Token 可能已过期，请在 Canvas 设置中重新生成
                </p>
              )}
              {error.includes('403') && (
                <p className="mt-1 text-xs text-red-600">
                  提示：请检查 Token 的权限设置，确保有足够的访问权限
                </p>
              )}
              {error.includes('429') && (
                <p className="mt-1 text-xs text-red-600">
                  提示：请求过于频繁，请稍等片刻后再试
                </p>
              )}
              {(error.includes('500') || error.includes('502') || error.includes('503')) && (
                <p className="mt-1 text-xs text-red-600">
                  提示：Canvas 服务器暂时不可用，请稍后再试
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !token.trim()}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
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
                验证中...
              </span>
            ) : (
              '登录'
            )}
          </button>
        </form>

        <div className="mt-6 text-xs text-gray-500">
          <p className="mb-2">如何获取API Token：</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>登录Canvas网站</li>
            <li>点击右上角头像 → 设置</li>
            <li>滚动到"已批准的集成"部分</li>
            <li>点击"+ 新访问令牌"</li>
            <li>复制生成的Token并粘贴到上方</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
