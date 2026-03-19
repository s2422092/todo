// Node.jsでアイコンを生成するスクリプト
// 実行: node generate-icons.js
const fs = require('fs');
const path = require('path');

// SVGをBase64 PNGに変換するためのHTMLを生成
const svgTemplate = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="#4f46e5"/>
  <rect x="${size*0.2}" y="${size*0.28}" width="${size*0.15}" height="${size*0.15}" rx="${size*0.04}" fill="white"/>
  <rect x="${size*0.42}" y="${size*0.3}" width="${size*0.38}" height="${size*0.1}" rx="${size*0.03}" fill="white"/>
  <rect x="${size*0.2}" y="${size*0.46}" width="${size*0.15}" height="${size*0.15}" rx="${size*0.04}" fill="white"/>
  <rect x="${size*0.42}" y="${size*0.48}" width="${size*0.28}" height="${size*0.1}" rx="${size*0.03}" fill="white"/>
  <rect x="${size*0.2}" y="${size*0.64}" width="${size*0.15}" height="${size*0.15}" rx="${size*0.04}" fill="white"/>
  <rect x="${size*0.42}" y="${size*0.66}" width="${size*0.32}" height="${size*0.1}" rx="${size*0.03}" fill="white"/>
</svg>`;

const sizes = [16, 32, 48, 128];
const outDir = path.join(__dirname, 'assets', 'icons');

sizes.forEach(size => {
  const svg = svgTemplate(size);
  const svgPath = path.join(outDir, `icon-${size}.svg`);
  fs.writeFileSync(svgPath, svg);
  console.log(`Generated: icon-${size}.svg`);
});

console.log('\nSVGファイルを生成しました。');
console.log('Chrome拡張ではSVGは使えないため、以下の方法でPNGに変換してください:');
console.log('1. https://svgtopng.com/ などのオンラインツール');
console.log('2. または convert-svg.html をブラウザで開く');
