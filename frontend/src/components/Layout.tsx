// frontend/src/components/Layout.tsx
// --- 已修复 antd Message Hook ---

import React from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
// 1. 'message' 现在作为 'message' 导入，而不是从 antd 根目录
import { Layout as AntLayout, Menu, Button, message } from 'antd';

const { Header, Content, Footer } = AntLayout;

const Layout: React.FC = () => {
  const navigate = useNavigate();
  // 2. [新] 调用 useMessage Hook
  const [messageApi, contextHolder] = message.useMessage();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      // 3. [改] 使用 messageApi
      messageApi.error('退出失败: ' + error.message);
    } else {
      // 3. [改] 使用 messageApi
      messageApi.success('已退出登录');
      navigate('/login'); // 退出后跳转到登录页
    }
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      {/* 4. [新] 渲染 contextHolder 来“挂载” message 实例 */}
      {contextHolder}

      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ color: 'white', fontSize: '20px' }}>AI 旅行规划师</div>
        <Menu theme="dark" mode="horizontal" selectable={false} style={{ flex: 1 }}>
          <Menu.Item key="home">
            <Link to="/">智能规划</Link>
          </Menu.Item>
          <Menu.Item key="my-plans">
            <Link to="/my-plans">我的计划</Link>
          </Menu.Item>
        </Menu>
        <Button type="primary" danger onClick={handleLogout}>
          退出登录
        </Button>
      </Header>

      <Content style={{ padding: '24px' }}>
        <Outlet />
      </Content>

      <Footer style={{ textAlign: 'center' }}>
        AI Travel Planner ©2025 Created by [Your Name]
      </Footer>
    </AntLayout>
  );
};

export default Layout;