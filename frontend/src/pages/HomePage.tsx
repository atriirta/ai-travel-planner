// frontend/src/pages/HomePage.tsx
// --- 7.5.3 最终修复版 v2 (修复 FormInstance 导入) ---

// 1. 已修复：'FormInstance' 已从 'react' 移除
import React, { useState, useRef, useEffect } from 'react';
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
  Modal,
  Select,
  type FormInstance, // 2. 已修复：'FormInstance' 添加到 'antd'
} from 'antd';
import {
  AudioOutlined,
  StopFilled,
  EnvironmentOutlined,
  FieldTimeOutlined,
  PlusOutlined,
  DollarCircleOutlined
} from '@ant-design/icons';
import MapComponent from '../components/MapComponent';
import { useAuth } from '../contexts/AuthContext';

const { Title } = Typography;
const { TextArea } = Input;
const API_URL = import.meta.env.VITE_API_BASE_URL;

// --- TypeScript 接口 ---
interface Location { name: string; lat: number; lng: number; }
interface Activity { time: string; activity: string; description: string; location: Location; }
interface DailyPlan { day: number; theme: string; activities: Activity[]; }
interface BudgetBreakdown { category: string; cost: string; notes: string; }

interface PlanData {
  title: string;
  budget_analysis: {
    total_estimate: string;
    breakdown: BudgetBreakdown[];
  };
  daily_plan: DailyPlan[];
}

interface ISavedPlan {
  id: number;
  created_at: string;
  user_id: string;
  title: string;
  plan_data: PlanData;
}

interface IExpense {
  id: number;
  created_at: string;
  category: string;
  description: string;
  amount: number;
}
// --- 结束定义 ---


const HomePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<PlanData | ISavedPlan | null>(null);
  const [form] = Form.useForm();

  const { session } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  // 语音状态
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // 开销管理状态
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [recordedExpenses, setRecordedExpenses] = useState<IExpense[]>([]);
  const [expenseForm] = Form.useForm();

  // --- Type Guard ---
  const isSavedPlan = (p: PlanData | ISavedPlan | null): p is ISavedPlan => {
    return !!(p as ISavedPlan)?.id;
  };

  // 7.4.4 功能：从 "My Plans" 页面加载
  useEffect(() => {
    const loadedPlanString = sessionStorage.getItem('loadedPlan');
    if (loadedPlanString) {
      try {
        const loadedPlan: ISavedPlan = JSON.parse(loadedPlanString);
        setPlan(loadedPlan);
        sessionStorage.removeItem('loadedPlan');
      } catch (e) { console.error('加载 plan 失败', e); sessionStorage.removeItem('loadedPlan'); }
    }
  }, []);

  // 7.5 功能：当 plan 变化时，获取该计划的开销
  useEffect(() => {
    const fetchExpenses = async (planId: number) => {
      setExpenseLoading(true);
      try {
        const response = await axios.get(`${API_URL}/api/expenses/${planId}`);
        setRecordedExpenses(response.data);
      } catch (error) {
        message.error('加载开销记录失败');
      } finally {
        setExpenseLoading(false);
      }
    };

    if (isSavedPlan(plan)) {
      // (良性警告修复) 明确处理 Promise
      fetchExpenses(plan.id).catch(console.error);
    } else {
      setRecordedExpenses([]);
    }
  }, [plan]);

  // 4.2 功能：AI 生成计划
  const handleFormSubmit = async (values: any) => {
    setLoading(true);
    setPlan(null);
    try {
      const response = await axios.post<PlanData>(`${API_URL}/api/llm/plan`, values);
      setPlan(response.data);
      message.success('行程规划生成成功！请先保存计划，再记录开销。');
    } catch (error) { message.error('行程规划失败'); }
    finally { setLoading(false); }
  };

  // 7.4.4 功能：保存计划
  const handleSavePlan = async () => {
    if (!plan || !session?.user) { return; }
    setIsSaving(true);
    try {
      const planDataToSave = isSavedPlan(plan) ? plan.plan_data : plan;
      const titleToSave = planDataToSave.title || '未命名计划';

      const payload = {
        user_id: session.user.id,
        title: titleToSave,
        plan_data: planDataToSave,
      };

      const response = await axios.post<ISavedPlan>(`${API_URL}/api/plans/save`, payload);
      setPlan(response.data);
      message.success('计划已成功保存到云端！');
    } catch (error) { message.error('保存计划失败'); }
    finally { setIsSaving(false); }
  };

  // 7.5 功能：提交开销
  const handleExpenseSubmit = async (values: any) => {
    if (!isSavedPlan(plan) || !session?.user) {
      message.error('必须先保存计划才能记录开销');
      return;
    }

    setExpenseLoading(true);
    try {
      const payload = {
        ...values,
        amount: parseFloat(values.amount),
        itinerary_id: plan.id,
        user_id: session.user.id,
      };

      const response = await axios.post<IExpense>(`${API_URL}/api/expenses`, payload);
      setRecordedExpenses([response.data, ...recordedExpenses]);
      message.success('开销已记录');
      setIsExpenseModalOpen(false);
      expenseForm.resetFields();
    } catch (error) { message.error('记录开销失败'); }
    finally { setExpenseLoading(false); }
  };

  // --- 5.2 & 7.5 重构：语音逻辑 ---
  const uploadAudio = async (
  audioBlob: Blob,
  formInstance: FormInstance, // (form 或 expenseForm)
  fieldName: string          // ('preferences' 或 'description')
) => {
  setLoading(true);
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  try {
    // 步骤 1: 语音转文本 (API 不变)
    const voiceResponse = await axios.post(`${API_URL}/api/voice/transcribe`, formData);
    const { transcription } = voiceResponse.data;

    if (!transcription) {
      throw new Error('未收到转写文本');
    }

    // --- [核心升级] ---
    // 步骤 2: 检查这个语音是用于哪个表单的

    // A. 如果是主表单 (form) 并且用于 'preferences' 字段...
    if (formInstance === form && fieldName === 'preferences') {
      message.info('识别成功，正在智能填充表单...');

      // 步骤 3: ...调用新的 /extract 接口
      const extractResponse = await axios.post(`${API_URL}/api/llm/extract`, {
        text: transcription
      });

      const extractedData = extractResponse.data;

      // 步骤 4: 自动填充 *所有* 表单字段
      // (后端已帮我们过滤了 null 值)
      form.setFieldsValue(extractedData);

      message.success('表单已智能填充！');

    } else {
      // B. 否则 (例如：这是“记一笔开销”的描述框)
      // 保持原有逻辑：只填充那一个字段
      formInstance.setFieldsValue({
        [fieldName]: transcription,
      });
      message.success('语音识别成功！');
    }
    // --- [升级结束] ---

  } catch (error: any) {
    console.error('语音处理流程失败:', error);
    message.error('语音处理失败');
  } finally {
    setLoading(false);
  }
};

  const startRecording = async (
    formInstance: FormInstance,
    fieldName: string
  ) => {
    if (isRecording) {
      stopRecording();
      return;
    }
    if (!navigator.mediaDevices) {
      message.error('您的浏览器不支持录音功能'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => audioChunksRef.current.push(event.data);

      recorder.onstop = () => { // "onstop" 拼写是正确的
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // (良性警告修复) 明确处理 Promise
        uploadAudio(audioBlob, formInstance, fieldName).catch(console.error);

        if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
        setIsRecording(false);
      };

      recorder.start();
      setIsRecording(true);
      message.info('录音已开始...');// (良性警告修复) 'message' 返回的 Promise 可忽略
    } catch (err) { message.error('无法获取麦克风权限'); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      message.info('录音已停止，正在处理...');
    }
  };

  // --- 辅助函数 ---
  const getPlanData = (): PlanData | null => {
    if (!plan) return null;
    if (isSavedPlan(plan)) {
      return plan.plan_data;
    }
    return plan as PlanData;
  };

  const currentPlanData = getPlanData();

  // --- JSX (Return) ---
  return (
    <div>
      <Title level={2} style={{ marginBottom: '24px' }}>
        智能行程规划
      </Title>

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
                    onClick={() => isRecording ? stopRecording() : startRecording(form, 'preferences')}
                    icon={isRecording ? <StopFilled /> : <AudioOutlined />}
                    disabled={loading && !isRecording}
                  />
                </Tooltip>
              </div>
            }
            name="preferences"
            rules={[{ required: true, message: '请输入旅行偏好!' }]}
           >
            <TextArea rows={3} placeholder="例如：喜欢美食和动漫..." />
           </Form.Item>
           <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading && !isRecording} block size="large">
              {loading && !isRecording ? 'AI 正在规划中...' : (isRecording ? '录音中...' : '生成智能行程')}
            </Button>
           </Form.Item>
        </Form>
      </Card>

      {loading && !isRecording && (
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <Spin size="large" />
          <p style={{ marginTop: '16px' }}>AI 正在努力规划中，请稍候...</p>
        </div>
      )}

      {/* --- 结果展示区 (7.5 最终版) --- */}
      {currentPlanData && !loading && (
        <Card
          title={currentPlanData.title || "您的专属旅行计划"}
          style={{ marginTop: 24 }}
          extra={
            <Button
              type="primary"
              onClick={handleSavePlan}
              loading={isSaving}
              disabled={isSavedPlan(plan)}
            >
              {isSavedPlan(plan) ? '计划已保存' : '保存此计划'}
            </Button>
          }
        >
          <Row gutter={[24, 24]}>
            {/* --- 左侧栏 --- */}
            <Col xs={24} md={12}>
              <Title level={4}>行程概览地图</Title>
              <MapComponent plan={currentPlanData} />

              <Title level={4} style={{ marginTop: '16px' }}>预算与开销</Title>
              <p><strong>AI 估算总额: {currentPlanData.budget_analysis.total_estimate}</strong></p>

              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => setIsExpenseModalOpen(true)}
                disabled={!isSavedPlan(plan) || isSaving}
                style={{ marginBottom: 16 }}
              >
                记一笔开销
              </Button>
              {!isSavedPlan(plan) && <p style={{color: 'red', fontSize: '0.9em'}}>请先保存计划，才能开始记账。</p>}

              <Timeline style={{ marginTop: 16 }}>
                <Timeline.Item color="blue">
                  <strong>AI 预算估算 (仅供参考)</strong>
                  {currentPlanData.budget_analysis.breakdown.map((item, i) => (
                     <p key={i} style={{margin: '4px 0 0 20px'}}>{`${item.category}: ${item.cost}`}</p>
                  ))}
                </Timeline.Item>

                {expenseLoading && <Timeline.Item dot={<Spin />}><p>正在加载开销...</p></Timeline.Item>}

                {recordedExpenses.map(expense => (
                  <Timeline.Item key={expense.id} dot={<DollarCircleOutlined style={{color: 'green'}} />}>
                    <strong>{expense.category || '开销'}: {expense.amount} 元</strong>
                    <p style={{margin: '4px 0 0 0'}}>{expense.description}</p>
                    <p style={{fontSize: '0.8em', color: '#999'}}>
                      {new Date(expense.created_at).toLocaleString()}
                    </p>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Col>

            {/* --- 右侧栏 --- */}
            <Col xs={24} md={12}>
              <Title level={4}>详细日程</Title>
              <Collapse defaultActiveKey={['1']}>
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

      {/* --- 7.5 记账弹窗 Modal (已修复 BUG) --- */}
      <Modal
        title="记录一笔新开销"
        open={isExpenseModalOpen}
        onCancel={() => setIsExpenseModalOpen(false)}
        footer={[
          <Button key="back" onClick={() => setIsExpenseModalOpen(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={expenseLoading} onClick={() => expenseForm.submit()}>
            保存
          </Button>,
        ]}
      >
        <Form
          form={expenseForm}
          layout="vertical"
          onFinish={handleExpenseSubmit}
        >
          <Form.Item
            label="金额 (元)"
            name="amount"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="类别"
            name="category"
            rules={[{ required: true, message: '请选择类别' }]}
          >
            <Select placeholder="选择一个类别">
              <Select.Option value="交通">交通</Select.Option>
              <Select.Option value="餐饮">餐饮</Select.Option>
              <Select.Option value="住宿">住宿</Select.Option>
              <Select.Option value="门票">门票</Select.Option>
              <Select.Option value="购物">购物</Select.Option>
              <Select.Option value="其他">其他</Select.Option>
            </Select>
          </Form.Item>

          {/* --- 7.5 BUG 修复处 --- */}
          <Form.Item
            label={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span>描述 (语音推荐)</span>
                <Tooltip title={isRecording ? '停止录音' : '按住说话'}>
                  <Button
                    icon={isRecording ? <StopFilled /> : <AudioOutlined />}
                    type="text"
                    danger={isRecording}
                    onClick={() => isRecording ? stopRecording() : startRecording(expenseForm, 'description')}
                  />
                </Tooltip>
              </div>
            }
            name="description"
          >
            <TextArea
              rows={3}
              placeholder="例如：在秋叶原买了手办"
            />
          </Form.Item>
          {/* --- 修复结束 --- */}

        </Form>
      </Modal>
    </div>
  );
};

export default HomePage;