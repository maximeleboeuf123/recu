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
        body: "En utilisant Récu, vous acceptez d'être lié par les présentes conditions d'utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser le service.",
      },
      {
        heading: '2. Description du service',
        body: "Récu est une application de gestion de reçus destinée aux travailleurs autonomes, propriétaires et petites entreprises canadiennes. Le service permet la capture, l'extraction et l'organisation de reçus via l'intelligence artificielle.",
      },
      {
        heading: '3. Compte utilisateur',
        body: "Vous êtes responsable de maintenir la confidentialité de votre compte Google utilisé pour vous connecter. Vous êtes responsable de toutes les activités effectuées sous votre compte.",
      },
      {
        heading: '4. Utilisation acceptable',
        body: "Vous vous engagez à utiliser Récu uniquement à des fins légales et conformément aux présentes conditions. Vous ne devez pas utiliser le service pour traiter des documents frauduleux ou à des fins illégales.",
      },
      {
        heading: '5. Propriété intellectuelle',
        body: "Le contenu que vous soumettez (reçus, factures) reste votre propriété. Récu détient les droits sur son interface, son code et ses algorithmes.",
      },
      {
        heading: "6. Limitation de responsabilité",
        body: "Récu est fourni « tel quel ». Nous ne garantissons pas l'exactitude à 100 % de l'extraction automatique des données. Vous êtes responsable de vérifier les données extraites avant de les soumettre à des fins fiscales.",
      },
      {
        heading: '7. Résiliation',
        body: "Vous pouvez fermer votre compte à tout moment depuis les paramètres. Nous nous réservons le droit de suspendre un compte en cas de violation des présentes conditions.",
      },
      {
        heading: '8. Droit applicable',
        body: "Ces conditions sont régies par les lois de la province de Québec et les lois fédérales du Canada applicables.",
      },
    ],
  },
  en: {
    title: 'Terms of Service',
    updated: 'Last updated: April 30, 2026',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        body: 'By using Récu, you agree to be bound by these Terms of Service. If you do not accept these terms, please do not use the service.',
      },
      {
        heading: '2. Description of Service',
        body: 'Récu is a receipt management application for Canadian freelancers, landlords, and small business owners. The service enables the capture, extraction, and organization of receipts using artificial intelligence.',
      },
      {
        heading: '3. User Account',
        body: 'You are responsible for maintaining the confidentiality of your Google account used to sign in. You are responsible for all activities carried out under your account.',
      },
      {
        heading: '4. Acceptable Use',
        body: 'You agree to use Récu only for lawful purposes and in accordance with these terms. You must not use the service to process fraudulent documents or for illegal purposes.',
      },
      {
        heading: '5. Intellectual Property',
        body: 'Content you submit (receipts, invoices) remains your property. Récu holds rights to its interface, code, and algorithms.',
      },
      {
        heading: '6. Limitation of Liability',
        body: 'Récu is provided "as is." We do not guarantee 100% accuracy of automatic data extraction. You are responsible for verifying extracted data before submitting it for tax purposes.',
      },
      {
        heading: '7. Termination',
        body: 'You may close your account at any time from Settings. We reserve the right to suspend an account for violations of these terms.',
      },
      {
        heading: '8. Governing Law',
        body: 'These terms are governed by the laws of the Province of Quebec and applicable federal laws of Canada.',
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
