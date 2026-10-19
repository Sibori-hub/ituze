import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PropertyForm from '@/Components/PropertyForm';
import { useTranslation } from '@/localization';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

export default function PropertyCreate({ isAdmin = false, owners = [], selectedOwnerId = '' }) {
    const { t } = useTranslation();

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
                <h1 className="mt-3 font-[Sora] text-2xl font-bold text-gray-900">{t('Add a property')}</h1>
                <p className="mt-1 text-sm text-gray-600">{t('Fill in the building details. After saving, add its units and rooms.')}</p>
            </div>

            <PropertyForm mode="create" isAdmin={isAdmin} owners={owners} selectedOwnerId={selectedOwnerId} />
        </AuthenticatedLayout>
    );
}
