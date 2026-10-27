import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { parse, compileScript } from '@vue/compiler-sfc';
import ts from 'typescript';
import { defineComponent, ref } from 'vue';

// Execute the real LoginView setup/submit handler; only external services and
// notifications are replaced. Successful sign-in must not create a floating
// welcome message that can cover the navigation after the route changes.
function fixture({ failure } = {}) {
  const { descriptor } = parse(readFileSync(new URL('../src/views/LoginView.vue', import.meta.url), 'utf8'));
  const compiled = compileScript(descriptor, { id: 'login-feedback-test' });
  const { outputText } = ts.transpileModule(compiled.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const messages = { success: [], warning: [], error: [] };
  const routes = [];
  let logins = 0;
  let registrations = 0;
  const auth = {
    currentDisplayName: '一般使用者測試帳號',
    async login() { logins++; if (failure) throw new Error(failure); },
    async register() { registrations++; },
  };
  const services = {
    vue: { defineComponent, ref },
    'vue-router': { useRouter: () => ({ push: route => { routes.push(route); } }) },
    '@/stores/auth': { useAuthStore: () => auth },
    'element-plus': { ElMessage: Object.fromEntries(Object.keys(messages).map(type => [type, message => messages[type].push(message)])) },
    '@element-plus/icons-vue': {},
  };
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: name => {
    assert.ok(name in services, `Unexpected dependency: ${name}`);
    return services[name];
  } });
  const view = exports.default.setup({}, { expose() {} });
  view.username.value = 'local-test-user';
  view.password.value = 'local-test-password';
  return { view, messages, routes, logins: () => logins, registrations: () => registrations };
}

test('successful login navigates without creating a floating welcome message over the menu', async () => {
  const f = fixture();
  await f.view.handleSubmit();
  assert.equal(f.logins(), 1);
  assert.deepEqual(f.routes, ['/dashboard']);
  assert.deepEqual(f.messages.success, [], 'Login must not create the welcome popup that can cover the navigation');
  assert.equal(f.view.loading.value, false);
});

test('failed login still shows the error and permits retry', async () => {
  const f = fixture({ failure: '帳號或密碼錯誤' });
  await f.view.handleSubmit();
  assert.deepEqual(f.messages.error, ['帳號或密碼錯誤']);
  assert.deepEqual(f.routes, []);
  assert.equal(f.view.loading.value, false);
});

test('registration feedback remains visible and returns to sign-in', async () => {
  const f = fixture();
  f.view.isRegister.value = true;
  f.view.displayName.value = '測試同事';
  await f.view.handleSubmit();
  assert.equal(f.registrations(), 1);
  assert.equal(f.logins(), 0);
  assert.deepEqual(f.messages.success, ['註冊成功！請等待管理員啟用或直接登入']);
  assert.equal(f.view.isRegister.value, false);
});

test('empty credentials still show validation feedback without sending a login', async () => {
  const f = fixture();
  f.view.password.value = '';
  await f.view.handleSubmit();
  assert.equal(f.logins(), 0);
  assert.deepEqual(f.messages.warning, ['請輸入帳號與密碼']);
});
