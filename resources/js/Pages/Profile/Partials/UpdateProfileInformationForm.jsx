import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Transition } from '@headlessui/react';
import { Link, useForm, usePage } from '@inertiajs/react';
import { useTranslation } from '@/localization';

export default function UpdateProfileInformation({
    mustVerifyEmail,
    status,
    sectors = [],
    className = '',
}) {
    const user = usePage().props.auth.user;
    const { t } = useTranslation();

    const { data, setData, patch, errors, processing, recentlySuccessful } =
        useForm({
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            email: user.email,
            phone: user.phone || '',
            identity_document_type: user.identity_document_type || 'nida',
            national_id: user.national_id || '',
            address: user.address || '',
            sector_id: user.sector_id || '',
            profile_photo: null,
        });

    const submit = (e) => {
        e.preventDefault();

        patch(route('profile.update'), { forceFormData: true });
    };

    return (
        <section className={className}>
            <header>
                <h2 className="text-lg font-medium text-gray-900">
                    {t('Profile Information')}
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                    {t('Update your contact details, identity, location, and profile photo.')}
                </p>
            </header>

            <form onSubmit={submit} className="mt-6 space-y-6">
                <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                        <InputLabel htmlFor="first_name" value={t('First name')} />
                        <TextInput id="first_name" className="mt-1 block w-full" value={data.first_name} onChange={(e) => setData('first_name', e.target.value)} required autoComplete="given-name" />
                        <InputError className="mt-2" message={errors.first_name} />
                    </div>
                    <div>
                        <InputLabel htmlFor="last_name" value={t('Last name')} />
                        <TextInput id="last_name" className="mt-1 block w-full" value={data.last_name} onChange={(e) => setData('last_name', e.target.value)} required autoComplete="family-name" />
                        <InputError className="mt-2" message={errors.last_name} />
                    </div>
                </div>

                <div>
                    <InputLabel htmlFor="email" value={t('Email')} />

                    <TextInput
                        id="email"
                        type="email"
                        className="mt-1 block w-full"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        required
                        autoComplete="username"
                    />

                    <InputError className="mt-2" message={errors.email} />
                </div>

                <div>
                    <InputLabel htmlFor="phone" value={t('Phone number')} />
                    <TextInput id="phone" type="tel" className="mt-1 block w-full" value={data.phone} onChange={(e) => setData('phone', e.target.value)} required autoComplete="tel" />
                    <InputError className="mt-2" message={errors.phone} />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                        <InputLabel htmlFor="identity_document_type" value={t('Identity document')} />
                        <select id="identity_document_type" value={data.identity_document_type} onChange={(e) => setData('identity_document_type', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0E3B2E] focus:ring-[#0E3B2E]">
                            <option value="nida">NIDA</option>
                            <option value="passport">{t('Passport')}</option>
                        </select>
                        <InputError className="mt-2" message={errors.identity_document_type} />
                    </div>
                    <div>
                        <InputLabel htmlFor="national_id" value={t('NIDA / passport number')} />
                        <TextInput id="national_id" className="mt-1 block w-full" value={data.national_id} onChange={(e) => setData('national_id', e.target.value)} required />
                        <InputError className="mt-2" message={errors.national_id} />
                    </div>
                </div>

                <div>
                    <InputLabel htmlFor="address" value={t('Street address')} />
                    <TextInput id="address" className="mt-1 block w-full" value={data.address} onChange={(e) => setData('address', e.target.value)} required autoComplete="street-address" />
                    <InputError className="mt-2" message={errors.address} />
                </div>

                <div>
                    <InputLabel htmlFor="sector_id" value={t('Sector')} />
                    <select id="sector_id" value={data.sector_id} onChange={(e) => setData('sector_id', e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0E3B2E] focus:ring-[#0E3B2E]">
                        <option value="">{t('Select sector')}</option>
                        {sectors.map((sector) => (
                            <option key={sector.id} value={sector.id}>
                                {[sector.name, sector.district?.name, sector.district?.province?.name].filter(Boolean).join(', ')}
                            </option>
                        ))}
                    </select>
                    <InputError className="mt-2" message={errors.sector_id} />
                </div>

                <div>
                    <InputLabel htmlFor="profile_photo" value={t('Profile photo (optional)')} />
                    {user.profile_photo && (
                        <img src={`/storage/${user.profile_photo}`} alt={t('Current profile')} className="mb-3 h-16 w-16 rounded-full object-cover" />
                    )}
                    <input id="profile_photo" type="file" accept="image/*" onChange={(e) => setData('profile_photo', e.target.files?.[0] || null)} className="mt-1 block w-full text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium" />
                    <InputError className="mt-2" message={errors.profile_photo} />
                </div>

                {mustVerifyEmail && user.email_verified_at === null && (
                    <div>
                        <p className="mt-2 text-sm text-gray-800">
                            {t('Your email address is unverified.')}
                            <Link
                                href={route('verification.send')}
                                method="post"
                                as="button"
                                className="rounded-md text-sm text-gray-600 underline hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                            >
                                {t('Click here to re-send the verification email.')}
                            </Link>
                        </p>

                        {status === 'verification-link-sent' && (
                            <div className="mt-2 text-sm font-medium text-green-600">
                                {t('A new verification link has been sent to your email address.')}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-4">
                    <PrimaryButton disabled={processing}>{t('Save')}</PrimaryButton>

                    <Transition
                        show={recentlySuccessful}
                        enter="transition ease-in-out"
                        enterFrom="opacity-0"
                        leave="transition ease-in-out"
                        leaveTo="opacity-0"
                    >
                        <p className="text-sm text-gray-600">
                            {t('Saved.')}
                        </p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}
