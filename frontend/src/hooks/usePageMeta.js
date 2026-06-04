import { useEffect } from 'react'

function setMeta(selector, attr, value) {
  const el = document.querySelector(selector)
  if (el && value !== undefined) el.setAttribute(attr, value)
}

export function usePageMeta({ title, description, canonical }) {
  useEffect(() => {
    const prev = {
      title:        document.title,
      description:  document.querySelector('meta[name="description"]')?.getAttribute('content'),
      canonical:    document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      ogTitle:      document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
      ogDescription:document.querySelector('meta[property="og:description"]')?.getAttribute('content'),
      ogUrl:        document.querySelector('meta[property="og:url"]')?.getAttribute('content'),
      twTitle:      document.querySelector('meta[name="twitter:title"]')?.getAttribute('content'),
      twDescription:document.querySelector('meta[name="twitter:description"]')?.getAttribute('content'),
    }

    document.title = title
    setMeta('meta[name="description"]',        'content', description)
    setMeta('link[rel="canonical"]',           'href',    canonical)
    setMeta('meta[property="og:title"]',       'content', title)
    setMeta('meta[property="og:description"]', 'content', description)
    setMeta('meta[property="og:url"]',         'content', canonical)
    setMeta('meta[name="twitter:title"]',      'content', title)
    setMeta('meta[name="twitter:description"]','content', description)

    return () => {
      document.title = prev.title
      setMeta('meta[name="description"]',        'content', prev.description)
      setMeta('link[rel="canonical"]',           'href',    prev.canonical)
      setMeta('meta[property="og:title"]',       'content', prev.ogTitle)
      setMeta('meta[property="og:description"]', 'content', prev.ogDescription)
      setMeta('meta[property="og:url"]',         'content', prev.ogUrl)
      setMeta('meta[name="twitter:title"]',      'content', prev.twTitle)
      setMeta('meta[name="twitter:description"]','content', prev.twDescription)
    }
  }, [title, description, canonical])
}
