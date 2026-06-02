/**
 * Real-time WebSocket client for ValueSkins
 * Connects to Render backend /ws endpoint
 * Broadcasts deal/campaign/message updates to all connected clients
 * Enables 2-device sync: brand + creator see updates instantly
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export type RealtimeEventType =
  | 'deal_created'
  | 'deal_updated'
  | 'campaign_created'
  | 'campaign_updated'
  | 'message_sent'
  | 'notification'
  | 'application_received'
  | 'offer_received';

export interface RealtimeMessage {
  event_type: RealtimeEventType;
  user_id: number;
  data: Record<string, any>;
  timestamp: string;
}

interface WSMessage {
  action?: string;
  user_id?: number;
  room_id?: string;
  status?: string;
  error?: string;
  event_type?: RealtimeEventType;
  data?: Record<string, any>;
  timestamp?: string;
}

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private url: string;
  private userId: number;
  private listeners: Map<RealtimeEventType | 'any', Set<(msg: RealtimeMessage) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isManualClose = false;

  constructor(url: string, userId: number) {
    this.url = url;
    this.userId = userId;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[Realtime] Connected to backend');
          this.reconnectAttempts = 0;

          // Send subscription message
          this.send({
            action: 'subscribe',
            user_id: this.userId,
          });

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as WSMessage;

            // Handle subscription confirmation
            if (msg.status === 'subscribed') {
              console.log('[Realtime] Subscription confirmed', msg);
              return;
            }

            // Handle pong
            if (msg.status === 'pong') {
              console.log('[Realtime] Pong received');
              return;
            }

            // Handle real-time events
            if (msg.event_type && msg.data && msg.timestamp) {
              const realtimeMsg: RealtimeMessage = {
                event_type: msg.event_type,
                user_id: msg.user_id || this.userId,
                data: msg.data,
                timestamp: msg.timestamp,
              };
              this.dispatch(realtimeMsg);
            }
          } catch (e) {
            console.error('[Realtime] Failed to parse message:', e);
          }
        };

        this.ws.onerror = (event) => {
          console.error('[Realtime] WebSocket error:', event);
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = () => {
          console.log('[Realtime] Connection closed');
          if (!this.isManualClose) {
            this.attemptReconnect();
          }
        };
      } catch (e) {
        console.error('[Realtime] Connection failed:', e);
        reject(e);
      }
    });
  }

  /**
   * Send message to server
   */
  send(data: Record<string, any>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch (e) {
        console.error('[Realtime] Failed to send message:', e);
      }
    } else {
      console.warn('[Realtime] WebSocket not connected, message not sent');
    }
  }

  /**
   * Subscribe to event type
   */
  on(eventType: RealtimeEventType | 'any', callback: (msg: RealtimeMessage) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * Dispatch event to listeners
   */
  private dispatch(msg: RealtimeMessage): void {
    // Send to specific event type listeners
    const specificListeners = this.listeners.get(msg.event_type);
    if (specificListeners) {
      specificListeners.forEach(cb => {
        try {
          cb(msg);
        } catch (e) {
          console.error(`[Realtime] Listener error for ${msg.event_type}:`, e);
        }
      });
    }

    // Send to 'any' listeners
    const anyListeners = this.listeners.get('any');
    if (anyListeners) {
      anyListeners.forEach(cb => {
        try {
          cb(msg);
        } catch (e) {
          console.error('[Realtime] Listener error for "any":', e);
        }
      });
    }
  }

  /**
   * Ping server (keep-alive)
   */
  ping(): void {
    this.send({ action: 'ping' });
  }

  /**
   * Reconnect on connection loss
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Realtime] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[Realtime] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(e => {
        console.error('[Realtime] Reconnection failed:', e);
      });
    }, delay);
  }

  /**
   * Disconnect and clean up
   */
  disconnect(): void {
    this.isManualClose = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

/**
 * React hook for real-time updates
 */
export function useRealtime(userId: number) {
  const clientRef = useRef<RealtimeClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<RealtimeMessage | null>(null);

  useEffect(() => {
    if (!userId) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ||
      (typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? `wss://${window.location.host}/ws`
        : `ws://${window.location.host}/ws`);

    const client = new RealtimeClient(wsUrl, userId);
    clientRef.current = client;

    client
      .connect()
      .then(() => {
        setIsConnected(true);

        // Set up keep-alive ping every 30 seconds
        const pingInterval = setInterval(() => {
          if (client.isConnected()) {
            client.ping();
          }
        }, 30000);

        return () => clearInterval(pingInterval);
      })
      .catch(e => {
        console.error('[Realtime] Failed to connect:', e);
        setIsConnected(false);
      });

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, [userId]);

  const subscribe = useCallback((
    eventType: RealtimeEventType | 'any',
    callback: (msg: RealtimeMessage) => void
  ) => {
    if (clientRef.current) {
      return clientRef.current.on(eventType, callback);
    }
    return () => {};
  }, []);

  const send = useCallback((data: Record<string, any>) => {
    if (clientRef.current) {
      clientRef.current.send(data);
    }
  }, []);

  return {
    isConnected,
    lastMessage,
    subscribe,
    send,
    client: clientRef.current,
  };
}

/**
 * Global singleton for accessing realtime client
 */
let globalRealtimeClient: RealtimeClient | null = null;

export function getRealtimeClient(): RealtimeClient | null {
  return globalRealtimeClient;
}

export function setRealtimeClient(client: RealtimeClient | null): void {
  globalRealtimeClient = client;
}
