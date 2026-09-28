import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { Clock3, ShieldCheck, XCircle } from 'lucide-react';
import { useTranslation } from '@/localization';

export default function Status({ status, expired }) {
    const { t } = useTranslation();
    const rejected = status === 'rejected';
    const isExpired = expired && status === 'approved';
    const Icon = rejected ? XCircle : isExpired ? Clock3 : ShieldCheck;
    const title = rejected
        ? 'Your account was not approved'
        : isExpired
          ? 'Your subscription has expired'
          : 'Welcome to Ituze-Qra Ltd';
    const message = rejected
        ? 'Please contact Ituze-Qra Ltd for help with your account.'
        : isExpired
          ? 'Your owner subscription has ended. Please contact Ituze-Qra Ltd to renew access.'
          : 'Welcome to Ituze-Qra Ltd web app. Our team is checking and your account will be available in less than 5 minutes.';

    return (
        <AuthenticatedLayout header="Account status">
            <Head title={t('Account status')} />
            <div className="mx-auto max-w-2xl rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm sm:p-12">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#D9A441]/15 text-[#0E3B2E]">
                    <Icon size={30} />
                </div>
                <h1 className="mt-5 font-[Sora] text-2xl font-bold text-gray-900">
                    {t(title)}
                </h1>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-gray-600">
                    {t(message)}
                </p>
                {!rejected && !isExpired && (
                    <p className="mt-5 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                        {t('Your one-year subscription begins on the day an administrator approves your account.')}
                    </p>
                )}
                <Link
                    href={route('logout')}
                    method="post"
                    as="button"
                    className="mt-7 rounded-xl bg-[#0E3B2E] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0a2e23]"
                >
                    {t('Log out')}
                </Link>
            </div>
        </AuthenticatedLayout>
    );
}
