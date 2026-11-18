import logoImg from '../assets/images/Logo.png';

interface BrandLogoProps {
  variant?: 'navbar' | 'stacked';
  light?: boolean;
}

export function BrandLogo({ variant = 'navbar', light = false }: BrandLogoProps) {
  const primaryColor = light ? 'text-[#F8F6F0]' : 'text-[#101D35]';
  const subColor = light ? 'text-[#D4AD62]' : 'text-[#737B89]';

  if (variant === 'navbar') {
    return (
      <span className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 ${primaryColor}`}>
        <img
          src={logoImg}
          alt="Central Library Krishna Nagar Logo"
          className="h-10 w-auto shrink-0 object-contain"
        />
        <span className="font-serif text-base sm:text-lg font-semibold tracking-tight whitespace-nowrap shrink-0">
          Central Library Krishna Nagar
        </span>
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-3 shrink-0">
      <img
        src={logoImg}
        alt="Central Library Krishna Nagar Logo"
        className="h-10 w-auto shrink-0 object-contain"
      />
      <div className="flex flex-col leading-tight">
        <span className={`font-serif text-base font-bold tracking-wider ${primaryColor}`}>
          CENTRAL LIBRARY
        </span>
        <span className={`text-[11px] font-semibold tracking-[0.22em] ${subColor}`}>
          KRISHNA NAGAR
        </span>
      </div>
    </div>
  );
}


// 569d8f27-4def-4d7c-99ab-bfdbe21c0540 enquiry
// b32b0db4-73ce-4946-8a83-6596757bb52f register