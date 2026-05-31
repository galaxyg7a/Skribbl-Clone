import { createServer } from 'http';
import app from './app';
import { setupSocketIO } from './game/engine';
import { logger } from './lib/logger';
import { runMigrations } from '@workspace/db';

const rawPort = process.env['PORT'] ?? '8080';
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);
setupSocketIO(server);

runMigrations().then(() => {
  server.listen(port, () => {
    logger.info({ port }, 'Skribbl server listening');
  });
});

server.on('error', (err) => {
  logger.error({ err }, 'Server error');
  process.exit(1);
});
