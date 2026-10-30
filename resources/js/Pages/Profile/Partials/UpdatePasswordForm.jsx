import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import StrongPasswordFields, { passwordReady } from '@/Components/StrongPasswordFields';
import TextInput from '@/Components/TextInput';
import { Transition } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import { useRef } from 'react';
import { useTranslation } from '@/localization';

export default function UpdatePasswordForm({ className = '' }) {
    const { t } = useTranslation();
    const currentPasswordInput = useRef();

    const {
        data,
        setData,
        errors,
        put,
        reset,
        processing,
        recentlySuccessful,
    } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const updatePassword = (e) => {
        e.preventDefault();

        put(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: (errors) => {
                if (errors.password) {
                    reset('password', 'password_confirmation');
                    document.getElementById('password')?.focus();
                }

                if (errors.current_password) {
                    reset('current_password');
                    currentPasswordInput.current.focus();
                }
            },
        });
    };

    return (
        <section className={className}>
            <header>
                <h2 className="text-lg font-medium text-gray-900 dark:text-slate-100">
                    {t('Update Password')}
                </h2>

                <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
                    {t('Ensure your account is using a long, random password to stay secure.')}
                </p>
            </header>

            <form onSubmit={updatePassword} className="mt-6 space-y-6">
                <div>
                    <InputLabel
                        htmlFor="current_password"
                        value={t('Current Password')}
                    />

                    <TextInput
                        id="current_password"
                        ref={currentPasswordInput}
                        value={data.current_password}
                        onChange={(e) =>
                            setData('current_password', e.target.value)
                        }
                        type="password"
                        className="mt-1 block w-full"
                        autoComplete="current-password"
                    />

                    <InputError
                        message={errors.current_password}
                        className="mt-2"
                    />
                </div>

                <StrongPasswordFields
                    password={data.password}
                    confirmation={data.password_confirmation}
                    onPasswordChange={(value) => setData('password', value)}
                    onConfirmationChange={(value) => setData('password_confirmation', value)}
                    errors={errors}
                    columns
                />

                <div className="flex items-center gap-4">
                    <PrimaryButton disabled={processing || data.current_password === '' || !passwordReady(data.password, data.password_confirmation)}>{t('Save')}</PrimaryButton>

                    <Transition
                        show={recentlySuccessful}
                        enter="transition ease-in-out"
                        enterFrom="opacity-0"
                        leave="transition ease-in-out"
                        leaveTo="opacity-0"
                    >
                        <p className="text-sm text-gray-600 dark:text-slate-300">
                            {t('Saved.')}
                        </p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}
