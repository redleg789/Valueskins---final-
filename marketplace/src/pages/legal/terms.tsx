'use client';
import Link from 'next/link';
import { C } from '@/theme/colors';

export default function TermsOfService() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '32px', display: 'inline-block' }}>
          ← Back to Home
        </Link>

        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>Terms of Service</h1>
        <p style={{ color: C.textSecondary, fontSize: '14px', marginBottom: '32px' }}>Last updated: May 2026</p>

        <div style={{ lineHeight: '1.8', fontSize: '14px', color: C.text }}>
          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>1. Acceptance of Terms</h2>
            <p>
              By accessing and using ValueSkins, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>2. Use License</h2>
            <p>
              Permission is granted to temporarily download one copy of the materials (information or software) on ValueSkins for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul style={{ marginLeft: '20px' }}>
              <li>Modifying or copying the materials</li>
              <li>Using the materials for any commercial purpose or for any public display</li>
              <li>Attempting to reverse engineer, decompile, or disassemble any software contained on ValueSkins</li>
              <li>Removing any copyright or other proprietary notations from the materials</li>
              <li>Transferring the materials to another person or "mirroring" the materials on any other server</li>
              <li>Harassing, abusing, or threatening other users</li>
              <li>Posting false, misleading, or defamatory content</li>
              <li>Violating applicable laws or regulations</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>3. Disclaimer</h2>
            <p>
              The materials on ValueSkins are provided on an 'as is' basis. ValueSkins makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>4. Limitations</h2>
            <p>
              In no event shall ValueSkins or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on ValueSkins, even if ValueSkins or an authorized representative has been notified orally or in writing of the possibility of such damage.
            </p>
            <p style={{ marginTop: '12px' }}>
              Our total liability is limited to the amount you paid in the last 12 months, or $100, whichever is less.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>5. Accuracy of Materials</h2>
            <p>
              The materials appearing on ValueSkins could include technical, typographical, or photographic errors. ValueSkins does not warrant that any of the materials on its website are accurate, complete, or current. ValueSkins may make changes to the materials contained on its website at any time without notice.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>6. Intellectual Property Rights</h2>
            <p>
              All materials on ValueSkins, including text, images, code, and design, are the property of ValueSkins or its content suppliers and are protected by international copyright laws. User-generated content (profiles, messages, photos) remains your property, but you grant ValueSkins a license to use, display, and promote your content on the platform.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>7. Links</h2>
            <p>
              ValueSkins has not reviewed all of the sites linked to its website and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by ValueSkins of the site. Use of any such linked website is at the user's own risk.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>8. Modifications</h2>
            <p>
              ValueSkins may revise these terms of service for our website at any time without notice. By using this website, you are agreeing to be bound by the then current version of these terms of service.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>9. Governing Law</h2>
            <p>
              These terms and conditions are governed by and construed in accordance with the laws of the jurisdiction where ValueSkins is incorporated, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>10. User Responsibilities</h2>
            <p>You agree to:</p>
            <ul style={{ marginLeft: '20px' }}>
              <li>Provide accurate and complete information</li>
              <li>Maintain the confidentiality of your account credentials</li>
              <li>Not impersonate others or misrepresent your identity</li>
              <li>Not engage in illegal or fraudulent activity</li>
              <li>Not post content that violates intellectual property rights</li>
              <li>Comply with all applicable laws and regulations</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>11. Dispute Resolution</h2>
            <p>
              Any disputes arising from these terms shall be resolved through binding arbitration, not class action. Each party bears its own attorney fees and costs.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>12. Contact</h2>
            <p>
              If you have questions about these terms, please contact us at legal@valueskins.com.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
