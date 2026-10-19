<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { dutyApi } from '@/api/client';
import { ElMessageBox, ElMessage } from 'element-plus';
import {
  DataAnalysis,
  Document,
  User,
  Files,
  Briefcase,
  SwitchButton,
} from '@element-plus/icons-vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const dutyTester = ref('載入中...');

const currentPath = computed(() => route.path);

const navItems = computed(() => {
  const items = [
    { label: '儀表板', path: '/dashboard', icon: DataAnalysis },
    { label: '個人工作臺', path: '/workspace', icon: Briefcase },
    { label: '報告中心', path: '/reports', icon: Files },
    { label: '文件規範', path: '/documents', icon: Document },
  ];
  if (authStore.isAdmin) {
    items.push({ label: '人員管理', path: '/users', icon: User });
  }
  return items;
});

async function loadDuty() {
  try {
    const res = await dutyApi.getDuty();
    if (res && res.duty_tester) {
      dutyTester.value = res.duty_tester;
    } else {
      dutyTester.value = '無';
    }
  } catch {
    dutyTester.value = '無';
  }
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('確定要登出系統嗎？', '登出確認', {
      confirmButtonText: '登出',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await authStore.logout();
    ElMessage.success('已安全登出');
    router.push('/login');
  } catch {
    // cancelled
  }
}

onMounted(() => {
  loadDuty();
});
</script>

<template>
  <header class="bg-gray-900 text-white shadow-lg sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo / Brand & Duty Person Banner -->
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow">
            Q
          </div>
          <div class="flex items-center gap-2">
            <div>
              <span class="font-bold text-lg tracking-wide text-white">Q-Draft除草室</span>
             
            </div>
            <!-- Top Duty Tester Badge -->
            <div class="hidden sm:flex items-center bg-yellow-400/15 text-yellow-300 px-3 py-1 rounded-md text-xs font-bold border border-yellow-400/30 shadow-sm ml-2">
              ⭐ 本週除草員：<span class="ml-1 text-white font-extrabold">{{ dutyTester }}</span>
            </div>
          </div>
        </div>

        <!-- Navigation Links -->
        <nav class="hidden md:flex items-center space-x-1">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-medium transition-colors"
            :class="[
              currentPath === item.path
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white',
            ]"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            {{ item.label }}
          </router-link>
        </nav>

        <!-- User Info & Logout -->
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-300">
              哈囉，<strong class="text-white">{{ authStore.currentDisplayName }}</strong>
            </span>
            <span
              v-if="authStore.isAdmin"
              class="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-semibold"
            >
              管理員
            </span>
          </div>

          <el-button
            type="danger"
            size="small"
            plain
            :icon="SwitchButton"
            @click="handleLogout"
          >
            登出
          </el-button>
        </div>
      </div>
    </div>
  </header>
</template>
