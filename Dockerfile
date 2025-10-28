# Dockerfile

# --- 阶段 1: 构建前端 ---
FROM node:18-alpine AS builder
WORKDIR /app/frontend
# 复制 package 文件并安装依赖
COPY frontend/package*.json ./
RUN npm install
# 复制前端所有源代码
COPY frontend/ ./
# 执行构建，生成静态文件到 /app/frontend/dist
RUN npm run build

# --- 阶段 2: 准备后端 ---
FROM node:18-alpine AS backend-prep
WORKDIR /app/backend
# 复制 package 文件并安装 *生产* 依赖
COPY backend/package*.json ./
RUN npm install --production
# 复制后端所有源代码
COPY backend/ ./

# --- 阶段 3: 最终镜像 ---
FROM node:18-alpine
WORKDIR /app

# [关键] 安装 ffmpeg，因为后端语音转码需要它
# Alpine Linux 使用 apk 包管理器
RUN apk add --no-cache ffmpeg

# 从后端准备阶段复制已安装依赖和源代码
COPY --from=backend-prep /app/backend ./

# 从前端构建阶段复制构建好的静态文件到后端的 'public' 目录
# 这是为了让 Express 能够托管前端文件
COPY --from=builder /app/frontend/dist ./public

# 暴露端口 (需要与 backend/.env 中的 PORT 匹配，或者在运行时通过 -e 覆盖)
ENV PORT=3000
EXPOSE 3000

# 运行后端服务器的命令
# CMD ["node", "server.js"]
# 优化：使用 npm start (如果 package.json 中定义了 start 脚本)
# 确保 backend/package.json 中有 "scripts": { "start": "node server.js" }
CMD ["npm", "start"]