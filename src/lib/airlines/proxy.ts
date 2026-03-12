/**
 * Bright Data residential proxy for fetching pages protected by WAFs
 * (Akamai, Cloudflare, Imperva/Incapsula).
 *
 * Uses Bright Data's residential proxy network with Israel IPs.
 * Supports full GET/POST passthrough with headers and body.
 */

// @ts-ignore
import { HttpsProxyAgent } from 'https-proxy-agent';

const BRIGHT_DATA_HOST = 'brd.superproxy.io';
const BRIGHT_DATA_PORT = '33335';
const BRIGHT_DATA_USERNAME = 'brd-customer-hl_42a4df75-zone-residential_proxy1';
const BRIGHT_DATA_PASSWORD = '5c8o5y2jk48o';

let proxyAgent: HttpsProxyAgent<string> | null = null;

function getProxyAgent(): HttpsProxyAgent<string> {
  if (!proxyAgent) {
    const proxyUrl = `http://${BRIGHT_DATA_USERNAME}:${BRIGHT_DATA_PASSWORD}@${BRIGHT_DATA_HOST}:${BRIGHT_DATA_PORT}`;
    proxyAgent = new HttpsProxyAgent(proxyUrl);
  }
  return proxyAgent;
}

export function isProxyConfigured(): boolean {
  return true; // Bright Data credentials are always available
}

/**
 * Fetch a URL through the Bright Data residential proxy.
 * Full passthrough: method, headers, body all go through as-is.
 */
export async function fetchWithProxy(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const agent = getProxyAgent();

  console.log(`[proxy] Fetching via Bright Data: ${url}`);

  try {
    const response = await fetch(url, {
      ...options,
      // @ts-expect-error Node.js fetch supports agent option
      agent,
    });

    if (!response.ok) {
      console.error(
        `[proxy] Bright Data request returned ${response.status} for ${url}`,
      );
    }

    return response;
  } catch (error) {
    console.error(`[proxy] Bright Data fetch failed for ${url}:`, error);
    throw error;
  }
}
