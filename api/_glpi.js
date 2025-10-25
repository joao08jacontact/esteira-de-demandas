// api/_glpi.js

const BASE = process.env.GLPI_API_URL;
const APP  = process.env.GLPI_APP_TOKEN;
const USER = process.env.GLPI_USER_TOKEN;

export async function glpiFetch(path, init = {}) {
  if (!BASE || !APP || !USER) {
    throw new Error('GLPI env vars ausentes (GLPI_API_URL, GLPI_APP_TOKEN, GLPI_USER_TOKEN)');
  }

  // 1) abre sessão
  const initResp = await fetch(`${BASE}/initSession`, {
    method: 'GET',
    headers: { 'App-Token': APP, 'Authorization': `user_token ${USER}` },
  });
  if (!initResp.ok) throw new Error(`initSession falhou: ${initResp.status}`);
  const { session_token } = await initResp.json();

  // 2) chamada real
  const headers = {
    'App-Token': APP,
    'Session-Token': session_token,
    'Content-Type': 'application/json',
  };
  if (init.headers) {
    for (const [k, v] of Object.entries(init.headers)) {
      headers[k] = v;
    }
  }

  const resp = await fetch(`${BASE}${path}`, { ...init, headers });

  // 3) encerra sessão (best-effort)
  fetch(`${BASE}/killSession`, {
    method: 'GET',
    headers: { 'App-Token': APP, 'Session-Token': session_token },
  }).catch(() => {});

  return resp;
}

export function getRange(page = 1, limit = 20) {
  const start = (page - 1) * limit;
  const end   = start + limit - 1;
  return `${start}-${end}`;
}
