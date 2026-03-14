import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Card, 
  Input, 
  Button, 
  Avatar, 
  Typography, 
  Spin, 
  Alert,
  Tag,
  Space,
  Modal,
  Form,
  Result
} from 'antd';
import { 
  SendOutlined, 
  UserOutlined, 
  RobotOutlined,
  MedicineBoxOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useInterviewStore, Message } from '../stores/interviewStore';

const { Text, Title } = Typography;
const { TextArea } = Input;

// 快捷提问选项
const QUICK_QUESTIONS = [
  '您哪里不舒服？',
  '这种情况持续多久了？',
  '疼痛是什么性质的？',
  '有没有其他伴随症状？',
  '以前有过类似情况吗？',
];

const InterviewChat: React.FC = () => {
  const navigate = useNavigate();
  const { caseId } = useParams<{ caseId: string }>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [diagnosisModalVisible, setDiagnosisModalVisible] = useState(false);
  const [diagnosisForm] = Form.useForm();
  const [result, setResult] = useState<any>(null);

  const {
    interviewId,
    caseTitle,
    messages,
    status,
    error,
    isConnected,
    startInterview,
    sendMessage,
    reconnect,
    reset,
  } = useInterviewStore();

  // 初始化问诊
  useEffect(() => {
    if (caseId && !interviewId) {
      startInterview(caseId, '测试病例');
    }
  }, [caseId, interviewId, startInterview]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 发送消息
  const handleSend = async () => {
    if (!inputValue.trim()) return;
    
    const message = inputValue.trim();
    setInputValue('');
    await sendMessage(message);
  };

  // 快捷提问
  const handleQuickQuestion = (question: string) => {
    setInputValue(question);
  };

  // 提交诊断
  const handleSubmitDiagnosis = async (values: any) => {
    try {
      const token = localStorage.getItem('token') || 'demo-token';
      const response = await fetch(
        `http://localhost:3000/api/interviews/${interviewId}/diagnosis`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(values),
        }
      );

      if (!response.ok) {
        throw new Error('提交诊断失败');
      }

      const data = await response.json();
      setResult(data.data);
      setDiagnosisModalVisible(false);
    } catch (err) {
      console.error(err);
    }
  };

  // 渲染消息
  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';
    
    return (
      <div
        key={message.id}
        style={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          marginBottom: 16,
        }}
      >
        <Space align="start">
          {!isUser && (
            <Avatar 
              icon={<RobotOutlined />} 
              style={{ backgroundColor: '#1890ff' }}
            />
          )}
          
          <Card
            size="small"
            style={{
              maxWidth: 600,
              backgroundColor: isUser ? '#e6f7ff' : '#f6ffed',
              border: 'none',
            }}
          >
            <Text style={{ whiteSpace: 'pre-wrap' }}>
              {message.content}
              {message.isStreaming && (
                <span style={{ animation: 'blink 1s infinite' }}>▊</span>
              )}
            </Text>
          </Card>
          
          {isUser && (
            <Avatar 
              icon={<UserOutlined />} 
              style={{ backgroundColor: '#52c41a' }}
            />
          )}
        </Space>
      </div>
    );
  };

  // 加载中
  if (status === 'loading') {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center' 
      }}>
        <Spin size="large" tip="正在创建问诊会话..." />
      </div>
    );
  }

  // 结果显示
  if (result) {
    return (
      <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        <Result
          status="success"
          title="问诊完成"
          subTitle={`总评分: ${result.scores?.total || 0}/100`}
          extra={[
            <Button 
              type="primary" 
              key="again"
              onClick={() => {
                reset();
                navigate('/cases');
              }}
            >
              再练一次
            </Button>,
          ]}
        >
          <Card title="评分详情">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text>问诊完整性: {result.scores?.completeness || 0}/100</Text>
              <Text>逻辑性: {result.scores?.logic || 0}/100</Text>
              <Text>沟通技巧: {result.scores?.communication || 0}/100</Text>
              <Text>诊断准确性: {result.scores?.diagnosis || 0}/100</Text>
              <Text>效率: {result.scores?.efficiency || 0}/100</Text>
            </Space>
          </Card>
          
          {result.feedback && (
            <Card title="反馈建议" style={{ marginTop: 16 }}>
              <Text>{result.feedback}</Text>
            </Card>
          )}
        </Result>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 头部 */}
      <Card 
        size="small" 
        style={{ borderRadius: 0, borderBottom: '1px solid #f0f0f0' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <MedicineBoxOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <Title level={4} style={{ margin: 0 }}>{caseTitle || '问诊训练'}</Title>
            <Tag color="blue">自由模式</Tag>
          </Space>
          
          <Space>
            {!isConnected && (
              <Button 
                icon={<ReloadOutlined />} 
                onClick={reconnect}
                type="primary"
                danger
              >
                重新连接
              </Button>
            )}
            <Button 
              type="primary" 
              icon={<CheckCircleOutlined />}
              onClick={() => setDiagnosisModalVisible(true)}
              disabled={messages.length < 3}
            >
              提交诊断
            </Button>
          </Space>
        </div>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Alert
          message={error}
          type="error"
          closable
          style={{ margin: '8px 16px' }}
        />
      )}

      {/* 消息区域 */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto', 
        padding: 16,
        backgroundColor: '#f5f5f5'
      }}>
        {messages.map(renderMessage)}
        <div ref={messagesEndRef} />
      </div>

      {/* 快捷提问 */}
      <div style={{ padding: '8px 16px', backgroundColor: '#fff' }}>
        <Space size="small" wrap>
          {QUICK_QUESTIONS.map((q, i) => (
            <Button 
              key={i} 
              size="small"
              onClick={() => handleQuickQuestion(q)}
            >
              {q}
            </Button>
          ))}
        </Space>
      </div>

      {/* 输入区域 */}
      <Card 
        size="small" 
        style={{ borderRadius: 0, borderTop: '1px solid #f0f0f0' }}
      >
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="请输入您的问题..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button 
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={!inputValue.trim()}
          >
            发送
          </Button>
        </Space.Compact>
      </Card>

      {/* 诊断弹窗 */}
      <Modal
        title="提交诊断"
        open={diagnosisModalVisible}
        onCancel={() => setDiagnosisModalVisible(false)}
        footer={null}
      >
        <Form form={diagnosisForm} onFinish={handleSubmitDiagnosis} layout="vertical">
          <Form.Item
            name="diagnosis"
            label="诊断结果"
            rules={[{ required: true, message: '请输入诊断结果' }]}
          >
            <TextArea rows={3} placeholder="请输入您的诊断..." />
          </Form.Item>
          <Form.Item
            name="diagnosisBasis"
            label="诊断依据"
          >
            <TextArea rows={3} placeholder="请说明诊断依据..." />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              提交
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InterviewChat;
