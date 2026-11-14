import PublicPageLayout from './PublicPageLayout'

export default function StatusPage() {
  return (
    <PublicPageLayout title="System Status">
      <section className="mb-8">
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 mb-6">
          <h2 className="text-lg font-semibold text-emerald-800">All Systems Operational</h2>
          <p className="text-sm text-emerald-700 mt-1">Last checked: Just now</p>
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Services</h2>
        <ul className="space-y-3">
          <li className="flex justify-between items-center border-b border-slate-100 pb-2">
            <span className="text-slate-700">Web Application</span>
            <span className="text-emerald-600 text-sm font-medium">Operational</span>
          </li>
          <li className="flex justify-between items-center border-b border-slate-100 pb-2">
            <span className="text-slate-700">Database (Supabase)</span>
            <span className="text-emerald-600 text-sm font-medium">Operational</span>
          </li>
          <li className="flex justify-between items-center border-b border-slate-100 pb-2">
            <span className="text-slate-700">Kiosk Scanning</span>
            <span className="text-emerald-600 text-sm font-medium">Operational</span>
          </li>
          <li className="flex justify-between items-center pb-2">
            <span className="text-slate-700">Payment Processing (Paystack)</span>
            <span className="text-emerald-600 text-sm font-medium">Operational</span>
          </li>
        </ul>
      </section>
    </PublicPageLayout>
  )
}