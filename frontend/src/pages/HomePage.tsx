// frontend/src/pages/HomePage.tsx
import React, { useState, useRef, useEffect } from 'react'; // 7.4.4 新增了 useEffect
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
  Tooltip,
  Row,
  Col,
  Collapse,
  Timeline,
} from 'antd';
import {
  AudioOutlined,
  StopFilled,
  EnvironmentOutlined,
  FieldTimeOutlined
} from '@ant-design/icons';
import MapComponent from '../components/MapComponent';
import { useAuth } from '../contexts/AuthContext'; // 7.3 导入

const { Title } = Typography;
const { TextArea } = Input;
const API_URL = import.meta.env.VITE_API_BASE_URL;

// --- TypeScript 接口 (来自步骤 6) ---
interface Location { name: string; lat: number; lng: number; }
interface Activity { time: string; activity: string; description: string; location: Location; }
interface DailyPlan { day: number; theme: string; activities: Activity[]; }
interface BudgetBreakdown { category: string; cost: string; notes: string; }

// 这是 AI 生成的原始 Plan
interface PlanData {
  title: string;
  budget_analysis: {
    total_estimate: string;
    breakdown: BudgetBreakdown[];
  };
  daily_plan: DailyPlan[];
}

// 7.4.4 新增：这是存入数据库的 Plan (包含 id 和 plan_data)
interface ISavedPlan {
  id: number;
  created_at: string;
  user_id: string;
  title: string;
  plan_data: PlanData; // AI 的 JSON 存在这里
}
// --- 结束定义 ---


const HomePage: React.FC = () => {
  const [loading, setLoading] = useState(false); // AI 生成时的 loading
  // 7.4.4 升级：plan 状态现在可以是新计划，也可以是已保存的计划
  const [plan, setPlan] = useState<PlanData | ISavedPlan | null>(null);
  const [form] = Form.useForm();

  const { session } = useAuth(); // 7.3 获取 session
  const [isSaving, setIsSaving] = useState(false); // 7.3 保存按钮的 loading

  // 语音状态 (来自步骤 5)
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // 7.4.4 新增：页面加载时，检查 sessionStorage 是否有要加载的计划
  useEffect(() => {
    const loadedPlanString = sessionStorage.getItem('loadedPlan');
    if (loadedPlanString) {
      try {
        const loadedPlan: ISavedPlan = JSON.parse(loadedPlanString);
        // 直接设置从 "我的计划" 页面传来的 ISavedPlan 对象
        setPlan(loadedPlan);

        // 关键：加载后必须清除，否则每次刷新都会加载
        sessionStorage.removeItem('loadedPlan');
      } catch (e) {
        console.error('加载 plan 失败', e);
        sessionStorage.removeItem('loadedPlan');
      }
    }
  }, []); // 空依赖数组，确保只在组件首次挂载时运行

  // 表单提交函数 (来自步骤 4)
  const handleFormSubmit = async (values: any) => {
    setLoading(true);
    setPlan(null); // 清空旧计划
    try {
      const response = await axios.post(`${API_URL}/api/llm/plan`, values);
      setPlan(response.data); // 此时的 plan 是 PlanData (无 id)
      message.success('行程规划生成成功！');
    } catch (error: any) {
      console.error('规划失败:', error.response ? error.response.data : error.message);
      message.error('行程规划失败，请检查后端日志');
    } finally {
      setLoading(false);
    }
  };

  // 7.4.4 升级：保存函数
  const handleSavePlan = async () => {
    if (!plan || !session?.user) {
      message.error('没有可保存的计划或用户未登录');
      return;
    }

    setIsSaving(true);
    try {
      // 7.4.4 升级：兼容处理新旧 plan 结构
      // @ts-ignore
      const planDataToSave = plan.plan_data || plan;
      // @ts-ignore
      const titleToSave = plan.title || '未命名计划';

      const payload = {
        user_id: session.user.id,
        title: titleToSave,
        plan_data: planDataToSave, // 将完整的 plan JSON 对象存入 jsonb 字段
      };

      // 7.4.4 升级：后端会返回新保存的 ISavedPlan 对象
      const response = await axios.post<ISavedPlan>(`${API_URL}/api/plans/save`, payload);

      // 7.4.4 升级：用返回的数据（包含 plan.id）更新当前 plan 状态
      setPlan(response.data);

      message.success('计划已成功保存到云端！');

    } catch (error: any) {
      console.error('保存计划失败:', error.response ? error.response.data : error.message);
      message.error('保存计划失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 语音相关函数 (来自步骤 5, 无变化)
  const uploadAudio = async (audioBlob: Blob) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    try {
      const response = await axios.post(`${API_URL}/api/voice/transcribe`, formData);
      const { transcription } = response.data;
      if (transcription) {
        form.setFieldsValue({ preferences: transcription });
        message.success('语音识别成功！');
      } else { throw new Error('未收到转写文本'); }
    } catch (error: any) {
      console.error('语音识别失败:', error.response ? error.response.data : error.message);
      message.error('语音识别失败');
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      message.error('您的浏览器不支持录音功能'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => audioChunksRef.current.push(event.data);
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        uploadAudio(audioBlob);
        if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      };
      recorder.start();
      setIsRecording(true);
      message.info('录音已开始...');
    } catch (err) {
      message.error('无法获取麦克风权限');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      message.info('录音已停止，正在处理...');
    }
  };

  const handleVoiceButtonClick = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };
  // --- 语音函数结束 ---

  // 7.4.4 新增：辅助函数，用于从 plan 状态中获取真正的 PlanData
  // 无论 plan 是 AI 返回的新计划，还是从 DB 加载的已保存计划
  const getPlanData = (): PlanData | null => {
    if (!plan) return null;
    // @ts-ignore
    if (plan.plan_data) {
      // @ts-ignore
      return plan.plan_data as PlanData; // 这是一个 ISavedPlan 对象
    }
    return plan as PlanData; // 这是一个 PlanData 对象
  };

  const currentPlanData = getPlanData();

  return (
    <div>
      <Title level={2} style={{ marginBottom: '24px' }}>
        智能行程规划
      </Title>

      {/* --- 需求输入卡片 (来自步骤 6) --- */}
      <Card title="请输入您的旅行需求">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFormSubmit}
          initialValues={{
            destination: '日本',
            days: 5,
            budget: 10000,
            companions: '2人 (带孩子)',
            preferences: '喜欢美食和动漫',
          }}
        >
          {/* ... (Form.Item 省略，和之前一样) ... */}
          <Form.Item label="目的地" name="destination" rules={[{ required: true, message: '请输入目的地!' }]}>
            <Input placeholder="例如：日本、云南、巴黎" />
          </Form.Item>
          <Form.Item label="天数" name="days" rules={[{ required: true, message: '请输入旅行天数!' }]}>
            <InputNumber min={1} max={30} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="预算 (人民币)" name="budget" rules={[{ required: true, message: '请输入预算!' }]}>
            <InputNumber min={0} step={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="同行人数" name="companions" rules={[{ required: true, message: '请输入同行人数!' }]}>
            <Input placeholder="例如：2人、带孩子、独自旅行" />
          </Form.Item>
          <Form.Item
            label={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span>旅行偏好 (可详细描述)</span>
                <Tooltip title={isRecording ? '停止录音' : '按住说话'}>
                  <Button
                    type={isRecording ? 'primary' : 'default'}
                    danger={isRecording}
                    shape="circle"
                    icon={isRecording ? <StopFilled /> : <AudioOutlined />}
                    onClick={handleVoiceButtonClick}
                    disabled={loading && !isRecording}
                  />
                </Tooltip>
              </div>
            }
            name="preferences"
            rules={[{ required: true, message: '请输入旅行偏好!' }]}
          >
            <TextArea rows={3} placeholder="例如：喜欢美食和动漫、希望行程轻松、想去博物馆" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              {loading ? '处理中...' : '生成智能行程'}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* --- Loading 状态 (来自步骤 6) --- */}
      {loading && !isRecording && (
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <Spin size="large" />
          <p style={{ marginTop: '16px' }}>AI 正在努力规划中，请稍候...</p>
        </div>
      )}

      {/* --- 结果展示区 (来自步骤 6，并增加了 7.4.4 的按钮逻辑) --- */}
      {currentPlanData && !loading && (
        <Card
          title={currentPlanData.title || "您的专属旅行计划"}
          style={{ marginTop: 24 }}
          // --- 步骤 7.4.4：升级 "extra" 属性 ---
          extra={
            <Button
              type="primary"
              onClick={handleSavePlan}
              loading={isSaving}
              // @ts-ignore
              disabled={!!plan.id} // 关键：如果 plan.id 存在，说明已保存
            >
              {/* @ts-ignore */}
              {plan.id ? '计划已保存' : '保存此计划'}
            </Button>
          }
          // --- 结束 ---
        >
          <Row gutter={[24, 24]}>
            <Col xs={24} md={12}>
              <Title level={4}>行程概览地图</Title>
              {/* 7.4.4 升级：使用 currentPlanData */}
              <MapComponent plan={currentPlanData} />

              <Title level={4} style={{ marginTop: '16px' }}>预算分析</Title>
              {/* 7.4.4 升级：使用 currentPlanData */}
              <p><strong>总估算: {currentPlanData.budget_analysis.total_estimate}</strong></p>
              <Timeline
                items={currentPlanData.budget_analysis.breakdown.map((item, index) => ({
                  key: index,
                  children: `${item.category}: ${item.cost} (${item.notes})`,
                }))}
              />
            </Col>

            <Col xs={24} md={12}>
              <Title level={4}>详细日程</Title>
              <Collapse defaultActiveKey={['1']}>
                {/* 7.4.4 升级：使用 currentPlanData */}
                {currentPlanData.daily_plan.map(day => (
                  <Collapse.Panel header={`第 ${day.day} 天: ${day.theme}`} key={day.day}>
                    <Timeline>
                      {day.activities.map((activity, index) => (
                        <Timeline.Item key={index} dot={<FieldTimeOutlined />}>
                          <strong>{activity.time}: {activity.activity}</strong>
                          <p style={{ margin: '4px 0 0 0' }}>{activity.description}</p>
                          {activity.location.name && (
                            <p style={{ fontSize: '0.9em', color: '#888', margin: '4px 0 0 0' }}>
                              <EnvironmentOutlined style={{ marginRight: '4px' }} />
                              {activity.location.name}
                            </p>
                          )}
                        </Timeline.Item>
                      ))}
                    </Timeline>
                  </Collapse.Panel>
                ))}
              </Collapse>
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
};

export default HomePage;