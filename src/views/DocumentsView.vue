<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { bulletinsApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import type { Bulletin } from '@/types';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Document,
  Reading,
  InfoFilled,
  Connection,
  Plus,
  Delete,
  Refresh,
} from '@element-plus/icons-vue';

const authStore = useAuthStore();
const activeTab = ref('bulletins');

// Bulletins state
const bulletins = ref<Bulletin[]>([]);
const bulletinsLoading = ref(false);
const filterCategory = ref('全部');

const newBulletinTitle = ref('');
const newBulletinContent = ref('');
const newBulletinCategory = ref('公告');
const showNewBulletinDialog = ref(false);

const filteredBulletins = computed(() => {
  if (filterCategory.value === '全部') return bulletins.value;
  return bulletins.value.filter((b) => b.category === filterCategory.value);
});

async function loadBulletins() {
  bulletinsLoading.value = true;
  try {
    bulletins.value = await bulletinsApi.getBulletins();
  } catch (err: any) {
    console.error('載入公告失敗', err);
  } finally {
    bulletinsLoading.value = false;
  }
}

async function handleCreateBulletin() {
  if (!newBulletinTitle.value.trim() || !newBulletinContent.value.trim()) {
    ElMessage.warning('請輸入公告標題與內容');
    return;
  }
  try {
    await bulletinsApi.createBulletin({
      title: newBulletinTitle.value.trim(),
      content: newBulletinContent.value.trim(),
      category: newBulletinCategory.value,
    });
    ElMessage.success('公告已發布');
    showNewBulletinDialog.value = false;
    newBulletinTitle.value = '';
    newBulletinContent.value = '';
    await loadBulletins();
  } catch (err: any) {
    ElMessage.error(err.message || '發布失敗');
  }
}

async function handleDeleteBulletin(id: number) {
  try {
    await ElMessageBox.confirm('確定要刪除此協作公告嗎？', '刪除公告', { type: 'warning' });
    await bulletinsApi.deleteBulletin(id);
    ElMessage.success('公告已刪除');
    await loadBulletins();
  } catch {
    // cancelled
  }
}

onMounted(() => {
  loadBulletins();
});
</script>

<template>
  <div class="space-y-6 pb-12">
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div class="flex items-center gap-2 mb-1">
        <el-icon class="text-blue-600 text-xl"><Reading /></el-icon>
        <h2 class="text-base font-bold text-slate-800">QA 內部作業程序、協作說明書與團體公告</h2>
      </div>
      <p class="text-xs text-slate-500">提供測試人員日常測試紀錄、單號規範、上正式流程及團隊協同準則</p>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <el-tabs v-model="activeTab">
        <!-- Tab 1: Group Collaboration Bulletins (First Tab) -->
        <el-tab-pane label="團體協作公告" name="bulletins">
          <div class="space-y-4 pt-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div class="flex items-center gap-2">
                <el-radio-group v-model="filterCategory" size="small">
                  <el-radio-button label="全部" />
                  <el-radio-button label="公告" />
                  <el-radio-button label="緊急通知" />
                  <el-radio-button label="流程異動" />
                  <el-radio-button label="值勤提醒" />
                </el-radio-group>
              </div>

              <div class="flex items-center gap-2">
                <el-button size="small" :icon="Refresh" @click="loadBulletins">
                  重新整理
                </el-button>
                <el-button type="primary" size="small" :icon="Plus" @click="showNewBulletinDialog = true">
                  發布協作公告
                </el-button>
              </div>
            </div>

            <!-- Bulletins List -->
            <div v-loading="bulletinsLoading" class="space-y-3">
              <div
                v-for="b in filteredBulletins"
                :key="b.id"
                class="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition space-y-2"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span
                      class="text-xs px-2.5 py-0.5 rounded-full font-bold"
                      :class="[
                        b.category === '緊急通知'
                          ? 'bg-rose-100 text-rose-700'
                          : b.category === '流程異動'
                          ? 'bg-amber-100 text-amber-700'
                          : b.category === '值勤提醒'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-blue-100 text-blue-700'
                      ]"
                    >
                      {{ b.category || '公告' }}
                    </span>
                    <h4 class="font-bold text-slate-800 text-sm">{{ b.title }}</h4>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-slate-400">
                      {{ b.author_name ? `${b.author_name} · ` : '' }}{{ b.created_at || '近期' }}
                    </span>
                    <el-button
                      v-if="authStore.isAdmin || b.author_name === authStore.currentDisplayName"
                      type="danger"
                      link
                      size="small"
                      :icon="Delete"
                      @click="handleDeleteBulletin(b.id)"
                    />
                  </div>
                </div>
                <p class="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed pl-1">
                  {{ b.content }}
                </p>
              </div>

              <div v-if="filteredBulletins.length === 0" class="text-center py-12 text-slate-400 text-xs">
                目前尚無此分類之協作公告
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- Tab 2: Guidelines -->
        <el-tab-pane label="測試報告撰寫準則" name="guidelines">
          <div class="space-y-6 pt-3 text-slate-700 leading-relaxed text-sm">
            <section>
              <h3 class="font-bold text-base text-slate-900 mb-2 flex items-center gap-1.5">
                <el-icon class="text-blue-600"><Document /></el-icon> 一、案件編號命名規則
              </h3>
              <ul class="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
                <li><strong class="text-blue-700 font-mono">T 開頭</strong>：一般功能驗證與專案測試報告（如 <code>T20261016-01</code>）。</li>
                <li><strong class="text-rose-700 font-mono">P 開頭</strong>：上正式環境驗證報告（如 <code>P20261016-01</code>）。</li>
                <li>系統提供「產生最新單號」按鈕，依據當天日期自動累加序號，並具有後端防搶單衝突機制。</li>
              </ul>
            </section>

            <section>
              <h3 class="font-bold text-base text-slate-900 mb-2 flex items-center gap-1.5">
                <el-icon class="text-blue-600"><InfoFilled /></el-icon> 二、欄位填寫與預覽雙向同步規範
              </h3>
              <ul class="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
                <li><strong>專案名稱</strong>：必填欄位，請完整填寫 Jira 或工單標題。</li>
                <li><strong>備註 (工單說明)</strong>：左側表單備註，對應右側預覽框中的「備註：」區塊，支援多行文字。</li>
                <li><strong>測試員備註</strong>：屬於內部獨立備註，僅附加於儲存時 notes 的尾端（<code>測試員備註：...</code>），不干擾正式對外成果報告。</li>
              </ul>
            </section>

            <section>
              <h3 class="font-bold text-base text-slate-900 mb-2 flex items-center gap-1.5">
                <el-icon class="text-blue-600"><Connection /></el-icon> 三、測試狀態定義
              </h3>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div class="font-bold text-emerald-800 text-sm">驗證通過 (Pass)</div>
                  <div class="text-xs text-emerald-700 mt-1">所有測試案例皆驗證通過且無阻斷性重大 Bug。</div>
                </div>
                <div class="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                  <div class="font-bold text-rose-800 text-sm">驗證失敗 (Fail)</div>
                  <div class="text-xs text-rose-700 mt-1">功能未達驗收標準或出現嚴重程式錯誤，退回開發人員修正。</div>
                </div>
                <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div class="font-bold text-amber-800 text-sm">阻礙中 (Blocked)</div>
                  <div class="text-xs text-amber-700 mt-1">因環境異常、依賴服務尚未就緒或權限問題導致測試無法繼續進行。</div>
                </div>
              </div>
            </section>
          </div>
        </el-tab-pane>

        <!-- Tab 3: Workflow -->
        <el-tab-pane label="上正式與值勤流程" name="workflow">
          <div class="space-y-5 pt-3 text-sm text-slate-700 leading-relaxed">
            <div>
              <h4 class="font-bold text-slate-900 mb-1">● 上正式驗證 SOP</h4>
              <p class="text-xs text-slate-600">
                每逢程式碼發布至正式機後，請主測或當日值班人員立即使用「新增上正式 (P)」建立記錄，驗證核心路徑無誤後，一鍵複製報告發送至發布協調頻道。
              </p>
            </div>
            <div>
              <h4 class="font-bold text-slate-900 mb-1">● 值勤輪值交接</h4>
              <p class="text-xs text-slate-600">
                每週一 09:30 前由主值班確認本週輪值表，並關注「阻礙中」案件與突發問題，及時發布於協作公告欄中提醒團隊。
              </p>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- New Bulletin Dialog -->
    <el-dialog v-model="showNewBulletinDialog" title="發布團體協作公告" width="520px" destroy-on-close>
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">公告分類</label>
          <el-select v-model="newBulletinCategory" class="w-full">
            <el-option label="公告" value="公告" />
            <el-option label="緊急通知" value="緊急通知" />
            <el-option label="流程異動" value="流程異動" />
            <el-option label="值勤提醒" value="值勤提醒" />
          </el-select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">公告標題</label>
          <el-input v-model="newBulletinTitle" placeholder="如：本週四停機維護公告" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">詳細說明內容</label>
          <el-input
            v-model="newBulletinContent"
            type="textarea"
            :rows="5"
            placeholder="請詳細填寫公告說明事項..."
          />
        </div>
      </div>
      <template #footer>
        <el-button @click="showNewBulletinDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreateBulletin">確認發布</el-button>
      </template>
    </el-dialog>
  </div>
</template>
