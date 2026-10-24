import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PropertyForm from '@/Components/PropertyForm';
import PropertySteps from '@/Components/PropertySteps';
import { useTranslation } from '@/localization';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

export default function PropertyCreate({ isAdmin = false, owners = [], selectedOwnerId = '' }) {
    const { t } = useTranslation();
    // Self-registered owners pay for the property as step 2, before units and rooms.
    const pays = Boolean(usePage().props.auth?.subscription);

    return (
        <AuthenticatedLayout header={t('Add property')}>
            <Head title={t('Add property')} />

            <div className="mx-auto mb-5 max-w-6xl">
                <Link
                    href={route('properties.index', selectedOwnerId ? { owner_id: selectedOwnerId } : {})}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-700 transition-colors hover:text-[#0E3B2E]"
                >
                    <ArrowLeft size={16} aria-hidden="true" />
                    {t('Back to Properties')}
                </Link>
                {pays && <div className="mt-4"><PropertySteps current={1} /></div>}
                <h1 className="mt-3 font-[Sora] text-2xl font-bold text-gray-900">{t('Add a property')}</h1>
                <p className="mt-1 text-sm text-gray-600">
                    {pays
                        ? t('Fill in the building details. Next you pay for it (100,000 RWF per month); once ITUZE approves the payment, you add its units, rooms and tenants.')
                        : t('Fill in the building details. After saving, add its units and rooms.')}
                </p>
            </div>

            <PropertyForm mode="create" isAdmin={isAdmin} owners={owners} selectedOwnerId={selectedOwnerId} />
        </AuthenticatedLayout>
    );
}
