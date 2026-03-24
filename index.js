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
  const dailyText = data.dailyTextRequests || 0;
  const monthlyText = data.monthlyTextRequests || 0;
  const dailyPhoto = data.dailyPhotoRequests || 0;
  const monthlyPhoto = data.monthlyPhotoRequests || 0;
  const extraText = data.extraText || 0;
  const extraPhoto = data.extraPhoto || 0;
  const responseSize = data.responseSize || 'short';

  const planLabel = { free: 'Free', start: 'Start', lite: 'Lite', pro: 'Pro', max: 'Max' };
  const responseSizeLabel = { short: 'Коротко', medium: 'Обычно', long: 'Подробно' };

  let endFormatted = '';
  if (data.subscriptionEnd && plan !== 'free') {
    const d = new Date(data.subscriptionEnd);
    endFormatted = ` · до ${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
  }

  const textDayBar = limits.daily_text > 0 ? Math.min((dailyText / limits.daily_text) * 660, 660) : 0;
  const photoDayBar = limits.daily_photo > 0 ? Math.min((dailyPhoto / limits.daily_photo) * 660, 660) : 0;

  const photoLine = limits.daily_photo > 0
    ? `${dailyPhoto}/${limits.daily_photo} за день   ${monthlyPhoto}/${limits.monthly_photo} за месяц`
    : (extraPhoto > 0 ? `доп. генераций: ${extraPhoto}` : 'не входит в тариф');
  const photoOpacity = limits.daily_photo > 0 ? '1' : '0.45';

  const hasExtra = extraText > 0 || extraPhoto > 0;
  const svgH = hasExtra ? 540 : 430;
  const lineY = hasExtra ? 406 : 296;
  const modeY = hasExtra ? 434 : 320;
  const badgeY = svgH - 55;

  let extraBlock = '';
  if (extraText > 0) {
    const w = extraPhoto > 0 ? 395 : 830;
    extraBlock += `<rect x="80" y="306" width="${w}" height="74" rx="12" fill="#0F255E" fill-opacity="0.55"/>
    <text x="118" y="337" font-family="Arial, sans-serif" font-size="22" fill="#B6BFEA">Доп. текстовые запросы</text>
    <text x="118" y="368" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#ffffff">${extraText}</text>`;
  }
  if (extraPhoto > 0) {
    const x = extraText > 0 ? 509 : 80;
    const w = extraText > 0 ? 435 : 830;
    extraBlock += `<rect x="${x}" y="306" width="${w}" height="74" rx="12" fill="#0F255E" fill-opacity="0.55"/>
    <text x="${x+38}" y="337" font-family="Arial, sans-serif" font-size="22" fill="#B6BFEA">Доп. генерации изображений</text>
    <text x="${x+38}" y="368" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#ffffff">${extraPhoto}</text>`;
  }

  return `<svg viewBox="0 0 ${W} ${svgH}" width="${W}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="${W}" y2="${svgH}" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#070A18"/><stop offset="1" stop-color="#0B1A48"/>
</linearGradient>
</defs>
<rect width="${W}" height="${svgH}" fill="url(#bg)"/>
<path d="M-80 ${svgH*0.75} C200 ${svgH*0.6} 420 ${svgH*0.9} 720 ${svgH*0.75} S1240 ${svgH*0.6} 1120 ${svgH*0.75}" stroke="#18D7FF" stroke-opacity="0.07" stroke-width="10" fill="none"/>

<text x="512" y="56" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#ffffff">${escapeXml(planLabel[plan] || plan)}${escapeXml(endFormatted)}</text>
<line x1="80" y1="74" x2="944" y2="74" stroke="#B55CFF" stroke-opacity="0.2" stroke-width="1"/>

<rect x="80" y="96" width="830" height="82" rx="12" fill="#0F255E" fill-opacity="0.55"/>
<circle cx="118" cy="137" r="14" fill="#18D7FF" fill-opacity="0.16"/>
<circle cx="118" cy="137" r="8" fill="#18D7FF"/>
<text x="144" y="128" font-family="Arial, sans-serif" font-size="22" fill="#B6BFEA">Текстовые запросы</text>
<text x="144" y="158" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#ffffff">${dailyText}/${limits.daily_text} за день   ${monthlyText}/${limits.monthly_text} за месяц</text>
<rect x="144" y="166" width="660" height="5" rx="2" fill="#ffffff" fill-opacity="0.08"/>
<rect x="144" y="166" width="${textDayBar}" height="5" rx="2" fill="#18D7FF" fill-opacity="0.75"/>

<rect x="80" y="192" width="830" height="82" rx="12" fill="#0F255E" fill-opacity="0.55"/>
<circle cx="118" cy="233" r="14" fill="#B55CFF" fill-opacity="0.16"/>
<circle cx="118" cy="233" r="8" fill="#B55CFF"/>
<text x="144" y="224" font-family="Arial, sans-serif" font-size="22" fill="#B6BFEA">Генерация изображений</text>
<text x="144" y="254" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#ffffff" opacity="${photoOpacity}">${escapeXml(photoLine)}</text>
<rect x="144" y="262" width="660" height="5" rx="2" fill="#ffffff" fill-opacity="0.08"/>
<rect x="144" y="262" width="${photoDayBar}" height="5" rx="2" fill="#B55CFF" fill-opacity="0.75"/>

${extraBlock}

<line x1="80" y1="${lineY}" x2="944" y2="${lineY}" stroke="#B55CFF" stroke-opacity="0.2" stroke-width="1"/>
<text x="512" y="${modeY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#B6BFEA">Режим ответа: <tspan fill="#ffffff">${escapeXml(responseSizeLabel[responseSize] || 'Коротко')}</tspan></text>

<rect x="312" y="${badgeY}" width="400" height="38" rx="19" fill="#0F255E"/>
<text x="512" y="${badgeY + 25}" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#B6BFEA">FREE AI · @freee_ai_bot</text>
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
