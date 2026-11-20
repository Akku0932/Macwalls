export default async function handler(req, res) {
  // Fire-and-forget increment to counterapi
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    fetch('https://counterapi.com/api/macwalls-app.vercel.app/up/downloads', {
      signal: controller.signal
    }).catch(() => {}).finally(() => clearTimeout(timeout));
  } catch (err) {
    // Non-blocking
  }

  // Redirect to the actual DMG file
  res.writeHead(302, {
    Location: '/Macwalls.dmg',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end();
}
