import axios from 'axios'
import { useToast } from '@/composables/useToast'

const api = axios.create({
  // baseURL: '/api/v1',
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('crm_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Guards against a common real-world case: a page with several parallel
// requests in flight (e.g. a dashboard loading multiple widgets at once)
// where the session becomes invalid mid-flight — every one of those
// requests would otherwise independently hit this 401 branch and race to
// clear localStorage/redirect, which looked like scattered "failed to
// load" errors flickering before the page finally navigated away. Now
// only the FIRST 401 acts; the rest are silently ignored since we're
// already on our way out.
let sessionExpiredHandled = false

api.interceptors.response.use(
  res => res.data,
  err => {
    // A 401 from a login endpoint itself just means "invalid
    // credentials"/"verification failed" — that should surface as an
    // inline error on the login form, not trigger a full page reload.
    // Only an authenticated request getting rejected (an actual
    // expired/invalid session) should force a logout-redirect. This
    // covers password login AND both WebAuthn (Face ID/passkey) login
    // endpoints — missing the WebAuthn ones here was exactly what caused
    // a failed Face ID attempt to force-reload the login page instead of
    // showing an inline error.
    const isLoginRequest = /\/auth\/login|\/webauthn\/login\//.test(err.config?.url || '')
    if (err.response?.status === 401 && !isLoginRequest && !sessionExpiredHandled) {
      sessionExpiredHandled = true
      localStorage.removeItem('crm_token')
      useToast().info('Your session has ended — signing you out…')
      // Brief delay so the message is actually visible before the hard
      // navigation to /login unloads the page.
      setTimeout(() => { window.location.href = '/login' }, 700)
    }
    return Promise.reject(err.response?.data || err)
  }
)

export default api