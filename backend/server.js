// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

// 中间件
app.use(cors()); // 允许所有跨域请求 (开发)
app.use(express.json()); // 解析 JSON body
app.use(express.urlencoded({ extended: true })); // 解析 URL-encoded body

// 健康检查路由
app.get('/', (req, res) => {
      // 使用反引号 (`) 替换单引号 (')
      res.send(`AI Travel Planner 
      后端已启动!`);
    });

// TODO: 在这里添加其他 API 路由

app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});