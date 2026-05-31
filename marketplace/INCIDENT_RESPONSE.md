# Incident Response & Breach Notification

## 1. Breach Definition
- Unauthorized access to personal data
- Data loss or corruption affecting users
- Ransomware or malware infection
- Credential compromise

## 2. Detection
Monitor for:
- Login failures >10/hour per IP
- Unusual database queries
- File system changes
- Memory/CPU spikes
- Error rate >1%

## 3. Immediate Response (0-1 hour)
1. Confirm breach is real (not false alarm)
2. Page on-call team + CEO
3. Identify scope (which data, which users)
4. Isolate affected systems
5. Preserve evidence (logs, snapshots)
6. Begin forensics

## 4. Investigation (1-24 hours)
- Root cause analysis
- Timeline reconstruction
- Affected user count
- Data types exposed
- Attacker identity/method

## 5. Notification (24-72 hours)
- GDPR: Notify authorities within 72h if high risk
- CCPA: Notify California AG
- Users: Affected users via email
- Public: Press release if >500 users

## 6. Notification Template
```
Subject: Important: Security Incident Affecting Your Account

We discovered unauthorized access to [data type]. 

What happened: [incident description]
What data was affected: [list]
What we did: [response steps]
What you should do: [user actions]

Free credit monitoring: [link]
Questions: privacy@valueskins.com
```

## 7. Recovery
- Patch vulnerability
- Reset compromised credentials
- Enhance monitoring
- Communicate status updates
- Full root cause post-mortem

## 8. Legal & Insurance
- Notify cyber liability insurer
- Report to legal counsel
- Document all steps
- Preserve for litigation

## 9. Post-Incident
- Team meeting (lessons learned)
- Update security procedures
- Implement preventative measures
- Increase monitoring
- Third-party audit

## Timeline Targets
- Detection: <1 hour
- Containment: <4 hours
- Notification: <72 hours
- Resolution: <2 weeks
