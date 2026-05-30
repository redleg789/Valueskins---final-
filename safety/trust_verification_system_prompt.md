You are a senior staff engineer, trust-and-safety architect, identity systems expert, legal product designer, and platform security lead.

Design a **production-grade Trust + Verification system** for a platform called **ValueSkins**.

Context:

ValueSkins is a creator/business platform intended to partially replace agencies and fragmented DMs by acting as an identity layer, collaboration layer, and opportunity marketplace.

Creators create profiles ("ValueSkins") that can be discovered by brands, businesses, collaborators, and communities.

Brands and creators can negotiate collaborations, sponsorships, partnerships, projects, and contracts directly inside the platform.

The platform must support:

* Individual creators
* Under-18 creators
* Adults
* Freelancers
* Small businesses
* Large enterprises (Google-level companies)
* Agencies
* Teams
* Public figures
* Employees representing companies

Design a **100/100 production-ready architecture** with zero shortcuts.

Do not give generic startup MVP ideas.

Act as if this system is serving millions of users and billions in transaction value.

Cover security, abuse prevention, legal concerns, edge cases, fraud, UX, architecture, state management, and operational realities.

Structure the response into sections.

---

# SECTION 1: AGE SYSTEM

Answer:

Should users under 18 be allowed?

Design a complete architecture.

Requirements:

### Adult users (18+)

Allow:

* self-managed contracts
* payments
* sponsorships
* direct negotiations
* independent account ownership

### Under-18 users

Design:

* parent/guardian linking
* parental consent flows
* KYC requirements
* approval workflows
* guardian dashboard
* contract approval
* payout approval
* permission delegation
* account ownership structure
* transfer process after turning 18

Questions:

Who legally owns the account?

Who signs agreements?

What happens if creator turns 18?

What happens if parent relationship changes?

How do disputes work?

How do revocations work?

How are withdrawals handled?

What if a child lies?

What if age is forged?

What if documents are fake?

What if someone changes age after account creation?

What happens during account recovery?

What if guardian account is hacked?

---

Design:

State machine.

Do NOT use multiple booleans.

Use explicit states.

Example:

PENDING_AGE_VERIFICATION

MINOR_PENDING_GUARDIAN

MINOR_ACTIVE

ADULT_ACTIVE

LOCKED

UNDER_REVIEW

etc.

Explain transitions.

---

# SECTION 2: ENTERPRISE VERIFICATION

Problem:

Anyone can type:

"We are Google"

and create fake trust.

Design a production-grade company verification system.

Do not stop at email verification.

Design multiple trust layers.

Cover:

### Company identity verification

Examples:

domain ownership verification

TXT records

DNS verification

website ownership

email verification

business registration checks

tax IDs

manual review

government registration

regional differences

international support

---

### Enterprise trust score

Design:

tier system:

Unverified

Verified

Business Verified

Enterprise Verified

Government Verified

Strategic Partner

etc.

Explain requirements for each.

---

### Prevent impersonation

Examples:

fake Google

fake Nike

fake OpenAI

fake subsidiaries

fake regional offices

fake agencies pretending to represent companies

employees pretending authority

cover all edge cases.

---

Design:

employee verification flow

Questions:

How does a Google employee prove they work at Google?

What if they use personal email?

What if contractor?

What if agency?

What if recruiter?

What permissions should different employees receive?

---

Create role hierarchy:

OWNER

ADMIN

LEGAL

HIRING

PARTNERSHIP

EMPLOYEE

CONTRACTOR

etc.

Include permission matrix.

---

# SECTION 3: SECURITY

Design like a bank.

Threat model:

Account takeover

Fake enterprises

Bot farms

Mass fake creator accounts

KYC fraud

Synthetic identities

Payment fraud

Collusion

Spam

Sybil attacks

Stolen documents

Fake screenshots

AI-generated documents

Fake guardians

Identity laundering

Badge selling

Purchased verified accounts

Bribed moderators

Insider abuse

Mass account creation

Deepfakes

Fake social proof

---

For each:

attack

risk

mitigation

detection

response

---

# SECTION 4: TRUST SYSTEM

Design a trust engine.

Not a simple blue tick.

Include:

identity trust

behavior trust

payment trust

history trust

collaboration trust

reputation trust

dispute trust

network trust

Explain weighted scoring.

Questions:

Can trust decrease?

Can trust expire?

Can trust transfer?

Can purchased accounts retain trust?

---

# SECTION 5: BADGE SYSTEM

Design:

visual badges

risk labels

warning states

temporary restrictions

under-review labels

probation labels

high-risk labels

new-account labels

Explain abuse scenarios.

---

# SECTION 6: CONTRACTS

ValueSkins replaces fragmented DMs and partially replaces agencies.

Design:

contract system architecture.

Questions:

Who can create contracts?

Who signs?

How are minors handled?

How do guardians approve?

How do companies approve?

How are revisions handled?

How are disputes handled?

What happens if someone edits after signing?

How are versions stored?

Audit trails?

Revocation?

Jurisdiction?

International use?

---

# SECTION 7: DATABASE DESIGN

Design production database entities:

Users

Guardians

Companies

VerificationRequests

Roles

Permissions

TrustScores

Contracts

AuditLogs

EnterpriseClaims

IdentityDocuments

Disputes

RiskEvents

VerificationStates

KYCStatus

etc.

Include:

fields

relationships

IDs

indexes

constraints

---

No boolean soup.

Use enums/state machines.

Explicitly explain why.

---

# SECTION 8: MODERATION

Design human + AI moderation.

Cover:

review queues

escalations

enterprise escalation

appeals

fraud investigations

account freezes

evidence systems

internal tooling

moderator abuse prevention

---

# SECTION 9: OPERATIONAL REALITY

Cover:

false positives

false negatives

support load

manual review bottlenecks

regional laws

GDPR

COPPA

India

US

EU

creator disputes

scaling from 1k users → 100M users

---

# SECTION 10: FINAL ARCHITECTURE

End with:

Complete architecture diagram in text form:

Client

API Gateway

Identity Service

Guardian Service

Trust Service

Verification Service

Contract Service

Risk Engine

Moderation Service

Audit Service

Storage

Event Bus

etc.

Show service interactions.

---

Rules:

* Think like Stripe + LinkedIn + banking KYC + enterprise SaaS + trust-and-safety teams.
* No startup shortcuts.
* No vague statements.
* Every feature should include attack scenarios and edge cases.
* No boolean state messes.
* Prefer state machines.
* Include implementation details.
* Include hidden failure modes.
* Include "things founders forget."
* Assume hostile users.
* Assume users actively try to break the system.
* Be extremely detailed.
