// frontend/src/main.tsx
// --- 已修复 Ant Design 上下文 ---

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx'; // 这是我们自己的 App.tsx
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { App as AntApp } from 'antd'; // <-- 1. 从 antd 导入 App，并重命名为 AntApp

// 引入 Ant Design 的全局重置样式
import 'antd/dist/reset.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        {/* 2. 用 <AntApp> 包裹我们的 <App /> */}
        <AntApp>
          <App />
        </AntApp>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);