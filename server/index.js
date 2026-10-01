import { createApp } from './app.js';
import { HOST, PORT } from './config.js';

const app = createApp();
app.listen(PORT, HOST, () => {
  console.log(`PMS dashboard API on http://localhost:${PORT}`);
});
