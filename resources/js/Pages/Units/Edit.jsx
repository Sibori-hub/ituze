import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import RoomForm from '@/Components/RoomForm';
import { useTranslation } from '@/localization';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

export default function UnitEdit({ property, unit, propertyUnits = [] }) {
    const { t } = useTranslation();

    return (
        <AuthenticatedLayout header={t('Edit room :number', { number: unit.unit_number })}>
            <Head title={t('Edit room :number', { number: unit.unit_number })} />

            <div className="mx-auto max-w-2xl">
                <Link href={route('properties.show', property.id)} className="inline-flex items-center gap-1.5 text-sm text-gray-700 transition-colors hover:text-[#0E3B2E]">
                    <ArrowLeft size={16} aria-hidden="true" />
                    {t('Back to property')}
                </Link>

                <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                    <h1 className="font-[Sora] text-xl font-bold text-gray-900">{t('Edit room :number', { number: unit.unit_number })}</h1>
                    <p className="mb-5 mt-0.5 text-sm text-gray-600">{property.name}</p>
                    <RoomForm
                        property={property}
                        propertyUnits={propertyUnits}
                        room={unit}
                        onCancel={() => router.visit(route('properties.show', property.id))}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
