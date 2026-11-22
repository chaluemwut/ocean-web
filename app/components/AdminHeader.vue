<script setup lang="ts">
const { user, logout } = useAuth()

const links = [
  { to: '/shops', label: 'คำขอเปิดร้าน' },
  { to: '/recommended', label: 'อาหารแนะนำ' },
  { to: '/messages', label: 'ข้อความ' },
]

function signOut() {
  logout()
  navigateTo('/')
}
</script>

<template>
  <header class="topbar">
    <div class="left">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">≈</span>
        <span>Ocean Admin</span>
      </div>
      <nav class="nav">
        <NuxtLink v-for="l in links" :key="l.to" :to="l.to" class="nav-link" active-class="active">
          {{ l.label }}
        </NuxtLink>
      </nav>
    </div>
    <div class="me">
      <img v-if="user?.pictureUrl" :src="user.pictureUrl" alt="" referrerpolicy="no-referrer" />
      <span class="me-email">{{ user?.email }}</span>
      <button class="btn btn-ghost" @click="signOut">ออกจากระบบ</button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.left {
  display: flex;
  align-items: center;
  gap: 20px;
  min-width: 0;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--primary);
  white-space: nowrap;
}
.brand-mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--primary);
  color: #fff;
  font-size: 18px;
}
.nav {
  display: flex;
  gap: 4px;
  overflow-x: auto;
}
.nav-link {
  padding: 6px 10px;
  border-radius: 8px;
  color: var(--muted);
  text-decoration: none;
  font-size: 14px;
  white-space: nowrap;
}
.nav-link:hover {
  color: var(--text);
}
.nav-link.active {
  color: var(--primary);
  background: var(--primary-light);
  font-weight: 600;
}
.me {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.me img {
  width: 30px;
  height: 30px;
  border-radius: 50%;
}
.me-email {
  font-size: 14px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 720px) {
  .topbar {
    padding: 10px 16px;
    flex-wrap: wrap;
  }
  .brand span:last-child,
  .me-email {
    display: none;
  }
}
</style>
