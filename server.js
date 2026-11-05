const http = require('http');
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'public', 'index.html');
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT || 3000, '0.0.0.0');
