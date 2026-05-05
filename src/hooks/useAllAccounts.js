import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDimensions } from '../context/DimensionsContext'
import { useShares } from './useShares'

export function useAllAccounts() {
  const { i18n } = useTranslation()
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en'
  const { accountsWithCategories } = useDimensions()
  const { received } = useShares()

  return useMemo(() => {
    const ownNames = new Set(accountsWithCategories.map(a => a.name))
    const ownOptions = accountsWithCategories.map(a => a.name)
    const sharedLabel = lang === 'fr' ? 'partagé' : 'shared'

    const sharedOptions = received
      .filter(s => s.status === 'accepted' && !ownNames.has(s.account_name))
      .map(s => ({
        value: s.account_name,
        label: `${s.account_name} (${sharedLabel})`,
        isShared: true,
      }))

    return [...ownOptions, ...sharedOptions]
  }, [accountsWithCategories, received, lang])
}
