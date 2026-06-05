const mysql = require('mysql2/promise');
const { env } = require('../src/config/env');

function parseJson(value) {
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch (error) {
    return null;
  }
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function bool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return ['true', '1', 'yes'].includes(String(value).toLowerCase());
}

function recipesFromJson(recipeJson) {
  const parsed = parseJson(recipeJson);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.recipes)) {
    return parsed.recipes;
  }

  if (parsed && typeof parsed === 'object' && parsed.name) {
    return [parsed];
  }

  return [];
}

function normalizeRecipe(row, recipe, index) {
  const recipeId = text(recipe.id || recipe._id || recipe.recipeId) || `recipe_${row.id}_${index + 1}`;

  return {
    recipeId,
    name: text(recipe.name) || `未命名菜谱${index + 1}`,
    category: text(recipe.category) || null,
    coverUrl: text(recipe.coverUrl || recipe.cover) || row.cover_url || null,
    thumbnailUrl: text(recipe.thumbnailUrl || recipe.thumbnail || recipe.thumbUrl) || row.thumbnail_url || row.cover_url || null,
    difficulty: text(recipe.difficulty) || null,
    duration: text(recipe.duration) || null,
    favorite: bool(recipe.favorite, false),
    own: bool(recipe.own, true),
    stepsJson: JSON.stringify(Array.isArray(recipe.steps) ? recipe.steps : []),
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : []
  };
}

function normalizeIngredient(ingredient, index) {
  const name = text(ingredient && ingredient.name);

  if (!name) {
    return null;
  }

  return {
    name,
    amount: text(ingredient.amount) || null,
    isSeasoning: bool(ingredient.isSeasoning, false),
    sortOrder: Number.isInteger(ingredient.sortOrder) ? ingredient.sortOrder : index
  };
}

async function hasColumn(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );

  return Boolean(rows[0]);
}

async function hasTable(connection, tableName) {
  const [rows] = await connection.execute(
    `SELECT 1
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     LIMIT 1`,
    [tableName]
  );

  return Boolean(rows[0]);
}

async function hasIndex(connection, tableName, indexName) {
  const [rows] = await connection.execute(
    `SELECT 1
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?
     LIMIT 1`,
    [tableName, indexName]
  );

  return Boolean(rows[0]);
}

async function ensureRecipeThumbnailColumn(connection) {
  const recipeTableExists = await hasTable(connection, 'family_recipes');
  if (!recipeTableExists) {
    return;
  }

  const thumbnailColumnExists = await hasColumn(connection, 'family_recipes', 'thumbnail_url');
  if (!thumbnailColumnExists) {
    await connection.execute('ALTER TABLE family_recipes ADD COLUMN thumbnail_url VARCHAR(255) DEFAULT NULL AFTER cover_url');
    console.log('Added family_recipes.thumbnail_url.');
  }
}

async function createRecipeTables(connection) {
  await connection.execute(
    `CREATE TABLE IF NOT EXISTS family_recipes_new (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      family_code VARCHAR(100) NOT NULL,
      recipe_id VARCHAR(100) NOT NULL,
      name VARCHAR(100) NOT NULL,
      category VARCHAR(100) DEFAULT NULL,
      cover_url VARCHAR(255) DEFAULT NULL,
      thumbnail_url VARCHAR(255) DEFAULT NULL,
      difficulty VARCHAR(50) DEFAULT NULL,
      duration VARCHAR(50) DEFAULT NULL,
      favorite TINYINT(1) NOT NULL DEFAULT 0,
      own TINYINT(1) NOT NULL DEFAULT 1,
      steps_json LONGTEXT DEFAULT NULL,
      created_by VARCHAR(100) DEFAULT NULL,
      updated_by VARCHAR(100) DEFAULT NULL,
      version INT UNSIGNED NOT NULL DEFAULT 1,
      deleted_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_family_recipes_family_recipe (family_code, recipe_id),
      KEY idx_family_recipes_family_category (family_code, category),
      KEY idx_family_recipes_family_favorite (family_code, favorite),
      KEY idx_family_recipes_family_deleted (family_code, deleted_at)
    )`
  );

  await connection.execute(
    `CREATE TABLE IF NOT EXISTS family_recipe_ingredients (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      family_code VARCHAR(100) NOT NULL,
      recipe_id VARCHAR(100) NOT NULL,
      name VARCHAR(100) NOT NULL,
      amount VARCHAR(100) DEFAULT NULL,
      is_seasoning TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_family_recipe_ingredients_recipe_sort (family_code, recipe_id, sort_order),
      KEY idx_family_recipe_ingredients_recipe (family_code, recipe_id)
    )`
  );
}

async function migrateRecipes(connection) {
  const oldJsonExists = await hasColumn(connection, 'family_recipes', 'recipe_json');

  if (!oldJsonExists) {
    await ensureRecipeThumbnailColumn(connection);
    console.log('family_recipes is already field-based; skipped recipe migration.');
    return;
  }

  await connection.execute('DROP TABLE IF EXISTS family_recipes_new');
  await createRecipeTables(connection);

  const [rows] = await connection.execute(
    `SELECT id, family_code, recipe_json, cover_url, NULL AS thumbnail_url, created_at, updated_at
     FROM family_recipes
     ORDER BY id ASC`
  );
  let recipeCount = 0;
  let ingredientCount = 0;

  for (const row of rows) {
    const recipes = recipesFromJson(row.recipe_json);

    for (const [index, recipe] of recipes.entries()) {
      if (!recipe || typeof recipe !== 'object') {
        continue;
      }

      const normalized = normalizeRecipe(row, recipe, index);
      await connection.execute(
        `INSERT INTO family_recipes_new
          (family_code, recipe_id, name, category, cover_url, thumbnail_url, difficulty, duration, favorite, own, steps_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           category = VALUES(category),
           cover_url = VALUES(cover_url),
           thumbnail_url = VALUES(thumbnail_url),
           difficulty = VALUES(difficulty),
           duration = VALUES(duration),
           favorite = VALUES(favorite),
           own = VALUES(own),
           steps_json = VALUES(steps_json),
           updated_at = VALUES(updated_at)`,
        [
          row.family_code,
          normalized.recipeId,
          normalized.name,
          normalized.category,
          normalized.coverUrl,
          normalized.thumbnailUrl,
          normalized.difficulty,
          normalized.duration,
          normalized.favorite ? 1 : 0,
          normalized.own ? 1 : 0,
          normalized.stepsJson,
          row.created_at,
          row.updated_at
        ]
      );
      recipeCount += 1;

      for (const [ingredientIndex, ingredient] of normalized.ingredients.entries()) {
        const normalizedIngredient = normalizeIngredient(ingredient, ingredientIndex);

        if (!normalizedIngredient) {
          continue;
        }

        await connection.execute(
          `INSERT INTO family_recipe_ingredients
            (family_code, recipe_id, name, amount, is_seasoning, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             amount = VALUES(amount),
             is_seasoning = VALUES(is_seasoning),
             updated_at = CURRENT_TIMESTAMP`,
          [
            row.family_code,
            normalized.recipeId,
            normalizedIngredient.name,
            normalizedIngredient.amount,
            normalizedIngredient.isSeasoning ? 1 : 0,
            normalizedIngredient.sortOrder
          ]
        );
        ingredientCount += 1;
      }
    }
  }

  await connection.execute('RENAME TABLE family_recipes TO family_recipes_json_backup, family_recipes_new TO family_recipes');
  console.log(`Migrated ${recipeCount} recipes and ${ingredientCount} ingredients.`);
  console.log('Old JSON table kept as family_recipes_json_backup.');
}

async function migrateMembers(connection) {
  const relationTypeExists = await hasColumn(connection, 'family_members', 'relation_type');

  if (!relationTypeExists) {
    await connection.execute(
      `ALTER TABLE family_members
       ADD COLUMN relation_type VARCHAR(20) NOT NULL DEFAULT 'joined' AFTER role`
    );
  }

  if (await hasIndex(connection, 'family_members', 'uk_family_members_member_code')) {
    await connection.execute('ALTER TABLE family_members DROP INDEX uk_family_members_member_code');
  }

  if (!(await hasIndex(connection, 'family_members', 'uk_family_members_family_member'))) {
    await connection.execute(
      `ALTER TABLE family_members
       ADD UNIQUE KEY uk_family_members_family_member (family_code, member_code)`
    );
  }

  if (!(await hasIndex(connection, 'family_members', 'idx_family_members_device'))) {
    await connection.execute(
      `ALTER TABLE family_members
       ADD KEY idx_family_members_device (device_id)`
    );
  }
}

async function migrateRecipePoolTypes(connection) {
  if (!(await hasTable(connection, 'family_recipe_pool_items'))) {
    console.log('family_recipe_pool_items does not exist; skipped recipe pool type migration.');
    return;
  }

  if (!(await hasColumn(connection, 'family_recipe_pool_items', 'type'))) {
    await connection.execute(
      `ALTER TABLE family_recipe_pool_items
       ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT '做饭' AFTER name`
    );
  }

  await connection.execute(
    `UPDATE family_recipe_pool_items
     SET type = CASE
       WHEN type IN ('外卖', 'takeout') THEN '外卖'
       WHEN type IN ('堂食', 'dine_in') THEN '堂食'
       ELSE '做饭'
     END
     WHERE type IS NULL OR type = '' OR type NOT IN ('外卖', '堂食', '做饭')`
  );
}

async function main() {
  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    multipleStatements: false
  });

  try {
    await migrateRecipes(connection);
    await migrateMembers(connection);
    await migrateRecipePoolTypes(connection);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
