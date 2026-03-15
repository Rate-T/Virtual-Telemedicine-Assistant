import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu, Typography } from 'antd';
import { MedicineBoxOutlined, FileTextOutlined, UserOutlined, SettingOutlined } from '@ant-design/icons';
import InterviewChat from './pages/InterviewChat';
import Settings from './pages/Settings';

const { Header, Content } = Layout;
const { Title } = Typography;

// 简单的病例列表页
const CaseList: React.FC = () => {
  const cases = [
    {
      id: 'case-001',
      title: '35岁男性胸痛待查',
      department: '心内科',
      difficulty: 3,
      description: '突发胸痛2小时，伴大汗、恶心',
    },
    {
      id: 'case-002',
      title: '28岁女性腹痛伴发热',
      department: '普外科',
      difficulty: 4,
      description: '右上腹痛3天，发热1天',
    },
    {
      id: 'case-003',
      title: '6岁儿童咳嗽喘息',
      department: '儿科',
      difficulty: 2,
      description: '咳嗽1周，喘息2天',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>病例中心</Title>
      <div style={{ display: 'grid', gap: 16, maxWidth: 800 }}>
        {cases.map((c) => (
          <div
            key={c.id}
            style={{
              padding: 16,
              border: '1px solid #e8e8e8',
              borderRadius: 8,
              cursor: 'pointer',
              backgroundColor: '#fff',
            }}
            onClick={() => window.location.href = `/interview/${c.id}`}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>{c.title}</h3>
              <span style={{ color: '#1890ff' }}>{c.department}</span>
            </div>
            <p style={{ color: '#666', marginTop: 8 }}>{c.description}</p>
            <div style={{ marginTop: 8 }}>
              <span>难度: {'⭐'.repeat(c.difficulty)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ backgroundColor: '#fff', borderBottom: '1px solid #e8e8e8' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <MedicineBoxOutlined style={{ fontSize: 28, color: '#1890ff', marginRight: 12 }} />
            <Title level={3} style={{ margin: 0, color: '#1890ff' }}>MedCase AI</Title>
            <Menu mode="horizontal" style={{ marginLeft: 40, flex: 1, border: 'none' }}>
              <Menu.Item key="cases" icon={<FileTextOutlined />}>
                <Link to="/">病例中心</Link>
              </Menu.Item>
              <Menu.Item key="settings" icon={<SettingOutlined />}>
                <Link to="/settings">设置</Link>
              </Menu.Item>
              <Menu.Item key="profile" icon={<UserOutlined />}>
                <Link to="/profile">个人中心</Link>
              </Menu.Item>
            </Menu>
          </div>
        </Header>
        
        <Content>
          <Routes>
            <Route path="/" element={<CaseList />} />
            <Route path="/interview/:caseId" element={<InterviewChat />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<div style={{ padding: 24 }}>个人中心</div>} />
          </Routes>
        </Content>
      </Layout>
    </Router>
  );
};

export default App;