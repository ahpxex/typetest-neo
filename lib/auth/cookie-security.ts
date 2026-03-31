type InferSecureCookieOptions = {
  appBaseUrl: string;
  forwarded?: string | null;
  forwardedProto?: string | null;
  isDevelopment: boolean;
  origin?: string | null;
  referer?: string | null;
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

export function inferSecureCookie({
  appBaseUrl,
  forwarded,
  forwardedProto,
  isDevelopment,
  origin,
  referer,
}: InferSecureCookieOptions) {
  if (isDevelopment) {
    return false;
  }

  const normalizedForwardedProto = forwardedProto?.split(',')[0]?.trim().toLowerCase();

  if (normalizedForwardedProto === 'https') {
    return true;
  }

  if (normalizedForwardedProto === 'http') {
    return false;
  }

  const forwardedMatch = forwarded?.match(/proto=(https?)/i)?.[1]?.toLowerCase();

  if (forwardedMatch === 'https') {
    return true;
  }

  if (forwardedMatch === 'http') {
    return false;
  }

  const requestProtocol = getUrlProtocol(origin) ?? getUrlProtocol(referer);

  if (requestProtocol === 'https:') {
    return true;
  }

  if (requestProtocol === 'http:') {
    return false;
  }

  return isHttpsUrl(appBaseUrl);
}
