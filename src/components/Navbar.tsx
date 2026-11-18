import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { BrandLogo } from './BrandLogo.tsx';
import { useAuth } from '../context/AuthContext.tsx';

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Track the active section from the URL hash
  const [activeHash, setActiveHash] = useState(() => window.location.hash.replace('#', ''));

  useEffect(() => {
    const onHashChange = () => setActiveHash(window.location.hash.replace('#', ''));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleSectionLink = (sectionId: string) => {
    setMobileOpen(false);
    if (location.pathname !== '/') {
      navigate(`/#${sectionId}`);
      return;
    }
    // Update the hash so LandingPage picks up the active section
    window.location.hash = sectionId;
    // Dispatch a hashchange-like event so React state updates
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    // Scroll to top of the content area
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navItems = [
    { label: 'About', id: 'about' },
    { label: 'Facilities', id: 'facilities' },
    { label: 'Gallery', id: 'gallery' },
    { label: 'Membership', id: 'membership' },
    { label: 'Rules', id: 'rules' },
    { label: 'Contact', id: 'contact' },
  ];

  const portalHref = user ? (user.role === 'admin' ? '/admin' : '/dashboard') : '/register';
  const portalLabel = user ? (user.role === 'admin' ? 'Admin Panel' : 'Member Portal') : 'Join Now';

  return (
    <header className="sticky top-0 z-40 bg-[#F8F6F0]/95 backdrop-blur-md border-b border-[#E2DFD5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <Link
          to="/"
          onClick={() => {
            setMobileOpen(false);
            // Clear hash to show full homepage
            if (window.location.hash) {
              window.location.hash = '';
              window.dispatchEvent(new HashChangeEvent('hashchange'));
            }
          }}
          className="focus-visible:outline-2 focus-visible:outline-[#101D35] rounded"
        >
          <BrandLogo variant="navbar" />
        </Link>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#4A5362]">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSectionLink(item.id)}
              className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 border-b-2 ${
                activeHash === item.id
                  ? 'text-[#101D35] border-[#D4AD62] font-semibold'
                  : 'border-transparent hover:text-[#101D35] hover:border-[#D4AD62]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Primary Action & Mobile Menu Toggle */}
        <div className="flex items-center gap-4 shrink-0">
          {!user && (
            <Link
              to="/login"
              className="hidden sm:inline-block text-sm font-medium text-[#101D35] hover:text-[#BA9245] transition-colors whitespace-nowrap shrink-0"
            >
              Member Login
            </Link>
          )}
          <Link
            to={portalHref}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-lg bg-[#101D35] text-[#F8F6F0] hover:bg-[#172943] transition-colors whitespace-nowrap shrink-0"
          >
            {portalLabel}
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-[#D6D2C7] text-[#101D35] hover:bg-white transition-colors"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[#E2DFD5] bg-[#FDFCF9] px-4 py-4 space-y-1">
          <Link
            to="/"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-3 text-base font-medium text-[#101D35] rounded-lg hover:bg-[#F8F6F0]"
          >
            Home
          </Link>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSectionLink(item.id)}
              className="w-full text-left px-3 py-3 text-base font-medium text-[#101D35] rounded-lg hover:bg-[#F8F6F0]"
            >
              {item.label}
            </button>
          ))}
          <div className="pt-3 mt-2 border-t border-[#E2DFD5] flex flex-col gap-2">
            {!user && (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="w-full text-center px-4 py-3 text-sm font-semibold rounded-lg border border-[#101D35] text-[#101D35]"
              >
                Member Login
              </Link>
            )}
            <Link
              to={portalHref}
              onClick={() => setMobileOpen(false)}
              className="w-full text-center px-4 py-3 text-sm font-semibold rounded-lg bg-[#101D35] text-[#F8F6F0]"
            >
              {portalLabel}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
