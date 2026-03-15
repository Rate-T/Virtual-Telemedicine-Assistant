import React from 'react';
import { Card, Form, Input, Select, Button, message } from 'antd';
import { useSettingsStore } from '../stores/settingsStore';

const { Option } = Select;

const Settings: React.FC = () => {
  const { aiConfig, setAIConfig } = useSettingsStore();
  const [form] = Form.useForm();

  const handleSave = (values: any) => {
    setAIConfig(values);
    message.success('设置已保存');
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Card title="AI模型配置">
        <Form
          form={form}
          layout="vertical"
          initialValues={aiConfig}
          onFinish={handleSave}
        >
          <Form.Item
            name="provider"
            label="AI提供商"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="xinghuo">讯飞星火</Option>
              <Option value="openai">OpenAI</Option>
              <Option value="custom">自定义</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="apiUrl"
            label="API地址"
            rules={[{ required: true }]}
          >
            <Input placeholder="https://..." />
          </Form.Item>

          <Form.Item
            name="apiKey"
            label="API密钥"
            rules={[{ required: true }]}
          >
            <Input.Password placeholder="输入API密钥" />
          </Form.Item>

          <Form.Item
            name="model"
            label="模型名称"
            rules={[{ required: true }]}
          >
            <Input placeholder="如：generalv3.5 或 gpt-3.5-turbo" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="使用说明" style={{ marginTop: 16 }}>
        <p>1. 选择您的AI提供商</p>
        <p>2. 填写对应的API地址和密钥</p>
        <p>3. 设置模型名称</p>
        <p>4. 保存后即可在问诊中使用</p>
        
        <h4>常用配置：</h4>
        <p><strong>讯飞星火：</strong></p>
        <ul>
          <li>API地址：https://spark-api-open.xf-yun.com/v1/chat/completions</li>
          <li>模型：generalv3.5</li>
        </ul>
        
        <p><strong>OpenAI：</strong></p>
        <ul>
          <li>API地址：https://api.openai.com/v1/chat/completions</li>
          <li>模型：gpt-3.5-turbo</li>
        </ul>
      </Card>
    </div>
  );
};

export default Settings;