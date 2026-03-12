/**
 * Anti-bot proxy client for fetching pages protected by WAFs
 * (Akamai, Cloudflare, Imperva/Incapsula).
 *
 * Supports ZenRows and ScrapingBee. Falls back to regular fetch
 * when no proxy API key is configured.
 */

type ProxyProvider = 'zenrows' | 'scrapingbee' | 'none';

function getProxyProvider(): { provider: ProxyProvider; apiKey: string } {
  const zenrowsKey = process.env.ZENROWS_API_KEY;
  if (zenrowsKey) {
    return { provider: 'zenrows', apiKey: zenrowsKey };
  }

  const scrapingbeeKey = process.env.SCRAPINGBEE_API_KEY;
  if (scrapingbeeKey) {
    return { provider: 'scrapingbee', apiKey: scrapingbeeKey };
  }

  return { provider: 'none', apiKey: '' };
}

export function isProxyConfigured(): boolean {
  return getProxyProvider().provider !== 'none';
}

/**
 * Fetch a URL through a proxy service that handles anti-bot protection.
 *
 * When a proxy is configured the target URL is passed as a query parameter
 * to the proxy API, which renders JavaScript and returns the response.
 *
 * If no proxy is configured, falls back to a plain `fetch`.
 */
export async function fetchWithProxy(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const { provider, apiKey } = getProxyProvider();

  if (provider === 'none') {
    console.warn('[proxy] No proxy API key configured – falling back to direct fetch');
    return fetch(url, options);
  }

  const encodedUrl = encodeURIComponent(url);
  let proxyUrl: string;

  if (provider === 'zenrows') {
    proxyUrl = `https://api.zenrows.com/v1/?apikey=${apiKey}&url=${encodedUrl}&js_render=true`;
  } else {
    // scrapingbee
    proxyUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodedUrl}&render_js=true`;
  }

  console.log(`[proxy] Fetching via ${provider}: ${url}`);

  // Proxy services expect a GET; we forward relevant headers but strip
  // host/origin since the proxy will set its own.
  const headers = new Headers(options?.headers);
  headers.delete('host');
  headers.delete('origin');

  const response = await fetch(proxyUrl, {
    method: 'GET',
    headers,
    signal: options?.signal,
  });

  if (!response.ok) {
    console.error(
      `[proxy] ${provider} returned ${response.status} for ${url}`,
    );
  }

  return response;
}
