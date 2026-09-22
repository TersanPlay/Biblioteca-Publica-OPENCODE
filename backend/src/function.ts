/* Entrypoint da Appwrite Function (Node, CommonJS compilado em dist/src/function.js).
 *
 * A função encaixa o Express via serverless-http: o contexto HTTP da Function
 * é traduzido para um evento AWS API Gateway v1 e a resposta do Express é
 * devolvida dentro de um envelope JSON UTF-8 seguro:
 *
 *   { status, headers, body, isBase64Encoded }
 *
 * - respostas JSON: body é uma string JSON válida.
 * - respostas binárias (PDF de termos, download de backup): body é base64.
 *
 * O frontend chama sempre o domínio da Function e desempacota este envelope
 * (services/axios.ts adapter). Nunca passamos bytes brutos pelo Appwrite,
 * evitando o problema de serialização binária UTF-8.
 */
import 'dotenv/config';
import serverless from 'serverless-http';
import { createApp } from './app';
import { createBackup } from './modules/backup.routes';
import { handle } from './lib/appwrite-function-bridge';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppwriteContext = any;

const app = createApp();
const handler = serverless(app);

export default async function main(context: AppwriteContext) {
  try {
    if (context.trigger === 'schedule') {
      const result = await createBackup();
      return context.res.json({ ok: true, ...result }, 200);
    }

    if (context.trigger === 'http' || context.trigger === undefined) {
      const envelope = await handle(context, handler);
      return context.res.json(envelope, 200);
    }

    return context.res.json({ ok: false, error: 'Trigger não suportado' }, 400);
  } catch (err) {
    context.error(`[function] falha fatal: ${(err as Error)?.stack || err}`);
    return context.res.json(
      {
        status: 500,
        headers: {},
        body: JSON.stringify({ error: 'Erro interno da Function' }),
        isBase64Encoded: false,
      },
      200,
    );
  }
}