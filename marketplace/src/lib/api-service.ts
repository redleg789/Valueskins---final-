/**
 * Production API Service Layer
 * Centralized API client with error handling, retries, and real-time integration
 * All backend calls go through here
 */

import { RealtimeClient, RealtimeMessage } from './realtime-client';

// API Configuration with environment scaffolding
const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080',
  WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: Record<string, any>;
}

interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  timestamp: string;
}

class ApiService {
  private realtimeClient: RealtimeClient | null = null;
  private baseUrl: string;
  private timeout: number;
  private retryAttempts: number;

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
    this.timeout = API_CONFIG.TIMEOUT;
    this.retryAttempts = API_CONFIG.RETRY_ATTEMPTS;
  }

  /**
   * Initialize real-time client for broadcasting updates
   */
  initializeRealtime(userId: number): void {
    this.realtimeClient = new RealtimeClient(API_CONFIG.WS_URL, userId);
    this.realtimeClient.connect().catch(e => {
      console.error('[ApiService] Failed to initialize realtime:', e);
    });
  }

  /**
   * Core HTTP request with retries and error handling
   */
  private async request<T>(
    method: string,
    endpoint: string,
    options: {
      body?: any;
      headers?: Record<string, string>;
      retries?: number;
    } = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': this.generateRequestId(),
      ...options.headers,
    };

    // Add auth token if available
    const token = this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const attemptRequest = async (attempt = 0): Promise<Response> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
          credentials: 'include',
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error: any) {
        const isRetryable = error.name === 'AbortError' || error.code === 'ECONNREFUSED';
        const shouldRetry = isRetryable && attempt < (options.retries ?? this.retryAttempts);

        if (shouldRetry) {
          await this.delay(API_CONFIG.RETRY_DELAY * Math.pow(2, attempt));
          return attemptRequest(attempt + 1);
        }

        throw error;
      }
    };

    try {
      const response = await attemptRequest();

      // Handle HTTP errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw {
          code: `HTTP_${response.status}`,
          message: errorData.error || `HTTP ${response.status}`,
          status: response.status,
          details: errorData,
        } as ApiError;
      }

      const data = await response.json();
      return {
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      const apiError: ApiError = {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'Unknown error',
        status: error.status || 0,
        details: error.details,
      };

      console.error(`[ApiService] ${method} ${endpoint} failed:`, apiError);

      return {
        error: apiError,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: any): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint, options);
  }

  /**
   * POST request with real-time broadcasting
   */
  async post<T>(endpoint: string, body?: any, options?: any): Promise<ApiResponse<T>> {
    const response = await this.request<T>('POST', endpoint, { ...options, body });

    // Broadcast real-time update if successful
    if (response.data && this.realtimeClient?.isConnected()) {
      this.broadcastUpdate(endpoint, response.data);
    }

    return response;
  }

  /**
   * PATCH request with real-time broadcasting
   */
  async patch<T>(endpoint: string, body?: any, options?: any): Promise<ApiResponse<T>> {
    const response = await this.request<T>('PATCH', endpoint, { ...options, body });

    // Broadcast real-time update if successful
    if (response.data && this.realtimeClient?.isConnected()) {
      this.broadcastUpdate(endpoint, response.data);
    }

    return response;
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: any): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint, options);
  }

  /**
   * Broadcast update to real-time clients
   */
  private broadcastUpdate(endpoint: string, data: any): void {
    if (!this.realtimeClient) return;

    let eventType: string = 'data_updated';

    if (endpoint.includes('/campaigns')) {
      eventType = endpoint.includes('POST') ? 'campaign_created' : 'campaign_updated';
    } else if (endpoint.includes('/deals')) {
      eventType = endpoint.includes('POST') ? 'deal_created' : 'deal_updated';
    } else if (endpoint.includes('/messages')) {
      eventType = 'message_sent';
    } else if (endpoint.includes('/applications')) {
      eventType = 'application_received';
    }

    this.realtimeClient.send({
      event_type: eventType,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Utility: delay for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Utility: generate request ID for tracing
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Utility: get auth token (placeholder - implement based on your auth system)
   */
  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    // TODO: Get from your auth system (AuthContext, localStorage, etc.)
    return localStorage.getItem('auth_token');
  }

  /**
   * Utility: check if API is healthy
   */
  async health(): Promise<boolean> {
    const response = await this.get('/health');
    return !response.error;
  }
}

// Singleton instance
export const apiService = new ApiService();

// ──────────────────────────────────────────────────────────────────────────────
// Feature-specific API methods (organized by domain)
// ──────────────────────────────────────────────────────────────────────────────

export const api = {
  // ── Auth ──
  auth: {
    login: (email: string, password: string) =>
      apiService.post('/api/v1/auth/login', { email, password }),
    signup: (email: string, password: string, displayName: string) =>
      apiService.post('/api/v1/auth/signup', { email, password, display_name: displayName }),
    logout: () => apiService.post('/api/v1/auth/logout'),
    refresh: () => apiService.post('/api/v1/auth/refresh'),
  },

  // ── Users ──
  users: {
    me: () => apiService.get('/api/v1/users/me'),
    getProfile: (userId: number) => apiService.get(`/api/v1/users/${userId}`),
    updateProfile: (userId: number, updates: any) =>
      apiService.patch(`/api/v1/users/${userId}`, updates),
  },

  // ── Creators ──
  creators: {
    list: (filters?: any) => apiService.get('/api/v1/creators', { body: filters }),
    get: (creatorId: number) => apiService.get(`/api/v1/creators/${creatorId}`),
    create: (data: any) => apiService.post('/api/v1/creators', data),
    update: (creatorId: number, data: any) =>
      apiService.patch(`/api/v1/creators/${creatorId}`, data),
    search: (query: string) => apiService.get(`/api/v1/creators/search?q=${encodeURIComponent(query)}`),
    match: (brandValueSkin: string, limit = 50) =>
      apiService.get(`/api/v1/creators/match?brandValueSkin=${encodeURIComponent(brandValueSkin)}&limit=${limit}`),
  },

  // ── Campaigns ──
  campaigns: {
    list: (filters?: any) => apiService.get('/api/v1/campaigns', { body: filters }),
    get: (campaignId: number) => apiService.get(`/api/v1/campaigns/${campaignId}`),
    create: (data: any) => apiService.post('/api/v1/campaigns', data),
    update: (campaignId: number, data: any) =>
      apiService.patch(`/api/v1/campaigns/${campaignId}`, data),
    delete: (campaignId: number) => apiService.delete(`/api/v1/campaigns/${campaignId}`),
  },

  // ── Deals ──
  deals: {
    list: (filters?: any) => apiService.get('/api/v1/deals', { body: filters }),
    get: (dealId: number) => apiService.get(`/api/v1/deals/${dealId}`),
    create: (data: any) => apiService.post('/api/v1/deals', data),
    update: (dealId: number, data: any) =>
      apiService.patch(`/api/v1/deals/${dealId}`, data),
    delete: (dealId: number) => apiService.delete(`/api/v1/deals/${dealId}`),

    // Deal-specific operations
    sendOffer: (dealId: number, amount: number, terms: any) =>
      apiService.post(`/api/v1/deals/${dealId}/offer`, { amount, terms }),
    acceptOffer: (dealId: number) => apiService.post(`/api/v1/deals/${dealId}/accept`),
    rejectOffer: (dealId: number) => apiService.post(`/api/v1/deals/${dealId}/reject`),
    counterOffer: (dealId: number, amount: number) =>
      apiService.post(`/api/v1/deals/${dealId}/counter`, { amount }),
  },

  // ── Messages & Chat ──
  messages: {
    list: (dealId: number, limit = 50) =>
      apiService.get(`/api/v1/deals/${dealId}/messages?limit=${limit}`),
    send: (dealId: number, text: string) =>
      apiService.post(`/api/v1/deals/${dealId}/messages`, { text }),
    get: (messageId: number) => apiService.get(`/api/v1/messages/${messageId}`),
    delete: (messageId: number) => apiService.delete(`/api/v1/messages/${messageId}`),
  },

  // ── Applications ──
  applications: {
    list: (filters?: any) => apiService.get('/api/v1/applications', { body: filters }),
    get: (appId: number) => apiService.get(`/api/v1/applications/${appId}`),
    create: (campaignId: number, creatorId: number) =>
      apiService.post('/api/v1/applications', { campaign_id: campaignId, creator_id: creatorId }),
    update: (appId: number, data: any) =>
      apiService.patch(`/api/v1/applications/${appId}`, data),
    approve: (appId: number) => apiService.post(`/api/v1/applications/${appId}/approve`),
    reject: (appId: number) => apiService.post(`/api/v1/applications/${appId}/reject`),
  },

  // ── Deliverables & Files ──
  files: {
    upload: (dealId: number, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiService.post(`/api/v1/deals/${dealId}/upload`, formData);
    },
    list: (dealId: number) => apiService.get(`/api/v1/deals/${dealId}/deliverables`),
    download: (fileId: number) => `${API_CONFIG.BASE_URL}/api/v1/files/${fileId}/download`,
    delete: (fileId: number) => apiService.delete(`/api/v1/files/${fileId}`),
  },

  // ── Notifications ──
  notifications: {
    list: () => apiService.get('/api/v1/notifications'),
    markAsRead: (notificationId: number) =>
      apiService.patch(`/api/v1/notifications/${notificationId}`, { read: true }),
    delete: (notificationId: number) => apiService.delete(`/api/v1/notifications/${notificationId}`),
  },

  // ── Health & Status ──
  health: () => apiService.get('/health'),
};

// Export for testing/mocking
export { ApiService, API_CONFIG };
