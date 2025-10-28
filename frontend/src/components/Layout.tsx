// frontend/src/components/Layout.tsx
import React from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Layout as AntLayout, Menu, Button, message } from 'antd';

const { Header, Content, Footer } = AntLayout;

const Layout: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      message.error('退出失败: ' + error.message);
    } else {
      message.success('已退出登录');
      navigate('/login'); // 退出后跳转到登录页
    }
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
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
        {/* 子路由 (如 HomePage) 将在这里被渲染 */}
        <Outlet />
      </Content>

      <Footer style={{ textAlign: 'center' }}>
        AI Travel Planner ©2025 Created by [Your Name]
      </Footer>
    </AntLayout>
  );
};

export default Layout;