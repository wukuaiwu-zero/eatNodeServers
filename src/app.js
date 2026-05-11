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

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/families', familyRoutes);
app.use('/api/family-recipes', familyRecipeRoutes);
app.use('/api/family-shopping', familyShoppingRoutes);
app.use('/api/family-ingredients', familyIngredientRoutes);
app.use('/api/family-data', familyDataRoutes);

app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/demo.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
