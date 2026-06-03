// native fetch

async function run() {
    try {
        const res = await fetch("https://qa-backend-api.test1111-tcm-tc.workers.dev/api/reports?tester=" + encodeURIComponent("鄭雅薰"));
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Body:", text);
    } catch (e) {
        console.error("Error:", e);
    }
}
run();
