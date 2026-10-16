import type { ParsedTicketFields, ReportStatus } from '@/types';

export function getNotesWithoutTesterRemark(notes: string): string {
  if (!notes) return '';
  return notes.replace(/\n?(?:測試員備註|QA備註)\s*[：:]\s*[^\n]+/g, '').trim();
}

export function getTesterRemarkFromReport(notes: string): string {
  if (!notes) return '';
  const match = notes.match(/(?:測試員備註|QA備註)\s*[：:]\s*([^\n]+)/);
  return match ? match[1].trim() : '';
}

export function buildFullNotesFromParts(body: string, testerRemark: string): string {
  let notes = getNotesWithoutTesterRemark(body || '');
  if (testerRemark && testerRemark.trim()) {
    notes += notes ? `\n測試員備註：${testerRemark.trim()}` : `測試員備註：${testerRemark.trim()}`;
  }
  return notes;
}

export function extractTaskNumber(str: string): string {
  if (!str) return '';
  const match = str.match(/#?(\d+)/);
  return match ? `#${match[1]}` : str.trim();
}

export function upsertPreviewLine(
  text: string,
  label: string,
  value: string,
  insertBeforeLabel?: string
): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lineRe = new RegExp(`(^|\\n)(${escaped}\\s*[：:]\\s*[^\\n]*)`, 'i');

  if (value) {
    if (lineRe.test(text)) {
      return text.replace(lineRe, (_match, p1) => {
        return `${p1}${label}：${value}`;
      });
    }
    const line = `\n${label}：${value}`;
    if (insertBeforeLabel) {
      const beforeEsc = insertBeforeLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const beforeRe = new RegExp(`(^|\\n)(${beforeEsc}\\s*[：:])`, 'i');
      if (beforeRe.test(text)) {
        return text.replace(beforeRe, (_match, p1, p2) => {
          return `${p1}${label}：${value}\n${p2}`;
        });
      }
    }
    return text.trimEnd() + line;
  }

  if (lineRe.test(text)) {
    return text.replace(lineRe, '').trim();
  }
  return text;
}

export function upsertPreviewBlock(
  text: string,
  label: string,
  value: string,
  insertBeforeLabel?: string
): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const followingLabelsMap: Record<string, string> = {
    軟體版本: '測試環境|測試裝置|測試案例|測試步驟|風險評估|通過率(?:\\(%\\))?|備註|處理狀態',
    測試環境: '測試裝置|測試案例|測試步驟|風險評估|通過率(?:\\(%\\))?|備註|處理狀態',
    測試裝置: '測試案例|測試步驟|風險評估|通過率(?:\\(%\\))?|備註|處理狀態',
    測試案例: '測試步驟|風險評估|通過率(?:\\(%\\))?|備註|處理狀態',
    測試步驟: '風險評估|通過率(?:\\(%\\))?|備註|處理狀態',
    備註: '處理狀態',
  };

  const followingLabels =
    followingLabelsMap[label] ||
    '案件編號|專案名稱|測試日期|測試人員|工程人員|母單|子單|軟體版本|測試環境|測試裝置|測試案例|測試步驟|風險評估|通過率(?:\\(%\\))?|備註|處理狀態|工單說明|測試員備註|QA備註';
  const blockRe = new RegExp(
    `(^|\\n)(${escaped}\\s*[：:])(?:\\n|.)*?(?=\\n(?:${followingLabels})\\s*[：:]|$)`,
    'i'
  );

  if (value) {
    const hasNewline = value.includes('\n') || label === '測試步驟';
    if (blockRe.test(text)) {
      return text.replace(blockRe, (_match, p1) => {
        return `${p1}${label}：${hasNewline ? '\n' : ''}${value}`;
      });
    }

    const block = `\n${label}：${hasNewline ? '\n' : ''}${value}`;
    if (insertBeforeLabel) {
      const beforeEsc = insertBeforeLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const beforeRe = new RegExp(`(^|\\n)(${beforeEsc}\\s*[：:])`, 'i');
      if (beforeRe.test(text)) {
        return text.replace(beforeRe, (_match, p1, p2) => {
          return `${p1}${label}：${hasNewline ? '\n' : ''}${value}\n${p2}`;
        });
      }
    }
    return text.trimEnd() + block;
  }

  if (blockRe.test(text)) {
    return text.replace(blockRe, '').trim();
  }
  return text;
}

export function parseReportNotesToFields(
  text: string,
  _rawTicket?: string
): ParsedTicketFields {
  if (!text) return {};

  const extractField = (regex: RegExp): string => {
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

  const case_no = extractField(/案件編號[^\S\r\n]*[：:][^\S\r\n]*([^\n]+)/i);
  const project_name = extractField(/專案名稱[^\S\r\n]*[：:][^\S\r\n]*([^\n]+)/i);
  const tester_name = extractField(/測試人員[^\S\r\n]*[：:][^\S\r\n]*([^\n]+)/i);
  const developer = extractField(/工程人員[^\S\r\n]*[：:][^\S\r\n]*([^\n]+)/i);
  const parentVal = extractField(/(?:測試母單|母單)[^\S\r\n]*[：:][^\S\r\n]*([^\n]+)/i);
  const subVal = extractField(/(?:測試子單|子單)[^\S\r\n]*[：:][^\S\r\n]*([^\n]+)/i);
  const device = extractField(/(?:測試裝置|裝置|設備)[^\S\r\n]*[：:][^\S\r\n]*([^\n]+)/i);
  const testCase = extractField(/(?:卡片|測試案例|網址|連結|Ticket|URL)[^\S\r\n]*[：:][^\S\r\n]*([^\n]+)/i);
  const risk = extractField(/風險評估[^\S\r\n]*[：:][^\S\r\n]*([^\n]+)/i);
  const pass_rate = extractField(/通過率(?:\(%\))?[^\S\r\n]*[：:][^\S\r\n]*([^\n]+)/i);

  let test_date = '';
  const dateVal = extractField(/(?:測試日期|日期)[^\S\r\n]*[：:][^\S\r\n]*([^\n]+)/i);
  if (dateVal) {
    const dateStr = dateVal.replace(/\//g, '-');
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      test_date = dateStr;
    }
  }

  const testStepsMatch = text.match(
    /測試步驟[^\S\r\n]*[：:]\n?([\s\S]*?)(?=\n(?:工單說明|風險評估|通過率|測試員備註|QA備註|備註[^\S\r\n]*[：:]|處理狀態)|$)/i
  );
  const test_steps = testStepsMatch ? testStepsMatch[1].trim() : '';

  const stepsMatch = text.match(
    /工單說明[^\S\r\n]*[：:]\n?([\s\S]*?)(?=\n風險評估|\n通過率|\n(?:測試員備註|QA備註)|\n備註[^\S\r\n]*[：:]|\n處理狀態|$)/i
  );
  let form_steps = stepsMatch ? stepsMatch[1].trim() : '';

  const ticketRemarkMatch = text.match(/\n備註[^\S\r\n]*[：:][^\S\r\n]*([^\n]+)(?=\n處理狀態|$)/i);
  if (ticketRemarkMatch && !form_steps) {
    form_steps = ticketRemarkMatch[1].trim();
  }

  const testerNotes = extractField(/(?:測試員備註|QA備註)[^\S\r\n]*[：:][^\S\r\n]*([^\n]+)/i);

  const versionMatch = text.match(
    /軟體版本[^\S\r\n]*[：:]\n?([\s\S]*?)(?=\n測試環境|\n測試裝置|\n測試案例|\n測試步驟|\n工單說明|\n風險評估|$)/i
  );
  const version = versionMatch ? versionMatch[1].trim() : '';

  const envMatch = text.match(
    /測試環境[^\S\r\n]*[：:]\n?([\s\S]*?)(?=\n測試裝置|\n測試案例|\n測試步驟|\n工單說明|\n風險評估|$)/i
  );
  const env = envMatch ? envMatch[1].trim() : '';

  const statusMatch = extractField(/處理狀態[^\S\r\n]*[：:][^\S\r\n]*([^\n]+)/i);
  let status: ReportStatus = 'Pass';
  if (statusMatch.includes('失敗') || statusMatch.toLowerCase().includes('fail')) status = 'Fail';
  if (statusMatch.includes('阻礙') || statusMatch.toLowerCase().includes('block')) status = 'Blocked';

  let category = '其他';
  const categoryMatch = text.match(/【(?:測試紀錄|上正式紀錄)(?:-(.+?))?】/);
  if (categoryMatch && categoryMatch[1]) {
    category = categoryMatch[1].trim();
  }

  return {
    case_no,
    project_name,
    test_date,
    tester_name,
    developer,
    parent_ticket: extractTaskNumber(parentVal),
    sub_ticket: extractTaskNumber(subVal),
    version,
    category,
    status,
    urls: testCase,
    bug_link: '',
    env,
    devices: device,
    test_steps,
    risk: risk || undefined,
    pass_rate: pass_rate || undefined,
    form_steps,
    form_notes: testerNotes,
  };
}

export function buildFullReportTemplate(data: {
  category?: string;
  case_no?: string;
  project_name?: string;
  test_date?: string;
  tester_name?: string;
  developer?: string;
  parent_ticket?: string;
  sub_ticket?: string;
  version?: string;
  env?: string;
  devices?: string;
  test_case?: string;
  test_steps?: string;
  risk?: string;
  pass_rate?: string;
  steps?: string;
  status?: ReportStatus | string;
}): string {
  const cat = data.category || '其他';
  let tpl = cat === '其他' ? '【測試紀錄】' : `【測試紀錄-${cat}】`;

  if (data.case_no) tpl += `\n案件編號：${data.case_no}`;
  if (data.project_name) tpl += `\n專案名稱：${data.project_name}`;
  if (data.test_date) tpl += `\n測試日期：${data.test_date.replace(/-/g, '/')}`;
  if (data.tester_name) tpl += `\n測試人員：${data.tester_name}`;
  if (data.developer) tpl += `\n工程人員：${data.developer}`;
  if (data.parent_ticket) tpl += `\n母單：${data.parent_ticket}`;
  if (data.sub_ticket) tpl += `\n子單：${data.sub_ticket}`;

  if (data.version) {
    tpl += `\n軟體版本：${data.version.includes('\n') ? '\n' + data.version : data.version}`;
  }
  if (data.env) {
    tpl += `\n測試環境：${data.env.includes('\n') ? '\n' + data.env : data.env}`;
  }
  if (data.devices) tpl += `\n測試裝置：${data.devices}`;
  if (data.test_case) tpl += `\n測試案例：${data.test_case}`;
  if (data.test_steps) tpl += `\n測試步驟：\n${data.test_steps}`;
  if (data.risk) tpl += `\n風險評估：${data.risk}`;
  if (data.pass_rate) tpl += `\n通過率(%)：${data.pass_rate}`;
  if (data.steps) tpl += `\n備註：${data.steps}`;

  let statusText = data.status || 'Pass';
  if (statusText === 'Pass') statusText = '驗證通過';
  if (statusText === 'Fail') statusText = '驗證失敗';
  if (statusText === 'Blocked' || statusText === 'BLOCKED') statusText = '阻礙中';
  tpl += `\n處理狀態：${statusText}`;

  return tpl.replace(/\n\n+/g, '\n');
}
