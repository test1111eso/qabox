const run = async () => {
  const token = '08976d2a-af69-4898-82cf-30e7183c780b';
  const payload = {
    id: 41,
    token: token,
    case_no: "T20260603-02",
    project_name: "測試1",
    tester_name: "吳思賢",
    test_date: "2026/06/03",
    status: "Pass",
    bug_link: "",
    category: "其他",
    raw_ticket: "",
    notes: "【測試紀錄】\n案件編號：T20260603-02\n專案名稱：測試1\n測試日期：2026/06/03\n測試人員：吳思賢\n測試環境：\nhttps://www-qa.1111.com.tw/\nhttps://www-stg.1111.com.tw/\nhttps://www-iis-qa.1111.com.tw/\nhttps://www-iis-stg.1111.com.tw/\n工單說明：\n測試1\n風險評估：低\n通過率(%)：100%\n處理狀態：驗證通過"
  };

  try {
    const res = await fetch('https://qagame.test1111-tcm-tc.workers.dev/api/reports/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', data);
  } catch (err) {
    console.error('Error:', err);
  }
};
run();
