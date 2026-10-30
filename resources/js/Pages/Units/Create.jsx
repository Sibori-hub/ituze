import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ParentUnitSelect from '@/Components/ParentUnitSelect';
import RoomForm from '@/Components/RoomForm';
import { useTranslation } from '@/localization';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

export default function UnitCreate({ property, propertyUnits = [], selectedPropertyUnitId = null }) {
    const { t } = useTranslation();

    return (
        <AuthenticatedLayout header={t('Add room to :property', { property: property.name })}>
            <Head title={t('Add room')} />

            <div className="mx-auto max-w-2xl">
                <Link href={route('properties.show', property.id)} className="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-slate-200 transition-colors hover:text-[#0E3B2E] dark:hover:text-emerald-200">
                    <ArrowLeft size={16} aria-hidden="true" />
                    {t('Back to property')}
                </Link>

                <div className="mt-4 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
                    <h1 className="font-[Sora] text-xl font-bold text-gray-900 dark:text-slate-100">{t('Add room')}</h1>
                    <p className="mb-5 mt-0.5 text-sm text-gray-600 dark:text-slate-300">{property.name}</p>
                    {propertyUnits.length === 0 ? (
                        <ParentUnitSelect property={property} propertyUnits={propertyUnits} />
                    ) : (
                        <RoomForm
                            property={property}
                            propertyUnits={propertyUnits}
                            initialUnitId={selectedPropertyUnitId}
                            lockUnit
                            onCancel={() => router.visit(route('properties.show', property.id))}
                        />
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
