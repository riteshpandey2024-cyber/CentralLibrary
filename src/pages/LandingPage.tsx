import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Armchair,
  BookOpen,
  Check,
  Clock,
  Droplets,
  ExternalLink,
  Lightbulb,
  Mail,
  MapPin,
  Megaphone,
  Phone,
  Plug,
  ShieldCheck,
  Sparkles,
  VolumeX,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Navbar } from '../components/Navbar.tsx';
import { Footer } from '../components/Footer.tsx';
import { ResilientImage } from '../components/ResilientImage.tsx';
import ContactForm from '../components/ContactForm.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type { GalleryImage, PublicSiteData } from '../types.ts';

import p1Img from '../assets/images/P1.jpg';
import p2Img from '../assets/images/P2.jpg';
import p3Img from '../assets/images/P3.jpg';
import p4Img from '../assets/images/P4.webp';
import p5Img from '../assets/images/P5.jpg';
import p6Img from '../assets/images/P6.jpg';
import p7Img from '../assets/images/P7.jpg';
import p8Img from '../assets/images/P8.jpg';
import p9Img from '../assets/images/P9.jpg';
import p10Img from '../assets/images/P10.jpg';

const ASSET_IMAGE_MAP: Record<string, string> = {
  '/src/assets/images/P1.jpg': p1Img,
  '/src/assets/images/P2.jpg': p2Img,
  '/src/assets/images/P3.jpg': p3Img,
  '/src/assets/images/P4.webp': p4Img,
  '/src/assets/images/P5.jpg': p5Img,
  '/src/assets/images/P6.jpg': p6Img,
  '/src/assets/images/P7.jpg': p7Img,
  '/src/assets/images/P8.jpg': p8Img,
  '/src/assets/images/P9.jpg': p9Img,
  '/src/assets/images/P10.jpg': p10Img,
};

const DEFAULT_GALLERY_IMAGES: GalleryImage[] = [
  {
    id: 'gal_p1',
    title: 'P1 - Study Cabin & Desks',
    caption: 'Quiet study desks with dedicated task lighting and privacy partitions.',
    category: 'Study Desks',
    imageUrl: p1Img,
    displayOrder: 1,
    isVisible: true,
  },
  {
    id: 'gal_p2',
    title: 'P2 - Main Reading Space',
    caption: 'Organized reading hall with comfortable seating and quiet atmosphere.',
    category: 'Reading Hall',
    imageUrl: p2Img,
    displayOrder: 2,
    isVisible: true,
  },
  {
    id: 'gal_p3',
    title: 'P3 - Quiet Focus Zone',
    caption: 'Focused learning space free from distractions for competitive prep.',
    category: 'Focus Zone',
    imageUrl: p3Img,
    displayOrder: 3,
    isVisible: true,
  },
  {
    id: 'gal_p4',
    title: 'P4 - Personal Workstations',
    caption: 'Dedicated individual study desks with power access and clean surfaces.',
    category: 'Study Desks',
    imageUrl: p4Img,
    displayOrder: 4,
    isVisible: true,
  },
  {
    id: 'gal_p5',
    title: 'P5 - Reading Hall Corridor',
    caption: 'Calm study aisle designed for long uninterrupted study sessions.',
    category: 'Reading Hall',
    imageUrl: p5Img,
    displayOrder: 5,
    isVisible: true,
  },
  {
    id: 'gal_p6',
    title: 'P6 - Individual Study Pods',
    caption: 'Ergonomically designed private seating for deep concentration.',
    category: 'Focus Zone',
    imageUrl: p6Img,
    displayOrder: 6,
    isVisible: true,
  },
  {
    id: 'gal_p7',
    title: 'P7 - Clean Study Aisles',
    caption: 'Neat study lanes with comfortable seating and balanced illumination.',
    category: 'Study Desks',
    imageUrl: p7Img,
    displayOrder: 7,
    isVisible: true,
  },
  {
    id: 'gal_p8',
    title: 'P8 - Ergonomic Seating',
    caption: 'Supportive chairs and well-proportioned tables for study comfort.',
    category: 'Reading Hall',
    imageUrl: p8Img,
    displayOrder: 8,
    isVisible: true,
  },
  {
    id: 'gal_p9',
    title: 'P9 - Silent Preparation Zone',
    caption: 'Strictly quiet hall supporting daily consistent preparation routines.',
    category: 'Focus Zone',
    imageUrl: p9Img,
    displayOrder: 9,
    isVisible: true,
  },
  {
    id: 'gal_p10',
    title: 'P10 - Modern Study Facility',
    caption: 'Well-maintained library premises equipped for modern academic needs.',
    category: 'Reading Hall',
    imageUrl: p10Img,
    displayOrder: 10,
    isVisible: true,
  },
];

const HERO_IMAGE = p2Img;
const ABOUT_IMAGE = p9Img;

function FacilityIcon({ name }: { name: string }) {
  const props = { className: 'w-5 h-5 text-[#101D35]' };
  switch (name) {
    case 'Armchair':
      return <Armchair {...props} />;
    case 'VolumeX':
      return <VolumeX {...props} />;
    case 'Lightbulb':
      return <Lightbulb {...props} />;
    case 'Plug':
      return <Plug {...props} />;
    case 'Droplets':
      return <Droplets {...props} />;
    case 'Sparkles':
      return <Sparkles {...props} />;
    case 'ShieldCheck':
      return <ShieldCheck {...props} />;
    default:
      return <BookOpen {...props} />;
  }
}

export function LandingPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [siteData, setSiteData] = useState<PublicSiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [galleryCategory, setGalleryCategory] = useState('All');
  const [lightboxImage, setLightboxImage] = useState<GalleryImage | null>(null);

  // ── Active section management ──
  // Valid section IDs that the navbar can target
  const validSections = useMemo(
    () => ['about', 'facilities', 'gallery', 'membership', 'rules', 'contact'],
    []
  );

  const getHashSection = useCallback(() => {
    const hash = window.location.hash.replace('#', '');
    return validSections.includes(hash) ? hash : null;
  }, [validSections]);

  const [activeSection, setActiveSection] = useState<string | null>(getHashSection);

  // Listen for hash changes (navbar clicks)
  useEffect(() => {
    const onHashChange = () => {
      setActiveSection(getHashSection());
    };
    window.addEventListener('hashchange', onHashChange);
    // Also check on mount (in case user navigated directly with a hash)
    setActiveSection(getHashSection());
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [getHashSection]);

  useEffect(() => {
    apiRequest<PublicSiteData>('/api/public/site-data')
      .then((data) => setSiteData(data))
      .catch(() => showToast('Unable to load library information.', 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  // Always display all 10 real library photos (P1 to P10)
  const galleryList = DEFAULT_GALLERY_IMAGES;

  const galleryCategories = useMemo(() => {
    const cats = Array.from(new Set(galleryList.map((g) => g.category)));
    return ['All', ...cats];
  }, []);

  const filteredGallery = useMemo(() => {
    if (galleryCategory === 'All') return galleryList;
    return galleryList.filter((g) => g.category === galleryCategory);
  }, [galleryCategory]);

  const settings = siteData?.settings;
  const operatingHours = settings?.operatingHours || '7:00 AM – 10:00 PM';
  const address =
    settings?.address ||
    '1 A, Gopal Nagar, Krishna Nagar, Alambagh, Lucknow, Uttar Pradesh – 226023, India';
  const mapsUrl =
    settings?.googleMapsUrl ||
    'https://maps.google.com/?q=1+A,+Gopal+Nagar,+Krishna+Nagar,+Alambagh,+Lucknow,+Uttar+Pradesh+226023';

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F6F0] text-[#101D35]">
      <Navbar />

      <main className="flex-1">
        {/* HERO SECTION – always visible when no section is active (homepage) */}
        {!activeSection && (
          <>
            {/* HERO SECTION */}
            <section className="relative bg-[#101D35] text-[#F8F6F0] overflow-hidden">
              <div className="absolute inset-0">
                <ResilientImage
                  src={HERO_IMAGE}
                  alt="Central Library Krishna Nagar study hall with walnut desks and brass lamps"
                  className="w-full h-full object-cover object-center opacity-40"
                  fallbackTitle="Central Library Krishna Nagar"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#101D35] via-[#101D35]/88 to-[#101D35]/55" />
              </div>

              <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45 }}
                  className="max-w-3xl"
                >
                  <p className="text-xs sm:text-sm font-medium text-[#D4AD62] tracking-wide mb-4">
                    Central Library Krishna Nagar <span aria-hidden="true">·</span> Krishna Nagar, Lucknow{' '}
                    <span aria-hidden="true">·</span> Open daily {operatingHours}
                  </p>

                  <h1
                    className="font-serif font-bold text-[#F8F6F0] leading-[1.12] tracking-tight"
                    style={{ fontSize: 'clamp(2.25rem, 4.5vw, 3.75rem)', textWrap: 'balance' }}
                  >
                    {settings?.tagline || 'A Better Space. A Better Focus. A Better Future.'}
                  </h1>

                  <p className="mt-6 text-base sm:text-lg text-[#D8DFEB] leading-relaxed max-w-2xl">
                    Discover a peaceful and disciplined study environment designed for students,
                    competitive examination aspirants, and independent learners. Make every study
                    session count at Central Library Krishna Nagar.
                  </p>

                  <div className="mt-9 flex flex-wrap items-center gap-4">
                    <a
                      href="#membership"
                      className="inline-flex items-center justify-center px-6 py-3.5 rounded-lg bg-[#D4AD62] text-[#101D35] font-semibold text-sm sm:text-base hover:bg-[#DFBC79] transition-colors whitespace-nowrap shrink-0"
                    >
                      Explore Membership
                    </a>
                    <Link
                      to={user ? (user.role === 'admin' ? '/admin' : '/dashboard') : '/login'}
                      className="inline-flex items-center justify-center px-6 py-3.5 rounded-lg border border-[#F8F6F0]/35 text-[#F8F6F0] font-medium text-sm sm:text-base hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
                    >
                      {user ? 'Go to Portal' : 'Member Login'}
                    </Link>
                  </div>
                </motion.div>
              </div>
            </section>

            {/* KEY HIGHLIGHTS STRIP */}
            <section className="bg-white border-b border-[#E2DFD5]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  <div>
                    <h2 className="font-serif text-lg font-semibold text-[#101D35]">
                      Peaceful Study Environment
                    </h2>
                    <p className="mt-1.5 text-sm text-[#586272] leading-relaxed">
                      Quiet reading halls structured to protect long stretches of uninterrupted focus.
                    </p>
                  </div>
                  <div>
                    <h2 className="font-serif text-lg font-semibold text-[#101D35]">
                      Student-Focused Space
                    </h2>
                    <p className="mt-1.5 text-sm text-[#586272] leading-relaxed">
                      Tailored for competitive exam aspirants, college learners, and self-paced scholars.
                    </p>
                  </div>
                  <div>
                    <h2 className="font-serif text-lg font-semibold text-[#101D35]">
                      Disciplined Study Culture
                    </h2>
                    <p className="mt-1.5 text-sm text-[#586272] leading-relaxed">
                      Shared respect, clear etiquette, and orderly seating across every study session.
                    </p>
                  </div>
                  <div>
                    <h2 className="font-serif text-lg font-semibold text-[#101D35]">
                      Convenient Daily Hours
                    </h2>
                    <p className="mt-1.5 text-sm text-[#586272] leading-relaxed">
                      Open daily from <span className="font-medium text-[#101D35]">{operatingHours}</span>{' '}
                      to fit morning and evening routines.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* PUBLISHED ANNOUNCEMENTS BANNER (ONLY IF ADMIN PUBLISHED) */}
            {siteData && siteData.announcements.length > 0 && (
              <section className="bg-[#EAF1F8] border-b border-[#D5E1EE]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3">
                      <Megaphone className="w-4 h-4 text-[#101D35] shrink-0 mt-0.5 sm:mt-0" />
                      <div className="text-sm text-[#101D35]">
                        <span className="font-semibold">
                          {siteData.announcements[0].title}:
                        </span>{' '}
                        <span className="text-[#2D3B50]">{siteData.announcements[0].content}</span>
                      </div>
                    </div>
                    <span className="text-xs text-[#586272] tabular-nums shrink-0">
                      {new Date(siteData.announcements[0].publishedAt).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* END OF HOMEPAGE-ONLY CONTENT */}
          </>
        )}

        {/* ABOUT SECTION – shown only when activeSection is 'about' or no section is active */}
        {(activeSection === 'about' || !activeSection) && (
          <section id="about" className="py-16 sm:py-24 bg-[#F8F6F0]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-stretch">
                <div className="lg:col-span-6">
                  <div className="h-full min-h-[300px] rounded-xl overflow-hidden border border-[#E2DFD5] bg-white">
                    <ResilientImage
                      src={ABOUT_IMAGE}
                      alt="Quiet academic reading room at Central Library Krishna Nagar"
                      className="w-full h-full object-cover"
                      fallbackTitle="Reading Hall Atmosphere"
                    />
                  </div>
                </div>
                <div className="lg:col-span-6 flex flex-col justify-center py-2">
                  <p className="text-xs font-semibold tracking-wider text-[#BA9245] uppercase">
                    About the Library
                  </p>
                  <h2
                    className="mt-2 font-serif text-3xl sm:text-4xl font-bold text-[#101D35] leading-tight"
                    style={{ textWrap: 'balance' }}
                  >
                    {settings?.aboutHeading || 'A Space Designed for Serious Learning'}
                  </h2>
                  <p className="mt-5 text-base text-[#374151] leading-relaxed">
                    {settings?.aboutBody ||
                      'Central Library Krishna Nagar provides a dedicated environment for students and independent learners who value concentration, consistency, and academic growth. Our aim is to make focused learning more comfortable, organized, and accessible.'}
                  </p>
                  {settings?.aboutSecondaryBody && (
                    <p className="mt-4 text-base text-[#586272] leading-relaxed">
                      {settings.aboutSecondaryBody}
                    </p>
                  )}
                  <div className="mt-8 pt-6 border-t border-[#E2DFD5] grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                    <div>
                      <h3 className="font-semibold text-[#101D35]">Focused Atmosphere</h3>
                      <p className="mt-1 text-[#586272]">
                        Free from household interruptions, built around steady daily study habits.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#101D35]">Student Convenience</h3>
                      <p className="mt-1 text-[#586272]">
                        Accessible Krishna Nagar location with transparent rules and organized seating.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* FACILITIES & AMENITIES – shown only when activeSection is 'facilities' or no section is active */}
        {(activeSection === 'facilities' || !activeSection) && (
          <section id="facilities" className="py-16 sm:py-24 bg-white border-y border-[#E2DFD5]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold tracking-wider text-[#BA9245] uppercase">
                  Facilities &amp; Amenities
                </p>
                <h2 className="mt-2 font-serif text-3xl sm:text-4xl font-bold text-[#101D35]">
                  Essential Comforts for Long Study Hours
                </h2>
                <p className="mt-3 text-base text-[#586272]">
                  Available amenities confirmed and maintained by the Central Library Krishna Nagar
                  administration.
                </p>
              </div>

              {loading ? (
                <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-44 rounded-xl bg-[#F8F6F0] animate-pulse" />
                  ))}
                </div>
              ) : siteData && siteData.facilities.length > 0 ? (
                <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {siteData.facilities.map((facility) => (
                    <div
                      key={facility.id}
                      className="p-6 rounded-xl border border-[#E2DFD5] bg-[#FDFCF9] hover:border-[#D4AD62] transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#EAF1F8] flex items-center justify-center mb-4">
                        <FacilityIcon name={facility.iconName} />
                      </div>
                      <h3 className="font-serif text-lg font-semibold text-[#101D35]">
                        {facility.title}
                      </h3>
                      <p className="mt-2 text-sm text-[#586272] leading-relaxed">
                        {facility.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-8 text-sm text-[#586272]">
                  Confirmed facilities will appear here once published by administration.
                </p>
              )}
            </div>
          </section>
        )}

        {/* STUDY ENVIRONMENT GALLERY – shown when activeSection is 'gallery' or on homepage */}
        {(activeSection === 'gallery' || !activeSection) && (
          <section id="gallery" className="py-16 sm:py-24 bg-[#F8F6F0]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold tracking-wider text-[#BA9245] uppercase">
                    Study Environment Gallery
                  </p>
                  <h2 className="mt-2 font-serif text-3xl sm:text-4xl font-bold text-[#101D35]">
                    Inside Our Study Spaces (P1 to P10)
                  </h2>
                  <p className="mt-2 text-sm text-[#586272]">
                    Explore all 10 dedicated reading and focus spaces across our premises.
                  </p>
                </div>

                {galleryCategories.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 p-1 bg-white border border-[#E2DFD5] rounded-lg">
                    {galleryCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setGalleryCategory(cat)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          galleryCategory === cat
                            ? 'bg-[#101D35] text-[#F8F6F0]'
                            : 'text-[#586272] hover:text-[#101D35]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Perfectly aligned 5-column grid for 10 images (P1 to P10) */}
              <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
              {filteredGallery.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLightboxImage(item)}
                  className="group text-left rounded-xl overflow-hidden border border-[#E2DFD5] bg-white hover:border-[#D4AD62] hover:shadow-md transition-all duration-300 flex flex-col cursor-pointer"
                >
                  <div className="relative w-full aspect-[4/3] overflow-hidden bg-[#101D35]/5">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#101D35]/90 backdrop-blur-xs text-[11px] font-bold text-[#D4AD62] tracking-wider shadow-sm">
                      P{idx + 1}
                    </div>
                  </div>
                  <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-serif text-sm font-semibold text-[#101D35] truncate group-hover:text-[#BA9245] transition-colors">
                          {item.title}
                        </h3>
                        {item.caption && (
                          <p className="mt-1 text-xs text-[#586272] line-clamp-2 leading-relaxed">
                            {item.caption}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* MEMBERSHIP SECTION – shown only when activeSection is 'membership' or no section is active */}
        {(activeSection === 'membership' || !activeSection) && (
          <section id="membership" className="py-16 sm:py-24 bg-[#101D35] text-[#F8F6F0]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold tracking-wider text-[#D4AD62] uppercase">
                  Membership Plans
                </p>
                <h2
                  className="mt-2 font-serif text-3xl sm:text-4xl font-bold text-[#F8F6F0]"
                  style={{ textWrap: 'balance' }}
                >
                  Choose a Membership That Fits Your Study Routine
                </h2>
                <p className="mt-3 text-base text-[#C7CEDB]">
                  Select a study duration below to apply for membership or request current fee details
                  from the library administration.
                </p>
              </div>

              <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {(siteData?.plans || []).map((plan) => (
                  <div
                    key={plan.id}
                    className="flex flex-col justify-between p-6 rounded-xl bg-[#172943] border border-[#253D61] hover:border-[#D4AD62] transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-[#D4AD62] font-medium">
                        <span>{plan.durationLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{plan.isAvailable ? 'Accepting Applications' : 'Currently Closed'}</span>
                      </div>
                      <h3 className="mt-2 font-serif text-xl font-bold text-white">{plan.name}</h3>
                      <div className="mt-4 pb-4 border-b border-[#253D61]">
                        {plan.priceInr !== null && plan.priceInr > 0 ? (
                          <div className="flex items-baseline gap-1">
                            <span className="font-serif text-3xl font-bold text-[#D4AD62] tabular-nums">
                              &#8377;{plan.priceInr.toLocaleString('en-IN')}
                            </span>
                            <span className="text-xs text-[#C7CEDB]">/ {plan.durationLabel}</span>
                          </div>
                        ) : (
                          <p className="text-sm font-medium text-[#D4AD62]">
                            Fee configured by Administrator · Enquire at Desk
                          </p>
                        )}
                      </div>

                      <p className="mt-4 text-sm text-[#C7CEDB] leading-relaxed">
                        {plan.description}
                      </p>

                      {plan.facilitiesIncluded.length > 0 && (
                        <ul className="mt-5 space-y-2.5 text-sm text-[#E5E9F0]">
                          {plan.facilitiesIncluded.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Check className="w-4 h-4 text-[#D4AD62] shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="mt-8 pt-4 border-t border-[#253D61]">
                      {plan.termsAndConditions && (
                        <p className="text-xs text-[#A3AEC2] mb-4 leading-relaxed">
                          {plan.termsAndConditions}
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={!plan.isAvailable}
                        onClick={() =>
                          navigate(user ? '/dashboard?tab=membership' : `/register?plan=${plan.id}`)
                        }
                        className="w-full py-2.5 px-4 rounded-lg bg-[#D4AD62] text-[#101D35] font-semibold text-sm hover:bg-[#DFBC79] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        {plan.isAvailable ? 'Get Membership' : 'Unavailable'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* LIBRARY RULES – shown only when activeSection is 'rules' or no section is active */}
        {(activeSection === 'rules' || !activeSection) && (
          <section id="rules" className="py-16 sm:py-24 bg-white border-b border-[#E2DFD5]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold tracking-wider text-[#BA9245] uppercase">
                  Code of Conduct
                </p>
                <h2 className="mt-2 font-serif text-3xl sm:text-4xl font-bold text-[#101D35]">
                  Library Rules &amp; Study Etiquette
                </h2>
                <p className="mt-3 text-base text-[#586272]">
                  Every member upholds a quiet, respectful environment so everyone can study without
                  distraction.
                </p>
              </div>

              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(siteData?.rules || []).map((rule, index) => (
                  <div
                    key={rule.id}
                    className="p-6 rounded-xl border border-[#E2DFD5] bg-[#FDFCF9]"
                  >
                    <div className="flex items-center justify-between text-xs text-[#737B89] mb-2">
                      <span className="font-mono font-semibold text-[#BA9245] tabular-nums">
                        {String(index + 1).padStart(2, '0')}.
                      </span>
                      <span>{rule.category}</span>
                    </div>
                    <h3 className="font-serif text-lg font-semibold text-[#101D35]">
                      {rule.title}
                    </h3>
                    <p className="mt-2 text-sm text-[#586272] leading-relaxed">
                      {rule.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CONTACT & LOCATION – shown only when activeSection is 'contact' or no section is active */}
        {(activeSection === 'contact' || !activeSection) && (
          <section id="contact" className="py-16 sm:py-24 bg-[#F8F6F0]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                {/* Location & Details */}
                <div className="lg:col-span-5 space-y-6">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-[#BA9245] uppercase">
                      Contact &amp; Location
                    </p>
                    <h2 className="mt-2 font-serif text-3xl sm:text-4xl font-bold text-[#101D35]">
                      {settings?.libraryName || 'Central Library Krishna Nagar'}
                    </h2>
                  </div>

                  <div className="space-y-4 text-sm text-[#374151]">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-[#101D35] shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-[#101D35]">Library Address</p>
                        <p className="mt-0.5 text-[#586272] leading-relaxed">{address}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-[#101D35] shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-[#101D35]">Operating Hours</p>
                        <p className="mt-0.5 text-[#586272]">{operatingHours} (Open Daily)</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-[#101D35] shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-[#101D35]">Phone</p>
                        <p className="mt-0.5 text-[#586272] tabular-nums">
                          {settings?.phone ? (
                            <a href={`tel:${settings.phone}`} className="hover:underline">
                              {settings.phone}
                            </a>
                          ) : (
                            'Contact number configurable in Admin Settings — use the enquiry form.'
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Mail className="w-5 h-5 text-[#101D35] shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-[#101D35]">Email</p>
                        <p className="mt-0.5 text-[#586272]">
                          {settings?.email ? (
                            <a href={`mailto:${settings.email}`} className="hover:underline">
                              {settings.email}
                            </a>
                          ) : (
                            'Email configurable in Admin Settings — send an enquiry anytime.'
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#101D35] text-[#F8F6F0] text-sm font-semibold hover:bg-[#172943] transition-colors"
                    >
                      Get Directions on Google Maps
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  <div className="rounded-xl overflow-hidden border border-[#E2DFD5] bg-white h-56">
                    <iframe
                      title="Central Library Krishna Nagar Map"
                      src="https://maps.google.com/maps?q=1+A,+Gopal+Nagar,+Krishna+Nagar,+Alambagh,+Lucknow,+Uttar+Pradesh+226023&output=embed"
                      className="w-full h-full border-0"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                </div>

                {/* Enquiry Form */}
                <div className="lg:col-span-7">
                  <ContactForm />
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Gallery Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#101D35]/85 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="bg-white rounded-xl max-w-4xl w-full overflow-hidden border border-[#E2DFD5]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E2DFD5]">
              <div>
                <p className="text-xs text-[#737B89]">{lightboxImage.category}</p>
                <h3 className="font-serif text-lg font-semibold text-[#101D35]">
                  {lightboxImage.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1.5 rounded-lg text-[#737B89] hover:text-[#101D35] hover:bg-[#F8F6F0]"
                aria-label="Close image preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-[#101D35] max-h-[70vh] overflow-hidden flex items-center justify-center">
              <img
                src={lightboxImage.imageUrl}
                alt={lightboxImage.title}
                className="w-full max-h-[70vh] object-contain"
              />
            </div>
            {lightboxImage.caption && (
              <p className="px-5 py-3.5 text-sm text-[#4A5362]">{lightboxImage.caption}</p>
            )}
          </div>
        </div>
      )}

      <Footer settings={settings} />
    </div>
  );
}
