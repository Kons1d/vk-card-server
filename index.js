const http = require('http');
const { createCanvas } = require('canvas');

const PORT = process.env.PORT || 3000;

function drawCard(data) {
  const W = 600, H = 400;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Цвета тарифов
  const PLAN_COLORS = {
    free:  '#6c757d',
    start: '#28a745',
    lite:  '#17a2b8',
    pro:   '#fd7e14',
    max:   '#6f42c1'
  };
  const PLAN_NAMES = {
    free: 'Free', start: '🟢 Start', lite: '🔵 Lite', pro: '⭐ Pro', max: '👑 Max'
  };

  const plan = data.plan || 'free';
  const accentColor = PLAN_COLORS[plan] || '#6c757d';
  const planName = PLAN_NAMES[plan] || plan;

  // Фон
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W, H);

  // Цветная полоса сверху
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, W, 6);

  // Градиентная карточка
  const grad = ctx.createLinearGradient(0, 6, 0, H);
  grad.addColorStop(0, '#16213e');
  grad.addColorStop(1, '#0f3460');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 6, W, H - 6);

  // Заголовок — название бота
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('AI Link | ChatGPT | Нейросеть', 30, 50);

  // Тариф badge
  ctx.fillStyle = accentColor;
  roundRect(ctx, 30, 68, 180, 38, 8);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`Тариф: ${planName}`, 44, 93);

  // Дата окончания
  if (data.subscriptionEnd && plan !== 'free') {
    const d = new Date(data.subscriptionEnd);
    const dateStr = `до ${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`;
    ctx.fillStyle = '#adb5bd';
    ctx.font = '14px sans-serif';
    ctx.fillText(dateStr, 222, 93);
  }

  // Разделитель
  ctx.strokeStyle = accentColor + '44';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 120);
  ctx.lineTo(570, 120);
  ctx.stroke();

  // Блоки статистики
  const stats = buildStats(data, plan);
  drawStats(ctx, stats, accentColor);

  // Режим ответа
  const sizeMap = { short: 'Коротко', medium: 'Обычно', long: 'Подробно' };
  ctx.fillStyle = '#adb5bd';
  ctx.font = '14px sans-serif';
  ctx.fillText(`✍️  Режим ответа: ${sizeMap[data.responseSize] || 'Коротко'}`, 30, H - 20);

  // Логотип/watermark
  ctx.fillStyle = accentColor + '88';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('vk.com/ailink_bot', W - 160, H - 20);

  return canvas.toBuffer('image/png');
}

function buildStats(data, plan) {
  const limits = data.limits || { daily_text: 5, daily_photo: 0, monthly_text: 150, monthly_photo: 0 };
  const items = [];

  // Текстовые запросы сегодня
  items.push({
    label: '💬 Сообщений сегодня',
    used: data.dailyTextRequests || 0,
    total: limits.daily_text,
    type: 'bar'
  });

  // Текстовые запросы в месяце
  items.push({
    label: '📅 Сообщений в месяце',
    used: data.monthlyTextRequests || 0,
    total: limits.monthly_text,
    type: 'bar'
  });

  // Генерация изображений сегодня
  if (limits.daily_photo > 0) {
    items.push({
      label: '🖼  Изображений сегодня',
      used: data.dailyPhotoRequests || 0,
      total: limits.daily_photo,
      type: 'bar'
    });
  } else {
    items.push({
      label: '🖼  Генерация изображений',
      text: plan === 'free' ? 'Не входит в тариф' : 'Не входит в тариф',
      type: 'text'
    });
  }

  // Доп. пакеты
  if ((data.extraText || 0) > 0) {
    items.push({ label: '📦 Доп. сообщений', text: `${data.extraText} шт.`, type: 'text' });
  }
  if ((data.extraPhoto || 0) > 0) {
    items.push({ label: '📦 Доп. генераций', text: `${data.extraPhoto} шт.`, type: 'text' });
  }

  return items;
}

function drawStats(ctx, stats, accentColor) {
  const startY = 135;
  const rowH = 52;

  stats.forEach((item, i) => {
    const y = startY + i * rowH;

    // Лейбл
    ctx.fillStyle = '#dee2e6';
    ctx.font = '15px sans-serif';
    ctx.fillText(item.label, 30, y + 18);

    if (item.type === 'bar') {
      const barX = 30, barY = y + 26, barW = 540, barH = 12;
      const ratio = item.total > 0 ? Math.min(item.used / item.total, 1) : 0;
      const fillW = Math.round(barW * ratio);

      // Фон бара
      ctx.fillStyle = '#2d3748';
      roundRect(ctx, barX, barY, barW, barH, 6);

      // Заполнение
      const barColor = ratio > 0.85 ? '#e74c3c' : ratio > 0.6 ? '#f39c12' : accentColor;
      ctx.fillStyle = barColor;
      if (fillW > 0) roundRect(ctx, barX, barY, fillW, barH, 6);

      // Текст справа
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      const label = `${item.used} / ${item.total}`;
      const tw = ctx.measureText(label).width;
      ctx.fillText(label, barX + barW - tw, barY - 3);

    } else {
      ctx.fillStyle = '#adb5bd';
      ctx.font = '14px sans-serif';
      ctx.fillText(item.text, 30, y + 38);
    }
  });
}

function roundRect(ctx, x, y, w, h, r) {
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

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/card') {
    res.writeHead(404);
    return res.end('Not found');
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const png = drawCard(data);
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length });
      res.end(png);
    } catch (e) {
      res.writeHead(500);
      res.end('Error: ' + e.message);
    }
  });
});

server.listen(PORT, () => console.log(`Card server running on port ${PORT}`));
