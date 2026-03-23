const http = require('http');
const { createCanvas } = require('canvas');

const PORT = process.env.PORT || 3000;

// Шрифты без эмодзи — работают на Linux (Render)
const FONT_REGULAR = '15px "DejaVu Sans", Arial, sans-serif';
const FONT_BOLD    = 'bold 15px "DejaVu Sans", Arial, sans-serif';
const FONT_LARGE   = 'bold 22px "DejaVu Sans", Arial, sans-serif';
const FONT_MEDIUM  = 'bold 18px "DejaVu Sans", Arial, sans-serif';
const FONT_SMALL   = '14px "DejaVu Sans", Arial, sans-serif';
const FONT_TINY    = 'bold 13px "DejaVu Sans", Arial, sans-serif';

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

// Иконки-заменители для эмодзи (текстовые символы)
const ICON = {
  chat:    '[T]',
  calendar:'[M]',
  image:   '[I]',
  extra:   '[+]',
  size:    '[R]',
  dot:     '\u2022'
};

function drawCard(data) {
  const W = 600, H = 420;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const plan = data.plan || 'free';
  const accentColor = PLAN_COLORS[plan] || '#6c757d';
  const planName = PLAN_NAMES[plan] || plan;

  // --- Фон ---
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W, H);

  // Градиент поверх фона
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#16213e');
  grad.addColorStop(1, '#0f3460');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Цветная полоса сверху
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, W, 6);

  // Лёгкий декоративный круг справа
  ctx.beginPath();
  ctx.arc(W - 60, 60, 80, 0, Math.PI * 2);
  ctx.fillStyle = accentColor + '18';
  ctx.fill();

  // --- Заголовок ---
  ctx.fillStyle = '#ffffff';
  ctx.font = FONT_LARGE;
  ctx.fillText('AI Link  |  ChatGPT  |  Нейросеть', 30, 48);

  // --- Тариф badge ---
  const badgeText = 'Тариф: ' + planName;
  ctx.font = FONT_MEDIUM;
  const badgeW = ctx.measureText(badgeText).width + 28;
  ctx.fillStyle = accentColor;
  roundRect(ctx, 30, 62, badgeW, 34, 8);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(badgeText, 44, 85);

  // --- Дата окончания ---
  if (data.subscriptionEnd && plan !== 'free') {
    const d = new Date(data.subscriptionEnd);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    ctx.fillStyle = '#adb5bd';
    ctx.font = FONT_SMALL;
    ctx.fillText(`до ${dd}.${mm}.${yyyy}`, badgeW + 40, 85);
  }

  // --- Разделитель ---
  ctx.strokeStyle = accentColor + '55';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 110);
  ctx.lineTo(570, 110);
  ctx.stroke();

  // --- Статистика ---
  const stats = buildStats(data, plan);
  drawStats(ctx, stats, accentColor, W);

  // --- Режим ответа ---
  const sizeMap = { short: 'Коротко', medium: 'Обычно', long: 'Подробно' };
  const sizeName = sizeMap[data.responseSize] || 'Коротко';
  ctx.fillStyle = '#adb5bd';
  ctx.font = FONT_SMALL;
  ctx.fillText('Режим ответа: ' + sizeName, 30, H - 16);

  // --- Watermark ---
  ctx.fillStyle = accentColor + '99';
  ctx.font = FONT_TINY;
  const wm = 'vk.com/ailink_bot';
  const wmW = ctx.measureText(wm).width;
  ctx.fillText(wm, W - wmW - 20, H - 16);

  return canvas.toBuffer('image/png');
}

function buildStats(data, plan) {
  const limits = data.limits || {
    daily_text: 5, daily_photo: 0, monthly_text: 150, monthly_photo: 0
  };
  const items = [];

  items.push({
    label: 'Сообщений сегодня',
    used: data.dailyTextRequests || 0,
    total: limits.daily_text,
    type: 'bar'
  });

  items.push({
    label: 'Сообщений в месяце',
    used: data.monthlyTextRequests || 0,
    total: limits.monthly_text,
    type: 'bar'
  });

  if (limits.daily_photo > 0) {
    items.push({
      label: 'Изображений сегодня',
      used: data.dailyPhotoRequests || 0,
      total: limits.daily_photo,
      type: 'bar'
    });
  } else {
    const extraPhoto = data.extraPhoto || 0;
    items.push({
      label: 'Генерация изображений',
      text: extraPhoto > 0
        ? 'Не в тарифе, доп. генераций: ' + extraPhoto
        : 'Не входит в тариф',
      type: 'text'
    });
  }

  if ((data.extraText || 0) > 0) {
    items.push({
      label: 'Доп. сообщений',
      text: data.extraText + ' шт.',
      type: 'text'
    });
  }
  if ((data.extraPhoto || 0) > 0 && limits.daily_photo > 0) {
    items.push({
      label: 'Доп. генераций',
      text: data.extraPhoto + ' шт.',
      type: 'text'
    });
  }

  return items;
}

function drawStats(ctx, stats, accentColor, W) {
  const startY = 125;
  const rowH   = 56;
  const barX   = 30;
  const barW   = W - 60;

  stats.forEach((item, i) => {
    const y = startY + i * rowH;

    // Лёгкий фон строки через одну
    if (i % 2 === 0) {
      ctx.fillStyle = '#ffffff08';
      ctx.fillRect(0, y, W, rowH - 4);
    }

    // Лейбл
    ctx.fillStyle = '#ced4da';
    ctx.font = FONT_REGULAR;
    ctx.fillText(item.label, barX, y + 18);

    if (item.type === 'bar') {
      const barY = y + 26;
      const barH = 14;
      const ratio = item.total > 0 ? Math.min(item.used / item.total, 1) : 0;
      const fillW = Math.round(barW * ratio);

      // Фон бара
      ctx.fillStyle = '#2d3748';
      roundRect(ctx, barX, barY, barW, barH, 7);

      // Цвет заполнения
      const barColor = ratio > 0.85 ? '#e74c3c'
                     : ratio > 0.6  ? '#f39c12'
                     : accentColor;

      // Градиент заполнения
      if (fillW > 0) {
        const fg = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
        fg.addColorStop(0, barColor + 'cc');
        fg.addColorStop(1, barColor);
        ctx.fillStyle = fg;
        roundRect(ctx, barX, barY, fillW, barH, 7);
      }

      // Счётчик справа от лейбла
      ctx.fillStyle = '#ffffff';
      ctx.font = FONT_TINY;
      const counter = item.used + ' / ' + item.total;
      const cw = ctx.measureText(counter).width;
      ctx.fillText(counter, barX + barW - cw, y + 18);

    } else {
      // Текстовая строка
      ctx.fillStyle = '#868e96';
      ctx.font = FONT_SMALL;
      ctx.fillText(item.text, barX, y + 40);
    }
  });
}

function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

// --- HTTP сервер ---
const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/card') {
    res.writeHead(404);
    return res.end('Not found');
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const png = drawCard(data);
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': png.length
      });
      res.end(png);
    } catch (e) {
      console.error('drawCard error:', e);
      res.writeHead(500);
      res.end('Error: ' + e.message);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Card server running on port ${PORT}`);
});
