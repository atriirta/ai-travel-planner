// frontend/src/App.tsx
import { Routes, Route } from 'react-router-dom';

// 导入页面和组件
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AuthGuard from './components/AuthGuard';
import Layout from './components/Layout'; // 导入我们的主布局
import MyPlansPage from './pages/MyPlansPage';

function App() {
  return (
    <Routes>
      {/* 公开路由 (任何人都可以访问)
      */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* 私有路由 (需要登录)
        我们使用一个父路由 <AuthGuard /> 来包裹所有私有路由
      */}
      <Route element={<AuthGuard />}>
        {/* 所有受保护的页面都使用 <Layout /> 布局
          <HomePage /> 会被渲染到 <Layout /> 中的 <Outlet /> 位置
        */}
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          {/* 2. 添加新路由 */}
          <Route path="/my-plans" element={<MyPlansPage />} />
        </Route>
      </Route>

      {/* 可选：添加一个 404 页面
        <Route path="*" element={<NotFoundPage />} />
      */}
    </Routes>
  );
}

export default App;