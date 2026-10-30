import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PropertySteps from '@/Components/PropertySteps';
import { Head, Link, router } from '@inertiajs/react';
import PropertyUnitsSection, { useFloorLabel } from '@/Components/PropertyUnitsSection';
import { useTranslation } from '@/localization';
import { ArrowLeft, MapPin, Layers, Edit, Trash2, Image as ImageIcon, CheckCircle, Users, Wrench } from 'lucide-react';

const statusStyles = {
    active: 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 ring-1 ring-green-600/10',
    inactive: 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 ring-1 ring-gray-500/10',
};

const imageSource = (path) => {
    if (!path) return null;
    return /^https?:\/\//i.test(path) ? path : `/storage/${path}`;
};

export default function PropertyShow({ property, isAdmin, canEdit, canEditProperty = canEdit, canDeleteProperty = canEdit, floorNumbers = [], subscription = null }) {
    const { t } = useTranslation();
    // Self-registered owners: units, rooms and tenants wait for an approved payment.
    const locked = Boolean(subscription?.needed && !subscription?.active);
    const floorLabel = useFloorLabel();
    const upperFloors = Number(property.total_floors) || 0;
    const basements = Number(property.basement_floors) || 0;
    const confirmDelete = () => {
        if (!canDeleteProperty) return;
        
        if (confirm('Are you sure you want to delete this property? This action cannot be undone and will also delete all associated units and images.')) {
            router.delete(route('properties.destroy', property), {
                onSuccess: () => router.visit(route('properties.index')),
            });
        }
    };

    return (
        <AuthenticatedLayout header="Property Details">
            <Head title={property.name} />

            <div className="mb-6">
                <Link
                    href={route('properties.index')}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-slate-300 transition-colors hover:text-[#0E3B2E] dark:hover:text-emerald-200"
                >
                    <ArrowLeft size={16} />
                    Back to Properties
                </Link>
            </div>

            <div className="space-y-6">
                {/* Property Header */}
                <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm group">
                    {property.images && property.images.length > 0 ? (
                        <div className="relative h-72 overflow-hidden bg-gray-100 dark:bg-slate-800">
                            <img
                                src={imageSource(property.images[0].image_path)}
                                alt={property.name}
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                            />
                            <div className="absolute bottom-4 left-4 flex flex-col gap-1.5">
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/50 backdrop-blur-sm px-2.5 py-1 text-xs font-medium text-white ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-[1.03]">
                                    <CheckCircle size={12} className="text-green-300" /> Available {property.units_available_count ?? 0}
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/50 backdrop-blur-sm px-2.5 py-1 text-xs font-medium text-white ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-[1.03]">
                                    <Users size={12} className="text-blue-300" /> Occupied {property.units_occupied_count ?? 0}
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/50 backdrop-blur-sm px-2.5 py-1 text-xs font-medium text-white ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-[1.03]">
                                    <Wrench size={12} className="text-amber-300" /> Maintenance {property.units_maintenance_count ?? 0}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="relative h-72 flex items-center justify-center bg-gray-100 dark:bg-slate-800 group">
                            <ImageIcon size={64} className="text-gray-300" />
                            <div className="absolute bottom-4 left-4 flex flex-col gap-1.5">
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800/60 backdrop-blur-sm px-2.5 py-1 text-xs font-medium text-white ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-[1.03]">
                                    <CheckCircle size={12} className="text-green-300" /> Available {property.units_available_count ?? 0}
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800/60 backdrop-blur-sm px-2.5 py-1 text-xs font-medium text-white ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-[1.03]">
                                    <Users size={12} className="text-blue-300" /> Occupied {property.units_occupied_count ?? 0}
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800/60 backdrop-blur-sm px-2.5 py-1 text-xs font-medium text-white ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-[1.03]">
                                    <Wrench size={12} className="text-amber-300" /> Maintenance {property.units_maintenance_count ?? 0}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{property.name}</h1>
                                </div>
                                {property.address && (
                                    <p className="mt-2 flex items-center gap-1.5 text-gray-600 dark:text-slate-300">
                                        <MapPin size={16} aria-hidden="true" />
                                        {property.address}
                                    </p>
                                )}
                                <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-600 dark:text-slate-300">
                                    <Layers size={15} aria-hidden="true" className="text-[#0E3B2E] dark:text-emerald-300" />
                                    {[
                                        floorLabel(0),
                                        upperFloors > 0 ? (upperFloors === 1 ? t('1 upper floor') : t(':count upper floors', { count: upperFloors })) : null,
                                        basements > 0 ? (basements === 1 ? t('1 basement') : t(':count basements', { count: basements })) : t('No basement'),
                                    ].filter(Boolean).join(' · ')}
                                </p>
                                {property.cell && (
                                    <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                                        {property.cell.name}, {property.cell.sector?.name}, {property.cell.sector?.district?.name}, {property.cell.sector?.district?.province?.name}
                                    </p>
                                )}
                                {property.owner && (
                                    <p className="mt-1 text-sm text-gray-700 dark:text-slate-200">
                                        <span className="font-medium text-gray-500 dark:text-slate-400">{t('Owner')}:</span>{' '}
                                        <span className="font-semibold text-[#0E3B2E] dark:text-emerald-300">{property.owner.name}</span>
                                    </p>
                                )}
                                {property.creator && property.creator.id !== property.owner?.id && (
                                    <p className="mt-0.5 text-sm text-gray-700 dark:text-slate-200">
                                        <span className="font-medium text-gray-500 dark:text-slate-400">{t('Added by')}:</span>{' '}
                                        {property.creator.name}
                                        {property.creator.role === 'admin' && <span className="ml-1.5 rounded-full bg-gray-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-slate-300">{t('Administrator')}</span>}
                                    </p>
                                )}
                            </div>
                            {(canEditProperty || canDeleteProperty) && (
                                <div className="flex items-center gap-2">
                                    {canEditProperty && <Link
                                        href={route('properties.edit', property)}
                                        className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-50 dark:hover:bg-slate-800"
                                    >
                                        <Edit size={16} />
                                        {t('Edit')}
                                    </Link>}
                                    {canDeleteProperty && <button
                                        onClick={confirmDelete}
                                        className="flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-500/30 px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
                                    >
                                        <Trash2 size={16} />
                                        {t('Delete')}
                                    </button>}
                                </div>
                            )}
                        </div>

                        <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 p-4 md:grid-cols-7 md:gap-4">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-[#0E3B2E] dark:text-emerald-300">
                                    {property.units_count ?? 0}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-slate-400">{t('Rooms')}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-gray-500 dark:text-slate-400">{t('Available rooms')}</p>
                                <p className="text-2xl font-bold text-[#0E3B2E] dark:text-emerald-300">
                                    {property.units_available_count ?? 0}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-[#0E3B2E] dark:text-emerald-300">{property.images?.length || 0}</p>
                                <p className="text-xs text-gray-500 dark:text-slate-400">Images</p>
                            </div>
                            <div className="text-center col-span-2 md:col-span-1">
                                <p className="text-xs text-gray-500 dark:text-slate-400">
                                    {t('Monthly income (RWF)')}
                                </p>
                                {(property.units_monthly_rent_sum && Number(property.units_monthly_rent_sum) > 0) ? (
                                    <p className="text-2xl font-bold text-[#0E3B2E] dark:text-emerald-300">
                                        {Number(property.units_monthly_rent_sum).toLocaleString()}
                                    </p>
                                ) : (
                                    <p className="text-2xl font-bold text-gray-300">—</p>
                                )}
                            </div>
                        </div>

                        {(() => {
                            const rawAmenitiesList = property.amenities
                                ? Object.keys(property.amenities).filter(k => property.amenities[k] === true || property.amenities[k] === 1 || property.amenities[k] === '1')
                                : (Array.isArray(property.amenities) ? property.amenities : []);
                            const amenitiesList = rawAmenitiesList;
                            const proximityList = property.proximity
                                ? Object.keys(property.proximity).filter(k => property.proximity[k] === true || property.proximity[k] === 1 || property.proximity[k] === '1')
                                : (Array.isArray(property.proximity) ? property.proximity : []);
                            if (amenitiesList.length === 0 && proximityList.length === 0) {
                                return property.description ? (
                                    <div className="mt-6">
                                        <h3 className="text-sm font-medium text-gray-700 dark:text-slate-200">Description</h3>
                                        <p className="mt-2 whitespace-pre-wrap leading-relaxed text-gray-600 dark:text-slate-300">{property.description}</p>
                                    </div>
                                ) : null;
                            }

                            const amenityLabels = {
                                wifi: 'WiFi', parking: 'Parking', gym: 'Gym', swimming_pool: 'Pool',
                                restaurant: 'Restaurant', bar: 'Bar', security: 'Security',
                                generator: 'Generator', water_tank: 'Water Tank', elevator: 'Elevator',
                                cleaning_service: 'Cleaners',
                            };
                            const proximityLabels = {
                                near_tarmac: 'Tarmac Road', near_school: 'School', near_hospital: 'Hospital',
                                near_market: 'Market', near_public_transport: 'Public Transport',
                            };

                            return (
                                <div className="mt-6 space-y-4">
                                    {amenitiesList.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">Amenities</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {amenitiesList.map(a => (
                                                    <span key={a} className="inline-flex items-center rounded-full bg-[#0E3B2E]/10 dark:bg-emerald-400/15 px-2.5 py-1 text-xs font-medium text-[#0E3B2E] dark:text-emerald-300">
                                                        {amenityLabels[a] || a.replace(/_/g, ' ')}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {proximityList.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">Nearby</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {proximityList.map(p => (
                                                    <span key={p} className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 ring-1 ring-blue-600/10">
                                                        {proximityLabels[p] || p.replace(/^near_/, '').replace(/_/g, ' ')}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {property.description && (
                                        <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
                                            <h3 className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">Description</h3>
                                            <p className="whitespace-pre-wrap leading-relaxed text-gray-600 dark:text-slate-300">{property.description}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* Property Images Gallery */}
                {property.images && property.images.length > 1 && (
                    <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Property Images</h3>
                            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                {property.images.map((image, index) => (
                                    <div key={image.id} className="overflow-hidden rounded-xl">
                                        <img
                                            src={imageSource(image.image_path)}
                                            alt={`${property.name} - Image ${index + 1}`}
                                            className="h-32 w-full object-cover transition-transform hover:scale-105"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {locked ? (
                    <section className="mt-6 rounded-3xl border-2 border-dashed border-amber-300 dark:border-amber-500/40 bg-amber-50/60 dark:bg-amber-500/10 p-6 text-center" aria-labelledby="locked-title">
                        <div className="mx-auto max-w-md">
                            <PropertySteps current={2} waitingApproval={Boolean(subscription.pending)} />
                        </div>
                        <h2 id="locked-title" className="mt-4 font-[Sora] text-lg font-bold text-gray-900 dark:text-slate-100">
                            {subscription.pending
                                ? t('Payment sent: ITUZE is checking it.')
                                : subscription.state === 'paused' ? t('This property is paused') : t('Pay for this property to add units and rooms')}
                        </h2>
                        <p className="mx-auto mt-1 max-w-lg text-sm text-gray-700 dark:text-slate-200">
                            {subscription.pending
                                ? t('You will get an SMS and email as soon as it is approved; then you can add units, rooms and tenants.')
                                : t('Each property costs :price per month. Units, rooms and tenants unlock as soon as ITUZE approves your payment.', { price: '100,000 RWF' })}
                        </p>
                        <Link href={route('properties.pay', property.id)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0E3B2E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#124B3A]">
                            {subscription.pending ? t('See the payment') : t('Pay now')}
                        </Link>
                    </section>
                ) : (
                    <PropertyUnitsSection property={property} floorNumbers={floorNumbers} canEdit={canEdit} canEditProperty={canEditProperty} />
                )}
            </div>
        </AuthenticatedLayout>
    );
}
