FROM node:18-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm install --production

# 复制源码
COPY server/ ./server/

# 微信云托管默认使用 80 端口
EXPOSE 80

CMD ["node", "server/app.js"]