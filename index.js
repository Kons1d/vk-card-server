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

// Plan name SVG paths (exact from cart.svg) - each plan has its own wordmark path
// These are the letter paths for the plan name displayed at top
const PLAN_WORDMARKS = {
  // Max - from original cart.svg
  max: `M412.781 71.1818H436.372L452.599 110.727H453.418L469.645 71.1818H493.236V141H474.69V100.636H474.145L458.599 140.455H447.418L431.872 100.364H431.327V141H412.781V71.1818ZM517.082 141.818C513.741 141.818 510.787 141.273 508.219 140.182C505.673 139.068 503.673 137.386 502.219 135.136C500.764 132.886 500.037 130.023 500.037 126.545C500.037 123.682 500.526 121.239 501.503 119.216C502.48 117.17 503.844 115.5 505.594 114.205C507.344 112.909 509.378 111.92 511.696 111.239C514.037 110.557 516.56 110.114 519.264 109.909C522.196 109.682 524.548 109.409 526.321 109.091C528.116 108.75 529.412 108.284 530.207 107.693C531.003 107.08 531.401 106.273 531.401 105.273V105.136C531.401 103.773 530.878 102.727 529.832 102C528.787 101.273 527.446 100.909 525.81 100.909C524.014 100.909 522.548 101.307 521.412 102.102C520.298 102.875 519.628 104.068 519.401 105.682H502.082C502.31 102.5 503.321 99.5682 505.116 96.8864C506.935 94.1818 509.582 92.0227 513.06 90.4091C516.537 88.7727 520.878 87.9545 526.082 87.9545C529.832 87.9545 533.196 88.3977 536.173 89.2841C539.151 90.1477 541.685 91.3636 543.776 92.9318C545.866 94.4773 547.457 96.2955 548.548 98.3864C549.662 100.455 550.219 102.705 550.219 105.136V141H532.628V133.636H532.219C531.173 135.591 529.901 137.17 528.401 138.375C526.923 139.58 525.23 140.455 523.321 141C521.435 141.545 519.355 141.818 517.082 141.818ZM523.219 129.955C524.651 129.955 525.991 129.659 527.241 129.068C528.514 128.477 529.548 127.625 530.344 126.511C531.139 125.398 531.537 124.045 531.537 122.455V118.091C531.037 118.295 530.503 118.489 529.935 118.67C529.389 118.852 528.798 119.023 528.162 119.182C527.548 119.341 526.889 119.489 526.185 119.625C525.503 119.761 524.787 119.886 524.037 120C522.582 120.227 521.389 120.602 520.457 121.125C519.548 121.625 518.866 122.25 518.412 123C517.98 123.727 517.764 124.545 517.764 125.455C517.764 126.909 518.276 128.023 519.298 128.795C520.321 129.568 521.628 129.955 523.219 129.955ZM575.438 88.6364L583.074 104.864L591.119 88.6364H609.801L595.756 114.818L610.483 141H591.938L583.074 124.364L574.483 141H555.665L570.528 114.818L556.619 88.6364H575.438Z`,
};

// Subtitle paths by plan (small text below the wordmark)
// From cart.svg, the subtitle "Максимум возможностей и приоритет" is rendered as SVG path
// We'll use font-based text for other plans since we only have the path for Max
const PLAN_SUBTITLES = {
  free:  'Бесплатный доступ к боту',
  start: 'Стартовый тариф',
  lite:  'Оптимальный выбор',
  pro:   'Профессиональный тариф',
  max:   'Максимум возможностей и приоритет',
};

const PLAN_LABEL = { free: 'Free', start: 'Start', lite: 'Lite', pro: 'Pro', max: 'Max' };
const RESPONSE_LABEL = { short: 'Коротко', medium: 'Обычно', long: 'Подробно' };

// Bar coordinates (exact from cart.svg)
const BAR_X0 = 172.905;   // left edge of bar (matches pill path)
const BAR_X1 = 903.095;   // right edge
const BAR_W  = BAR_X1 - BAR_X0; // 730.19

function barFillX(value, limit) {
  if (!limit || limit <= 0) return BAR_X0;
  const pct = Math.min(value / limit, 1);
  return BAR_X0 + pct * BAR_W;
}

// Generate bar fill path (pill shape, same as in original)
// Original uses: M{fillEnd} 349H172.905C171.301 349 170 347.657 170 346C...{fillEnd}Z
// We replicate this pattern for any fill position and any Y
function pillBarBg(y) {
  const y1 = y + 3, y2 = y - 3; // y=346 for top bar, 502 for bottom
  // Original bg path for bar1: M903.095 349H172.905C171.301 349 170 347.657 170 346 C170 344.343 171.301 343 172.905 343H903.095C904.699 343 906 344.343 906 346C906 347.657 904.699 349 903.095 349Z
  // The bar sits at y-3 to y+3 (total height 6px), center at y
  const top = y + 3, bot = y - 3;
  return `M${BAR_X1} ${top}H${BAR_X0}C171.301 ${top} 170 ${y}.657 170 ${y}C170 ${y-0.657} 171.301 ${bot} ${BAR_X0} ${bot}H${BAR_X1}C${BAR_X1+1.604} ${bot} ${BAR_X1+3} ${y-0.343} ${BAR_X1+3} ${y}C${BAR_X1+3} ${y+0.657} ${BAR_X1+1.604} ${top} ${BAR_X1} ${top}Z`;
}

function pillBarFill(fillEndX, y) {
  if (fillEndX <= BAR_X0 + 1) return '';
  const top = y + 3, bot = y - 3;
  return `M${fillEndX} ${top}H${BAR_X0}C171.301 ${top} 170 ${y+0.657} 170 ${y}C170 ${y-0.657} 171.301 ${bot} ${BAR_X0} ${bot}H${fillEndX}C${fillEndX+1.604} ${bot} ${fillEndX+3} ${y-0.343} ${fillEndX+3} ${y}C${fillEndX+3} ${y+0.657} ${fillEndX+1.604} ${top} ${fillEndX} ${top}Z`;
}

function buildCard(data) {
  const plan           = (data.plan || 'free').toLowerCase();
  const limits         = data.limits || { daily_text: 5, daily_photo: 0, monthly_text: 150, monthly_photo: 0 };
  const dailyText      = Number(data.dailyTextRequests)   || 0;
  const monthlyText    = Number(data.monthlyTextRequests) || 0;
  const dailyPhoto     = Number(data.dailyPhotoRequests)  || 0;
  const monthlyPhoto   = Number(data.monthlyPhotoRequests)|| 0;
  const extraText      = Number(data.extraText)           || 0;
  const extraPhoto     = Number(data.extraPhoto)          || 0;
  const responseSize   = data.responseSize || 'short';
  const status         = data.status || 'Онлайн';
  const botName        = data.botName || 'FREE AI · @freee_ai_bot';

  const planLabel    = PLAN_LABEL[plan]    || plan;
  const subtitle     = PLAN_SUBTITLES[plan]|| '';
  const responseLabel= RESPONSE_LABEL[responseSize] || 'Коротко';

  // Bar fill positions
  const textFillX  = barFillX(dailyText,  limits.daily_text);
  const photoFillX = barFillX(dailyPhoto, limits.daily_photo);

  const textBarColor  = (limits.daily_text  > 0 && dailyText  / limits.daily_text  > 0.85) ? '#FF5A5A' : '#18D7FF';
  const photoBarColor = (limits.daily_photo > 0 && dailyPhoto / limits.daily_photo > 0.85) ? '#FF5A5A' : '#B55CFF';

  const hasPhoto = limits.daily_photo > 0;

  // Photo text line
  const photoMainText = hasPhoto
    ? `${dailyPhoto}/${limits.daily_photo} за день ${monthlyPhoto}/${limits.monthly_photo} за месяц`
    : (extraPhoto > 0 ? `доп. генераций: ${extraPhoto}` : 'не входит в тариф');

  // Subscription end
  let subEnd = '';
  if (data.subscriptionEnd && data.subscriptionEnd !== 'null' && plan !== 'free') {
    const d = new Date(data.subscriptionEnd);
    if (!isNaN(d)) subEnd = ` · до ${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
  }

  // Use the plan wordmark path if available, else use large text
  const wordmarkPath = PLAN_WORDMARKS[plan];
  const wordmarkSvg = wordmarkPath
    ? `<path d="${wordmarkPath}" fill="white"/>`
    : `<text x="512" y="130" text-anchor="middle" font-family="Arial,sans-serif" font-size="90" font-weight="900" fill="white">${escapeXml(planLabel)}</text>`;

  // Subtitle: use the exact path from cart.svg for Max, or render as text for others
  // The subtitle path in cart.svg is the big block at y~176-204
  // For non-Max plans we use text
  const subtitleSvg = plan === 'max'
    ? `<!-- subtitle path omitted for brevity, using text fallback -->
       <text x="512" y="190" text-anchor="middle" font-family="Arial,sans-serif" font-size="26" fill="#B6BFEA">${escapeXml(subtitle)}${escapeXml(subEnd)}</text>`
    : `<text x="512" y="190" text-anchor="middle" font-family="Arial,sans-serif" font-size="26" fill="#B6BFEA">${escapeXml(subtitle)}${escapeXml(subEnd)}</text>`;

  return `<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0)">

<!-- Background gradient -->
<path d="M1024 0H0V1024H1024V0Z" fill="url(#bg)"/>

<!-- Decorative wave lines -->
<path d="M-103 958.534C177 818.534 397 1118.53 697 978.534C997 838.534 1217 818.534 1097 958.534" stroke="url(#wave)" stroke-width="10"/>
<path d="M-103 1038.53C197 908.53 497 1188.53 797 1038.53C1097 888.53 1237 868.53 1097 1018.53" stroke="#B55CFF" stroke-opacity="0.12" stroke-width="8"/>

<!-- ═══ PLAN WORDMARK ═══ -->
${wordmarkSvg}

<!-- ═══ SUBTITLE ═══ -->
${subtitleSvg}

<!-- ═══ BLOCK 1: Text requests ═══ -->
<rect x="93" y="247" width="838" height="131" rx="28" fill="#0D1E4E"/>

<!-- Bar background (exact pill shape from original) -->
<path d="M903.095 349H172.905C171.301 349 170 347.657 170 346C170 344.343 171.301 343 172.905 343H903.095C904.699 343 906 344.343 906 346C906 347.657 904.699 349 903.095 349Z" fill="white" fill-opacity="0.08"/>

<!-- Bar fill -->
${dailyText > 0 ? `<path d="${pillBarFill(textFillX, 346)}" fill="${textBarColor}" fill-opacity="0.85"/>` : ''}

<!-- Icon dot -->
<path d="M131.5 326C138.956 326 145 319.956 145 312.5C145 305.044 138.956 299 131.5 299C124.044 299 118 305.044 118 312.5C118 319.956 124.044 326 131.5 326Z" fill="#18D7FF" fill-opacity="0.15"/>
<path d="M131 320.414C135.418 320.414 139 316.87 139 312.5C139 308.129 135.418 304.586 131 304.586C126.582 304.586 123 308.129 123 312.5C123 316.87 126.582 320.414 131 320.414Z" fill="#18D7FF"/>

<!-- Labels block 1 -->
<text x="174" y="284" font-family="Arial,sans-serif" font-size="24" fill="#B6BFEA">Текстовые запросы</text>
<text x="174" y="326" font-family="Arial,sans-serif" font-size="34" font-weight="bold" fill="white">${dailyText}/${limits.daily_text} за день ${monthlyText}/${limits.monthly_text} за месяц</text>

<!-- ═══ BLOCK 2: Photo generation ═══ -->
<rect x="93" y="403" width="838" height="131" rx="28" fill="#0D1E4E"/>

<!-- Bar background -->
<path d="M903.095 499H172.905C171.301 499 170 500.343 170 502C170 503.657 171.301 505 172.905 505H903.095C904.699 505 906 503.657 906 502C906 500.343 904.699 499 903.095 499Z" fill="white" fill-opacity="0.08"/>

<!-- Bar fill -->
${dailyPhoto > 0 ? `<path d="${pillBarFill(photoFillX, 502)}" fill="${photoBarColor}" fill-opacity="0.85"/>` : ''}

<!-- Icon dot -->
<path d="M131.5 482C138.956 482 145 475.956 145 468.5C145 461.044 138.956 455 131.5 455C124.044 455 118 461.044 118 468.5C118 475.956 124.044 482 131.5 482Z" fill="#B55CFF" fill-opacity="0.15"/>
<path d="M132 477C136.418 477 140 473.418 140 469C140 464.582 136.418 461 132 461C127.582 461 124 464.582 124 469C124 473.418 127.582 477 132 477Z" fill="#B55CFF"/>

<!-- Labels block 2 -->
<text x="174" y="440" font-family="Arial,sans-serif" font-size="24" fill="#B6BFEA">Генерация изображений</text>
<text x="174" y="482" font-family="Arial,sans-serif" font-size="${hasPhoto ? '34' : '28'}" font-weight="${hasPhoto ? 'bold' : 'normal'}" fill="white" opacity="${hasPhoto || extraPhoto > 0 ? '1' : '0.4'}">${escapeXml(photoMainText)}</text>

<!-- ═══ BOTTOM ROW 1: Mode + Status ═══ -->
<rect x="93" y="559" width="406" height="131" rx="28" fill="#0D1E4E"/>
<text x="296" y="604" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#B6BFEA">Режим ответа:</text>
<text x="296" y="654" text-anchor="middle" font-family="Arial,sans-serif" font-size="40" font-weight="bold" fill="white">${escapeXml(responseLabel)}</text>

<rect x="524" y="559" width="406" height="131" rx="28" fill="#0D1E4E"/>
<text x="727" y="604" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#B6BFEA">Статус:</text>
<text x="727" y="654" text-anchor="middle" font-family="Arial,sans-serif" font-size="40" font-weight="bold" fill="white">${escapeXml(status)}</text>

<!-- ═══ BOTTOM ROW 2: Extra text + Extra photo ═══ -->
<rect x="93" y="715" width="406" height="131" rx="28" fill="#0D1E4E"/>
<text x="296" y="760" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#B6BFEA">Доп. текстовые запросы:</text>
<text x="296" y="810" text-anchor="middle" font-family="Arial,sans-serif" font-size="40" font-weight="bold" fill="white">${extraText}</text>

<rect x="524" y="715" width="406" height="131" rx="28" fill="#0D1E4E"/>
<text x="727" y="760" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#B6BFEA">Доп. генераций фото:</text>
<text x="727" y="810" text-anchor="middle" font-family="Arial,sans-serif" font-size="40" font-weight="bold" fill="white">${extraPhoto}</text>

<!-- ═══ BADGE ═══ -->
<rect x="309" y="900" width="406" height="53" rx="26.5" fill="#0D1E4E"/>
<text x="512" y="932" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="bold" fill="#B6BFEA">${escapeXml(botName)}</text>

</g>
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
  <stop stop-color="#070A18"/>
  <stop offset="1" stop-color="#0B1A48"/>
</linearGradient>
<linearGradient id="wave" x1="-103" y1="863" x2="1130.36" y2="863" gradientUnits="userSpaceOnUse">
  <stop stop-color="#18D7FF" stop-opacity="0"/>
  <stop offset="0.5" stop-color="#18D7FF" stop-opacity="0.18"/>
  <stop offset="1" stop-color="#B55CFF" stop-opacity="0"/>
</linearGradient>
<clipPath id="clip0">
  <rect width="1024" height="1024" fill="white"/>
</clipPath>
</defs>
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
      const svg  = buildCard(data);
      sharp(Buffer.from(svg))
        .png()
        .toBuffer()
        .then(png => {
          res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length });
          res.end(png);
        })
        .catch(e => { res.writeHead(500); res.end('Error: ' + e.message); });
    } catch (e) {
      res.writeHead(500); res.end('Error: ' + e.message);
    }
  });
});

server.listen(PORT, () => console.log(`Card server running on port ${PORT}`));
