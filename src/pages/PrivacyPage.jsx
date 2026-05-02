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
        body: 'Nous collectons les informations que vous nous fournissez directement : votre adresse courriel lors de la connexion via Google, les images et fichiers de reçus que vous soumettez, et les données extraites de ces reçus (fournisseur, montants, dates, numéros de taxes). Nous ne collectons aucune donnée de navigation ni de profilage comportemental.',
      },
      {
        heading: '2. Utilisation des informations',
        body: 'Vos données sont utilisées exclusivement pour fournir le service Récu : extraction des données de reçus, organisation dans Google Drive, et génération de rapports. Nous ne vendons pas vos données et ne les partageons pas avec des tiers à des fins publicitaires ou commerciales.',
      },
      {
        heading: '3. Accès à Google Drive — portée limitée',
        body: 'Lorsque vous connectez Google Drive, Récu utilise uniquement l\'autorisation « drive.file » de Google — la plus restrictive disponible. Cela signifie que Récu ne peut accéder, lire, modifier ou supprimer que les fichiers et dossiers qu\'il crée lui-même dans votre Drive. Il lui est techniquement impossible d\'accéder à vos documents personnels, photos ou tout autre fichier préexistant. Cette restriction est imposée par les serveurs de Google et ne dépend pas de notre code. Vous pouvez vérifier et révoquer cet accès à tout moment depuis myaccount.google.com/permissions.',
      },
      {
        heading: '4. Traitement par intelligence artificielle',
        body: 'Les images de reçus que vous soumettez peuvent être transmises à l\'API Claude d\'Anthropic (anthropic.com) à des fins d\'extraction de données. Les images sont traitées de façon transitoire et ne sont pas conservées par Anthropic au-delà du traitement immédiat. Aucune donnée n\'est utilisée pour entraîner des modèles d\'IA sans votre consentement explicite. Pour en savoir plus : anthropic.com/privacy.',
      },
      {
        heading: '5. Stockage et sécurité',
        body: 'Les données structurées (métadonnées de reçus, dimensions) sont stockées dans l\'infrastructure Supabase (PostgreSQL chiffré, hébergé sur AWS). Les fichiers joints sont stockés dans votre propre Google Drive — Récu n\'en conserve pas de copie sur ses serveurs. Toutes les communications sont chiffrées via HTTPS/TLS.',
      },
      {
        heading: '6. Conservation des données',
        body: 'Vos données sont conservées tant que votre compte est actif. Vous pouvez supprimer votre compte et toutes vos données associées à tout moment depuis les paramètres de l\'application. La déconnexion de Google Drive supprime uniquement l\'accès de Récu — vos fichiers dans Drive ne sont pas supprimés.',
      },
      {
        heading: '7. Vos droits (Loi 25 / LPRPDE)',
        body: 'Conformément à la Loi 25 du Québec et à la Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE), vous avez le droit d\'accéder à vos données, de les corriger, de les supprimer, et de retirer votre consentement en tout temps. Pour exercer ces droits, contactez-nous à privacy@recu.app.',
      },
      {
        heading: '8. Cookies et stockage local',
        body: 'Nous utilisons le stockage local (localStorage) uniquement pour retenir votre préférence de langue et votre session d\'authentification. Aucun cookie tiers, aucun pixel de suivi ni aucun outil d\'analyse externe n\'est utilisé.',
      },
      {
        heading: '9. Contact',
        body: 'Pour toute question relative à la confidentialité : privacy@recu.app.',
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: April 30, 2026',
    sections: [
      {
        heading: '1. Information We Collect',
        body: 'We collect information you provide directly: your email address when signing in via Google, receipt images and files you submit, and data extracted from those receipts (vendor, amounts, dates, tax numbers). We do not collect browsing data or build behavioural profiles.',
      },
      {
        heading: '2. How We Use Your Information',
        body: 'Your data is used exclusively to provide the Récu service: AI-powered receipt data extraction, Google Drive organisation, and report generation. We do not sell your data or share it with third parties for advertising or commercial purposes.',
      },
      {
        heading: '3. Google Drive Access — Limited Scope',
        body: 'When you connect Google Drive, Récu requests only the "drive.file" permission — the most restrictive scope Google offers. This means Récu can only access, read, modify, or delete files and folders that it created itself in your Drive. It is technically unable to access your personal documents, photos, or any pre-existing files. This restriction is enforced by Google\'s servers, not just our code. You can review and revoke this access at any time at myaccount.google.com/permissions.',
      },
      {
        heading: '4. AI Processing',
        body: 'Receipt images you submit may be sent to Anthropic\'s Claude API (anthropic.com) for data extraction. Images are processed transiently and are not retained by Anthropic beyond immediate processing. No data is used to train AI models without your explicit consent. Learn more at anthropic.com/privacy.',
      },
      {
        heading: '5. Storage and Security',
        body: 'Structured data (receipt metadata, dimensions) is stored in Supabase infrastructure (encrypted PostgreSQL hosted on AWS). Attached files are stored in your own Google Drive — Récu does not keep copies on its own servers. All communications are encrypted via HTTPS/TLS.',
      },
      {
        heading: '6. Data Retention',
        body: 'Your data is retained for as long as your account is active. You can delete your account and all associated data at any time from the app\'s Settings. Disconnecting Google Drive removes Récu\'s access only — your files in Drive are not deleted.',
      },
      {
        heading: '7. Your Rights (PIPEDA / Quebec Law 25)',
        body: 'Under Canada\'s Personal Information Protection and Electronic Documents Act (PIPEDA) and Quebec Law 25, you have the right to access, correct, delete your data, and withdraw consent at any time. To exercise these rights, contact us at privacy@recu.app.',
      },
      {
        heading: '8. Cookies and Local Storage',
        body: 'We use localStorage only to remember your language preference and authentication session. No third-party cookies, tracking pixels, or external analytics tools are used.',
      },
      {
        heading: '9. Contact',
        body: 'For any privacy-related questions: privacy@recu.app.',
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
