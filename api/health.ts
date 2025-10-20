// api/health.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const ok =
    !!process.env.GLPI_API_URL &&
    !!process.env.GLPI_APP_TOKEN &&
    !!process.env.GLPI_USER_TOKEN;
  res.status(ok ? 200 : 500).json({
    ok,
    has: {
      GLPI_API_URL: !!process.env.GLPI_API_URL,
      GLPI_APP_TOKEN: !!process.env.GLPI_APP_TOKEN,
      GLPI_USER_TOKEN: !!process.env.GLPI_USER_TOKEN,
    },
  });
}
