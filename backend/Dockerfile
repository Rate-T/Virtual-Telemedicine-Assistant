FROM node:18-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm install

# 复制代码
COPY . .

# 生成Prisma客户端并编译TypeScript
RUN npx prisma generate
RUN npx tsc

# 创建日志目录
RUN mkdir -p logs

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "dist/index.js"]