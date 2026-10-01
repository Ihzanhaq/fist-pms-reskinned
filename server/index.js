import { createApp } from './app.js';
import { HOST, PORT } from './config.js';
import { startSessionKeepalive } from './keepalive.js';

const app = createApp();
const server = app.listen(PORT, HOST, () => {
  console.log(`PMS dashboard API on http://localhost:${PORT}`);
  startSessionKeepalive();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use — an old dashboard API is still running. Stop it (Ctrl+C in that terminal, or end the node process on ${PORT}) and run npm run dev again.`,
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});
