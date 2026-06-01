'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: number;
  sender: 'me' | 'brand';
  text: string;
  timestamp: string;
  fullTimestamp: string;
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
  const [showTimestampWarning, setShowTimestampWarning] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleCalendarExport = () => {
    window.location.href = `/api/deals/calendar-export?dealId=${dealId}`;
  };

  const handleSend = () => {
    if (!inputText.trim()) return;

    const now = new Date();
    const fullTimestamp = now.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const newMessage: Message = {
      id: messages.length + 1,
      sender: 'me',
      text: inputText,
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fullTimestamp: fullTimestamp,
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
      {/* Documentation Warning Banner */}
      {showTimestampWarning && (
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(245, 158, 11, 0.1)',
            borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
            fontSize: '12px',
            color: '#92400e',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <strong>⚠️ Documentation Priority:</strong> All messages are logged with exact timestamps for dispute resolution. Do not share personal information. This chat is ONLY for deal documentation.
          </div>
          <button
            onClick={() => setShowTimestampWarning(false)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              color: '#92400e',
              padding: '0 8px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: 0 }}>
            Deal with {brandName}
          </h3>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>
            Status: In Progress
          </p>
        </div>
        <button
          onClick={handleCalendarExport}
          style={{
            padding: '8px 12px',
            background: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          title="Export deal deadline to your calendar (Google, Apple, Outlook)"
        >
          📅 Add to Calendar
        </button>
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
                    fontSize: '10px',
                    opacity: 0.65,
                    marginTop: '6px',
                    fontFamily: 'monospace',
                  }}
                  title={msg.fullTimestamp}
                >
                  {msg.fullTimestamp || msg.timestamp}
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
          onKeyDown={(e) => {
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
