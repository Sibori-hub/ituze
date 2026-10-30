import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import StrongPasswordFields, { passwordReady } from '@/Components/StrongPasswordFields';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, useForm } from '@inertiajs/react';
import { Mail } from 'lucide-react';
import { useTranslation } from '@/localization';

export default function ResetPassword({ token, email }) {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors, reset } = useForm({
        token: token,
        email: email,
        password: '',
        password_confirmation: '',
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('password.store'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <GuestLayout>
            <Head title={t('Reset Password')} />

            <h1 className="mb-4 font-[Sora] text-xl font-bold text-gray-900 dark:text-slate-100">{t('Reset Password')}</h1>

            <form onSubmit={submit} noValidate>
                <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-slate-200">{t('Email')}</label>
                <div className="relative">
                    <Mail size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" aria-hidden="true" />
                    <input
                        id="email"
                        type="email"
                        name="email"
                        value={data.email}
                        autoComplete="username"
                        onChange={(e) => setData('email', e.target.value)}
                        className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 pl-11 pr-4 text-sm text-gray-800 dark:text-slate-100 shadow-[0_1px_2px_rgba(16,24,40,0.04)] focus:border-[#0E3B2E] focus:ring-4 focus:ring-[#0E3B2E]/10"
                    />
                </div>
                <InputError message={errors.email ? t(errors.email) : null} className="mt-1" />

                <div className="mt-4">
                    <StrongPasswordFields
                        password={data.password}
                        confirmation={data.password_confirmation}
                        onPasswordChange={(value) => setData('password', value)}
                        onConfirmationChange={(value) => setData('password_confirmation', value)}
                        errors={errors}
                        autoFocus
                    />
                </div>

                <div className="mt-5 flex items-center justify-end">
                    <PrimaryButton disabled={processing || !passwordReady(data.password, data.password_confirmation)}>
                        {t('Reset Password')}
                    </PrimaryButton>
                </div>
            </form>
        </GuestLayout>
    );
}
