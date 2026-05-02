import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const CONTENT = {
  fr: {
    title: "Conditions d'utilisation",
    updated: 'Dernière mise à jour : 30 avril 2026',
    sections: [
      {
        heading: "1. Acceptation des conditions",
        body: "En utilisant Récu, vous acceptez d'être lié par les présentes conditions d'utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser le service. Ces conditions peuvent être mises à jour périodiquement ; la date de mise à jour en haut de cette page indique la version en vigueur.",
      },
      {
        heading: '2. Description du service',
        body: "Récu est une application de gestion de reçus destinée aux travailleurs autonomes, propriétaires et petites entreprises canadiennes. Le service permet la capture, l'extraction et l'organisation de reçus via l'intelligence artificielle, et l'enregistrement des fichiers dans votre Google Drive personnel.",
      },
      {
        heading: '3. Compte utilisateur',
        body: "Vous devez disposer d'un compte Google pour utiliser Récu. Vous êtes responsable de maintenir la confidentialité de votre session et de toutes les activités effectuées sous votre compte. Signalez immédiatement tout accès non autorisé à privacy@recu.app.",
      },
      {
        heading: "4. Accès à Google Drive — portée limitée",
        body: "En connectant votre Google Drive, vous autorisez Récu à utiliser uniquement l'autorisation « drive.file » de Google — la plus restrictive disponible. Récu ne peut accéder, lire, modifier ou supprimer que les fichiers et dossiers qu'il crée lui-même dans votre Drive. Il lui est techniquement impossible d'accéder à vos documents personnels ou à tout autre fichier préexistant. Cette restriction est imposée par les serveurs de Google. Vous pouvez révoquer cet accès à tout moment depuis myaccount.google.com/permissions.",
      },
      {
        heading: '5. Traitement par intelligence artificielle',
        body: "Les images de reçus soumises peuvent être transmises à l'API Claude d'Anthropic pour l'extraction automatique de données (fournisseur, montants, dates, numéros de taxes). L'extraction automatique peut comporter des erreurs. Vous êtes entièrement responsable de vérifier, corriger et valider toutes les données extraites avant de les utiliser à des fins comptables, fiscales ou légales. Récu ne saurait être tenu responsable d'erreurs résultant d'une extraction inexacte.",
      },
      {
        heading: '6. Utilisation acceptable',
        body: "Vous vous engagez à utiliser Récu uniquement à des fins légales et conformément aux présentes conditions. Vous ne devez pas utiliser le service pour traiter des documents frauduleux, falsifiés ou à des fins illégales. Tout usage abusif peut entraîner la suspension immédiate du compte.",
      },
      {
        heading: '7. Propriété intellectuelle',
        body: "Les reçus et fichiers que vous soumettez restent votre propriété. Récu détient les droits sur son interface, son code, ses algorithmes et ses marques. Vous nous accordez uniquement une licence limitée pour traiter vos fichiers dans le cadre de la fourniture du service.",
      },
      {
        heading: "8. Limitation de responsabilité",
        body: "Récu est fourni « tel quel », sans garantie d'exactitude, de disponibilité ou d'adéquation à un usage particulier. Dans toute la mesure permise par la loi applicable, notre responsabilité totale envers vous ne saurait excéder les montants que vous nous avez payés au cours des trois (3) derniers mois.",
      },
      {
        heading: "9. Résiliation et suppression des données",
        body: "Vous pouvez fermer votre compte à tout moment depuis les paramètres de l'application, ce qui entraîne la suppression de toutes vos données structurées. La déconnexion de Google Drive supprime uniquement l'accès de Récu — vos fichiers dans Drive ne sont pas supprimés. Nous nous réservons le droit de suspendre ou résilier un compte en cas de violation des présentes conditions.",
      },
      {
        heading: '10. Droit applicable',
        body: "Ces conditions sont régies par les lois de la province de Québec et les lois fédérales du Canada applicables. Tout litige sera soumis à la compétence exclusive des tribunaux du Québec.",
      },
    ],
  },
  en: {
    title: 'Terms of Service',
    updated: 'Last updated: April 30, 2026',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        body: 'By using Récu, you agree to be bound by these Terms of Service. If you do not accept these terms, please do not use the service. These terms may be updated periodically; the date at the top of this page indicates the version in effect.',
      },
      {
        heading: '2. Description of Service',
        body: 'Récu is a receipt management application for Canadian freelancers, landlords, and small business owners. The service enables the capture, extraction, and organisation of receipts using artificial intelligence, and the storage of files in your personal Google Drive.',
      },
      {
        heading: '3. User Account',
        body: 'You must have a Google account to use Récu. You are responsible for maintaining the confidentiality of your session and all activities carried out under your account. Report any unauthorised access immediately to privacy@recu.app.',
      },
      {
        heading: '4. Google Drive Access — Limited Scope',
        body: 'By connecting your Google Drive, you authorise Récu to use only the "drive.file" permission — the most restrictive scope Google offers. Récu can only access, read, modify, or delete files and folders that it created itself in your Drive. It is technically unable to access your personal documents or any pre-existing files. This restriction is enforced by Google\'s servers. You can revoke this access at any time at myaccount.google.com/permissions.',
      },
      {
        heading: '5. AI Processing and Accuracy',
        body: 'Receipt images you submit may be sent to Anthropic\'s Claude API for automated data extraction (vendor, amounts, dates, tax numbers). Automated extraction may contain errors. You are solely responsible for reviewing, correcting, and validating all extracted data before using it for accounting, tax, or legal purposes. Récu shall not be liable for errors resulting from inaccurate extraction.',
      },
      {
        heading: '6. Acceptable Use',
        body: 'You agree to use Récu only for lawful purposes and in accordance with these terms. You must not use the service to process fraudulent, falsified, or illegal documents. Abuse may result in immediate account suspension.',
      },
      {
        heading: '7. Intellectual Property',
        body: 'Receipts and files you submit remain your property. Récu holds rights to its interface, code, algorithms, and trademarks. You grant us only a limited licence to process your files for the purpose of delivering the service.',
      },
      {
        heading: '8. Limitation of Liability',
        body: 'Récu is provided "as is," without warranty of accuracy, availability, or fitness for a particular purpose. To the fullest extent permitted by applicable law, our total liability to you shall not exceed the amounts you have paid us in the preceding three (3) months.',
      },
      {
        heading: '9. Termination and Data Deletion',
        body: 'You may close your account at any time from the app\'s Settings, which triggers deletion of all your structured data. Disconnecting Google Drive removes Récu\'s access only — your files in Drive are not deleted. We reserve the right to suspend or terminate an account for violations of these terms.',
      },
      {
        heading: '10. Governing Law',
        body: 'These terms are governed by the laws of the Province of Quebec and applicable federal laws of Canada. Any dispute shall be subject to the exclusive jurisdiction of the courts of Quebec.',
      },
    ],
  },
}

export default function TermsPage() {
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
