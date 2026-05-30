// Backend client for revenue protection systems
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

export interface BackendResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function makeRequest<T>(
  method: string,
  endpoint: string,
  body?: any,
  userId?: number,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (userId) {
    headers['x-user-id'] = userId.toString();
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BACKEND_URL}${endpoint}`, options);

  if (!response.ok) {
    throw new Error(`Backend error: ${response.statusText}`);
  }

  return response.json();
}

export const backendClient = {
  // Contact masking
  async filterMessage(
    roomId: number,
    message: string,
  ) {
    return makeRequest(
      'POST',
      '/api/v1/deal-rooms/contact-mask/filter',
      { room_id: roomId, message },
    );
  },

  async unmaskContact(roomId: number, userId: number) {
    return makeRequest(
      'POST',
      '/api/v1/deal-rooms/contact-mask/unmask',
      { room_id: roomId },
      userId,
    );
  },

  async getMaskingStatus(roomId: number) {
    return makeRequest('GET', `/api/v1/deal-rooms/${roomId}/contact-mask/status`);
  },

  // Device fingerprinting
  async recordDeviceFingerprint(
    userId: number,
    fingerprint: {
      userAgent: string;
      ipAddress: string;
      canvasFingerprint?: string;
      webglFingerprint?: string;
      timezone?: string;
    },
  ) {
    return makeRequest(
      'POST',
      '/api/v1/security/device-fingerprint',
      {
        user_agent: fingerprint.userAgent,
        ip_address: fingerprint.ipAddress,
        canvas_fingerprint: fingerprint.canvasFingerprint,
        webgl_fingerprint: fingerprint.webglFingerprint,
        timezone: fingerprint.timezone,
      },
      userId,
    );
  },

  async getIdentityStatus(userId: number) {
    return makeRequest('GET', '/api/v1/security/identity-status', undefined, userId);
  },

  // Rate limiting
  async checkRateLimit(userId: number | undefined, ipAddress: string, endpoint: string) {
    return makeRequest(
      'POST',
      '/api/v1/security/rate-limit/check',
      { endpoint },
      userId,
    );
  },

  // Ratings
  async checkRatingGates(dealId: number, userId: number) {
    return makeRequest('GET', `/api/v1/deals/${dealId}/ratings/can-rate`, undefined, userId);
  },

  async submitRating(
    dealId: number,
    userId: number,
    score: number,
    review?: string,
  ) {
    return makeRequest(
      'POST',
      `/api/v1/deals/${dealId}/ratings/submit`,
      { score, review },
      userId,
    );
  },

  // Deal structure
  async createDealStructure(
    creatorId: number,
    brandId: number,
    title: string,
    description: string,
    totalValueCents: number,
  ) {
    return makeRequest(
      'POST',
      '/api/v1/deals/create-structure',
      {
        creator_id: creatorId,
        brand_id: brandId,
        title,
        description,
        total_value_cents: totalValueCents,
      },
    );
  },

  async addDeliverable(dealId: number, name: string, description: string) {
    return makeRequest('POST', `/api/v1/deals/${dealId}/add-deliverable`, {
      name,
      description,
    });
  },

  async proposeDealNegotiation(dealId: number, userId: number, changeField: string, proposedValue: any) {
    return makeRequest(
      'POST',
      `/api/v1/deals/${dealId}/negotiate`,
      { change_field: changeField, proposed_value: proposedValue },
      userId,
    );
  },

  async lockDealStructure(dealId: number) {
    return makeRequest('POST', `/api/v1/deals/${dealId}/lock`, {});
  },

  // Loyalty
  async getUserLevel(userId: number) {
    return makeRequest('GET', '/api/v1/loyalty/user-level', undefined, userId);
  },

  async getLoyaltyStatus(userId: number) {
    return makeRequest('GET', '/api/v1/loyalty/status', undefined, userId);
  },

  async subscribeToCreatorTool(
    userId: number,
    toolType: string,
  ) {
    return makeRequest(
      'POST',
      '/api/v1/loyalty/subscribe-tool',
      { tool_type: toolType },
      userId,
    );
  },

  // Disputes
  async initiateDis(
    dealId: number,
    userId: number,
    disputeType: string,
    claim: string,
    evidenceUrls?: string[],
  ) {
    return makeRequest(
      'POST',
      '/api/v1/disputes/open',
      {
        deal_id: dealId,
        dispute_type: disputeType,
        claim,
        evidence_urls: evidenceUrls,
      },
      userId,
    );
  },

  async resolveDispute(
    disputeId: string,
    arbitratorId: number,
    ruling: string,
    payoutAdjustment: number,
  ) {
    return makeRequest(
      'POST',
      `/api/v1/disputes/${disputeId}/resolve`,
      {
        ruling,
        payout_adjustment: payoutAdjustment,
      },
      arbitratorId,
    );
  },

  async submitTestimonial(
    subjectUserId: number,
    dealId: number,
    authorId: number,
    text: string,
    rating?: number,
  ) {
    return makeRequest(
      'POST',
      '/api/v1/testimonials/submit',
      {
        subject_user_id: subjectUserId,
        deal_id: dealId,
        text,
        rating,
      },
      authorId,
    );
  },

  // Feature gating
  async checkFeatureAccess(userId: number, feature: string) {
    return makeRequest('GET', `/api/v1/features/${feature}/access`, undefined, userId);
  },
};
