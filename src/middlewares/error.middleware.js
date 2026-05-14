function notFoundHandler(req, res) {
  res.status(404).json({
    message: `接口不存在：${req.method} ${req.originalUrl}`
  });
}

function getFirstMatch(value, pattern) {
  const match = String(value || '').match(pattern);
  return match ? match[1] : '';
}

function getChineseErrorMessage(err) {
  if (!err) {
    return '服务器内部错误';
  }

  const rawMessage = err.sqlMessage || err.message || '';

  if (err instanceof SyntaxError || err.type === 'entity.parse.failed') {
    return '请求体格式错误，请确认提交的是合法 JSON';
  }

  if (err.type === 'entity.too.large') {
    return '请求体太大，请减少提交的数据量';
  }

  if (err.code === 'ER_NO_SUCH_TABLE') {
    const tableName = getFirstMatch(rawMessage, /Table '([^']+)' doesn't exist/);
    return tableName
      ? `数据库表不存在：${tableName}，请先初始化或升级数据库表结构`
      : '数据库表不存在，请先初始化或升级数据库表结构';
  }

  if (err.code === 'ER_BAD_FIELD_ERROR') {
    const columnName = getFirstMatch(rawMessage, /Unknown column '([^']+)'/);
    return columnName
      ? `数据库字段不存在：${columnName}，请先升级数据库表结构`
      : '数据库字段不存在，请先升级数据库表结构';
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return '这条数据已经存在，不能重复创建';
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return '关联数据不存在，请检查提交的数据是否有效';
  }

  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return '当前数据已被其他数据引用，不能直接删除';
  }

  if (err.code === 'ER_PARSE_ERROR') {
    return '服务端数据库语句执行失败，请检查接口实现';
  }

  if (err.code === 'ER_BAD_DB_ERROR') {
    return '数据库不存在，请先创建或初始化数据库';
  }

  if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    return '数据库账号或密码错误，请检查数据库配置';
  }

  if (err.code === 'ECONNREFUSED') {
    return '数据库连接失败，请检查数据库服务是否启动';
  }

  if (/Unknown column '([^']+)'/.test(rawMessage)) {
    const columnName = getFirstMatch(rawMessage, /Unknown column '([^']+)'/);
    return `数据库字段不存在：${columnName}，请先升级数据库表结构`;
  }

  if (/Table '([^']+)' doesn't exist/.test(rawMessage)) {
    const tableName = getFirstMatch(rawMessage, /Table '([^']+)' doesn't exist/);
    return `数据库表不存在：${tableName}，请先初始化或升级数据库表结构`;
  }

  return err.message || '服务器内部错误';
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const message = statusCode >= 500 && !err.code
    ? '服务器内部错误'
    : getChineseErrorMessage(err);

  res.status(statusCode).json({
    message
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
