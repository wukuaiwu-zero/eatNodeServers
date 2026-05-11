const baseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:3000';

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.body
      ? {
          'Content-Type': 'application/json'
        }
      : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();

  let body = text;
  try {
    body = JSON.parse(text);
  } catch (error) {
    // Keep non-JSON responses readable in the console.
  }

  return {
    method: options.method || 'GET',
    url,
    status: response.status,
    ok: response.ok,
    body
  };
}

async function main() {
  const familyCode = `DEMO_${Date.now()}`;
  const memberCode = `MEMBER_${Date.now()}`;
  const results = [];

  results.push(
    await request('/api/families', {
      method: 'POST',
      body: {
        familyCode,
        familyName: 'Demo 家庭'
      }
    })
  );

  results.push(
    await request('/api/family-recipes/upload', {
      method: 'POST',
      body: {
        memberCode,
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
