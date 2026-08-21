// Production equivalent of vite.config.js's dev-only proxy for fetchPrizePackPrice
// (src/utils/api.js). Not part of the Scrydex migration — a separate prod-parity gap
// that surfaced once we're deploying for real.
export default async function handler(req, res) {
  try {
    const upstream = await fetch('https://mp-search-api.tcgplayer.com/v1/search/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
