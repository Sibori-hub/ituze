import LegalDocument from '@/Components/LegalDocument';
import { Head } from '@inertiajs/react';
import { termsSections } from './legalContent';

export default function Terms({ version, updatedAt, company }) {
    return (
        <>
            <Head title="Terms and Conditions" />

            <LegalDocument
                title="Terms and Conditions"
                version={version}
                updatedAt={updatedAt}
                sections={termsSections}
            >
                <section className="mt-8">
                    <h2 className="font-[Sora] text-lg font-semibold text-[#0E3B2E]">
                        {termsSections.length + 1}. Contact
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
