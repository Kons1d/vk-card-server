const http = require('http');
const sharp = require('sharp');
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/card') {
    res.writeHead(404); return res.end('Not found');
  }

  const svg = `<svg width="600" height="420" xmlns="http://www.w3.org/2000/svg">
    <rect width="600" height="420" fill="#1a1a2e"/>
    <rect x="0" y="0" width="600" height="6" fill="#fd7e14"/>
    <rect x="50" y="50" width="200" height="100" fill="#ff0000"/>
    <text x="100" y="110" fill="white" font-size="20">TEST OK</text>
  </svg>`;

  sharp(Buffer.from(svg))
    .png()
    .toBuffer()
    .then(png => {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(png);
    })
    .catch(e => {
      res.writeHead(500);
      res.end('Error: ' + e.message);
    });
});

server.listen(PORT, () => console.log('running on ' + PORT));
