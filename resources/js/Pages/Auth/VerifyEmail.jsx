import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { MailCheck, Zap } from 'lucide-react';
import { useTranslation } from '@/localization';

export default function VerifyEmail({ status, devMode, devOtp }) {
    const { t } = useTranslation();
    const { auth, errors } = usePage().props;
    const { data, setData, post, processing, reset } = useForm({
        otp: '',
    });
    const resendForm = useForm({});
    const devForm = useForm({});

    const submit = (e) => {
        e.preventDefault();
        post(route('verification.otp.verify'), {
            onFinish: () => reset('otp'),
        });
    };

    const resend = (e) => {
        e.preventDefault();
        resendForm.post(route('verification.send'));
    };

    const devVerify = (e) => {
        e.preventDefault();
        devForm.post(route('dev.verify-email'));
    };

    return (
        <GuestLayout>
            <Head title={t('Verify Your Email')} />

            <div className="pt-5 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#0E3B2E]/10">
                    <MailCheck size={26} className="text-[#0E3B2E]" />
                </div>
                <h2 className="mt-4 font-[Sora] text-xl font-bold text-gray-800">
                    {t('Enter your verification code')}
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                    {t("We've sent a 6-digit code to")}
                </p>
                <p className="mt-1 font-[Sora] text-sm font-semibold text-[#0E3B2E]">
                    {auth.user.email}
                </p>
            </div>

            {status === 'verification-link-sent' && (
                <div className="mt-5 rounded-lg bg-green-50 p-3 text-center text-sm font-medium text-green-700">
                    {t('A new code has been sent to :email.', { email: auth.user.email })}
                </div>
            )}

            <form onSubmit={submit} className="mt-6 space-y-4">
                <div>
                    <input
                        value={data.otp}
                        onChange={(e) =>
                            setData(
                                'otp',
                                e.target.value.replace(/\D/g, '').slice(0, 6),
                            )
                        }
                        placeholder="000000"
                        inputMode="numeric"
                        maxLength={6}
                        autoFocus
                        className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-4 text-center font-[Sora] text-2xl font-bold tracking-[0.5em] text-gray-800 transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
                    />
                    {errors.otp && (
                        <p className="mt-2 text-center text-xs text-red-500">
                            {errors.otp}
                        </p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={processing || data.otp.length !== 6}
                    className="w-full rounded-xl bg-[#D9A441] py-3 text-sm font-semibold tracking-wide text-[#0E3B2E] shadow-sm transition-all hover:bg-[#c9962f] hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                >
                    {t('Verify Code')}
                </button>
            </form>

            {devMode && (
                <div className="mt-5 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                        {t('Development only')}
                    </p>
                    <p className="mt-1 text-xs text-amber-700">
                        {t('No real email is sent locally. Use this code to test, or skip verification below.')}
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
                    <button
                        onClick={devVerify}
                        disabled={devForm.processing}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-500 disabled:opacity-60"
                    >
                        <Zap size={16} />
                        {t('Dev: Verify Instantly')}
                    </button>
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