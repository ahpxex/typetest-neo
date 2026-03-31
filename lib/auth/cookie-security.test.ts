import { describe, expect, it } from 'bun:test';

import { inferSecureCookie } from './cookie-security';

describe('inferSecureCookie', () => {
  it('disables secure cookies in development', () => {
    expect(inferSecureCookie({
      appBaseUrl: 'https://example.com',
      isDevelopment: true,
    })).toBe(false);
  });

  it('honors an explicit https forwarded proto header', () => {
    expect(inferSecureCookie({
      appBaseUrl: 'http://10.27.64.9',
      forwardedProto: 'https',
      isDevelopment: false,
    })).toBe(true);
  });

  it('honors an explicit http forwarded proto header', () => {
    expect(inferSecureCookie({
      appBaseUrl: 'https://example.com',
      forwardedProto: 'http',
      isDevelopment: false,
    })).toBe(false);
  });

  it('falls back to the forwarded header proto when x-forwarded-proto is absent', () => {
    expect(inferSecureCookie({
      appBaseUrl: 'http://10.27.64.9',
      forwarded: 'for=127.0.0.1;proto=https;host=example.com',
      isDevelopment: false,
    })).toBe(true);
  });

  it('uses the current request origin when proxy headers are unavailable', () => {
    expect(inferSecureCookie({
      appBaseUrl: 'https://example.com',
      isDevelopment: false,
      origin: 'http://10.27.64.9',
      referer: 'http://10.27.64.9/admin/login',
    })).toBe(false);
  });

  it('falls back to APP_BASE_URL as a last resort', () => {
    expect(inferSecureCookie({
      appBaseUrl: 'https://example.com',
      isDevelopment: false,
    })).toBe(true);
  });
});
