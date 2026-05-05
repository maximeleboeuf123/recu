import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import LanguageToggle from '../components/LanguageToggle'
import FlowDiagram from '../components/FlowDiagram'
import { Sparkles, HardDrive, Mail, FileSpreadsheet, Shield, Lock } from 'lucide-react'

const FEATURES = [
  {
    icon: Sparkles,
    title: { en: 'AI Extraction', fr: 'Extraction IA' },
    body: {
      en: 'Photo or PDF → vendor, date, amounts, and taxes extracted automatically in ~60 seconds.',
      fr: 'Photo ou PDF → fournisseur, date, montants et taxes extraits automatiquement en ~60 secondes.',
    },
  },
  {
    icon: HardDrive,
    title: { en: 'Your Google Drive', fr: 'Votre Google Drive' },
    body: {
      en: 'Receipts are filed automatically in your own Drive by account, year, and category. Récu never stores your files.',
      fr: 'Reçus classés automatiquement dans votre Drive par compte, année et catégorie. Récu ne stocke jamais vos fichiers.',
    },
  },
  {
    icon: Mail,
    title: { en: 'Email Forwarding', fr: 'Transfert courriel' },
    body: {
      en: 'Forward invoices to your Récu inbox. Extracted and filed automatically — no manual entry.',
      fr: 'Transférez des factures à votre boîte Récu. Extraites et classées automatiquement.',
    },
  },
  {
    icon: FileSpreadsheet,
    title: { en: 'Accountant Export', fr: 'Export comptable' },
    body: {
      en: 'One-click XLSX with a full transaction list and summary by account & category.',
      fr: 'XLSX en un clic avec liste complète et résumé par compte et catégorie.',
    },
  },
]

export default function LandingPage() {
  const { i18n } = useTranslation()
  const { signInWithGoogle } = useAuth()
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en'

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
        <span className="text-primary font-bold text-xl font-serif tracking-tight">Récu</span>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <button
            onClick={signInWithGoogle}
            className="px-4 py-1.5 text-sm font-medium bg-primary text-white rounded-[6px] hover:bg-[#153255] transition-colors active:scale-[0.98]"
          >
            {lang === 'fr' ? 'Se connecter' : 'Sign in'}
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-14 text-center">
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-md mb-6">
          <span className="text-white text-3xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>R</span>
        </div>

        <h1 className="text-3xl font-bold text-[#1A1A18] tracking-tight leading-tight max-w-sm">
          {lang === 'fr'
            ? 'Fini les reçus éparpillés. Tout organisé, classé, prêt pour les impôts.'
            : 'Stop losing receipts. Get everything organized, filed, and ready for tax time.'}
        </h1>
        <p className="text-muted mt-3 leading-relaxed max-w-sm text-sm">
          {lang === 'fr'
            ? "Pour les particuliers, couples, travailleurs autonomes et petites entreprises qui veulent leurs reçus organisés, conservés et compilés dans leur propre Google Drive."
            : 'For individuals, couples, freelancers, and small businesses who want their receipts organized, stored, tracked, and compiled — in their own Google Drive.'}
        </p>

        <button
          onClick={signInWithGoogle}
          className="mt-8 flex items-center justify-center gap-3 bg-primary text-white rounded-[8px] px-6 py-3 font-medium text-sm hover:bg-[#153255] active:scale-[0.98] transition-all shadow-sm"
        >
          <GoogleColorIcon />
          {lang === 'fr' ? 'Continuer avec Google' : 'Continue with Google'}
        </button>
        <p className="text-xs text-muted mt-2">
          {lang === 'fr' ? 'Gratuit · Aucune carte de crédit' : 'Free · No credit card required'}
        </p>
      </main>

      {/* Flow diagram */}
      <section className="px-4 pt-2 pb-4 max-w-lg mx-auto w-full">
        <p className="text-xs text-muted uppercase tracking-wide font-medium text-center mb-3">
          {lang === 'fr' ? 'Comment ça marche' : 'How it works'}
        </p>
        <FlowDiagram lang={lang} />
      </section>

      {/* Features */}
      <section className="px-4 pb-10 max-w-lg mx-auto w-full space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title.en} className="bg-surface border border-border rounded-[10px] p-4">
              <Icon size={16} className="text-primary mb-2" strokeWidth={1.8} />
              <p className="text-sm font-semibold text-[#1A1A18] mb-1">{title[lang]}</p>
              <p className="text-xs text-muted leading-snug">{body[lang]}</p>
            </div>
          ))}
        </div>

        {/* Privacy callout */}
        <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-[10px] px-4 py-3.5">
          <Shield size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-indigo-700">
              {lang === 'fr' ? 'Vos fichiers restent dans VOTRE Drive' : 'Your files stay in YOUR Drive'}
            </p>
            <p className="text-xs text-indigo-500 mt-0.5 leading-snug">
              {lang === 'fr'
                ? "Récu ne stocke que les métadonnées — fournisseur, montants, dates. Vos reçus vivent dans votre Google Drive, inclus gratuit avec Gmail."
                : 'Récu stores only metadata — vendor, amounts, dates. Your receipts live in your Google Drive, free with Gmail.'}
            </p>
          </div>
        </div>

        {/* Canadian tax note */}
        <div className="flex items-start gap-3 bg-surface border border-border rounded-[10px] px-4 py-3.5">
          <Lock size={16} className="text-muted flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#1A1A18]">
              {lang === 'fr' ? 'Conçu pour la fiscalité canadienne' : 'Built for Canadian tax'}
            </p>
            <p className="text-xs text-muted mt-0.5 leading-snug">
              {lang === 'fr'
                ? 'TPS / TVQ / HST extraits automatiquement. Numéros de fournisseur (TPS, TVQ) capturés pour vos crédits de taxe. Conservation 6 ans via Drive.'
                : 'GST / QST / HST extracted automatically. Vendor tax numbers captured for ITCs. 6-year CRA retention via Drive.'}
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-4 flex items-center justify-center gap-4 text-xs text-muted bg-surface">
        <a href="/terms" className="hover:text-primary transition-colors">
          {lang === 'fr' ? 'Conditions' : 'Terms'}
        </a>
        <span>·</span>
        <a href="/privacy" className="hover:text-primary transition-colors">
          {lang === 'fr' ? 'Confidentialité' : 'Privacy'}
        </a>
        <span>·</span>
        <a href="mailto:hello@monrecu.app" className="hover:text-primary transition-colors">
          hello@monrecu.app
        </a>
      </footer>
    </div>
  )
}

function GoogleColorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9z" />
    </svg>
  )
}
