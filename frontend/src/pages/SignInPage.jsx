import { SignIn } from '@clerk/clerk-react';

const clerkDark = {
    variables: {
        colorPrimary: '#6366f1',
        colorBackground: '#13131a',
        colorText: '#f1f5f9',
        colorTextSecondary: '#94a3b8',
        colorInputBackground: '#1e1e2e',
        colorInputText: '#f1f5f9',
        colorNeutral: '#334155',
        borderRadius: '0.75rem',
        fontFamily: 'Inter, ui-sans-serif, system-ui',
        fontSize: '0.9rem',
    },
    elements: {
        rootBox: 'w-full',
        card: 'bg-[#13131a] border border-white/[0.07] shadow-2xl',
        headerTitle: 'text-white font-bold',
        headerSubtitle: 'text-slate-400',
        socialButtonsBlockButton: 'bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10',
        formFieldLabel: 'text-slate-300 text-sm',
        formFieldInput: 'bg-[#1e1e2e] border-white/10 text-slate-100 placeholder:text-slate-600',
        formButtonPrimary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20',
        footerActionLink: 'text-indigo-400 hover:text-indigo-300',
        identityPreviewText: 'text-slate-300',
        identityPreviewEditButton: 'text-indigo-400',
        dividerLine: 'bg-white/10',
        dividerText: 'text-slate-600',
    },
};

export default function SignInPage() {
    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', padding: '1rem' }}>
            {/* Brand header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                    📦
                </div>
                <span style={{ color: 'white', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.025em', fontFamily: 'Inter, ui-sans-serif' }}>
                    Inventory Optimizer
                </span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '-0.5rem', fontFamily: 'Inter, ui-sans-serif' }}>
                Sign in to manage your resale inventory
            </p>
            <SignIn
                path="/sign-in"
                routing="path"
                signUpUrl="/sign-up"
                afterSignInUrl="/"
                appearance={clerkDark}
            />
        </div>
    );
}
