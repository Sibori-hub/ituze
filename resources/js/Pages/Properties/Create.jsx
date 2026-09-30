import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InlineAlert from '@/Components/InlineAlert';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, Upload, X, Image as ImageIcon, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from '@/localization';

const ALL_AMENITIES = [
    { key: 'wifi', label: 'WiFi' },
    { key: 'parking', label: 'Parking' },
    { key: 'gym', label: 'Gym' },
    { key: 'swimming_pool', label: 'Swimming Pool' },
    { key: 'restaurant', label: 'Restaurant' },
    { key: 'bar', label: 'Bar' },
    { key: 'security', label: 'Security' },
    { key: 'generator', label: 'Generator' },
    { key: 'water_tank', label: 'Water Tank' },
    { key: 'elevator', label: 'Elevator' },
    { key: 'cleaning_service', label: 'Cleaners' },
];

const PROXIMITY = [
    { key: 'near_tarmac', label: 'Near Tarmac Road' },
    { key: 'near_school', label: 'Near School' },
    { key: 'near_hospital', label: 'Near Hospital' },
    { key: 'near_market', label: 'Near Market' },
    { key: 'near_public_transport', label: 'Near Public Transport' },
];

const getCsrfToken = () => {
    const meta = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (meta) return meta;
    const match = document.cookie.match(new RegExp('(^|;\\s*)XSRF-TOKEN=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : '';
};

export default function PropertyCreate({ isAdmin = false, owners = [], selectedOwnerId = '' }) {
    const { t } = useTranslation();
    const { data, setData, errors, processing, post } = useForm({
        owner_id: selectedOwnerId || '',
        name: '',
        address: '',
        description: '',
        cell_id: '',
        amenities: Object.fromEntries(ALL_AMENITIES.map(a => [a.key, false])),
        proximity: Object.fromEntries(PROXIMITY.map(p => [p.key, false])),
        images: [],
    });

    const [provinces, setProvinces] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [cells, setCells] = useState([]);
    const [selectedProvince, setSelectedProvince] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedSector, setSelectedSector] = useState('');
    const [imagePreviews, setImagePreviews] = useState([]);
    const [bannerMsg, setBannerMsg] = useState(null);
    const [bannerType, setBannerType] = useState('info');
    const [generatingDescription, setGeneratingDescription] = useState(false);

    const MAX_IMG_BYTES = 2 * 1024 * 1024;
    const hasErrors = Object.keys(errors).length > 0;

    useEffect(() => {
        fetch('/api/provinces')
            .then(res => res.json())
            .then(data => setProvinces(data));

    }, []);

    useEffect(() => {
        if (selectedProvince) {
            fetch(`/api/districts/${selectedProvince}`)
                .then(res => res.json())
                .then(data => {
                    setDistricts(data);
                    setSectors([]);
                    setCells([]);
                    setSelectedDistrict('');
                    setSelectedSector('');
                    setData('cell_id', '');
                });
        }
    }, [selectedProvince]);

    useEffect(() => {
        if (selectedDistrict) {
            fetch(`/api/sectors/${selectedDistrict}`)
                .then(res => res.json())
                .then(data => {
                    setSectors(data);
                    setCells([]);
                    setSelectedSector('');
                    setData('cell_id', '');
                });
        }
    }, [selectedDistrict]);

    useEffect(() => {
        if (selectedSector) {
            fetch(`/api/cells/${selectedSector}`)
                .then(res => res.json())
                .then(data => setCells(data));
        }
    }, [selectedSector]);

    const getLocationNames = () => {
        const prov = provinces.find(p => String(p.id) === String(selectedProvince));
        const dist = districts.find(d => String(d.id) === String(selectedDistrict));
        const sec = sectors.find(s => String(s.id) === String(selectedSector));
        const cel = cells.find(c => String(c.id) === String(data.cell_id));
        return {
            province_name: prov?.name || '',
            district_name: dist?.name || '',
            sector_name: sec?.name || '',
            cell_name: cel?.name || '',
        };
    };

    const handleGenerateDescription = async () => {
        if (!data.name || !String(data.name).trim()) {
            setBannerMsg('⚠️ Please enter a property name first, then click Generate — this helps the AI craft personalised copy.');
            setBannerType('warning');
            return;
        }
        setGeneratingDescription(true);
        setBannerMsg(null);

        try {
            const locationNames = getLocationNames();
            const amenitiesPayload = data.amenities;
            const proximityPayload = data.proximity;

            const body = {
                name: data.name,
                address: data.address,
                cell_id: data.cell_id || null,
                ...locationNames,
                amenities: amenitiesPayload,
                proximity: proximityPayload,
            };

            const csrfToken = getCsrfToken();
            const res = await fetch('/api/ai/generate-property-description', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
                    ...(csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {}),
                },
                body: JSON.stringify(body),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                let msg = `Server returned status ${res.status}`;
                try {
                    const errJson = await res.json();
                    if (errJson && errJson.errors) {
                        const bullets = Object.entries(errJson.errors)
                            .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join('; ') : v}`)
                            .slice(0, 4)
                            .join(' · ');
                        msg = '⚠️ Server validation issues: ' + bullets;
                    } else if (errJson && errJson.message) {
                        msg = errJson.message;
                    }
                } catch (_) { /* ignore body parse error */ }
                throw new Error(msg);
            }

            const json = await res.json();
            if (json && json.description) {
                setData('description', json.description);
                let info = '✨ Description generated successfully.';
                if (json.source === 'template') {
                    info += ' (Using local template — configure an LLM key for richer copy.)';
                } else if (json.source === 'fallback') {
                    info += ' ⚠️ AI endpoint hit a snag; using local template copy.';
                }
                setBannerMsg(info);
                setBannerType('info');
            } else {
                throw new Error('Empty response from generator');
            }
        } catch (err) {
            console.error('AI generate error:', err);
            setBannerMsg(err?.message || '⚠️ Could not generate description right now — the AI service is unreachable. You can still write a great manual description below!');
            setBannerType('warning');
        } finally {
            setGeneratingDescription(false);
        }
    };

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        const validFiles = [];
        const rejected = [];

        files.forEach(file => {
            if (!file.type.startsWith('image/')) {
                rejected.push(`${file.name}: not a valid image`);
            } else if (file.size > MAX_IMG_BYTES) {
                const sizeMB = (file.size / (1024*1024)).toFixed(2);
                rejected.push(`${file.name}: ${sizeMB} MB (max 2 MB)`);
            } else {
                validFiles.push(file);
            }
        });

        if (rejected.length > 0) {
            setBannerMsg(`📸 ${rejected.length} file(s) were rejected: ` + rejected.join('; ') + '. Only JPG/PNG/GIF images under 2MB are allowed.');
            setBannerType('warning');
        } else if (validFiles.length > 0) {
            setBannerMsg(null);
        }

        setData('images', [...data.images, ...validFiles]);

        validFiles.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreviews(prev => [...prev, reader.result]);
            };
            reader.readAsDataURL(file);
        });

        e.target.value = '';
    };

    const removeImage = (index) => {
        const newImages = data.images.filter((_, i) => i !== index);
        const newPreviews = imagePreviews.filter((_, i) => i !== index);
        setData('images', newImages);
        setImagePreviews(newPreviews);
    };

    const toggleAmenity = (key) => {
        setData('amenities', { ...data.amenities, [key]: !data.amenities[key] });
    };

    const toggleProximity = (key) => {
        setData('proximity', { ...data.proximity, [key]: !data.proximity[key] });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const missing = [];
        if (isAdmin && !data.owner_id) missing.push('Owner');
        if (!data.name?.trim()) missing.push('Property Name');
        if (!data.address?.trim()) missing.push('Address');
        if (!data.cell_id) missing.push('Location (Cell)');

        if (missing.length > 0) {
            setBannerMsg('⚠️ Please fill in all required fields: ' + missing.join(', '));
            setBannerType('warning');
            return;
        }

        const oversized = data.images.filter(img => img.size > MAX_IMG_BYTES);
        if (oversized.length > 0) {
            setBannerMsg('📸 One or more images are too large. Each must be under 2MB.');
            setBannerType('warning');
            return;
        }

        setBannerMsg(null);

        const formData = new FormData();
        formData.append('name', data.name);
        formData.append('address', data.address);
        formData.append('description', data.description);
        formData.append('cell_id', data.cell_id);
        if (isAdmin) formData.append('owner_id', data.owner_id);

        ALL_AMENITIES.forEach(a => {
            formData.append(`amenities[${a.key}]`, data.amenities[a.key] ? '1' : '0');
        });
        PROXIMITY.forEach(p => {
            formData.append(`proximity[${p.key}]`, data.proximity[p.key] ? '1' : '0');
        });

        data.images.forEach((image, index) => {
            formData.append(`images[${index}]`, image);
        });

        post(route('properties.store'), formData, {
            onError: (err) => {
                console.log('PROPERTY STORE SERVER ERRORS:', err);
                setBannerMsg('❌ Server rejected the form. Please check errors below each field.');
                setBannerType('error');
            },
        });
    };

    return (
        <AuthenticatedLayout header="Add New Property">
            <Head title="Add Property" />

            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm sm:p-8">
                <div className="mx-auto min-h-full max-w-4xl rounded-3xl bg-white/95 p-4 shadow-2xl ring-1 ring-white/30 sm:p-7">
            <div className="mb-6 flex items-center justify-between">
                <Link
                    href={route('properties.index', selectedOwnerId ? { owner_id: selectedOwnerId } : {})}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-600 transition-colors hover:text-[#0E3B2E]"
                >
                    <ArrowLeft size={16} />
                    Back to Properties
                </Link>
            </div>

            <div className="max-w-2xl">
                {bannerMsg && (
                    <div className="mb-4">
                        <InlineAlert message={bannerMsg} type={bannerType} />
                    </div>
                )}
                {hasErrors && (
                    <div className="mb-4">
                        <InlineAlert
                            type="error"
                            message={
                                <div className="flex items-start gap-2">
                                    <AlertCircle size={16} className="flex-none mt-0.5" />
                                    <div>
                                        <div className="font-semibold mb-1">Please fix these errors before submitting:</div>
                                        <ul className="list-disc pl-5 space-y-0.5 text-xs">
                                            {Object.entries(errors).slice(0, 8).map(([field, msg]) => (
                                                <li key={field}><span className="capitalize">{field.replace(/_/g, ' ')}:</span> {msg}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            }
                        />
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900">Property Information</h3>

                            <div className="mt-6 space-y-4">
                                {isAdmin && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">{t('Property owner')} *</label>
                                        <select
                                            value={data.owner_id}
                                            onChange={event => setData('owner_id', event.target.value)}
                                            className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
                                        >
                                            <option value="">{t('Select an owner')}</option>
                                            {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
                                        </select>
                                        {errors.owner_id && <p className="mt-1 text-sm text-red-500">{errors.owner_id}</p>}
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Property Name *</label>
                                    <input
                                        type="text"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
                                        placeholder="e.g., Kigali Heights Apartments"
                                    />
                                    {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Address *</label>
                                    <input
                                        type="text"
                                        value={data.address}
                                        onChange={(e) => setData('address', e.target.value)}
                                        className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
                                        placeholder="e.g., KG 123 St, Kigali"
                                    />
                                    {errors.address && <p className="mt-1 text-sm text-red-500">{errors.address}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Location *</label>
                                    <div className="mt-2 grid grid-cols-2 gap-3">
                                        <div>
                                            <select
                                                value={selectedProvince}
                                                onChange={(e) => {
                                                    setSelectedProvince(e.target.value);
                                                    setData('cell_id', '');
                                                }}
                                                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
                                            >
                                                <option value="">Select Province</option>
                                                {provinces.map(province => (
                                                    <option key={province.id} value={province.id}>{province.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <select
                                                value={selectedDistrict}
                                                onChange={(e) => {
                                                    setSelectedDistrict(e.target.value);
                                                    setData('cell_id', '');
                                                }}
                                                disabled={!selectedProvince}
                                                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15 disabled:opacity-50"
                                            >
                                                <option value="">Select District</option>
                                                {districts.map(district => (
                                                    <option key={district.id} value={district.id}>{district.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <select
                                                value={selectedSector}
                                                onChange={(e) => {
                                                    setSelectedSector(e.target.value);
                                                    setData('cell_id', '');
                                                }}
                                                disabled={!selectedDistrict}
                                                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15 disabled:opacity-50"
                                            >
                                                <option value="">Select Sector</option>
                                                {sectors.map(sector => (
                                                    <option key={sector.id} value={sector.id}>{sector.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <select
                                                value={data.cell_id}
                                                onChange={(e) => setData('cell_id', e.target.value)}
                                                disabled={!selectedSector}
                                                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15 disabled:opacity-50"
                                            >
                                                <option value="">Select Cell</option>
                                                {cells.map(cell => (
                                                    <option key={cell.id} value={cell.id}>{cell.name}</option>
                                                ))}
                                            </select>
                                            {errors.cell_id && <p className="mt-1 text-sm text-red-500">{errors.cell_id}</p>}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>

                        <div className="border-t border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-900">Amenities</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Select any amenities that apply to this property
                            </p>
                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {ALL_AMENITIES.map(a => (
                                    <label
                                        key={a.key}
                                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition-all ${
                                            data.amenities[a.key]
                                                ? 'border-[#0E3B2E] bg-[#0E3B2E]/5 ring-2 ring-[#0E3B2E]/10'
                                                : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-[#0E3B2E] focus:ring-[#0E3B2E]"
                                            checked={!!data.amenities[a.key]}
                                            onChange={() => toggleAmenity(a.key)}
                                        />
                                        <span className="text-sm text-gray-700">{a.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-900">Nearby Infrastructure</h3>
                            <p className="mt-1 text-sm text-gray-500">Select landmarks located close to the property</p>
                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {PROXIMITY.map(p => (
                                    <label
                                        key={p.key}
                                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition-all ${
                                            data.proximity[p.key]
                                                ? 'border-blue-700 bg-blue-50 ring-2 ring-blue-600/10'
                                                : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                                            checked={!!data.proximity[p.key]}
                                            onChange={() => toggleProximity(p.key)}
                                        />
                                        <span className="text-sm text-gray-700">{p.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-gray-100 p-6">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-semibold text-gray-900">Description</h3>
                                <button
                                    type="button"
                                    onClick={handleGenerateDescription}
                                    disabled={generatingDescription}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#0E3B2E]/30 bg-[#0E3B2E]/5 px-3 py-1.5 text-xs font-medium text-[#0E3B2E] transition-all hover:bg-[#0E3B2E]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {generatingDescription ? <><Loader2 size={13} className="animate-spin" /> Generating...</> : <><Sparkles size={13} /> Generate Description with AI</>}
                                </button>
                            </div>
                            <textarea
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                rows={6}
                                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
                                placeholder="Describe your property... or click Generate above for an AI-crafted description!"
                            />
                            {errors.description && <p className="mt-1 text-sm text-red-500">{errors.description}</p>}
                        </div>

                        <div className="border-t border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-900">Property Images</h3>
                            <p className="mt-1 text-sm text-gray-500">Add photos of your property (max 2MB per image)</p>

                            <div className="mt-4">
                                <label className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-6 py-8 transition-all hover:border-[#0E3B2E]/30 hover:bg-[#0E3B2E]/5 cursor-pointer">
                                    <Upload size={32} className="text-gray-400" />
                                    <span className="mt-2 text-sm text-gray-600">Click to upload images</span>
                                    <span className="text-xs text-gray-400">PNG, JPG, GIF up to 2MB</span>
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="absolute inset-0 cursor-pointer opacity-0"
                                    />
                                </label>
                            </div>

                            {imagePreviews.length > 0 && (
                                <div className="mt-4 grid grid-cols-4 gap-3">
                                    {imagePreviews.map((preview, index) => (
                                        <div key={index} className="relative group">
                                            <img
                                                src={preview}
                                                alt={`Preview ${index + 1}`}
                                                className="h-24 w-full rounded-lg object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(index)}
                                                className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {errors.images && <p className="mt-1 text-sm text-red-500">{errors.images}</p>}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Link
                            href={route('properties.index')}
                            className="rounded-xl px-6 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={processing || generatingDescription}
                            className="flex items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0a2e23] disabled:opacity-50 disabled:cursor-not-allowed min-w-[180px]"
                        >
                            {processing && <Loader2 size={16} className="animate-spin" />}
                            {processing ? 'SAVING...' : 'Create Property'}
                        </button>
                    </div>
                </form>
            </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
