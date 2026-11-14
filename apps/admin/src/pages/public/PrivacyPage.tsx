import PublicPageLayout from './PublicPageLayout'

export default function PrivacyPage() {
  return (
    <PublicPageLayout title="Privacy Policy">
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">1. Information We Collect</h2>
        <p className="text-slate-600 mb-4">
          We collect information you provide directly to us, such as your name, email address, and institution details when you create an account. We also collect attendance data, including check-in timestamps, methods, and optional selfies for face verification.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">2. How We Use Your Information</h2>
        <p className="text-slate-600 mb-4">
          We use the information we collect to provide, maintain, and improve our services, process transactions, send administrative messages, and ensure the security of our platform.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">3. Data Sharing</h2>
        <p className="text-slate-600 mb-4">
          We do not sell your personal information. We may share data with trusted third-party service providers (such as Supabase for database hosting and Paystack for payment processing) who assist us in operating the platform.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">4. Data Retention</h2>
        <p className="text-slate-600 mb-4">
          We retain your data for as long as your account is active or as needed to provide you services. Attendance records are retained for reporting and compliance purposes. You may request deletion of your data at any time.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">5. Your Rights</h2>
        <p className="text-slate-600 mb-4">
          You have the right to access, correct, or delete your personal information. To exercise these rights, please contact us at support@quickie-studio.com.
        </p>
      </section>
    </PublicPageLayout>
  )
}