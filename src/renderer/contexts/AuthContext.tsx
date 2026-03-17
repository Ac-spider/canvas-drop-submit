/**
 * 认证上下文
 * @module contexts/AuthContext
 * @description 使用 React Context 管理 API Token，避免 prop drilling
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { CanvasApiClient, createCanvasApiClient } from '../services/canvasApi';

// ============================================================================
// 类型定义
// ============================================================================

export interface AuthState {
  apiToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  /** 登录 */
  login: (token: string) => Promise<boolean>;
  /** 登出 */
  logout: () => void;
  /** 清除错误 */
  clearError: () => void;
  /** Canvas API 客户端实例 */
  apiClient: CanvasApiClient | null;
}

// ============================================================================
// Context 创建
// ============================================================================

const AuthContext = createContext<AuthContextValue | null>(null);

// ============================================================================
// Props 类型
// ============================================================================

interface AuthProviderProps {
  children: React.ReactNode;
}

// ============================================================================
// Provider 组件
// ============================================================================

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初始化时从存储中加载 Token
  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await window.electronAPI?.getToken?.();
        if (storedToken) {
          setApiToken(storedToken);
        }
      } catch (err) {
        console.error('Failed to load token:', err);
      }
    };

    loadToken();
  }, []);

  // 创建 API 客户端实例
  const apiClient = useMemo(() => {
    if (!apiToken) return null;
    return createCanvasApiClient(apiToken);
  }, [apiToken]);

  /**
   * 登录验证
   */
  const login = useCallback(async (token: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // 创建临时客户端验证 Token
      const tempClient = createCanvasApiClient(token);
      const result = await tempClient.validateToken();

      if (result.valid) {
        // 存储 Token
        await window.electronAPI?.storeToken?.(token);
        setApiToken(token);
        return true;
      } else {
        setError(result.error || '验证失败');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证过程中发生错误');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 登出
   */
  const logout = useCallback(() => {
    window.electronAPI?.clearToken?.();
    setApiToken(null);
    setError(null);
  }, []);

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextValue = {
    apiToken,
    isAuthenticated: apiToken !== null,
    isLoading,
    error,
    login,
    logout,
    clearError,
    apiClient,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
