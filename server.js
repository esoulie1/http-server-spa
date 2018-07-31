#!/usr/bin/env node

(function() {

  const fs = require('fs');
  const url = require('url');
  const path = require('path');
  const http = require('http');
  const mime = require('mime');
  const auth = require('basic-auth');
  // CLI arguments

  const root = process.argv[2];
  const file = process.argv[3] || 'index.html';
  const port = process.argv[4] || 8080;
  const cacheTime = parseInt(process.argv[5], 10) || 86400; // Cache for 1 day
  const username = process.argv[6] || '';
  const password = process.argv[7] || '';
  const cwd = process.cwd();

  let index;

  const cacheTimeInMS = cacheTime * 1000;
  // Try put the root file in memory

  try {
    const uri = path.join(process.cwd(), root, file);
    index = fs.readFileSync(uri);
  } catch(e) {
    console.log(`[ERR] Could not start server, fallback file not found`);
    console.log(`[TRY] http-server-spa <directory> <fallback> <port>`);
    process.exit();
  }

  // Server utility functions

  function readFile(res, uri) {
    fs.readFile(uri, 'binary', (err, file) => {
      if (err) sendError(res);
      else sendFile(res, uri, file);
    });
  };

  function sendError(res) {
    res.writeHead(500);
    res.write('500 Server Error');
    return res.end();
  }

  function sendNotFound(res) {
    res.writeHead(404);
    res.write('404 Not Found');
    return res.end();
  }

  function sendIndex(res, status) {
    if (process.env.NODE_ENV !== 'production') {
      const uri = path.join(process.cwd(), root, file);
      index = fs.readFileSync(uri);
    }
    res.setHeader("Cache-Control", "public, max-age=" + cacheTime );
    res.setHeader("Expires", new Date(Date.now() + cacheTimeInMS).toUTCString());
    res.writeHead(status, { 'Content-Type': 'text/html' });
    res.write(index);
    return res.end();
  }

  function sendFile(res, uri, data) {
    res.writeHead(200, { 'Content-Type': mime.lookup(uri) });
    res.write(data, 'binary');
    res.end();
  }

  function isRouteRequest(uri) {
    return uri.split('/').pop().indexOf('.') === -1 ? true : false;
  }

  // Starting the server

  function authentificationRequired() {
    return username && username !== '' && password && password != '';
  }

  http.createServer(function(req, res) {

    const uri = url.parse(req.url).pathname;
    const resource = path.join(cwd, root, decodeURI(uri));
    // A route was requested
    if(isRouteRequest(uri)) {
      if (authentificationRequired()) {
        var credentials = auth(req)

        if (!credentials || credentials.name !== username || credentials.pass !== password) {
          res.statusCode = 401;
          res.setHeader('WWW-Authenticate', 'Basic realm="example"');
          return res.end('Access denied');
        }
      }
      sendIndex(res, uri === '/' ? 200 : 301);
      console.log(`[OK] GET ${uri}`);
      return;
    }
    // A file was requested
    fs.stat(resource, function(err, stat) {
      if (err === null) {
        readFile(res, resource);
        console.log(`[OK] GET ${uri}`);
      }
      else {
        sendNotFound(res);
        console.log(`[ER] GET ${uri}`);
      }
    });
  }).listen(parseInt(port, 10));

  console.log(`----------------------------------------------`);
  console.log(`[OK] Serving static files from ./${root}`);
  console.log(`[OK] Using the fallback file ${file}`);
  console.log(`[OK] Listening on http://localhost:${port}`);
  console.log(`----------------------------------------------`);

})();
