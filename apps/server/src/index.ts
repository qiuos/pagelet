import { appConfig } from './config';
import app from './app';

// 启动服务器
const PORT = appConfig.port;

app.listen(PORT, () => {
  console.log(`[Server] Pagelet server running on port ${PORT}`);
  console.log(`[Server] Environment: ${appConfig.nodeEnv}`);
  console.log(`[Server] Database: ${appConfig.databasePath}`);
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('[Uncaught Exception]', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});