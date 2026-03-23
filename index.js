const http = require('http');
const { createCanvas } = require('canvas');
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/card') {
    res.writeHead(404); return res.end('Not found');
  }
  const canvas = createCanvas(600, 420);
  const ctx = canvas.getContext('2d');
  
  // Простой тест без шрифтов
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, 600, 420);
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(50, 50, 200, 100);  // красный прямоугольник
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  ctx.fillText('TEST OK', 100, 110);
  
  const png = canvas.toBuffer('image/png');
  res.writeHead(200, { 'Content-Type': 'image/png' });
  res.end(png);
});

server.listen(PORT, () => console.log('running on ' + PORT));