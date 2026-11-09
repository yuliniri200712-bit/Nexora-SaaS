import { app } from './app.js';
import { config } from './core/config.js';
import { db } from './infrastructure/database.js';
const server = app.listen(config.PORT, '127.0.0.1', () =>
  console.log(`NEXORA API: http://127.0.0.1:${config.PORT}`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close(() => {
      void db.$disconnect().then(() => process.exit(0));
    });
  });
