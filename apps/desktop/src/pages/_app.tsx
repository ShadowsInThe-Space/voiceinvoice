/**
 * Next.js App Component
 *
 * Wraps all pages with global providers and styles.
 *
 * @module pages/_app
 */

import type { AppProps } from 'next/app';
import React from 'react';

/**
 * Application wrapper component.
 *
 * @param {AppProps} props - Next.js app props
 * @returns {React.ReactElement} The wrapped application
 */
export default function App({ Component, pageProps }: AppProps): React.ReactElement {
  return <Component {...pageProps} />;
}
