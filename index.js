const http = require('http');
const sharp = require('sharp');
const PORT = process.env.PORT || 3000;

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCard(data) {
  const W = 1024;
  const plan = data.plan || 'free';
  const limits = data.limits || { daily_text: 5, daily_photo: 0, monthly_text: 150, monthly_photo: 0 };
  const dailyText = Number(data.dailyTextRequests) || 0;
  const monthlyText = Number(data.monthlyTextRequests) || 0;
  const dailyPhoto = Number(data.dailyPhotoRequests) || 0;
  const monthlyPhoto = Number(data.monthlyPhotoRequests) || 0;
  const extraText = Number(data.extraText) || 0;
  const extraPhoto = Number(data.extraPhoto) || 0;
  const responseSize = data.responseSize || 'short';
  const hasRenewalDiscount = Boolean(data.hasRenewalDiscount);
  const renewalDiscountPercent = Number(data.renewalDiscountPercent) || 0;

  const planLabel = { free: 'Free', start: 'Start', lite: 'Lite', pro: 'Pro', max: 'Max' };
  const responseSizeLabel = { short: 'Коротко', medium: 'Обычно', long: 'Подробно' };

  let endFormatted = '';
  if (
    data.subscriptionEnd &&
    data.subscriptionEnd !== '' &&
    data.subscriptionEnd !== 'null' &&
    data.subscriptionEnd !== 'undefined' &&
    plan !== 'free'
  ) {
    const d = new Date(data.subscriptionEnd);
    if (!isNaN(d.getTime())) {
      endFormatted = ` · до ${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
    }
  }

  const textDayBar  = limits.daily_text   > 0 ? Math.min((dailyText  / limits.daily_text)   * 760, 760) : 0;
  const textMonBar  = limits.monthly_text > 0 ? Math.min((monthlyText / limits.monthly_text) * 760, 760) : 0;
  const photoDayBar = limits.daily_photo  > 0 ? Math.min((dailyPhoto  / limits.daily_photo)  * 760, 760) : 0;

  const hasPhoto = limits.daily_photo > 0;
  const photoLine = hasPhoto
    ? `${dailyPhoto}/${limits.daily_photo} за день   ${monthlyPhoto}/${limits.monthly_photo} за месяц`
    : (extraPhoto > 0 ? `доп. генераций: ${extraPhoto}` : 'не входит в тариф');

  const hasExtra = extraText > 0 || extraPhoto > 0;
  const hasDiscount = hasRenewalDiscount && renewalDiscountPercent > 0;

  // Высота: базовая + доп блоки
  let H = 560;
  if (hasExtra) H += 110;
  if (hasDiscount) H += 50;

  const cardW = 920;
  const cardX = 52;

  // Y позиции блоков
  const titleY = 72;
  const divider1Y = titleY + 30;
  const block1Y = divider1Y + 20;
  const block2Y = block1Y + 130;
  let nextY = block2Y + 130;

  let extraBlock = '';
  if (hasExtra) {
    const bW = extraText > 0 && extraPhoto > 0 ? 440 : cardW;
    if (extraText > 0) {
      extraBlock += `
      <rect x="${cardX}" y="${nextY}" width="${bW}" height="90" rx="16" fill="#0F255E" fill-opacity="0.7"/>
      <text x="${cardX + 24}" y="${nextY + 32}" font-family="Arial, sans-serif" font-size="24" fill="#B6BFEA">Доп. текстовые запросы</text>
      <text x="${cardX + 24}" y="${nextY + 70}" font-family="Arial, sans-serif" font-size="44" font-weight="bold" fill="#ffffff">${extraText}</text>`;
    }
    if (extraPhoto > 0) {
      const x2 = extraText > 0 ? cardX + bW + 20 : cardX;
      const w2 = extraText > 0 ? cardW - bW - 20 : cardW;
      extraBlock += `
      <rect x="${x2}" y="${nextY}" width="${w2}" height="90" rx="16" fill="#0F255E" fill-opacity="0.7"/>
      <text x="${x2 + 24}" y="${nextY + 32}" font-family="Arial, sans-serif" font-size="24" fill="#B6BFEA">Доп. генераций изображений</text>
      <text x="${x2 + 24}" y="${nextY + 70}" font-family="Arial, sans-serif" font-size="44" font-weight="bold" fill="#ffffff">${extraPhoto}</text>`;
    }
    nextY += 110;
  }

  const divider2Y = nextY + 10;
  const modeY = divider2Y + 44;
  const discountY = hasDiscount ? modeY + 46 : 0;
  const badgeY = H - 70;

  const discountBlock = hasDiscount
    ? `<text x="512" y="${discountY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#FF9A3C">🔥 Автоскидка на продление: -${renewalDiscountPercent}%</text>`
    : '';

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#070A18"/>
    <stop offset="1" stop-color="#0B1A48"/>
  </linearGradient>
  <linearGradient id="wave" x1="0" y1="0" x2="${W}" y2="0" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#18D7FF" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#18D7FF" stop-opacity="0.18"/>
    <stop offset="1" stop-color="#B55CFF" stop-opacity="0"/>
  </linearGradient>
</defs>

<!-- Background -->
<rect width="${W}" height="${H}" fill="url(#bg)"/>

<!-- Decorative waves -->
<path d="M-80 ${H*0.72} C200 ${H*0.58} 420 ${H*0.88} 720 ${H*0.72} C1020 ${H*0.56} 1200 ${H*0.58} 1120 ${H*0.72}" stroke="url(#wave)" stroke-width="10" fill="none"/>
<path d="M-80 ${H*0.82} C220 ${H*0.68} 520 ${H*0.95} 820 ${H*0.82} C1120 ${H*0.66} 1260 ${H*0.64} 1120 ${H*0.8}" stroke="#B55CFF" stroke-opacity="0.1" stroke-width="8" fill="none"/>

<!-- Title -->
<text x="512" y="${titleY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="46" font-weight="bold" fill="#ffffff">${escapeXml(planLabel[plan] || plan)}${escapeXml(endFormatted)}</text>

<!-- Divider 1 -->
<line x1="${cardX}" y1="${divider1Y}" x2="${cardX + cardW}" y2="${divider1Y}" stroke="#B55CFF" stroke-opacity="0.25" stroke-width="1"/>

<!-- Block 1: Text requests -->
<rect x="${cardX}" y="${block1Y}" width="${cardW}" height="110" rx="16" fill="#0F255E" fill-opacity="0.65"/>
<circle cx="${cardX + 36}" cy="${block1Y + 38}" r="16" fill="#18D7FF" fill-opacity="0.15"/>
<circle cx="${cardX + 36}" cy="${block1Y + 38}" r="9" fill="#18D7FF"/>
<text x="${cardX + 64}" y="${block1Y + 28}" font-family="Arial, sans-serif" font-size="24" fill="#B6BFEA">Текстовые запросы</text>
<text x="${cardX + 64}" y="${block1Y + 62}" font-family="Arial, sans-serif" font-size="34" font-weight="bold" fill="#ffffff">${dailyText}/${limits.daily_text} за день   ${monthlyText}/${limits.monthly_text} за месяц</text>
<!-- Progress bar day -->
<rect x="${cardX + 64}" y="${block1Y + 76}" width="760" height="6" rx="3" fill="#ffffff" fill-opacity="0.08"/>
<rect x="${cardX + 64}" y="${block1Y + 76}" width="${textDayBar}" height="6" rx="3" fill="#18D7FF" fill-opacity="0.85"/>

<!-- Block 2: Photo requests -->
<rect x="${cardX}" y="${block2Y}" width="${cardW}" height="110" rx="16" fill="#0F255E" fill-opacity="0.65"/>
<circle cx="${cardX + 36}" cy="${block2Y + 38}" r="16" fill="#B55CFF" fill-opacity="0.15"/>
<circle cx="${cardX + 36}" cy="${block2Y + 38}" r="9" fill="#B55CFF"/>
<text x="${cardX + 64}" y="${block2Y + 28}" font-family="Arial, sans-serif" font-size="24" fill="#B6BFEA">Генерация изображений</text>
<text x="${cardX + 64}" y="${block2Y + 62}" font-family="Arial, sans-serif" font-size="34" font-weight="${hasPhoto ? 'bold' : 'normal'}" fill="#ffffff" opacity="${hasPhoto ? '1' : '0.4'}">${escapeXml(photoLine)}</text>
<!-- Progress bar photo -->
<rect x="${cardX + 64}" y="${block2Y + 76}" width="760" height="6" rx="3" fill="#ffffff" fill-opacity="0.08"/>
${photoDayBar > 0 ? `<rect x="${cardX + 64}" y="${block2Y + 76}" width="${photoDayBar}" height="6" rx="3" fill="#B55CFF" fill-opacity="0.85"/>` : ''}

${extraBlock}

<!-- Divider 2 -->
<line x1="${cardX}" y1="${divider2Y}" x2="${cardX + cardW}" y2="${divider2Y}" stroke="#B55CFF" stroke-opacity="0.25" stroke-width="1"/>

<!-- Mode -->
<text x="512" y="${modeY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#B6BFEA">Режим ответа: <tspan fill="#ffffff" font-weight="bold">${escapeXml(responseSizeLabel[responseSize] || 'Коротко')}</tspan></text>

${discountBlock}

<!-- Badge -->
<rect x="312" y="${badgeY}" width="400" height="48" rx="24" fill="#0F255E"/>
<text x="512" y="${badgeY + 31}" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#B6BFEA">FREE AI · @freee_ai_bot</text>
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
