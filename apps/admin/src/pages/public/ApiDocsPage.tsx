import PublicPageLayout from './PublicPageLayout'

export default function ApiDocsPage() {
  return (
    <PublicPageLayout title="API Documentation">
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Introduction</h2>
        <p className="text-slate-600 mb-4">
          The Quickie Pinkas API allows you to programmatically manage participants, sessions, and attendance records. All API endpoints require authentication using your account's API key.
        </p>
      </section>
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Authentication</h2>
        <p className="text-slate-600 mb-4">
          Include your API key in the Authorization header: <code className="bg-slate-100 px-1 py-0.5 rounded text-sm">Authorization: Bearer YOUR_API_KEY</code>
        </p>
      </section>
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Base URL</h2>
        <p className="text-slate-600 mb-4">
          All API requests should be made to: <code className="bg-slate-100 px-1 py-0.5 rounded text-sm">https://pinkas.quickie-studio.com/api/v1</code>
        </p>
      </section>
    </PublicPageLayout>
  )
}