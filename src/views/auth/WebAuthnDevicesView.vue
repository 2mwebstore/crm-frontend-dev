<template>
  <div class="space-y-5 max-w-2xl">
    <div>
      <h1 class="text-xl font-semibold text-gray-800">Face ID / Passkey Devices</h1>
      <p class="text-sm text-gray-500 mt-0.5">Register this device to sign in without typing your password next time</p>
    </div>

    <div v-if="!webAuthnSupported" class="card p-4 text-sm text-amber-700 bg-amber-50">
      This browser/device doesn't support Face ID, Touch ID, or Passkeys.
    </div>

    <div v-else class="card p-4 flex items-center justify-between gap-3">
      <div>
        <p class="text-sm font-medium text-gray-800">Register this device</p>
        <p class="text-xs text-gray-500 mt-0.5">You'll be prompted for Face ID, Touch ID, or your device PIN</p>
      </div>
      <button @click="registerDevice" class="btn-primary flex items-center gap-2" :disabled="registering">
        <svg v-if="registering" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
        <FaceSmileIcon v-else class="w-4 h-4" />
        {{ registering ? 'Registering…' : 'Register Device' }}
      </button>
    </div>

    <div class="card overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-100">
        <h2 class="text-sm font-semibold text-gray-700">Registered Devices</h2>
      </div>
      <div v-if="loading" class="p-8 text-center text-gray-400 text-sm">Loading…</div>
      <div v-else-if="!credentials.length" class="p-8 text-center text-gray-400 text-sm">No devices registered yet</div>
      <div v-else class="divide-y divide-gray-100">
        <div v-for="c in credentials" :key="c.id" class="flex items-center justify-between gap-3 px-4 py-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-800 truncate">{{ c.name }}</p>
            <p class="text-xs text-gray-400 mt-0.5">
              Registered {{ fmtDate(c.created_at) }}
              <span v-if="c.last_used_at"> · Last used {{ fmtDate(c.last_used_at) }}</span>
            </p>
          </div>
          <button @click="removeDevice(c)" class="btn-icon text-red-500 flex-shrink-0" title="Remove this device">
            <TrashIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { FaceSmileIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { useToast } from '@/composables/useToast'
import {
  beginWebAuthnRegistration, finishWebAuthnRegistration,
  getWebAuthnCredentials, deleteWebAuthnCredential,
} from '@/api/webauthn'
import { isWebAuthnSupported, createCredential } from '@/utils/webauthn'

const { success, error } = useToast()

const webAuthnSupported = isWebAuthnSupported()
const credentials = ref([])
const loading = ref(false)
const registering = ref(false)

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function load() {
  loading.value = true
  try {
    const res = await getWebAuthnCredentials()
    credentials.value = res || []
  } catch { credentials.value = [] } finally { loading.value = false }
}

async function registerDevice() {
  registering.value = true
  try {
    const begin = await beginWebAuthnRegistration()
    const credentialResponse = await createCredential(begin.options)
    // A simple default name based on the browser's own platform string —
    // good enough to tell devices apart in the list without asking the
    // user to type one during the ceremony itself.
    const defaultName = navigator.userAgentData?.platform || navigator.platform || 'This device'
    await finishWebAuthnRegistration(begin.session_key, defaultName, credentialResponse)
    success('Device registered')
    await load()
  } catch (e) {
    if (e?.name === 'NotAllowedError') {
      error('Registration was cancelled')
    } else {
      // Surface whatever the actual error was — a DOMException from the
      // browser's own WebAuthn API (e.name/e.message, e.g.
      // "SecurityError: The relying party ID is not a registrable
      // domain suffix of, nor equal to the current domain"), or the
      // backend's own error message (e.error) if the failure happened
      // server-side during /register/finish instead. Showing the
      // generic fallback made every failure look identical and
      // impossible to diagnose from the UI alone.
      const detail = e?.error || e?.message || (e?.name ? `${e.name}` : null) || JSON.stringify(e)
      error(`Failed to register this device — ${detail}`)
    }
  } finally {
    registering.value = false
  }
}

async function removeDevice(c) {
  try {
    await deleteWebAuthnCredential(c.id)
    success('Device removed')
    await load()
  } catch (e) {
    error(e?.error || 'Failed to remove device')
  }
}

onMounted(load)
</script>