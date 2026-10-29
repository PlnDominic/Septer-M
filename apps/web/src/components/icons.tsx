import type { SVGProps } from 'react';

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p,
});

export const SearchIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const HeartIcon = ({ filled, ...p }: SVGProps<SVGSVGElement> & { filled?: boolean }) => (
  <svg {...base(p)} fill={filled ? 'currentColor' : 'none'}><path d="M12 20s-7-4.4-9-9.2C1.8 7.6 3.7 5 6.5 5c1.7 0 3.1.9 3.8 2.2h.4C11.4 5.9 12.8 5 14.5 5 17.3 5 19.2 7.6 18 10.8 16 15.6 12 20 12 20Z" transform="translate(1 0)" /></svg>
);
export const UserIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>);
export const BagIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>);
export const MenuIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>);
export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const ArrowIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 16, height: 16, ...p })}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const ChevronIcon = ({ dir = 'right', ...p }: SVGProps<SVGSVGElement> & { dir?: 'left' | 'right' | 'down' }) => (
  <svg {...base({ width: 16, height: 16, ...p })} style={{ transform: `rotate(${dir === 'left' ? 180 : dir === 'down' ? 90 : 0}deg)` }}><path d="m9 6 6 6-6 6" /></svg>
);
export const TruckIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 26, height: 26, ...p })}><path d="M2 6h11v10H2zM13 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>);
export const LockIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 26, height: 26, ...p })}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>);
export const ReturnIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 26, height: 26, ...p })}><path d="M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2" /><path d="M20 4v5h-5M4 20v-5h5" /></svg>);
export const ChatIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 26, height: 26, ...p })}><path d="M4 5h16v11H9l-5 4V5Z" /></svg>);
export const LeafIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ width: 26, height: 26, ...p })}><path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15ZM5 19l8-8" /></svg>);
