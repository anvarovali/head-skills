import { Link } from 'react-router'
import { useHref, useT } from '@/i18n/useLocale'
import { ArrowRight } from '@/components/market/icons'
import s from '@/components/market/NotFound.module.css'

export function NotFound() {
  const t = useT()
  const href = useHref()
  return (
    <section className={s.wrap}>
      <p className={s.code}>404</p>
      <h1 className={s.title}>{t('notfound.title')}</h1>
      <p className={s.sub}>{t('notfound.sub')}</p>
      <Link to={href()} className={s.btn}>{t('notfound.back')}<ArrowRight size={14} /></Link>
    </section>
  )
}
