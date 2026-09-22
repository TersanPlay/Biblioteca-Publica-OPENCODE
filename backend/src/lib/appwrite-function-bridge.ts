import ServerlessHttp from 'serverless-http';

type ServerlessHandler = ServerlessHttp.Handler;

export interface FunctionEvent {
  httpMethod: string;
  path: string;
  headers: Record<string, string>;
  queryStringParameters: Record<string, string | undefined>;
  body: string;
  isBase64Encoded: boolean;
  requestContext: {
    identity: { sourceIp: string };
    requestId: string;
  };
}

export interface FunctionEnvelope {
  status: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface AppwriteReq {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  bodyText: string;
  bodyBinary: Buffer;
  url?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface AppwriteRes {
  json: (obj: unknown, status?: number, headers?: Record<string, string>) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log: (...args: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (...args: any[]) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppwriteContext = { req: AppwriteReq; res: AppwriteRes } & Record<string, any>;

function normalizeHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') out[key.toLowerCase()] = value;
  }
  return out;
}

function toFunctionEvent(req: AppwriteReq): FunctionEvent {
  const headers = normalizeHeaders(req.headers);
  const bodyBinary = req.bodyBinary ?? Buffer.alloc(0);
  const isBase64Encoded = bodyBinary.length > 0;

  let body = '';
  if (bodyBinary.length > 0) {
    body = bodyBinary.toString('base64');
  } else if (req.bodyText) {
    body = req.bodyText;
  }

  return {
    httpMethod: (req.method ?? 'GET').toUpperCase(),
    path: req.path ?? '/',
    headers,
    queryStringParameters: req.query ?? {},
    body,
    isBase64Encoded,
    requestContext: {
      identity: {
        sourceIp: headers['x-forwarded-for'] ?? headers['x-real-ip'] ?? '127.0.0.1',
      },
      requestId: headers['x-request-id'] ?? '',
    },
  };
}

function srHeadersToRecord(headers: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  for (const [key, value] of Object.entries(headers)) {
    out[key] = String(value);
  }
  return out;
}

export async function handle(
  context: AppwriteContext,
  handler: ServerlessHandler,
): Promise<FunctionEnvelope> {
  const event = toFunctionEvent(context.req);

  context.res.log(
    `[function] ${event.httpMethod} ${event.path} (trigger=${context.trigger ?? 'http'})`,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await handler(event, {});
  const status = Number(result?.statusCode) || 500;
  const headers = srHeadersToRecord(result?.headers);
  const body = typeof result?.body === 'string' ? result.body : String(result?.body ?? '');
  const isBase64Encoded = Boolean(result?.isBase64Encoded);

  context.res.log(`[function] ${event.httpMethod} ${event.path} -> ${status}`);

  return { status, headers, body, isBase64Encoded };
}

export const buildEnvelopeResponse = (context: AppwriteContext, envelope: FunctionEnvelope) =>
  context.res.json(envelope, 200);