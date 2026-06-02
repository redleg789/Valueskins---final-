'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: number;
  sender: 'me' | 'brand';
  text: string;
  timestamp: string;
  type: 'message' | 'status';
}

interface DealRoomChatProps {
  dealId: string;
  brandName: string;
  initialMessages: Message[];
  onSendMessage: (text: string) => void;
}

export default function DealRoomChat({
  dealId,
  brandName,
  initialMessages,
  onSendMessage,
}: DealRoomChatProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: messages.length + 1,
      sender: 'me',
      text: inputText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'message',
    };

    setMessages([...messages, newMessage]);
    onSendMessage(inputText);
    setInputText('');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb',
        }}
      >
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: 0 }}>
          Deal with {brandName}
        </h3>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>
          Status: In Progress
        </p>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.sender === 'me' ? 'flex-end' : 'flex-start',
            }}
          >
            {msg.type === 'status' ? (
              <div
                style={{
                  fontSize: '11px',
                  color: '#9ca3af',
                  textAlign: 'center',
                  width: '100%',
                  padding: '8px',
                }}
              >
                {msg.text}
              </div>
            ) : (
              <div
                style={{
                  maxWidth: '70%',
                  background: msg.sender === 'me' ? '#2563eb' : '#f3f4f6',
                  color: msg.sender === 'me' ? '#ffffff' : '#1f2937',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  wordBreak: 'break-word',
                }}
              >
                <div>{msg.text}</div>
                <div
                  style={{
                    fontSize: '11px',
                    opacity: 0.7,
                    marginTop: '6px',
                  }}
                >
                  {msg.timestamp}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid #e5e7eb',
          background: '#ffffff',
          display: 'flex',
          gap: '8px',
        }}
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type your message..."
          style={{
            flex: 1,
            padding: '10px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          style={{
            padding: '10px 16px',
            background: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
