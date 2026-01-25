import React from 'react';
import Head from 'next/head';
import { ChatInterface } from '../components/chat/ChatInterface';

export default function ChatPage() {
  return (
    <>
      <Head>
        <title>VoiceInvoice - Finanz-Assistent</title>
      </Head>
      <ChatInterface />
    </>
  );
}
