<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { ElMessage } from 'element-plus';
import { User, Lock, UserFilled } from '@element-plus/icons-vue';

const router = useRouter();
const authStore = useAuthStore();

const isRegister = ref(false);
const loading = ref(false);

const username = ref('');
const password = ref('');
const displayName = ref('');

async function handleSubmit() {
  if (!username.value.trim() || !password.value.trim()) {
    ElMessage.warning('請輸入帳號與密碼');
    return;
  }

  if (isRegister.value && !displayName.value.trim()) {
    ElMessage.warning('請輸入顯示名稱');
    return;
  }

  loading.value = true;
  try {
    if (isRegister.value) {
      await authStore.register({
        username: username.value.trim(),
        password: password.value,
        display_name: displayName.value.trim(),
      });
      ElMessage.success('註冊成功！請等待管理員啟用或直接登入');
      isRegister.value = false;
    } else {
      await authStore.login({
        username: username.value.trim(),
        password: password.value,
      });
      router.push('/dashboard');
    }
  } catch (err: any) {
    ElMessage.error(err.message || '操作失敗');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700/60">
      <!-- Header -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-black text-2xl shadow-lg mb-4">
          Q
        </div>
        <h1 class="text-2xl font-bold text-white tracking-wide">
          {{ isRegister ? '註冊帳號' : 'Q-Draft 除草室' }}
        </h1>
        <p class="text-sm text-slate-400 mt-1">
          {{ isRegister ? '建立新的測試人員身分' : '讓測試報告，一鍵成稿' }}
        </p>
      </div>

      <!-- Form -->
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">帳號</label>
          <el-input
            v-model="username"
            placeholder="請輸入帳號"
            :prefix-icon="User"
            size="large"
          />
        </div>

        <div v-if="isRegister">
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">顯示姓名 (測試人員名)</label>
          <el-input
            v-model="displayName"
            placeholder="如：王小明"
            :prefix-icon="UserFilled"
            size="large"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">密碼</label>
          <el-input
            v-model="password"
            type="password"
            show-password
            placeholder="請輸入密碼"
            :prefix-icon="Lock"
            size="large"
          />
        </div>

        <div class="pt-2">
          <el-button
            type="primary"
            size="large"
            class="w-full !rounded-lg !py-3 !font-semibold !text-base shadow-lg shadow-blue-500/20"
            :loading="loading"
            native-type="submit"
          >
            {{ isRegister ? '送出註冊' : '登入系統' }}
          </el-button>
        </div>
      </form>

      <!-- Toggle mode -->
      <div class="mt-6 text-center text-xs text-slate-400">
        <span>{{ isRegister ? '已經有帳號了嗎？' : '還沒有帳號嗎？' }}</span>
        <button
          type="button"
          class="ml-1.5 text-blue-400 hover:text-blue-300 font-semibold underline cursor-pointer"
          @click="isRegister = !isRegister"
        >
          {{ isRegister ? '點此登入' : '點此註冊' }}
        </button>
      </div>
    </div>
  </div>
</template>
