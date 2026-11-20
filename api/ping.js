export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse payload from body (POST) or query params (GET)
  let data = {};
  if (req.method === 'POST') {
    try {
      data = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    } catch {
      data = {};
    }
  } else {
    data = req.query || {};
  }

  const deviceId = data.device_id || req.query?.device_id || 'unknown';
  const version = data.app_version || req.query?.v || 'unknown';
  const build = data.app_build || req.query?.b || 'unknown';
  const os = data.macos_version || req.query?.os || 'unknown';
  const chip = data.chip || req.query?.chip || 'unknown';
  const model = data.device_model || req.query?.model || 'unknown';
  const isFirstLaunch = data.is_first_launch === true || req.query?.first === '1' || req.query?.first === 'true';
  const reason = data.reason || req.query?.reason || 'launch';

  // Geo & IP information from Vercel headers
  const country = req.headers['x-vercel-ip-country'] || 'unknown';
  const city = req.headers['x-vercel-ip-city'] || 'unknown';
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress) || 'unknown';

  // Log structured real-time analytics event visible in Vercel Dashboard -> Runtime Logs
  console.log('[Macwalls Ping]', JSON.stringify({
    timestamp: new Date().toISOString(),
    event: isFirstLaunch ? 'FIRST_LAUNCH' : 'APP_PING',
    reason,
    deviceId,
    version,
    build,
    os,
    chip,
    model,
    country,
    city,
    ip
  }));

  // Non-blocking counters via CounterAPI
  try {
    const promises = [];
    const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

    // 1. Total app pings (overall app launch & heartbeat activity)
    promises.push(
      fetch('https://counterapi.com/api/macwalls-app.vercel.app/up/app_pings').catch(() => {})
    );

    // 2. Unique installs count (if first launch)
    if (isFirstLaunch) {
      promises.push(
        fetch('https://counterapi.com/api/macwalls-app.vercel.app/up/unique_installs').catch(() => {})
      );
    }

    // 3. Daily Active Users counter (keyed by YYYYMMDD)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    promises.push(
      fetch(`https://counterapi.com/api/macwalls-app.vercel.app/up/dau_${today}`).catch(() => {})
    );

    // 4. Optional external Webhook (Discord / Slack / Telegram) if set in Vercel Env
    if (process.env.PING_WEBHOOK_URL) {
      const webhookPayload = {
        content: `🟢 **Macwalls App Ping** (${reason})\n• **User:** \`${deviceId.slice(0, 8)}...\`\n• **Version:** v${version} (Build ${build})\n• **System:** ${os} (${chip} - ${model})\n• **Location:** ${city}, ${country}\n• **First Launch:** ${isFirstLaunch ? '🎉 Yes' : 'No'}`
      };
      promises.push(
        fetch(process.env.PING_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload)
        }).catch(() => {})
      );
    }

    // Wait up to 1.5 seconds so serverless function does not exit before requests dispatch
    await Promise.race([
      Promise.allSettled(promises),
      timeout(1500)
    ]).catch(() => {});
  } catch (err) {
    // Non-blocking
  }

  return res.status(200).json({
    ok: true,
    timestamp: Date.now()
  });
}
