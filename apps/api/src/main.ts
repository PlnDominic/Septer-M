import { createApp } from './bootstrap';

async function main() {
  const app = await createApp();
  await app.listen(process.env.PORT ?? 4000);
}
void main();
