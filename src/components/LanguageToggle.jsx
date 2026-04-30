import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'

export default function LanguageToggle({ session }) {
  const { i18n } = useTranslation()
  const current = i18n.language?.startsWith('fr') ? 'fr' : 'en'

  const toggle = async (lang) => {
    if (lang === current) return
    await i18n.changeLanguage(lang)
    localStorage.setItem('recu_lang', lang)

    if (session?.user?.id) {
      await supabase
        .from('users')
        .update({ language: lang })
        .eq('id', session.user.id)
    }
  }

  return (
    <div className="flex items-center gap-0.5 text-sm select-none">
      <button
        onClick={() => toggle('fr')}
        className={`px-2 py-0.5 rounded transition-colors ${
          current === 'fr'
            ? 'font-bold text-primary'
            : 'text-muted hover:text-primary'
        }`}
      >
        FR
      </button>
      <span className="text-muted">|</span>
      <button
        onClick={() => toggle('en')}
        className={`px-2 py-0.5 rounded transition-colors ${
          current === 'en'
            ? 'font-bold text-primary'
            : 'text-muted hover:text-primary'
        }`}
      >
        EN
      </button>
    </div>
  )
}
