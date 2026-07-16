const { createServer } = require('http');
const app = require('./src/app');
const { port, validateEnv } = require('./config/env');

validateEnv();

const server = createServer(app);
const io = require('./src/realtime').attach(server);
app.set('io', io);

server.listen(port, () => {
  console.log(`LaperCuy DelQueue listening on http://localhost:${port}`);
});

module.exports = server;
