/**
 * VoiceInvoice Desktop Application - Main Page
 *
 * This is a placeholder page that will be replaced with the
 * full voice-to-invoice UI in Subagent #2.
 *
 * @module pages/index
 */

import React from 'react';

/**
 * Home page component for VoiceInvoice.
 *
 * Displays a placeholder UI until the full implementation
 * is completed in subsequent subagents.
 *
 * @returns {React.ReactElement} The rendered home page
 */
export default function Home(): React.ReactElement {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">VoiceInvoice Enterprise</h1>
        <p className="text-lg text-gray-600">Voice-First Buchhaltungsanwendung</p>
        <p className="text-sm text-gray-400 mt-8">Placeholder - Implementation in Subagent #2</p>
      </div>
    </main>
  );
}
