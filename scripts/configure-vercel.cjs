// Run after Render assigns the backend URL:
// node scripts/configure-vercel.cjs https://YOUR-BACKEND.onrender.com
const fs = require('node:fs');
const path = require('node:path');
const backend = new URL(process.argv[2] || '');
if (backend.protocol !== 'https:' || backend.username || backend.password || backend.pathname !== '/' || backend.search || backend.hash) {
  throw new Error('Provide only the HTTPS backend origin, without credentials or a path.');
}
const dynamic = ['/api/:path*', '/auth/:path*', '/login', '/signup', '/logout', '/health'];
const config = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  framework: 'vite',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  rewrites: [
    ...dynamic.map(source => ({ source, destination: backend.origin + source })),
    { source: '/dashboard', destination: '/index.html' },
    { source: '/', destination: '/index.html' },
  ],
  headers: dynamic.map(source => ({ source, headers: [
    { key: 'Cache-Control', value: 'private, no-store' },
    { key: 'x-vercel-enable-rewrite-caching', value: '0' },
  ] })),
};
fs.writeFileSync(path.join(__dirname, '..', 'client', 'vercel.json'), JSON.stringify(config, null, 2) + '\n');
console.log('Vercel config written. Use client as the Vercel project root.');
