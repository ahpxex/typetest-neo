import { describe, expect, it } from 'bun:test';

import { isTrustedSameOriginRequest } from './request-security';

describe('isTrustedSameOriginRequest', () => {
  it('accepts same-origin requests that match the current host', () => {
    expect(isTrustedSameOriginRequest({
      appBaseUrl: 'https://example.com',
      host: 'example.com',
      origin: 'https://example.com',
      isDev: false,
      trustProxyHeaders: false,
    })).toBe(true);
  });

  it('rejects requests from a foreign origin', () => {
    expect(isTrustedSameOriginRequest({
      appBaseUrl: 'https://example.com',
      host: 'example.com',
      origin: 'https://evil.example',
      isDev: false,
      trustProxyHeaders: false,
    })).toBe(false);
  });

  it('accepts the configured public app origin even if the local host header is internal', () => {
    expect(isTrustedSameOriginRequest({
      appBaseUrl: 'https://example.com',
      host: 'internal:3000',
      forwardedHost: 'example.com',
      origin: 'https://example.com',
      isDev: false,
      trustProxyHeaders: false,
    })).toBe(true);
  });

  it('accepts trusted forwarded hosts when proxy trust is enabled', () => {
    expect(isTrustedSameOriginRequest({
      appBaseUrl: 'https://example.com',
      host: 'internal:3000',
      forwardedHost: 'example.com',
      origin: 'https://example.com',
      isDev: false,
      trustProxyHeaders: true,
    })).toBe(true);
  });

  it('allows missing origin only in development by default', () => {
    expect(isTrustedSameOriginRequest({
      appBaseUrl: 'http://localhost:3000',
      host: 'localhost:3000',
      isDev: true,
      trustProxyHeaders: false,
    })).toBe(true);

    expect(isTrustedSameOriginRequest({
      appBaseUrl: 'https://example.com',
      host: 'example.com',
      isDev: false,
      trustProxyHeaders: false,
    })).toBe(false);
  });
});
