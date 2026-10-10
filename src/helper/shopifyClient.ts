require('dotenv').config();

const BASE_URL = `https://${process.env.SHOP_NAME}.myshopify.com/admin/api/${process.env.API_VERSION}`;

async function shopifyFetch(path:string, options:RequestInit = {}):Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN as string,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Shopify API error ${res.status}: ${errorBody}`);
  }

  return res.json();
}

const GRAPHQL_URL = `https://${process.env.SHOP_NAME}.myshopify.com/admin/api/${process.env.API_VERSION}/graphql.json`;
async function shopifyGraphQL(query: string, variables:Record<string,any> = {}): Promise<any> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN as string,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}
module.exports = { shopifyFetch,shopifyGraphQL };