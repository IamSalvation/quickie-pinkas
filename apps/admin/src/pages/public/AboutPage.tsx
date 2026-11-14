import PublicPageLayout from './PublicPageLayout'

export default function AboutPage() {
  return (
    <PublicPageLayout title="About Quickie Pinkas">
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Our Mission</h2>
        <p className="text-slate-600 mb-4">
          Quickie Pinkas was built to solve a simple but frustrating problem: tracking attendance in schools, universities, and events without the headache of paper sheets, messy spreadsheets, or forcing people to download apps.
        </p>
      </section>
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">What We Do</h2>
        <p className="text-slate-600 mb-4">
          We provide a modern, QR-based attendance system that works with physical kiosks and online check-in links. With features like recurring sessions, face verification, and comprehensive reporting, we help institutions focus on what matters most: education and connection.
        </p>
      </section>
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Built by Quickie Studio</h2>
        <p className="text-slate-600 mb-4">
          Pinkas is a product of Quickie Studio, the same team behind Quickie ClockIt (workforce attendance and payroll). We are dedicated to building tools that make organizations run smoother.
        </p>
      </section>
    </PublicPageLayout>
  )
}