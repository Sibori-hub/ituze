import { useForm, usePage } from '@inertiajs/react';
import { IdCard, Camera, User, Mail, Phone, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function CompleteProfileModal({ onDone }) {
    const { auth } = usePage().props;
    const user = auth.user;

    const { data, setData, post, processing, errors } = useForm({
        national_id: '',
        profile_photo: null,
        province_id: '',
        district_id: '',
        sector_id: '',
    });

    const [preview, setPreview] = useState(null);
    const [provinces, setProvinces] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        fetch(route('api.provinces'))
            .then((res) => res.json())
            .then(setProvinces);
    }, []);

    useEffect(() => {
        if (!data.province_id) {
            setDistricts([]);
            return;
        }
        fetch(route('api.districts', data.province_id))
            .then((res) => res.json())
            .then(setDistricts);
    }, [data.province_id]);

    useEffect(() => {
        if (!data.district_id) {
            setSectors([]);
            return;
        }
        fetch(route('api.sectors', data.district_id))
            .then((res) => res.json())
            .then(setSectors);
    }, [data.district_id]);

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        setData('profile_photo', file);
        if (file) setPreview(URL.createObjectURL(file));
    };

    const submit = (e) => {
        e.preventDefault();
        post(route('profile.complete.store'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => setSubmitted(true),
        });
    };

    const inputBase =
        'w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 pl-11 pr-3 text-sm text-gray-800 transition-all placeholder:text-gray-400 focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15';
    const disabledInput =
        'w-full rounded-xl border border-gray-200 bg-gray-100 py-2.5 pl-11 pr-3 text-sm text-gray-500';
    const iconClass =
        'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400';
    const selectBase =
        'w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 px-3 text-sm text-gray-800 transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15 disabled:bg-gray-100 disabled:text-gray-400';

    if (submitted) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                        <CheckCircle2 size={32} className="text-green-600" />
                    </div>
                    <h2 className="mt-4 font-[Sora] text-xl font-bold text-gray-800">
                        Thank you for completing your profile!
                    </h2>
                    <p className="mt-2 text-sm text-gray-500">
                        You're all set. You can now start using ITUZE GREEN PLATFORM
                        to manage your properties.
                    </p>
                    <button
                        onClick={onDone}
                        className="mt-6 w-full rounded-xl bg-[#0E3B2E] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0a2e23]"
                    >
                        Get Started
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
            <div className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
                <div className="text-center">
                    <h2 className="font-[Sora] text-xl font-bold text-gray-800">
                        Complete Your Profile
                    </h2>
                    <p className="mt-1.5 text-sm text-gray-500">
                        Just one more step before you can start using Ituze
                        QR Ltd
                    </p>
                </div>

                <form onSubmit={submit} className="mt-6 space-y-5">
                    <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Identification
                        </p>
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="relative">
                                    <User size={17} className={iconClass} />
                                    <input
                                        value={user.first_name || ''}
                                        disabled
                                        className={disabledInput}
                                    />
                                </div>
                                <div className="relative">
                                    <User size={17} className={iconClass} />
                                    <input
                                        value={user.last_name || ''}
                                        disabled
                                        className={disabledInput}
                                    />
                                </div>
                            </div>
                            <div className="relative">
                                <Mail size={17} className={iconClass} />
                                <input
                                    value={user.email || ''}
                                    disabled
                                    className={disabledInput}
                                />
                            </div>
                            <div className="relative">
                                <Phone size={17} className={iconClass} />
                                <input
                                    value={user.phone || ''}
                                    disabled
                                    className={disabledInput}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-center border-t border-gray-100 pt-5">
                        <label
                            htmlFor="profile_photo"
                            className="group relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-[#0E3B2E]"
                        >
                            {preview ? (
                                <img
                                    src={preview}
                                    alt="Preview"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <Camera
                                    size={22}
                                    className="text-gray-400 group-hover:text-[#0E3B2E]"
                                />
                            )}
                            <input
                                id="profile_photo"
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoChange}
                                className="hidden"
                            />
                        </label>
                        <p className="mt-2 text-xs text-gray-400">
                            Upload a profile photo
                        </p>
                        {errors.profile_photo && (
                            <p className="mt-1 text-xs text-red-500">
                                {errors.profile_photo}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                            National ID / Passport Number
                        </label>
                        <div className="relative">
                            <IdCard size={17} className={iconClass} />
                            <input
                                value={data.national_id}
                                placeholder="1 1234 5678901 2 34"
                                onChange={(e) =>
                                    setData('national_id', e.target.value)
                                }
                                className={inputBase}
                                required
                            />
                        </div>
                        {errors.national_id && (
                            <p className="mt-1 text-xs text-red-500">
                                {errors.national_id}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Province
                            </label>
                            <select
                                value={data.province_id}
                                onChange={(e) => {
                                    setData('province_id', e.target.value);
                                    setData('district_id', '');
                                    setData('sector_id', '');
                                }}
                                className={selectBase}
                                required
                            >
                                <option value="">Select</option>
                                {provinces.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                District
                            </label>
                            <select
                                value={data.district_id}
                                onChange={(e) => {
                                    setData('district_id', e.target.value);
                                    setData('sector_id', '');
                                }}
                                disabled={!data.province_id}
                                className={selectBase}
                                required
                            >
                                <option value="">Select</option>
                                {districts.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Sector
                            </label>
                            <select
                                value={data.sector_id}
                                onChange={(e) =>
                                    setData('sector_id', e.target.value)
                                }
                                disabled={!data.district_id}
                                className={selectBase}
                                required
                            >
                                <option value="">Select</option>
                                {sectors.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {errors.sector_id && (
                        <p className="text-xs text-red-500">
                            {errors.sector_id}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={processing}
                        className="w-full rounded-xl bg-[#D9A441] py-3 text-sm font-semibold tracking-wide text-[#0E3B2E] shadow-sm transition-all hover:bg-[#c9962f] disabled:opacity-60"
                    >
                        COMPLETE PROFILE
                    </button>
                </form>
            </div>
        </div>
    );
}