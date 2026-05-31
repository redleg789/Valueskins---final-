# Consent Management System

## Overview
Complete consent tracking for GDPR/CCPA compliance. All consents are trackable, revocable, and logged.

## Consent Types

### 1. Cookie Consent
**Location**: Cookie banner (bottom of page)  
**Required**: Optional (only essential cookies required)  
**Managed via**: CookieConsent component

**Categories**:
- Essential (authentication, security) - REQUIRED
- Analytics (Google Analytics, Mixpanel) - OPTIONAL
- Marketing (ads, retargeting) - OPTIONAL
- Preferences (theme, language) - OPTIONAL

**Storage**: localStorage with key `valueskins_cookie_consent`  
**Revocable**: Yes (user can change anytime via preferences)  
**Duration**: Persists until cleared

### 2. Email Consent
**Types**:
- Marketing emails - OPT-IN (default: OFF)
- Notifications - OPT-IN (default: ON)
- Product updates - OPT-IN (default: ON)

**Management**: 
- /account/settings (authenticated users)
- Email unsubscribe links (all emails)

**Storage**: user_email_preferences table

### 3. Account/Data Sharing Consent
**Scope**: Third-party integrations
**Default**: No sharing
**Revocable**: Yes

## User Rights

### Access
- **Endpoint**: GET /api/legal/export
- **Format**: JSON
- **Response Time**: Immediate
- **User Can**: Download all their data

### Portability
- **Endpoint**: GET /api/legal/export
- **Format**: JSON
- **Includes**: Profile, messages, preferences
- **User Can**: Migrate to another platform

### Deletion
- **Endpoint**: POST /api/legal/delete
- **Grace Period**: 30 days (can cancel)
- **Automatic**: Permanent deletion after 30 days
- **User Can**: Delete account anytime

### Rectification
- **Endpoint**: PATCH /api/account/update
- **Fields**: display_name, avatar_url
- **Audit Trail**: Changes logged
- **User Can**: Update their information

### Objection
- **Email Unsubscribe**: All email types
- **Analytics Opt-out**: Cookie preferences
- **Marketing Opt-out**: Cookie preferences

## Audit Trail

All consents logged in audit_logs table:
```sql
SELECT * FROM audit_logs
WHERE operation IN ('CONSENT_GIVEN', 'CONSENT_REVOKED', 'DATA_EXPORT', 'DATA_DELETE')
AND user_id = $1;
```

Fields tracked:
- User ID
- Consent type
- Timestamp
- IP address
- User agent
- Change (given/revoked)

## Compliance Verification

### GDPR Article 7
✅ Consent is freely given, specific, informed, unambiguous  
✅ Separate from other terms  
✅ Easy to withdraw  
✅ Proof available on request  

### CCPA
✅ Opt-out available for data sales  
✅ User can request deletion  
✅ User can request data export  
✅ No discrimination for exercising rights  

### CASL (Canada)
✅ Express or implied consent required  
✅ Easy unsubscribe option  
✅ Sender identification  

### LGPD (Brazil)
✅ Legal basis documented  
✅ Consent tracked  
✅ User rights implemented  

## Implementation Checklist

- [x] Cookie consent banner
- [x] Cookie preferences modal
- [x] Email preference center
- [x] Data export endpoint
- [x] Data deletion endpoint
- [x] Audit logging
- [ ] Email verification
- [ ] Consent receipts (email)
- [ ] Preference center page
- [ ] Consent withdrawal confirmation

## Testing

### Manual Tests
1. Accept all cookies → analytics scripts load
2. Reject all cookies → only essential work
3. Export data → JSON download
4. Request deletion → 30-day queue
5. Unsubscribe → email removed from list
6. Change preferences → event fires

### Compliance Tests
- [ ] Consent given before tracking
- [ ] User can revoke anytime
- [ ] Proof of consent stored
- [ ] No consent = no tracking
- [ ] Export complete
- [ ] Deletion works

## User Communication

### On Signup
- Cookie consent required
- Privacy policy link
- Terms of service link

### On Login
- Optional: Remind of data rights
- Optional: Offer data export

### In Account Settings
- "My Data" page
- Download data link
- Delete account link
- Email preferences

### In Emails
- Unsubscribe link (every email)
- Privacy policy link
- Contact info
