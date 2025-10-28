// frontend/src/pages/HomePage.tsx
import React, { useState } from 'react';
import axios from 'axios';
import {
  Form,
  Input,
  Button,
  message,
  Spin,
  Card,
  Typography,
  InputNumber,
} from 'antd';

// 1. 从 Ant Design 导入组件
const { Title } = Typography;
const { TextArea } = Input; // 之前也漏掉了这个

// 2. 定义后端 API 地址
const API_URL = import.meta.env.VITE_API_BASE_URL;

// 3. 定义组件
const HomePage: React.FC = () => {
  // 4. Hook 必须在组件内部
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<any | null>(null); // any 类型用于接收 JSON
  const [form] = Form.useForm(); // 创建 form 实例

  // 5. 事件处理函数在组件内部
  const handleFormSubmit = async (values: any) => {
    setLoading(true);
    setPlan(null); // 清除旧的计划
    console.log('发送给后端的需求:', values);

    try {
      const response = await axios.post(`${API_URL}/api/llm/plan`, values);
      setPlan(response.data); // 存储 LLM 返回的 plan JSON
      message.success('行程规划生成成功！');
    } catch (error: any) {
      console.error('规划失败:', error.response ? error.response.data : error.message);
      message.error('行程规划失败');
    } finally {
      setLoading(false);
    }
  };

  // 6. 组件的 return 语句，包含所有 JSX
  return (
    <div>
      <Title level={2} style={{ marginBottom: '24px' }}>
        智能行程规划
      </Title>
      <Card title="请输入您的旅行需求">
        <Form
          form={form} // 关联 form 实例
          layout="vertical"
          onFinish={handleFormSubmit}
          initialValues={{
            // 可以设置一些默认值
            destination: '日本',
            days: 5,
            budget: 10000,
            companions: '2人 (带孩子)',
            preferences: '喜欢美食和动漫',
          }}
        >
          <Form.Item
            label="目的地"
            name="destination"
            rules={[{ required: true, message: '请输入目的地!' }]}
          >
            <Input placeholder="例如：日本、云南、巴黎" />
          </Form.Item>

          <Form.Item
            label="天数"
            name="days"
            rules={[{ required: true, message: '请输入旅行天数!' }]}
          >
            <InputNumber min={1} max={30} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="预算 (人民币)"
            name="budget"
            rules={[{ required: true, message: '请输入预算!' }]}
          >
            <InputNumber min={0} step={1000} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="同行人数"
            name="companions"
            rules={[{ required: true, message: '请输入同行人数!' }]}
          >
            <Input placeholder="例如：2人、带孩子、独自旅行" />
          </Form.Item>

          <Form.Item
            label="旅行偏好 (可详细描述)"
            name="preferences"
            rules={[{ required: true, message: '请输入旅行偏好!' }]}
          >
            <TextArea
              rows={3}
              placeholder="例如：喜欢美食和动漫、希望行程轻松、想去博物馆"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              {loading ? 'AI 正在规划中...' : '生成智能行程'}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 7. 当 plan 存在时，显示规划结果 */}
      {loading && (
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <Spin size="large" />
          <p style={{ marginTop: '16px' }}>AI 正在努力规划中，请稍候...</p>
        </div>
      )}

      {plan && !loading && (
        <Card title="您的专属旅行计划" style={{ marginTop: 24 }}>
          {/* 我们暂时使用 <pre> 标签来格式化显示 JSON
            在步骤 6 中，我们会用地图和列表来替换它
          */}
          <pre style={{ backgroundColor: '#f5f5f5', padding: '16px', borderRadius: '4px', overflowX: 'auto' }}>
            {JSON.stringify(plan, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
};

export default HomePage;