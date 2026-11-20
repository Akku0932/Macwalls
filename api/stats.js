export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=20');

  const BASELINE_DOWNLOADS = 1480;
  let downloads = BASELINE_DOWNLOADS;
  let pings = 0;
  let uniqueInstalls = 0;
  let dau = 0;

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  try {
    const [dlRes, pingRes, installRes, dauRes] = await Promise.allSettled([
      fetch('https://counterapi.com/api/macwalls-app.vercel.app/get/downloads').then(r => r.json()),
      fetch('https://counterapi.com/api/macwalls-app.vercel.app/get/app_pings').then(r => r.json()),
      fetch('https://counterapi.com/api/macwalls-app.vercel.app/get/unique_installs').then(r => r.json()),
      fetch(`https://counterapi.com/api/macwalls-app.vercel.app/get/dau_${today}`).then(r => r.json())
    ]);

    if (dlRes.status === 'fulfilled' && typeof dlRes.value?.value === 'number') {
      downloads = BASELINE_DOWNLOADS + dlRes.value.value;
    }
    if (pingRes.status === 'fulfilled' && typeof pingRes.value?.value === 'number') {
      pings = pingRes.value.value;
    }
    if (installRes.status === 'fulfilled' && typeof installRes.value?.value === 'number') {
      uniqueInstalls = installRes.value.value;
    }
    if (dauRes.status === 'fulfilled' && typeof dauRes.value?.value === 'number') {
      dau = dauRes.value.value;
    }
  } catch {
    // Non-blocking fallback
  }

  return res.status(200).json({
    status: 'ok',
    date: new Date().toISOString().slice(0, 10),
    metrics: {
      totalDownloads: downloads,
      totalAppPings: pings,
      uniqueInstalls: uniqueInstalls,
      activeUsersToday: dau
    }
  });
}
