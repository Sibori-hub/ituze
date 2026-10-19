import { reportClientError } from '@/lib/reportClientError';
import { Component } from 'react';

/**
 * Shows a calm message with a reload button instead of a blank page when a
 * screen fails unexpectedly. Plain text in three languages, since translations
 * may be what failed.
 */
export default class AppErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('Screen failed to render', error, info?.componentStack);
        reportClientError(error, { source: 'react', component_stack: info?.componentStack || '' });
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div role="alert" className="flex min-h-screen items-center justify-center bg-[#F4F6F5] p-6 font-[Inter]">
                <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl ring-1 ring-gray-100">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0E3B2E] text-2xl text-white" aria-hidden="true">!</div>
                    <h1 className="mt-5 font-[Sora] text-xl font-bold text-gray-900">Something went wrong</h1>
                    <p className="mt-2 text-sm text-gray-600">
                        This page could not be shown. Reloading usually fixes it.
                        <br />
                        <span lang="fr">Rechargez la page.</span> · <span lang="rw">Ongera ufungure urupapuro.</span>
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#0E3B2E] px-6 py-3 text-sm font-semibold text-white hover:bg-[#124B3A]"
                    >
                        Reload the page
                    </button>
                </div>
            </div>
        );
    }
}
