import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MessageBubble } from '../../../src/components/chat/MessageBubble';

describe('MessageBubble', () => {
  it('renders user message correctly', () => {
    render(<MessageBubble role="user" content="Hello World" />);
    expect(screen.getByText('Hello World')).toBeDefined();
  });

  it('renders assistant message correctly', () => {
    render(<MessageBubble role="assistant" content="I am a bot" />);
    expect(screen.getByText('I am a bot')).toBeDefined();
  });
});
