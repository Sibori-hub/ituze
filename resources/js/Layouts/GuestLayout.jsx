import BrandLockup from '@/Components/BrandLockup';
import FlashToast from '@/Components/FlashToast';
import InlineAlert from '@/Components/InlineAlert';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import { Link, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/localization';
import RwandaFlag from '@/Components/RwandaFlag';
import { ArrowUpRight, Building2, CircleDollarSign, UsersRound, CheckCircle2, MailCheck, ShieldCheck, UserPlus, KeyRound, Smartphone, Languages } from 'lucide-react';

const REGISTER_STEPS = [
    { Icon: UserPlus, title: 'Create your account', body: 'Tell us who you are and how you will use the platform.' },
    { Icon: MailCheck, title: 'Verify email and phone', body: 'We send a 6-digit code to confirm each one.' },
    { Icon: ShieldCheck, title: 'Get approved', body: 'Our team reviews your profile, then your workspace opens.' },
];

const LOGIN_POINTS = [
    { Icon: KeyRound, title: 'Two-step sign-in', body: 'A one-time code confirms it is really you.' },
    { Icon: Smartphone, title: 'Email or phone', body: 'Sign in with whichever you registered with.' },
    { Icon: Languages, title: 'Your language', body: 'Use the platform in English, Français or Kinyarwanda.' },
];

const REGISTER_HIGHLIGHTS = [
    { Icon: Building2, label: 'Properties and units' },
    { Icon: UsersRound, label: 'Tenants and leases' },
    { Icon: CircleDollarSign, label: 'Rent and payments' },
];

function FlashAlerts({ flash, className = 'mb-5' }) {
    return ['error', 'warning', 'success'].map((type) =>
        flash[type] ? (
            <div key={type} className={className}>
                <InlineAlert message={flash[type]} type={type} />
            </div>
        ) : null,
    );
}

/**
 * Split-screen frame for the sign-up page: a branded story on the left,
 * the form on the right. Below lg the story collapses to a compact header.
 */
function RegisterShell({ flash, children, mode = 'register' }) {
    const { t } = useTranslation();
    const isLogin = mode === 'login';

    return (
        <div className="relative min-h-screen bg-[#F3F6F4] font-[Inter] text-[#17241f] lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <aside className="relative hidden overflow-hidden bg-[#0B3127] text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between lg:gap-8 lg:self-start lg:p-12 xl:p-16">
                {/* Soft light washes and a fine grid give depth without an image. */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                    <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-[#1F7A5A]/40 blur-3xl" />
                    <div className="absolute -bottom-40 right-[-6rem] h-[30rem] w-[30rem] rounded-full bg-[#D9A441]/20 blur-3xl" />
                    <div
                        className="absolute inset-0 opacity-[0.07]"
                        style={{
                            backgroundImage:
                                'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                            backgroundSize: '44px 44px',
                            maskImage: 'radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)',
                            WebkitMaskImage: 'radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)',
                        }}
                    />
                </div>

                <div className="relative flex items-center justify-between gap-4">
                    <Link href="/" className="rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                        <BrandLockup
                            logoClassName="h-14 w-14"
                            nameClassName="text-lg font-extrabold text-white"
                            subtitleClassName="text-[9px] font-medium text-white/65"
                        />
                    </Link>
                </div>

                <div className="relative max-w-md">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F3D58F]">
                        <RwandaFlag className="h-3 w-[18px]" />
                        {t('Built for Rwanda')}
                    </span>
                    <h1 className="mt-6 font-[Sora] text-4xl font-bold leading-[1.1] tracking-[-0.03em] xl:text-[2.75rem]">
                        {isLogin ? t('Welcome back.') : t('Your properties,')}{' '}
                        <span className="bg-gradient-to-r from-[#F3D58F] to-[#D9A441] bg-clip-text text-transparent">
                            {isLogin ? t('Your workspace is ready.') : t('managed beautifully.')}
                        </span>
                    </h1>
                    <p className="mt-5 text-[15px] leading-7 text-white/70">
                        {isLogin
                            ? t('Sign in to manage your properties, tenants, leases and rent in one place.')
                            : t('One secure workspace for listings, tenants, leases and rent, from Kigali to every district.')}
                    </p>

                    <ul className="mt-7 flex flex-wrap gap-2">
                        {REGISTER_HIGHLIGHTS.map(({ Icon, label }) => (
                            <li key={label} className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-white/85 ring-1 ring-inset ring-white/10">
                                <Icon size={14} className="text-[#F3D58F]" aria-hidden="true" />
                                {t(label)}
                            </li>
                        ))}
                    </ul>
                </div>

                {isLogin ? (
                    <ul className="relative space-y-3">
                        {LOGIN_POINTS.map(({ Icon, title, body }) => (
                            <li key={title} className="flex gap-4 rounded-2xl bg-white/[0.05] p-4 ring-1 ring-inset ring-white/10 backdrop-blur-sm">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#F3D58F] to-[#D9A441] text-[#0B3127] shadow-lg shadow-black/20">
                                    <Icon size={18} aria-hidden="true" />
                                </span>
                                <span>
                                    <span className="block text-sm font-semibold text-white">{t(title)}</span>
                                    <span className="mt-0.5 block text-xs leading-5 text-white/60">{t(body)}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                <div className="relative">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{t('How it works')}</p>
                    <ol className="mt-4 space-y-3">
                        {REGISTER_STEPS.map(({ Icon, title, body }, index) => (
                            <li key={title} className="flex gap-4 rounded-2xl bg-white/[0.05] p-4 ring-1 ring-inset ring-white/10 backdrop-blur-sm">
                                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#F3D58F] to-[#D9A441] text-[#0B3127] shadow-lg shadow-black/20">
                                    <Icon size={18} aria-hidden="true" />
                                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#0B3127] text-[10px] font-bold text-[#F3D58F] ring-2 ring-[#0B3127]">
                                        {index + 1}
                                    </span>
                                </span>
                                <span>
                                    <span className="block text-sm font-semibold text-white">{t(title)}</span>
                                    <span className="mt-0.5 block text-xs leading-5 text-white/60">{t(body)}</span>
                                </span>
                            </li>
                        ))}
                    </ol>
                </div>
                )}
            </aside>

            <main className="relative flex min-h-screen min-w-0 flex-col">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-5 sm:px-10 sm:pt-8">
                    <Link href="/" className="min-w-0 rounded-xl lg:invisible">
                        <BrandLockup
                            logoClassName="h-10 w-10 sm:h-11 sm:w-11"
                            nameClassName="text-[13px] font-bold text-[#0E3B2E] sm:text-sm"
                            subtitleClassName="hidden text-[8px] font-medium text-[#0E3B2E]/65 sm:block"
                        />
                    </Link>
                    <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
                        <span className="hidden text-sm text-gray-500 sm:inline">
                            {isLogin ? t("Don't have an account?") : t('Already have an account?')}
                        </span>
                        <Link
                            href={route(isLogin ? 'register' : 'login')}
                            className="rounded-full border border-[#0E3B2E]/15 bg-white px-4 py-2 text-sm font-semibold text-[#0E3B2E] shadow-sm transition hover:border-[#0E3B2E]/30 hover:shadow"
                        >
                            {isLogin ? t('Register') : t('Login')}
                        </Link>
                        <LanguageSwitcher className="rounded-full bg-[#0E3B2E] p-1.5" />
                    </div>
                </div>

                <div className={`flex flex-1 justify-center px-4 pb-12 pt-6 sm:px-10 sm:pt-10 ${isLogin ? 'items-center' : 'items-start'}`}>
                    <div className={`w-full min-w-0 ${isLogin ? 'max-w-[460px]' : 'max-w-[640px]'}`}>
                        <FlashAlerts flash={flash} />
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function GuestLayout({ children }) {
    const isLogin = route().current('login');
    const isRegister = route().current('register');
    const flash = usePage().props.flash || {};
    const { t } = useTranslation();

    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        const order = ['error', 'warning', 'success', 'info', 'status'];
        order.forEach((type, i) => {
            const msg = flash[type];
            if (msg) {
                const toastType = type === 'status' ? 'info' : type;
                const id = `${type}-${Date.now()}-${i}`;
                setToasts(prev => [...prev, { id, type: toastType, message: msg }]);
            }
        });
    }, [flash]);

    const dismissToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <>
            {isLogin ? (
                <RegisterShell flash={flash} mode="login">{children}</RegisterShell>
            ) : isRegister ? (
                <RegisterShell flash={flash}>{children}</RegisterShell>
            ) : (
                <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#EAF2EE] via-[#F1F5F2] to-[#F4F6F5] px-4 pb-10 pt-20 font-[Inter] sm:py-10">
                    <LanguageSwitcher className="absolute right-4 top-4 rounded-lg bg-[#0E3B2E] p-1.5 sm:right-6 sm:top-6" />
                    <Link href="/" className="mb-6 rounded-xl">
                        <BrandLockup
                            logoClassName="h-14 w-14"
                            nameClassName="text-base font-bold text-[#0E3B2E]"
                            subtitleClassName="text-[9px] font-medium text-[#0E3B2E]/70"
                        />
                    </Link>

                    {flash.error && (
                        <div className="mb-5 w-full sm:max-w-xl">
                            <InlineAlert message={flash.error} type="error" />
                        </div>
                    )}
                    {flash.warning && (
                        <div className="mb-5 w-full sm:max-w-xl">
                            <InlineAlert message={flash.warning} type="warning" />
                        </div>
                    )}
                    {flash.success && (
                        <div className="mb-5 w-full sm:max-w-xl">
                            <InlineAlert message={flash.success} type="success" />
                        </div>
                    )}

                    <div className="w-full overflow-hidden rounded-2xl bg-white shadow-xl shadow-[#0E3B2E]/5 ring-1 ring-black/5 transition-shadow sm:max-w-xl">
                        <div className="px-6 pb-7 pt-2 sm:px-10">{children}</div>
                    </div>
                </div>
            )}

            {toasts.length > 0 && (
                <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:left-auto sm:right-4 sm:items-end">
                    {toasts.map(t => (
                        <FlashToast
                            key={t.id}
                            type={t.type}
                            message={t.message}
                            onClose={() => dismissToast(t.id)}
                        />
                    ))}
                </div>
            )}
        </>
    );
}