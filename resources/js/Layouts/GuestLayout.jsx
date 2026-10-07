import BrandLockup from '@/Components/BrandLockup';
import FlashToast from '@/Components/FlashToast';
import InlineAlert from '@/Components/InlineAlert';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import { Link, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/localization';
import { ArrowUpRight, Building2, CircleDollarSign, UsersRound } from 'lucide-react';

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
                <div className="relative flex min-h-screen items-center justify-center bg-[#f2f5f2] px-0 pb-0 pt-16 font-sans text-[#17241f] sm:px-5 sm:py-16">
                    <main className="grid min-h-[min(760px,calc(100vh-8rem))] w-full max-w-6xl overflow-hidden bg-white shadow-[0_28px_90px_-36px_rgba(14,59,46,0.28)] sm:rounded-[28px] lg:grid-cols-[1.02fr_0.98fr]">
                        <section className="relative isolate flex min-h-[250px] flex-col overflow-hidden bg-[#0e3b2e] px-6 py-7 text-white sm:min-h-[310px] sm:px-10 sm:py-9 lg:min-h-full lg:px-12 lg:py-11" aria-label="ITUZE GREEN PLATFORM">
                            <div className="pointer-events-none absolute -right-24 -top-28 -z-10 h-80 w-80 rounded-full border border-white/10" />
                            <div className="pointer-events-none absolute -right-12 -top-16 -z-10 h-56 w-56 rounded-full border border-white/10" />
                            <div className="pointer-events-none absolute -bottom-28 -left-20 -z-10 h-72 w-72 rounded-full bg-[#d9a441]/10 blur-3xl" />

                            <Link href="/" className="w-fit rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e7c77d]">
                                <BrandLockup
                                    logoClassName="h-14 w-14"
                                    nameClassName="text-base font-bold text-white"
                                    subtitleClassName="text-[9px] font-medium text-white/70"
                                />
                            </Link>

                            <div className="relative z-10 mt-8 max-w-lg sm:mt-10 lg:mt-16">
                                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e7c77d]">
                                    {t('Property management, made clearer')}
                                </p>
                                <h1 className="mt-3 font-[Sora] text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
                                    {t('Your properties,')}
                                    <span className="block text-[#e7c77d]">{t('better organized.')}</span>
                                </h1>
                                <p className="mt-4 hidden max-w-sm text-sm leading-6 text-white/70 sm:block">
                                    {t('Keep the details that keep your rentals running together in one clear place.')}
                                </p>
                            </div>

                            <div className="relative z-10 mt-8 hidden max-w-md rounded-2xl border border-white/10 bg-white/[0.08] p-5 shadow-2xl shadow-black/10 backdrop-blur-sm sm:block lg:mt-auto lg:translate-y-2">
                                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                                            {t('Your workspace')}
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-white">
                                            {t('Everything in its place')}
                                        </p>
                                    </div>
                                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d9a441]/15 text-[#e7c77d]">
                                        <ArrowUpRight size={18} aria-hidden="true" />
                                    </span>
                                </div>
                                <div className="mt-4 grid grid-cols-3 gap-2">
                                    {[
                                        { label: t('Properties'), Icon: Building2 },
                                        { label: t('Tenants'), Icon: UsersRound },
                                        { label: t('Payments'), Icon: CircleDollarSign },
                                    ].map(({ label, Icon }) => (
                                        <div key={label} className="flex items-center gap-2 rounded-xl bg-black/10 px-3 py-3">
                                            <Icon size={16} className="shrink-0 text-[#e7c77d]" aria-hidden="true" />
                                            <span className="text-xs font-medium text-white/80">{label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <p className="relative z-10 mt-6 hidden text-xs text-white/40 lg:block">
                                {t('A simpler way to stay in control.')}
                            </p>
                        </section>

                        <section className="flex items-center justify-center px-6 py-9 sm:px-12 sm:py-12 lg:px-14">
                            <div className="w-full max-w-md">
                                {flash.error && (
                                    <div className="mb-5">
                                        <InlineAlert message={flash.error} type="error" />
                                    </div>
                                )}
                                {flash.warning && (
                                    <div className="mb-5">
                                        <InlineAlert message={flash.warning} type="warning" />
                                    </div>
                                )}
                                {flash.success && (
                                    <div className="mb-5">
                                        <InlineAlert message={flash.success} type="success" />
                                    </div>
                                )}
                                {children}
                            </div>
                        </section>
                    </main>
                </div>
            ) : (
                <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#EAF2EE] via-[#F1F5F2] to-[#F4F6F5] px-4 py-10 font-[Inter]">
                    {!isRegister && <LanguageSwitcher className="absolute right-4 top-4 rounded-lg bg-[#0E3B2E] p-1.5 sm:right-6 sm:top-6" />}
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
                        {isRegister && (
                            <div className="grid grid-cols-2 gap-2 p-3">
                                <Link
                                    href={route('login')}
                                    className="rounded-lg bg-gray-100 py-2.5 text-center text-sm font-semibold text-gray-500 transition-all hover:bg-gray-200"
                                >
                                    {t('Login')}
                                </Link>
                                <Link
                                    href={route('register')}
                                    className="rounded-lg bg-[#0E3B2E] py-2.5 text-center text-sm font-semibold text-white shadow-sm transition-all"
                                >
                                    {t('Register')}
                                </Link>
                            </div>
                        )}

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