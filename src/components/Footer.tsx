import { Link } from 'react-router-dom';
import { MapPin, Clock, Phone, Mail, Linkedin, Globe } from 'lucide-react';
import { BrandLogo } from './BrandLogo.tsx';
import type { LibrarySettings } from '../types.ts';

interface FooterProps {
  settings?: LibrarySettings | null;
}

export function Footer({ settings }: FooterProps) {
  const address =
    settings?.address ||
    '1 A, Gopal Nagar, Krishna Nagar, Alambagh, Lucknow, Uttar Pradesh – 226023, India';
  const hours = settings?.operatingHours || '7:00 AM – 10:00 PM';
  const mapsUrl =
    settings?.googleMapsUrl ||
    'https://maps.google.com/?q=1+A,+Gopal+Nagar,+Krishna+Nagar,+Alambagh,+Lucknow,+Uttar+Pradesh+226023';

  const socials = settings?.socialLinks;
  const activeSocials = [
    { label: 'Instagram', url: socials?.instagram },
    { label: 'Facebook', url: socials?.facebook },
    { label: 'YouTube', url: socials?.youtube },
    { label: 'WhatsApp', url: socials?.whatsapp },
  ].filter((s) => Boolean(s.url && s.url.trim()));

  return (
    <footer className="bg-[#101D35] text-[#F8F6F0] border-t border-[#172943]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand & Introduction */}
          <div className="space-y-4">
            <BrandLogo variant="stacked" light />
            <p className="text-sm text-[#C7CEDB] leading-relaxed">
              A peaceful, disciplined, and student-focused study library in Krishna Nagar,
              Alambagh, Lucknow dedicated to serious learning and daily academic consistency.
            </p>
          </div>

          {/* Quick Navigation */}
          <div>
            <h3 className="font-serif text-base font-semibold text-[#D4AD62] mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2.5 text-sm text-[#C7CEDB]">
              <li>
                <a href="/#about" className="hover:text-white transition-colors">
                  About Us
                </a>
              </li>
              <li>
                <a href="/#facilities" className="hover:text-white transition-colors">
                  Facilities &amp; Amenities
                </a>
              </li>
              <li>
                <a href="/#gallery" className="hover:text-white transition-colors">
                  Study Environment Gallery
                </a>
              </li>
              <li>
                <a href="/#rules" className="hover:text-white transition-colors">
                  Library Rules
                </a>
              </li>
              <li>
                <a href="/#contact" className="hover:text-white transition-colors">
                  Contact &amp; Location
                </a>
              </li>
            </ul>
          </div>

          {/* Membership & Portal */}
          <div>
            <h3 className="font-serif text-base font-semibold text-[#D4AD62] mb-4">
              Membership &amp; Access
            </h3>
            <ul className="space-y-2.5 text-sm text-[#C7CEDB]">
              <li>
                <a href="/#membership" className="hover:text-white transition-colors">
                  Membership Plans
                </a>
              </li>
              <li>
                <Link to="/register" className="hover:text-white transition-colors">
                  New Member Registration
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white transition-colors">
                  Member Login
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-white transition-colors">
                  Member Dashboard
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-white transition-colors">
                  Administration Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Address & Hours */}
          <div className="space-y-3 text-sm text-[#C7CEDB]">
            <h3 className="font-serif text-base font-semibold text-[#D4AD62] mb-4">
              Visit the Library
            </h3>
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-[#D4AD62] shrink-0 mt-1" />
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors leading-relaxed"
              >
                {address}
              </a>
            </div>
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-[#D4AD62] shrink-0" />
              <span>Daily: {hours}</span>
            </div>
            {settings?.phone && (
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[#D4AD62] shrink-0" />
                <a href={`tel:${settings.phone}`} className="hover:text-white transition-colors tabular-nums">
                  {settings.phone}
                </a>
              </div>
            )}
            {settings?.email && (
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#D4AD62] shrink-0" />
                <a href={`mailto:${settings.email}`} className="hover:text-white transition-colors">
                  {settings.email}
                </a>
              </div>
            )}

            {activeSocials.length > 0 && (
              <div className="pt-2 flex flex-wrap gap-4 text-xs font-medium text-[#D4AD62]">
                {activeSocials.map((s) => (
                  <a
                    key={s.label}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[#1E3354] grid grid-cols-1 lg:grid-cols-3 items-center gap-4 text-xs text-[#A3AEC2]">
          {/* Left: Developer Links */}
          <div className="flex items-center justify-center lg:justify-start gap-3 order-2 lg:order-1">
            <a
              href="https://www.linkedin.com/in/ritesh-pandey2024/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[#D4AD62] hover:text-[#DFBC79] hover:underline transition-colors font-medium whitespace-nowrap"
            >
              <Linkedin className="w-3.5 h-3.5 shrink-0" />
              <span>Developer LinkedIn</span>
            </a>
            <span className="text-[#3B4D68]" aria-hidden="true">·</span>
            <a
              href="https://my-portfolio-mhmq.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[#D4AD62] hover:text-[#DFBC79] hover:underline transition-colors font-medium whitespace-nowrap"
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>Developer Portfolio</span>
            </a>
          </div>

          {/* Center: Copyright Notice */}
          <p className="text-center order-1 lg:order-2 whitespace-nowrap">
            &copy; Central Library Krishna Nagar. All Rights Reserved.
          </p>

          {/* Right: Privacy Policy & Terms and Conditions */}
          <div className="flex items-center justify-center lg:justify-end gap-6 order-3 whitespace-nowrap">
            <Link to="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-white transition-colors">
              Terms and Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
