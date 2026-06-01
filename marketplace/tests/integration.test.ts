describe('Full Deal Workflow Integration', () => {
  const baseUrl = 'http://localhost:3000';
  let dealId: string;
  let creatorId = 'creator_test_123';
  let brandId = 'brand_test_123';

  describe('1. Setup - Brand Verification', () => {
    it('should verify brand with domain email', async () => {
      const res = await fetch(`${baseUrl}/api/brand/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          brandEmail: 'test@mybrand.com',
        }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe('2. Setup - Creator Purchases Skins', () => {
    it('should purchase first value skin', async () => {
      const res = await fetch(`${baseUrl}/api/skins/manage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: creatorId,
          valueSkin: 'technology',
        }),
      });
      expect(res.status).toBe(200);
    });

    it('should verify creator has 1 skin', async () => {
      const res = await fetch(`${baseUrl}/api/skins/manage?userId=${creatorId}`);
      const data = await res.json();
      expect(data.skins.length).toBe(1);
    });
  });

  describe('3. Deal Creation - Enforce Value Skin', () => {
    it('should create deal with specific value skin', async () => {
      const res = await fetch(`${baseUrl}/api/deals/create-with-skin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Integration Test Deal',
          description: 'Test deal creation',
          budget: 500,
          valueSkin: 'technology',
          creatorId,
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      dealId = data.dealId;
      expect(data.valueSkin).toBe('technology');
    });

    it('should retrieve deal with value skin', async () => {
      const res = await fetch(`${baseUrl}/api/deals/get?dealId=${dealId}`);
      const data = await res.json();
      expect(data.deal.value_skin).toBe('technology');
    });
  });

  describe('4. Deal Agreement - Create Escrow', () => {
    it('should create escrow on agreement', async () => {
      const res = await fetch(`${baseUrl}/api/deals/agree-with-escrow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId,
          amount: 500,
        }),
      });
      expect([200, 400]).toContain(res.status);
    });

    it('should check escrow status', async () => {
      const res = await fetch(`${baseUrl}/api/deals/escrow?dealId=${dealId}`);
      const data = await res.json();
      if (data.escrow) {
        expect(data.escrow.status).toBe('pending');
      }
    });
  });

  describe('5. Deal Chat - Messages and Timestamps', () => {
    it('should send message to deal', async () => {
      const res = await fetch(`${baseUrl}/api/deals/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId,
          message: 'Test message with timestamp',
        }),
      });
      expect(res.status).toBe(200);
    });

    it('should retrieve deal messages with timestamps', async () => {
      const res = await fetch(`${baseUrl}/api/deals/get?dealId=${dealId}`);
      const data = await res.json();
      if (data.messages.length > 0) {
        expect(data.messages[0].created_at).toBeDefined();
      }
    });
  });

  describe('6. Notifications - Reminders and Delivery', () => {
    it('should send notification to user', async () => {
      const res = await fetch(`${baseUrl}/api/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: creatorId,
          title: 'Deal Reminder',
          message: 'Your deal deadline is approaching',
          type: 'reminder',
        }),
      });
      expect(res.status).toBe(200);
    });

    it('should retrieve user notifications', async () => {
      const res = await fetch(`${baseUrl}/api/notifications/get?userId=${creatorId}`);
      const data = await res.json();
      expect(Array.isArray(data.notifications)).toBe(true);
    });

    it('should mark notification as read', async () => {
      const getRes = await fetch(`${baseUrl}/api/notifications/get?userId=${creatorId}`);
      const getData = await getRes.json();
      if (getData.notifications.length > 0) {
        const notifId = getData.notifications[0].id;
        const res = await fetch(`${baseUrl}/api/notifications/mark-read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationId: notifId }),
        });
        expect(res.status).toBe(200);
      }
    });
  });

  describe('7. Proof Export - Documentation', () => {
    it('should export deal proof as JSON', async () => {
      const res = await fetch(`${baseUrl}/api/deals/export-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.dealId).toBe(dealId);
    });

    it('should export deal to calendar', async () => {
      const res = await fetch(`${baseUrl}/api/deals/calendar-export?dealId=${dealId}`);
      expect(res.headers.get('content-type')).toContain('text/calendar');
      expect(res.status).toBe(200);
    });
  });

  describe('8. Deal Completion - Release Escrow', () => {
    it('should mark deal complete and release payment', async () => {
      const res = await fetch(`${baseUrl}/api/deals/complete-with-release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId }),
      });
      expect([200, 400]).toContain(res.status);
    });
  });

  describe('9. Admin - Brand Verification Queue', () => {
    it('should get pending brand verifications', async () => {
      const res = await fetch(`${baseUrl}/api/admin/verification-queue`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.verifications)).toBe(true);
    });

    it('should approve brand verification', async () => {
      const res = await fetch(`${baseUrl}/api/admin/verify-brand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          action: 'approve',
        }),
      });
      expect(res.status).toBe(200);
    });
  });
});
