<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { usersApi, dutyApi } from '@/api/client';
import type { User } from '@/types';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  UserFilled,
  Refresh,
  Key,
  Lock,
  Unlock,
  Calendar,
  Top,
  Bottom,
  Delete,
  Plus,
  Check,
} from '@element-plus/icons-vue';

const activeTab = ref('users');

// Users state
const users = ref<User[]>([]);
const loading = ref(false);

const showResetDialog = ref(false);
const resetUserId = ref<number | null>(null);
const newPassword = ref('');

// Duty state
const dutyInfo = ref<{ duty_tester: string; roster: string[]; start_timestamp: number }>({
  duty_tester: '載入中...',
  roster: [],
  start_timestamp: 0,
});
const currentRoster = ref<string[]>([]);
const newTesterName = ref('');
const savingRoster = ref(false);
const dutyLoading = ref(false);

async function loadUsers() {
  loading.value = true;
  try {
    users.value = await usersApi.getUsers();
  } catch (err: any) {
    ElMessage.error(err.message || '載入人員列表失敗');
  } finally {
    loading.value = false;
  }
}

async function loadDuty() {
  dutyLoading.value = true;
  try {
    const res = await dutyApi.getDuty();
    if (res) {
      dutyInfo.value = res;
      currentRoster.value = [...(res.roster || [])];
    }
  } catch (err: any) {
    console.error('載入輪值失敗', err);
  } finally {
    dutyLoading.value = false;
  }
}

async function handleToggleActive(user: User) {
  const willBeActive = user.is_active === 1 ? 0 : 1;
  const actionText = willBeActive === 1 ? '啟用' : '停用';
  try {
    await ElMessageBox.confirm(`確定要${actionText}帳號【${user.username}】嗎？`, `${actionText}確認`, {
      type: willBeActive === 1 ? 'info' : 'warning',
    });
    await usersApi.toggleUserActive(user.id, willBeActive);
    user.is_active = willBeActive;
    ElMessage.success(`已${actionText}該帳號`);
  } catch {
    // cancelled
  }
}

function openResetDialog(user: User) {
  resetUserId.value = user.id;
  newPassword.value = '';
  showResetDialog.value = true;
}

async function handleResetPassword() {
  if (!resetUserId.value || !newPassword.value.trim()) {
    ElMessage.warning('請輸入新密碼');
    return;
  }
  try {
    await usersApi.resetPassword(resetUserId.value, newPassword.value.trim());
    ElMessage.success('密碼重設成功');
    showResetDialog.value = false;
  } catch (err: any) {
    ElMessage.error(err.message || '重設失敗');
  }
}

function moveRoster(idx: number, delta: number) {
  const target = idx + delta;
  if (target < 0 || target >= currentRoster.value.length) return;
  const temp = currentRoster.value[idx];
  currentRoster.value[idx] = currentRoster.value[target];
  currentRoster.value[target] = temp;
}

function removeRoster(idx: number) {
  currentRoster.value.splice(idx, 1);
}

function addTesterToRoster() {
  const name = newTesterName.value.trim();
  if (!name) return;
  if (currentRoster.value.includes(name)) {
    ElMessage.warning('該測試員已在排班名單中');
    return;
  }
  currentRoster.value.push(name);
  newTesterName.value = '';
}

async function saveDutyRoster() {
  savingRoster.value = true;
  try {
    await dutyApi.setRoster(currentRoster.value);
    ElMessage.success('除草值日輪值順序儲存成功！');
    await loadDuty();
  } catch (err: any) {
    ElMessage.error(err.message || '儲存失敗');
  } finally {
    savingRoster.value = false;
  }
}

onMounted(() => {
  loadUsers();
  loadDuty();
});
</script>

<template>
  <div class="space-y-6 pb-12">
    <!-- Top Header Card -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <el-icon class="text-xl"><UserFilled /></el-icon>
        </div>
        <div>
          <h2 class="text-base font-bold text-slate-800">人員與值日排班管理</h2>
          <p class="text-xs text-slate-500">管理 QA 團隊成員帳號、權限密碼與每週除草值日排班輪值順序</p>
        </div>
      </div>

      <el-button size="small" :icon="Refresh" :loading="loading || dutyLoading" @click="loadUsers(); loadDuty()">
        重新整理
      </el-button>
    </div>

    <!-- Main Content Tabs -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <el-tabs v-model="activeTab">
        <!-- Tab 1: Member Accounts -->
        <el-tab-pane label="成員帳號管理" name="users">
          <div class="pt-2">
            <el-table :data="users" style="width: 100%" stripe v-loading="loading">
              <el-table-column prop="id" label="ID" width="70" />
              <el-table-column prop="username" label="帳號" min-width="150" />
              <el-table-column prop="display_name" label="顯示姓名" min-width="150" />
              <el-table-column prop="role" label="角色" width="120">
                <template #default="{ row }">
                  <span
                    class="text-xs px-2.5 py-0.5 rounded-full font-bold"
                    :class="row.role === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'"
                  >
                    {{ row.role === 'admin' ? '管理員' : '一般成員' }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="is_active" label="狀態" width="110">
                <template #default="{ row }">
                  <el-tag :type="row.is_active === 1 ? 'success' : 'danger'" size="small">
                    {{ row.is_active === 1 ? '已啟用' : '未啟用' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="管理操作" width="220" align="right">
                <template #default="{ row }">
                  <div class="flex items-center justify-end gap-1">
                    <el-button
                      size="small"
                      :type="row.is_active === 1 ? 'warning' : 'success'"
                      link
                      :icon="row.is_active === 1 ? Lock : Unlock"
                      @click="handleToggleActive(row)"
                    >
                      {{ row.is_active === 1 ? '停用' : '啟用' }}
                    </el-button>
                    <el-button
                      size="small"
                      type="primary"
                      link
                      :icon="Key"
                      @click="openResetDialog(row)"
                    >
                      重設密碼
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <!-- Tab 2: Duty Roster Management (Moved here from Workspace) -->
        <el-tab-pane label="值日排班管理" name="duty">
          <div class="pt-2 max-w-3xl space-y-5" v-loading="dutyLoading">
            <!-- Current Duty Highlight -->
            <div class="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white rounded-xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <span class="text-xs text-indigo-300 font-semibold flex items-center gap-1.5">
                  <el-icon><Calendar /></el-icon> 目前當週除草員
                </span>
                <div class="text-2xl font-black text-amber-300 mt-1">
                  ⭐ {{ dutyInfo.duty_tester || '無' }}
                </div>
              </div>
              <div class="text-right text-xs text-indigo-200">
                <div>每週一 09:30 自動依序輪轉</div>
                <div class="text-emerald-400 font-bold mt-1">● 排班服務運行中</div>
              </div>
            </div>

            <!-- Roster Sequence Management -->
            <div class="border border-slate-200 rounded-xl p-5 space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-sm font-bold text-slate-800">輪值成員順序清單</h3>
                  <p class="text-xs text-slate-500">調整各測試人員每週輪流擔任值日生之先後順序</p>
                </div>
                <el-button
                  type="primary"
                  :icon="Check"
                  :loading="savingRoster"
                  @click="saveDutyRoster"
                >
                  儲存輪值設定
                </el-button>
              </div>

              <!-- Append new tester -->
              <div class="flex gap-2">
                <el-input
                  v-model="newTesterName"
                  placeholder="輸入測試人員顯示姓名..."
                  @keyup.enter="addTesterToRoster"
                />
                <el-button :icon="Plus" @click="addTesterToRoster">加入排班</el-button>
              </div>

              <!-- List of Roster -->
              <div class="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden bg-slate-50/50">
                <div
                  v-for="(name, idx) in currentRoster"
                  :key="name"
                  class="flex items-center justify-between p-3 bg-white hover:bg-slate-50 transition"
                >
                  <div class="flex items-center gap-3">
                    <span class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                      {{ idx + 1 }}
                    </span>
                    <span class="font-bold text-slate-800 text-sm">{{ name }}</span>
                    <span v-if="name === dutyInfo.duty_tester" class="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                      當週值勤中
                    </span>
                  </div>

                  <div class="flex items-center gap-1">
                    <el-button
                      size="small"
                      link
                      :disabled="idx === 0"
                      :icon="Top"
                      @click="moveRoster(idx, -1)"
                    />
                    <el-button
                      size="small"
                      link
                      :disabled="idx === currentRoster.length - 1"
                      :icon="Bottom"
                      @click="moveRoster(idx, 1)"
                    />
                    <el-button
                      size="small"
                      type="danger"
                      link
                      :icon="Delete"
                      @click="removeRoster(idx)"
                    />
                  </div>
                </div>

                <div v-if="currentRoster.length === 0" class="text-center py-8 text-xs text-slate-400">
                  尚未設定輪值名單
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- Reset Password Dialog -->
    <el-dialog v-model="showResetDialog" title="重設使用者密碼" width="420px" destroy-on-close>
      <div class="space-y-3">
        <label class="block text-xs font-semibold text-slate-700">新密碼</label>
        <el-input
          v-model="newPassword"
          type="password"
          show-password
          placeholder="請輸入新密碼"
        />
      </div>
      <template #footer>
        <el-button @click="showResetDialog = false">取消</el-button>
        <el-button type="primary" @click="handleResetPassword">確認重設</el-button>
      </template>
    </el-dialog>
  </div>
</template>
