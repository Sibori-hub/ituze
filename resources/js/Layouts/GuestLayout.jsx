import ApplicationLogo from '@/Components/ApplicationLogo';
import FlashToast from '@/Components/FlashToast';
import InlineAlert from '@/Components/InlineAlert';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import { Link, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/localization';

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
        <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#EAF2EE] via-[#F1F5F2] to-[#F4F6F5] px-4 py-10 font-[Inter]">
            <LanguageSwitcher className="absolute right-4 top-4 rounded-lg bg-[#0E3B2E] p-1.5 sm:right-6 sm:top-6" />
            <Link href="/" className="mb-6 flex items-center gap-2">
                <ApplicationLogo className="h-10 w-10 fill-current text-[#0E3B2E]" />
                <span className="font-[Sora] text-lg font-bold text-[#0E3B2E]">
                    Ituze QR Ltd
                </span>
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
                {(isLogin || isRegister) && (
                    <div className="grid grid-cols-2 gap-2 p-3">
                        <Link
                            href={route('login')}
                            className={`rounded-lg py-2.5 text-center text-sm font-semibold transition-all ${
                                isLogin
                                    ? 'bg-[#0E3B2E] text-white shadow-sm'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        >
                            {t('Login')}
                        </Link>
                        <Link
                            href={route('register')}
                            className={`rounded-lg py-2.5 text-center text-sm font-semibold transition-all ${
                                isRegister
                                    ? 'bg-[#0E3B2E] text-white shadow-sm'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        >
                            {t('Register')}
                        </Link>
                    </div>
                )}

                <div className="px-6 pb-7 pt-2 sm:px-10">{children}</div>
            </div>

            {toasts.length > 0 && (
                <div className="fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:right-4 sm:left-auto sm:items-end pointer-events-none">
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
        </div>
    );
}