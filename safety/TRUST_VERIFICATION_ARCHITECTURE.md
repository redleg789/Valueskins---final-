# ValueSkins Trust + Verification System: Production Architecture

**Version**: 1.0.0
**Classification**: CONFIDENTIAL — Trust & Safety Core
**Design Authority**: Security, Identity, Legal, Trust & Safety

---

## Table of Contents

1. [Age System](#section-1-age-system)
2. [Enterprise Verification](#section-2-enterprise-verification)
3. [Security Threat Model](#section-3-security)
4. [Trust System](#section-4-trust-system)
5. [Badge System](#section-5-badge-system)
6. [Contracts](#section-6-contracts)
7. [Database Design](#section-7-database-design)
8. [Moderation](#section-8-moderation)
9. [Operational Reality](#section-9-operational-reality)
10. [Final Architecture](#section-10-final-architecture)

---

## SECTION 1: AGE SYSTEM

### 1.1 Should Users Under 18 Be Allowed?

**Yes, but with strict guardrails.**

Minors represent a significant creator demographic. Excluding them loses market share to competitors (YouTube, TikTok, Instagram) that support under-18 creators. However, supporting minors requires legal compliance (COPPA in US, GDPR/UK Age Appropriate Design Code in EU/UK, state-by-state variations) and robust technical controls.

### 1.2 State Machine: User Age Verification

```
                    ┌─────────────────────────────────────────────┐
                    │              UNVERIFIED                     │
                    │  (No age data provided at signup)           │
                    └──────────┬──────────────────────────────────┘
                               │ User provides DOB
                               ▼
                    ┌─────────────────────────────────────────────┐
                    │         PENDING_SELF_DECLARATION            │
                    │  (DOB provided, awaiting verification)      │
                    └──────────┬──────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
          ┌──────────────────┐  ┌──────────────────────────┐
          │SELF_DECLARED_ADULT│  │PENDING_DOCUMENT_UPLOAD    │
          │(Claimed 18+, no  │  │(Under 18, needs document) │
          │ document yet)    │  │                            │
          └────────┬─────────┘  └───────────┬────────────────┘
                   │                        │
                   ▼                        ▼
          ┌──────────────────┐  ┌──────────────────────────┐
          │PENDING_DOCUMENT  │  │PENDING_DOCUMENT_REVIEW    │
          │_UPLOAD           │  │(Document submitted)       │
          │(Document needed) │  │                            │
          └────────┬─────────┘  └───────────┬────────────────┘
                   │                        │
                   │              ┌─────────┴──────────┐
                   │              ▼                    ▼
                   │    ┌──────────────────┐  ┌──────────────┐
                   │    │DOCUMENT_REJECTED │  │  PASSED      │
                   │    │(Failed verify)   │  │              │
                   │    └────────┬─────────┘  └───────┬──────┘
                   │             │                    │
                   │             ▼                    │
                   │    ┌──────────────────┐          │
                   │    │  AGE_ESCALATED   │          │
                   │    │(Manual review)   │          │
                   │    └──────────────────┘          │
                   │                                  │
                   └──────────────────────────────────┘
                                                      │
                                  ┌───────────────────┴──────────────┐
                                  ▼                                  ▼
                     ┌────────────────────────┐    ┌──────────────────────────┐
                     │    MINOR_PENDING_      │    │     ADULT_ACTIVE          │
                     │    GUARDIAN            │    │  (Full independent access)│
                     │    (Under 18 verified) │    │                            │
                     └───────────┬────────────┘    └──────────────────────────┘
                                 │
                                 ▼
                     ┌────────────────────────┐
                     │ MINOR_GUARDIAN_PENDING │
                     │ _APPROVAL              │
                     │ (Guardian invited)     │
                     └───────────┬────────────┘
                                 │
                     ┌───────────┴───────────┐
                     ▼                       ▼
           ┌──────────────────┐   ┌──────────────────────┐
           │MINOR_GUARDIAN_   │   │GUARDIAN_REJECTED/    │
           │APPROVED          │   │EXPIRED               │
           │(Guardian consents)│  │                      │
           └────────┬─────────┘   └──────────────────────┘
                    │
                    ▼
           ┌──────────────────┐
           │   MINOR_ACTIVE   │
           │  (Limited ops)   │
           └────────┬─────────┘
                    │ (Turns 18)
                    ▼
           ┌──────────────────┐
           │AGE_TRANSFERRING_ │
           │TO_ADULT          │
           └────────┬─────────┘
                    │
                    ▼
           ┌──────────────────┐
           │   ADULT_ACTIVE   │
           └──────────────────┘

  FRAUD/INVESTIGATION PATHS (from any state):
           ┌──────────────────┐
           │  AGE_LOCKED      │  ← Age forgery, fake documents
           ├──────────────────┤
           │  AGE_UNDER_REVIEW│  ← Suspicious activity, dispute
           ├──────────────────┤
           │  AGE_EXPIRED     │  ← Verification expired
           └──────────────────┘
```

### 1.3 Transitions

| From | To | Trigger | Validation |
|------|----|---------|------------|
| UNVERIFIED | PENDING_SELF_DECLARATION | User submits DOB at signup | DOB must be valid date, not future, not > 120 years ago |
| PENDING_SELF_DECLARATION | SELF_DECLARED_ADULT | User claims 18+ | Calculated age >= 18 |
| PENDING_SELF_DECLARATION | PENDING_DOCUMENT_UPLOAD | User claims under 18 | Calculated age < 18 |
| SELF_DECLARED_ADULT | PENDING_DOCUMENT_UPLOAD | Random audit OR threshold triggered | 1 in N audit rate  OR creator crosses earnings/contract threshold |
| PENDING_DOCUMENT_UPLOAD | PENDING_DOCUMENT_REVIEW | User uploads identity document | Document must be valid type, not expired, legible |
| PENDING_DOCUMENT_REVIEW | DOCUMENT_REJECTED | Automated/ manual verification fails | Document fails liveness, OCR mismatch, forgery detection |
| PENDING_DOCUMENT_REVIEW | MINOR_PENDING_GUARDIAN | Document verified + age < 18 | DOB on document confirms under 18 |
| PENDING_DOCUMENT_REVIEW | ADULT_ACTIVE | Document verified + age >= 18 | DOB on document confirms 18+ |
| DOCUMENT_REJECTED | AGE_ESCALATED | Repeated rejection or fraud detected | > 3 rejections OR forgery detected |
| MINOR_PENDING_GUARDIAN | MINOR_GUARDIAN_PENDING_APPROVAL | Guardian invite sent | Valid guardian user ID, not same as minor |
| MINOR_GUARDIAN_PENDING_APPROVAL | MINOR_GUARDIAN_APPROVED | Guardian completes consent flow | Guardian ID verified, consent doc signed, permissions configured |
| MINOR_GUARDIAN_APPROVED | MINOR_ACTIVE | Initial permissions configured | Guardian configured minimum required permissions |
| MINOR_ACTIVE | AGE_TRANSFERRING_TO_ADULT | Minor turns 18 | System checks DOB daily, triggers 30-day transfer window |
| AGE_TRANSFERRING_TO_ADULT | ADULT_ACTIVE | Transfer complete | Guardian notified, permissions revoked, minor confirms |
| ANY | AGE_LOCKED | Fraud detection OR legal hold | Triggered by risk engine OR trust & safety action |
| ANY | AGE_UNDER_REVIEW | Suspicious activity | Flagged by AI, manual review required |
| ADULT_ACTIVE | AGE_EXPIRED | Re-verification due | Configurable period (default 2 years) |

### 1.4 Legal Ownership & Signing

| Question | Answer |
|----------|--------|
| Who legally owns the account? | **The minor owns the account.** The guardian has custodial control, not ownership. Per COPPA/GDPR, personal data belongs to the individual. Guardian manages consent on minor's behalf. |
| Who signs agreements? | **Both minor AND guardian.** Contracts require dual-signature. Minor's signature represents their agreement to perform; guardian's signature represents financial responsibility and legal consent. |
| What happens when creator turns 18? | 30-day transfer window: (1) System notifies both minor and guardian; (2) Guardian is asked to confirm transfer; (3) If no response in 30 days, auto-transfer; (4) Guardian permissions revoked; (5) User marked ADULT_ACTIVE; (6) Re-verify identity if documents expired. |
| What if parent relationship changes? | Guardian can request relationship termination via trust & safety. Must provide court order if disputed. Minor can request new guardian. Old guardian permissions suspended during transition. |
| How do disputes work? | Three-party disputes: minor vs guardian vs brand. Guardian represents minor's legal interests. If guardian and minor disagree, court order required. Neutral moderator assigned. |
| How do revocations work? | Guardian can revoke consent at any time. Immediate freeze on new contracts. In-flight contracts subject to legal review. Payouts to minor held in escrow until resolved. |
| How are withdrawals handled? | **Dual-approval required.** Guardian must approve all payouts. Payouts go to guardian-managed account or joint account. Above a threshold, both must sign. Below threshold, guardian can pre-approve. |
| What if a child lies about age? | If caught before activity: reset to PENDING_DOCUMENT_UPLOAD. If caught after contracts/payments: account frozen, legal review, potential reversal of contracts involving minors. |
| What if age is forged (adult claiming to be minor or vice versa)? | Instant AGE_LOCKED. Trust & safety investigation. Document forensic analysis. IP + device fingerprinting. Legal hold on all contracts. |
| What if documents are fake? | Forensic document analysis. AI forgery detection. Lock account. Refer to fraud investigation. If confirmed: permanent ban, legal referral. |
| What if someone changes age after account creation? | DOB changes require identity document upload. Previous document hash retained for audit. Fraud check on discrepancy. If discrepancy > 2 years from previous document: automatic fraud flag. |
| What happens during account recovery? | Standard recovery + guardian notification. If minor: guardian must confirm recovery. If adult: standard flow. Guardian account hack: immediate freeze, identity re-verification required. |
| What if guardian account is hacked? | Guardian account has elevated privileges. Immediate triggers: (1) Minor notified; (2) All guardian permissions suspended; (3) Account recovery initiated for guardian; (4) Identity re-verification required; (5) Trust & safety reviews recent guardian actions for abuse. |

### 1.5 Guardian Dashboard Required Features

- View linked minors
- Grant/revoke granular permissions
- Approve/reject contracts
- Approve/reject payouts
- Set spending limits
- View minor's activity summary (NOT raw messages — privacy preserved)
- Configure auto-approval rules (e.g., "auto-approve contracts under $500")
- Receive notifications for pending approvals
- Transfer guardianship
- Request account deletion

### 1.6 Under-18 Account Restrictions

| Feature | Minor (w/ guardian) | Minor (no guardian) | Adult |
|---------|---------------------|--------------------|-------|
| Profile creation | ✅ Guardian approval needed | ❌ Locked | ✅ |
| Browse opportunities | ✅ | ✅ | ✅ |
| Apply to opportunities | ✅ Guardian must approve | ❌ | ✅ |
| Receive offers | ✅ | ❌ | ✅ |
| Negotiate terms | ✅ (with guardian oversight) | ❌ | ✅ |
| Sign contracts | ❌ Dual-signature required | ❌ | ✅ |
| Receive payments | ✅ (to guardian-approved account) | ❌ | ✅ |
| Withdraw funds | ✅ (guardian approval required) | ❌ | ✅ |
| Message brands | ✅ (guardian can view) | ❌ | ✅ |
| Delete account | ❌ Guardian must approve | ❌ | ✅ |
| Manage own team | ❌ | ❌ | ✅ |

---

## SECTION 2: ENTERPRISE VERIFICATION

### 2.1 Company Verification Tiers

```
UNVERIFIED
    │ User claims company name + website
    ▼
DOMAIN_CLAIMED
    │ DNS TXT record verification initiated
    ▼
DNS_VERIFIED
    │ TXT record confirmed on domain
    ▼
BUSINESS_REGISTRATION_SUBMITTED
    │ User uploads business registration docs
    ▼
BUSINESS_REGISTRATION_VERIFIED
    │ Docs confirmed via government database
    ├────────────────────────────────────────────┐
    ▼                                             ▼
EMPLOYEE_VERIFIED                          ENTERPRISE_VERIFIED
    │ At least 1 employee verified           │ Large enterprise (Fortune 5000)
    ▼                                         │ Multi-factor verification
BUSINESS_VERIFIED                              │ Additional checks:
    │ Full business verification               │ - Stock exchange listing
    │ - Tax ID confirmed                       │ - SEC filings
    │ - Registration number confirmed          │ - D&B report
    │ - Address verified                       │ - Manual review
    │ - Industry classification                ▼
    │ - Beneficial ownership (if req)    STRATEGIC_PARTNER
    ▼                                         │ Platform-partner agreement
GOVERNMENT_VERIFIED                            │ Signed MSA
    │ Government entity specific               │ Dedicated support
    │ - .gov domain required                   │ Revenue share terms
    │ - Official letterhead
    │ - Procurement ID
```

### 2.2 Requirements Per Tier

| Tier | Requirements | Verification Methods | Icon |
|------|-------------|---------------------|------|
| Unverified | Nothing | None | — |
| Domain Claimed | Company name, website URL, valid email | Email challenge to domain | 📧 |
| DNS Verified | Control of domain DNS | TXT record with verification token | 🔗 |
| Business Registration Submitted | Registration document | File upload | 📄 |
| Business Registration Verified | Valid registration | Government DB check, D&B, manual review | 🏛️ |
| Employee Verified | 1+ employee verified | Work email + LinkedIn + optional doc | 👤 |
| Business Verified | Full registration + employee base | All of above + tax ID + beneficial ownership | ✅ |
| Enterprise Verified | Large organization | Stock listing, revenue check, manual review | ⭐ |
| Government Verified | Government entity | .gov domain, official letterhead, procurement ID | 🏛️ |
| Strategic Partner | Signed agreement | Legal contract, board approval | 🤝 |

### 2.3 Impersonation Prevention

**Attack: Fake Google account.**

Someone creates profile "Google Partnerships," claims to be Google. Without verification, they could defraud creators.

**Prevention layers:**

1. **Domain ownership enforcement**: Only verified domains can represent a company. `google.com` must be DNS-verified.

2. **Subsidiary whitelist**: Companies can register subsidiaries. Claiming "Google India" requires proof of relationship to `google.com`.

3. **Name locking**: Once `Google LLC` is verified, new accounts using name variants (`Google`, `Google.Inc`, `Google Partnerships`) are flagged for manual review.

4. **Domain similarity detection**: Accounts using domains like `googie.com`, `go0gle.com`, `g00gle.com` (homograph attack) are auto-blocked. Punycode/homoglyph detection at signup.

5. **Employee verification required for company accounts**: A company account requires at least one verified employee.

6. **Agency verification**: Agencies representing Google must provide (a) their own business verification, AND (b) a signed authorization from Google's verified account. Agency impersonation is blocked by requiring the principal company to approve the agency relationship.

7. **Regional office protection**: Regional offices must be linked to parent company. Claiming "Google Japan" needs proof from someone verified at `google.com` corporate.

8. **Real-time brand protection scanning**: Monitor for new accounts using trademarked names. Auto-flag for trust & safety review.

### 2.4 Employee Verification Flow

```
User claims: "I work at Google"
    │
    ▼
┌─────────────────────────────────────────────┐
│ Step 1: Work Email Verification              │
│ User enters email: user@google.com           │
│ Verification code sent to that email.        │
│ User clicks link.                            │
│ → Email verified.                            │
└─────────────────────────────────────────────┘
    │
    ▼ (Optional but recommended)
┌─────────────────────────────────────────────┐
│ Step 2: LinkedIn Verification                │
│ User connects LinkedIn.                      │
│ System checks: current position at Google.   │
│ → LinkedIn confirmed.                        │
└─────────────────────────────────────────────┘
    │
    ▼ (Optional — for sensitive roles)
┌─────────────────────────────────────────────┐
│ Step 3: Employment Document                  │
│ User uploads: offer letter, payslip, or      │
│ company badge (PII redacted).                │
│ OCR + document forensics check.              │
│ → Document verified.                         │
└─────────────────────────────────────────────┘
    │
    ▼ (For HIGH-risk roles)
┌─────────────────────────────────────────────┐
│ Step 4: DNS-Based Verification               │
│ User adds a TXT record to google.com:        │
│ "valueskins-verify=user_id:timestamp:hash"   │
│ System checks DNS for the record.            │
│ → DNS verified (only for domain admins).     │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ Step 5: Manual Review (if needed)            │
│ Trust & safety reviews:                      │
│ - Email domain matches company               │
│ - LinkedIn looks legitimate                  │
│ - No red flags in risk engine                │
│ → Manually verified.                         │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ Result: FULLY_VERIFIED employee at Google   │
│ Company gains +1 employee verification.     │
│ Employee receives company role.             │
│ Trust score updated.                        │
│ Badge awarded: Employee at Google.          │
└─────────────────────────────────────────────┘
```

### 2.5 Edge Cases in Employee Verification

| Scenario | Handling |
|----------|----------|
| User uses personal email (gmail.com) | Rejected. Must use company domain. If no company email (contractor), use LinkedIn or DNS verification. |
| Contractor at Google | Contractor verification flow: LinkedIn + contract document. Limited permissions (CONTRACTOR role). |
| Agency representing Google | Agency must: (1) Verify their own company; (2) Google must approve agency relationship from their verified account; (3) Agency gets AGENCY role. |
| Recruiter at external agency | RECRUITER role. Can view candidates, post opportunities. Cannot sign contracts. Cannot represent company legally. |
| Employee left company | Verification expires. Role revoked. Company notified. |
| Employee changes role internally | Re-verification recommended. Role updated automatically if LinkedIn/DNS confirms. |
| Employee fired / bad terms | Company admin can revoke immediately. Access terminated. |
| Mass layoffs at company | Verification batch expiry. Grace period for affected employees. |
| Company acquisition | Verification transfers. New parent company verified. Employees need re-verification if domain changes. |

### 2.6 Role Hierarchy & Permission Matrix

```
┌─────────────────────────────────────────────────────────────────────┐
│                     COMPANY ROLE HIERARCHY                          │
│                                                                     │
│                    ┌──────────┐                                     │
│                    │  OWNER   │ ← Full control                      │
│                    └────┬─────┘                                     │
│                         │                                            │
│                    ┌────┴─────┐                                     │
│                    │  ADMIN   │ ← Management                        │
│                    └────┬─────┘                                     │
│                         │                                            │
│         ┌───────────────┼───────────────┐                           │
│         │               │               │                           │
│    ┌────┴────┐   ┌──────┴──────┐  ┌────┴─────┐                     │
│    │  LEGAL  │   │   HIRING    │  │PARTNERSHIP│                     │
│    │(Contracts│  │(Opportunities│  │  (Deals)  │                     │
│    │ disputes)│  │ applications)│  │           │                     │
│    └─────────┘  └─────────────┘  └──────────┘                       │
│                         │                                            │
│                    ┌────┴─────┐                                     │
│                    │ EMPLOYEE │ ← Standard access                   │
│                    └────┬─────┘                                     │
│                         │                                            │
│         ┌───────────────┼───────────────┐                           │
│         │               │               │                           │
│    ┌────┴────┐   ┌──────┴──────┐  ┌────┴─────┐                     │
│    │CONTRACTOR│  │  RECRUITER  │  │  AGENCY  │                     │
│    │(External)│  │ (Candidates)│  │  (Rep)   │                     │
│    └─────────┘  └─────────────┘  └──────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Permission matrix** is stored in `company_role_permissions` table (see migration). Each role gets a curated set of 24+ company permissions.

---

## SECTION 3: SECURITY THREAT MODEL

### 3.1 Attack Catalog

#### Account Takeover (ATO)

| Property | Detail |
|----------|--------|
| **Risk** | Critical — attacker gains full control, can sign contracts, withdraw funds, access PII |
| **Mitigation** | MFA required for payments/contracts. Risk-based authentication (new device, new IP, new location triggers step-up). Login notification to verified email/phone. Device fingerprinting. Passwordless options (WebAuthn, passkeys). |
| **Detection** | Impossible travel detection. Sudden device/location change. Behavioral biometrics (typing pattern, mouse movement). Failed login velocity. |
| **Response** | Force logout all sessions. Trigger account recovery. Freeze contracts/payments. Notify user via verified channel. Initiate investigation. |

#### Fake Enterprises

| Property | Detail |
|----------|--------|
| **Risk** | High — attackers impersonate trusted brands to defraud creators |
| **Mitigation** | DNS domain verification. Business registration checks. Name similarity blocking. Employee verification requirement. Manual review for high-profile companies. |
| **Detection** | Domain age check (newly registered domains flagged). Domain similarity scoring (Levenshtein distance on known brands). Registration document forgery detection. |
| **Response** | Freeze account. Mark as impersonation attempt. Notify real company if verified. Legal referral for trademark violation. |

#### Bot Farms / Mass Fake Creator Accounts

| Risk | Mitigation | Detection | Response |
|------|-----------|-----------|----------|
| High — sybil attacks, fake engagement | CAPTCHA on signup. Phone verification required for messaging. Email verification required for profile creation. Rate-limited signup per IP (3/day). Device fingerprinting. | Signup velocity per IP/fingerprint. Behavioral analysis (real users browse, bots script). Profile completeness distribution (bots have sparse profiles). Account age vs activity ratio. | Bulk account freeze. IP block. Fingerprint block. Shadowban suspected bots (they see normal app, nobody sees them). |

#### KYC Fraud / Synthetic Identities

| Risk | Mitigation | Detection | Response |
|------|-----------|-----------|----------|
| Critical — fake identities used for money laundering | Multi-layer KYC: ID document + selfie + liveness check. Cross-reference with government databases. PEP/sanctions screening. Source of funds check for high-value accounts. | Document forgery detection (AI). Liveness check bypass detection. Identity inconsistency (DOB on ID vs declared). Social security number validity check. | Reject KYC. Flag for fraud investigation. Report to authorities if thresholds met. |

#### Payment Fraud

| Risk | Mitigation | Detection | Response |
|------|-----------|-----------|----------|
| Critical — stolen cards, chargeback fraud, money laundering | Stripe Radar + custom risk rules. 3D Secure for all payments. Idempotency keys prevent duplicate charges. Escrow for large deals. Payment method verification (micro-deposits). | Chargeback velocity. Same card on multiple accounts. Sudden spending pattern change. Geographic inconsistency (card issued in US, used from Nigeria). | Reverse transaction. Freeze account. Notify Stripe. File SAR if > $10K. |

#### Collusion (fake deals to inflate reputation)

| Risk | Mitigation | Detection | Response |
|------|-----------|-----------|----------|
| Medium — reputation gaming, money laundering | Collusion detection: same IP/browser fingerprint across creator/brand accounts. Network analysis: do the parties know each other off-platform? Deal pattern analysis: reciprocal deals (A pays B, B pays A). | Pattern: two accounts always work together. No external social proof. Unusual deal terms (very high/low amounts without deliverables). | Flagged deals downranked. Reputation score excluded for flagged collusion. Account freeze if systematic. |

#### Stolen / AI-Generated Documents

| Risk | Mitigation | Detection | Response |
|------|-----------|-----------|----------|
| High — identity fraud | Document forensics: check metadata, compression artifacts, editing history. Liveness check (user must be present during selfie). Cross-check with existing documents (same document used by multiple users?). | EXIF data analysis. Compression level inconsistency (AI-generated images have different noise patterns). Document number format validation. Hologram/watermark detection. | Reject document. Flag user for enhanced KYC. Lock account if multiple rejections. |

#### Fake Guardians

| Risk | Mitigation | Detection | Response |
|------|-----------|-----------|----------|
| High — adult posing as guardian to control minor | Guardian identity document required. Guardian selfie + liveness. Cross-check: does guardian have existing minor relationships? Is the age gap reasonable (guardian must be 21+/parent-age)? | Guardian IP vs minor IP (should be same household). Guardian document forensics. Social graph: does guardian exist as real user with history? Multiple minors linked to same guardian flagged. | Freeze relationship. Trust & safety investigation. Document verification escalation. |

#### Badge Selling / Purchased Verified Accounts

| Risk | Mitigation | Detection | Response |
|------|-----------|-----------|----------|
| High — monetizing trust, undermining platform integrity | Badges are non-transferable. Verification requires fresh identity proof. Trust score cannot be transferred. Account sales detected via IP/device change patterns. | Account login pattern change (different country, different device). Profile change speed (sudden name, photo, bio change). Support ticket: "I bought this account." | Freeze account. Require identity re-verification. If confirmed sold: permanent ban. Notify purchaser's identity document issuer if fraud suspected. |

### 3.2 Insider Abuse Prevention

| Threat | Mitigation |
|--------|-----------|
| Moderator accepts bribe to verify fake account | All moderator actions logged in immutable `moderator_audit_log`. Two-person rule for sensitive actions (account deletion, verification override). Random audit of moderator actions. Deny list of moderator-verified accounts (extra scrutiny). |
| Engineer modifies code to bypass verification | Code review required for all verification-related changes. Signed commits. Deployment approval. Database access logged. Verification bypass would require collusion (unlikely). |
| Support agent resets account without proper verification | Account recovery requires multiple verification factors. Support cannot override. Escalation requires trust & safety lead approval. All support actions logged. |

---

## SECTION 4: TRUST SYSTEM

### 4.1 Trust Engine Architecture

Not a simple blue check. Multi-dimensional weighted scoring.

**Score range**: 0 (absolute untrusted) to 1000 (maximum trust).

**Dimensions**:

| Dimension | Weight | Max Score | Description |
|-----------|--------|-----------|-------------|
| Identity Trust | 20% | 200 | How well is identity verified (email, phone, ID, selfie, KYC level) |
| Behavior Trust | 15% | 150 | Platform behavior (login consistency, profile completeness, policy compliance) |
| Payment Trust | 15% | 150 | Payment reliability (on-time payments, no chargebacks, transaction history) |
| History Trust | 15% | 150 | Deal history (completed deals, average rating, longevity) |
| Collaboration Trust | 10% | 100 | Collaboration quality (repeat partners, feedback, dispute history) |
| Reputation Trust | 10% | 100 | External reputation (referrals, network, off-platform signals) |
| Dispute Trust | 10% | 100 | Dispute history (count, resolution style, arbitration compliance) |
| Network Trust | 5% | 50 | Network quality (verified connections, diversity) |

### 4.2 Scoring Logic

```
total_score = Σ(weight_i × normalized_score_i)

Where:
  normalized_score_i = min(raw_score_i / max_score_i, 1.0) × max_score_i
  
Trust decays over time:
  effective_score = score × decay_factor(time_since_last_activity)

Decay:
  - 30 days no activity: 0.95x
  - 90 days no activity: 0.80x
  - 180 days no activity: 0.50x
  - 365 days no activity: 0.10x (essentially reset)
```

### 4.3 Key Questions

**Can trust decrease?**
Yes — immediately. A single dispute filing, chargeback, or policy violation can drop trust score. Score decreases are logged as negative `trust_score_events`.

**Can trust expire?**
Yes — continuously decays with inactivity. Identity verification expires after 2 years. Document verification expires after 1 year. KYC level expires after 1 year.

**Can trust transfer?**
No — trust is PERSONAL. Selling an account means the buyer inherits a 0 trust score (new device, new IP, new behavior pattern triggers risk engine). Trust transfer is prevented by design — it's the moat against account sales.

**Can purchased accounts retain trust?**
No — the risk engine detects account sales via behavioral changes. When a new device logs in, the account is flagged for verification. If the original owner is not reachable, trust score is frozen. Trust requires ongoing verification.

**Trust cannot be purchased.** Verification badges require identity proof. Trust score requires history. You cannot buy your way to trust — you must earn it through consistent good behavior.

### 4.4 Trust Score Tiers

| Score Range | Tier | Label | Visual |
|-------------|------|-------|--------|
| 0 | UNTRUSTED | New User | Gray shield |
| 1-200 | BASIC | Basic | Bronze shield |
| 201-400 | IDENTITY_VERIFIED | ID Verified | Silver shield |
| 401-600 | TRUSTED | Trusted | Gold shield |
| 601-800 | HIGHLY_TRUSTED | Highly Trusted | Platinum shield |
| 801-950 | VERIFIED | Verified | Diamond shield |
| 951-1000 | ELITE | Elite | Crown |

---

## SECTION 5: BADGE SYSTEM

### 5.1 Badge Categories

| Category | Purpose | Examples | TTL |
|----------|---------|----------|-----|
| IDENTITY | Prove identity verification | Email Verified, Phone Verified, ID Verified, Selfie Verified | Until revoked |
| TRUST | Signal trust level | Trusted Creator, Highly Trusted, Elite | Dynamic based on score |
| VERIFICATION | Signal verification status | Verified Creator, Business Verified, Enterprise Verified, Government Entity | 1-2 years |
| ACHIEVEMENT | Gamification | Early Adopter, Top Creator, 100 Deals Club | Permanent |
| RISK | Warning labels | Under Review, High Risk, Restricted, Probation | Until resolved |
| RESTRICTION | Indicate limitations | Guardian Managed, Minor Account | Until condition ends |

### 5.2 Abuse Scenarios

| Abuse | Scenario | Prevention |
|-------|----------|------------|
| Badge farming | Creators complete minimal tasks to collect badges | Badges require genuine sustained behavior, not one-time actions. Trust score weights decay. |
| False badge display | User tries to display badges they don't have | Badges server-authoritative. Client only renders what server sends. API returns active badges only. |
| Badge selling | "Verified" badge sold to another user | Badges non-transferable. Risk engine detects behavioral changes after badge sale. |
| Scary badges on legitimate users | High-risk badge on new user who just signed up | New Account badge is informational (yellow), not punitive. Risk badges only shown after AI analysis. |
| Badge hiding | Users hide warning badges | Warning badges are always visible. Trust & safety can override visibility. |

### 5.3 Badge Specifications

```
┌────────────────────────────────────────────────┐
│  RISK BADGES (always visible when active)      │
│                                                  │
│  ⚠️ NEW ACCOUNT    — Yellow, auto-removed      │
│    after 30 days or first completed deal        │
│                                                  │
│  🔍 UNDER REVIEW    — Orange, trust & safety    │
│    investigation in progress                    │
│                                                  │
│  ⛔ HIGH RISK       — Red, unusual activity     │
│    detected                                      │
│                                                  │
│  🔒 RESTRICTED      — Dark red, account         │
│    limitations applied                          │
│                                                  │
│  ⏳ PROBATION       — Orange, on thin ice       │
│    after policy violation                       │
│                                                  │
│  👤 GUARDIAN        — Gray, account managed     │
│    MANAGED           by parent/guardian          │
│                                                  │
│  🔞 MINOR ACCOUNT   — Gray, under 18            │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│  VERIFICATION BADGES (earned, visible)         │
│                                                  │
│  ✔ EMAIL VERIFIED   — Green                     │
│  ✔ PHONE VERIFIED   — Green                    │
│  🆔 ID VERIFIED     — Green                    │
│  📸 SELFIE VERIFIED — Green                    │
│                                                  │
│  ✅ VERIFIED        — Purple (platform-wide)    │
│  🏢 BUSINESS        — Indigo                    │
│  ⭐ ENTERPRISE      — Blue (large org)          │
│  🏛  GOVERNMENT     — Teal                      │
│  🤝 STRATEGIC       — Amber (partner)           │
│  👑 PUBLIC FIGURE   — Violet                    │
└────────────────────────────────────────────────┘

Display order: RISK badges first (top), then VERIFICATION, then TRUST, then ACHIEVEMENT.
Risk badges are always visible. Other badges can be hidden by user preference (not risk badges).
```

---

## SECTION 6: CONTRACTS

### 6.1 Contract State Machine

```
                    ┌─────────────────────────────────┐
                    │            DRAFT                │
                    │  (Being created, not yet sent)  │
                    └──────────┬──────────────────────┘
                               │ Creator/brand sends contract
                               ▼
                    ┌─────────────────────────────────┐
                    │       PENDING_REVIEW            │
                    │  (Sent to other party)          │
                    └──────────┬──────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
          ┌──────────────────┐  ┌──────────────────────┐
          │REVISION_REQUESTED│  │  (Proceed to sign)    │
          │(Changes needed)  │  │                       │
          └────────┬─────────┘  └──────────┬───────────┘
                   │                       │
                   └───────────────────────┘
                                           │
                               ┌───────────┴───────────┐
                               │                       │
                    ┌──────────┴──────┐    ┌───────────┴─────────┐
                    │PENDING_GUARDIAN│    │PENDING_COMPANY_SIGN  │
                    │(If minor involved│   │(If company involved) │
                    └──────────┬──────┘    └───────────┬─────────┘
                               │                       │
                    ┌──────────┴──────┐    ┌───────────┴─────────┐
                    │GUARDIAN_REJECTED│    │PENDING_COUNTER_SIGN │
                    └─────────────────┘    └───────────┬─────────┘
                                                        │
                                               ┌────────┴────────┐
                                               ▼                 ▼
                                     ┌──────────────────┐  ┌──────────────┐
                                     │    EXECUTED      │  │  CANCELLED   │
                                     │  (All signed)    │  │              │
                                     └────────┬─────────┘  └──────────────┘
                                               │
                                    ┌──────────┴──────────┐
                                    ▼                     ▼
                          ┌──────────────────┐  ┌──────────────────┐
                          │  IN_PROGRESS     │  │   DISPUTED       │
                          │  (Work ongoing)  │  │  (Formal dispute)│
                          └────────┬─────────┘  └────────┬─────────┘
                                   │                      │
                                   ▼                      ▼
                          ┌──────────────────┐  ┌──────────────────┐
                          │   COMPLETED      │  │  ARBITRATION     │
                          │(Deliverables met)│  │ (Legal process)  │
                          └──────────────────┘  └────────┬─────────┘
                                                          │
                                                ┌─────────┴─────────┐
                                                ▼                   ▼
                                      ┌──────────────────┐  ┌──────────────┐
                                      │  BREACHED /      │  │  RESOLVED    │
                                      │  TERMINATED /    │  │              │
                                      │  EXPIRED / VOIDED│  │              │
                                      └──────────────────┘  └──────────────┘
```

### 6.2 Contract Party Types

Each party to a contract has a `contract_party_type`:

- `INDIVIDUAL_ADULT` — independent adult
- `INDIVIDUAL_MINOR` — minor with guardian
- `GUARDIAN` — guardian signing on behalf of minor
- `COMPANY` — company as a party (requires verified company)
- `AGENCY` — agency representing a party
- `TRUST` — legal trust entity
- `LLC` — limited liability company
- `PARTNERSHIP` — business partnership
- `GOVERNMENT` — government entity

### 6.3 Signature Requirements by Party

| Party Type | Who Signs | Countersign |
|------------|-----------|-------------|
| Individual Adult | The user | — |
| Individual Minor | User + Guardian (dual) | Both must sign |
| Company (Owner) | User (verified as company OWNER/ADMIN) | Company legally bound |
| Company (Employee) | User (verified as company EMPLOYEE with SIGN_CONTRACTS permission) | Company approval if above threshold |
| Agency | Agency user + Principal company admin | Dual signature |
| Government | Authorized government official | Procurement approval |

### 6.4 Contract Integrity

| Concern | Solution |
|---------|----------|
| Tampering after signing | Contract content is SHA-256 hashed. Hash verified on every read. Mismatch = alert. |
| Revision tracking | Append-only `contract_revisions` table. Each revision has previous hash. |
| Idempotent creation | `external_id` (UUID) prevents duplicate contract creation. |
| Signature replay prevention | Signature includes: `user_id:contract_id:contract_hash:timestamp:nonce` |
| Version history | Full content stored for each version. Previous versions retained for audit. |
| Jurisdiction | Per-contract jurisdiction field. Default = "New York, USA". Parties can negotiate. |

### 6.5 Dispute Resolution Flow

```
1. Party files dispute (type: non_payment, missed_deadline, quality, etc.)
2. Both parties notified
3. Evidence uploaded by both sides
4. Automated escrow hold (if applicable)
5. Mediation period (14 days): parties can resolve directly
6. If unresolved → assigned trust & safety mediator
7. Mediator reviews evidence, makes non-binding recommendation
8. If rejected → arbitration (binding, per contract terms)
9. If arbitration rejected → legal escalation (court)
10. Outcome enforced by platform (refund, partial refund, full payment)
```

---

## SECTION 7: DATABASE DESIGN

### 7.1 Entity Relationship Summary

See `backend/migrations/20240401000000_trust_verification_core.sql` for full schema.

**Key design principles:**

1. **No boolean soup.** Every entity has an explicit state machine (PostgreSQL ENUM type). State transitions are logged and validated. Example: `user_age_verification_state` has 16 possible states — not 16 boolean columns.

2. **Append-only audit.** `trust_score_events`, `risk_events`, `audit_log`, and `moderator_audit_log` are immutable. No UPDATEs, only INSERTs. This provides a complete forensic trail.

3. **Partitioned audit logs.** `audit_log` is partitioned by quarter for query performance. Old partitions can be archived to cold storage.

4. **Row-Level Security (RLS).** Every sensitive table has RLS enabled. Users can only see their own data. Guardians can see minor data. Company employees can see company data.

5. **Explicit foreign keys with ON DELETE CASCADE where appropriate.** Referential integrity enforced at database level.

6. **SHA-256 hashes for sensitive fields.** DOB, phone numbers, tax IDs, email addresses are stored hashed. Raw values are never logged.

7. **JSONB for flexible metadata.** Extracted document data, verification results, risk event details stored as JSONB for query flexibility without schema changes.

### 7.2 Core Entities

| Entity | Key Fields | State Machine | Purpose |
|--------|-----------|---------------|---------|
| `user_verification_profiles` | user_id, date_of_birth_sha256, age_verification_state, trust_tier, trust_score, risk_level | `user_age_verification_state` (16 states) | 1:1 extension of users table for all trust/verification/age state |
| `guardian_relationships` | minor_user_id, guardian_user_id, relationship_state, invite_token | `guardian_relationship_state` (12 states) | Maps minors to guardians with explicit state machine |
| `guardian_permissions` | guardian_relationship_id, permission, is_granted | `guardian_permission` (18 permissions) | Granular permission delegation from guardian to minor |
| `companies` | legal_name, domain_name, company_state, tax_id_sha256, registration_number | `company_verification_state` (14 states) | Verified business entities |
| `company_domain_claims` | company_id, domain_name, verification_token_sha256, verified_at | — | Domain ownership verification records |
| `employee_verifications` | user_id, company_id, state, work_email_sha256, job_title | `employee_verification_state` (11 states) | Proves an individual works at a company |
| `company_roles` | company_id, user_id, role_type, is_active | `company_role_type` (9 roles) | RBAC within companies |
| `company_role_permissions` | role_type, permission, is_default | — | Permission-to-role mapping (seeded defaults) |
| `identity_documents` | user_id/company_id, document_type, file_storage_key, file_hash, document_status | — | Verifiable identity documents |
| `trust_score_events` | user_id/company_id, category, event_type, score_delta, score_before, score_after | `trust_event_category` (12 categories) | Immutable log of every trust score change |
| `trust_score_weights` | category, subcategory, weight, max_score, decay_days | — | Configurable scoring engine parameters |
| `contracts` | creator/brand users, companies, roles, contract_state, signatures, amounts | `contract_state` (17 states) | Production contract system |
| `contract_revisions` | contract_id, version, previous_content_hash, new_content_hash | — | Append-only revision history |
| `disputes` | contract_id, dispute_state, filed_by, type, evidence | `dispute_state` (13 states) | Formal dispute system |
| `dispute_evidence` | dispute_id, uploaded_by, file_storage_key, file_hash, is_verified | — | Evidence files for disputes |
| `risk_events` | user_id/company_id, event_type, severity, source_ip, details | `risk_event_type` (32 types) | Immutable log of risk/suspicious events |
| `verification_requests` | user_id/company_id, request_type, request_state, assigned_reviewer | `verification_request_type` (12 types) + `verification_request_state` (16 states) | Audit trail for all verification attempts |
| `badges` | badge_code, display_name, category, badge_type, is_automated | `badge_category` (8 categories) | Badge definitions |
| `user_badges` | user_id, badge_id, is_active, is_visible, expires_at | — | Badges awarded to users |
| `kyc_status` | user_id/company_id, kyc_level, kyc_state, pep/sanctions/adverse checks | `kyc_level` (8 levels) | Holistic KYC view |
| `moderation_queue` | target_user/company/contract, source, priority, ai_analysis, assigned_moderator | `moderation_queue_source` (9 sources) | Human + AI moderation queue |
| `moderator_audit_log` | moderator_user_id, action_type, target, previous/new_state | — | Immutable moderator action log |
| `approval_workflows` | entity_type, entity_id, workflow_state, current_step | `approval_entity_type` (9 types) + `approval_step_state` (6 states) | Generic workflow engine |
| `age_transfer_requests` | user_id, guardian_relationship_id, transfer_state | — | Minor to adult account transfer |
| `enterprise_claims` | claiming_user_id, claimed_company_name, actual_company_id, claim_state | — | Enterprise impersonation tracking |
| `account_recovery_requests` | user_id, recovery_method, recovery_state, risk_level | `recovery_method` (6 types) | Account recovery with guardian awareness |
| `audit_log` | actor, action, entity_type, entity_id, previous/new_state, changes, request_id | — | Partitioned immutable audit log (quarterly partitions) |

---

## SECTION 8: MODERATION

### 8.1 Multi-Layer Moderation Pipeline

```
User Action → AI Auto-Moderation → Review Queue → Human Moderation → Escalation
                   │                    │               │                  │
                   ▼                    ▼               ▼                  ▼
           Auto-approved/        Queued by         Assigned to       Escalated to
           rejected/flags        priority +        moderator or      senior team /
                                 category          enterprise team   legal
```

### 8.2 AI Moderation Layer

**Scope**: First-pass analysis on all verification requests, identity documents, content, and risk events.

**Capabilities**:
- Document forgery detection (JPEG artifacts, metadata inconsistency, AI generation markers)
- Liveness check verification
- Age estimation from ID photo
- OCR validation (document number format, DOB consistency)
- Name/entity matching against sanctions lists
- Domain reputation scoring
- Similarity scoring (account name vs known brands)
- Behavioral anomaly detection

**Triage logic**:
- Confidence > 0.95: Auto-approve (log for audit)
- Confidence 0.80-0.95: Flag for human review (low priority)
- Confidence 0.50-0.80: Flag for human review (medium priority)
- Confidence < 0.50: Flag for human review (high priority)
- Any forgery/risk signal detected: Escalate immediately

### 8.3 Human Moderation Queue

**Queue organization**:
- Priority: critical > high > medium > low
- Category: fraud, impersonation, document_issue, abuse, appeal
- Source: AI_flag, user_report, system_flag, enterprise_escalation

**SLAs**:
| Priority | Response Time | Resolution Time |
|----------|--------------|-----------------|
| Critical (active fraud) | 15 minutes | 1 hour |
| High (impersonation) | 1 hour | 4 hours |
| Medium (document issue) | 4 hours | 24 hours |
| Low (appeal) | 24 hours | 72 hours |

### 8.4 Moderator Tooling Requirements

- Case management interface (queue, assign, resolve)
- Evidence viewer (documents, screenshots, messages)
- Action selector (warn, suspend, freeze, ban, escalate)
- Notes system (internal-only)
- Appeal management
- Fraud investigation workspace (user history, IP history, payment history, device graph)
- Bulk action interface (for bot farm takedowns)
- Escalation to legal

### 8.5 Moderator Abuse Prevention

- Immutable `moderator_audit_log` for ALL actions
- Two-person rule: account deletion, verification override, trust score override require 2 moderators
- Random audit: 5% of moderator actions reviewed weekly
- Anomaly detection: moderator with unusual action patterns flagged
- No moderator can act on their own account or family accounts
- All moderation actions notify affected users
- Escalation path for users to appeal moderator decisions

### 8.6 Enterprise Moderation

Verified enterprises get:
- Dedicated support queue
- Faster SLA (15 min response for critical)
- Named account manager
- Bulk verification (import employee list)
- API access for moderation integrations

---

## SECTION 9: OPERATIONAL REALITY

### 9.1 False Positives

**Problem**: Legitimate users incorrectly flagged as fraud.

**Impact**: Lost creators, support tickets, brand damage, potential legal liability.

**Mitigations**:
- AI confidence thresholds tuned to favor false positives over false negatives initially (easy to auto-approve later)
- Clear appeal process with SLA
- Human review for borderline cases
- "New account" badge explains why restrictions apply
- Support team trained on verification-related issues
- Monthly false positive review: adjust thresholds based on appeal rate

### 9.2 False Negatives

**Problem**: Fraudulent users incorrectly verified.

**Impact**: Financial loss, platform reputation damage, legal liability.

**Mitigations**:
- Multiple verification layers (no single point of failure)
- Continuous monitoring post-verification
- Behavioral analysis catches what documents miss
- Trust score decays — fraudsters can't just pass once and forget
- Monthly red team exercises: try to bypass verification

### 9.3 Support Load

**Sources of support tickets**:
- Verification rejected (50% of volume)
- Guardian linking issues (15%)
- Account recovery (10%)
- Dispute questions (10%)
- Appeal requests (10%)
- Other (5%)

**Scalability strategy**:
- < 10K users: 1-2 dedicated trust & safety staff + AI moderation
- 10K-100K: 5-10 staff + automated appeals
- 100K-1M: 20-50 staff + tiered support
- 1M-10M: 50-200 staff + self-service tools + AI resolution
- 10M-100M: Regional teams + automated 80% of cases

### 9.4 Regional Law Compliance

| Law | Requirements | Implementation |
|-----|-------------|----------------|
| COPPA (US) | Parental consent for under 13 | Age gate at signup. Guardian linking + verified consent. No data collection without parent. |
| GDPR (EU) | Data minimization, consent, right to deletion | Privacy by design. Explicit consent for data processing. Automated deletion on request. |
| UK Age Appropriate Design Code | Best interest of child, high privacy defaults | Minors default to maximum privacy. No nudge techniques. No behavioral targeting. |
| CCPA (CA) | Right to know, delete, opt-out of sale | Privacy policy compliance. Data inventory. Deletion API. |
| India DPDP Act | Consent, data localization, DPO | Consent manager. India data residency (planned). DPO appointment. |
| Brazil LGPD | Similar to GDPR | Compatible with GDPR infrastructure. |

### 9.5 Scaling: 1K → 10M → 100M Users

**1K users (MVP)**:
- Manual verification + basic AI document checker
- Single trust & safety person
- Shared moderation queue (Slack webhook)
- Basic rate limiting + anomaly detection

**10K users (Growth)**:
- Automated AI document verification
- 5-person trust & safety team
- Moderation queue in dashboard
- Risk engine with basic rules
- Manual enterprise verification

**100K users (Scale)**:
- Full AI verification pipeline (liveness, forgery detection)
- 20-person trust & safety team
- Escalation tiers (L1, L2, L3)
- Automated enterprise verification (DNS + registration)
- Trust scoring engine live
- Regional support begins

**1M users (Regional)**:
- Regional trust & safety teams (US, EU, APAC, India)
- 100+ person trust & safety org
- Automated 80% of cases
- Self-serve appeals
- Real-time risk scoring
- Enterprise support team

**10M+ users (Global)**:
- ML models trained on platform data
- 500+ person trust & safety org
- Dedicated engineering team for trust infrastructure
- Real-time graph analysis for collusion/sybil detection
- Government liaison team
- Bug bounty program
- External audits

**100M users (Plateau)**:
- WhatsApp/Google-scale infrastructure
- 2000+ person trust & safety org
- Advanced ML (deepfake detection, behavioral biometrics)
- Real-time enforcement at edge
- Proactive threat hunting team
- Industry consortium participation
- Regulatory engagement team

---

## SECTION 10: FINAL ARCHITECTURE

### 10.1 Service Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ Web App  │  │ Mobile   │  │ API      │  │ Partner API        │  │
│  │ (Next.js)│  │ (React   │  │ Clients  │  │ (Enterprise)       │  │
│  │          │  │  Native) │  │ (3rd     │  │                    │  │
│  └──────────┘  └──────────┘  │  party)  │  └────────────────────┘  │
│                              └──────────┘                           │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ HTTPS + WSS
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Rate Limiter │ Auth Middleware │ Request Validation         │   │
│  │  (Token       │ (JWT + claims  │ (Zod schema, content-type) │   │
│  │   bucket)     │  extraction)   │                             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                   │                                   │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Routing: /api/v1/identity, /api/v1/trust, /api/v1/guardian│    │
│  │           /api/v1/verification, /api/v1/contracts,         │    │
│  │           /api/v1/disputes, /api/v1/moderation             │    │
│  └────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                                   │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  IDENTITY    │  │  GUARDIAN    │  │  TRUST       │              │
│  │  SERVICE     │  │  SERVICE     │  │  SERVICE     │              │
│  │              │  │              │  │              │              │
│  │ • Age verify │  │ • Guardian   │  │ • Score calc │              │
│  │ • Doc verify │  │   linking    │  │ • Event      │              │
│  │ • KYC flow   │  │ • Permissions│  │   processing │              │
│  │ • Liveness   │  │ • Transfer   │  │ • Tier       │              │
│  │ • Selfie     │  │ • Dashboard  │  │   management │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                        │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐              │
│  │ VERIFICATION │  │  CONTRACT    │  │  RISK        │              │
│  │ SERVICE      │  │  SERVICE     │  │  ENGINE      │              │
│  │              │  │              │  │              │              │
│  │ • Company    │  │ • Generation │  │ • Real-time  │              │
│  │ • Employee   │  │ • Signatures │  │   scoring    │              │
│  │ • Enterprise │  │ • Guardian   │  │ • Anomaly    │              │
│  │ • Document   │  │   approval   │  │   detection  │              │
│  │   forensic   │  │ • Revisions  │  │ • Fraud      │              │
│  └──────┬───────┘  └──────┬───────┘  │   analysis   │              │
│         │                 │           └──────┬───────┘              │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐              │
│  │ MODERATION   │  │  DISPUTE     │  │  AUDIT       │              │
│  │ SERVICE      │  │  SERVICE     │  │  SERVICE     │              │
│  │              │  │              │  │              │              │
│  │ • Queue mgmt │  │ • Filing     │  │ • Immutable  │              │
│  │ • AI triage  │  │ • Evidence   │  │   log        │              │
│  │ • Escalation │  │ • Mediation  │  │ • Query      │              │
│  │ • Appeals    │  │ • Resolution │  │ • Retention  │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└──────────────────────────┼──────────────────┼───────────────────────┘
                           │                  │
                           ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                      │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  PostgreSQL   │  │    Redis     │  │    Kafka     │              │
│  │  (Primary)    │  │  (Cache,     │  │  (Event Bus) │              │
│  │               │  │   Sessions,  │  │              │              │
│  │ • User data   │  │   Rate       │  │ • Trust      │              │
│  │ • Trust state │  │   Limits,    │  │   events     │              │
│  │ • Contracts   │  │   Locks)     │  │ • Risk       │              │
│  │ • Audit logs  │  │              │  │   events     │              │
│  │ • Risk events │  └──────────────┘  │ • Moderation │              │
│  │               │                    │ • Notificat. │              │
│  └──────┬───────┘                    └──────┬───────┘              │
│         │                                   │                        │
│  ┌──────┴───────┐                    ┌──────┴───────┐              │
│  │  PostgreSQL   │                    │    MinIO     │              │
│  │  (Read        │                    │  (S3-compat) │              │
│  │   Replica)    │                    │              │              │
│  │               │                    │ • Identity   │              │
│  │ • Read-heavy  │                    │   documents  │              │
│  │   queries     │                    │ • Evidence   │              │
│  │ • Analytics   │                    │ • Contract   │              │
│  │   reporting   │                    │   PDFs       │              │
│  └───────────────┘                    └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.2 Service Interaction Patterns

```
1. IDENTITY SERVICE
   ┌───────────────────────────────────────────────┐
   │ Handles: age verification, KYC, doc uploads   │
   │ Publishes: identity.user.verified              │
   │            identity.document.rejected          │
   │ Consumes: user.created (from auth_service)     │
   │            guardian.activated                  │
   │ Interacts: risk_engine (check fraud signals)   │
   │            trust_service (update trust score)  │
   │            verification_service (log request)  │
   │            storage_service (store documents)   │
   └───────────────────────────────────────────────┘

2. GUARDIAN SERVICE
   ┌───────────────────────────────────────────────┐
   │ Handles: guardian linking, permissions,        │
   │          consent, transfer                     │
   │ Publishes: guardian.invite.sent                │
   │            guardian.relationship.activated     │
   │            guardian.permissions.changed        │
   │            guardian.consent.revoked            │
   │ Consumes: identity.user.age_confirmed (minor)  │
   │ Interacts: identity_service (verify guardian)  │
   │            trust_service (update trust score)  │
   │            contract_service (approval needed)  │
   │            payment_service (payout approval)   │
   └───────────────────────────────────────────────┘

3. TRUST SERVICE
   ┌───────────────────────────────────────────────┐
   │ Handles: trust score calculation, tier eval,  │
   │          score history, badge auto-award      │
   │ Publishes: trust.score.changed                │
   │            trust.tier.changed                 │
   │            badge.awarded                      │
   │ Consumes: ALL identity.* events               │
   │            ALL risk.* events                  │
   │            contract.executed                  │
   │            dispute.resolved                   │
   │            payment.completed                  │
   │ Interacts: user_badges (award/revoke)         │
   │            moderation_service (risk flags)    │
   │            risk_engine (score input)          │
   └───────────────────────────────────────────────┘

4. VERIFICATION SERVICE
   ┌───────────────────────────────────────────────┐
   │ Handles: company verification, employee verify│
   │          enterprise verification               │
   │ Publishes: company.verified                   │
   │            company.impersonation.flagged      │
   │            employee.verified                  │
   │ Consumes: identity.document.verified          │
   │ Interacts: identity_service (doc review)      │
   │            trust_service (update trust score) │
   │            company_roles (grant permissions)  │
   │            enterprise_claims (track claims)   │
   └───────────────────────────────────────────────┘

5. RISK ENGINE
   ┌───────────────────────────────────────────────┐
   │ Handles: real-time risk scoring, anomaly      │
   │          detection, fraud analysis             │
   │ Publishes: risk.event.detected                │
   │            risk.level.changed                 │
   │ Consumes: ALL events (central monitoring)     │
   │ Interacts: moderation_service (create case)   │
   │            trust_service (update risk score)  │
   │            api_gateway (rate limits, blocks)  │
   │            account_lockout (trigger freeze)   │
   └───────────────────────────────────────────────┘

6. MODERATION SERVICE
   ┌───────────────────────────────────────────────┐
   │ Handles: queue management, AI triage,         │
   │          human review, appeals, escalations   │
   │ Publishes: moderation.action.taken            │
   │            moderation.escalated               │
   │ Consumes: risk.event.detected                 │
   │            verification.request.submitted     │
   │            user.report.created                │
   │ Interacts: all services (enforce actions)     │
   │            moderator_audit_log (log actions)  │
   └───────────────────────────────────────────────┘

7. CONTRACT SERVICE (existing, extended)
   ┌───────────────────────────────────────────────┐
   │ Handles: contract generation, signing,        │
   │          revision tracking                    │
   │ Publishes: contract.created                   │
   │            contract.signed                    │
   │            contract.disputed                  │
   │ Consumes: guardian.permissions.changed        │
   │            company.verified                   │
   │ Interacts: guardian_service (check approval)  │
   │            dispute_service (create dispute)   │
   │            trust_service (update trust score) │
   │            payment_service (escrow)           │
   └───────────────────────────────────────────────┘

8. DISPUTE SERVICE
   ┌───────────────────────────────────────────────┐
   │ Handles: dispute filing, evidence collection, │
   │          mediation, resolution                 │
   │ Publishes: dispute.opened                     │
   │            dispute.resolved                   │
   │            dispute.escalated                  │
   │ Consumes: contract.executed (to set window)   │
   │ Interacts: moderation_service (mediation)     │
   │            contract_service (hold/release)    │
   │            payment_service (escrow release)   │
   │            trust_service (score update)       │
   └───────────────────────────────────────────────┘

9. AUDIT SERVICE
   ┌───────────────────────────────────────────────┐
   │ Handles: structured logging, audit queries,   │
   │          retention policies, export           │
   │ Publishes: (none — passive consumer)          │
   │ Consumes: ALL events (system-wide audit)      │
   │ Interacts: audit_log table (write)            │
   │            data_retention (cleanup)           │
   └───────────────────────────────────────────────┘
```

### 10.3 Event Flow Examples

**New Minor Creator Signup**:
```
1. Client: POST /api/v1/auth/signup (DOB: 2010-05-15)
2. Auth service: Creates user, publishes user.created
3. Identity service: Detects age < 18
   → State: MINOR_PENDING_GUARDIAN
   → Publishes identity.user.minor_detected
4. Guardian service: Initiates guardian linking flow
   → Generates invite token
   → Publishes guardian.invite.sent
5. Client: Guardian receives invite email
6. Guardian: Creates account (or links existing)
   → POST /api/v1/guardian/accept-invite
7. Guardian service: Validates invite, creates relationship
   → State: PENDING_CONSENT
   → Publishes guardian.relationship.pending_consent
8. Guardian: Uploads ID document, signs consent form
   → Identity service verifies guardian document
   → State: CONSENT_DOCUMENTS_VERIFIED
9. Guardian: Configures permissions for minor
   → POST /api/v1/guardian/permissions
10. Guardian service:
    → State: ACTIVE
    → Publishes guardian.relationship.activated
11. Identity service:
    → Minor state: MINOR_ACTIVE
    → Publishes identity.user.age_confirmed
12. Trust service:
    → Updates trust score (+100 for identity verification)
    → Awards badges: Email Verified, Guardian Managed
    → Publishes trust.score.changed
13. Notification service:
    → Emails both minor and guardian with confirmation
14. Audit service:
    → Logs entire flow to audit_log
```

**Company Verification (Nike)**:
```
1. Client: Creates company profile "Nike Inc"
2. Verification service: 
   → Detects name similarity to known brand
   → State: DOMAIN_CLAIMED
3. User: Proves domain nike.com
   → Adds TXT record: valueskins-verify=<token>
4. Verification service: Checks DNS, confirms record
   → State: DNS_VERIFIED
5. User: Uploads business registration
6. Verification service: OCR + database check
   → State: BUSINESS_REGISTRATION_VERIFIED
7. Employee: Verifies as Nike employee
   → Work email: user@nike.com verified
8. Verification service:
   → State: BUSINESS_VERIFIED
   → Publishes company.verified
9. Trust service:
   → Updates company trust score
   → Awards badges: Business Verified
10. Enterprise claims table:
    → Any pending "Nike" claims are resolved
    → Impersonation accounts flagged
```

### 10.4 Authentication Token Claims (Extended)

The existing JWT `Claims` struct must be extended to include trust/verification state:

```rust
pub struct Claims {
    pub sub: String,                    // user_id
    pub role: String,                   // "creator" | "brand"
    pub tier: Option<String>,           // "free" | "basic" | "pro" | "enterprise"
    
    // NEW: Trust & Verification claims
    pub age_state: Option<String>,      // current age_verification_state
    pub trust_tier: Option<String>,     // current trust_tier
    pub risk_level: Option<String>,     // current risk_level
    pub kyc_level: Option<String>,      // current kyc_level
    pub is_guardian: Option<bool>,      // is this user a guardian?
    pub minor_ids: Option<Vec<i64>>,    // linked minor user_ids (if guardian)
    pub guardian_id: Option<i64>,       // assigned guardian (if minor)
    pub company_ids: Option<Vec<i64>>,  // verified company affiliations
    
    pub exp: usize,
    pub iat: usize,
}
```

### 10.5 Things Founders Forget

1. **KYC is not a one-time event.** Documents expire. Users change. Re-verification must be built from day one.

2. **Minors are not just "small adults."** They require entirely separate flows, legal compliance (COPPA/GDPR), guardian management, and dual-signature contracts. Do not hack this in later.

3. **Enterprise verification is a people problem, not a tech problem.** DNS verification is easy. Proving "I work at Google" when you're a contractor, agency, or subsidiary is a human judgment call. Build manual review queues from day one.

4. **False positives kill growth.** If 1% of legitimate users are locked out, that's 10K angry users at 1M MAU. Invest in appeals, support, and clear communication.

5. **Moderator abuse is inevitable.** Build the audit infrastructure BEFORE you hire moderators. Immutable logs, two-person rule, random audits.

6. **Trust cannot be transferred.** Account sales are inevitable. Build detection (behavioral changes, device changes, support patterns) into the risk engine from day one.

7. **Regulatory compliance is not optional.** COPPA fines are per-violation. GDPR fines are 4% of revenue. Build for compliance from day one.

8. **Age verification is hard.** Self-declaration is not enough. Document verification is not enough. Liveness checks can be spoofed. Use multiple layers and accept that some will slip through.

9. **International companies need international verification.** A German GmbH and a Delaware C-Corp have different registration systems. Build a pluggable verification provider system.

10. **The contract system is the product.** If contracts are not legally enforceable, the platform has no moat. Invest in legal review, jurisdiction handling, and signature infrastructure.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-05-15
**Classification**: CONFIDENTIAL
**Next Review**: Quarterly (security audit)
