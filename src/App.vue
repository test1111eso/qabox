<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import Navbar from '@/components/layout/Navbar.vue';
import zhTw from 'element-plus/es/locale/lang/zh-tw';

const authStore = useAuthStore();
</script>

<template>
  <el-config-provider :locale="zhTw">
    <div class="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar v-if="authStore.isAuthenticated" />
      <main :class="authStore.isAuthenticated ? 'max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1' : 'flex-1'">
        <router-view />
      </main>
    </div>
  </el-config-provider>
</template>
