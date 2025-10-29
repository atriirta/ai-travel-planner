// frontend/src/pages/MyPlansPage.tsx
// --- 已修复 antd Modal Hook ---

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
// 1. 'Modal' 现在作为 'Modal' 导入，而不是从 antd 根目录
import { List, Spin, message, Button, Modal, Card, Typography } from 'antd';
import { DeleteOutlined, LoadingOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_BASE_URL;
const { Title } = Typography;
// 2. [删] 我们不再从 Modal 中解构 confirm
// const { confirm } = Modal;

interface ISavedPlan {
  id: number;
  created_at: string;
  user_id: string;
  title: string;
  plan_data: any;
}

const MyPlansPage: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<ISavedPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // 3. [新] 调用 useModal Hook
  const [modal, contextHolder] = Modal.useModal();

  const fetchPlans = async () => {
    if (!session?.user.id) return;
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/plans/${session.user.id}`);
      setPlans(response.data);
    } catch (error) {
      message.error('加载历史计划失败'); // (注意：这个 message 也会静默失败，除非在 Layout.tsx 中修复)
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans().catch(console.error);
  }, [session]);

  const handleLoadPlan = (plan: ISavedPlan) => {
    sessionStorage.setItem('loadedPlan', JSON.stringify(plan));
    message.success(`已加载: ${plan.title}`); // (同上，这个也会静默失败)
    navigate('/');
  };

  const handleDeletePlan = (plan: ISavedPlan) => {
    // 4. [改] 使用 'modal.confirm' (来自 Hook) 而不是 'Modal.confirm' (静态)
    modal.confirm({
      title: `确认删除 "${plan.title}" 吗？`,
      content: '此操作不可撤销。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await axios.delete(`${API_URL}/api/plans/${plan.id}`);
          message.success('计划已删除'); // (同上，这个也会静T默失败)
          fetchPlans().catch(console.error); // 重新加载列表
        } catch (error) {
          message.error('删除失败'); // (同上...)
        }
      },
    });
  };

  if (loading) {
    return <Spin indicator={<LoadingOutlined style={{ fontSize: 36 }} spin />} fullscreen />;
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* 5. [新] 渲染 contextHolder 来“挂载” Modal 实例 */}
      {contextHolder}

      <Title level={2}>我的云端计划</Title>
      <List
        grid={{ gutter: 16, xs: 1, sm: 2, md: 3 }}
        dataSource={plans}
        renderItem={(plan) => (
          <List.Item>
            <Card
              title={plan.title}
              actions={[
                <Button type="link" icon={<EyeOutlined />} onClick={() => handleLoadPlan(plan)}>
                  加载
                </Button>,
                <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDeletePlan(plan)}>
                  删除
                </Button>,
              ]}
            >
              <Card.Meta
                description={`创建于: ${new Date(plan.created_at).toLocaleString()}`}
              />
            </Card>
          </List.Item>
        )}
        locale={{ emptyText: '你还没有保存任何计划。' }}
      />
    </div>
  );
};

export default MyPlansPage;