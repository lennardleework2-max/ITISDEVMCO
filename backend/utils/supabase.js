const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

// Generic fetch wrapper for Supabase REST API
async function supabaseRequest(endpoint, options = {}) {
  const url = `${SUPABASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${errorText}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// SELECT query
async function select(table, query = '') {
  return supabaseRequest(`/${table}${query ? '?' + query : ''}`);
}

// INSERT
async function insert(table, data) {
  return supabaseRequest(`/${table}`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// UPDATE
async function update(table, query, data) {
  return supabaseRequest(`/${table}?${query}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

// DELETE
async function remove(table, query) {
  return supabaseRequest(`/${table}?${query}`, {
    method: 'DELETE'
  });
}

// UPSERT
async function upsert(table, data, onConflict) {
  return supabaseRequest(`/${table}`, {
    method: 'POST',
    headers: {
      'Prefer': 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(data)
  });
}

module.exports = {
  select,
  insert,
  update,
  remove,
  upsert,
  supabaseRequest
};
