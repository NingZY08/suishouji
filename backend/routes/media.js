const express = require('express');
const https = require('https');
const { r2Config, r2HttpsAgent } = require('../config/r2');

const router = express.Router();

// 仅允许代理到已配置的 R2 公共域名，防止 SSRF
const resolveTarget = (raw) => {
  if (!raw) return null;
  let candidate = String(raw);
  if (candidate.startsWith('/')) {
    candidate = `https://${r2Config.domain}${candidate}`;
  }
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch (e) {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (parsed.hostname !== r2Config.domain) return null;
  return parsed;
};

// GET /api/media?url=https://<R2_DOMAIN>/uploads/xxx.png
router.get('/', (req, res) => {
  const target = resolveTarget(req.query.url || req.query.u);
  if (!target) {
    return res.status(400).json({ message: '无效的媒体地址' });
  }

  const upstream = https.request(
    {
      host: target.hostname,
      port: target.port || 443,
      path: target.pathname + target.search,
      method: 'GET',
      agent: r2HttpsAgent,
      timeout: 20000,
      headers: { 'User-Agent': 'suishouji-media-proxy/1.0' },
    },
    (upstreamRes) => {
      if (upstreamRes.statusCode >= 400) {
        res.status(upstreamRes.statusCode).end();
        upstreamRes.resume();
        return;
      }
      res.set('Content-Type', upstreamRes.headers['content-type'] || 'application/octet-stream');
      if (upstreamRes.headers['content-length']) {
        res.set('Content-Length', upstreamRes.headers['content-length']);
      }
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      upstreamRes.pipe(res);
    }
  );

  upstream.on('timeout', () => upstream.destroy(new Error('upstream timeout')));
  upstream.on('error', (err) => {
    if (res.headersSent) {
      res.end();
    } else {
      res.status(502).json({ message: '媒体获取失败', detail: err.message });
    }
  });
  upstream.end();
});

module.exports = router;
