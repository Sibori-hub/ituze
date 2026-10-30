import InputError from '@/Components/InputError';
import { Transition } from '@headlessui/react';
import { useForm, usePage } from '@inertiajs/react';
import { Smartphone } from 'lucide-react';
import { useTranslation } from '@/localization';

/** The owner's own MoMo Pay code: tenants pay their first rent and deposit there. */
export default function OwnerMomoPayForm({ className = '' }) {
    const { t } = useTranslation();
    const user = usePage().props.auth.user;
    const { data, setData, patch, errors, processing, recentlySuccessful } = useForm({
        momo_pay_code: user.momo_pay_code || '',
        momo_pay_name: user.momo_pay_name || '',
    });
    const fieldClass = (invalid) => `mt-1.5 w-full rounded-xl border px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 ${invalid ? 'border-red-400 focus:ring-red-500/20' : 'border-gray-300 dark:border-slate-600 focus:border-[#0E3B2E] focus:ring-[#0E3B2E]/15'}`;

    const submit = (event) => {
        event.preventDefault();
        patch(route('profile.momo-pay'), { preserveScroll: true });
    };

    return (
        <section className={className}>
            <header className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#FFCC00]/25 text-gray-900 dark:text-slate-100" aria-hidden="true"><Smartphone size={20} /></span>
                <div>
                    <h2 className="text-lg font-medium text-gray-900 dark:text-slate-100">{t('Receive rent with MoMo Pay')}</h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{t('Tenants pay their first rent and deposit to this code. The money comes straight to you.')}</p>
                </div>
            </header>

            <form onSubmit={submit} className="mt-6 space-y-4">
                <label className="block text-sm font-medium text-gray-800 dark:text-slate-100">
                    {t('Your MoMo Pay code')}
                    <input value={data.momo_pay_code} onChange={(event) => setData('momo_pay_code', event.target.value.replace(/[^\d\s]/g, ''))} inputMode="numeric" placeholder="123456"
                        className={`${fieldClass(errors.momo_pay_code)} font-mono tracking-wide`} aria-describedby="momo-pay-code-help" />
                    <span id="momo-pay-code-help" className="mt-1 block text-xs font-normal text-gray-500 dark:text-slate-400">{t('Tenants dial *182*8*1*code# to pay you.')}</span>
                    <InputError className="mt-1" message={errors.momo_pay_code && t(errors.momo_pay_code)} />
                </label>
                <label className="block text-sm font-medium text-gray-800 dark:text-slate-100">
                    {t('Name shown when paying')}
                    <input value={data.momo_pay_name} onChange={(event) => setData('momo_pay_name', event.target.value)} maxLength={120} placeholder={t('e.g. KAMANZI JEAN')}
                        className={fieldClass(errors.momo_pay_name)} />
                    <InputError className="mt-1" message={errors.momo_pay_name && t(errors.momo_pay_name)} />
                </label>
                <div className="flex items-center gap-4">
                    <button disabled={processing} className="rounded-xl bg-[#0E3B2E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#124B3A] disabled:opacity-60">{t('Save')}</button>
                    <Transition show={recentlySuccessful} enter="transition ease-in-out" enterFrom="opacity-0" leave="transition ease-in-out" leaveTo="opacity-0">
                        <p className="text-sm text-green-700 dark:text-green-300">{t('Saved.')}</p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}
