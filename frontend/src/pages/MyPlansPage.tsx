// frontend/src/pages/MyPlansPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { List, Spin, message, Button, Modal, Card, Typography } from 'antd';
import { DeleteOutlined, LoadingOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_BASE_URL;
const { Title } = Typography;
const { confirm } = Modal;

// Supabase 'itineraries' 表的数据结构
interface ISavedPlan {
  id: number;
  created_at: string;
  user_id: string;
  title: string;
  plan_data: any; // 这就是我们完整的 PlanData JSON
}

const MyPlansPage: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<ISavedPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. 加载所有计划
  const fetchPlans = async () => {
    if (!session?.user.id) return;
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/plans/${session.user.id}`);
      setPlans(response.data);
    } catch (error) {
      message.error('加载历史计划失败');
    } finally {
      setLoading(false);
    }
  };

  // 2. 页面加载时执行
  useEffect(() => {
    fetchPlans();
  }, [session]);

  // 3. 加载选中的计划 (核心功能)
  const handleLoadPlan = (plan: ISavedPlan) => {
    // 我们使用 sessionStorage 来临时存储要加载的计划
    // HomePage 将在加载时检查这个
    sessionStorage.setItem('loadedPlan', JSON.stringify(plan));
    message.success(`已加载: ${plan.title}`);
    navigate('/'); // 跳转回主页
  };

  // 4. 删除计划
  const handleDeletePlan = (plan: ISavedPlan) => {
    confirm({
      title: `确认删除 "${plan.title}" 吗？`,
      content: '此操作不可撤销。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await axios.delete(`${API_URL}/api/plans/${plan.id}`);
          message.success('计划已删除');
          fetchPlans(); // 重新加载列表
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  if (loading) {
    return <Spin indicator={<LoadingOutlined style={{ fontSize: 36 }} spin />} fullscreen />;
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
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