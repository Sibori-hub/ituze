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
            title={t('Check your SMS')}
            description={t("We've sent a 6-digit code by SMS to")}
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
                { label: t('Phone'), state: 'current' },
            ]}
            verifyRoute={route('phone.verify')}
            resendRoute={route('phone.send')}
            submitLabel={t('Verify number')}
            statusMessage={status ? t(status) : null}
            expiresIn={expiresIn}
            tip={t('The SMS comes from ITUZE and can take up to a minute to arrive.')}
            devPanel={
                devMode
                    ? (verify) => (
                          <>
                              <p className="text-xs leading-5">
                                  {t('SMS is not configured locally, so the code is written to the Laravel log and shown here.')}
                              </p>
                              <DevCodeButton code={devOtp} onUse={verify} />
                          </>
                      )
                    : null
            }
        />
    );
}
