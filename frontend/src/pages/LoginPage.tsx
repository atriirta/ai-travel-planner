// frontend/src/pages/LoginPage.tsx
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Form, Input, Button, message, Typography } from 'antd';
import { useNavigate, Link } from 'react-router-dom';

const { Title } = Typography;

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (values: any) => {
    setLoading(true);
    const { email, password } = values;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        message.success('登录成功！');
        // 登录成功后跳转到主页
        navigate('/');
      }
    } catch (error: any) {
      message.error(error.message || '登录时发生错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: 320, margin: '100px auto', padding: '20px', border: '1px solid #f0f0f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <Title level={3} style={{ textAlign: 'center', marginBottom: '24px' }}>
        登录
      </Title>
      <Form
        name="login"
        onFinish={handleLogin}
        layout="vertical"
        requiredMark={false}
      >
        <Form.Item
          label="邮箱"
          name="email"
          rules={[
            { required: true, message: '请输入邮箱!' },
            { type: 'email', message: '请输入有效的邮箱地址!' }
          ]}
        >
          <Input placeholder="you@example.com" />
        </Form.Item>

        <Form.Item
          label="密码"
          name="password"
          rules={[{ required: true, message: '请输入密码!' }]}
        >
          <Input.Password placeholder="请输入密码" />
        </Form.Item>

        <Form.Item style={{ marginBottom: '10px' }}>
          <Button type="primary" htmlType="submit" loading={loading} block>
            登录
          </Button>
        </Form.Item>

        <div style={{ textAlign: 'center' }}>
          还没有账户？ <Link to="/register">立即注册</Link>
        </div>
      </Form>
    </div>
  );
};

export default LoginPage;