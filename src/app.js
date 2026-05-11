const express = require('express');
const cors = require('cors');
const path = require('path');

const familyRoutes = require('./routes/family.routes');
const familyRecipeRoutes = require('./routes/familyRecipe.routes');
const familyShoppingRoutes = require('./routes/familyShopping.routes');
const familyIngredientRoutes = require('./routes/familyIngredient.routes');
const familyDataRoutes = require('./routes/familyData.routes');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');

const app = express();

// 这里是整个 Express 应用的中间件和路由入口。
// 请求会先经过通用中间件，再按 /api/... 前缀分发到不同业务模块。
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// 家庭基础信息：创建家庭、改名、删除、成员列表。
app.use('/api/families', familyRoutes);
// 家庭菜谱：目前是“一个家庭一份 recipeJson”的整包同步。
app.use('/api/family-recipes', familyRecipeRoutes);
// 家庭购物清单：独立表，item 级同步，支持软删除和 changes 增量。
app.use('/api/family-shopping', familyShoppingRoutes);
// 家庭食材库：和购物清单结构相似，但独立表，避免后续业务规则互相影响。
app.use('/api/family-ingredients', familyIngredientRoutes);
// 聚合读取：一次返回 familyRecipe / shoppingList / ingredientLibrary。
app.use('/api/family-data', familyDataRoutes);

app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/demo.html'));
});

// 这两个兜底中间件要放在所有路由之后：
// - notFoundHandler 处理没有匹配到的路由。
// - errorHandler 统一处理 next(error) 抛出来的业务/系统错误。
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
