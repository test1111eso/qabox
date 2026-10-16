/**
 * 台灣時區 (Asia/Taipei) 日期與時間工具
 */

export function getTaiwanDate(baseDate: Date = new Date()): Date {
  return new Date(baseDate.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
}

export function getTaiwanToday(): string {
  const twDate = getTaiwanDate();
  const yyyy = twDate.getFullYear();
  const mm = String(twDate.getMonth() + 1).padStart(2, '0');
  const dd = String(twDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getTaiwanFirstDay(): string {
  const twDate = getTaiwanDate();
  const yyyy = twDate.getFullYear();
  const mm = String(twDate.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

export function formatDateSlash(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.replace(/-/g, '/');
}

export function formatDateDash(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.replace(/\//g, '-');
}

export function getTaiwanMonday(d: Date = new Date()): string {
  const tw = getTaiwanDate(d);
  const day = tw.getDay();
  const diff = tw.getDate() - day + (day === 0 ? -6 : 1); // 星期一為第一天
  tw.setDate(diff);
  const yyyy = tw.getFullYear();
  const mm = String(twDateMonth(tw)).padStart(2, '0');
  const dd = String(tw.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function twDateMonth(d: Date): number {
  return d.getMonth() + 1;
}
