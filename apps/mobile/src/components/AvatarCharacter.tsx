import { SvgXml } from 'react-native-svg';
import type { AvatarConfig } from '@/lib/avatar';

const PALETTE = {
  rose: { head: '#F4A6BC', accent: '#D96C8E', bg: '#FBE7EE' },
  lilac: { head: '#C9BDF2', accent: '#9C8BE0', bg: '#EFEBFA' },
  peach: { head: '#F9C2A8', accent: '#EE9A7A', bg: '#FFF0E8' },
  mint: { head: '#BFE3D3', accent: '#86C3AA', bg: '#E3EFE9' },
  blush: { head: '#F6C9D6', accent: '#E6A0B5', bg: '#FFF5F7' },
  mauve: { head: '#E3B7D0', accent: '#C58BB0', bg: '#F8EAF2' },
} as const;

const INK = '#2A2230';

function behind(kind: AvatarConfig['accessory'], a: string): string {
  switch (kind) {
    case 'bear':
      return `<circle cx="27" cy="31" r="11" fill="${a}"/><circle cx="73" cy="31" r="11" fill="${a}"/>`;
    case 'cat':
      return `<path d="M24 46 L27 18 L46 32 Z" fill="${a}"/><path d="M76 46 L73 18 L54 32 Z" fill="${a}"/>`;
    case 'bunny':
      return `<ellipse cx="37" cy="22" rx="8" ry="19" fill="${a}"/><ellipse cx="63" cy="22" rx="8" ry="19" fill="${a}"/>`;
    case 'bun':
      return `<circle cx="50" cy="22" r="13" fill="${a}"/>`;
    case 'sprout':
      return `<path d="M50 30 C50 18 40 12 32 14 C34 24 40 30 50 30 Z" fill="${a}"/><path d="M50 30 C50 18 60 12 68 14 C66 24 60 30 50 30 Z" fill="${a}"/>`;
    default:
      return '';
  }
}

function inFront(kind: AvatarConfig['accessory'], a: string): string {
  if (kind === 'bow') return `<path d="M50 30 L36 22 L36 38 Z M50 30 L64 22 L64 38 Z" fill="${a}"/><circle cx="50" cy="30" r="4.5" fill="${a}"/>`;
  return '';
}

export function avatarSvg({ palette, accessory }: AvatarConfig): string {
  const p = PALETTE[palette];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<circle cx="50" cy="50" r="50" fill="${p.bg}"/>
${behind(accessory, p.accent)}
<circle cx="50" cy="58" r="30" fill="${p.head}"/>
${inFront(accessory, p.accent)}
<ellipse cx="40" cy="58" rx="3" ry="3.6" fill="${INK}"/><ellipse cx="60" cy="58" rx="3" ry="3.6" fill="${INK}"/>
<ellipse cx="33" cy="67" rx="5" ry="3.2" fill="${p.accent}" opacity=".55"/><ellipse cx="67" cy="67" rx="5" ry="3.2" fill="${p.accent}" opacity=".55"/>
<path d="M44 68 Q50 74 56 68" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
</svg>`;
}

/** The visitor's round character. Decorative: the control around it carries the label. */
export function AvatarCharacter({ avatar, size = 44 }: { avatar: AvatarConfig; size?: number }) {
  return <SvgXml xml={avatarSvg(avatar)} width={size} height={size} />;
}
