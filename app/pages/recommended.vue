<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

interface AdminProduct {
  id: number
  name: string
  price: number
  category: string
  imageUrl: string | null
  shopId: number
  shopName: string | null
  /** Products of unapproved shops stay in the list but are hidden in the app. */
  shopApproved: boolean
}

/** Must match RecommendedController.MAX in the API. */
const MAX = 15

const categoryLabels: Record<string, string> = {
  NOODLE: 'ก๋วยเตี๋ยว',
  MADE_TO_ORDER: 'อาหารตามสั่ง',
  RICE_CURRY: 'ข้าวราดแกง',
  KHANOM_JEEN: 'ข้าวปุ้น',
  DESSERT: 'ขนม/ของหวาน',
  DRINK: 'เครื่องดื่ม',
  HOUSEHOLD: 'ของใช้',
  OTHER: 'อื่นๆ',
}

const api = useApi()

const list = ref<AdminProduct[]>([])
const savedIds = ref<number[]>([])
const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const toast = ref<string | null>(null)

const query = ref('')
const results = ref<AdminProduct[]>([])
const searching = ref(false)
const searchError = ref<string | null>(null)

const inList = computed(() => new Set(list.value.map((p) => p.id)))
const full = computed(() => list.value.length >= MAX)
const dirty = computed(() => list.value.map((p) => p.id).join(',') !== savedIds.value.join(','))

const price = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0, maximumFractionDigits: 2 })

function flash(msg: string) {
  toast.value = msg
  setTimeout(() => (toast.value = null), 2500)
}

async function load() {
  loading.value = true
  error.value = null
  try {
    list.value = await api<AdminProduct[]>('/api/admin/recommended')
    savedIds.value = list.value.map((p) => p.id)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

let searchSeq = 0
async function search() {
  const seq = ++searchSeq
  searching.value = true
  searchError.value = null
  try {
    const r = await api<AdminProduct[]>('/api/admin/products', { query: { q: query.value.trim() } })
    if (seq === searchSeq) results.value = r
  } catch (e) {
    if (seq === searchSeq) searchError.value = errorMessage(e)
  } finally {
    if (seq === searchSeq) searching.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(query, () => {
  clearTimeout(timer)
  timer = setTimeout(search, 300)
})

onMounted(() => {
  load()
  search()
})

function add(p: AdminProduct) {
  if (full.value || inList.value.has(p.id)) return
  list.value.push(p)
}

function remove(i: number) {
  list.value.splice(i, 1)
}

function move(i: number, delta: number) {
  const j = i + delta
  if (j < 0 || j >= list.value.length) return
  const items = list.value
  ;[items[i], items[j]] = [items[j]!, items[i]!]
}

async function save() {
  saving.value = true
  try {
    list.value = await api<AdminProduct[]>('/api/admin/recommended', {
      method: 'PUT',
      body: { productIds: list.value.map((p) => p.id) },
    })
    savedIds.value = list.value.map((p) => p.id)
    flash('บันทึกอาหารแนะนำแล้ว')
  } catch (e) {
    flash(errorMessage(e))
  } finally {
    saving.value = false
  }
}

function discard() {
  load()
}

// Warn before leaving with unsaved changes.
onBeforeRouteLeave(() => (dirty.value ? confirm('ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?') : true))
</script>

<template>
  <div class="page">
    <AdminHeader />

    <main class="content">
      <div class="heading">
        <div>
          <h1>อาหารแนะนำ</h1>
          <p class="muted sub">เลือกได้สูงสุด {{ MAX }} รายการ แสดงในแอปใต้หมวดหมู่ ตามลำดับนี้</p>
        </div>
        <div class="heading-actions">
          <button class="btn btn-ghost" :disabled="!dirty || saving" @click="discard">ยกเลิกการแก้ไข</button>
          <button class="btn btn-primary" :disabled="!dirty || saving" @click="save">
            {{ saving ? 'กำลังบันทึก…' : 'บันทึก' }}
          </button>
        </div>
      </div>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <div class="columns">
        <!-- Current list -->
        <section class="panel">
          <header class="panel-head">
            <h2>รายการแนะนำ</h2>
            <span :class="['count', { full }]">{{ list.length }}/{{ MAX }}</span>
          </header>

          <p v-if="loading" class="muted center">กำลังโหลด…</p>
          <p v-else-if="!list.length" class="muted center">ยังไม่มีอาหารแนะนำ — เพิ่มจากรายการด้านขวา</p>

          <ol v-else class="rows">
            <li v-for="(p, i) in list" :key="p.id" class="row">
              <span class="rank">{{ i + 1 }}</span>
              <img v-if="p.imageUrl" :src="apiUrl(p.imageUrl)" :alt="p.name" class="thumb" loading="lazy" />
              <span v-else class="thumb placeholder" aria-hidden="true" />
              <div class="info">
                <strong class="name">{{ p.name }}</strong>
                <span class="muted small">{{ p.shopName || '—' }} · {{ categoryLabels[p.category] ?? p.category }}</span>
                <span v-if="!p.shopApproved" class="warn small">ร้านยังไม่อนุมัติ — จะไม่แสดงในแอป</span>
              </div>
              <span class="price">{{ price.format(p.price) }}</span>
              <div class="row-actions">
                <button class="icon-btn" :disabled="i === 0" aria-label="เลื่อนขึ้น" @click="move(i, -1)">↑</button>
                <button class="icon-btn" :disabled="i === list.length - 1" aria-label="เลื่อนลง" @click="move(i, 1)">↓</button>
                <button class="icon-btn danger" aria-label="นำออก" @click="remove(i)">✕</button>
              </div>
            </li>
          </ol>
        </section>

        <!-- Product picker -->
        <section class="panel">
          <header class="panel-head">
            <h2>เพิ่มสินค้า</h2>
          </header>
          <input
            v-model="query"
            type="search"
            class="search"
            placeholder="ค้นหาชื่อสินค้าหรือชื่อร้าน"
            aria-label="ค้นหาสินค้า"
          />
          <p v-if="searchError" class="error">{{ searchError }}</p>
          <p v-else-if="searching && !results.length" class="muted center">กำลังค้นหา…</p>
          <p v-else-if="!results.length" class="muted center">ไม่พบสินค้า</p>

          <ul v-else class="rows">
            <li v-for="p in results" :key="p.id" class="row">
              <img v-if="p.imageUrl" :src="apiUrl(p.imageUrl)" :alt="p.name" class="thumb" loading="lazy" />
              <span v-else class="thumb placeholder" aria-hidden="true" />
              <div class="info">
                <strong class="name">{{ p.name }}</strong>
                <span class="muted small">{{ p.shopName || '—' }} · {{ categoryLabels[p.category] ?? p.category }}</span>
              </div>
              <span class="price">{{ price.format(p.price) }}</span>
              <button
                class="btn btn-ghost add"
                :disabled="inList.has(p.id) || full"
                @click="add(p)"
              >
                {{ inList.has(p.id) ? 'เพิ่มแล้ว' : 'เพิ่ม' }}
              </button>
            </li>
          </ul>
        </section>
      </div>
    </main>

    <div v-if="toast" class="toast" role="status">{{ toast }}</div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
}
.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}
.heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
h1 {
  font-size: 24px;
  margin: 0;
}
.sub {
  margin: 4px 0 0;
  font-size: 14px;
}
.heading-actions {
  display: flex;
  gap: 8px;
}
.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  align-items: start;
}
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px;
  min-width: 0;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.panel h2 {
  font-size: 17px;
  margin: 0;
}
.count {
  font-size: 13px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.count.full {
  color: var(--primary);
  font-weight: 600;
}
.search {
  width: 100%;
  font: inherit;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  margin-bottom: 12px;
}
.search:focus {
  outline: 2px solid var(--primary);
  outline-offset: -1px;
}
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 12px;
  border: 1px solid var(--border);
  min-width: 0;
}
.rank {
  width: 22px;
  text-align: center;
  font-weight: 600;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.thumb {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--primary-light);
}
.info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.name,
.info .small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.name {
  font-size: 14px;
}
.small {
  font-size: 12px;
}
.warn {
  color: var(--danger);
}
.price {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.row-actions {
  display: flex;
  gap: 2px;
}
.icon-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font: inherit;
  line-height: 1;
}
.icon-btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}
.icon-btn.danger:hover:not(:disabled) {
  border-color: var(--danger);
  color: var(--danger);
}
.icon-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.add {
  flex-shrink: 0;
}
.center {
  text-align: center;
  padding: 32px 0;
}
.error {
  color: var(--danger);
  font-size: 14px;
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
@media (max-width: 860px) {
  .columns {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 600px) {
  .content {
    padding: 16px;
  }
  .price {
    display: none;
  }
}
</style>
