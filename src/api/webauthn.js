import api from './index'

// Registration (auth required) — registering a new device/passkey for
// the logged-in user.
export const beginWebAuthnRegistration = () => api.post('/webauthn/register/begin')
// credentialResponse is the raw object from utils/webauthn.js's
// createCredential() — sent as the request body unwrapped, since
// go-webauthn parses it directly. sessionKey/name go as query params.
export const finishWebAuthnRegistration = (sessionKey, name, credentialResponse) =>
  api.post(`/webauthn/register/finish?session_key=${encodeURIComponent(sessionKey)}&name=${encodeURIComponent(name || '')}`, credentialResponse)

// Login (public) — email first (same first step as password login),
// then the browser's Face ID/Touch ID/Windows Hello prompt.
export const beginWebAuthnLogin = (email) => api.post('/webauthn/login/begin', { email })
export const finishWebAuthnLogin = (sessionKey, credentialResponse) =>
  api.post(`/webauthn/login/finish?session_key=${encodeURIComponent(sessionKey)}`, credentialResponse)

// Managing your own registered devices.
export const getWebAuthnCredentials = () => api.get('/webauthn/credentials')
export const deleteWebAuthnCredential = (id) => api.delete(`/webauthn/credentials/${id}`)
