// frontend/src/pages/HomePage.tsx
import React, { useState, useRef } from 'react';
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
} from 'antd';
// 1. 导入 useRef
// 2. 导入图标
import { AudioOutlined, StopFilled } from '@ant-design/icons';

const { Title } = Typography;
const { TextArea } = Input;
const API_URL = import.meta.env.VITE_API_BASE_URL;

const HomePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<any | null>(null);
  const [form] = Form.useForm();

  // --- 语音输入新增状态 ---
  const [isRecording, setIsRecording] = useState(false);
  // 使用 useRef 来存储 MediaRecorder 实例、音频块和媒体流
  // 这样可以避免因组件重渲染导致的状态丢失
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  // --- 结束 ---

  const handleFormSubmit = async (values: any) => {
    setLoading(true);
    setPlan(null);
    console.log('发送给后端的需求:', values);
    try {
      const response = await axios.post(`${API_URL}/api/llm/plan`, values);
      setPlan(response.data);
      message.success('行程规划生成成功！');
    } catch (error: any) {
      console.error('规划失败:', error.response ? error.response.data : error.message);
      message.error('行程规划失败');
    } finally {
      setLoading(false);
    }
  };

  // --- 语音输入新增函数 ---

  // 1. 上传音频到后端
  const uploadAudio = async (audioBlob: Blob) => {
    setLoading(true); // 复用 loading 状态
    const formData = new FormData();
    // 'audio' 键必须和后端 upload.single('audio') 一致
    formData.append('audio', audioBlob, 'recording.webm');

    try {
      // 调用我们在 5.1 中创建的模拟后端
      const response = await axios.post(`${API_URL}/api/voice/transcribe`, formData);
      const { transcription } = response.data;

      // 将识别结果自动填入表单
      if (transcription) {
        form.setFieldsValue({
          preferences: transcription, // 自动填充到 "preferences" 字段
        });
        message.success('语音识别成功！');
      } else {
        throw new Error('未收到转写文本');
      }
    } catch (error: any) {
      console.error('语音识别失败:', error.response ? error.response.data : error.message);
      message.error('语音识别失败');
    } finally {
      setLoading(false);
    }
  };

  // 2. 开始录音
  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      message.error('您的浏览器不支持录音功能');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream; // 保存 stream 以便后续停止

      // 使用 'audio/webm' 格式，它在浏览器中兼容性最好
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = []; // 清空之前的音频块

      // 录音数据可用时
      recorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      // 录音停止时
      recorder.onstop = () => {
        // 创建一个 Blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // 上传到后端
        uploadAudio(audioBlob);

        // 停止并释放麦克风权限
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      recorder.start();
      setIsRecording(true);
      message.info('录音已开始...');
    } catch (err) {
      message.error('无法获取麦克风权限，请检查浏览器设置');
      console.error('麦克风权限错误:', err);
    }
  };

  // 3. 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop(); // 这将触发 onstop 事件
      setIsRecording(false);
      message.info('录音已停止，正在处理...');
    }
  };

  // 4. 切换按钮的点击事件
  const handleVoiceButtonClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // --- 结束 ---

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
          {/* ... 其他 Form.Item ... */}
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

          {/* --- 语音输入 JSX 修改 --- */}
          <Form.Item
            label={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span>旅行偏好 (可详细描述)</span>
                <Tooltip title={isRecording ? '停止录音' : '按住说话'}>
                  <Button
                    type={isRecording ? 'primary' : 'default'}
                    danger={isRecording} // 正在录音时显示为红色
                    shape="circle"
                    icon={isRecording ? <StopFilled /> : <AudioOutlined />}
                    onClick={handleVoiceButtonClick}
                    disabled={loading && !isRecording} // AI 规划时禁用，但录音时允许停止
                  />
                </Tooltip>
              </div>
            }
            name="preferences"
            rules={[{ required: true, message: '请输入旅行偏好!' }]}
          >
            <TextArea
              rows={3}
              placeholder="例如：喜欢美食和动漫、希望行程轻松、想去博物馆"
            />
          </Form.Item>
          {/* --- 结束 --- */}

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              {loading ? '处理中...' : '生成智能行程'}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {loading && !isRecording && ( // 仅在非录音的 loading 状态下显示
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <Spin size="large" />
          <p style={{ marginTop: '16px' }}>AI 正在努力规划中，请稍候...</p>
        </div>
      )}

      {plan && !loading && (
        <Card title="您的专属旅行计划" style={{ marginTop: 24 }}>
          <pre style={{ backgroundColor: '#f5f5f5', padding: '16px', borderRadius: '4px', overflowX: 'auto' }}>
            {JSON.stringify(plan, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
};

export default HomePage;