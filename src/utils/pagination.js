const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function toPositiveInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : null;
}

function getPagination(req) {
  const page = toPositiveInteger(req.query?.page);
  const pageSize = toPositiveInteger(req.query?.pageSize || req.query?.page_size);
  const limit = toPositiveInteger(req.query?.limit);
  const offset = Number(req.query?.offset);

  if (!page && !pageSize && !limit && !Number.isFinite(offset)) {
    return null;
  }

  const size = Math.min(pageSize || limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const safeOffset = Number.isFinite(offset) && offset >= 0 ? Math.trunc(offset) : null;
  const currentPage = page || (safeOffset !== null ? Math.floor(safeOffset / size) + 1 : 1);

  return {
    page: currentPage,
    pageSize: size,
    offset: safeOffset !== null ? safeOffset : (currentPage - 1) * size
  };
}

function paginateItems(items, pagination) {
  const list = Array.isArray(items) ? items : [];

  if (!pagination) {
    return {
      items: list,
      pagination: null
    };
  }

  return {
    items: list.slice(pagination.offset, pagination.offset + pagination.pageSize),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: list.length,
      totalPages: Math.ceil(list.length / pagination.pageSize)
    }
  };
}

function paginateDataList(req, data, key) {
  const pagination = getPagination(req);
  const { items, pagination: paginationMeta } = paginateItems(data?.[key], pagination);

  if (!paginationMeta) {
    return data;
  }

  return {
    ...data,
    [key]: items,
    pagination: paginationMeta
  };
}

module.exports = {
  getPagination,
  paginateItems,
  paginateDataList
};
