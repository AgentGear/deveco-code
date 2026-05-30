import { Show, createSignal, createMemo, For, createEffect, onMount, type ParentProps } from 'solid-js';
import { useKeyboard, useTerminalDimensions } from '@opentui/solid';
import { ScrollBoxRenderable, TextareaRenderable } from '@opentui/core';
import { useTheme } from '@tui/context/theme';
import { useSync } from '@tui/context/sync';
import { useExit } from '@tui/context/exit';
import { useDialog } from '@tui/ui/dialog';
import { useSDK } from '../context/sdk';
import { DialogSelect } from '@tui/ui/dialog-select';
import { DialogPrompt } from '@tui/ui/dialog-prompt';
import { Link } from '../ui/link';
import { devecoAuth, ACCESS_TOKEN_EXPIRES_MS, saveAuthToDisk } from '@/plugin/deveco';
import { useKV } from '@tui/context/kv';
import { resolveAgreementConfig, KV_DEVECO_CODE_PRIVACY_ACCEPTED, type AgreementConfig } from '@/cli/deveco-legal';
import { agreementService, AgreementStatus } from '@/cli/deveco-agreement';
import type { AgreementCheckResult } from '@/cli/deveco-agreement';
import { BANNER_HOME_CONTENT_INSET, HOME_CONTENT_MAX_WIDTH } from './banner';

declare const DEVECO_SKIP_AGREEMENT: boolean | undefined
import type { ProviderAuthAuthorization, ProviderAuthMethod } from '@opencode-ai/sdk/v2';

type OnboardingStep = 'privacy' | 'entry' | 'auth' | 'providers' | 'key';

const LIST_HELP = 'Use Enter to Select';
/** Horizontal inset so copy/options align under the centered banner tagline. */
const CONTENT_PAD_X = 15;

function OnboardingContent(props: ParentProps) {
  return (
    <box
      flexDirection='column'
      width='100%'
      maxWidth={HOME_CONTENT_MAX_WIDTH}
      paddingLeft={CONTENT_PAD_X}
      paddingRight={CONTENT_PAD_X}
    >
      {props.children}
    </box>
  );
}

function selectionLead(selected: boolean): string {
  return selected ? '> ' : '  ';
}

function providerLabel(id: string, name: string): string {
  if (id === 'github-copilot') {
    return 'GitHub Copilot';
  }
  if (id === 'opencode') {
    return 'OpenCode Zen';
  }
  return name;
}

const PROVIDER_PRIORITY: Record<string, number> = {
  opencode: 0,
  'opencode-go': 1,
  openai: 2,
  'github-copilot': 3,
  anthropic: 4,
  google: 5,
  openrouter: 6,
};

const DEFAULT_AUTH_METHODS: ProviderAuthMethod[] = [{ type: 'api', label: 'API key' }];

type AuthDialog = ReturnType<typeof useDialog>;
type AuthSdk = ReturnType<typeof useSDK>;
type AuthTheme = ReturnType<typeof useTheme>['theme'];

type ProviderAuthContext = {
  dialog: AuthDialog;
  sdk: AuthSdk;
  theme: AuthTheme;
  finish: () => Promise<void>;
};

async function pickAuthMethodIndex(dialog: AuthDialog, methods: ProviderAuthMethod[]): Promise<number | null> {
  if (methods.length <= 1) {
    return 0;
  }
  const idx = await new Promise<number | null>((resolve) => {
    dialog.replace(
      () => (
        <DialogSelect
          title='Select auth method'
          options={methods.map((m, i) => ({
            title: m.label,
            value: i,
          }))}
          onSelect={(opt) => resolve(opt.value)}
        />
      ),
      () => resolve(null),
    );
  });
  if (idx === null) {
    return null;
  }
  dialog.clear();
  return idx;
}

async function collectProviderAuthPrompts(
  dialog: AuthDialog,
  prompts: NonNullable<ProviderAuthMethod['prompts']>,
): Promise<Record<string, string> | null> {
  const inputs: Record<string, string> = {};
  for (const p of prompts) {
    if (p.when) {
      const prev = inputs[p.when.key];
      if (prev === undefined) {
        continue;
      }
      const matches = p.when.op === 'eq' ? prev === p.when.value : prev !== p.when.value;
      if (!matches) {
        continue;
      }
    }

    if (p.type === 'select') {
      const value = await new Promise<string | null>((resolve) => {
        dialog.replace(
          () => (
            <DialogSelect
              title={p.message}
              options={p.options.map((opt) => ({
                title: opt.label,
                value: opt.value,
                description: opt.hint,
              }))}
              onSelect={(opt) => resolve(opt.value)}
            />
          ),
          () => resolve(null),
        );
      });
      if (value === null) {
        return null;
      }
      inputs[p.key] = value;
      continue;
    }

    const value = await DialogPrompt.show(dialog, p.message, {
      placeholder: p.placeholder,
    });
    if (!value) {
      return null;
    }
    inputs[p.key] = value;
  }
  return inputs;
}

async function runOAuthCodeFlow(
  ctx: ProviderAuthContext,
  providerId: string,
  methodIndex: number,
  label: string,
  authorization: ProviderAuthAuthorization,
): Promise<boolean> {
  const code = await DialogPrompt.show(ctx.dialog, label, {
    placeholder: 'Authorization code',
    description: () => (
      <box gap={1}>
        <text fg={ctx.theme.textMuted}>{authorization.instructions}</text>
        <Link href={authorization.url} fg={ctx.theme.primary} />
      </box>
    ),
  });
  if (!code) {
    return false;
  }
  const cbResult = await ctx.sdk.client.provider.oauth.callback({
    providerID: providerId,
    method: methodIndex,
    code,
  });
  if (cbResult.error) {
    return false;
  }
  await ctx.finish();
  return true;
}

async function runOAuthAutoFlow(
  ctx: ProviderAuthContext,
  providerId: string,
  methodIndex: number,
  label: string,
  authorization: ProviderAuthAuthorization,
): Promise<boolean> {
  ctx.dialog.replace(() => (
    <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
      <text fg={ctx.theme.text}>{label}</text>
      <box gap={1}>
        <Link href={authorization.url} fg={ctx.theme.primary} />
        <text fg={ctx.theme.textMuted}>{authorization.instructions}</text>
      </box>
      <text fg={ctx.theme.textMuted}>Waiting for authorization...</text>
    </box>
  ));
  const cbResult = await ctx.sdk.client.provider.oauth.callback({
    providerID: providerId,
    method: methodIndex,
  });
  ctx.dialog.clear();
  if (cbResult.error) {
    return false;
  }
  await ctx.finish();
  return true;
}

async function runProviderOAuth(
  ctx: ProviderAuthContext,
  providerId: string,
  methodIndex: number,
  method: ProviderAuthMethod,
): Promise<void> {
  let inputs: Record<string, string> | undefined;
  if (method.prompts?.length) {
    const collected = await collectProviderAuthPrompts(ctx.dialog, method.prompts);
    if (collected === null) {
      return;
    }
    inputs = collected;
  }

  const result = await ctx.sdk.client.provider.oauth.authorize({
    providerID: providerId,
    method: methodIndex,
    inputs,
  });
  if (result.error) {
    ctx.dialog.clear();
    return;
  }

  if (result.data?.method === 'code') {
    await runOAuthCodeFlow(ctx, providerId, methodIndex, method.label, result.data);
    return;
  }

  if (result.data?.method === 'auto') {
    await runOAuthAutoFlow(ctx, providerId, methodIndex, method.label, result.data);
  }
}

export function DevEcoOnboarding(props: { onComplete: () => void; bodySlotHeight?: number; initialStep?: OnboardingStep }) {
  const { theme } = useTheme();
  const sync = useSync();
  const exit = useExit();
  const dialog = useDialog();
  const sdk = useSDK();
  const kv = useKV();

  // Merge project-level agreement config overrides with built-in defaults
  const agreementConfig = createMemo(() =>
    resolveAgreementConfig(sync.data.config.agreement as AgreementConfig | undefined)
  )

  // Initial step determined by caller: 'entry' if not logged in, 'privacy' if logged in but agreement pending
  const [step, setStep] = createSignal<OnboardingStep>(props.initialStep ?? 'entry')
  const [privacyIndex, setPrivacyIndex] = createSignal(0);
  const [checkboxChecked, setCheckboxChecked] = createSignal(false);
  const [signBusy, setSignBusy] = createSignal(false);
  const [signError, setSignError] = createSignal<string | null>(null);
  const [checkingStatus, setCheckingStatus] = createSignal(step() === 'privacy');
  const [agreementCheckResult, setAgreementCheckResult] = createSignal<AgreementCheckResult | null>(null);
  const [networkErrorNoCache, setNetworkErrorNoCache] = createSignal(false);
  const [entryIndex, setEntryIndex] = createSignal(0);
  const [authMessage, setAuthMessage] = createSignal<string | null>(null);
  const [authBusy, setAuthBusy] = createSignal(false);
  const [providerIndex, setProviderIndex] = createSignal(0);
  let authAborted = false;
  const [providerQuery, setProviderQuery] = createSignal('');
  const [pid, setPid] = createSignal<string | null>(null);
  const [key, setKey] = createSignal('');
  let input: TextareaRenderable | undefined;
  let providerScroll: ScrollBoxRenderable | undefined;

  // Async agreement status check — runs when entering privacy step
  const checkAgreementStatus = async () => {
    setCheckingStatus(true)
    setNetworkErrorNoCache(false)
    setSignError(null)

    const session = await devecoAuth.getSession()
    const accessToken = session?.accessToken || ''

    if (!accessToken) {
      // Not logged in → should not be here, go back to entry
      setCheckingStatus(false)
      setStep('entry')
      return
    }

    const checkResult = await agreementService.checkAllAgreements(accessToken, kv)
    setAgreementCheckResult(checkResult)

    if (checkResult.overallStatus === AgreementStatus.COMPLIANT) {
      // Agreements compliant → complete onboarding, enter conversation page
      setCheckingStatus(false)
      props.onComplete()
      return
    }

    // NETWORK_ERROR (regardless of local cache) → show network error page
    // User sees the error and can choose to cancel (exit) or retry
    if (checkResult.overallStatus === AgreementStatus.NETWORK_ERROR) {
      setNetworkErrorNoCache(true)
      setCheckingStatus(false)
      return
    }

    setCheckingStatus(false)
  }

  // Kick off agreement check on mount when initial step is privacy
  onMount(() => {
    if (step() === 'privacy') {
      void checkAgreementStatus()
    }
  })

  // Sign agreement via TMS API
  const runSignAgreement = async () => {
    setSignBusy(true)
    setSignError(null)

    const session = await devecoAuth.getSession()
    const accessToken = session?.accessToken || ''

    if (!accessToken) {
      setSignError('Please login first')
      setSignBusy(false)
      return
    }

    const signResult = await agreementService.signAgreement(accessToken, false)

    if (signResult.isUpload) {
      // Update KV cache (failure only logs, doesn't block)
      try {
        kv.set(KV_DEVECO_CODE_PRIVACY_ACCEPTED, true)
      } catch (err) {
        console.error('Failed to update local KV cache after signing', err)
      }
      // Signing success → complete onboarding, enter conversation page
      props.onComplete()
      return
    }

    setSignError(signResult.error ?? 'Failed to sign agreement. Please try again.')
    setSignBusy(false)
  }

  const providerList = createMemo(() => {
    return [...sync.data.provider_next.all]
      .filter((p) => p.id !== 'deveco')
      .sort((a, b) => (PROVIDER_PRIORITY[a.id] ?? 99) - (PROVIDER_PRIORITY[b.id] ?? 99));
  });

  const filteredProviders = createMemo(() => {
    const q = providerQuery().toLowerCase().trim();
    const list = providerList();
    if (!q) {
      return list;
    }
    return list.filter(
      (p) =>
        providerLabel(p.id, p.name).toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q),
    );
  });

  createEffect(() => {
    const list = filteredProviders();
    const idx = providerIndex();
    if (list.length === 0) {
      setProviderIndex(0);
      return;
    }
    if (idx >= list.length) {
      setProviderIndex(list.length - 1);
    }
  });

  const dimensions = useTerminalDimensions();
  const providerScrollHeight = createMemo(() => {
    const slot = props.bodySlotHeight ?? Math.floor(dimensions().height / 2) - 12;
    const overhead = 8;
    const maxFromSlot = Math.max(3, slot - overhead);
    const maxHeight = Math.floor(dimensions().height / 2) - 12;
    const cap = Math.min(maxFromSlot, maxHeight);
    return Math.min(filteredProviders().length, Math.max(cap, 5));
  });

  const providerSearchBoxWidth = createMemo(() => {
    // 75 matches the surrounding maxWidth; clamp to terminal width (minus Home padding).
    const w = Math.floor(dimensions().width) - BANNER_HOME_CONTENT_INSET;
    return Math.max(16, Math.min(75, w));
  });

  const fitText = (s: string, w: number) => {
    if (w <= 0) {
      return '';
    }
    if (s.length === w) {
      return s;
    }
    if (s.length < w) {
      return s + ' '.repeat(w - s.length);
    }
    return s.slice(0, w);
  };

  const scrollToProvider = (index: number) => {
    if (!providerScroll) {
      return;
    }
    const children = providerScroll.getChildren();
    const target = children[index];
    if (!target) {
      return;
    }
    const y = target.y - providerScroll.y;
    if (y >= providerScroll.height) {
      providerScroll.scrollBy(y - providerScroll.height + 1);
    }
    if (y < 0) {
      providerScroll.scrollBy(y);
      if (index === 0) {
        providerScroll.scrollTo(0);
      }
    }
  };

  const runBrowserLogin = async () => {
    setAuthBusy(true);
    setAuthMessage(null);
    authAborted = false;
    try {
      const result = await devecoAuth.login();
      if (authAborted) {
        // Escape handler already reset authBusy/step, nothing more to do
        return;
      }
      if (!result.success) {
        if (result.cancelled) {
          setStep('entry');
          setAuthBusy(false);
          return;
        }
        // Login failed (e.g. network error, port conflict) → go back to entry so
        // the user can see both Login and Exit options and retry cleanly
        setAuthMessage(result.error ?? 'Login failed');
        setStep('entry');
        setAuthBusy(false);
        return;
      }
      const access = result.userInfo?.accessToken || '';
      const refresh = result.userInfo?.refreshToken || '';
      await saveAuthToDisk('deveco', {
        type: 'oauth',
        access,
        refresh,
        expires: Date.now() + ACCESS_TOKEN_EXPIRES_MS,
      });
      await sdk.client.instance.dispose();
      await sync.bootstrap();
      setAuthBusy(false);
      // Login success → skip agreement check if built with --skip-agreement or runtime env var
      if ((typeof DEVECO_SKIP_AGREEMENT !== "undefined" && DEVECO_SKIP_AGREEMENT) || process.env.DEVECO_SKIP_AGREEMENT === "1") {
        props.onComplete();
        return;
      }
      // Otherwise → jump to privacy step for agreement check
      setStep('privacy');
      void checkAgreementStatus();
    } catch (error) {
      if (authAborted) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setAuthMessage(errorMessage);
      setStep('entry');
      setAuthBusy(false);
    }
  };

  const apiKeyTitle = (providerId: string) => {
    const row = sync.data.provider_next.all.find((p) => p.id === providerId);
    const name = row ? providerLabel(row.id, row.name) : providerId;
    return `Enter ${name} API Key`;
  };

  const submitKey = async (providerId: string, value: string) => {
    await sdk.client.auth.set({
      providerID: providerId,
      auth: { type: 'api', key: value },
    });
    await sdk.client.instance.dispose();
    await sync.bootstrap();
    props.onComplete();
  };

  const [keySubmitBusy, setKeySubmitBusy] = createSignal(false);
  const trySubmitApiKey = () => {
    if (keySubmitBusy()) {
      return;
    }
    const id = pid();
    if (!id) {
      return;
    }
    const value = (input?.plainText ?? key()).trim();
    if (!value) {
      return;
    }
    setKeySubmitBusy(true);
    void submitKey(id, value).finally(() => setKeySubmitBusy(false));
  };

  const finishOnboarding = async () => {
    await sdk.client.instance.dispose();
    await sync.bootstrap();
    props.onComplete();
  };

  const handleProviderSelect = async (providerId: string) => {
    const methods = sync.data.provider_auth[providerId] ?? DEFAULT_AUTH_METHODS;
    const methodIndex = await pickAuthMethodIndex(dialog, methods);
    if (methodIndex === null) {
      return;
    }

    const method = methods[methodIndex];
    if (method.type === 'api') {
      setPid(providerId);
      setKey('');
      setStep('key');
      return;
    }

    if (method.type === 'oauth') {
      await runProviderOAuth({ dialog, sdk, theme, finish: finishOnboarding }, providerId, methodIndex, method);
    }
  };

  const appendFilterKey = (name: string): boolean => {
    if (name === 'space') {
      setProviderQuery((q) => `${q} `);
      return true;
    }
    if (name.length === 1 && /[a-z0-9._-]/i.test(name)) {
      setProviderQuery((q) => q + name);
      return true;
    }
    return false;
  };

  useKeyboard((evt) => {
    if (dialog.stack.length > 0) {
      return;
    }

    const st = step();

    if (st === 'privacy') {
      if (evt.ctrl && evt.name === 'c') {
        evt.preventDefault();
        void exit();
        return;
      }
      // Space toggles checkbox
      if (evt.name === 'space') {
        evt.preventDefault();
        setCheckboxChecked(!checkboxChecked());
        return;
      }
      if (evt.name === 'up') {
        evt.preventDefault();
        setPrivacyIndex(0);
        return;
      }
      if (evt.name === 'down') {
        evt.preventDefault();
        setPrivacyIndex(1);
        return;
      }
      if (evt.name === 'return') {
        evt.preventDefault();
        if (signBusy() || checkingStatus()) {
          return;
        }
        if (privacyIndex() === 0) {
          // Agree — requires checkbox checked
          if (checkboxChecked()) {
            void runSignAgreement();
          }
        } else {
          // Cancel
          void exit();
        }
      }
      return;
    }

if (st === 'entry') {
      if (evt.ctrl && evt.name === 'c') {
        evt.preventDefault();
        void exit();
        return;
      }
      if (evt.name === 'up') {
        evt.preventDefault();
        setEntryIndex(Math.max(0, entryIndex() - 1));
        return;
      }
      if (evt.name === 'down') {
        evt.preventDefault();
        setEntryIndex(Math.min(1, entryIndex() + 1));
        return;
      }
      if (evt.name === 'return') {
        evt.preventDefault();
        if (entryIndex() === 0) {
          setStep('auth');
          void runBrowserLogin();
        } else {
          void exit();
        }
        return;
      }
      return;
    }

    if (st === 'auth') {
      if (evt.ctrl && evt.name === 'c') {
        evt.preventDefault();
        void exit();
        return;
      }
      if (evt.name === 'escape') {
        evt.preventDefault();
        if (authBusy()) {
          authAborted = true;
          devecoAuth.cancel();
          setAuthBusy(false);
        }
        setStep('entry');
        return;
      }
      if (authBusy()) {
        return;
      }
      if (evt.name === 'return') {
        evt.preventDefault();
        void runBrowserLogin();
      }
      return;
    }

    if (st === 'providers') {
      if (evt.ctrl && evt.name === 'c') {
        evt.preventDefault();
        void exit();
        return;
      }
      if (evt.name === 'escape') {
        evt.preventDefault();
        if (providerQuery().length > 0) {
          setProviderQuery('');
          setProviderIndex(0);
          return;
        }
        setStep('entry');
        return;
      }
      if (evt.name === 'backspace') {
        evt.preventDefault();
        if (providerQuery().length > 0) {
          setProviderQuery((q) => q.slice(0, -1));
          setProviderIndex(0);
        }
        return;
      }
      const list = filteredProviders();
      if (evt.name === 'up') {
        evt.preventDefault();
        const newIndex = Math.max(0, providerIndex() - 1);
        setProviderIndex(newIndex);
        scrollToProvider(newIndex);
        return;
      }
      if (evt.name === 'down') {
        evt.preventDefault();
        const newIndex = Math.min(Math.max(list.length - 1, 0), providerIndex() + 1);
        setProviderIndex(newIndex);
        scrollToProvider(newIndex);
        return;
      }
      if (evt.name === 'return') {
        evt.preventDefault();
        const idx = providerIndex();
        const provider = list[idx];
        if (provider) {
          void handleProviderSelect(provider.id);
        }
        return;
      }
      if (!evt.ctrl && !evt.meta && appendFilterKey(evt.name)) {
        evt.preventDefault();
        setProviderIndex(0);
        scrollToProvider(0);
      }
    }

    if (st === 'key') {
      if (evt.ctrl && evt.name === 'c') {
        if (key().length > 0) {
          evt.preventDefault();
          setKey('');
          input?.clear();
          return;
        }
        evt.preventDefault();
        void exit();
        return;
      }
      if (evt.name === 'escape') {
        evt.preventDefault();
        setStep('providers');
        return;
      }
      if (evt.name === 'return') {
        evt.preventDefault();
        trySubmitApiKey();
      }
    }
  });

  return (
    <box flexDirection='column' gap={2} flexShrink={0} width='100%' alignItems='center' justifyContent='center'>
      <Show when={step() === 'privacy'}>
        <OnboardingContent>
            <Show when={checkingStatus()}>
              <text fg={theme.textMuted} selectable={false}>
                Checking agreement status...
              </text>
            </Show>
            <Show when={!checkingStatus() && networkErrorNoCache()}>
              <text fg={theme.error} selectable={false}>
                Network error: Cannot reach agreement service.
              </text>
              <text fg={privacyIndex() === 1 ? theme.success : theme.text} selectable={false} marginTop={1}>
                {selectionLead(privacyIndex() === 1)}
                Cancel
              </text>
            </Show>
            <Show when={!checkingStatus() && !networkErrorNoCache()}>
              <text fg={theme.text} selectable={false}>
                Please read and agree to the following agreements to start the HarmonyOS development journey.
              </text>
              <text fg={theme.textMuted} selectable={false} marginTop={1}>
                Terms Of Use:
              </text>
              <Link href={agreementConfig().terms_url} fg={theme.primary}>DevEco Code AI Terms Of Use</Link>
              <text fg={theme.textMuted} selectable={false} marginTop={1}>
                Privacy Policy:
              </text>
              <Link href={agreementConfig().privacy_url} fg={theme.primary}>DevEco Code AI Privacy Policy</Link>

              <box onMouseUp={() => setCheckboxChecked(!checkboxChecked())}>
                <text fg={theme.text} selectable={false} marginTop={1}>
                  {checkboxChecked() ? '☑' : '☐'}  I have read and agree to the above agreements
                </text>
              </box>
              <text fg={theme.textMuted} selectable={false}>
                (Press Space or click to check)
              </text>

              <text fg={privacyIndex() === 0 && checkboxChecked() ? theme.success : theme.textMuted} selectable={false} marginTop={1}>
                {selectionLead(privacyIndex() === 0)}
                1. Agree {!checkboxChecked() ? '(check first)' : ''}
              </text>
              <text fg={privacyIndex() === 1 ? theme.success : theme.text} selectable={false}>
                {selectionLead(privacyIndex() === 1)}
                2. Cancel
              </text>

              <text fg={theme.textMuted} selectable={false} marginTop={1}>
                Use Enter to Select, Space or Click to Check
              </text>

              <Show when={signBusy()}>
                <text fg={theme.textMuted} selectable={false}>
                  Signing agreement...
                </text>
              </Show>
              <Show when={signError() !== null}>
                <text fg={theme.error} selectable={false}>
                  {signError()}
                </text>
              </Show>
            </Show>
        </OnboardingContent>
      </Show>
      <Show when={step() === 'entry'}>
        <OnboardingContent>
            <text fg={theme.text} attributes={1} selectable={false} marginBottom={1}>
              Get started with DevEco Code
            </text>
            <text fg={entryIndex() === 0 ? theme.success : theme.text} selectable={false}>
              {selectionLead(entryIndex() === 0)}
              Sign in with HUAWEI account
            </text>
            <text fg={entryIndex() === 1 ? theme.success : theme.text} selectable={false}>
              {selectionLead(entryIndex() === 1)}
              Exit
            </text>
            <text fg={theme.textMuted} selectable={false} marginTop={1}>
              Use Enter to Select, Up/Down to navigate
            </text>
        </OnboardingContent>
      </Show>
      <Show when={step() === 'auth'}>
        <OnboardingContent>
            <text fg={theme.text} selectable={false}>
              Sign in with HUAWEI account
            </text>
            <text fg={theme.textMuted} selectable={false}>
              {authBusy() ? 'Waiting for browser…' : 'Press Enter to open the login page'}
            </text>
            <Show when={authMessage() !== null}>
              <text fg={theme.error} selectable={false}>
                {authMessage()}
              </text>
            </Show>
            <Show when={authBusy()}>
              <text fg={theme.textMuted} selectable={false}>
                Press Esc to go back
              </text>
            </Show>
        </OnboardingContent>
      </Show>
      <Show when={step() === 'providers'}>
        <OnboardingContent>
            <text fg={theme.text} attributes={1} selectable={false}>
              Please select provider
            </text>
            <box flexDirection='column' width={providerSearchBoxWidth()}>
              <text fg={theme.textMuted} selectable={false} wrapMode='none'>
                {`╭${'─'.repeat(Math.max(0, providerSearchBoxWidth() - 2))}╮`}
              </text>
              <text selectable={false} wrapMode='none'>
                <span style={{ fg: theme.textMuted }}>│</span>
                <span style={{ fg: providerQuery() ? theme.text : theme.textMuted }}>
                  {fitText(` ${providerQuery() || 'Search'}`, Math.max(0, providerSearchBoxWidth() - 2))}
                </span>
                <span style={{ fg: theme.textMuted }}>│</span>
              </text>
              <text fg={theme.textMuted} selectable={false} wrapMode='none'>
                {`╰${'─'.repeat(Math.max(0, providerSearchBoxWidth() - 2))}╯`}
              </text>
            </box>
            <scrollbox
              ref={(r: ScrollBoxRenderable) => (providerScroll = r)}
              maxHeight={providerScrollHeight()}
              scrollbarOptions={{ visible: false }}
            >
              <For each={filteredProviders()}>
                {(provider, idx) => (
                  <text fg={providerIndex() === idx() ? theme.success : theme.text} selectable={false}>
                    {selectionLead(providerIndex() === idx())}
                    {idx() + 1}. {providerLabel(provider.id, provider.name)}
                  </text>
                )}
              </For>
            </scrollbox>
            <text fg={theme.textMuted} selectable={false} marginTop={1}>
              Use Enter to Select, Esc to Cancel, Type : to search
            </text>
        </OnboardingContent>
      </Show>
      <Show when={step() === 'key'}>
        <OnboardingContent>
            <text fg={theme.text} attributes={1} selectable={false}>
              {pid() ? apiKeyTitle(pid()!) : 'Enter API Key'}
            </text>
            <box flexDirection='column' width={providerSearchBoxWidth()}>
              <text fg={theme.textMuted} selectable={false} wrapMode='none'>
                {`╭${'─'.repeat(Math.max(0, providerSearchBoxWidth() - 2))}╮`}
              </text>
              <box flexDirection='row' width={providerSearchBoxWidth()}>
                <text fg={theme.textMuted} selectable={false} wrapMode='none'>
                  │
                </text>
                <textarea
                  focused={true}
                  ref={(r: TextareaRenderable) => (input = r)}
                  height={1}
                  width={Math.max(0, providerSearchBoxWidth() - 2)}
                  placeholder=' Paste API Key here'
                  textColor={theme.text}
                  focusedTextColor={theme.text}
                  cursorColor={theme.text}
                  onContentChange={() => setKey(input?.plainText ?? '')}
                  onSubmit={() => trySubmitApiKey()}
                />
                <text fg={theme.textMuted} selectable={false} wrapMode='none'>
                  │
                </text>
              </box>
              <text fg={theme.textMuted} selectable={false} wrapMode='none'>
                {`╰${'─'.repeat(Math.max(0, providerSearchBoxWidth() - 2))}╯`}
              </text>
            </box>
            <text fg={theme.textMuted} selectable={false} marginTop={1}>
              Use Enter to submit, Esc to Cancel, Ctrl+C to Clear
            </text>
        </OnboardingContent>
      </Show>
    </box>
  );
}
