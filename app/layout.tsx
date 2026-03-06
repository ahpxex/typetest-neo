import type { Metadata } from 'next';
import Script from 'next/script';
import { Geist, Geist_Mono } from 'next/font/google';

import { APP_DESCRIPTION, APP_NAME } from '@/lib/env';

import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        {process.env.NODE_ENV === 'development' && (
          <Script
            src='//unpkg.com/react-grab/dist/index.global.js'
            crossOrigin='anonymous'
            strategy='beforeInteractive'
            data-options={JSON.stringify({
              activationKey: 'Meta+K',
              activationMode: 'toggle',
              allowActivationInsideInput: false,
              maxContextLines: 50,
            })}
          />
        )}
        {process.env.NODE_ENV === 'development' && (
          <Script
            src='//unpkg.com/@react-grab/codex/dist/client.global.js'
            strategy='lazyOnload'
          />
        )}
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} bg-zinc-50 text-zinc-950 antialiased`}>
        {children}
      </body>
    </html>
  );
}
