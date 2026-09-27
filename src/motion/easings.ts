import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { CustomEase } from 'gsap/CustomEase'
import { Flip } from 'gsap/Flip'
import { useGSAP } from '@gsap/react'

let registered = false
/** Register plugins and the house eases once (client only). Idempotent. */
export function registerGsap() {
  if (registered || typeof window === 'undefined') return
  registered = true
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, CustomEase, Flip)
  // cominvi's house curve, cubic-bezier(.6,0,0,1), plus its softer/harder variants
  CustomEase.create('pl', 'M0,0 C0.6,0 0,1 1,1')
  CustomEase.create('pl-soft', 'M0,0 C0.51,0 0,1 1,1')
  CustomEase.create('pl-hard', 'M0,0 C0.68,0 0,1 1,1')
}

export { gsap, ScrollTrigger, SplitText, CustomEase, Flip, useGSAP }
