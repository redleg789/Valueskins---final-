# Third-Party Vendor Compliance Audit

## Vendors Used

### Render (PostgreSQL Hosting)
- **Service**: Database hosting
- **Data**: All user data
- **SOC 2**: Yes (Type II)
- **GDPR**: Compliant
- **DPA**: Required
- **Last Audit**: May 2026
- **Status**: ✅ Compliant

### Vercel (Frontend Hosting)
- **Service**: Next.js deployment
- **Data**: Source code, build artifacts
- **SOC 2**: Yes (Type II)
- **GDPR**: Compliant
- **DPA**: Required
- **Last Audit**: May 2026
- **Status**: ✅ Compliant

### Google (OAuth Provider)
- **Service**: User authentication
- **Data**: Email, name (via OAuth)
- **Privacy Policy**: https://policies.google.com/privacy
- **GDPR**: Compliant
- **Last Audit**: May 2026
- **Status**: ✅ Compliant

### Google Analytics (Optional)
- **Service**: Website analytics
- **Data**: Pages visited, user behavior
- **Consent**: Required (opt-in)
- **GDPR**: Compliant
- **Data Residency**: EU available
- **Last Audit**: May 2026
- **Status**: ✅ Compliant (with consent)

### Mixpanel (Optional)
- **Service**: Product analytics
- **Data**: Feature usage, events
- **Consent**: Required (opt-in)
- **GDPR**: Compliant
- **Data Deletion**: Supported
- **Last Audit**: May 2026
- **Status**: ✅ Compliant (with consent)

## Compliance Requirements

### Data Processing Agreements (DPA)
All vendors handling personal data must have signed DPA covering:
- Data security measures
- Subprocessor notification
- Data deletion on termination
- Breach notification within 48h
- Right to audit

### Annual Review Checklist
- [ ] Request latest SOC 2 report
- [ ] Verify GDPR compliance statement
- [ ] Check for security updates
- [ ] Audit CVE disclosures
- [ ] Verify SLA maintenance
- [ ] Test data export/deletion

### Subprocessors
- List of all subprocessors in DPA
- Customer notification for changes
- 30-day objection period

## Risk Assessment

### Critical Vendors
- **Render**: Database - HIGH risk if compromised
  - Mitigation: Encryption, RLS, backups

### High Risk Vendors
- **Vercel**: Deployment - MEDIUM risk
  - Mitigation: Code review, secrets management

### Medium Risk Vendors
- **Google Analytics**: Analytics - LOW risk
  - Mitigation: Consent-based, data minimization

## Vendor Contingency Plans

### If Render Goes Down
1. Failover to backup database (cross-region)
2. RTO: 1 hour
3. RPO: 1 hour

### If Vercel Goes Down
1. Redeploy to AWS S3 + CloudFront
2. RTO: 30 minutes
3. RPO: N/A (stateless)

## Quarterly Compliance Check
- [ ] All DPAs current
- [ ] SOC 2 reports valid
- [ ] No new security incidents
- [ ] GDPR compliance maintained
- [ ] Data residency verified
- [ ] Subprocessor list updated

**Last Updated**: May 31, 2026  
**Next Review**: August 31, 2026
