// A portable HTTP boundary shared by hosted Worker tests and production.
export function createWorkerHandler({ assets, QlooClient, AppError }) {
  let client, configuredKey, active = 0;
  const recent = new Map();
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
  const json = (data, status = 200) => Response.json(data, { status, headers });
  return async function handle(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/status' && request.method === 'GET') return json({ qlooConfigured: !!env.QLOO_API_KEY, modelConnected: false });
      if (url.pathname === '/api/negotiate' && request.method === 'POST') {
        if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) return json({ error: 'Request origin does not match.' }, 403);
        if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') return json({ error: 'Use application/json.' }, 415);
        if (Number(request.headers.get('content-length')) > 16384) return json({ error: 'Request too large.' }, 413);
        // Bound streamed bodies too; content-length is not trusted.
        const reader = request.body?.getReader();
        const chunks = []; let size = 0;
        if (reader) {
          try {
            while (true) {
              const { done, value } = await reader.read(); if (done) break;
              size += value.byteLength;
              if (size > 16384) { await reader.cancel(); return json({ error: 'Request too large.' }, 413); }
              chunks.push(value);
            }
          } finally { reader.releaseLock(); }
        }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        let state;
        try { state = JSON.parse(new TextDecoder().decode(bytes)); } catch { return json({ error: 'Send valid JSON.' }, 400); }
        if (active >= 1) return json({ error: 'A negotiation is in progress. Please retry shortly.' }, 429);
        const ip = request.headers.get('cf-connecting-ip');
        if (ip && (recent.get(ip) || 0) > Date.now() - 10000) return json({ error: 'Please wait 10 seconds between negotiations.' }, 429);
        if (ip) {
          if (recent.size > 256) recent.delete(recent.keys().next().value);
          recent.set(ip, Date.now());
        }
        if (!client || configuredKey !== env.QLOO_API_KEY) {
          configuredKey = env.QLOO_API_KEY;
          client = new QlooClient({ apiKey: env.QLOO_API_KEY });
        }
        active++;
        try { return json(await client.negotiate(state)); } finally { active--; }
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'Method not allowed.' }, 405);
      const asset = Object.hasOwn(assets, url.pathname) ? assets[url.pathname] : null;
      if (!asset) return json({ error: 'Not found.' }, 404);
      return new Response(request.method === 'HEAD' ? null : asset.body, { headers: { ...headers, 'Content-Type': asset.type } });
    } catch (error) {
      return json({ error: error instanceof AppError ? error.message : 'The server could not complete this request.' }, error instanceof AppError ? error.status : 500);
    }
  };
}
