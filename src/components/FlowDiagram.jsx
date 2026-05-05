import { Camera, Mail, FileUp, Sparkles, FolderOpen, Users, ChevronRight, ChevronDown } from 'lucide-react'

const STEPS = {
  en: [
    {
      id: 'capture',
      label: 'Capture',
      color: 'bg-slate-50 border-slate-200',
      iconColor: 'text-slate-500',
      items: [
        { Icon: Camera, text: 'Photo or scan' },
        { Icon: Mail,   text: 'Email forward' },
        { Icon: FileUp, text: 'PDF or file' },
      ],
    },
    {
      id: 'recu',
      label: 'Récu',
      color: 'bg-primary border-primary/30',
      iconColor: 'text-white/80',
      labelColor: 'text-white font-bold',
      highlight: true,
      badge: { Icon: Sparkles, text: 'AI' },
      items: [
        { text: 'Vendor & date' },
        { text: 'Subtotal, taxes, total' },
        { text: 'Account & category' },
      ],
    },
    {
      id: 'drive',
      label: 'Your Drive',
      color: 'bg-indigo-50 border-indigo-200',
      iconColor: 'text-indigo-500',
      items: [
        { Icon: FolderOpen, text: 'Per-account folders' },
        { Icon: Users,      text: 'Share with team' },
        { Icon: FileUp,     text: 'Export to XLSX' },
      ],
    },
  ],
  fr: [
    {
      id: 'capture',
      label: 'Capturer',
      color: 'bg-slate-50 border-slate-200',
      iconColor: 'text-slate-500',
      items: [
        { Icon: Camera, text: 'Photo ou scan' },
        { Icon: Mail,   text: 'Transfert courriel' },
        { Icon: FileUp, text: 'PDF ou fichier' },
      ],
    },
    {
      id: 'recu',
      label: 'Récu',
      color: 'bg-primary border-primary/30',
      iconColor: 'text-white/80',
      labelColor: 'text-white font-bold',
      highlight: true,
      badge: { Icon: Sparkles, text: 'IA' },
      items: [
        { text: 'Fournisseur & date' },
        { text: 'Sous-total, taxes, total' },
        { text: 'Compte & catégorie' },
      ],
    },
    {
      id: 'drive',
      label: 'Votre Drive',
      color: 'bg-indigo-50 border-indigo-200',
      iconColor: 'text-indigo-500',
      items: [
        { Icon: FolderOpen, text: 'Dossiers par compte' },
        { Icon: Users,      text: 'Partager avec l\'équipe' },
        { Icon: FileUp,     text: 'Exporter en XLSX' },
      ],
    },
  ],
}

export default function FlowDiagram({ lang = 'en' }) {
  const steps = STEPS[lang] ?? STEPS.en

  return (
    <div className="w-full">
      {/* Desktop: horizontal row */}
      <div className="hidden sm:flex items-stretch gap-0">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center flex-1 min-w-0">
            <StepCard step={step} />
            {i < steps.length - 1 && (
              <div className="flex-shrink-0 px-1">
                <ChevronRight size={20} className="text-muted" strokeWidth={1.5} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile: vertical stack */}
      <div className="flex flex-col gap-0 sm:hidden">
        {steps.map((step, i) => (
          <div key={step.id} className="flex flex-col items-stretch">
            <StepCard step={step} />
            {i < steps.length - 1 && (
              <div className="flex justify-center py-1">
                <ChevronDown size={20} className="text-muted" strokeWidth={1.5} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StepCard({ step }) {
  return (
    <div className={`flex-1 rounded-[10px] border p-3.5 ${step.color}`}>
      <div className="flex items-center gap-2 mb-2.5">
        <p className={`text-sm font-semibold ${step.highlight ? 'text-white' : 'text-[#1A1A18]'}`}>
          {step.label}
        </p>
        {step.badge && (
          <span className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${step.highlight ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
            <step.badge.Icon size={9} />
            {step.badge.text}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {step.items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {item.Icon ? (
              <item.Icon size={12} className={step.iconColor} strokeWidth={1.8} />
            ) : (
              <div className={`w-1 h-1 rounded-full flex-shrink-0 ${step.highlight ? 'bg-white/60' : 'bg-muted'}`} />
            )}
            <span className={`text-xs leading-snug ${step.highlight ? 'text-white/90' : 'text-muted'}`}>
              {item.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
