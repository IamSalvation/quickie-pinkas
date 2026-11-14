import PublicPageLayout from './PublicPageLayout'

export default function CookiesPage() {
  return (
    <PublicPageLayout title="Cookie Policy">
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">1. What Are Cookies</h2>
        <p className="text-slate-600 mb-4">
          Cookies are small text files stored on your device when you visit a website. They help us provide a better experience by remembering your preferences and keeping you logged in.
        </p>
      </section>
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">2. How We Use Cookies</h2>
        <p className="text-slate-600 mb-4">
          We use strictly necessary cookies to authenticate you and keep your session active. We do not use tracking or advertising cookies.
        </p>
      </section>
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">3. Managing Cookies</h2>
        <p className="text-slate-600 mb-4">
          You can control and delete cookies through your browser settings. However, disabling cookies may affect your ability to log in and use the platform.
        </p>
      </section>
    </PublicPageLayout>
  )
}