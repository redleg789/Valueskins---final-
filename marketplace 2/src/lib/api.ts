// ARCHITECTURE: See ARCHITECTURE_GUIDE.txt for codebase overview
// FILE PURPOSE: All HTTP requests from frontend to backend go through here
// ROLE IN SYSTEM: Bridge between React components and backend services
// WHAT IT DOES:
//   - Makes fetch() calls to backend
//   - Examples: GET /creators, POST /deals, PATCH /deals/123
//   - Returns JSON data that components display
// CALLED BY: instagram/page.tsx, tiktok/page.tsx, useDealSync.ts, and other components

import type { DealStatus, DeliverableType, OpportunityStatus } from './deals';

// In browser: proxy through Next.js API route to avoid CORS issues.
// On server (SSR): call backend directly.
const API_BASE_URL = typeof window !== 'undefined'
  ? '/api/backend'
  : (process.env.BACKEND_URL || 'http://localhost:8080');

interface ApiResponse<T> {
    data?: T;
    error?: string;
}

// Base HTTP client — session maintained via httpOnly cookie set by the backend.
// `credentials: 'include'` ensures the browser sends the cookie on every request.
// Falls back to Authorization header for non-browser (SSR / mobile SDK) contexts.
class HttpClient {
    // No in-memory token needed; cookie is managed by browser + backend.
    // Kept as a nullable field only for server-side / non-cookie contexts.
    private token: string | null = null;

    /** Called only in non-browser environments (e.g. SSR data-fetch with token). */
    setToken(token: string) {
        this.token = token;
        // Do NOT write to localStorage — storing JWTs there is an XSS risk.
        // Tokens are delivered via httpOnly cookie from the /auth/login endpoint.
    }

    getToken(): string | null {
        return this.token;
    }

    clearToken() {
        this.token = null;
        if (typeof window !== 'undefined') {
            // Clear persisted user profile (non-secret)
            localStorage.removeItem('valueskins_user');
        }
    }

    async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...options.headers as Record<string, string>,
        };

        // Only add Authorization header in non-browser (SSR) contexts where
        // the httpOnly cookie cannot be used.
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                // Send httpOnly cookie on every request (browser clients)
                credentials: 'include',
                headers,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return { error: errorData.error || `HTTP ${response.status}` };
            }

            const data = await response.json();
            return { data };
        } catch (error) {
            return { error: error instanceof Error ? error.message : 'Network error' };
        }
    }
}

// Auth API client — authenticates via Instagram access token
class AuthClient {
    constructor(private http: HttpClient) {}

    async login(accessToken: string, role: 'creator' | 'brand') {
        const result = await this.http.request<LoginResponse>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ access_token: accessToken, role }),
        });
        if (result.data?.token) {
            this.http.setToken(result.data.token);
            if (typeof window !== 'undefined') {
                localStorage.setItem('valueskins_user', JSON.stringify(result.data.user));
            }
        }
        return result;
    }

    async logout() {
        this.http.clearToken();
    }

    isAuthenticated(): boolean {
        return !!this.http.getToken();
    }

    getUser(): UserProfile | null {
        if (typeof window === 'undefined') return null;
        const stored = localStorage.getItem('valueskins_user');
        if (!stored) return null;
        try { return JSON.parse(stored); } catch { return null; }
    }
}

// Health & System API client
class SystemClient {
    constructor(private http: HttpClient) {}

    async health() {
        return this.http.request<{ status: string; service: string }>('/health');
    }
}

// Persona API client
class PersonaClient {
    constructor(private http: HttpClient) {}

    async getPersonas(limit = 20, offset = 0) {
        return this.http.request<Persona[]>(`/personas?limit=${limit}&offset=${offset}`);
    }

    async getPersona(id: number) {
        return this.http.request<Persona>(`/personas/${id}`);
    }

    async getPersonaSkins(personaId: number) {
        return this.http.request<Skin[]>(`/personas/${personaId}/skins`);
    }

    async getMyProfile() {
        return this.http.request<CreatorProfile>('/personas/me/profile');
    }

    async setProfession(opts: { profession_name: string; profession_category?: string; profession_description?: string }) {
        return this.http.request<{ persona_id: number; profession_id: number; slot: string; level: number }>(
            '/personas/me/profession',
            {
                method: 'POST',
                body: JSON.stringify(opts),
            }
        );
    }
}

// Social API client
class SocialClient {
    constructor(private http: HttpClient) {}

    async createPost(authorPersonaId: number, content: string, mediaUrls?: string[]) {
        return this.http.request<{ id: string }>('/social/posts', {
            method: 'POST',
            body: JSON.stringify({ author_persona_id: authorPersonaId, content, media_urls: mediaUrls }),
        });
    }
}

// Analytics API client
class AnalyticsClient {
    constructor(private http: HttpClient) {}

    async logEvent(eventType: string, eventData: Record<string, unknown>) {
        return this.http.request('/analytics/events', {
            method: 'POST',
            body: JSON.stringify({ event_type: eventType, event_data: eventData }),
        });
    }
}

// Referral API client
class ReferralClient {
    constructor(private http: HttpClient) {}

    async createReferralCode(personaId: number, code: string) {
        return this.http.request<{ code: string }>('/referrals/codes', {
            method: 'POST',
            body: JSON.stringify({ persona_id: personaId, code }),
        });
    }

    async getReferralStats(personaId: number) {
        return this.http.request<ReferralStats>(`/referrals/stats/${personaId}`);
    }

    async getReferralLeaderboard(limit = 10) {
        return this.http.request<LeaderboardEntry[]>(`/referrals/leaderboard?limit=${limit}`);
    }

    async validateReferralCode(code: string) {
        return this.http.request<{ valid: boolean; persona_id?: number }>(`/referrals/validate/${code}`);
    }
}

// Waitlist API client
class WaitlistClient {
    constructor(private http: HttpClient) {}

    async joinWaitlist(data: WaitlistSignup) {
        return this.http.request<{ position: number; referral_code: string }>('/waitlist/join', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getWaitlistPosition(email: string) {
        return this.http.request<{ position: number }>(`/waitlist/position?email=${encodeURIComponent(email)}`);
    }
}

// Marketplace API client — calls real backend endpoints
class MarketplaceClient {
    constructor(private http: HttpClient) {}

    async getOpportunities(filters?: OpportunityFilters) {
        const params = new URLSearchParams();
        if (filters?.professionId) params.append('profession_id', filters.professionId.toString());
        if (filters?.minLevel) params.append('min_level', filters.minLevel.toString());
        if (filters?.maxLevel) params.append('max_level', filters.maxLevel.toString());
        if (filters?.category) params.append('category', filters.category);
        if (filters?.status) params.append('status', filters.status);
        if (filters?.personaId) params.append('persona_id', filters.personaId.toString());

        const queryStr = params.toString();
        const endpoint = queryStr ? `/marketplace/opportunities?${queryStr}` : '/marketplace/opportunities';
        return this.http.request<{ opportunities: MarketplaceOpportunity[]; count: number }>(endpoint);
    }


    async getOpportunityDetails(opportunityId: number) {
        return this.http.request<MarketplaceOpportunity>(`/marketplace/opportunities/${opportunityId}`);
    }

    async applyToOpportunity(opportunityId: number, personaId: number, pitch: string) {
        return this.http.request<{ application_id: number }>('/marketplace/applications', {
            method: 'POST',
            body: JSON.stringify({ opportunity_id: opportunityId, persona_id: personaId, pitch }),
        });
    }

    async getMyApplications() {
        return this.http.request<{ applications: Application[] }>('/marketplace/applications/mine');
    }

    async getStats() {
        return this.http.request<MarketplaceStats>('/marketplace/stats');
    }

    async getMyDeals() {
        return this.http.request<{ deals: CreatorDeal[] }>('/marketplace/deals/mine');
    }



    // Deal Room Messages
    async postMessage(dealRoomId: number, data: { content: string; message_type?: string }) {
        return this.http.request<DealRoomMessage>(`/deal-rooms/${dealRoomId}/messages`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getMessages(dealRoomId: number, query?: { limit?: number; offset?: number }) {
        const params = new URLSearchParams();
        if (query?.limit) params.append('limit', query.limit.toString());
        if (query?.offset) params.append('offset', query.offset.toString());
        
        const queryStr = params.toString();
        const endpoint = queryStr 
            ? `/deal-rooms/${dealRoomId}/messages?${queryStr}` 
            : `/deal-rooms/${dealRoomId}/messages`;
        
        return this.http.request<MessagesResponse>(endpoint);
    }    async submitDeliverable(dealId: number, deliverableId: number, contentUrl: string) {
        return this.http.request('/marketplace/deliverables/submit', {
            method: 'POST',
            body: JSON.stringify({ deal_id: dealId, deliverable_id: deliverableId, content_url: contentUrl }),
        });
    }

    async getProfessions() {
        return this.http.request<{ professions: Array<{ id: number; name: string; category: string; image_uri?: string }>; count: number }>('/marketplace/professions');
    }
}

// Deal Rooms Chat Client — real-time chat and messaging for deal negotiation
class DealRoomsClient {
    constructor(private http: HttpClient) {}

    async getChatHistory(dealRoomId: number, query?: { limit?: number; after_id?: number }) {
        const params = new URLSearchParams();
        if (query?.limit) params.append('limit', query.limit.toString());
        if (query?.after_id) params.append('after_id', query.after_id.toString());

        const queryStr = params.toString();
        const endpoint = queryStr
            ? `/deal-rooms/${dealRoomId}/messages?${queryStr}`
            : `/deal-rooms/${dealRoomId}/messages`;

        return this.http.request<{ messages: DealRoomMessage[]; deal_room_id: number; next_after_id: number | null }>(endpoint);
    }

    async sendMessage(dealRoomId: number, message: string, messageType?: string) {
        const body: Record<string, string> = { content: message };
        if (messageType) body.message_type = messageType;
        return this.http.request<DealRoomMessage>(`/deal-rooms/${dealRoomId}/messages`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    async listMyRooms() {
        return this.http.request<{ deal_rooms: DealRoomSummary[] }>('/deal-rooms');
    }

    async openDealRoom(data: {
        opportunity_id?: number;
        creator_persona_id: number;
        intent: string;
        brief_title: string;
        brief_description: string;
        brief_deliverables: string;
        brief_deadline?: string;
        brief_campaign_type: string;
        compensation_type?: string;
    }) {
        return this.http.request<{ deal_room_id: number }>('/deal-rooms', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // Payment preferences
    async savePaymentPreferences(dealRoomId: number, data: { advance_pct: number; after_submission_pct?: number; performance_pct?: number; performance_clause_enabled: boolean }) {
        return this.http.request<PaymentPreferencesResponse>(`/deal-rooms/${dealRoomId}/payment-preferences`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getPaymentPreferences(dealRoomId: number) {
        return this.http.request<PaymentPreferencesResponse>(`/deal-rooms/${dealRoomId}/payment-preferences`);
    }

    // Deal finalization
    async finalizeDeal(dealRoomId: number, message?: string) {
        return this.http.request<{ deal_room_id: number; status: string; message: string }>(`/deal-rooms/${dealRoomId}/finalize`, {
            method: 'POST',
            body: JSON.stringify({ message }),
        });
    }

    async getDealRoomStatus(dealRoomId: number) {
        return this.http.request<DealRoomStatusResponse>(`/deal-rooms/${dealRoomId}/status`);
    }

    // Disputes
    async createDispute(dealRoomId: number, data: { escrow_stage_id: number; reason: string; evidence_urls?: string[] }) {
        return this.http.request<{ id: number; deal_room_id: number; status: string }>(`/deal-rooms/${dealRoomId}/disputes`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async listDisputes(dealRoomId: number) {
        return this.http.request<{ disputes: EscrowDispute[] }>(`/deal-rooms/${dealRoomId}/disputes`);
    }
}

// Types for new endpoints
interface PaymentPreferencesResponse {
    deal_room_id: number;
    advance_pct: number;
    after_submission_pct: number;
    performance_pct: number;
    performance_clause_enabled: boolean;
    version: number;
    your_ask_cents?: number;
    brand_offer_cents?: number;
    counter_history?: Array<{ amount: number; by: 'creator' | 'brand'; at: string }>;
    creator_country?: string;
    brand_country?: string;
    is_international?: boolean;
}

interface DealRoomStatusResponse {
    deal_room_id: number;
    status: string;
    creator_user_id: number;
    brand_user_id: number;
    created_at: string;
    updated_at: string;
}

interface EscrowDispute {
    id: number;
    escrow_stage_id: number;
    raised_by_user_id: number;
    against_user_id: number;
    reason: string;
    status: string;
    resolution_notes: string | null;
    created_at: string;
}

// Brand API client — brand dashboard and opportunity management
class BrandClient {
    constructor(private http: HttpClient) {}

    async getDashboard() {
        return this.http.request<BrandDashboardData>('/brands/dashboard');
    }

    async discoverCreators() {
        return this.http.request<{ creators: DiscoverableCreator[] }>('/brands/discover');
    }

    async createOpportunity(data: CreateOpportunityData) {
        return this.http.request<{ opportunity_id: number }>('/marketplace/opportunities', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getOpportunityApplications(opportunityId: number) {
        return this.http.request<{ applications: Application[] }>(`/brands/opportunities/${opportunityId}/applications`);
    }

    async acceptApplication(opportunityId: number, personaId: number) {
        return this.http.request('/brands/applications/accept', {
            method: 'POST',
            body: JSON.stringify({ opportunity_id: opportunityId, persona_id: personaId }),
        });
    }

    async completeDeal(opportunityId: number) {
        return this.http.request('/brands/deals/complete', {
            method: 'POST',
            body: JSON.stringify({ opportunity_id: opportunityId }),
        });
    }
}

// AI Scoring API client
class ScoringClient {
    constructor(private http: HttpClient) {}

    async getScore(input: ScoringInput) {
        return this.http.request<ScoringResult>('/ai/score', {
            method: 'POST',
            body: JSON.stringify(input),
        });
    }
}

// Admin API client — all admin endpoints require admin role JWT
class AdminClient {
    constructor(private http: HttpClient) {}

    async getLeaderboard(limit = 50, offset = 0) {
        return this.http.request<{ leaderboard: LeaderboardCreator[]; pagination: Pagination }>(`/admin/leaderboard?limit=${limit}&offset=${offset}`);
    }

    async getPlatformStats() {
        return this.http.request<PlatformStats>('/admin/stats');
    }

    async listFeatureFlags() {
        return this.http.request<{ flags: FeatureFlag[] }>('/admin/flags');
    }

    async updateFeatureFlag(name: string, update: { enabled?: boolean; rollout_percentage?: number; shadow_mode?: boolean }) {
        return this.http.request<{ updated: boolean }>(`/admin/flags/${name}`, {
            method: 'PATCH',
            body: JSON.stringify(update),
        });
    }

    async killFeatureFlag(name: string) {
        return this.http.request<{ killed: boolean }>(`/admin/flags/${name}/kill`, { method: 'POST' });
    }

    async listUsers(limit = 50, offset = 0) {
        return this.http.request<{ users: AdminUser[]; total: number; pagination: Pagination }>(`/admin/users?limit=${limit}&offset=${offset}`);
    }

    async getUser(id: number) {
        return this.http.request<AdminUserDetail>(`/admin/users/${id}`);
    }

    async deactivateUser(id: number) {
        return this.http.request<{ deactivated: boolean }>(`/admin/users/${id}/deactivate`, { method: 'POST' });
    }

    async listGdprRequests(limit = 50, offset = 0) {
        return this.http.request<{ requests: GdprRequest[]; pagination: Pagination }>(`/admin/gdpr/requests?limit=${limit}&offset=${offset}`);
    }

    async processGdprRequest(id: number) {
        return this.http.request<{ processing: boolean }>(`/admin/gdpr/requests/${id}/process`, { method: 'POST' });
    }

    async listDisputes(limit = 50, offset = 0) {
        return this.http.request<{ disputes: AdminDispute[]; pagination: Pagination }>(`/admin/disputes?limit=${limit}&offset=${offset}`);
    }

    async resolveDispute(id: number, resolution: string, notes?: string) {
        return this.http.request<{ resolved: boolean }>(`/admin/disputes/${id}/resolve`, {
            method: 'POST',
            body: JSON.stringify({ resolution, notes }),
        });
    }

    async getPiiAuditLog(userId: number, limit = 50, offset = 0) {
        return this.http.request<{ audit_log: PiiAuditEntry[]; pagination: Pagination }>(`/admin/pii-audit/${userId}?limit=${limit}&offset=${offset}`);
    }

    async listBrandVerifications() {
        return this.http.request<{ verifications: BrandVerification[] }>('/admin/brands/verify');
    }

    async reviewBrandVerification(userId: number, approved: boolean, reason?: string) {
        return this.http.request(`/admin/brands/${userId}/verify`, {
            method: 'POST',
            body: JSON.stringify({ approved, reason }),
        });
    }

    async getPayoutReconciliation() {
        return this.http.request<{ payouts: PayoutRecord[] }>('/admin/payouts/reconciliation');
    }

    async listApiKeys(limit = 50, offset = 0) {
        return this.http.request<{ api_keys: ApiKeyEntry[]; pagination: Pagination }>(`/admin/api-keys?limit=${limit}&offset=${offset}`);
    }

    async listContracts() {
        return this.http.request<{ contracts: ContractEntry[] }>('/contracts');
    }
}

// Creator-specific endpoints beyond marketplace
class CreatorClient {
    constructor(private http: HttpClient) {}

    async getLeaderboard(limit = 50, offset = 0) {
        return this.http.request<{ leaderboard: LeaderboardCreator[]; pagination: Pagination }>(`/admin/leaderboard?limit=${limit}&offset=${offset}`);
    }

    async getMyCompleteness() {
        return this.http.request<CreatorCompleteness>('/creators/me/completeness');
    }

    async getMyPayouts() {
        return this.http.request<{ payouts: PayoutRecord[] }>('/creators/me/payouts');
    }
}

// Equity API client — tokens, vesting, dividends
class EquityClient {
    constructor(private http: HttpClient) {}

    async getMyEquity() {
        return this.http.request<EquityDashboard>('/equity/me');
    }

    async getDividendHistory() {
        return this.http.request<{ payouts: DividendPayout[] }>('/equity/dividends');
    }
}

// Insurance API client — policy, claims, pool
class InsuranceClient {
    constructor(private http: HttpClient) {}

    async getMyInsurance() {
        return this.http.request<InsuranceDashboard>('/insurance/me');
    }

    async getProtectionPool() {
        return this.http.request<ProtectionPoolStats>('/insurance/pool');
    }

    async fileClaim(claimType: string, amountCents: number, description: string) {
        return this.http.request<{ claim_id: number; status: string }>('/insurance/claims', {
            method: 'POST',
            body: JSON.stringify({ claim_type: claimType, amount_cents: amountCents, description }),
        });
    }
}

// Collective API client — guilds, market rates
class CollectiveClient {
    constructor(private http: HttpClient) {}

    async listCollectives() {
        return this.http.request<{ collectives: CollectiveSummary[] }>('/collectives');
    }

    async getCollective(id: number) {
        return this.http.request<CollectiveDetail>(`/collectives/${id}`);
    }

    async getMarketRates() {
        return this.http.request<{ rates: MarketRate[] }>('/market-rates');
    }
}

// Media Kit API client
class MediaKitClient {
    constructor(private http: HttpClient) {}

    async getMyMediaKit() {
        return this.http.request<MediaKitData>('/mediakit/me');
    }

    async updateMediaKit(updates: Partial<MediaKitUpdate>) {
        return this.http.request<{ updated: boolean }>('/mediakit/me', {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    }
}

// Verification API client — trust score, linked accounts, credentials
class VerificationClient {
    constructor(private http: HttpClient) {}

    async getMyVerification() {
        return this.http.request<VerificationData>('/verification/me');
    }
}

// Pricing Benchmark API client
class PricingClient {
    constructor(private http: HttpClient) {}

    async getBenchmark(category: string, platform: string, contentType: string, level?: number) {
        const params = new URLSearchParams({ category, platform, content_type: contentType });
        if (level) params.set('level', level.toString());
        return this.http.request<{ benchmark: PricingBenchmark }>(`/pricing/benchmark?${params}`);
    }

    async getMyWorth(personaId: number, contentType?: string, platform?: string) {
        const params = new URLSearchParams({ persona_id: personaId.toString() });
        if (contentType) params.set('content_type', contentType);
        if (platform) params.set('platform', platform);
        return this.http.request<{ valuation: PersonalValuation }>(`/pricing/my-worth?${params}`);
    }

    async recompute(category?: string, platform?: string) {
        return this.http.request<{ version: number }>('/pricing/recompute', {
            method: 'POST',
            body: JSON.stringify({ category, platform }),
        });
    }
}

// Creator Credit Line API client
class CreditClient {
    constructor(private http: HttpClient) {}

    async apply() {
        return this.http.request<{ credit_line: CreditLineData }>('/credit/apply', { method: 'POST' });
    }

    async getStatus() {
        return this.http.request<CreditLineData>('/credit/status');
    }

    async getScore() {
        return this.http.request<{ score: CreditScoreData }>('/credit/score');
    }

    async drawAdvance(dealRoomId: number, amountCents: number, autoDeduct?: boolean) {
        return this.http.request<{ advance: CreditAdvanceData }>('/credit/advance', {
            method: 'POST',
            body: JSON.stringify({ deal_room_id: dealRoomId, amount_cents: amountCents, auto_deduct: autoDeduct }),
        });
    }

    async repayAdvance(advanceId: number) {
        return this.http.request<{ advance: CreditAdvanceData }>(`/credit/repay/${advanceId}`, { method: 'POST' });
    }

    async listAdvances(status?: string, limit?: number, offset?: number) {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (limit) params.set('limit', limit.toString());
        if (offset) params.set('offset', offset.toString());
        return this.http.request<{ advances: CreditAdvanceData[] }>(`/credit/advances?${params}`);
    }
}

// Contract API client
class ContractClient {
    constructor(private http: HttpClient) {}

    async generate(req: GenerateContractReq) {
        return this.http.request<{ contract: ContractInstanceData }>('/contracts/generate', {
            method: 'POST',
            body: JSON.stringify(req),
        });
    }

    async sign(contractId: number, contractHash: string) {
        return this.http.request<{ contract: ContractInstanceData }>(`/contracts/${contractId}/sign`, {
            method: 'POST',
            body: JSON.stringify({ contract_hash: contractHash }),
        });
    }

    async getById(contractId: number) {
        return this.http.request<ContractInstanceData>(`/contracts/${contractId}`);
    }

    async getByDealRoom(dealRoomId: number) {
        return this.http.request<ContractInstanceData>(`/contracts/deal-room/${dealRoomId}`);
    }

    async requestRevision(contractId: number, description: string, isPaid?: boolean, costCents?: number) {
        return this.http.request<{ revision: ContractRevisionData }>(`/contracts/${contractId}/revisions`, {
            method: 'POST',
            body: JSON.stringify({ change_description: description, is_paid_revision: isPaid, additional_cost_cents: costCents }),
        });
    }

    async listTemplates(templateType?: string) {
        const params = new URLSearchParams();
        if (templateType) params.set('template_type', templateType);
        return this.http.request<{ templates: ContractTemplateData[] }>(`/contracts/templates?${params}`);
    }
}

// Reputation Passport API client
class ReputationClient {
    constructor(private http: HttpClient) {}

    async generateExport(personaId: number) {
        return this.http.request<{ export: ReputationExportData }>(`/reputation/export?persona_id=${personaId}`, { method: 'POST' });
    }

    async verify(personaId: number, version: number) {
        return this.http.request<{ verification: ReputationVerification }>(`/reputation/verify?persona_id=${personaId}&version=${version}`);
    }

    async listExports(personaId: number, limit?: number) {
        const params = new URLSearchParams({ persona_id: personaId.toString() });
        if (limit) params.set('limit', limit.toString());
        return this.http.request<{ exports: ReputationExportData[] }>(`/reputation/exports?${params}`);
    }

    async getPublicKey() {
        return this.http.request<{ public_key: string; algorithm: string }>('/reputation/public-key');
    }
}

// Deal Suggestions API client
class SuggestionClient {
    constructor(private http: HttpClient) {}

    async getSuggestions(personaId: number, minScore?: number, advanceOnly?: boolean) {
        const params = new URLSearchParams({ persona_id: personaId.toString() });
        if (minScore) params.set('min_score', minScore.toString());
        if (advanceOnly) params.set('advance_only', 'true');
        return this.http.request<{ suggestions: DealSuggestionData[] }>(`/matching/suggestions?${params}`);
    }

    async actOnSuggestion(suggestionId: number, action: 'dismiss' | 'convert') {
        return this.http.request<{ message: string }>(`/matching/suggestions/${suggestionId}/action`, {
            method: 'POST',
            body: JSON.stringify({ action }),
        });
    }

    async generateForOpportunity(opportunityId: number) {
        return this.http.request<{ suggestions_generated: number }>(`/matching/opportunities/${opportunityId}/generate-suggestions`, { method: 'POST' });
    }
}

// Facade: Composite API client
// Settings API client
class SettingsClient {
    constructor(private http: HttpClient) {}

    async getSettings() {
        return this.http.request<UserSettingsData>('/settings');
    }

    async updateSettings(data: UpdateSettingsData) {
        return this.http.request<UserSettingsData>('/settings', {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }
}

interface UserSettingsData {
    user_id: number;
    willing_to_barter: boolean;
    energy_state: string;
    price_band: string;
    auto_escalation: boolean;
    notifications_enabled: boolean;
    profile_visibility: string;
    updated_at: string;
    // Creator preferences (persisted)
    allow_international_deals?: boolean;
    payment_advance_pct?: number;
    payment_after_submission_pct?: number;
    payment_performance_pct?: number;
    payment_plan_negotiable?: boolean;
    creator_requires_advance?: boolean;
    creator_advance_pct_wanted?: number;
    creator_advance_negotiable?: boolean;
    posting_rules?: string[];
    exclusivity_available?: boolean;
    willing_to_sign_nda?: boolean;
    willing_to_sign_usage_rights?: boolean;
    min_deal_size_usd?: string;
    response_time_hours?: string;
    product_preference?: string;
    location_country?: string;
    willing_to_relocate?: boolean;
    willing_to_travel?: boolean;
    willing_to_appear_at_events?: boolean;
}

interface UpdateSettingsData {
    willing_to_barter?: boolean;
    energy_state?: string;
    price_band?: string;
    auto_escalation?: boolean;
    notifications_enabled?: boolean;
    profile_visibility?: string;
    // Creator preferences
    allow_international_deals?: boolean;
    payment_advance_pct?: number;
    payment_after_submission_pct?: number;
    payment_performance_pct?: number;
    payment_plan_negotiable?: boolean;
    creator_requires_advance?: boolean;
    creator_advance_pct_wanted?: number;
    creator_advance_negotiable?: boolean;
    posting_rules?: string[];
    exclusivity_available?: boolean;
    willing_to_sign_nda?: boolean;
    willing_to_sign_usage_rights?: boolean;
    min_deal_size_usd?: string;
    response_time_hours?: string;
    product_preference?: string;
    location_country?: string;
    willing_to_relocate?: boolean;
    willing_to_travel?: boolean;
    willing_to_appear_at_events?: boolean;
}

class ApiClient {
    private http: HttpClient;

    readonly auth: AuthClient;
    readonly system: SystemClient;
    readonly persona: PersonaClient;
    readonly social: SocialClient;
    readonly analytics: AnalyticsClient;
    readonly referral: ReferralClient;
    readonly waitlist: WaitlistClient;
    readonly marketplace: MarketplaceClient;
    readonly brand: BrandClient;
    readonly scoring: ScoringClient;
    readonly admin: AdminClient;
    readonly creators: CreatorClient;
    readonly equity: EquityClient;
    readonly insurance: InsuranceClient;
    readonly collective: CollectiveClient;
    readonly mediakit: MediaKitClient;
    readonly verification: VerificationClient;
    readonly pricing: PricingClient;
    readonly credit: CreditClient;
    readonly contracts: ContractClient;
    readonly reputation: ReputationClient;
    readonly suggestions: SuggestionClient;
    readonly dealRooms: DealRoomsClient;
    readonly settings: SettingsClient;

    constructor() {
        this.http = new HttpClient();

        this.auth = new AuthClient(this.http);
        this.system = new SystemClient(this.http);
        this.persona = new PersonaClient(this.http);
        this.social = new SocialClient(this.http);
        this.analytics = new AnalyticsClient(this.http);
        this.referral = new ReferralClient(this.http);
        this.waitlist = new WaitlistClient(this.http);
        this.marketplace = new MarketplaceClient(this.http);
        this.brand = new BrandClient(this.http);
        this.scoring = new ScoringClient(this.http);
        this.admin = new AdminClient(this.http);
        this.creators = new CreatorClient(this.http);
        this.equity = new EquityClient(this.http);
        this.insurance = new InsuranceClient(this.http);
        this.collective = new CollectiveClient(this.http);
        this.mediakit = new MediaKitClient(this.http);
        this.verification = new VerificationClient(this.http);
        this.pricing = new PricingClient(this.http);
        this.credit = new CreditClient(this.http);
        this.contracts = new ContractClient(this.http);
        this.reputation = new ReputationClient(this.http);
        this.suggestions = new SuggestionClient(this.http);
        this.dealRooms = new DealRoomsClient(this.http);
        this.settings = new SettingsClient(this.http);
    }
}

// ============ TYPES ============

export interface LoginResponse {
    token: string;
    user: UserProfile;
}

export interface UserProfile {
    id: number;
    instagram_user_id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    role: 'creator' | 'brand';
    persona_id: number | null;
}

export interface Persona {
    id: number;
    owner_user_id: number;
    username: string;
    display_name: string;
    avatar_uri?: string;
    created_at: string;
    last_active_at: string;
}

export interface Skin {
    persona_id: number;
    profession_id: number;
    profession_name: string;
    slot: string;
    level: number;
    score: number;
}

export interface Post {
    id: string;
    author_persona_id: number;
    author_name: string;
    author_level: number;
    content: string;
    media_urls: string[];
    created_at: string;
    like_count: number;
}

export interface ReferralStats {
    code: string;
    total_referrals: number;
    total_earnings_cents: number;
    tier1_count: number;
    tier2_count: number;
    tier3_count: number;
}

export interface LeaderboardEntry {
    rank: number;
    persona_id: number;
    display_name: string;
    referral_count: number;
    total_earnings_cents: number;
}

export interface WaitlistSignup {
    email: string;
    creator_type: string;
    follower_range: string;
    platforms: string[];
    referral_code?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
}

export interface OpportunityFilters {
    professionId?: number;
    minLevel?: number;
    maxLevel?: number;
    category?: string;
    status?: 'open' | 'filled' | 'completed';
    personaId?: number;  // Filter by matching persona's ValuSkin professions
}

export interface MarketplaceOpportunity {
    id: number;
    brand_name: string | null;
    brand_logo?: string;
    brand_verified: boolean;
    title: string;
    description: string;
    category: string;
    required_profession_id: number;
    required_profession_name: string;
    required_level: number;
    reward_amount: string;
    reward_currency: string;
    deadline: string;
    status: OpportunityStatus;
    application_count: number;
    created_at: string;
    can_apply: boolean;
}

export interface MarketplaceStats {
    total_opportunities: number;
    active_opportunities: number;
    completed_deals: number;
    total_volume: string;
    total_platform_revenue: string;
    avg_deal_size: string;
}

export interface Application {
    id: number;
    opportunity_id: number;
    opportunity_title: string;
    persona_id: number;
    username?: string;
    pitch: string;
    status: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'applied';
    created_at: string;
}

export interface CreateOpportunityData {
    title: string;
    description: string;
    category: string;
    required_profession_id: number;
    required_level: number;
    reward_amount: string;
    reward_currency?: string;
    duration_days: number;
}

export interface ScoringInput {
    followers_count: number;
    engagement_rate: number;
    post_frequency: number;
    account_age_days: number;
    verified: boolean;
}

export interface ScoringResult {
    total_score: number;
    level: number;
    components: {
        follower_score: number;
        engagement_score: number;
        authenticity_score: number;
        consistency_score: number;
    };
}

export interface CreatorAttributes {
    // Location & availability
    location_city: string | null;
    location_country: string | null;
    timezone: string | null;
    availability_hours: string | null;          // e.g. "9am-6pm"
    willing_to_relocate: boolean;
    willing_to_travel: boolean;
    willing_to_appear_at_events: boolean;

    // Identity
    age: number | null;
    gender: string | null;                      // 'male' | 'female' | 'non_binary' | 'prefer_not_to_say'
    ethnicity: string | null;                   // optional, for representation matching
    languages_spoken: string[];
    content_language: string | null;

    // Audience
    audience_age_range: string | null;          // e.g. "18-24"
    audience_gender_split: string | null;       // e.g. "60% female"
    audience_location_primary: string | null;
    audience_authenticity_score: number | null; // 0-100
    engagement_rate: number | null;             // percentage
    primary_platform: string | null;
    cross_platform_reach: number | null;        // total followers across all platforms

    // Content
    content_niche: string[];
    content_format: string[];                   // 'video' | 'photo' | 'text' | 'podcast' | 'live'
    posting_frequency: string | null;           // e.g. "3x/week"

    // Deal preferences (all 'preferred' by default, brands can mark non-negotiable)
    deal_type_preference: string[];             // 'gifted' | 'paid' | 'equity'
    min_deal_size_usd: number | null;
    response_time_hours: number | null;
    exclusivity_available: boolean;
    willing_to_sign_nda: boolean;
    willing_to_sign_usage_rights: boolean;
    on_camera_willing: boolean;
    product_preference: string | null;          // 'physical' | 'digital' | 'both'

    // Trust & history
    brand_safety_score: number | null;          // 0-100
    past_brand_categories: string[];
    collaboration_history: boolean;             // has worked with other creators
    verification_status: boolean;
    content_rights_owned: boolean;
}

export interface CreatorProfile {
    id: number;
    display_name: string;
    handle: string;
    avatar_url: string | null;
    bio: string | null;
    level: number;
    score: number;
    profession: string | null;
    connected_platforms: string[];
    badges: string[];
    attributes: CreatorAttributes | null;
    stats: {
        total_earnings: string;
        completed_deals: number;
        avg_rating: number;
        referrals: number;
    };
    score_breakdown: {
        activity: number;
        engagement: number;
        consistency: number;
        verification: number;
    };
    recent_activity: Array<{
        type: string;
        title: string;
        date: string;
        amount: string | null;
    }>;
}

export interface CreatorDeal {
    id: number;
    title: string;
    brand_name: string;
    status: DealStatus;
    total_amount: number;
    base_budget: number;
    required_level: number;
    category: string;
    platforms: string[];
    description: string;
    application_deadline: string;
    delivery_deadline: string;
    applicant_count: number;
    currency?: string;
    is_international?: boolean;
    deliverables: Array<{
        id: number;
        type: DeliverableType;
        description: string;
        quantity: number;
        platform: string;
        status: 'pending' | 'submitted' | 'approved' | 'revision';
    }>;
}

// ============ ADMIN & SHARED TYPES ============

export interface Pagination {
    limit: number;
    offset: number;
}

export interface LeaderboardCreator {
    user_id: number;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    reputation_score: number | null;
    total_deals: number | null;
    avg_rating: number | null;
    rank: number;
}

export interface PlatformStats {
    total_users: number;
    total_personas: number;
    total_skins: number;
    total_volume: number;
    total_revenue: number;
    total_deals: number;
    last_refreshed_at?: string;
}

export interface FeatureFlag {
    id: number;
    name: string;
    enabled: boolean;
    rollout_percentage: number | null;
    allowed_roles: string | null;
    shadow_mode: boolean;
    description: string | null;
}

export interface AdminUser {
    id: number;
    username: string;
    display_name: string | null;
    role: string;
    is_active: boolean;
    created_at: string;
}

export interface AdminUserDetail extends AdminUser {
    avatar_url: string | null;
    instagram_user_id: string | null;
}

export interface GdprRequest {
    id: number;
    user_id: number;
    status: string;
    scope: string;
    requested_at: string;
    processed_at: string | null;
}

export interface AdminDispute {
    id: number;
    raised_by_user_id: number;
    deal_room_id: number;
    reason: string;
    status: string;
    resolution_notes: string | null;
    created_at: string;
}

export interface PiiAuditEntry {
    accessor_user_id: number;
    target_user_id: number;
    action: string;
    fields_accessed: string;
    reason: string;
    accessed_at: string;
}

export interface BrandVerification {
    user_id: number;
    company_name: string;
    status: string;
    submitted_at: string;
}

export interface PayoutRecord {
    id: number;
    user_id: number;
    amount: number;
    currency: string;
    status: string;
    created_at: string;
}

export interface CreatorCompleteness {
    score: number;
    missing: string[];
}

// ============ EQUITY TYPES ============

export interface EquityDashboard {
    account: {
        total_tokens: number;
        vested_tokens: number;
        unvested_tokens: number;
        tier: string;
        multiplier: number;
        contributions: {
            deals_completed: number;
            platform_fees_generated: number;
            referrals_converted: number;
            content_created: number;
            community_contributions: number;
        };
        dividends: {
            total_earned: number;
            last_payout: number;
            last_payout_date: string | null;
        };
    };
    vesting_events: VestingEvent[];
    pool: EquityPoolData | null;
    ownership_pct: number;
}

export interface VestingEvent {
    id: number;
    tokens: number;
    vest_date: string;
    source: string;
    status: string;
}

export interface EquityPoolData {
    total_tokens_issued: number;
    total_tokens_vested: number;
    pool_value_cents: number;
    price_per_token_cents: number;
    revenue_share_pct: number;
    total_revenue_allocated_cents: number;
    total_creators_holding: number;
    dividend_pool_cents: number;
    last_dividend_at: string | null;
    next_dividend_at: string | null;
}

export interface DividendPayout {
    id: number;
    amount_cents: number;
    tokens_held: number;
    payout_date: string;
}

// ============ INSURANCE TYPES ============

export interface InsuranceDashboard {
    policy: {
        id: number;
        status: string;
        tier: string;
        coverage: {
            non_payment_max_cents: number;
            income_protection_monthly_cents: number;
            legal_defense_max_cents: number;
            emergency_fund_max_cents: number;
        };
        contributions: {
            total_contributed_cents: number;
            last_contribution_cents: number;
            last_contribution_at: string | null;
        };
        eligibility: {
            months_active: number;
            claims_last_12m: number;
            risk_score: number;
        };
        total_claims_paid_cents: number;
        start_date: string;
        renewal_date: string;
    };
    claims: InsuranceClaimEntry[];
}

export interface InsuranceClaimEntry {
    id: number;
    type: string;
    amount_cents: number;
    description: string;
    status: string;
    submitted_at: string;
    reviewed_at: string | null;
    review_notes: string | null;
    amount_approved_cents: number | null;
    payment_date: string | null;
    community_votes_for: number;
    community_votes_against: number;
}

export interface ProtectionPoolStats {
    total_balance_cents: number;
    available_cents: number;
    reserved_cents: number;
    contribution_rate: number;
    total_contributions_cents: number;
    total_claims_paid_cents: number;
    health_score: number;
    runway_months: number;
    total_policies: number;
    active_claims: number;
    claim_approval_rate: number;
    last_audit_at: string | null;
}

// ============ COLLECTIVE TYPES ============

export interface CollectiveSummary {
    id: number;
    name: string;
    description: string;
    category: string;
    total_members: number;
    total_combined_followers: number;
    avg_member_level: number;
    stats: {
        total_deals_negotiated: number;
        avg_deal_value_cents: number;
        avg_rate_increase_pct: number;
        brands_partnered: number;
    };
    treasury_balance_cents: number;
    my_role: string | null;
}

export interface CollectiveDetail extends CollectiveSummary {
    president_user_id: number;
    voting_threshold: number;
    members: CollectiveMemberEntry[];
    minimum_rates: CollectiveRate[];
    blacklisted_brands: BlacklistedBrandEntry[];
}

export interface CollectiveMemberEntry {
    user_id: number;
    username: string;
    display_name: string | null;
    role: string;
    voting_power: number;
    contributions_cents: number;
    deals_thru_collective: number;
    joined_at: string;
}

export interface CollectiveRate {
    id: number;
    content_type: string;
    platform: string;
    min_rate_cents: number;
    per_metric: string;
    effective_date: string;
}

export interface BlacklistedBrandEntry {
    id: number;
    brand_name: string;
    reason: string;
    blacklisted_at: string;
    blacklisted_until: string | null;
}

export interface MarketRate {
    category: string;
    platform: string;
    content_type: string;
    level: number;
    min_rate_cents: number;
    median_rate_cents: number;
    max_rate_cents: number;
    trend: string;
    change_last_month_pct: number;
    data_points: number;
    updated_at: string;
}

// ============ MEDIA KIT TYPES ============

export interface MediaKitData {
    id: number;
    tagline: string;
    bio: string;
    location: string | null;
    niche: string;
    specialties: string[];
    total_followers: number;
    avg_engagement_rate: number;
    monthly_reach: number;
    is_public: boolean;
    custom_slug: string | null;
    views: number;
    downloads: number;
    show_rates: boolean;
    brand_colors: { primary: string; secondary: string; accent: string };
    languages: string[];
    public_url: string;
    rates: MediaKitRate[];
    featured_content: MediaKitContent[];
    collaborations: MediaKitCollab[];
}

export interface MediaKitRate {
    id: number;
    type: string;
    platform: string;
    price_cents: number;
    description: string;
}

export interface MediaKitContent {
    id: number;
    platform: string;
    content_type: string;
    thumbnail_url: string | null;
    url: string;
    views: number;
    likes: number;
    comments: number;
}

export interface MediaKitCollab {
    id: number;
    brand_name: string;
    campaign_type: string;
    results: string | null;
    date: string;
}

export interface MediaKitUpdate {
    tagline: string;
    bio: string;
    location: string;
    niche: string;
    show_rates: boolean;
    is_public: boolean;
    custom_slug: string;
    brand_color_primary: string;
    brand_color_secondary: string;
    brand_color_accent: string;
}

// ============ VERIFICATION TYPES ============

export interface VerificationData {
    verification_level: number;
    email_verified: boolean;
    linked_accounts: LinkedAccountEntry[];
    credentials: CredentialEntry[];
    identity_proofs: IdentityProofEntry[];
    id_verified: boolean;
    deals_completed: number;
    avg_rating: number;
    trust_score: number;
    trust_breakdown: {
        verification: number;
        completion: number;
        rating: number;
        authenticity: number;
    };
    trust_metrics: {
        completion_score: number;
        response_reliability: number;
        consistency_index: number;
        ghosting_events: number;
        revision_abuse: boolean;
        energy_state: string;
    } | null;
    reputation: {
        reputation_score: number;
        on_time_rate: number;
        avg_rating: number;
        response_score: number;
        revision_efficiency: number;
        repeat_brand_rate: number;
    } | null;
    fraud_signals: FraudSignalEntry[];
}

export interface LinkedAccountEntry {
    id: number;
    platform: string;
    username: string | null;
    profile_url: string | null;
    linked_at: string;
}

export interface CredentialEntry {
    id: number;
    type: string;
    url: string;
    verified_at: string | null;
    created_at: string | null;
}

export interface IdentityProofEntry {
    id: number;
    platform: string;
    verified_at: string | null;
}

export interface FraudSignalEntry {
    id: number;
    type: string;
    severity: string;
    detected_at: string;
    resolved_at: string | null;
}

// ============ API KEY / CONTRACT TYPES ============

export interface ApiKeyEntry {
    id: number;
    prefix: string;
    owner: string;
    tier: string;
    requests_per_minute: number;
    last_used: string | null;
    is_active: boolean;
}

export interface ContractEntry {
    id: number;
    brand_name: string;
    status: string;
    amount_cents: number;
    created_at: string;
    title: string | null;
    campaign_type: string | null;
    creator_name: string;
}

// ============ BRAND DASHBOARD TYPES ============

export interface BrandDashboardData {
    brand: {
        id: number;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        role: string;
    };
    metrics: {
        active_campaigns: number;
        completed_campaigns: number;
        draft_campaigns: number;
        pending_applications: number;
        total_spent_cents: number;
        creators_worked_with: number;
    };
    campaigns: BrandCampaignEntry[];
    history: BrandDealHistory[];
}

export interface BrandCampaignEntry {
    id: number;
    title: string;
    description: string | null;
    category: string;
    reward_amount_cents: number;
    status: string;
    pending_applications: number;
    created_at: string;
}

export interface BrandDealHistory {
    id: number;
    title: string;
    total_amount_cents: number;
    creator_payout_cents: number;
    completed_at: string;
}

export interface DiscoverableCreator {
    id: number;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    rank: number;
    reputation_score: number | null;
    total_deals: number | null;
}

// === NEW SERVICE TYPES ===

export interface PricingBenchmark {
    id: number;
    category: string;
    platform: string;
    content_type: string;
    level: number;
    p25_rate_cents: number;
    median_rate_cents: number;
    p75_rate_cents: number;
    trend: 'rising' | 'stable' | 'falling';
    change_last_month_pct: number;
    data_points: number;
    benchmark_version: number;
    computed_at: string;
}

export interface PersonalValuation {
    estimated_rate_cents: number;
    confidence: 'high' | 'medium' | 'low';
    factors: Record<string, unknown>;
    market_position: string;
    benchmark: PricingBenchmark | null;
}

export interface CreditLineData {
    id: number;
    user_id: number;
    credit_limit_cents: number;
    used_cents: number;
    available_cents: number;
    credit_score: number;
    status: 'active' | 'suspended' | 'closed';
    created_at: string;
    updated_at: string;
}

export interface CreditScoreData {
    total_score: number;
    factors: {
        completed_deals_factor: number;
        avg_deal_value_factor: number;
        trust_score_factor: number;
        tenure_factor: number;
        on_time_rate_factor: number;
    };
    credit_limit_cents: number;
}

export interface CreditAdvanceData {
    id: number;
    credit_line_id: number;
    deal_room_id: number;
    amount_cents: number;
    repayment_auto_deduct: boolean;
    repayment_due_at: string | null;
    repaid_at: string | null;
    status: 'issued' | 'pending' | 'repaid' | 'forfeited';
    created_at: string;
}

export interface ContractInstanceData {
    id: number;
    deal_room_id: number;
    template_id: number;
    contract_content: string;
    contract_hash: string;
    pdf_url: string | null;
    status: 'draft' | 'pending_both' | 'pending_brand' | 'pending_creator' | 'signed' | 'executed';
    exact_amount_cents: number;
    currency: string;
    deliverable_list: string;
    revision_cap: number;
    kill_fee_pct: number;
    advance_pct: number;
    exclusivity_days: number;
    usage_rights_scope: string;
    deadline: string | null;
    brand_signed_at: string | null;
    creator_signed_at: string | null;
    created_at: string;
}

export interface ContractRevisionData {
    id: number;
    contract_instance_id: number;
    revision_number: number;
    requested_by_user_id: number;
    change_description: string;
    is_paid_revision: boolean;
    additional_cost_cents: number | null;
    status: 'pending' | 'approved' | 'rejected' | 'completed';
    created_at: string;
}

export interface ContractTemplateData {
    id: number;
    template_name: string;
    template_type: string;
    description: string;
    default_revision_cap: number;
    default_kill_fee_pct: number;
    default_advance_pct: number;
    default_exclusivity_days: number;
    usage_rights_description: string;
}

export interface GenerateContractReq {
    deal_room_id: number;
    template_type: string;
    exact_amount_cents: number;
    currency?: string;
    deliverable_list: string;
    revision_cap?: number;
    kill_fee_pct?: number;
    advance_pct?: number;
    exclusivity_days?: number;
    usage_rights_scope: string;
    deadline?: string;
}

export interface ReputationExportData {
    id: number;
    persona_id: number;
    export_version: number;
    deal_count: number;
    avg_deal_cents: number;
    completion_rate_pct: number;
    on_time_rate_pct: number;
    trust_scores_snapshot: Record<string, unknown>;
    testimonial_count: number;
    signed_hash: string;
    created_at: string;
}

export interface ReputationVerification {
    valid: boolean;
    export: ReputationExportData | null;
    public_key: string;
}

export interface DealSuggestionData {
    id: number;
    brand_user_id: number;
    brand_name: string;
    creator_persona_id: number;
    match_score: number;
    match_factors: Record<string, unknown>;
    advance_compatible: boolean;
    status: string;
    created_at: string;
}

// Deal Room Messages
export interface DealRoomMessage {
    id: number;
    deal_room_id: number;
    sender_user_id: number;
    content: string;
    message_type: 'text' | 'system' | 'offer_made' | 'offer_accepted' | 'offer_rejected' | 'counter_offer' | 'contract_signed' | 'deliverable_uploaded' | 'escrow_released' | 'deal_completed' | 'deal_cancelled';
    server_timestamp: string;
}

export interface MessagesResponse {
    messages: DealRoomMessage[];
    total: number;
    limit: number;
    offset: number;
}

export interface DealRoomSummary {
    id: number;
    opportunity_id: number | null;
    opportunity_title: string | null;
    creator_persona_id: number;
    creator_name: string;
    brand_persona_id: number;
    brand_name: string;
    status: string;
    last_message: string | null;
    last_message_at: string | null;
    created_at: string;
    unread_count: number;
}

// Singleton instance
export const api = new ApiClient();
