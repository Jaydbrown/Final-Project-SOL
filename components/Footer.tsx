
import React from 'react';
import { ExternalLink, FileText, Github, Home, Shield } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="navy-bg text-white pt-16 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="bg-emerald-600 p-1.5 rounded-lg">
                <Home className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight">LocalDAO</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Local communities can create neighborhood investment groups, vote with stablecoins, and share project returns transparently on-chain.
            </p>
            <div className="flex gap-3">
              <a
                href="https://github.com/Kenny-svg/LocalDAO"
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                aria-label="GitHub"
              >
                <Github className="w-5 h-5 text-slate-300" />
              </a>
              <a
                href="/whitepaper.html"
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                aria-label="Whitepaper"
              >
                <FileText className="w-5 h-5 text-slate-300" />
              </a>
              <a
                href="https://testnet.snowtrace.io/address/0x6b6c0eE71c703C51707A86f3bef0B4ACD9F4AB78"
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                aria-label="Factory contract"
              >
                <Shield className="w-5 h-5 text-slate-300" />
              </a>
            </div>
          </div>

          <div>
            <h5 className="font-bold text-white mb-6">Resources</h5>
            <ul className="space-y-4">
              <li>
                <a href="/whitepaper.html" target="_blank" rel="noreferrer" className="text-slate-400 text-sm hover:text-white transition-colors inline-flex items-center gap-1">
                  Whitepaper <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a href="https://github.com/Kenny-svg/LocalDAO" target="_blank" rel="noreferrer" className="text-slate-400 text-sm hover:text-white transition-colors inline-flex items-center gap-1">
                  GitHub Repository <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a href="https://testnet.snowtrace.io/address/0x6b6c0eE71c703C51707A86f3bef0B4ACD9F4AB78" target="_blank" rel="noreferrer" className="text-slate-400 text-sm hover:text-white transition-colors inline-flex items-center gap-1">
                  Factory Contract <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a href="https://testnet.routescan.io/address/0x6b6c0eE71c703C51707A86f3bef0B4ACD9F4AB78" target="_blank" rel="noreferrer" className="text-slate-400 text-sm hover:text-white transition-colors inline-flex items-center gap-1">
                  Backup Explorer <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h5 className="font-bold text-white mb-6">What This Solves</h5>
            <ul className="space-y-4">
              <li className="text-slate-400 text-sm">Transparent community treasury and voting.</li>
              <li className="text-slate-400 text-sm">Role-based controls for operations and safety.</li>
              <li className="text-slate-400 text-sm">Stablecoin funding and yield distribution on-chain.</li>
              <li className="text-slate-400 text-sm">Per-DAO communication channels for coordination.</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-slate-500 text-xs">
            © {new Date().getFullYear()} LocalDAO.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
