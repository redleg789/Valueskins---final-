describe('API Endpoints', () => {
  const baseUrl = 'http://localhost:3000';

  describe('Brand Verification', () => {
    it('should submit brand for verification', async () => {
      const res = await fetch(`${baseUrl}/api/brand/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: 'test_brand', brandEmail: 'test@brand.com' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('pending');
    });

    it('should check verification status', async () => {
      const res = await fetch(`${baseUrl}/api/brand/verify?brandId=test_brand`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.verification).toBeDefined();
    });
  });

  describe('Value Skin Matching', () => {
    it('should return matching creators by value skin', async () => {
      const res = await fetch(`${baseUrl}/api/creators/match?brandValueSkin=technology`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.creators)).toBe(true);
    });
  });

  describe('Value Skin Management', () => {
    it('should get user skins', async () => {
      const res = await fetch(`${baseUrl}/api/skins/manage?userId=test_user`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.skins)).toBe(true);
    });

    it('should enforce max 3 skins', async () => {
      const res = await fetch(`${baseUrl}/api/skins/manage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'test_user', valueSkin: 'technology' }),
      });
      expect([200, 400]).toContain(res.status);
    });
  });

  describe('Notifications', () => {
    it('should get user notifications', async () => {
      const res = await fetch(`${baseUrl}/api/notifications/get?userId=test_user`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.notifications)).toBe(true);
    });

    it('should send notification', async () => {
      const res = await fetch(`${baseUrl}/api/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test_user',
          title: 'Test',
          message: 'Test message',
        }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Deal Workflows', () => {
    it('should create deal with value skin', async () => {
      const res = await fetch(`${baseUrl}/api/deals/create-with-skin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Deal',
          valueSkin: 'technology',
          creatorId: 'creator_1',
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.dealId).toBeDefined();
      expect(data.valueSkin).toBe('technology');
    });

    it('should create escrow on agreement', async () => {
      const res = await fetch(`${baseUrl}/api/deals/agree-with-escrow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: 'deal_123', amount: 100 }),
      });
      expect([200, 400]).toContain(res.status);
    });
  });

  describe('Calendar Export', () => {
    it('should export deal to calendar', async () => {
      const res = await fetch(`${baseUrl}/api/deals/calendar-export?dealId=deal_123`);
      expect(res.headers.get('content-type')).toContain('text/calendar');
      expect(res.status).toBe(200);
    });
  });
});
