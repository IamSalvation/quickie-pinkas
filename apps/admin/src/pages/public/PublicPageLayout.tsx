import { Link } from 'react-router-dom'
import PublicFooter from '../../components/layout/PublicFooter'

interface Props {
  title: string
  children: React.ReactNode
}

export default function PublicPageLayout({ title, children }: Props) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/">
            <img src="/logo.png" alt="Quickie Pinkas" className="h-8 w-auto" />
          </Link>
          <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline">
            &larr; Back to Login
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">{title}</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: November 2026</p>
        
        <div className="prose prose-slate max-w-none">
          {children}
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}