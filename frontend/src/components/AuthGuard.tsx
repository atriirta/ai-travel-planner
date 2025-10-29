// frontend/src/components/AuthGuard.tsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, Outlet } from 'react-router-dom';
import { Spin } from 'antd'; // 引入 antd 的加载中组件

const AuthGuard: React.FC = () => {
  const { session, loading } = useAuth();

  if (loading) {
    // 页面加载时，显示一个全屏的 loading
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!session) {
    // 如果没有 session (未登录)，重定向到登录页
    // 'replace' 属性可以防止用户通过“后退”按钮回到受保护的页面
    return <Navigate to="/login" replace />;
  }

  // 如果已登录，渲染子路由
  // <Outlet /> 是 react-router-dom v6 的一个组件，用于渲染匹配到的子路由
  return <Outlet />;
};

export default AuthGuard;