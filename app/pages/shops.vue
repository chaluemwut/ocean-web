<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

type Status = 'PENDING' | 'APPROVED' | 'REJECTED'

interface Shop {
  id: number
  name: string
  description: string
  imageUrl: string
  status: Status
  rejectReason: string | null
  createdAt: string
  reviewedAt: string | null
  owner: { id: number; email: string; name: string | null; pictureUrl: string | null } | null
}

const tabs: { key: Status; label: string }[] = [
  { key: 'PENDING', label: 'รออนุมัติ' },
  { key: 'APPROVED', label: 'อนุมัติแล้ว' },
  { key: 'REJECTED', label: 'ไม่อนุมัติ' },
]

const api = useApi()

const status = ref<Status>('PENDING')
const shops = ref<Shop[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const busyId = ref<number | null>(null)
const toast = ref<string | null>(null)

// Reject dialog
const rejecting = ref<Shop | null>(null)
const reason = ref('')
const reasonError = ref<string | null>(null)
// Image preview
const preview = ref<Shop | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    shops.value = await api<Shop[]>('/api/admin/shops', { query: { status: status.value } })
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

watch(status, load, { immediate: true })

function flash(msg: string) {
  toast.value = msg
  setTimeout(() => (toast.value = null), 2500)
}

async function approve(shop: Shop) {
  busyId.value = shop.id
  try {
    await api(`/api/admin/shops/${shop.id}/approve`, { method: 'POST' })
    shops.value = shops.value.filter((s) => s.id !== shop.id)
    flash(`อนุมัติ “${shop.name}” แล้ว`)
  } catch (e) {
    flash(errorMessage(e))
  } finally {
    busyId.value = null
  }
}

function openReject(shop: Shop) {
  rejecting.value = shop
  reason.value = shop.rejectReason ?? ''
  reasonError.value = null
}

async function confirmReject() {
  const shop = rejecting.value
  if (!shop) return
  if (!reason.value.trim()) {
    reasonError.value = 'กรุณาระบุเหตุผล เพื่อให้เจ้าของร้านแก้ไขได้'
    return
  }
  busyId.value = shop.id
  try {
    await api(`/api/admin/shops/${shop.id}/reject`, { method: 'POST', body: { reason: reason.value.trim() } })
    shops.value = shops.value.filter((s) => s.id !== shop.id)
    rejecting.value = null
    flash(`ไม่อนุมัติ “${shop.name}”`)
  } catch (e) {
    reasonError.value = errorMessage(e)
  } finally {
    busyId.value = null
  }
}

const fmt = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
const formatDate = (iso: string | null) => (iso ? fmt.format(new Date(iso)) : '')
</script>

<template>
  <div class="page">
    <AdminHeader />

    <main class="content">
      <div class="heading">
        <h1>คำขอเปิดร้าน</h1>
        <button class="btn btn-ghost" :disabled="loading" @click="load">รีเฟรช</button>
      </div>

      <nav class="tabs" role="tablist">
        <button
          v-for="t in tabs"
          :key="t.key"
          role="tab"
          :aria-selected="status === t.key"
          :class="['tab', { active: status === t.key }]"
          @click="status = t.key"
        >
          {{ t.label }}
        </button>
      </nav>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-else-if="loading && !shops.length" class="muted center">กำลังโหลด…</p>
      <div v-else-if="!shops.length" class="empty">
        <p class="muted">ไม่มีร้านในสถานะนี้</p>
      </div>

      <section v-else class="grid">
        <article v-for="shop in shops" :key="shop.id" class="card">
          <button class="thumb" :aria-label="`ดูรูป ${shop.name}`" @click="preview = shop">
            <img :src="apiUrl(shop.imageUrl)" :alt="shop.name" loading="lazy" />
          </button>
          <div class="card-body">
            <h2>{{ shop.name }}</h2>
            <p class="desc">{{ shop.description }}</p>

            <dl class="meta">
              <div>
                <dt>เจ้าของ</dt>
                <dd>{{ shop.owner?.name || '—' }} <span class="muted">{{ shop.owner?.email }}</span></dd>
              </div>
              <div>
                <dt>ส่งคำขอ</dt>
                <dd>{{ formatDate(shop.createdAt) }}</dd>
              </div>
              <div v-if="shop.reviewedAt">
                <dt>ตรวจสอบ</dt>
                <dd>{{ formatDate(shop.reviewedAt) }}</dd>
              </div>
            </dl>

            <p v-if="shop.status === 'REJECTED' && shop.rejectReason" class="reason">
              เหตุผล: {{ shop.rejectReason }}
            </p>

            <div class="actions">
              <button
                v-if="shop.status !== 'REJECTED'"
                class="btn btn-danger-ghost"
                :disabled="busyId === shop.id"
                @click="openReject(shop)"
              >
                ไม่อนุมัติ
              </button>
              <button
                v-if="shop.status !== 'APPROVED'"
                class="btn btn-primary"
                :disabled="busyId === shop.id"
                @click="approve(shop)"
              >
                {{ busyId === shop.id ? 'กำลังบันทึก…' : 'อนุมัติ' }}
              </button>
            </div>
          </div>
        </article>
      </section>
    </main>

    <!-- Reject dialog -->
    <div v-if="rejecting" class="overlay" @click.self="rejecting = null">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="reject-title">
        <h2 id="reject-title">ไม่อนุมัติ “{{ rejecting.name }}”</h2>
        <label for="reason" class="label">เหตุผล (เจ้าของร้านจะเห็นข้อความนี้)</label>
        <textarea
          id="reason"
          v-model="reason"
          rows="4"
          maxlength="500"
          placeholder="เช่น รูปไม่ชัด กรุณาส่งรูปหน้าร้านใหม่"
          autofocus
        />
        <p v-if="reasonError" class="error">{{ reasonError }}</p>
        <div class="actions">
          <button class="btn btn-ghost" @click="rejecting = null">ยกเลิก</button>
          <button class="btn btn-danger" :disabled="busyId === rejecting.id" @click="confirmReject">ยืนยันไม่อนุมัติ</button>
        </div>
      </div>
    </div>

    <!-- Image preview -->
    <div v-if="preview" class="overlay" @click="preview = null">
      <img class="preview" :src="apiUrl(preview.imageUrl)" :alt="preview.name" />
    </div>

    <div v-if="toast" class="toast" role="status">{{ toast }}</div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
}
.content {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px;
}
.heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
h1 {
  font-size: 24px;
  margin: 0;
}
.tabs {
  display: flex;
  gap: 4px;
  margin: 16px 0 20px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
}
.tab {
  border: 0;
  background: none;
  padding: 10px 14px;
  font: inherit;
  color: var(--muted);
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
}
.tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
  font-weight: 600;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}
.card {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
}
.thumb {
  display: block;
  padding: 0;
  border: 0;
  cursor: zoom-in;
  aspect-ratio: 16 / 10;
  background: var(--primary-light);
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.card-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 16px;
}
.card h2 {
  font-size: 17px;
  margin: 0 0 6px;
}
.desc {
  margin: 0 0 12px;
  color: var(--text-2);
  font-size: 14px;
  white-space: pre-line;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.meta {
  margin: 0 0 12px;
  font-size: 13px;
  display: grid;
  gap: 4px;
}
.meta div {
  display: flex;
  gap: 8px;
}
.meta dt {
  color: var(--muted);
  min-width: 64px;
}
.meta dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.reason {
  font-size: 13px;
  background: var(--danger-bg);
  color: var(--danger);
  padding: 8px 10px;
  border-radius: 8px;
  margin: 0 0 12px;
}
.actions {
  margin-top: auto;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.empty,
.center {
  text-align: center;
  padding: 48px 0;
}
.error {
  color: var(--danger);
  font-size: 14px;
}
.overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: rgb(0 0 0 / 0.55);
  display: grid;
  place-items: center;
  padding: 16px;
}
.dialog {
  width: 100%;
  max-width: 440px;
  background: var(--surface);
  border-radius: 16px;
  padding: 20px;
}
.dialog h2 {
  font-size: 18px;
  margin: 0 0 14px;
}
.label {
  display: block;
  font-size: 14px;
  color: var(--muted);
  margin-bottom: 6px;
}
textarea {
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  resize: vertical;
  margin-bottom: 12px;
}
textarea:focus {
  outline: 2px solid var(--primary);
  outline-offset: -1px;
}
.preview {
  max-width: 100%;
  max-height: 90vh;
  border-radius: 12px;
}
.toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  background: var(--text);
  color: var(--surface);
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 14px;
  z-index: 30;
}
@media (max-width: 600px) {
  .content {
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
