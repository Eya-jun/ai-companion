import cron from 'node-cron';
import { evaluateAllUsersYesterday } from '../services/affinity-eval';

export function startDailyAffinityCron() {
  if (!cron.validate('0 2 * * *')) {
    console.error('[cron] 表达式无效');
    return;
  }
  cron.schedule(
    '0 2 * * *',
    async () => {
      const start = Date.now();
      console.log('[cron] 每日评估开始', new Date().toISOString());
      try {
        const result = await evaluateAllUsersYesterday();
        console.log(`[cron] 评估完成: ${result.evaluated} 成功, ${result.errors} 错误, ${result.skipped} 跳过, 耗时 ${Date.now() - start}ms`);
      } catch (e: any) {
        console.error('[cron] 评估异常:', e.message);
      }
    },
    { timezone: 'Asia/Shanghai' },
  );
  console.log('[cron] 每日评估已注册: 0 2 * * * (Asia/Shanghai)');
}
