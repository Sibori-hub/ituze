import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { Clock3, ShieldCheck, XCircle } from 'lucide-react';
import { useTranslation } from '@/localization';

export default function Status({ status, expired, managerPaused = false, employerName = null, canPay = false, neverPaid = false }) {
    const { t } = useTranslation();
    const rejected = status === 'rejected';
    const isExpired = expired && status === 'approved' && !managerPaused;
    const Icon = rejected ? XCircle : isExpired ? Clock3 : ShieldCheck;
    const title = managerPaused
        ? 'Your workspace is paused'
        : isExpired && neverPaid
          ? 'Welcome! Pay your first month to start'
        : rejected
        ? 'Your account was not approved'
        : isExpired
          ? 'Your subscription has expired'
          : 'Welcome to ITUZE GREEN PLATFORM';
    const message = managerPaused
        ? 'The account of the owner you work for is not active right now, usually because the monthly subscription is unpaid. Please contact :owner.'
        : isExpired && neverPaid
          ? 'Your account is approved. Pay 100,000 RWF for your first month by mobile money or bank, and everything opens straight away.'
        : rejected
        ? 'Please contact ITUZE GREEN PLATFORM for help with your account.'
        : isExpired
          ? (canPay ? 'Your subscription has ended and your account is paused. Your data is safe: pay by MoMo or bank to continue straight away.' : 'Your owner subscription has ended. Please contact ITUZE GREEN PLATFORM to renew access.')
          : 'Welcome to ITUZE GREEN PLATFORM web app. Our team is checking and your account will be available in less than 5 minutes.';

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
                    {t(message, { owner: employerName || t('the owner') })}
                </p>
                {!rejected && !isExpired && !managerPaused && (
                    <p className="mt-5 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                        {t('After approval you pay 100,000 RWF per month to use the system, by mobile money or bank.')}
                    </p>
                )}
                {isExpired && canPay && (
                    <Link href={route('subscription.show')} className="mr-3 mt-7 inline-block rounded-xl bg-[#D9A441] px-5 py-3 text-sm font-semibold text-[#0E3B2E] transition hover:bg-[#c99535]">
                        {t('Pay my subscription')}
                    </Link>
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
