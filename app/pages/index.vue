<script setup lang="ts">
const { user, isAdmin, loginWithGoogle, logout } = useAuth()
const config = useRuntimeConfig().public

const buttonEl = ref<HTMLElement | null>(null)
const error = ref<string | null>(null)
const loading = ref(false)

if (isAdmin.value) await navigateTo('/shops')

async function onCredential(resp: { credential: string }) {
  error.value = null
  loading.value = true
  try {
    const u = await loginWithGoogle(resp.credential)
    if (u.role === 'ADMIN') await navigateTo('/shops')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

/** Google Identity Services loads async from nuxt.config head; wait for it. */
function waitForGoogle(timeoutMs = 10000): Promise<any> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = () => {
      const g = (window as any).google?.accounts?.id
      if (g) return resolve(g)
      if (Date.now() - start > timeoutMs) return reject(new Error('Google sign-in script did not load'))
      setTimeout(tick, 100)
    }
    tick()
  })
}

async function renderButton() {
  try {
    const gid = await waitForGoogle()
    gid.initialize({ client_id: config.googleClientId, callback: onCredential })
    if (buttonEl.value) {
      gid.renderButton(buttonEl.value, { theme: 'outline', size: 'large', shape: 'pill', width: 280 })
    }
  } catch (e) {
    error.value = errorMessage(e)
  }
}

onMounted(() => {
  if (!user.value) renderButton()
})

function switchAccount() {
  logout()
  nextTick(renderButton)
}
</script>

<template>
  <main class="login">
    <div class="login-card">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">≈</span>
        <span>Ocean Admin</span>
      </div>

      <template v-if="user && !isAdmin">
        <h1>ไม่มีสิทธิ์เข้าถึง</h1>
        <p class="muted">
          บัญชี <strong>{{ user.email }}</strong> ไม่ใช่ผู้ดูแลระบบ
        </p>
        <button class="btn" @click="switchAccount">ใช้บัญชีอื่น</button>
      </template>

      <template v-else>
        <h1>เข้าสู่ระบบ</h1>
        <p class="muted">สำหรับผู้ดูแลระบบเพื่ออนุมัติร้านค้า</p>
        <div ref="buttonEl" class="gbtn" />
        <p v-if="loading" class="muted">กำลังเข้าสู่ระบบ…</p>
      </template>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
    </div>
  </main>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 16px;
  background:
    radial-gradient(circle at 20% 10%, var(--primary-light) 0, transparent 40%),
    var(--bg);
}
.login-card {
  width: 100%;
  max-width: 380px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 32px 28px;
  text-align: center;
  box-shadow: var(--shadow);
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--primary);
  margin-bottom: 20px;
}
.brand-mark {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--primary);
  color: #fff;
  font-size: 20px;
}
h1 {
  font-size: 22px;
  margin: 0 0 6px;
}
.gbtn {
  display: flex;
  justify-content: center;
  margin: 24px 0 8px;
  min-height: 44px;
}
.error {
  margin-top: 16px;
  color: var(--danger);
  font-size: 14px;
}
.btn {
  margin-top: 20px;
}
</style>
