const express = require('express');
const cors = require('cors');
const path = require('path');

const actionRoutes = require('./routes/action.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');

const app = express();

// 这里是整个 Express 应用的中间件和路由入口。
// 请求会先经过通用中间件，再按 /api/... 前缀分发到不同业务模块。
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// 项目接口统一采用 action 风格：
// - 查询类：GET /api/getXxx?query=params
// - 增删改类：POST /api/saveXxx 或 /api/deleteXxx，参数放 JSON body
app.use('/api', actionRoutes);
app.use('/', feedbackRoutes);
app.use('/api', feedbackRoutes);

app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/demo.html'));
});

// 这两个兜底中间件要放在所有路由之后：
// - notFoundHandler 处理没有匹配到的路由。
// - errorHandler 统一处理 next(error) 抛出来的业务/系统错误。
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
