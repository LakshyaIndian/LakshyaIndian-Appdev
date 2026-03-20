import React, { useState } from 'react';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { User } from 'firebase/auth';
import { Shield, BarChart3, Zap } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Header */}
      <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-zinc-900 tracking-tight leading-none">StockSensei</h1>
            <div className="flex items-center gap-1 mt-1">
              <Zap className="w-3 h-3 text-emerald-500 fill-emerald-500" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">AI Analysis Engine</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-500">
            <a href="#" className="hover:text-emerald-600 transition-colors">Markets</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">Portfolio</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">Insights</a>
          </nav>
          <div className="h-6 w-px bg-zinc-200 hidden md:block" />
          <Auth onUserChange={setUser} />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {user ? (
          <ErrorBoundary>
            <Dashboard userId={user.uid} />
          </ErrorBoundary>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-4xl w-full grid md:grid-cols-2 gap-12 items-center">
              <div className="text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
                  <Shield className="w-3 h-3" />
                  Enterprise Grade Analysis
                </div>
                <h2 className="text-6xl font-black text-zinc-900 leading-[0.9] mb-6 tracking-tighter">
                  Decode the <span className="text-emerald-600">Market</span> Noise.
                </h2>
                <p className="text-xl text-zinc-500 mb-8 leading-relaxed">
                  Upload earnings transcripts and let our AI debate the future of your investments. 
                  Bull vs. Bear. Real-time insights.
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {[1,2,3,4].map(i => (
                      <img 
                        key={i}
                        src={`https://picsum.photos/seed/user${i}/100/100`} 
                        className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    ))}
                  </div>
                  <div className="text-sm font-medium text-zinc-600">
                    Joined by <span className="text-zinc-900 font-bold">2,400+</span> analysts
                  </div>
                </div>
              </div>
              
              <div className="relative">
                <div className="absolute -inset-4 bg-emerald-500/10 blur-3xl rounded-full" />
                <div className="relative bg-white p-8 rounded-[32px] shadow-2xl border border-zinc-100">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center">
                        <BarChart3 className="w-6 h-6 text-zinc-900" />
                      </div>
                      <div className="font-bold text-zinc-900">Sentiment Dial</div>
                    </div>
                    <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">LIVE</div>
                  </div>
                  <img 
                    src="https://picsum.photos/seed/gauge/400/400" 
                    className="w-full aspect-square object-cover rounded-2xl mb-6 shadow-inner"
                    referrerPolicy="no-referrer"
                  />
                  <div className="space-y-4">
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full w-[75%] bg-emerald-500" />
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      <span>Bearish</span>
                      <span>Bullish</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-zinc-200 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 opacity-50">
            <BarChart3 className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">StockSensei © 2026</span>
          </div>
          <div className="flex gap-8 text-xs font-bold text-zinc-400 uppercase tracking-widest">
            <a href="#" className="hover:text-zinc-900 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-900 transition-colors">Terms</a>
            <a href="#" className="hover:text-zinc-900 transition-colors">API</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
