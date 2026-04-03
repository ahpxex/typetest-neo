import { APP_BASE_URL, TRUST_PROXY_HEADERS, isDevelopment } from '@/lib/env';

type RequestOriginValidationInput = {
  appBaseUrl?: string;
  host?: string | null;
  forwardedHost?: string | null;
  origin?: string | null;
  referer?: string | null;
  trustProxyHeaders?: boolean;
  allowMissingOriginInDevelopment?: boolean;
  isDev?: boolean;
};

function normalizeHeaderHost(value?: string | null) {
  return value?.split(',')[0]?.trim().toLowerCase() || null;
}

function getUrlHost(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

function isHttpUrl(value?: string | null) {
  if (!value) {
    return false;
  }

  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export function isTrustedSameOriginRequest({
  appBaseUrl = APP_BASE_URL,
  host,
  forwardedHost,
  origin,
  referer,
  trustProxyHeaders = TRUST_PROXY_HEADERS,
  allowMissingOriginInDevelopment = true,
  isDev = isDevelopment,
}: RequestOriginValidationInput) {
  const allowedHosts = new Set<string>();
  const appBaseUrlHost = getUrlHost(appBaseUrl);

  if (appBaseUrlHost) {
    allowedHosts.add(appBaseUrlHost);
  }

  const normalizedHost = normalizeHeaderHost(host);
  if (normalizedHost) {
    allowedHosts.add(normalizedHost);
  }

  if (trustProxyHeaders) {
    const normalizedForwardedHost = normalizeHeaderHost(forwardedHost);
    if (normalizedForwardedHost) {
      allowedHosts.add(normalizedForwardedHost);
    }
  }

  const candidate = origin ?? referer;

  if (!candidate) {
    return allowMissingOriginInDevelopment && isDev;
  }

  if (!isHttpUrl(candidate)) {
    return false;
  }

  const candidateHost = getUrlHost(candidate);
  return candidateHost !== null && allowedHosts.has(candidateHost);
}

export function getTrustedRequestIp(headers: Headers) {
  if (!TRUST_PROXY_HEADERS) {
    return null;
  }

  const forwardedFor = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');
  return forwardedFor?.split(',')[0]?.trim() ?? realIp?.trim() ?? null;
}
