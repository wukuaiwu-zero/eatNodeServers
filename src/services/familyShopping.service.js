const { createFamilyItemCollectionService } = require('./familyItemCollection.service');

const base = createFamilyItemCollectionService({
  tableName: 'family_shopping_items',
  itemType: 'shopping'
});

function anchorService() {
  return require('./familyAnchorPrice.service');
}

async function withAnchorList(familyCode, items) {
  return anchorService().attachToShoppingItems(familyCode, items);
}

async function withAnchorItem(familyCode, item) {
  if (!item) {
    return item;
  }

  const [enriched] = await withAnchorList(familyCode, [item]);
  return enriched;
}

module.exports = {
  ...base,
  async upsertItemByDevice(deviceId, familyCode, itemJson) {
    const data = await base.upsertItemByDevice(deviceId, familyCode, itemJson);

    if (!data?.item) {
      return data;
    }

    data.item = await withAnchorItem(data.member.familyCode, data.item);
    return data;
  },
  async getItemByDevice(deviceId, itemId, options) {
    const data = await base.getItemByDevice(deviceId, itemId, options);

    if (!data?.item) {
      return data;
    }

    data.item = await withAnchorItem(data.member.familyCode, data.item);
    return data;
  },
  async listItemsByFamily(familyCode, options) {
    const items = await base.listItemsByFamily(familyCode, options);
    return withAnchorList(familyCode, items);
  },
  async listItemsByDevice(deviceId, options) {
    const data = await base.listItemsByDevice(deviceId, options);

    if (!data) {
      return data;
    }

    data.items = await withAnchorList(data.member.familyCode, data.items);
    return data;
  },
  async getChangesByDevice(deviceId, since, options) {
    const data = await base.getChangesByDevice(deviceId, since, options);

    if (!data) {
      return data;
    }

    data.items = await withAnchorList(data.familyCode, data.items);
    return data;
  },
  async deleteItemByDevice(deviceId, itemId, options) {
    const data = await base.deleteItemByDevice(deviceId, itemId, options);

    if (!data?.item) {
      return data;
    }

    data.item = await withAnchorItem(data.member.familyCode, data.item);
    return data;
  },
  async deleteItemsByDevice(deviceId, itemIds, options) {
    const data = await base.deleteItemsByDevice(deviceId, itemIds, options);

    if (!data) {
      return data;
    }

    data.items = await withAnchorList(data.member.familyCode, data.items);
    return data;
  },
  async clearPurchasedItemsByDevice(deviceId, options) {
    const data = await base.clearPurchasedItemsByDevice(deviceId, options);

    if (!data) {
      return data;
    }

    data.items = await withAnchorList(data.member.familyCode, data.items);
    return data;
  }
};
