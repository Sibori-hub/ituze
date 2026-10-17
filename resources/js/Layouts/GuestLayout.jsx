import BrandLockup from '@/Components/BrandLockup';
import FlashToast from '@/Components/FlashToast';
import InlineAlert from '@/Components/InlineAlert';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import { Link, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/localization';
import { ArrowUpRight, Building2, CircleDollarSign, UsersRound, CheckCircle2 } from 'lucide-react';

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
                <div className="relative flex min-h-screen items-center justify-center bg-[#f3f6fb] px-0 pb-0 pt-16 font-sans text-[#17241f] sm:px-5 sm:py-16">
                    <main className="relative flex min-h-[min(760px,calc(100vh-8rem))] w-full max-w-6xl overflow-hidden bg-white shadow-[0_30px_80px_-30px_rgba(15,23,42,0.45)] sm:rounded-[28px] lg:grid-cols-[1.02fr_0.98fr] lg:grid">
                        <section className="hidden w-full flex-col justify-between overflow-hidden bg-gradient-to-br from-[#062f47] via-[#0a4b79] to-[#0f7bb5] p-8 text-white md:flex lg:p-12" aria-label="ITUZE GREEN PLATFORM">
                            <div className="flex items-center gap-3">
                                <Link href="/" className="rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                                    <BrandLockup
                                        logoClassName="h-16 w-16"
                                        nameClassName="text-xl font-black text-white"
                                        subtitleClassName="text-[9px] font-medium text-white/75"
                                    />
                                </Link>
                            </div>

                            <div>
                                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-50/90">
                                    <Building2 size={14} />
                                    {t('Owner dashboard')}
                                </div>
                                <h2 className="mt-8 max-w-sm text-4xl font-light leading-tight tracking-[-0.04em]">
                                    {t('Manage your spaces with confidence.')}
                                </h2>
                                <p className="mt-4 max-w-sm text-sm leading-7 text-sky-50/80">
                                    {t('Access listings, applications, and property updates from one secure workspace designed for modern property management.')}
                                </p>
                            </div>

                            <div className="space-y-3 text-sm text-sky-50/80">
                                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                                    <CheckCircle2 size={18} className="text-cyan-200" />
                                    <span>{t('Fast account access')}</span>
                                </div>
                                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                                    <CheckCircle2 size={18} className="text-cyan-200" />
                                    <span>{t('Secure property operations')}</span>
                                </div>
                            </div>
                        </section>

                        <section className="flex items-center justify-center bg-slate-50 px-6 py-9 sm:px-12 sm:py-12 lg:px-14">
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