import './landing.css'

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    e.preventDefault()
    const href = (e.currentTarget as HTMLAnchorElement).getAttribute('href')
    if (href) {
      const target = document.querySelector(href)
      target?.scrollIntoView({ behavior: 'smooth' })
    }
  })
})
