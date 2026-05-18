const baseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:3000';

async function request(path, options = {}) {
  const query = options.query ? `?${new URLSearchParams(options.query).toString()}` : '';
  const url = `${baseUrl}${path}${query}`;
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      ...(options.device
        ? {
            'X-Device-Id': options.device.deviceId,
            'X-Device-Secret': options.device.deviceSecret
          }
        : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();

  let body = text;
  try {
    body = JSON.parse(text);
  } catch (error) {
    // Keep non-JSON responses readable in the console.
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${url}: ${JSON.stringify(body)}`);
  }

  return {
    method: options.method || 'GET',
    url,
    status: response.status,
    ok: response.ok,
    body
  };
}

async function registerDevice() {
  const result = await request('/api/registerDevice', {
    method: 'POST',
    body: {}
  });

  return {
    deviceId: result.body.data.device.deviceId,
    deviceSecret: result.body.data.deviceSecret
  };
}

async function main() {
  const ownerDevice = await registerDevice();
  const memberDevice = await registerDevice();
  const results = [];

  const familyResult = await request('/api/createFamily', {
    method: 'POST',
    device: ownerDevice,
    body: {
      familyName: 'Demo 家庭'
    }
  });
  results.push(familyResult);

  const familyCode = familyResult.body.data.family.familyCode;
  const inviteCode = familyResult.body.data.invite.inviteCode;

  results.push(
    await request('/api/joinFamily', {
      method: 'POST',
      device: memberDevice,
      body: {
        inviteCode
      }
    })
  );

  results.push(
    await request('/api/saveFamilyRecipe', {
      method: 'POST',
      device: ownerDevice,
      body: {
        familyCode,
        recipeJson: {
          recipes: [
            {
              name: '番茄炒蛋'
            }
          ]
        }
      }
    })
  );

  results.push(
    await request('/api/saveFamilyShoppingItem', {
      method: 'POST',
      device: memberDevice,
      body: {
        familyCode,
        shoppingItemJson: {
          name: '番茄',
          num: '3个',
          category: '蔬菜',
          price: '6',
          done: false,
          id: `shop_${Date.now()}`
        }
      }
    })
  );

  results.push(
    await request('/api/saveFamilyIngredientCategory', {
      method: 'POST',
      device: ownerDevice,
      body: {
        familyCode,
        ingredientCategoryJson: {
          name: '冷冻',
          sortOrder: 60
        }
      }
    })
  );

  results.push(
    await request('/api/saveFamilyRecipeCategory', {
      method: 'POST',
      device: ownerDevice,
      body: {
        familyCode,
        recipeCategoryJson: {
          name: '快手菜',
          sortOrder: 60
        }
      }
    })
  );

  results.push(
    await request('/api/getFamilyData', {
      device: memberDevice
    })
  );

  for (const result of results) {
    console.log('\n--- API Demo ---');
    console.log(`${result.method} ${result.url}`);
    console.log(`Status: ${result.status}`);
    console.log('Response:');
    console.log(JSON.stringify(result.body, null, 2));
  }
}

main().catch((error) => {
  console.error('Demo request failed:');
  console.error(error.message);
  process.exit(1);
});
