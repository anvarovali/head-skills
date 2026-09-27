import { createBrowserRouter, type RouteObject } from 'react-router'
import { LOCALES, DEFAULT_LOCALE, type Locale } from '@/i18n/locales'
import { LocaleLayout } from './LocaleLayout'

const pages = (locale: Locale): RouteObject[] => [
  { index: true, lazy: async () => ({ Component: (await import('@/routes/Market')).Market }) },
  { path: 'skill/:id', lazy: async () => ({ Component: (await import('@/routes/SkillPage')).SkillPage }) },
  { path: 'bundle/:id', lazy: async () => ({ Component: (await import('@/routes/BundlePage')).BundlePage }) },
  { path: 'submit', lazy: async () => ({ Component: (await import('@/routes/Submit')).Submit }) },
  { path: '*', lazy: async () => ({ Component: (await import('@/routes/NotFound')).NotFound }) },
].map((r) => ({ ...r, handle: { locale } }))

export const router = createBrowserRouter(
  LOCALES.map((locale) => ({
    path: locale === DEFAULT_LOCALE ? '/' : `/${locale}`,
    element: <LocaleLayout locale={locale} />,
    children: pages(locale),
  })),
)
