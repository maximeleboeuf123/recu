import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const CONTENT = {
  fr: {
    title: 'Politique de confidentialité',
    updated: 'Dernière mise à jour : 30 avril 2026',
    sections: [
      {
        heading: '1. Informations que nous collectons',
        body: 'Nous collectons les informations que vous nous fournissez directement, notamment votre adresse courriel lors de la connexion via Google, les images et fichiers de reçus que vous soumettez, ainsi que les données extraites de ces reçus (fournisseur, montants, dates, numéros de taxes).',
      },
      {
        heading: '2. Utilisation des informations',
        body: 'Vos données sont utilisées exclusivement pour fournir le service Récu : extraction des données de reçus via l\'IA, organisation dans Google Drive, et génération de rapports. Nous ne vendons ni ne partageons vos données avec des tiers à des fins publicitaires.',
      },
      {
        heading: '3. Stockage et sécurité',
        body: 'Vos données sont stockées de manière sécurisée dans l\'infrastructure Supabase (PostgreSQL chiffré) et Google Drive. Les communications sont chiffrées via HTTPS/TLS. Nous appliquons le principe du moindre privilège pour l\'accès aux données.',
      },
      {
        heading: '4. Vos droits (Loi 25 / LPRPDE)',
        body: 'Conformément à la Loi 25 du Québec et à la Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE), vous avez le droit d\'accéder à vos données, de les corriger, de les supprimer, et de retirer votre consentement en tout temps. Pour exercer ces droits, contactez-nous à privacy@recu.app.',
      },
      {
        heading: '5. Cookies et stockage local',
        body: 'Nous utilisons le stockage local (localStorage) uniquement pour retenir votre préférence de langue et votre session d\'authentification. Aucun cookie tiers n\'est utilisé.',
      },
      {
        heading: '6. Contact',
        body: 'Pour toute question relative à la confidentialité, contactez-nous à privacy@recu.app.',
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: April 30, 2026',
    sections: [
      {
        heading: '1. Information We Collect',
        body: 'We collect information you provide directly, including your email address when signing in via Google, receipt images and files you submit, and data extracted from those receipts (vendor, amounts, dates, tax numbers).',
      },
      {
        heading: '2. How We Use Your Information',
        body: 'Your data is used exclusively to provide the Récu service: AI-powered receipt data extraction, Google Drive organization, and report generation. We do not sell or share your data with third parties for advertising purposes.',
      },
      {
        heading: '3. Storage and Security',
        body: 'Your data is stored securely in Supabase infrastructure (encrypted PostgreSQL) and Google Drive. All communications are encrypted via HTTPS/TLS. We apply the principle of least privilege for data access.',
      },
      {
        heading: '4. Your Rights (PIPEDA / Quebec Law 25)',
        body: 'Under Canada\'s Personal Information Protection and Electronic Documents Act (PIPEDA) and Quebec Law 25, you have the right to access, correct, delete your data, and withdraw consent at any time. To exercise these rights, contact us at privacy@recu.app.',
      },
      {
        heading: '5. Cookies and Local Storage',
        body: 'We use localStorage only to remember your language preference and authentication session. No third-party cookies are used.',
      },
      {
        heading: '6. Contact',
        body: 'For any privacy-related questions, contact us at privacy@recu.app.',
      },
    ],
  },
}

export default function PrivacyPage() {
  const { i18n } = useTranslation()
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en'
  const c = CONTENT[lang]

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        to="/settings"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        {lang === 'fr' ? 'Retour' : 'Back'}
      </Link>

      <h1 className="text-2xl font-bold text-[#1A1A18] mb-1">{c.title}</h1>
      <p className="text-sm text-muted mb-8">{c.updated}</p>

      <div className="space-y-6">
        {c.sections.map((s) => (
          <div key={s.heading}>
            <h2 className="font-semibold text-[#1A1A18] mb-2">{s.heading}</h2>
            <p className="text-sm text-[#1A1A18] leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
