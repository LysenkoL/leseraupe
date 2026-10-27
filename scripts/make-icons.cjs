// Erzeugt die PNG-Icons aus public/icons/icon.svg (einmalig, Ergebnis wird eingecheckt).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '../public/icons/icon.svg'), 'utf8');
  const b = await chromium.launch();
  const shots = [
    ['icon-192.png', 192, 0],
    ['icon-512.png', 512, 0],
    ['icon-maskable-512.png', 512, 0.14],
  ];
  for (const [name, size, pad] of shots) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    const inner = size * (1 - 2 * pad);
    await p.setContent(`<body style="margin:0;background:#F4F8F2;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px">
      <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body>`);
    await p.screenshot({ path: path.join(__dirname, '../public/icons', name), omitBackground: pad === 0 });
    await p.close();
  }
  await b.close();
})();
