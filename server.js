'use strict';

var fs = require('node:fs');
var http = require('node:http');
var path = require('node:path');
var createBridgeHandler = require('./lib/bridge').createBridgeHandler;
var createPhotoHandler = require('./lib/photo').createPhotoHandler;
var createTelemetryHandler = require('./lib/telemetry').createTelemetryHandler;
var createTorsoHandler = require('./lib/torso').createTorsoHandler;

var PORT = Number(process.env.PORT) || 3000;
var ROOT = path.join(__dirname, 'public');
var askHandler = createBridgeHandler();
var photoHandler = createPhotoHandler();
var telemetryHandler = createTelemetryHandler();
var torsoHandler = createTorsoHandler();

var mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function serveStatic(request, response) {
  var requestUrl = new URL(request.url, 'http://localhost');
  var pathname = decodeURIComponent(requestUrl.pathname);
  var relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  var filePath = path.resolve(ROOT, relativePath);

  if (!filePath.startsWith(ROOT + path.sep)) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, function (error, content) {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not Found');
      return;
    }

    var extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream',
      'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
    });
    response.end(content);
  });
}

var server = http.createServer(function (request, response) {
  if (request.url && request.url.split('?')[0] === '/api/ask') {
    askHandler(request, response);
    return;
  }
  if (request.url && request.url.split('?')[0] === '/api/photo') {
    photoHandler(request, response);
    return;
  }
  if (request.url && request.url.split('?')[0] === '/api/telemetry') {
    telemetryHandler(request, response);
    return;
  }
  if (request.url && request.url.split('?')[0] === '/api/torso') {
    torsoHandler(request, response);
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }
  serveStatic(request, response);
});

server.listen(PORT, function () {
  console.log('Kinelo Anti Turtle listening on http://127.0.0.1:' + PORT);
});
