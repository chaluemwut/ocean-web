<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

interface Message {
  id: number
  shopId: number | null
  fromAdmin: boolean
  body: string
  createdAt: string
  readAt: string | null
}

interface Thread {
  userId: number
  shop: { id: number; name: string | null; imageUrl: string | null; status: string | null } | null
  user: { id: number; email: string; name: string | null; pictureUrl: string | null } | null
  lastMessage: Message
  unread: number
  awaitingReply: boolean
  replyDueAt: string | null
}

type Filter = 'waiting' | 'all'

const api = useApi()

const threads = ref<Thread[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const filter = ref<Filter>('waiting')
const search = ref('')

const selected = ref<Thread | null>(null)
const messages = ref<Message[]>([])
const loadingThread = ref(false)
const reply = ref('')
const sending = ref(false)
const sendError = ref<string | null>(null)
const listEl = ref<HTMLElement | null>(null)

const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | undefined
let poller: ReturnType<typeof setInterval> | undefined

const keyOf = (t: { userId: number; shop: { id: number } | null }) => `${t.userId}:${t.shop?.id ?? ''}`

const title = (t: Thread) => (t.shop ? t.shop.name || `ร้าน #${t.shop.id}` : 'เรื่องทั่วไป (ไม่ระบุร้าน)')
const ownerLabel = (t: Thread) => t.user?.name || t.user?.email || `ผู้ใช้ #${t.userId}`

const waitingCount = computed(() => threads.value.filter((t) => t.awaitingReply).length)

const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  return threads.value
    .filter((t) => filter.value === 'all' || t.awaitingReply)
    .filter(
      (t) =>
        !q ||
        [t.shop?.name, t.user?.name, t.user?.email].some((s) => s?.toLowerCase().includes(q)),
    )
    .sort((a, b) => {
      // Waiting threads: the one closest to (or past) its deadline first.
      if (a.awaitingReply && b.awaitingReply && a.replyDueAt && b.replyDueAt) {
        return Date.parse(a.replyDueAt) - Date.parse(b.replyDueAt)
      }
      if (a.awaitingReply !== b.awaitingReply) return a.awaitingReply ? -1 : 1
      return Date.parse(b.lastMessage.createdAt) - Date.parse(a.lastMessage.createdAt)
    })
})

async function loadThreads() {
  loading.value = true
  error.value = null
  try {
    threads.value = await api<Thread[]>('/api/admin/support/threads')
    if (selected.value) {
      const fresh = threads.value.find((t) => keyOf(t) === keyOf(selected.value!))
      if (fresh) selected.value = fresh
    }
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

async function open(t: Thread) {
  selected.value = t
  sendError.value = null
  loadingThread.value = true
  messages.value = []
  try {
    messages.value = await api<Message[]>('/api/admin/support/messages', {
      query: { userId: t.userId, ...(t.shop ? { shopId: t.shop.id } : {}) },
    })
    t.unread = 0
    scrollToEnd()
  } catch (e) {
    sendError.value = errorMessage(e)
  } finally {
    loadingThread.value = false
  }
}

async function send() {
  const t = selected.value
  const body = reply.value.trim()
  if (!t || !body || sending.value) return
  sending.value = true
  sendError.value = null
  try {
    const m = await api<Message>('/api/admin/support/messages', {
      method: 'POST',
      body: { userId: t.userId, shopId: t.shop?.id ?? null, body },
    })
    messages.value.push(m)
    reply.value = ''
    t.lastMessage = m
    t.awaitingReply = false
    t.replyDueAt = null
    t.unread = 0
    scrollToEnd()
  } catch (e) {
    sendError.value = errorMessage(e)
  } finally {
    sending.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  // Ctrl/Cmd + Enter sends; plain Enter makes a new line.
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    send()
  }
}

function scrollToEnd() {
  nextTick(() => {
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
  })
}

/** "เหลือ 5 ชม." / "เกินกำหนด 2 ชม." for the 24-hour reply promise. */
function dueLabel(iso: string | null): { text: string; late: boolean; soon: boolean } | null {
  if (!iso) return null
  const ms = Date.parse(iso) - now.value
  const abs = Math.abs(ms)
  const h = Math.floor(abs / 3_600_000)
  const m = Math.floor((abs % 3_600_000) / 60_000)
  const span = h > 0 ? `${h} ชม.` : `${m} นาที`
  return ms < 0
    ? { text: `เกินกำหนด ${span}`, late: true, soon: false }
    : { text: `เหลือ ${span}`, late: false, soon: ms < 4 * 3_600_000 }
}

const fmt = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
const formatDate = (iso: string) => fmt.format(new Date(iso))

onMounted(() => {
  loadThreads()
  ticker = setInterval(() => (now.value = Date.now()), 60_000)
  poller = setInterval(() => {
    if (!document.hidden) loadThreads()
  }, 60_000)
})
onBeforeUnmount(() => {
  clearInterval(ticker)
  clearInterval(poller)
})
</script>

<template>
  <div class="page">
    <AdminHeader />

    <main class="content">
      <div class="heading">
        <div>
          <h1>ข้อความถึงแพลตฟอร์ม</h1>
          <p class="muted sub">ผู้ใช้ได้รับแจ้งว่าจะได้รับคำตอบภายใน 24 ชั่วโมง</p>
        </div>
        <button class="btn btn-ghost" :disabled="loading" @click="loadThreads">รีเฟรช</button>
      </div>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <div :class="['layout', { 'has-selection': selected }]">
        <!-- Thread list -->
        <aside class="threads">
          <div class="toolbar">
            <nav class="tabs" role="tablist">
              <button
                role="tab"
                :aria-selected="filter === 'waiting'"
                :class="['tab', { active: filter === 'waiting' }]"
                @click="filter = 'waiting'"
              >
                รอตอบกลับ <span v-if="waitingCount" class="count">{{ waitingCount }}</span>
              </button>
              <button
                role="tab"
                :aria-selected="filter === 'all'"
                :class="['tab', { active: filter === 'all' }]"
                @click="filter = 'all'"
              >
                ทั้งหมด
              </button>
            </nav>
            <input v-model="search" class="search" type="search" placeholder="ค้นหาร้าน / ผู้ใช้" />
          </div>

          <p v-if="loading && !threads.length" class="muted center">กำลังโหลด…</p>
          <p v-else-if="!visible.length" class="muted center">
            {{ filter === 'waiting' ? 'ไม่มีข้อความที่รอตอบกลับ' : 'ยังไม่มีข้อความ' }}
          </p>

          <ul v-else class="thread-list">
            <li v-for="t in visible" :key="keyOf(t)">
              <button
                :class="['thread', { active: selected && keyOf(selected) === keyOf(t) }]"
                @click="open(t)"
              >
                <img v-if="t.shop?.imageUrl" class="avatar" :src="apiUrl(t.shop.imageUrl)" alt="" loading="lazy" />
                <span v-else class="avatar avatar-fallback" aria-hidden="true">{{ t.shop ? '🏪' : '💬' }}</span>
                <span class="thread-main">
                  <span class="thread-top">
                    <strong class="ellipsis">{{ title(t) }}</strong>
                    <span v-if="t.unread" class="badge">{{ t.unread }}</span>
                  </span>
                  <span class="ellipsis small muted">{{ ownerLabel(t) }}</span>
                  <span class="ellipsis small snippet">
                    <span v-if="t.lastMessage.fromAdmin" class="muted">คุณ: </span>{{ t.lastMessage.body }}
                  </span>
                  <span class="thread-bottom small">
                    <span class="muted">{{ formatDate(t.lastMessage.createdAt) }}</span>
                    <span
                      v-if="dueLabel(t.replyDueAt)"
                      :class="['due', { late: dueLabel(t.replyDueAt)!.late, soon: dueLabel(t.replyDueAt)!.soon }]"
                    >
                      {{ dueLabel(t.replyDueAt)!.text }}
                    </span>
                    <span v-else class="answered">ตอบแล้ว</span>
                  </span>
                </span>
              </button>
            </li>
          </ul>
        </aside>

        <!-- Conversation -->
        <section class="conversation">
          <div v-if="!selected" class="placeholder muted">เลือกข้อความทางซ้ายเพื่อดูและตอบกลับ</div>

          <template v-else>
            <header class="conv-head">
              <button class="btn btn-ghost back" aria-label="กลับ" @click="selected = null">←</button>
              <div class="conv-title">
                <strong class="ellipsis">{{ title(selected) }}</strong>
                <span class="small muted ellipsis">
                  {{ ownerLabel(selected) }}<template v-if="selected.user?.email && selected.user?.name"> · {{ selected.user.email }}</template>
                </span>
              </div>
              <span
                v-if="dueLabel(selected.replyDueAt)"
                :class="['due', { late: dueLabel(selected.replyDueAt)!.late, soon: dueLabel(selected.replyDueAt)!.soon }]"
              >
                {{ dueLabel(selected.replyDueAt)!.text }}
              </span>
            </header>

            <div ref="listEl" class="messages">
              <p v-if="loadingThread" class="muted center">กำลังโหลด…</p>
              <div v-for="m in messages" :key="m.id" :class="['msg', m.fromAdmin ? 'admin' : 'user']">
                <div class="bubble">{{ m.body }}</div>
                <span class="small muted">
                  {{ m.fromAdmin ? 'ทีมงาน' : 'ผู้ใช้' }} · {{ formatDate(m.createdAt) }}
                  <template v-if="m.fromAdmin && m.readAt"> · อ่านแล้ว</template>
                </span>
              </div>
            </div>

            <form class="composer" @submit.prevent="send">
              <textarea
                v-model="reply"
                rows="3"
                maxlength="2000"
                placeholder="พิมพ์คำตอบ… (Ctrl/⌘ + Enter เพื่อส่ง)"
                @keydown="onKeydown"
              />
              <p v-if="sendError" class="error">{{ sendError }}</p>
              <div class="composer-actions">
                <span class="small muted">ผู้ใช้จะได้รับการแจ้งเตือนในแอป</span>
                <button class="btn btn-primary" type="submit" :disabled="sending || !reply.trim()">
                  {{ sending ? 'กำลังส่ง…' : 'ส่งคำตอบ' }}
                </button>
              </div>
            </form>
          </template>
        </section>
      </div>
    </main>
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
  gap: 12px;
  margin-bottom: 16px;
}
h1 {
  font-size: 24px;
  margin: 0;
}
.sub {
  margin: 4px 0 0;
  font-size: 14px;
}
.small {
  font-size: 12px;
}
.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.layout {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 16px;
  height: calc(100vh - 190px);
  min-height: 480px;
}
.threads,
.conversation {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.toolbar {
  padding: 8px 12px 12px;
  border-bottom: 1px solid var(--border);
}
.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}
.tab {
  border: 0;
  background: none;
  padding: 8px 10px;
  font: inherit;
  font-size: 14px;
  color: var(--muted);
  border-bottom: 2px solid transparent;
  cursor: pointer;
}
.tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
  font-weight: 600;
}
.count {
  display: inline-block;
  min-width: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--primary);
  color: #fff;
  font-size: 12px;
  text-align: center;
}
.search {
  width: 100%;
  font: inherit;
  font-size: 14px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
}
.thread-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
}
.thread {
  display: flex;
  gap: 12px;
  width: 100%;
  text-align: left;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  border-bottom: 1px solid var(--border);
  padding: 12px;
  cursor: pointer;
}
.thread:hover {
  background: var(--bg);
}
.thread.active {
  background: var(--primary-light);
}
.avatar {
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  object-fit: cover;
  background: var(--primary-light);
}
.avatar-fallback {
  display: grid;
  place-items: center;
  font-size: 20px;
}
.thread-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.thread-top,
.thread-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.snippet {
  color: var(--text-2);
}
.badge {
  flex: none;
  min-width: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--danger);
  color: #fff;
  font-size: 12px;
  text-align: center;
}
.due {
  flex: none;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 8px;
  background: var(--primary-light);
  color: var(--primary-dark);
}
.due.soon {
  background: #fff4e0;
  color: #9a5b00;
}
.due.late {
  background: var(--danger-bg);
  color: var(--danger);
}
.answered {
  color: var(--muted);
}
.placeholder {
  margin: auto;
  padding: 24px;
  text-align: center;
}
.conv-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.conv-title {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.back {
  display: none;
  padding: 6px 10px;
}
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.msg {
  display: flex;
  flex-direction: column;
  max-width: 75%;
  gap: 3px;
}
.msg.user {
  align-self: flex-start;
}
.msg.admin {
  align-self: flex-end;
  align-items: flex-end;
}
.bubble {
  padding: 10px 14px;
  border-radius: 16px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.45;
  font-size: 15px;
}
.msg.user .bubble {
  background: var(--bg);
  border: 1px solid var(--border);
  border-bottom-left-radius: 4px;
}
.msg.admin .bubble {
  background: var(--primary);
  color: #fff;
  border-bottom-right-radius: 4px;
}
.composer {
  border-top: 1px solid var(--border);
  padding: 12px 16px;
}
.composer textarea {
  width: 100%;
  font: inherit;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  resize: vertical;
}
.composer textarea:focus {
  outline: 2px solid var(--primary);
  outline-offset: -1px;
}
.composer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.center {
  text-align: center;
  padding: 32px 0;
}
.error {
  color: var(--danger);
  font-size: 14px;
}
@media (prefers-color-scheme: dark) {
  .due.soon {
    background: #3a2c12;
    color: #ffc66b;
  }
}
@media (max-width: 800px) {
  .content {
    padding-left: 16px;
    padding-right: 16px;
  }
  .layout {
    grid-template-columns: 1fr;
    height: calc(100vh - 170px);
  }
  .layout.has-selection .threads,
  .layout:not(.has-selection) .conversation {
    display: none;
  }
  .back {
    display: inline-block;
  }
  .msg {
    max-width: 88%;
  }
}
</style>
