import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Home, DollarSign, Grid3x3, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '@/localization';

export default function UnitEdit({ property, unit, unitTypes }) {
    const { t } = useTranslation();
    const { data, setData, errors, processing, post, transform } = useForm({
        unit_type_id: unit.unit_type_id || '',
        unit_number: unit.unit_number || '',
        floor_number: unit.floor_number ?? '',
        rent_amount: unit.rent_amount || '',
        rent_frequency: unit.rent_frequency || 'monthly',
        size_sqm: unit.size_sqm || '',
        description: unit.description || '',
        status: unit.status || 'available',
        images: [],
        delete_images: [],
    });
    const [imagePreviews, setImagePreviews] = useState([]);

    const handleSubmit = (e) => {
        e.preventDefault();
        transform((formData) => ({ ...formData, _method: 'put' })).post(
            route('properties.units.update', [property, unit]),
            { forceFormData: true },
        );
    };

    const handleImageChange = (event) => {
        const selectedFiles = Array.from(event.target.files || []);
        const availableSlots = Math.max(0, 10 - data.images.length);
        const validFiles = selectedFiles
            .filter((file) => file.type.startsWith('image/') && file.size <= 2 * 1024 * 1024)
            .slice(0, availableSlots);

        setData('images', [...data.images, ...validFiles]);
        validFiles.forEach((file) => {
            const reader = new FileReader();
            reader.onloadend = () => setImagePreviews((previews) => [...previews, reader.result]);
            reader.readAsDataURL(file);
        });
        event.target.value = '';
    };

    const removeNewImage = (index) => {
        setData('images', data.images.filter((_, imageIndex) => imageIndex !== index));
        setImagePreviews((previews) => previews.filter((_, imageIndex) => imageIndex !== index));
    };

    const removeExistingImage = (imageId) => {
        setData('delete_images', [...data.delete_images, imageId]);
    };

    return (
        <AuthenticatedLayout header={t('Edit Unit - :number', { number: unit.unit_number })}>
            <Head title={t('Edit Unit - :number', { number: unit.unit_number })} />

            <div className="mb-6">
                <Link
                    href={route('properties.units.index', property)}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-600 transition-colors hover:text-[#0E3B2E]"
                >
                    <ArrowLeft size={16} />
                    {t('Back to Units')}
                </Link>
            </div>

            <div className="max-w-2xl">
                <div className="mb-4 rounded-xl bg-gray-50 p-4">
                    <p className="text-sm text-gray-600">
                        <span className="font-medium">{t('Property')}:</span> {property.name}
                    </p>
                    <p className="text-xs text-gray-400">
                        {property.address}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900">{t('Unit Information')}</h3>
                            
                            <div className="mt-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('Unit Number')} *</label>
                                    <input
                                        type="text"
                                        value={data.unit_number}
                                        onChange={(e) => setData('unit_number', e.target.value)}
                                        className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
                                        placeholder={t('e.g., A-101, B-205')}
                                    />
                                    {errors.unit_number && <p className="mt-1 text-sm text-red-500">{errors.unit_number}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('Unit Type')} *</label>
                                    <select
                                        value={data.unit_type_id}
                                        onChange={(e) => setData('unit_type_id', e.target.value)}
                                        className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
                                    >
                                        <option value="">{t('Select Unit Type')}</option>
                                        {unitTypes.map(type => (
                                            <option key={type.id} value={type.id}>{type.name}</option>
                                        ))}
                                    </select>
                                    {errors.unit_type_id && <p className="mt-1 text-sm text-red-500">{errors.unit_type_id}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('Floor')}</label>
                                    <input type="number" value={data.floor_number} onChange={(e) => setData('floor_number', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm" placeholder={t('0 for ground floor, 1 for first floor')} />
                                    {errors.floor_number && <p className="mt-1 text-sm text-red-500">{errors.floor_number}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('Monthly Rent (RWF)')} *</label>
                                    <div className="relative mt-1">
                                        <DollarSign size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="number"
                                            value={data.rent_amount}
                                            onChange={(e) => setData('rent_amount', e.target.value)}
                                            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 pl-9 pr-3 text-sm transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
                                            placeholder={t('e.g., 150000')}
                                            min="0"
                                            step="100"
                                        />
                                    </div>
                                    {errors.rent_amount && <p className="mt-1 text-sm text-red-500">{errors.rent_amount}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('Rent Frequency')} *</label>
                                    <select value={data.rent_frequency} onChange={(e) => setData('rent_frequency', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm">
                                        <option value="monthly">{t('Monthly')}</option>
                                        <option value="weekly">{t('Weekly')}</option>
                                        <option value="daily">{t('Daily')}</option>
                                        <option value="quarterly">{t('Quarterly')}</option>
                                        <option value="yearly">{t('Yearly')}</option>
                                    </select>
                                    {errors.rent_frequency && <p className="mt-1 text-sm text-red-500">{errors.rent_frequency}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('Unit Size (m²)')}</label>
                                    <div className="relative mt-1">
                                        <Grid3x3 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="number"
                                            value={data.size_sqm}
                                            onChange={(e) => setData('size_sqm', e.target.value)}
                                            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 pl-9 pr-3 text-sm transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
                                            placeholder={t('e.g., 60')}
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('Description')}</label>
                                    <textarea
                                        value={data.description}
                                        onChange={(e) => setData('description', e.target.value)}
                                        rows={3}
                                        className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
                                        placeholder={t('Describe the unit features, amenities, etc.')}
                                    />
                                    {errors.description && <p className="mt-1 text-sm text-red-500">{errors.description}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('Status')} *</label>
                                    <select
                                        value={data.status}
                                        onChange={(e) => setData('status', e.target.value)}
                                        className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
                                    >
                                        <option value="available">{t('Available')}</option>
                                        <option value="occupied">{t('Occupied')}</option>
                                        <option value="maintenance">{t('Maintenance')}</option>
                                        <option value="reserved">{t('Reserved')}</option>
                                        <option value="inactive">{t('Inactive')}</option>
                                    </select>
                                    {errors.status && <p className="mt-1 text-sm text-red-500">{errors.status}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('Unit Images')}</label>
                                    <p className="mt-1 text-xs text-gray-500">{t('Add up to 10 JPG, PNG, GIF, or WebP images. Maximum 2 MB each.')}</p>
                                    <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm font-medium text-gray-600 hover:border-[#0E3B2E] hover:text-[#0E3B2E]">
                                        <Upload size={17} />
                                        {t('Select images')}
                                        <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple className="sr-only" onChange={handleImageChange} disabled={data.images.length >= 10} />
                                    </label>
                                    {errors.images && <p className="mt-1 text-sm text-red-500">{errors.images}</p>}
                                    {Object.entries(errors).filter(([field]) => field.startsWith('images.')).map(([field, message]) => (
                                        <p key={field} className="mt-1 text-sm text-red-500">{message}</p>
                                    ))}
                                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                                        {(unit.images || [])
                                            .filter((image) => !data.delete_images.includes(image.id))
                                            .map((image) => (
                                                <div key={image.id} className="relative overflow-hidden rounded-xl border border-gray-200">
                                                    <img src={/^https?:\/\//i.test(image.image_path) ? image.image_path : `/storage/${image.image_path}`} alt={unit.unit_number} className="h-28 w-full object-cover" />
                                                    <p className="px-2 py-1 text-xs text-gray-600">{t(image.is_cover ? 'Cover image' : 'Unit image')}</p>
                                                    <button type="button" onClick={() => removeExistingImage(image.id)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-600 shadow" aria-label={t('Remove unit image')}>
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        {data.images.map((image, index) => (
                                            <div key={`${image.name}-${index}`} className="relative overflow-hidden rounded-xl border border-gray-200">
                                                <img src={imagePreviews[index]} alt={image.name} className="h-28 w-full object-cover" />
                                                <p className="truncate px-2 py-1 text-xs text-gray-600">{image.name}</p>
                                                <button type="button" onClick={() => removeNewImage(index)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-600 shadow" aria-label={`Remove ${image.name}`}>
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Link
                            href={route('properties.units.index', property)}
                            className="rounded-xl px-6 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
                        >
                            {t('Cancel')}
                        </Link>
                        <button
                            type="submit"
                            disabled={processing}
                            className="rounded-xl bg-[#0E3B2E] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0a2e23] disabled:opacity-50"
                        >
                            {processing ? t('Updating...') : t('Update Unit')}
                        </button>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
