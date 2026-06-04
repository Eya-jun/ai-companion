// 用 IDE 看到的 .env 里的 key 直接测
import OpenAI from 'openai';

const OLD_KIMI_KEY = 'sk-4B1un3BUR9HrETF2SxxiFEnuCuRtTFp2sZiXqKOYbNX94wAo';
const OLD_SF_KEY = 'sk-kivaqrdgjhxvlmceprjmbukwhdqywhyfdwrlyhrzvkijlpbn';

async function tryModel(label: string, baseURL: string, apiKey: string, model: string) {
  const client = new OpenAI({ apiKey, baseURL });
  try {
    const r = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 1,
      max_tokens: 20,
    });
    console.log(`✅ ${label} (${model}):`, r.choices[0]?.message?.content?.slice(0, 40) || '(empty)');
  } catch (e: any) {
    const errCode = e?.error?.code || e?.status || 'unknown';
    const errMsg = e?.error?.message || e?.message || String(e);
    console.log(`❌ ${label} (${model}): code=${errCode} msg=${errMsg}`);
    if (e?.error?.code === 2013 || String(errCode).includes('400')) {
      console.log('   Full error body:', JSON.stringify(e?.error, null, 2));
    }
  }
}

async function main() {
  console.log('--- 用 IDE 看到的 .env 旧 key 测 ---');
  await tryModel('OLD Kimi', 'https://api.moonshot.cn/v1', OLD_KIMI_KEY, 'kimi-k2.5');
  await tryModel('OLD SF DeepSeek', 'https://api.siliconflow.cn/v1', OLD_SF_KEY, 'deepseek-ai/DeepSeek-V3.2');
  await tryModel('OLD SF MiniMax', 'https://api.siliconflow.cn/v1', OLD_SF_KEY, 'MiniMaxAI/MiniMax-M2.5');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
