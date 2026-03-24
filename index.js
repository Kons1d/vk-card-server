const http = require('http');
const sharp = require('sharp');
const PORT = process.env.PORT || 3000;

const PLAN_COLORS = {
  free:  '#6c757d',
  start: '#28a745',
  lite:  '#17a2b8',
  pro:   '#fd7e14',
  max:   '#6f42c1'
};

const PLAN_NAMES = {
  free:  'Free',
  start: 'Start',
  lite:  'Lite',
  pro:   'Pro',
  max:   'Max'
};

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCard(data) {
  const W = 600, H = 420;
  const plan = data.plan || 'free';
  const accent = PLAN_COLORS[plan] || '#6c757d';
  const planName = PLAN_NAMES[plan] || plan;
  const limits = data.limits || { daily_text: 5, daily_photo: 0, monthly_text: 150, monthly_photo: 0 };

  let dateStr = '';
  if (data.subscriptionEnd && plan !== 'free') {
    const d = new Date(data.subscriptionEnd);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    dateStr = `do ${dd}.${mm}.${d.getFullYear()}`;
  }

  const sizeMap = { short: 'Korotko', medium: 'Obychno', long: 'Podrobno' };
  const sizeName = sizeMap[data.responseSize] || 'Korotko';

  const stats = [];

  const dayTextRatio = limits.daily_text > 0 ? Math.min((data.dailyTextRequests || 0) / limits.daily_text, 1) : 0;
  stats.push({ label: 'Soobshhenij segodnja', used: data.dailyTextRequests || 0, total: limits.daily_text, ratio: dayTextRatio, type: 'bar' });

  const monTextRatio = limits.monthly_text > 0 ? Math.min((data.monthlyTextRequests || 0) / limits.monthly_text, 1) : 0;
  stats.push({ label: 'Soobshhenij v mesjace', used: data.monthlyTextRequests || 0, total: limits.monthly_text, ratio: monTextRatio, type: 'bar' });

  if (limits.daily_photo > 0) {
    const photoRatio = Math.min((data.dailyPhotoRequests || 0) / limits.daily_photo, 1);
    stats.push({ label: 'Izobrazhenij segodnja', used: data.dailyPhotoRequests || 0, total: limits.daily_photo, ratio: photoRatio, type: 'bar' });
  } else {
    const ep = data.extraPhoto || 0;
    stats.push({ label: 'Generacija izobrazhenij', text: ep > 0 ? `Ne v tarife, dop: ${ep} sht.` : 'Ne vkhodit v tarif', type: 'text' });
  }

  if ((data.extraText || 0) > 0) {
    stats.push({ label: 'Dop. soobshhenij', text: `${data.extraText} sht.`, type: 'text' });
  }

  const startY = 130;
  const rowH = 56;
  let statsSvg = '';

  stats.forEach((item, i) => {
    const y = startY + i * rowH;
    const bgRect = i % 2 === 0 ? `<rect x="0" y="${y}" width="${W}" height="${rowH - 4}" fill="white" fill-opacity="0.03"/>` : '';
    const labelEl = `<text x="30" y="${y + 18}" fill="#ced4da" font-size="14" font-family="Arial, sans-serif">${escapeXml(item.label)}</text>`;

    if (item.type === 'bar') {
      const barY = y + 26;
      const barW = 540;
      const barH2 = 14;
      const fillW = Math.round(barW * item.ratio);
      const barColor = item.ratio > 0.85 ? '#e74c3c' : item.ratio > 0.6 ? '#f39c12' : accent;
      const counter = `${item.used} / ${item.total}`;
      statsSvg += bgRect + labelEl + `
        <rect x="30" y="${barY}" width="${barW}" height="${barH2}" rx="7" fill="#2d3748"/>
        ${fillW > 0 ? `<rect x="30" y="${barY}" width="${fillW}" height="${barH2}" rx="7" fill="${barColor}"/>` : ''}
        <text x="${30 + barW}" y="${y + 18}" fill="white" font-size="12" font-family="Arial, sans-serif" text-anchor="end" font-weight="bold">${escapeXml(counter)}</text>
      `;
    } else {
      statsSvg += bgRect + labelEl + `<text x="30" y="${y + 38}" fill="#868e96" font-size="13" font-family="Arial, sans-serif">${escapeXml(item.text)}</text>`;
    }
  });

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#16213e"/>
        <stop offset="100%" stop-color="#0f3460"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect x="0" y="0" width="${W}" height="6" fill="${accent}"/>
    <circle cx="${W - 60}" cy="60" r="80" fill="${accent}" fill-opacity="0.08"/>
    <text x="30" y="48" fill="white" font-size="20" font-weight="bold" font-family="Arial, sans-serif">AI Link | ChatGPT | Nejroset</text>
    <rect x="30" y="62" width="160" height="34" rx="8" fill="${accent}"/>
    <text x="44" y="85" fill="white" font-size="16" font-weight="bold" font-family="Arial, sans-serif">Tarif: ${escapeXml(planName)}</text>
    ${dateStr ? `<text x="200" y="85" fill="#adb5bd" font-size="13" font-family="Arial, sans-serif">${escapeXml(dateStr)}</text>` : ''}
    <line x1="30" y1="110" x2="570" y2="110" stroke="${accent}" stroke-opacity="0.4" stroke-width="1"/>
    ${statsSvg}
    <text x="30" y="${H - 16}" fill="#adb5bd" font-size="13" font-family="Arial, sans-serif">Rezhim otveta: ${escapeXml(sizeName)}</text>
    <text x="${W - 20}" y="${H - 16}" fill="${accent}" fill-opacity="0.7" font-size="12" font-weight="bold" font-family="Arial, sans-serif" text-anchor="end">vk.com/ailink_bot</text>
  </svg>`;
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/card') {
    res.writeHead(404); return res.end('Not found');
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const svg = buildCard(data);
      sharp(Buffer.from(svg))
        .png()
        .toBuffer()
        .then(png => {
          res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length });
          res.end(png);
        })
        .catch(e => {
          console.error('sharp error:', e);
          res.writeHead(500);
          res.end('Error: ' + e.message);
        });
    } catch (e) {
      console.error('parse error:', e);
      res.writeHead(500);
      res.end('Error: ' + e.message);
    }
  });
});

server.listen(PORT, () => console.log(`Card server running on port ${PORT}`));
