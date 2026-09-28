import { Link } from 'react-router'
import { useHref, useT } from '@/i18n/useLocale'
import { ArrowRight } from '@/components/market/icons'
import { useDocumentMeta } from '@/i18n/useDocumentMeta'
import s from '@/components/market/NotFound.module.css'

/** The one 404 look: the catch-all route and an unknown skill/bundle id share it. */
export function NotFoundView({ title, sub }: { title?: string; sub?: string }) {
  const t = useT()
  const href = useHref()
  const heading = title ?? t('notfound.title')
  useDocumentMeta(heading)
  return (
    <section className={s.wrap}>
      <p className={s.code}>404</p>
      <h1 className={s.title}>{heading}</h1>
      <p className={s.sub}>{sub ?? t('notfound.sub')}</p>
      <Link to={href()} className={s.btn}>{t('notfound.back')}<ArrowRight size={14} /></Link>
    </section>
  )
}

export function NotFound() {
  return <NotFoundView />
}
