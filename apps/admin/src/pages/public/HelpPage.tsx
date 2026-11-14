import PublicPageLayout from './PublicPageLayout'

export default function HelpPage() {
  return (
    <PublicPageLayout title="Help Center">
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Getting Started</h2>
        <p className="text-slate-600 mb-4">
          Welcome to Quickie Pinkas! To get started, create an account, add your participants (students/guests), set up your programs (courses/tracks), and create a session. You can then open the session and start scanning QR badges.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-slate-900">How do I print QR badges?</h3>
            <p className="text-slate-600">Go to Participants, select the ones you want, and click "Print Badges". The badges are designed for two-sided printing.</p>
          </div>
          <div>
            <h3 className="font-medium text-slate-900">Can I use this offline?</h3>
            <p className="text-slate-600">Currently, the Kiosk requires an internet connection. If the internet goes down, you can use the Manual Override feature to add attendees retroactively.</p>
          </div>
          <div>
            <h3 className="font-medium text-slate-900">How do I upgrade my plan?</h3>
            <p className="text-slate-600">Go to Billing and select a plan. Payments are processed securely via Paystack.</p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Still need help?</h2>
        <p className="text-slate-600 mb-4">
          Contact our support team at <a href="mailto:support@quickie-studio.com" className="text-emerald-600 hover:underline">support@quickie-studio.com</a>.
        </p>
      </section>
    </PublicPageLayout>
  )
}