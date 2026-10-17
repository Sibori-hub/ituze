import RwandaFlag from '@/Components/RwandaFlag';
import VerificationDialog, { DevCodeButton } from '@/Components/VerificationDialog';
import { MessageCircle } from 'lucide-react';
import { displayPhone } from '@/lib/rwanda';
import { useTranslation } from '@/localization';

export default function VerifyPhone({ phone, status, expiresIn, devMode, devOtp }) {
    const { t } = useTranslation();

    return (
        <VerificationDialog
            pageTitle={t('Verify Your Phone')}
            title={t('Check your WhatsApp')}
            description={t("We've sent a 6-digit code on WhatsApp to")}
            destination={
                <span className="inline-flex items-center gap-2">
                    <RwandaFlag className="h-3.5 w-5" />
                    {displayPhone(phone)}
                </span>
            }
            Icon={MessageCircle}
            steps={[
                { label: t('Account'), state: 'done' },
                { label: t('Email'), state: 'done' },
                { label: 'WhatsApp', state: 'current' },
            ]}
            verifyRoute={route('phone.verify')}
            resendRoute={route('phone.send')}
            submitLabel={t('Verify number')}
            statusMessage={status ? t(status) : null}
            expiresIn={expiresIn}
            tip={t('The message comes from our WhatsApp business account. Make sure WhatsApp is open on this number.')}
            devPanel={
                devMode
                    ? (verify) => (
                          <>
                              <p className="text-xs leading-5">
                                  {t('WhatsApp is not configured locally, so the code is written to the Laravel log and shown here.')}
                              </p>
                              <DevCodeButton code={devOtp} onUse={verify} />
                          </>
                      )
                    : null
            }
        />
    );
}
