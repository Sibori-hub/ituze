import GuestLayout from '@/Layouts/GuestLayout';
import InputError from '@/Components/InputError';
import { Head, Link, useForm } from '@inertiajs/react';
import { MessageCircle, Loader2 } from 'lucide-react';
import { useTranslation } from '@/localization';

export default function VerifyPhone({ phone, status, devMode, devOtp }) {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors, reset } = useForm({ otp: '' });
    const resendForm = useForm({});

    const submit = (e) => {
        e.preventDefault();
        post(route('phone.verify'), { onFinish: () => reset('otp') });
    };

    const resend = (e) => {
        e.preventDefault();
        resendForm.post(route('phone.send'));
    };

    return (
        <GuestLayout>
            <Head title={t('Verify Your Phone')} />

            <div className="pt-5 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#0E3B2E]/10">
                    <MessageCircle size={26} className="text-[#0E3B2E]" />
                </div>
                <h2 className="mt-4 font-[Sora] text-xl font-bold text-gray-800">
                    {t('Enter your WhatsApp code')}
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                    {t("We've sent a 6-digit code on WhatsApp to")}
                </p>
                <p className="mt-1 font-[Sora] text-sm font-semibold text-[#0E3B2E]">
                    {phone}
                </p>
            </div>

            {status && (
                <div className="mt-5 rounded-lg bg-green-50 p-3 text-center text-sm font-medium text-green-700" role="status">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="mt-6 space-y-4">
                <div>
                    <input
                        value={data.otp}
                        onChange={(e) =>
                            setData('otp', e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        placeholder="000000"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        autoFocus
                        aria-label={t('Verification code')}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-4 text-center font-[Sora] text-2xl font-bold tracking-[0.5em] text-gray-800 transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
                    />
                    <div aria-live="polite">
                        <InputError message={errors.otp} className="mt-2 text-center" />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={processing || data.otp.length !== 6}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D9A441] py-3 text-sm font-semibold tracking-wide text-[#0E3B2E] shadow-sm transition-all hover:bg-[#c9962f] hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                >
                    {processing && <Loader2 size={16} className="animate-spin" />}
                    {t('Verify Code')}
                </button>
            </form>

            {devMode && (
                <div className="mt-5 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                        {t('Development only')}
                    </p>
                    <p className="mt-1 text-xs text-amber-700">
                        {t('WhatsApp is not configured locally, so the code is written to the Laravel log and shown here.')}
                    </p>
                    {devOtp ? (
                        <p className="mt-3 text-center font-[Sora] text-3xl font-bold tracking-[0.4em] text-[#0E3B2E]">
                            {devOtp}
                        </p>
                    ) : (
                        <p className="mt-3 text-center text-xs text-amber-700">
                            {t('Click Resend Code to generate a test code.')}
                        </p>
                    )}
                </div>
            )}

            <div className="mt-5 space-y-3">
                <form onSubmit={resend}>
                    <button
                        type="submit"
                        disabled={resendForm.processing}
                        className="w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
                    >
                        {t('Resend Code')}
                    </button>
                </form>

                <Link
                    href={route('logout')}
                    method="post"
                    as="button"
                    className="block w-full text-center text-sm text-gray-400 hover:text-gray-600"
                >
                    {t('Log Out')}
                </Link>
            </div>
        </GuestLayout>
    );
}
