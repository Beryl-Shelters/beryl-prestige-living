import type { Metadata } from "next";
import { LegalPage } from "../../components/public/legal-page";
import "../landing.css";
import "../legal.css";

export const metadata: Metadata = { title: "Privacy Policy | Beryl Shelter Nigeria Limited" };

export default function PrivacyPolicyPage() {
  return <LegalPage title="Privacy Policy">
    <p>Beryl Shelter Nigeria Limited (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) values your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services.</p>
    <p>By using this website, you consent to the practices described in this policy.</p>
    <section><h2>1. Information We Collect</h2><p>We may collect and store the following types of personal information:</p><ul><li><strong>Personal Identification Information:</strong> Name, email address, phone number, and account details.</li><li><strong>Property Referral Data:</strong> Referrals you make, property codes, commission details.</li><li><strong>Communication Data:</strong> Messages sent or received within the platform.</li><li><strong>Usage Data:</strong> IP address, browser type, device information, and pages visited.</li></ul></section>
    <section><h2>2. How We Use Your Information</h2><p>We use your information to:</p><ul><li>Provide and manage your account.</li><li>Process referrals, commissions, and property sales.</li><li>Send administrative messages and updates.</li><li>Monitor user activity for security and performance.</li><li>Improve our platform and user experience.</li></ul></section>
    <section><h2>3. Sharing Your Information</h2><p>We do not sell your personal information. We may share data with:</p><ul><li><strong>Authorized employees</strong> and staff to perform platform functions.</li><li><strong>Third-party service providers</strong> (e.g., hosting, analytics) under confidentiality agreements.</li><li><strong>Legal authorities,</strong> if required by law or to enforce our Terms of Service.</li></ul></section>
    <section><h2>4. Data Retention</h2><p>We retain your personal data only as long as necessary for the purposes stated above or as required by law. You may request data deletion by contacting us.</p></section>
    <section><h2>5. Security</h2><p>We implement industry-standard security measures to protect your information. However, no online platform is 100% secure. You are responsible for keeping your login credentials confidential.</p></section>
    <section><h2>6. Your Rights</h2><p>Depending on your location, you may have rights to:</p><ul><li>Access, correct, or delete your personal data.</li><li>Object to or restrict certain data processing.</li><li>Withdraw consent at any time (without affecting previous processing).</li></ul><p>To exercise these rights, contact us using the information below.</p></section>
    <section><h2>7. Cookies</h2><p>Our website may use cookies to enhance functionality and user experience. You can manage cookie preferences through your browser settings.</p></section>
    <section><h2>8. Third-Party Links</h2><p>This website may contain links to third-party websites. We are not responsible for the privacy practices of these sites.</p></section>
    <section><h2>9. Changes to This Policy</h2><p>We may update this Privacy Policy from time to time. All changes will be posted on this page with a revised &ldquo;Last Updated&rdquo; date.</p></section>
    <section><h2>10. Contact Us</h2><p>If you have questions or concerns about this Privacy Policy, please contact us at:</p><address><strong>Beryl Shelter Nigeria Limited</strong><br />Email: <a href="mailto:info@berylshelter.com">info@berylshelter.com</a><br />Address: Plot 2, Cornerstone Estate Drive, Ikate-Elegshi, Lekki, Lagos.</address></section>
  </LegalPage>;
}
