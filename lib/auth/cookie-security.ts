type InferSecureCookieOptions = {
  appBaseUrl: string;
  forwarded?: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  host?: string | null;
  isDevelopment: boolean;
  origin?: string | null;
  referer?: string | null;
  trustProxyHeaders?: boolean;
};

function isHttpsUrl(value?: string | null) {
  if (!value) {
    return false;
  }

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function getUrlProtocol(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).protocol;
  } catch {
    return null;
  }
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

function normalizeHeaderHost(value?: string | null) {
  return value?.split(',')[0]?.trim().toLowerCase() || null;
}

export function inferSecureCookie({
  appBaseUrl,
  forwarded,
  forwardedHost,
  forwardedProto,
  host,
  isDevelopment,
  origin,
  referer,
  trustProxyHeaders = false,
}: InferSecureCookieOptions) {
  if (isDevelopment) {
    return false;
  }

  const appBaseUrlHost = getUrlHost(appBaseUrl);
  const allowedHosts = new Set<string>();

  if (appBaseUrlHost) {
    allowedHosts.add(appBaseUrlHost);
  }

  const normalizedHost = normalizeHeaderHost(host);
  if (normalizedHost) {
    allowedHosts.add(normalizedHost);
  }

  const normalizedForwardedHost = normalizeHeaderHost(forwardedHost);
  if (trustProxyHeaders && normalizedForwardedHost) {
    allowedHosts.add(normalizedForwardedHost);
  }

  const proxyHost = normalizedForwardedHost ?? normalizedHost;

  if (trustProxyHeaders && proxyHost && allowedHosts.has(proxyHost)) {
    const normalizedForwardedProto = forwardedProto?.split(',')[0]?.trim().toLowerCase();

    if (normalizedForwardedProto === 'https') {
      return true;
    }

    if (normalizedForwardedProto === 'http') {
      return false;
    }
  }

  if (trustProxyHeaders) {
    const forwardedProtoMatch = forwarded?.match(/proto=(https?)/i)?.[1]?.toLowerCase();
    const forwardedHostMatch = forwarded?.match(/host=([^;,\s]+)/i)?.[1]?.toLowerCase() ?? null;

    if (forwardedHostMatch && allowedHosts.has(forwardedHostMatch)) {
      if (forwardedProtoMatch === 'https') {
        return true;
      }

      if (forwardedProtoMatch === 'http') {
        return false;
      }
    }
  }

  const originHost = getUrlHost(origin);
  const refererHost = getUrlHost(referer);
  const requestProtocol = allowedHosts.has(originHost ?? '')
    ? getUrlProtocol(origin)
    : allowedHosts.has(refererHost ?? '')
      ? getUrlProtocol(referer)
      : null;

  if (requestProtocol === 'https:') {
    return true;
  }

  if (requestProtocol === 'http:') {
    return false;
  }

  return isHttpsUrl(appBaseUrl);
}
