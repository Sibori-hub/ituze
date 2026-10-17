import BrandLockup from '@/Components/BrandLockup';
import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

function Section({ index, section }) {
    return (
        <section className="mt-8">
            <h2 className="font-[Sora] text-lg font-semibold text-[#0E3B2E]">
                {index}. {section.heading}
            </h2>

            {(section.body || []).map((paragraph) => (
                <p key={paragraph} className="mt-3 text-sm leading-7 text-gray-600">
                    {paragraph}
                </p>
            ))}

            {section.list && (
                <ul className="mt-3 space-y-2">
                    {section.list.map((item) => (
                        <li key={item} className="flex gap-3 text-sm leading-7 text-gray-600">
                            <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d9a441]" aria-hidden="true" />
                            <span>{item}</span>
                        </li>
                    ))}
                </ul>
            )}

            {(section.after || []).map((paragraph) => (
                <p key={paragraph} className="mt-3 text-sm leading-7 text-gray-600">
                    {paragraph}
                </p>
            ))}
        </section>
    );
}

export default function LegalDocument({ title, updatedAt, version, sections, children }) {
    return (
        <div className="min-h-screen bg-[#EAF2EE] font-[Inter] px-4 py-8 sm:py-12">
            <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl shadow-[#0E3B2E]/5 ring-1 ring-black/5">
                <header className="border-b border-black/5 bg-[#0E3B2E] px-6 py-7 sm:px-10">
                    <Link href="/" className="w-fit rounded-xl">
                        <BrandLockup
                            logoClassName="h-12 w-12"
                            nameClassName="text-sm font-bold text-white"
                            subtitleClassName="text-[9px] font-medium text-white/70"
                        />
                    </Link>
                    <h1 className="mt-5 font-[Sora] text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                        {title}
                    </h1>
                    <p className="mt-2 text-xs text-white/60">
                        Last updated: {updatedAt} · Version {version}
                    </p>
                </header>

                <div className="px-6 py-8 sm:px-10">
                    {sections.map((section, i) => (
                        <Section key={section.heading} index={i + 1} section={section} />
                    ))}

                    {children}

                    <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-black/5 pt-6">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 rounded-lg bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0b2f24]"
                        >
                            <ArrowLeft size={16} aria-hidden="true" />
                            Back to Ituze
                        </Link>
                        <Link href={route('login')} className="text-sm font-semibold text-[#0E3B2E] underline">
                            Login
                        </Link>
                        <Link href={route('register')} className="text-sm font-semibold text-[#0E3B2E] underline">
                            Create an account
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
