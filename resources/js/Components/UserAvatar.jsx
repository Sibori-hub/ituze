import { useEffect, useState } from 'react';

const SIZES = {
    xs: 'h-7 w-7 text-[11px]',
    sm: 'h-9 w-9 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-16 w-16 text-lg',
    xl: 'h-20 w-20 text-2xl',
};

export const photoUrl = (path) => {
    if (!path) return null;
    return /^https?:\/\//i.test(path) ? path : `/storage/${path}`;
};

export const initialsFor = (user) => {
    const first = user?.first_name || user?.name?.split(' ')[0] || '';
    const last = user?.last_name || user?.name?.split(' ').slice(1).join(' ') || '';
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?';
};

/**
 * The user's profile photo, falling back to their initials when there is no
 * photo or it fails to load.
 */
export default function UserAvatar({ user, size = 'md', className = '' }) {
    const src = photoUrl(user?.profile_photo);
    const [failed, setFailed] = useState(false);

    useEffect(() => setFailed(false), [src]);

    return (
        <span
            className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#D9A441] to-[#F3D58F] font-[Sora] font-bold text-[#0E3B2E] dark:text-emerald-300 ${SIZES[size] ?? SIZES.md} ${className}`}
        >
            {src && !failed ? (
                <img
                    src={src}
                    alt={user?.name ?? ''}
                    onError={() => setFailed(true)}
                    className="h-full w-full object-cover"
                    loading="lazy"
                />
            ) : (
                <span aria-hidden="true">{initialsFor(user)}</span>
            )}
        </span>
    );
}
