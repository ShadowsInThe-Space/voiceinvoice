/**
 * Message Bubble Component for Chat Interface
 *
 * Displays a single message in the chat conversation with role-based styling.
 *
 * @module components/chat/MessageBubble
 */

import React from 'react';
import { cn } from '../../lib/utils';
import { User, Bot } from 'lucide-react';

/**
 * Props for the MessageBubble component.
 *
 * @param {string} role - Message role (user or assistant)
 * @param {string} content - Message text content
 */
export interface MessageBubbleProps {
  /**
   * The role of the message sender.
   */
  role: 'user' | 'assistant';
  /**
   * The text content of the message.
   */
  content: string;
}

/**
 * Message bubble component with role-based styling.
 *
 * Displays user messages on the right with primary color,
 * and assistant messages on the left with muted styling.
 *
 * @param {MessageBubbleProps} props - Component props
 * @returns {React.ReactElement} The message bubble component
 */
export function MessageBubble({ role, content }: MessageBubbleProps): React.ReactElement {
  const isUser = role === 'user';

  return (
    <div className={cn('flex w-full gap-4 p-4', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {isUser ? <User className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </div>
      <div
        className={cn(
          'flex max-w-[80%] flex-col gap-2 rounded-2xl px-4 py-3 text-sm',
          isUser ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted rounded-tl-none'
        )}
      >
        <div className="whitespace-pre-wrap leading-relaxed">{content}</div>
      </div>
    </div>
  );
}
