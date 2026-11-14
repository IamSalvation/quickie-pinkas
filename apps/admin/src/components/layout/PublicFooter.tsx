import { Link } from 'react-router-dom'

export default function PublicFooter() {
  return (
    <footer className="relative z-10 w-full mt-auto py-6 backdrop-blur-sm bg-slate-900/50 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Links */}
        <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-slate-300">
          
          {/* Group 1: Product/Help */}
          <div className="flex items-center gap-x-4">
            <Link to="/help" className="hover:text-emerald-400 transition-colors">Help Center</Link>
            <span className="text-slate-600">Â·</span>
            <Link to="/api-docs" className="hover:text-emerald-400 transition-colors">API Docs</Link>
            <span className="text-slate-600">Â·</span>
            <Link to="/status" className="hover:text-emerald-400 transition-colors">System Status</Link>
          </div>

          <span className="text-slate-600 hidden sm:inline">|</span>

          {/* Group 2: Legal */}
          <div className="flex items-center gap-x-4">
            <Link to="/terms" className="hover:text-emerald-400 transition-colors">Terms of Service</Link>
            <span className="text-slate-600">Â·</span>
            <Link to="/privacy" className="hover:text-emerald-400 transition-colors">Privacy Policy</Link>
            <span className="text-slate-600">Â·</span>
            <Link to="/cookies" className="hover:text-emerald-400 transition-colors">Cookie Policy</Link>
          </div>

          <span className="text-slate-600 hidden sm:inline">|</span>

          {/* Group 3: Company */}
          <div className="flex items-center gap-x-4">
            <Link to="/about" className="hover:text-emerald-400 transition-colors">About Us</Link>
            <span className="text-slate-600">Â·</span>
            <a href="mailto:support@quickie-studio.com" className="hover:text-emerald-400 transition-colors">Contact Support</a>
          </div>
        </div>

        {/* Copyright Line */}
        <div className="mt-4 text-center text-[10px] sm:text-xs text-slate-400">
          &copy; {new Date().getFullYear()} Quickie Pinkas Â· Quickie Studio. All rights reserved.
        </div>
      </div>
    </footer>
  )
}