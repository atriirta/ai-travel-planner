// frontend/src/pages/RegisterPage.tsx
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Form, Input, Button, message } from 'antd';
import { useNavigate } from 'react-router-dom';

const RegisterPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (values: any) => {
    setLoading(true);
    const { email, password } = values;
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      message.error(error.message);
    } else {
      message.success('注册成功！请登录。');
      navigate('/login');
    }
    setLoading(false);
  };

  return (
    <div style={{ width: 300, margin: '100px auto' }}>
      <h2>注册</h2>
      <Form onFinish={handleRegister}>
        <Form.Item name="email" rules={[{ required: true, type: 'email' }]}>
          <Input placeholder="邮箱" />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true, min: 6 }]}>
          <Input.Password placeholder="密码 (至少6位)" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            注册
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default RegisterPage;