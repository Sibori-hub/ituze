import LegalDocument from '@/Components/LegalDocument';
import { Head } from '@inertiajs/react';
import { privacySections } from './legalContent';

export default function Privacy({ version, updatedAt, company }) {
    return (
        <>
            <Head title="Privacy Policy" />

            <LegalDocument
                title="Privacy Policy"
                version={version}
                updatedAt={updatedAt}
                sections={privacySections}
            >
                <section className="mt-8">
                    <h2 className="font-[Sora] text-lg font-semibold text-[#0E3B2E]">
                        {privacySections.length + 1}. Contact
                    </h2>
                    <div className="mt-3 space-y-1 text-sm leading-7 text-gray-600">
                        <p className="font-semibold text-[#0E3B2E]">{company.name}</p>
                        <p>Email: {company.email}</p>
                        <p>Phone: {company.phone}</p>
                        <p>Address: {company.address}</p>
                    </div>
                </section>
            </LegalDocument>
        </>
    );
}
