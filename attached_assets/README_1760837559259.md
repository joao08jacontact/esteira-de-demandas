# Esteira de Demandas (React + Vite + Tailwind)

## Rodar local
```bash
npm i
npm run dev
```

## Build
```bash
npm run build
# saída em dist/
```

## Deploy: Vercel / Netlify / Cloudflare Pages
- Build: `npm run build`
- Output: `dist/`
- Para Netlify (SPA), já existe `public/_redirects` com `/*  /index.html  200`.

## Deploy: GitHub Pages (com Actions)
1. Crie o repositório no GitHub e faça push do código.
2. A Action em `.github/workflows/deploy.yml` constrói e publica.
