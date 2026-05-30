// API Client - connects to Rust backend instead of Firebase
// Replaces firebase.ts for production

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8081';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

interface User {
  id: string;
  email: string;
  username: string;
  role: string;
}

interface Session {
  userId: string;
  expiresAt: number;
}

// Token management
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== 'undefined') {
    authToken = localStorage.getItem('auth_token');
  }
  return authToken;
}

// API call helper
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { error: data.error || 'Request failed' };
    }
    
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Network error' };
  }
}

// Auth API
export const auth = {
  async register(email: string, password: string, username: string) {
    const result = await apiCall<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username }),
    });
    
    if (result.data?.token) {
      setAuthToken(result.data.token);
    }
    
    return result;
  },
  
  async login(email: string, password: string) {
    const result = await apiCall<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (result.data?.token) {
      setAuthToken(result.data.token);
    }
    
    return result;
  },
  
  async logout() {
    const result = await apiCall<void>('/api/v1/auth/logout', {
      method: 'POST',
    });
    
    setAuthToken(null);
    return result;
  },
  
  async me() {
    return apiCall<User>('/api/v1/auth/me', {
      method: 'GET',
    });
  },
  
  async refresh() {
    const result = await apiCall<AuthResponse>('/api/v1/auth/refresh', {
      method: 'POST',
    });
    
    if (result.data?.token) {
      setAuthToken(result.data.token);
    }
    
    return result;
  },
};

// Profiles API
export const profiles = {
  async list(params?: { limit?: number; offset?: number; role?: string }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.role) query.set('role', params.role);
    
    return apiCall<{ profiles: Profile[] }>(`/api/v1/profiles?${query}`);
  },
  
  async get(userId: string) {
    return apiCall<Profile>(`/api/v1/profiles/${userId}`);
  },
  
  async update(userId: string, data: Partial<Profile>) {
    return apiCall<Profile>(`/api/v1/profiles/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};

interface Profile {
  id: string;
  username: string;
  email: string;
  bio?: string;
  role: string;
  avatarUrl?: string;
  niche?: string;
  stats?: {
    followers: number;
    engagement: number;
    deals: number;
  };
}

// Deals API
export const deals = {
  async list(params?: { status?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    
    return apiCall<{ deals: Deal[] }>(`/api/v1/deals?${query}`);
  },
  
  async get(dealId: string) {
    return apiCall<Deal>(`/api/v1/deals/${dealId}`);
  },
  
  async create(data: CreateDealInput) {
    return apiCall<Deal>('/api/v1/deals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  async update(dealId: string, data: Partial<Deal>) {
    return apiCall<Deal>(`/api/v1/deals/${dealId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  
  async apply(dealId: string, data: ApplyDealInput) {
    return apiCall<DealApplication>(`/api/v1/deals/${dealId}/apply`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

interface Deal {
  id: string;
  title: string;
  description: string;
  brand: string;
  budget: number;
  status: string;
  requirements: string[];
  createdAt: string;
}

interface CreateDealInput {
  title: string;
  description: string;
  brand: string;
  budget: number;
  requirements: string[];
}

interface ApplyDealInput {
  pitch: string;
  proposedPrice: number;
  portfolio: string[];
}

// Messages API
export const messages = {
  async list(roomId: string, params?: { limit?: number; before?: string }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.before) query.set('before', params.before);
    
    return apiCall<{ messages: Message[] }>(`/api/v1/messages/${roomId}?${query}`);
  },
  
  async send(roomId: string, content: string) {
    return apiCall<Message>(`/api/v1/messages/send`, {
      method: 'POST',
      body: JSON.stringify({ roomId, content }),
    });
  },
};

interface Message {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

// WebSocket client
class WsClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private messageQueue: Array<{ type: string; data: unknown }> = [];
  
  connect(roomId: string, token?: string) {
    return new Promise<void>((resolve, reject) => {
      const wsUrl = `${WS_URL}/ws/deal-rooms/${roomId}${token ? `?token=${token}` : ''}`;
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        resolve();
      };
      
      this.ws.onerror = (error) => {
        reject(error);
      };
      
      this.ws.onclose = () => {
        this.attemptReconnect(roomId, token);
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.emit(message.type, message.data);
        } catch {
          console.error('Invalid message:', event.data);
        }
      };
    });
  }
  
  private attemptReconnect(roomId: string, token?: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', { message: 'Max reconnect attempts reached' });
      return;
    }
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect(roomId, token);
    }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
  }
  
  send(type: string, data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    } else {
      this.messageQueue.push({ type, data });
    }
  }
  
  on(type: string, callback: (data: unknown) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
  }
  
  off(type: string, callback: (data: unknown) => void) {
    this.listeners.get(type)?.delete(callback);
  }
  
  private emit(type: string, data: unknown) {
    this.listeners.get(type)?.forEach((callback) => callback(data));
  }
  
  close() {
    this.ws?.close();
    this.ws = null;
  }
}

export const wsClient = new WsClient();

// Export for use in app
export default {
  auth,
  profiles,
  deals,
  messages,
  ws: wsClient,
  setAuthToken,
  getAuthToken,
};