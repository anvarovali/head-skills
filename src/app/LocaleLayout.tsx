import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { LocaleContext } from '@/i18n/useLocale'
import type { Locale } from '@/i18n/locales'
import { Header } from '@/components/chrome/Header'
import { Footer } from '@/components/chrome/Footer'
import { Intro } from '@/components/intro/Intro'

export function LocaleLayout({ locale }: { locale: Locale }) {
  useEffect(() => { document.documentElement.lang = locale }, [locale])
  return (
    <LocaleContext.Provider value={locale}>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      <Intro />
    </LocaleContext.Provider>
  )
}
