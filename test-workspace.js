const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/video/1/workspace-videos',
  method: 'GET'
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log("Status:", res.statusCode);
    console.log("Headers:", res.headers);
    try {
      console.log(JSON.stringify(JSON.parse(data), null, 2));
    } catch(e) {
      console.log(data);
    }
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
