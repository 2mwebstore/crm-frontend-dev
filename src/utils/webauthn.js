// Helpers for the browser's native WebAuthn API (navigator.credentials).
// The server sends/expects challenge and credential IDs as base64url
// strings (JSON-friendly); the browser's actual API works exclusively in
// ArrayBuffer/Uint8Array. Every function here exists to bridge that gap.

function base64urlToBuffer(base64url) {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (padded.length % 4)) % 4
  const base64 = padded + '='.repeat(padLen)
  const binary = atob(base64)
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i)
  return buffer.buffer
}

function bufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Checks whether this browser/device can even attempt WebAuthn at all —
// worth checking before showing a "Login with Face ID" button, since an
// older browser or non-HTTPS context won't have navigator.credentials.
export function isWebAuthnSupported() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential
}

// Converts the server's CredentialCreation options (base64url strings)
// into the shape navigator.credentials.create() actually expects
// (ArrayBuffers), calls it, then converts the resulting credential back
// into a plain JSON-serializable object for sending to the server.
export async function createCredential(options) {
  const publicKey = options.publicKey
  const prepared = {
    ...publicKey,
    challenge: base64urlToBuffer(publicKey.challenge),
    user: { ...publicKey.user, id: base64urlToBuffer(publicKey.user.id) },
    excludeCredentials: (publicKey.excludeCredentials || []).map(c => ({
      ...c,
      id: base64urlToBuffer(c.id),
    })),
  }

  const credential = await navigator.credentials.create({ publicKey: prepared })

  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
      attestationObject: bufferToBase64url(credential.response.attestationObject),
    },
    clientExtensionResults: credential.getClientExtensionResults ? credential.getClientExtensionResults() : {},
  }
}

// Same idea as createCredential, but for navigator.credentials.get() —
// used during login rather than registration.
export async function getCredential(options) {
  const publicKey = options.publicKey
  const prepared = {
    ...publicKey,
    challenge: base64urlToBuffer(publicKey.challenge),
    allowCredentials: (publicKey.allowCredentials || []).map(c => ({
      ...c,
      id: base64urlToBuffer(c.id),
    })),
  }

  const credential = await navigator.credentials.get({ publicKey: prepared })

  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
      authenticatorData: bufferToBase64url(credential.response.authenticatorData),
      signature: bufferToBase64url(credential.response.signature),
      userHandle: credential.response.userHandle ? bufferToBase64url(credential.response.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults ? credential.getClientExtensionResults() : {},
  }
}
