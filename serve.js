const http=require('http'),fs=require('fs'),path=require('path');
http.createServer((q,s)=>{const f=path.join(__dirname,q.url==='/'?'index.html':decodeURIComponent(q.url.split('?')[0]));
fs.readFile(f,(e,d)=>{if(e){s.writeHead(404);return s.end('not found')}s.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'});s.end(d)})}).listen(8123,()=>console.log('http://localhost:8123'));
