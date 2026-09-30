// 把 game.html（遊戲本體）包成可以直接開啟的 index.html。
// 用法：node tools/build.js
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
const body = fs.readFileSync(path.join(root, 'game.html'), 'utf8');
fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html>\n<html lang="zh-Hant">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<style>body{margin:0}</style>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n');
console.log('index.html built');
