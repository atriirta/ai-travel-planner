// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type Session } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

// 定义 Context 中数据的类型
interface AuthContextType {
  session: Session | null;
  loading: boolean;
}

// 1. 创建 Context
// 我们使用 '!' 来断言 context 绝不会是 undefined，因为它总是在 AuthProvider 中被提供
const AuthContext = createContext<AuthContextType>(null!);

// 2. 创建 Provider 组件
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 立即获取一次当前 session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 监听认证状态的变化 (登录、退出)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // 只有在第一次加载时才设置 loading
      // 登录/退出事件不应该触发全屏 loading
      if (loading) setLoading(false);
    });

    // 清理订阅
    return () => subscription.unsubscribe();
  }, [loading]); // 依赖 loading 确保只在初始时设置 setLoading(false)

  const value = {
    session,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// 3. 创建自定义 Hook (方便其他组件使用)
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth 必须在 AuthProvider 内部使用');
  }
  return context;
};