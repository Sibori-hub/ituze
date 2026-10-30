import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PropertyForm from '@/Components/PropertyForm';
import { useTranslation } from '@/localization';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

export default function PropertyEdit({ property, isAdmin = false, canEdit }) {
    const { t } = useTranslation();

    if (!canEdit) {
        return (
            <AuthenticatedLayout header={t('Access Denied')}>
                <Head title={t('Access Denied')} />
                <div className="p-12 text-center">
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('Access Denied')}</h1>
                    <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{t('You do not have permission to edit this property.')}</p>
                    <Link
                        href={route('properties.show', property.id)}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#124B3A]"
                    >
                        {t('Back to property')}
                    </Link>
                </div>
            </AuthenticatedLayout>
        );
    }

    return (
        <AuthenticatedLayout header={t('Edit property')}>
            <Head title={t('Edit property')} />

            <div className="mx-auto mb-5 max-w-6xl">
                <Link
                    href={route('properties.show', property.id)}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-slate-200 transition-colors hover:text-[#0E3B2E] dark:hover:text-emerald-200"
                >
                    <ArrowLeft size={16} aria-hidden="true" />
                    {t('Back to property')}
                </Link>
                <h1 className="mt-3 font-[Sora] text-2xl font-bold text-gray-900 dark:text-slate-100">{property.name}</h1>
                {property.owner && <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{t('Owner')}: {property.owner.name}</p>}
            </div>

            <PropertyForm mode="edit" property={property} isAdmin={isAdmin} />
        </AuthenticatedLayout>
    );
}
