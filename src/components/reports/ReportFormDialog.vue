<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Report, ReportCategory, ReportStatus, ReportType } from '@/types';
import { reportsApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getTaiwanToday } from '@/utils/date';
import {
  parseReportNotesToFields,
  buildFullReportTemplate,
  buildFullNotesFromParts,
  getNotesWithoutTesterRemark,
  getTesterRemarkFromReport,
} from '@/utils/parser';
import { ElMessage } from 'element-plus';
import { DocumentCopy, Refresh, Monitor } from '@element-plus/icons-vue';

const QA_BYPASS_DOC_URL =
  'https://docs.google.com/document/d/1yMUBr39HqPE-I2gVyY57YT9cPubu3K9HxJndfOEmLXw/edit?pli=1&tab=t.0';

const props = defineProps<{
  modelValue: boolean;
  mode: 'create' | 'edit' | 'copy';
  reportType?: ReportType;
  initialReport?: Report | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'saved', report: Report): void;
}>();

const authStore = useAuthStore();
const saving = ref(false);
const allocatingCaseNo = ref(false);

// Active report type (normal: T / prod: P)
const currentType = ref<ReportType>('normal');

// Categories
const categories: ReportCategory[] = ['求職', '新求才', '現版求才', '活動', '其他'];

// Form fields
const rawTicket = ref('');
const caseNo = ref('');
const projectName = ref('');
const category = ref<ReportCategory>('其他');
const testDate = ref(getTaiwanToday());
const testerName = ref(authStore.currentDisplayName);
const developer = ref('');
const parentTicket = ref('');
const subTicket = ref('');
const version = ref('');
const env = ref('');

// Device state
const deviceMain = ref('');
const isIpad = ref(false);
const ipadVersion = ref('');
const isIphone = ref(false);
const iphoneVersion = ref('');
const isOther = ref(false);
const otherVersion = ref('');

const finalDeviceStr = computed(() => {
  const parts: string[] = [];
  if (deviceMain.value.trim()) parts.push(deviceMain.value.trim());
  if (isIpad.value) parts.push(`iPad ${ipadVersion.value}`.trim());
  if (isIphone.value) parts.push(`iPhone ${iphoneVersion.value}`.trim());
  if (isOther.value && otherVersion.value.trim()) parts.push(otherVersion.value.trim());
  return parts.join(' / ');
});

// Grafana state
const showGrafana = ref(false);
const grafanaInput = ref('');

// Test case state
const testCaseUrl = ref('');
const tcPreset = ref<'cloud' | 'none' | ''>('');

// Test steps state
const testSteps = ref('');

// BY PASS state
const isBypass = ref(false);
const bypassReason1 = ref(false);
const bypassReason2 = ref(false);

// Form steps / notes
const formSteps = ref(''); // 備註 (工單帶入)
const testerRemark = ref(''); // 測試員備註
const risk = ref('低');
const passRate = ref('100%');
const status = ref<ReportStatus>('Blocked');

// Preview override
const manualPreview = ref('');
const isManualPreview = ref(false);

const envPresets = [
  { label: '主網', url: 'https://www.1111.com.tw/' },
  { label: 'QA', url: 'https://www-qa.1111.com.tw/' },
  { label: 'STG', url: 'https://www-stg.1111.com.tw/' },
  { label: 'IIS-QA', url: 'https://www-iis-qa.1111.com.tw/' },
  { label: 'IIS-STG', url: 'https://www-iis-stg.1111.com.tw/' },
  { label: '招募', url: 'https://recruit.1111.com.tw' },
  { label: '招募QA', url: 'https://recruit-qa.1111.com.tw' },
  { label: '招募STG', url: 'https://recruit-stg.1111.com.tw/' },
];

function toggleEnvPreset(url: string) {
  let lines = env.value.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.includes(url)) {
    lines = lines.filter((l) => l !== url);
  } else {
    lines.push(url);
  }
  env.value = lines.join('\n');
}

function isEnvActive(url: string) {
  const lines = env.value.split('\n').map((l) => l.trim());
  return lines.includes(url);
}

async function handleDetectBrowser() {
  let browserName = 'Browser';
  let ver = '';
  const ua = navigator.userAgent;
  let is64 = ua.includes('Win64') || ua.includes('x64') || ua.includes('Mac OS') ? ' (64 位元)' : '';

  try {
    const nav = navigator as any;
    if (nav.userAgentData && nav.userAgentData.getHighEntropyValues) {
      const hints = await nav.userAgentData.getHighEntropyValues(['fullVersionList', 'bitness']);
      if (hints.bitness === '64') {
        is64 = ' (64 位元)';
      }
      if (hints.fullVersionList && hints.fullVersionList.length > 0) {
        const targetBrand = hints.fullVersionList.find(
          (b: any) => b.brand.includes('Edge') || b.brand.includes('Google Chrome') || b.brand.includes('Chrome')
        );
        if (targetBrand) {
          if (targetBrand.brand.includes('Edge')) browserName = 'Edge';
          else if (targetBrand.brand.includes('Chrome')) browserName = 'Chrome';
          ver = targetBrand.version;
        }
      }
    }
  } catch {
    // fallback
  }

  if (!ver) {
    if (ua.includes('Edg/')) {
      browserName = 'Edge';
      ver = ua.match(/Edg\/([\d.]+)/)?.[1] || '';
    } else if (ua.includes('Chrome/')) {
      browserName = 'Chrome';
      ver = ua.match(/Chrome\/([\d.]+)/)?.[1] || '';
    } else if (ua.includes('Firefox/')) {
      browserName = 'Firefox';
      ver = ua.match(/Firefox\/([\d.]+)/)?.[1] || '';
    } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
      browserName = 'Safari';
      ver = ua.match(/Version\/([\d.]+)/)?.[1] || '';
    }
  }

  deviceMain.value = `${browserName} 版本：${ver}${is64}`;
  ElMessage.success('已自動帶入本機瀏覽器完整版號！');
}

function handleGrafanaInput() {
  const text = grafanaInput.value.trim();
  if (!text) return;
  const extractedVersions: string[] = [];
  const regex = /(Frontend|Backend)\s*-\s*([a-zA-Z]+)[^a-zA-Z0-9]+([a-zA-Z0-9.\-_]+)/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const type = match[1].toLowerCase() === 'frontend' ? '前端' : '後端';
    const envStr = match[2].toUpperCase();
    const v = match[3];
    extractedVersions.push(`${type}(${envStr}): ${v}`);
  }
  if (extractedVersions.length > 0) {
    version.value = extractedVersions.join('\n');
    ElMessage.success('已自動比對並填入軟體版本！');
  }
}

function setTcPreset(type: 'cloud' | 'none') {
  tcPreset.value = type;
  if (type === 'cloud') {
    testCaseUrl.value = 'https://drive.google.com/drive/u/0/folders/1W2YL25vRaA1ZhjzHDa-N6flzi4TVmvwN';
  } else {
    testCaseUrl.value = '不出案例';
  }
}

function handleBypassToggle() {
  if (!isBypass.value) {
    bypassReason1.value = false;
    bypassReason2.value = false;
    if (formSteps.value.includes('BY PASS')) {
      formSteps.value = '';
    }
  } else {
    updateBypassToSteps();
  }
}

function updateBypassToSteps() {
  if (!isBypass.value) return;
  const reasons: string[] = [];
  if (bypassReason1.value) {
    reasons.push('1. 本單需求基於內部文件(QA 內部作業程序與協作說明書)，不出案例');
  }
  if (bypassReason2.value) {
    reasons.push('2. 本單需求為UI調整，符合內部文件規範，不出案例');
  }

  if (reasons.length === 0) {
    formSteps.value = `BY PASS\nQA 內部作業程序與協作說明書：${QA_BYPASS_DOC_URL}`;
  } else {
    formSteps.value =
      `BY PASS\n原因：\n` +
      reasons.map((r) => `- ${r}`).join('\n') +
      `\nQA 內部作業程序與協作說明書：${QA_BYPASS_DOC_URL}`;
  }
}

function handleStepsInput() {
  const text = formSteps.value;
  const m1 = text.includes('基於內部文件');
  const m2 = text.includes('UI調整');
  bypassReason1.value = m1;
  bypassReason2.value = m2;
  isBypass.value = text.includes('BY PASS') || text.includes('ByPass') || m1 || m2;
}

function parseDevicesIntoFields(str: string) {
  if (!str) {
    deviceMain.value = '';
    isIpad.value = false;
    ipadVersion.value = '';
    isIphone.value = false;
    iphoneVersion.value = '';
    isOther.value = false;
    otherVersion.value = '';
    return;
  }
  const parts = str.split(' / ').map((p) => p.trim());
  let main = '';
  isIpad.value = false;
  isIphone.value = false;
  isOther.value = false;

  for (const part of parts) {
    if (/^iPad(?:\s+(.*))?$/i.test(part)) {
      isIpad.value = true;
      ipadVersion.value = part.replace(/^iPad\s*/i, '').trim();
    } else if (/^iPhone(?:\s+(.*))?$/i.test(part)) {
      isIphone.value = true;
      iphoneVersion.value = part.replace(/^iPhone\s*/i, '').trim();
    } else if (!main) {
      main = part;
    } else {
      isOther.value = true;
      otherVersion.value = part;
    }
  }
  deviceMain.value = main;
}

const generatedPreview = computed(() => {
  if (isManualPreview.value && manualPreview.value) {
    return manualPreview.value;
  }
  return buildFullReportTemplate({
    category: category.value,
    case_no: caseNo.value,
    project_name: projectName.value,
    test_date: testDate.value,
    tester_name: testerName.value,
    developer: developer.value,
    parent_ticket: parentTicket.value,
    sub_ticket: subTicket.value,
    version: version.value,
    env: env.value,
    devices: finalDeviceStr.value,
    test_case: testCaseUrl.value,
    test_steps: testSteps.value,
    risk: risk.value,
    pass_rate: passRate.value,
    steps: formSteps.value,
    status: status.value,
  });
});

async function fetchNextCaseNo() {
  allocatingCaseNo.value = true;
  try {
    const nextNo = await reportsApi.getNextCaseNo(testDate.value, currentType.value);
    caseNo.value = nextNo;
  } catch (err: any) {
    ElMessage.error(err.message || '無法取得案件編號');
  } finally {
    allocatingCaseNo.value = false;
  }
}

async function handleTypeChange(type: ReportType) {
  currentType.value = type;
  if (props.mode === 'create' || props.mode === 'copy') {
    await fetchNextCaseNo();
  }
}

function handleTicketInput() {
  if (!rawTicket.value.trim()) return;
  const parsed = parseReportNotesToFields(rawTicket.value);

  // Note: Do NOT overwrite caseNo with parsed.case_no to prevent sequence collision!
  if (parsed.project_name) projectName.value = parsed.project_name;
  if (parsed.test_date) testDate.value = parsed.test_date;
  if (parsed.tester_name && authStore.isAdmin) testerName.value = parsed.tester_name;
  if (parsed.developer) developer.value = parsed.developer;
  if (parsed.parent_ticket) parentTicket.value = parsed.parent_ticket;
  if (parsed.sub_ticket) subTicket.value = parsed.sub_ticket;
  if (parsed.version) version.value = parsed.version;
  if (parsed.category) category.value = parsed.category as ReportCategory;
  if (parsed.status) status.value = parsed.status;
  if (parsed.urls) {
    testCaseUrl.value = parsed.urls;
    if (parsed.urls.includes('drive.google.com')) tcPreset.value = 'cloud';
    else if (parsed.urls === '不出案例') tcPreset.value = 'none';
    else tcPreset.value = '';
  }
  if (parsed.env) env.value = parsed.env;
  if (parsed.devices) parseDevicesIntoFields(parsed.devices);
  if (parsed.test_steps) testSteps.value = parsed.test_steps;
  if (parsed.risk) risk.value = parsed.risk;
  if (parsed.pass_rate) passRate.value = parsed.pass_rate;
  if (parsed.form_steps) {
    formSteps.value = parsed.form_steps;
    handleStepsInput();
  }
  if (parsed.form_notes) testerRemark.value = parsed.form_notes;
  isManualPreview.value = false;
}

watch(
  () => props.modelValue,
  async (visible) => {
    if (visible) {
      isManualPreview.value = false;
      manualPreview.value = '';
      currentType.value = props.reportType || 'normal';

      if (props.mode === 'create') {
        rawTicket.value = '';
        projectName.value = '';
        category.value = '其他';
        testDate.value = getTaiwanToday();
        testerName.value = authStore.currentDisplayName;
        developer.value = '';
        parentTicket.value = '';
        subTicket.value = '';
        version.value = '';
        env.value = '';
        deviceMain.value = '';
        isIpad.value = false;
        ipadVersion.value = '';
        isIphone.value = false;
        iphoneVersion.value = '';
        isOther.value = false;
        otherVersion.value = '';
        showGrafana.value = false;
        grafanaInput.value = '';
        testCaseUrl.value = '';
        tcPreset.value = '';
        testSteps.value = '';
        isBypass.value = false;
        bypassReason1.value = false;
        bypassReason2.value = false;
        risk.value = '低';
        passRate.value = '100%';
        formSteps.value = '';
        testerRemark.value = '';
        status.value = 'Blocked';
        await fetchNextCaseNo();
      } else if (props.initialReport) {
        const r = props.initialReport;
        currentType.value = r.case_no.startsWith('P') ? 'prod' : 'normal';
        rawTicket.value = r.raw_ticket || '';
        caseNo.value = r.case_no;
        projectName.value = r.project_name;
        category.value = (r.category as ReportCategory) || '其他';
        testDate.value = r.test_date;
        testerName.value = r.tester_name;
        status.value = r.status;
        testerRemark.value = getTesterRemarkFromReport(r.notes);

        const parsed = parseReportNotesToFields(r.notes, r.raw_ticket);
        if (parsed.developer) developer.value = parsed.developer;
        if (parsed.parent_ticket) parentTicket.value = parsed.parent_ticket;
        if (parsed.sub_ticket) subTicket.value = parsed.sub_ticket;
        if (parsed.version) version.value = parsed.version;
        if (parsed.urls) {
          testCaseUrl.value = parsed.urls;
          if (parsed.urls.includes('drive.google.com')) tcPreset.value = 'cloud';
          else if (parsed.urls === '不出案例') tcPreset.value = 'none';
        }
        if (parsed.env) env.value = parsed.env;
        if (parsed.devices) parseDevicesIntoFields(parsed.devices);
        if (parsed.test_steps) testSteps.value = parsed.test_steps;
        if (parsed.risk) risk.value = parsed.risk;
        if (parsed.pass_rate) passRate.value = parsed.pass_rate;
        if (parsed.form_steps) {
          formSteps.value = parsed.form_steps;
          handleStepsInput();
        }

        if (props.mode === 'copy') {
          await fetchNextCaseNo();
          testDate.value = getTaiwanToday();
          testerName.value = authStore.currentDisplayName;
        } else {
          manualPreview.value = getNotesWithoutTesterRemark(r.notes);
          isManualPreview.value = true;
        }
      }
    }
  }
);

async function handleSave() {
  if (!projectName.value.trim()) {
    ElMessage.warning('請輸入專案名稱');
    return;
  }
  if (!caseNo.value.trim()) {
    ElMessage.warning('請填寫案件編號');
    return;
  }

  saving.value = true;
  try {
    const finalNotes = buildFullNotesFromParts(generatedPreview.value, testerRemark.value);
    const payload: Partial<Report> = {
      case_no: caseNo.value.trim(),
      project_name: projectName.value.trim(),
      tester_name: testerName.value.trim(),
      test_date: testDate.value,
      status: status.value,
      category: category.value,
      notes: finalNotes,
      raw_ticket: rawTicket.value.trim() || undefined,
      owner_user_id: authStore.currentUserId,
    };

    let result: Report;
    if (props.mode === 'edit' && props.initialReport) {
      payload.id = props.initialReport.id;
      result = await reportsApi.updateReport(payload);
      ElMessage.success('報告更新成功');
    } else {
      result = await reportsApi.createReport(payload);
      ElMessage.success(currentType.value === 'prod' ? '上正式報告新增成功' : '測試報告新增成功');
    }

    emit('saved', result);
    emit('update:modelValue', false);
  } catch (err: any) {
    ElMessage.error(err.message || '儲存失敗');
  } finally {
    saving.value = false;
  }
}

async function copyPreviewText() {
  const plainText = generatedPreview.value;
  if (!plainText) return;

  const lines = plainText.split('\n');
  const formattedLines = lines.map((line) => {
    let escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (/QA\s*內部作業程序與協作說明書/i.test(escaped)) {
      escaped = escaped.replace(
        /QA\s*內部作業程序與協作說明書(?:\s*[:：]?\s*https?:\/\/[^\s<]+)?/gi,
        `<a href="${QA_BYPASS_DOC_URL}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: bold;">QA 內部作業程序與協作說明書</a>`
      );
    }
    return escaped;
  });
  const htmlText = formattedLines.join('<br>');

  try {
    if (navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
      const blobHtml = new Blob([htmlText], { type: 'text/html' });
      const blobText = new Blob([plainText], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blobHtml,
          'text/plain': blobText,
        }),
      ]);
      ElMessage.success('已複製成稿至剪貼簿（含超連結格式）！');
      return;
    }
    await navigator.clipboard.writeText(plainText);
    ElMessage.success('已複製預覽內容至剪貼簿！');
  } catch {
    ElMessage.error('複製失敗，請手動複製');
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="
      mode === 'edit'
        ? `修改測試報告：${caseNo}`
        : mode === 'copy'
        ? '複製為新範本'
        : currentType === 'prod'
        ? '撰寫上正式報告'
        : '撰寫測試報告'
    "
    width="94%"
    top="3vh"
    destroy-on-close
    class="report-dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[78vh] overflow-y-auto px-1">
      <!-- Left Column: Inputs & Form (7 cols) -->
      <div class="lg:col-span-7 space-y-4">
        <!-- Step 1: Category & Ticket Input -->
        <div class="bg-blue-50/70 border border-blue-200 rounded-xl p-4 shadow-sm">
          <div class="flex items-center justify-between mb-2.5">
            <label class="text-sm font-bold text-blue-900 flex items-center gap-1.5">
              <span>📋 第一步：選擇分類與解析工單</span>
            </label>
            <div class="flex items-center gap-2">
              <!-- Type Switcher for Create Mode -->
              <div v-if="mode === 'create'" class="flex items-center bg-white p-0.5 rounded-lg border border-blue-200 text-xs">
                <button
                  type="button"
                  class="px-2.5 py-1 rounded font-bold transition"
                  :class="currentType === 'normal' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-blue-600'"
                  @click="handleTypeChange('normal')"
                >
                  測試報告 (T)
                </button>
                <button
                  type="button"
                  class="px-2.5 py-1 rounded font-bold transition"
                  :class="currentType === 'prod' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600 hover:text-red-600'"
                  @click="handleTypeChange('prod')"
                >
                  上正式 (P)
                </button>
              </div>
              <el-button size="small" type="primary" link @click="handleTicketInput">重新解析</el-button>
            </div>
          </div>

          <!-- Category Pills -->
          <div class="mb-3">
            <span class="block text-xs font-semibold text-blue-800 mb-1.5">分類</span>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="cat in categories"
                :key="cat"
                type="button"
                class="px-3.5 py-1.5 rounded-full text-xs font-semibold transition border cursor-pointer"
                :class="[
                  category === cat
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-100'
                ]"
                @click="category = cat"
              >
                {{ cat }}
              </button>
            </div>
          </div>

          <el-input
            v-model="rawTicket"
            type="textarea"
            :rows="5"
            placeholder="在此貼上工單內容（如：軟體版本、測試環境...），系統將自動解析帶入下方各欄位"
            @input="handleTicketInput"
          />
        </div>

        <!-- Form Details -->
        <div class="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-sm">
          <!-- Row: Tester, Developer, Test Date -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">
                測試人員 <span class="text-red-500">*</span>
              </label>
              <el-input v-model="testerName" :disabled="!authStore.isAdmin" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">工程人員</label>
              <el-input v-model="developer" placeholder="例如：Alex / 職缺團隊" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">
                測試日期 <span class="text-red-500">*</span>
              </label>
              <el-date-picker
                v-model="testDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="選擇日期"
                class="!w-full"
                @change="fetchNextCaseNo"
              />
            </div>
          </div>

          <!-- Row: Case No & Project Name -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">案件編號</label>
              <div class="flex gap-1.5">
                <el-input v-model="caseNo" readonly class="bg-slate-50 font-mono" />
                <el-button
                  :icon="Refresh"
                  :loading="allocatingCaseNo"
                  title="產生最新單號"
                  @click="fetchNextCaseNo"
                />
              </div>
            </div>
            <div class="sm:col-span-2">
              <label class="block text-xs font-bold text-slate-700 mb-1">
                專案名稱 <span class="text-red-500">*</span>
              </label>
              <el-input v-model="projectName" placeholder="請輸入專案名稱" />
            </div>
          </div>

          <!-- Row: Parent & Sub Ticket -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">母單</label>
              <el-input v-model="parentTicket" placeholder="輸入母單 (如 #12345)" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">子單</label>
              <el-input v-model="subTicket" placeholder="輸入子單 (如 #12346)" />
            </div>
          </div>

          <!-- Row: Software Version -->
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">軟體版本 / 版號</label>
            <el-input
              v-model="version"
              type="textarea"
              :rows="2"
              placeholder="例如：前端: stg-xxx&#10;後端: qa-yyy"
            />
          </div>

          <!-- Row: Test Env & Test Device -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Test Env with Quick Buttons -->
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">
                測試環境 (網址) <span class="text-red-500">*</span>
              </label>
              <div class="flex flex-wrap gap-1.5 mb-2">
                <button
                  v-for="btn in envPresets"
                  :key="btn.label"
                  type="button"
                  class="text-[11px] px-2 py-1 rounded border transition font-medium cursor-pointer"
                  :class="[
                    isEnvActive(btn.url)
                      ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  ]"
                  @click="toggleEnvPreset(btn.url)"
                >
                  {{ btn.label }}
                </button>
              </div>
              <el-input
                v-model="env"
                type="textarea"
                :rows="2"
                placeholder="點擊上方快速帶入，或在此自行輸入網址（可多行）"
              />
            </div>

            <!-- Test Device with Browser Detector & Checkboxes -->
            <div>
              <div class="flex justify-between items-center mb-1">
                <label class="block text-xs font-bold text-slate-700">測試裝置</label>
                <button
                  type="button"
                  class="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 transition bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded cursor-pointer border border-blue-200"
                  title="帶入您目前正在使用的瀏覽器版本"
                  @click="handleDetectBrowser"
                >
                  <el-icon :size="12"><Monitor /></el-icon>
                  本機瀏覽器
                </button>
              </div>
              <el-input
                v-model="deviceMain"
                placeholder="例如：Chrome 148.0..."
                class="mb-2"
              />
              <div class="flex flex-col gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                <div class="flex items-center gap-2">
                  <label class="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer min-w-[65px]">
                    <input v-model="isIpad" type="checkbox" class="rounded text-blue-600 cursor-pointer" />
                    iPad
                  </label>
                  <input
                    v-model="ipadVersion"
                    type="text"
                    placeholder="iPad 版本..."
                    class="border border-slate-300 rounded px-2 py-1 text-xs w-full bg-white focus:outline-blue-500"
                  />
                </div>
                <div class="flex items-center gap-2">
                  <label class="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer min-w-[65px]">
                    <input v-model="isIphone" type="checkbox" class="rounded text-blue-600 cursor-pointer" />
                    iPhone
                  </label>
                  <input
                    v-model="iphoneVersion"
                    type="text"
                    placeholder="iPhone 版本..."
                    class="border border-slate-300 rounded px-2 py-1 text-xs w-full bg-white focus:outline-blue-500"
                  />
                </div>
                <div class="flex items-center gap-2">
                  <label class="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer min-w-[65px]">
                    <input v-model="isOther" type="checkbox" class="rounded text-blue-600 cursor-pointer" />
                    其他
                  </label>
                  <input
                    v-model="otherVersion"
                    type="text"
                    placeholder="自行輸入裝置..."
                    class="border border-slate-300 rounded px-2 py-1 text-xs w-full bg-white focus:outline-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Step 2: Grafana Version (Orange Card) -->
          <div class="bg-orange-50/80 border border-orange-200 p-4 rounded-xl">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input
                v-model="showGrafana"
                type="checkbox"
                class="rounded text-orange-600 focus:ring-orange-500 cursor-pointer w-4 h-4"
              />
              <span class="text-sm font-bold text-orange-900 flex items-center gap-1.5">
                <span>📎 第二步：貼上 Grafana 版號 (選填)</span>
              </span>
            </label>

            <div v-if="showGrafana" class="mt-3 space-y-2">
              <p class="text-xs text-orange-700">在此貼上複製的版號，系統會自動比對並填入軟體版本。</p>
              <el-input
                v-model="grafanaInput"
                type="textarea"
                :rows="3"
                placeholder="在此貼上 Grafana 複製的文字..."
                @input="handleGrafanaInput"
              />
              <div class="flex gap-2 flex-wrap pt-1">
                <a
                  href="https://grafana.web.internal/d/5e23960b-1627-402b-98a0-f125ef6d06bf/deployment-stats?orgId=1&from=now-5m&to=now&timezone=browser&var-Filters=&var-namespace=job-finder"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs bg-white text-orange-700 border border-orange-300 px-2.5 py-1 rounded hover:bg-orange-100 transition whitespace-nowrap shadow-xs font-semibold"
                >
                  求職連結 ↗
                </a>
                <a
                  href="https://grafana.web.internal/d/b08307e8-6ed2-4b8d-9e3a-d254a2f06894/deployment-stats?orgId=1&from=now-5m&to=now&timezone=browser&var-Filters=&var-namespace=recruit"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs bg-white text-orange-700 border border-orange-300 px-2.5 py-1 rounded hover:bg-orange-100 transition whitespace-nowrap shadow-xs font-semibold"
                >
                  求才連結 ↗
                </a>
                <a
                  href="https://grafana.web.internal/d/b08307e8-6ed2-4b8d-9e3a-d254a2f06895/deployment-stats?orgId=1&from=now-5m&to=now&timezone=browser&var-Filters=&var-namespace=event"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs bg-white text-orange-700 border border-orange-300 px-2.5 py-1 rounded hover:bg-orange-100 transition whitespace-nowrap shadow-xs font-semibold"
                >
                  活動連結 ↗
                </a>
              </div>
            </div>
          </div>

          <!-- Test Case URL & Presets -->
          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="block text-xs font-bold text-slate-700">測試案例 (網址)</label>
              <div class="flex gap-3">
                <label class="flex items-center gap-1 text-xs text-slate-600 font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="tc-preset"
                    :checked="tcPreset === 'cloud'"
                    class="text-blue-600 cursor-pointer"
                    @change="setTcPreset('cloud')"
                  />
                  雲端位址(網址)
                </label>
                <label class="flex items-center gap-1 text-xs text-slate-600 font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="tc-preset"
                    :checked="tcPreset === 'none'"
                    class="text-blue-600 cursor-pointer"
                    @change="setTcPreset('none')"
                  />
                  不出案例
                </label>
              </div>
            </div>
            <el-input
              v-model="testCaseUrl"
              placeholder="例如：https://ua.1111.com.tw/Team/Task/Detail?k=7555"
              @input="tcPreset = ''"
            />
          </div>

          <!-- Step 3: Test Steps (Green Card) -->
          <div class="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl">
            <label class="block text-sm font-bold text-emerald-900 mb-2 flex items-center gap-1.5">
              <span>📋 第三步：測試步驟</span>
            </label>
            <el-input
              v-model="testSteps"
              type="textarea"
              :rows="3"
              placeholder="在此輸入測試步驟..."
            />
          </div>

          <!-- BY PASS (Indigo/Purple Card) -->
          <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <div class="flex items-center justify-between">
              <label class="flex items-center gap-2 cursor-pointer select-none font-bold text-slate-800 text-sm">
                <input
                  v-model="isBypass"
                  type="checkbox"
                  class="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  @change="handleBypassToggle"
                />
                <span class="flex items-center gap-1.5">
                  <span class="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                  BY PASS
                </span>
              </label>
              <button
                v-if="isBypass"
                type="button"
                class="text-xs text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
                @click="
                  isBypass = false;
                  handleBypassToggle();
                "
              >
                清空選取
              </button>
            </div>

            <div v-if="isBypass" class="mt-3 pt-3 border-t border-slate-200 space-y-2">
              <div class="text-xs font-semibold text-slate-600">
                請選擇 BY PASS 原因 <span class="text-slate-400 font-normal">(可複選)</span>：
              </div>
              <div class="flex flex-col gap-2 text-xs">
                <label class="flex items-start gap-2 p-1.5 rounded hover:bg-slate-100 cursor-pointer text-slate-700">
                  <input
                    v-model="bypassReason1"
                    type="checkbox"
                    class="mt-0.5 rounded text-blue-600 cursor-pointer"
                    @change="updateBypassToSteps"
                  />
                  <span>1. 本單需求基於內部文件(QA 內部作業程序與協作說明書)，不出案例</span>
                </label>
                <label class="flex items-start gap-2 p-1.5 rounded hover:bg-slate-100 cursor-pointer text-slate-700">
                  <input
                    v-model="bypassReason2"
                    type="checkbox"
                    class="mt-0.5 rounded text-blue-600 cursor-pointer"
                    @change="updateBypassToSteps"
                  />
                  <span>2. 本單需求為UI調整，符合內部文件規範，不出案例</span>
                </label>
              </div>

              <div class="pt-2 border-t border-slate-200 text-xs text-blue-700 flex items-center gap-1.5">
                <span>依規範須參照：</span>
                <a
                  :href="QA_BYPASS_DOC_URL"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-bold underline hover:text-blue-900 transition"
                >
                  QA 內部作業程序與協作說明書 ↗
                </a>
              </div>
            </div>
          </div>

          <!-- Notes (Work Ticket Info) -->
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">
              備註 <span class="text-slate-400 font-normal">（工單帶入）</span>
            </label>
            <el-input
              v-model="formSteps"
              type="textarea"
              :rows="3"
              placeholder="貼上工單時自動帶入，或使用上方 BY PASS 選項"
              @input="handleStepsInput"
            />
          </div>

          <!-- Risk & Pass Rate -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">風險評估</label>
              <el-select v-model="risk" class="w-full">
                <el-option label="低" value="低" />
                <el-option label="中" value="中" />
                <el-option label="高" value="高" />
              </el-select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">通過率</label>
              <el-select v-model="passRate" class="w-full">
                <el-option label="100%" value="100%" />
                <el-option label="80%" value="80%" />
                <el-option label="60%" value="60%" />
                <el-option label="40%" value="40%" />
                <el-option label="不通過" value="不通過" />
              </el-select>
            </div>
          </div>

          <!-- Status -->
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">
              處理狀態 <span class="text-red-500">*</span>
            </label>
            <el-select v-model="status" class="w-full">
              <el-option label="Pass (通過)" value="Pass" />
              <el-option label="Fail (失敗)" value="Fail" />
              <el-option label="BLOCKED (阻礙)" value="Blocked" />
            </el-select>
          </div>

          <!-- Separate Tester Internal Remarks -->
          <div class="border-t border-slate-100 pt-3">
            <label class="block text-xs font-bold text-amber-700 mb-1">
              測試員備註（獨立備註，僅供內部團隊檢閱）
            </label>
            <el-input
              v-model="testerRemark"
              placeholder="僅附加於報告結尾的內部備註..."
            />
          </div>
        </div>
      </div>

      <!-- Right Column: Live Real-time Preview (5 cols) -->
      <div class="lg:col-span-5 flex flex-col space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <span>📄 即時成稿預覽</span>
            <span class="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">實時同步</span>
          </span>
          <el-button
            type="primary"
            size="small"
            plain
            :icon="DocumentCopy"
            @click="copyPreviewText"
          >
            一鍵複製報告
          </el-button>
        </div>

        <div class="flex-1 min-h-[460px] bg-slate-900 rounded-xl p-4 text-emerald-400 font-mono text-xs flex flex-col shadow-inner border border-slate-800">
          <textarea
            v-model="manualPreview"
            class="w-full flex-1 bg-transparent border-0 outline-none resize-none font-mono text-emerald-300 leading-relaxed"
            :placeholder="generatedPreview"
            @input="isManualPreview = true"
          />
        </div>
        <p class="text-xs text-slate-500">
          💡 提示：左側表單修改時右側即時聯動。一鍵複製時自動生成純文字與超連結格式（可直接貼入工單或通訊軟體）。
        </p>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between border-t border-slate-100 pt-3 px-1">
        <div class="text-xs text-slate-500">
          案件編號：<span class="font-bold text-slate-800">{{ caseNo || '計算中...' }}</span>
        </div>
        <div class="flex items-center gap-3">
          <el-button @click="emit('update:modelValue', false)">取消</el-button>
          <el-button
            :type="currentType === 'prod' ? 'danger' : 'primary'"
            :loading="saving"
            @click="handleSave"
          >
            {{ mode === 'edit' ? '儲存變更' : currentType === 'prod' ? '確定送出 (上正式)' : '確定送出' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>
