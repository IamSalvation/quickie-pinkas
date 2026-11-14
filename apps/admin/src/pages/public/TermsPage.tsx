import PublicPageLayout from './PublicPageLayout'

export default function TermsPage() {
  return (
    <PublicPageLayout title="Terms of Service">
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">1. Acceptance of Terms</h2>
        <p className="text-slate-600 mb-4">
          By accessing or using Quickie Pinkas, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">2. Description of Service</h2>
        <p className="text-slate-600 mb-4">
          Quickie Pinkas provides session-based attendance tracking for schools, universities, and events. The service includes QR badge generation, kiosk scanning, online check-in, face verification, and reporting.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">3. Account Responsibilities</h2>
        <p className="text-slate-600 mb-4">
          You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">4. Billing and Subscriptions</h2>
        <p className="text-slate-600 mb-4">
          Subscriptions are billed monthly via Paystack. You may cancel at any time, and your access will remain active until the end of your current billing period. All fees are non-refundable except where required by law.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">5. Data Privacy</h2>
        <p className="text-slate-600 mb-4">
          Your use of the service is also governed by our Privacy Policy. We take data protection seriously and comply with applicable data protection laws.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">6. Limitation of Liability</h2>
        <p className="text-slate-600 mb-4">
          Quickie Pinkas is provided "as is" without warranty of any kind. We shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.
        </p>
      </section>
    </PublicPageLayout>
  )
}