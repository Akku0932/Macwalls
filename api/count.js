export default async function handler(req, res) {
  const BASELINE = 1480;
  let count = BASELINE;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const response = await fetch('https://counterapi.com/api/macwalls-app.vercel.app/get/downloads', {
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (response.ok) {
      const data = await response.json();
      if (typeof data.value === 'number') {
        count = BASELINE + data.value;
      }
    }
  } catch (err) {
    // Fall back to baseline
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=60');
  res.status(200).json({
    count: count,
    formatted: count.toLocaleString('en-US'),
    plus: count.toLocaleString('en-US') + '+'
  });
}
