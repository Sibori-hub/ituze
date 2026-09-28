import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ConfirmActionModal from '@/Components/ConfirmActionModal';
import { Head, router, usePage } from '@inertiajs/react';
import { CheckCircle2, XCircle, IdCard, MapPin } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '@/localization';

export default function Approvals({ pendingUsers }) {
    const { t } = useTranslation();
    const { flash } = usePage().props;
    const [confirmAction, setConfirmAction] = useState(null); // { type: 'approve'|'reject', user }
    const [processing, setProcessing] = useState(false);

    const openConfirm = (type, user) => setConfirmAction({ type, user });
    const closeConfirm = () => {
        if (!processing) setConfirmAction(null);
    };

    const runAction = () => {
        if (!confirmAction) return;
        setProcessing(true);

        const routeName =
            confirmAction.type === 'approve'
                ? 'admin.approvals.approve'
                : 'admin.approvals.reject';

        router.post(
            route(routeName, confirmAction.user.id),
            confirmAction.type === 'approve' ? { payment_verified: true } : {},
            {
                onFinish: () => {
                    setProcessing(false);
                    setConfirmAction(null);
                },
            },
        );
    };

    return (
        <AuthenticatedLayout header="Approvals">
            <Head title={t('Approvals')} />

            {flash?.status && (
                <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">
                    {flash.status}
                </div>
            )}

            {pendingUsers.length === 0 ? (
                <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                    <p className="text-sm text-gray-500">
                        {t('No accounts waiting for approval right now.')}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {pendingUsers.map((user) => (
                        <div
                            key={user.id}
                            className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="flex items-center gap-4">
                                {user.profile_photo ? (
                                    <img
                                        src={`/storage/${user.profile_photo}`}
                                        alt={user.name}
                                        className="h-14 w-14 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0E3B2E]/10 font-[Sora] font-semibold text-[#0E3B2E]">
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-[Sora] font-semibold text-gray-800">{user.name}</p>
                                        <span className="rounded-full bg-[#D9A441]/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#8a651c]">
                                            {t(user.role)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        {user.email} · {user.phone}
                                    </p>
                                    <p className="mt-1 text-xs font-medium text-green-700">
                                        {t('Email verified · Profile complete')}
                                    </p>
                                    {user.address && (
                                        <p className="mt-1 text-xs text-gray-500">
                                            {t('Address')}: {user.address}
                                        </p>
                                    )}
                                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <IdCard size={13} />
                                            {t(user.identity_document_type === 'passport' ? 'Passport' : 'NIDA')}: {user.national_id}
                                        </span>
                                        {user.sector && (
                                            <span className="flex items-center gap-1">
                                                <MapPin size={13} />
                                                {user.sector.name},{' '}
                                                {user.sector.district?.name},{' '}
                                                {
                                                    user.sector.district
                                                        ?.province?.name
                                                }
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => openConfirm('approve', user)}
                                    className="flex items-center gap-1.5 rounded-lg bg-[#0E3B2E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0a2e23]"
                                >
                                    <CheckCircle2 size={16} />
                                    {t('Approve')}
                                </button>
                                <button
                                    onClick={() => openConfirm('reject', user)}
                                    className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                                >
                                    <XCircle size={16} />
                                    {t('Reject')}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmActionModal
                open={!!confirmAction}
                title={t(
                    confirmAction?.type === 'approve'
                        ? 'Approve this account?'
                        : 'Reject this account?',
                )}
                message={
                    confirmAction
                        ? confirmAction.type === 'approve'
                            ? t('Confirm that payment was verified outside the app. :name will then be approved, and their one-year subscription will start today.', { name: confirmAction.user.name })
                            : t(':name will not be able to access the dashboard. You can reconsider this later.', { name: confirmAction.user.name })
                        : ''
                }
                confirmLabel={
                    t(confirmAction?.type === 'approve' ? 'Yes, Approve' : 'Yes, Reject')
                }
                tone={confirmAction?.type === 'reject' ? 'danger' : 'default'}
                processing={processing}
                onConfirm={runAction}
                onCancel={closeConfirm}
            />
        </AuthenticatedLayout>
    );
}