import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import UserAvatar from '@/Components/UserAvatar';
import { Head, Link, usePage } from '@inertiajs/react';
import { Megaphone, BadgeCheck, Hourglass, Sparkles } from 'lucide-react';
import { useTranslation } from '@/localization';

export default function AdvertiserDashboard({ status, adUnitPrice, welcomeBonusUnits }) {
    const { t } = useTranslation();
    const user = usePage().props.auth.user;
    const approved = status === 'approved';

    return (
        <AuthenticatedLayout header="Advertiser dashboard">
            <Head title={t('Advertiser dashboard')} />

            <div className="mx-auto max-w-3xl">
                <div className="mb-5 flex items-center gap-4">
                    <Link href={route('profile.edit')} className="shrink-0 rounded-full" title={t('Edit profile')}>
                        <UserAvatar user={user} size="lg" className="ring-4 ring-white shadow-md transition hover:scale-[1.03]" />
                    </Link>
                    <div className="min-w-0">
                        <h1 className="truncate font-[Sora] text-2xl font-bold text-gray-900">{t('Welcome back, :name', { name: user.first_name || user.name })}</h1>
                        <p className="mt-0.5 text-sm text-gray-500">{t('Advertiser')}</p>
                    </div>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#D9A441]/15 text-[#0E3B2E]">
                            {approved ? <BadgeCheck size={24} /> : <Hourglass size={24} />}
                        </div>
                        <div>
                            <h2 className="font-[Sora] text-xl font-bold text-gray-900">
                                {approved
                                    ? t('Your advertiser account is approved')
                                    : t('Your advertiser account is under review')}
                            </h2>
                            <p className="mt-1.5 text-sm leading-6 text-gray-600">
                                {approved
                                    ? t('You can now prepare your adverts. The advertising workspace and payments arrive in the next release.')
                                    : t('Our team is reviewing your details. You will be able to advertise as soon as an administrator approves your account.')}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-[#0E3B2E]">
                            <Megaphone size={18} />
                            <p className="text-sm font-semibold">{t('Ad unit price')}</p>
                        </div>
                        <p className="mt-3 font-[Sora] text-2xl font-bold text-gray-900">
                            {new Intl.NumberFormat('en-RW').format(adUnitPrice || 0)} RWF
                        </p>
                        <p className="mt-1 text-xs text-gray-500">{t('per ad unit')}</p>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-[#0E3B2E]">
                            <Sparkles size={18} />
                            <p className="text-sm font-semibold">{t('Welcome bonus')}</p>
                        </div>
                        <p className="mt-3 font-[Sora] text-2xl font-bold text-gray-900">
                            +{welcomeBonusUnits || 0}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                            {t('bonus ad units with your first paid unit, once per advertiser')}
                        </p>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
