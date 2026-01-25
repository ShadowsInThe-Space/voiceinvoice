/**
 * Chat Page for RAG-based Financial Assistant
 *
 * Provides a conversational interface for querying invoices and documents
 * using Retrieval-Augmented Generation with Supabase Vector DB.
 *
 * @module pages/chat
 */

import React from 'react';
import Head from 'next/head';
import { ChatInterface } from '../components/chat/ChatInterface';

/**
 * Chat page component.
 *
 * @returns {React.ReactElement} The chat page
 */
export default function ChatPage(): React.ReactElement {
  return (
    <>
      <Head>
        <title>VoiceInvoice - Finanz-Assistent</title>
      </Head>
      <ChatInterface />
    </>
  );
}
