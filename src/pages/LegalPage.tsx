import { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar.tsx';
import { Footer } from '../components/Footer.tsx';
import { apiRequest } from '../lib/api.ts';
import type { PublicSiteData } from '../types.ts';

interface LegalPageProps {
  type: 'privacy' | 'terms';
}

export function LegalPage({ type }: LegalPageProps) {
  const [data, setData] = useState<PublicSiteData | null>(null);

  useEffect(() => {
    apiRequest<PublicSiteData>('/api/public/site-data').then(setData).catch(() => {});
  }, []);

  const title = type === 'privacy' ? 'Privacy Policy' : 'Terms and Conditions';
  const body =
    type === 'privacy' ? data?.settings.privacyPolicyText : data?.settings.termsText;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F6F0]">
      <Navbar />
      <main className="flex-1 py-14 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto bg-white border border-[#E2DFD5] rounded-xl p-6 sm:p-10">
          <p className="text-xs font-semibold tracking-wider text-[#BA9245] uppercase">
            Central Library Krishna Nagar
          </p>
          <h1 className="mt-2 font-serif text-3xl font-bold text-[#101D35]">{title}</h1>
          <div className="mt-6 pt-6 border-t border-[#E2DFD5] text-base text-[#374151] leading-relaxed whitespace-pre-line">
            {body || 'Loading policy document...'}
          </div>
        </div>
      </main>
      <Footer settings={data?.settings} />
    </div>
  );
}
