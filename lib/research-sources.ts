import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { createHash } from 'node:crypto';
import { AiRequestError } from './ai-policy.ts';

export type ResearchSource = {
  id: string;
  url: string;
  title: string;
  publisher: string;
  publishedAt: null;
  retrievedAt: string;
  contentDigest: string;
  excerpt: string;
};

export function validateSourceUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AiRequestError(
      'Each source must be a valid public HTTPS link.',
      422,
    );
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    isIP(url.hostname) ||
    url.hostname.startsWith('[') ||
    !url.hostname.includes('.') ||
    /\.(local|localhost|internal|test|invalid)$/i.test(url.hostname)
  ) {
    throw new AiRequestError(
      'Sources must use public HTTPS websites, without credentials or custom ports.',
      422,
    );
  }
  url.hash = '';
  return url;
}

export function isPublicIpv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split('.').map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

async function download(
  url: URL,
  signal: AbortSignal,
  redirects = 0,
): Promise<{ url: URL; body: Buffer }> {
  signal.throwIfAborted();
  const records = await lookup(url.hostname, { family: 4, all: true });
  signal.throwIfAborted();
  if (!records.length || records.some(({ address }) => !isPublicIpv4(address)))
    throw new AiRequestError('This source is not a public website.', 422);
  // Pin the checked IP for the actual socket: a second DNS lookup cannot
  // redirect the request to localhost, metadata, or private infrastructure.
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      url,
      {
        method: 'GET',
        signal,
        family: 4,
        headers: {
          accept: 'text/html, text/plain, application/xhtml+xml',
          'accept-encoding': 'identity',
          'user-agent':
            'AgentEvidenceStudio/1.0 (bounded public-source reader)',
        },
        lookup: (_host, _options, callback) =>
          callback(null, records[0].address, 4),
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if (
          [301, 302, 303, 307, 308].includes(status) &&
          response.headers.location
        ) {
          response.destroy();
          if (redirects >= 2) {
            reject(
              new AiRequestError('This source redirects too many times.', 422),
            );
            return;
          }
          try {
            resolve(
              download(
                validateSourceUrl(new URL(response.headers.location, url).href),
                signal,
                redirects + 1,
              ),
            );
          } catch (error) {
            reject(error);
          }
          return;
        }
        const type = response.headers['content-type']?.split(';')[0];
        if (
          status !== 200 ||
          !['text/html', 'text/plain', 'application/xhtml+xml'].includes(
            type ?? '',
          ) ||
          (response.headers['content-encoding'] &&
            response.headers['content-encoding'] !== 'identity')
        ) {
          response.destroy();
          reject(
            new AiRequestError(
              'A source could not be read. Use an accessible HTML or text page.',
              422,
            ),
          );
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > 262_144) {
            response.destroy(
              new AiRequestError(
                'A source is too large. Choose a smaller article or documentation page.',
                422,
              ),
            );
          } else chunks.push(chunk);
        });
        response.on('end', () => resolve({ url, body: Buffer.concat(chunks) }));
        response.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

export function sourceFromPage(
  url: URL,
  body: Buffer,
  index: number,
  now = new Date(),
): ResearchSource {
  const html = body.toString('utf8');
  const clean = (value: string) =>
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
      .replace(/<(style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<!--[^]*?-->/g, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(
        /&(?:nbsp|amp|quot|lt|gt|#39);/g,
        (entity) =>
          ({
            '&nbsp;': ' ',
            '&amp;': '&',
            '&quot;': '"',
            '&lt;': '<',
            '&gt;': '>',
            '&#39;': "'",
          })[entity] ?? entity,
      )
      .replace(/\s+/g, ' ')
      .trim();
  const content =
    html.match(
      /<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)\s*>/i,
    )?.[1] ?? html;
  // Keep evidence compact across all three roles and any one repair.
  let excerpt = clean(content).slice(0, 1_000);
  while (Buffer.byteLength(excerpt, 'utf8') > 1_600)
    excerpt = excerpt.slice(0, -1);
  if (excerpt.length < 80)
    throw new AiRequestError(
      'A source has too little readable text. Choose another public page.',
      422,
    );
  return {
    id: `source_${index + 1}`,
    url: url.href,
    publisher: url.hostname,
    title: clean(
      html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? url.hostname,
    ).slice(0, 120),
    publishedAt: null,
    retrievedAt: now.toISOString(),
    contentDigest: createHash('sha256').update(body).digest('hex'),
    excerpt,
  };
}

export async function collectResearchSources(
  urls: string[],
  signal: AbortSignal,
): Promise<ResearchSource[]> {
  return Promise.all(
    urls.map(async (value, index) => {
      const boundedSignal = AbortSignal.any([
        signal,
        AbortSignal.timeout(12_000),
      ]);
      try {
        const page = await download(validateSourceUrl(value), boundedSignal);
        return sourceFromPage(page.url, page.body, index);
      } catch (error) {
        if (error instanceof AiRequestError) throw error;
        throw new AiRequestError(
          'A source could not be read in time. Try a different public source.',
          422,
        );
      }
    }),
  );
}
