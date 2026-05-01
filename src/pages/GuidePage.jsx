import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Camera, Sparkles, CheckSquare, LayoutGrid, FileSpreadsheet, Receipt, Lightbulb, ScanLine, ChevronRight } from 'lucide-react'

const STEPS = {
  en: [
    {
      icon: Camera,
      color: 'bg-blue-50 text-blue-600',
      title: 'Capture your receipts',
      body: 'Take a photo directly from the app, or upload PDF and image files. Multi-page receipts are supported — just add pages and Récu treats them as one receipt. You can also drag and drop files on desktop.',
    },
    {
      icon: Sparkles,
      color: 'bg-violet-50 text-violet-600',
      title: 'AI reads it for you',
      body: 'Claude AI extracts the vendor, date, invoice number, amounts, and taxes automatically. Processing takes about 60 seconds. Low-confidence fields are flagged so you know what to double-check.',
    },
    {
      icon: CheckSquare,
      color: 'bg-green-50 text-green-600',
      title: 'Review & confirm',
      body: 'Open the Review tab to see receipts waiting for approval. Tap any field to edit it inline. When everything looks good, confirm — the receipt moves to your ledger. Swipe right to confirm quickly, or left to skip for later.',
    },
    {
      icon: LayoutGrid,
      color: 'bg-amber-50 text-amber-600',
      title: 'Organize by account',
      body: 'Assign an Account and Category to each receipt to match your tax filing (T2125 self-employed, T776 rental, or your own custom structure). Set these up in Settings → Dimensions. Récu learns your vendors and pre-fills them automatically.',
    },
    {
      icon: Receipt,
      color: 'bg-orange-50 text-orange-600',
      title: 'Taxes',
      body: 'When taxes appear on the receipt, they\'re extracted automatically. When they don\'t (some vendors don\'t charge taxes), open the receipt and check "Calculate taxes" to apply TPS 5% + TVQ 9.975% based on the subtotal. Always verify before filing.',
    },
    {
      icon: FileSpreadsheet,
      color: 'bg-emerald-50 text-emerald-600',
      title: 'Export to Google Drive',
      body: 'Connect Google Drive in Settings. Then go to Ledger → Export to download your full ledger — or a filtered view by date, account, or category — as XLSX or CSV. Files land in your Récu/_Exports folder. Existing files are overwritten so your export stays fresh.',
    },
  ],
  fr: [
    {
      icon: Camera,
      color: 'bg-blue-50 text-blue-600',
      title: 'Capturez vos reçus',
      body: 'Prenez une photo directement dans l\'app, ou téléversez des fichiers PDF ou image. Les reçus de plusieurs pages sont supportés — ajoutez les pages et Récu les traite comme un seul reçu. Vous pouvez aussi glisser-déposer des fichiers sur ordinateur.',
    },
    {
      icon: Sparkles,
      color: 'bg-violet-50 text-violet-600',
      title: 'L\'IA lit le reçu pour vous',
      body: 'L\'IA Claude extrait automatiquement le fournisseur, la date, le numéro de facture, les montants et les taxes. Le traitement prend environ 60 secondes. Les champs à faible confiance sont signalés pour que vous sachiez quoi vérifier.',
    },
    {
      icon: CheckSquare,
      color: 'bg-green-50 text-green-600',
      title: 'Révisez et confirmez',
      body: 'Ouvrez l\'onglet Révision pour voir les reçus en attente. Touchez n\'importe quel champ pour le modifier. Quand tout est correct, confirmez — le reçu rejoint votre grand livre. Glissez à droite pour confirmer rapidement, ou à gauche pour remettre à plus tard.',
    },
    {
      icon: LayoutGrid,
      color: 'bg-amber-50 text-amber-600',
      title: 'Organisez par compte',
      body: 'Assignez un Compte et une Catégorie à chaque reçu pour correspondre à votre déclaration (T2125 travailleur autonome, T776 bien locatif, ou votre propre structure). Configurez dans Paramètres → Dimensions. Récu apprend vos fournisseurs et les pré-remplit automatiquement.',
    },
    {
      icon: Receipt,
      color: 'bg-orange-50 text-orange-600',
      title: 'Taxes',
      body: 'Quand les taxes apparaissent sur le reçu, elles sont extraites automatiquement. Si elles n\'y figurent pas (certains fournisseurs ne facturent pas de taxes), ouvrez le reçu et cochez « Calculer les taxes » pour appliquer TPS 5% + TVQ 9,975% sur le sous-total. Vérifiez toujours avant de déclarer.',
    },
    {
      icon: FileSpreadsheet,
      color: 'bg-emerald-50 text-emerald-600',
      title: 'Exporter vers Google Drive',
      body: 'Connectez Google Drive dans Paramètres. Ensuite, allez dans Grand livre → Exporter pour télécharger votre grand livre complet — ou une vue filtrée par date, compte ou catégorie — en XLSX ou CSV. Les fichiers atterrissent dans votre dossier Récu/_Exports. Les fichiers existants sont remplacés pour que votre export reste à jour.',
    },
  ],
}

const TIPS = {
  en: [
    { icon: '🇨🇦', text: 'TPS / GST = 5% federal tax on most goods and services in Canada.' },
    { icon: '🏙️', text: 'TVQ / QST = 9.975% Quebec provincial tax, calculated on the pre-tax amount.' },
    { icon: '🔗', text: 'HST = Combined 13–15% tax used in Ontario, BC, and other provinces instead of GST+PST.' },
    { icon: '⚠️', text: 'Not all vendors charge taxes (small suppliers, certain services). Never calculate taxes automatically for those.' },
    { icon: '📧', text: 'You can forward invoices by email to your Récu inbox address — find it in Settings.' },
  ],
  fr: [
    { icon: '🇨🇦', text: 'TPS / GST = Taxe fédérale de 5 % sur la plupart des biens et services au Canada.' },
    { icon: '🏙️', text: 'TVQ / QST = Taxe provinciale québécoise de 9,975 %, calculée sur le montant avant taxes.' },
    { icon: '🔗', text: 'HST = Taxe combinée de 13–15 % utilisée en Ontario, C.-B. et d\'autres provinces au lieu de TPS+TVP.' },
    { icon: '⚠️', text: 'Tous les fournisseurs ne chargent pas de taxes (petits fournisseurs, certains services). Ne calculez jamais automatiquement les taxes pour ceux-là.' },
    { icon: '📧', text: 'Vous pouvez transférer des factures par courriel à votre adresse Récu — trouvez-la dans Paramètres.' },
  ],
}

export default function GuidePage() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const steps = STEPS[lang]
  const tips = TIPS[lang]

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-28 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/settings"
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-border/30 transition-colors"
        >
          <ArrowLeft size={18} className="text-muted" />
        </Link>
        <h1 className="text-xl font-bold text-[#1A1A18]">
          {lang === 'en' ? 'How it works' : 'Comment ça marche'}
        </h1>
      </div>

      {/* Hero */}
      <div className="rounded-[12px] bg-primary p-6 text-white text-center space-y-2">
        <div className="flex items-center justify-center w-14 h-14 bg-white/20 rounded-[12px] mx-auto mb-3">
          <ScanLine size={28} strokeWidth={1.8} />
        </div>
        <h2 className="text-2xl font-bold">Récu</h2>
        <p className="text-white/80 text-sm leading-snug">
          {lang === 'en'
            ? 'Your receipts, finally organized — captured, extracted, categorized, and exported.'
            : 'Vos reçus, enfin en ordre — capturés, extraits, catégorisés et exportés.'}
        </p>
      </div>

      {/* Steps */}
      <section className="space-y-3">
        <p className="text-xs text-muted uppercase tracking-wide font-medium">
          {lang === 'en' ? 'Getting started' : 'Pour commencer'}
        </p>
        {steps.map((step, i) => (
          <StepCard key={i} step={step} index={i + 1} />
        ))}
      </section>

      {/* Tax tips */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb size={14} className="text-amber-500" />
          <p className="text-xs text-muted uppercase tracking-wide font-medium">
            {lang === 'en' ? 'Good to know' : 'Bon à savoir'}
          </p>
        </div>
        <div className="bg-surface border border-border rounded-[8px] divide-y divide-border">
          {tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <span className="text-base flex-shrink-0 leading-none mt-0.5">{tip.icon}</span>
              <p className="text-sm text-[#1A1A18] leading-snug">{tip.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <Link
        to="/"
        className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-white rounded-[8px] font-medium text-sm active:scale-[0.98] transition-transform"
      >
        {lang === 'en' ? 'Start capturing receipts' : 'Commencer à capturer des reçus'}
        <ChevronRight size={16} />
      </Link>
    </div>
  )
}

function StepCard({ step, index }) {
  const { icon: Icon, color, title, body } = step
  return (
    <div className="bg-surface border border-border rounded-[8px] p-4 flex gap-3">
      <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
        <div className={`w-9 h-9 rounded-[8px] flex items-center justify-center ${color}`}>
          <Icon size={18} strokeWidth={1.8} />
        </div>
        <span className="text-[10px] font-bold text-muted/60">{index}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1A1A18] mb-1">{title}</p>
        <p className="text-xs text-muted leading-relaxed">{body}</p>
      </div>
    </div>
  )
}
