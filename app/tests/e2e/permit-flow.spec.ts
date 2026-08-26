import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createPublicClient, createTestClient, createWalletClient, http, parseSignature, parseUnits, recoverTypedDataAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC_URL = "http://127.0.0.1:18545";
const ANVIL_ACCOUNT = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266" as const;
const ANVIL_SECOND_ACCOUNT = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8" as const;
const ANVIL_UPDATER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const ANVIL_UPDATER_ACCOUNT = privateKeyToAccount(ANVIL_UPDATER_KEY);
const LOCAL_CHAIN = {
  id: 31_337,
  name: "Anvil (Local)",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
} as const;
const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
const PSM_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [{ name: "reserveAmount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "updateCPIWithTimestamp",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reportedCPI", type: "uint256" },
      { name: "reportedAt", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "mockCPI",
    stateMutability: "nonpayable",
    inputs: [{ name: "newCPI", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "redeemableBalance",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

function readLocalEnv(): Record<string, string> {
  const source = readFileSync(".env.local", "utf8");
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .filter((line: string) => line && !line.startsWith("#"))
      .map((line: string) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

async function seedRedeemableHlc() {
  const env = readLocalEnv();
  const account = ANVIL_ACCOUNT;
  const updaterPublicClient = createPublicClient({ chain: LOCAL_CHAIN, transport: http(RPC_URL) });
  const existingCredit = await updaterPublicClient.readContract({
    address: env.NEXT_PUBLIC_HLC_PSM_31337 as `0x${string}`,
    abi: PSM_ABI,
    functionName: "redeemableBalance",
    args: [account],
  });
  if (existingCredit > 0n) return;

  const updaterWallet = createWalletClient({ account: ANVIL_UPDATER_ACCOUNT, chain: LOCAL_CHAIN, transport: http(RPC_URL) });
  const block = await updaterPublicClient.getBlock({ blockTag: "latest" });
  const reportHash = await updaterWallet.writeContract({
    account: ANVIL_UPDATER_ACCOUNT,
    address: env.NEXT_PUBLIC_HLC_PSM_31337 as `0x${string}`,
    abi: PSM_ABI,
    functionName: "updateCPIWithTimestamp",
    args: [1_000_000n, block.timestamp - 1n],
  });
  await updaterPublicClient.waitForTransactionReceipt({ hash: reportHash });
  const wallet = createWalletClient({ account, chain: LOCAL_CHAIN, transport: http(RPC_URL) });
  const publicClient = createPublicClient({ chain: LOCAL_CHAIN, transport: http(RPC_URL) });
  const reserveAmount = parseUnits("1000", 18);
  const approvalHash = await wallet.writeContract({
    account,
    address: env.NEXT_PUBLIC_HLC_RESERVE_TOKEN_31337 as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [env.NEXT_PUBLIC_HLC_PSM_31337 as `0x${string}`, reserveAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approvalHash });
  const depositHash = await wallet.writeContract({
    account,
    address: env.NEXT_PUBLIC_HLC_PSM_31337 as `0x${string}`,
    abi: PSM_ABI,
    functionName: "deposit",
    args: [reserveAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: depositHash });
}

async function submitDivergentPsmReport() {
  const env = readLocalEnv();
  const testClient = createTestClient({ chain: LOCAL_CHAIN, mode: "anvil", transport: http(RPC_URL) });
  const updaterWallet = createWalletClient({ account: ANVIL_UPDATER_ACCOUNT, chain: LOCAL_CHAIN, transport: http(RPC_URL) });
  const publicClient = createPublicClient({ chain: LOCAL_CHAIN, transport: http(RPC_URL) });
  await testClient.increaseTime({ seconds: 25 * 24 * 60 * 60 + 1 });
  await testClient.mine({ blocks: 1 });
  const block = await publicClient.getBlock({ blockTag: "latest" });
  const reportHash = await updaterWallet.writeContract({
    account: ANVIL_UPDATER_ACCOUNT,
    address: env.NEXT_PUBLIC_HLC_PSM_31337 as `0x${string}`,
    abi: PSM_ABI,
    functionName: "updateCPIWithTimestamp",
    args: [1_000_000n, block.timestamp],
  });
  await publicClient.waitForTransactionReceipt({ hash: reportHash });
}

async function advanceLocalTime(seconds: number) {
  const testClient = createTestClient({ chain: LOCAL_CHAIN, mode: "anvil", transport: http(RPC_URL) });
  await testClient.increaseTime({ seconds });
  await testClient.mine({ blocks: 1 });
}

async function installAnvilProvider(page: Page, chainId: number = LOCAL_CHAIN.id, account: string = ANVIL_ACCOUNT) {
  await page.addInitScript(({ rpcUrl, account, chainId: injectedChainId }) => {
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    let currentAccount = account;
    const provider = {
      isMetaMask: true,
      request: async ({ method, params = [] }: { method: string; params?: unknown[] }) => {
        if (method === "eth_accounts" || method === "eth_requestAccounts") return [currentAccount];
        if (method === "eth_chainId") return `0x${injectedChainId.toString(16)}`;
        if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method,
            params,
          }),
        });
        const payload = (await response.json()) as { result?: unknown; error?: { message: string } };
        if (payload.error) throw new Error(payload.error.message);
        if (method === "eth_sendTransaction") {
          (window as Window & { __lastTransaction?: unknown }).__lastTransaction = payload.result;
        }
        if (method === "eth_signTypedData_v4") {
          const state = window as Window & { __permitSignature?: unknown; __permitData?: unknown };
          state.__permitSignature = payload.result;
          state.__permitData = params[1];
        }
        return payload.result;
      },
      on: (event: string, listener: (...args: unknown[]) => void) => {
        const current = listeners.get(event) ?? new Set();
        current.add(listener);
        listeners.set(event, current);
      },
      removeListener: (event: string, listener: (...args: unknown[]) => void) => listeners.get(event)?.delete(listener),
    };
    Object.defineProperty(window, "__setAnvilAccount", {
      configurable: true,
      value: (nextAccount: string) => {
        currentAccount = nextAccount;
        listeners.get("accountsChanged")?.forEach((listener) => listener([nextAccount]));
      },
    });
    Object.defineProperty(window, "ethereum", { configurable: false, value: provider });
  }, { rpcUrl: RPC_URL, account, chainId });
}

test("renders deployment health without a wallet provider", async ({ page }) => {
  await page.goto("/health");

  await expect(page.getByRole("heading", { name: "Deployment health" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Deployment health", level: 1 })).toBeVisible();
  await expect(page.getByText("Read-only checks from the selected chain.")).toBeVisible();
  await expect(page.getByText("Deployment checks")).toBeVisible();
  await expect(page.getByRole("status", { name: "Overall deployment health" })).toContainText(/Healthy|Review|Blocking|Checking/);
  await expect(page.getByText("Chain ID:").locator("..")).toContainText("31337");
  await expect(page.getByText("Contract wiring and roles")).toBeVisible();
  await expect(page.getByText("CPI report freshness")).toBeVisible();
  await expect(page.getByText("PSM reserve coverage")).toBeVisible();
  await expect(page.getByText("Signed CPI adapter")).toBeVisible();
  await expect(page.getByText(/2 of 2 configured signers; adapter and PSM watermarks match/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy deployment health summary" })).toBeVisible();
  await page.evaluate(() => {
    let copied = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value: string) => { copied = value; } },
    });
    Object.defineProperty(window, "__copiedHealthSummary", { configurable: true, get: () => copied });
  });
  await page.getByRole("button", { name: "Copy deployment health summary" }).click();
  await expect(page.getByText("Health summary copied to the clipboard.")).toBeVisible();
  const copiedSummary = await page.evaluate(() => (window as Window & { __copiedHealthSummary?: string }).__copiedHealthSummary);
  expect(copiedSummary).toMatch(/Halal deployment health/);
  expect(copiedSummary).toMatch(/Chain ID: 31337/);
  expect(copiedSummary).toMatch(/CPI report freshness: (PASS|WARN|FAIL|LOADING)/);
  await expect(page.getByRole("link", { name: "Open protocol dashboard" })).toHaveAttribute("href", "/");
});

test("explains a supported network with no configured deployment", async ({ page }) => {
  await installAnvilProvider(page, 421_614);
  await page.goto("/health");

  await expect(page.getByRole("heading", { name: "Deployment health" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Not deployed on this network" })).toBeVisible();
  await expect(page.getByText(/Halal has no contracts configured for Arbitrum Sepolia yet/)).toBeVisible();
  await expect(page.getByText("Connect to a supported network or check the project's deployment configuration for chain id 421614.")).toBeVisible();
});

test("moves the vesting beneficiary only after the proposed address accepts", async ({ page }) => {
  await installAnvilProvider(page);
  await page.goto("/vesting");

  const connectButton = page.getByTestId("rk-connect-button");
  if (await connectButton.count()) await connectButton.click();
  await expect(page.getByRole("heading", { name: "Vesting", exact: true })).toBeVisible();

  const teamCard = page.getByText("Team Vesting", { exact: true }).locator("..").locator("..");
  const beneficiaryInput = teamCard.getByPlaceholder("New beneficiary address (0x…)");
  await beneficiaryInput.fill(ANVIL_SECOND_ACCOUNT);
  await teamCard.getByRole("button", { name: "Propose" }).click();
  await expect(teamCard.getByText("Beneficiary proposed. The new address must accept the transfer.")).toBeVisible();
  await expect(page.getByText(/Pending beneficiary: 0x7099…79c8/i)).toBeVisible();

  const secondContext = await page.context().browser()!.newContext();
  const secondPage = await secondContext.newPage();
  await installAnvilProvider(secondPage, LOCAL_CHAIN.id, ANVIL_SECOND_ACCOUNT);
  await secondPage.goto("/vesting");
  const secondConnectButton = secondPage.getByTestId("rk-connect-button");
  if (await secondConnectButton.count()) await secondConnectButton.click();
  const secondBrowserWallet = secondPage.getByRole("button", { name: "Browser Wallet" });
  if (await secondBrowserWallet.count()) await secondBrowserWallet.click();
  await expect(secondPage.getByRole("heading", { name: "Vesting", exact: true })).toBeVisible();
  const secondTeamCard = secondPage.getByText("Team Vesting", { exact: true }).locator("..").locator("..");
  await expect(secondTeamCard.getByRole("button", { name: "Accept beneficiary transfer" })).toBeVisible();
  await secondTeamCard.getByRole("button", { name: "Accept beneficiary transfer" }).click();
  await expect(secondTeamCard).toContainText("0x7099…79C8");
  await expect(secondTeamCard.getByText(/Pending beneficiary:/)).not.toBeVisible();
  await expect(secondTeamCard.getByRole("button", { name: "Accept beneficiary transfer" })).not.toBeVisible();
  await secondContext.close();
});

test("blocks an invalid governance action before any transaction is submitted", async ({ page }) => {
  await installAnvilProvider(page);
  await page.goto("/governance/new");

  const connectButton = page.getByTestId("rk-connect-button");
  if (await connectButton.count()) await connectButton.click();
  await expect(page.getByRole("button", { name: /0xf3.*2266/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "New Proposal" })).toBeVisible();

  await page.getByRole("button", { name: "Advanced (raw calls)" }).click();
  await expect(page.getByText('Invalid target address: ""')).toBeVisible();

  const submitButton = page.getByRole("button", { name: "Submit proposal" });
  await expect(submitButton).toBeDisabled();

  await page.getByPlaceholder("Target address (0x…)").fill("0x123");
  await expect(page.getByText('Invalid target address: "0x123"')).toBeVisible();
  await expect(submitButton).toBeDisabled();
  expect(await page.evaluate(() => (window as Window & { __lastTransaction?: unknown }).__lastTransaction)).toBeUndefined();
});

test("blocks a malformed governance value before any transaction is submitted", async ({ page }) => {
  await installAnvilProvider(page);
  await page.goto("/governance/new");

  const connectButton = page.getByTestId("rk-connect-button");
  if (await connectButton.count()) await connectButton.click();
  await expect(page.getByRole("button", { name: /0xf3.*2266/i })).toBeVisible();
  await page.getByRole("button", { name: "Advanced (raw calls)" }).click();

  await page.getByPlaceholder("Target address (0x…)").fill("0x0000000000000000000000000000000000000001");
  await page.getByPlaceholder("ETH value (default 0)").fill("1e3");

  await expect(page.getByText('Invalid ETH value: "1e3"')).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit proposal" })).toBeDisabled();
  expect(await page.evaluate(() => (window as Window & { __lastTransaction?: unknown }).__lastTransaction)).toBeUndefined();
});

test("blocks reserve-deficit health and pauses new PSM deposits", async ({ page }) => {
  await seedRedeemableHlc();
  const testClient = createTestClient({ chain: LOCAL_CHAIN, mode: "anvil", transport: http(RPC_URL) });
  const snapshot = await testClient.snapshot();
  const env = readLocalEnv();
  const timelock = env.NEXT_PUBLIC_HLC_TIMELOCK_31337 as `0x${string}`;
  const publicClient = createPublicClient({ chain: LOCAL_CHAIN, transport: http(RPC_URL) });
  await testClient.impersonateAccount({ address: timelock });
  await testClient.setBalance({ address: timelock, value: 10n ** 18n });
  const governanceWallet = createWalletClient({ account: timelock, chain: LOCAL_CHAIN, transport: http(RPC_URL) });
  const cpiHash = await governanceWallet.writeContract({
    account: timelock,
    address: env.NEXT_PUBLIC_HLC_PSM_31337 as `0x${string}`,
    abi: PSM_ABI,
    functionName: "mockCPI",
    args: [1_500_000n],
  });
  const cpiReceipt = await publicClient.waitForTransactionReceipt({ hash: cpiHash });
  expect(cpiReceipt.status, `reserve-deficit fixture transaction reverted: ${cpiHash}`).toBe("success");
  await testClient.stopImpersonatingAccount({ address: timelock });

  await page.goto("/health");
  await expect(page.getByRole("status", { name: "Overall deployment health" })).toContainText("Blocking");
  await expect(page.getByText("PSM reserve coverage")).toBeVisible();
  await expect(page.getByText("The PSM reserve is below the amount required to redeem all outstanding claims.")).toBeVisible();

  await installAnvilProvider(page);
  await page.goto("/psm");
  const connectButton = page.getByTestId("rk-connect-button");
  if (await connectButton.count()) await connectButton.click();
  await expect(page.getByRole("button", { name: /0xf3.*2266/i })).toBeVisible();
  await expect(page.getByText("New PSM deposits are paused")).toBeVisible();
  await expect(page.getByText(/The PSM is under-reserved/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Deposits paused until the protocol is healthy" })).toBeDisabled();
  expect(await page.evaluate(() => (window as Window & { __lastTransaction?: unknown }).__lastTransaction)).toBeUndefined();

  await testClient.revert({ id: snapshot });
});

test("blocks stale CPI health and pauses new PSM deposits", async ({ page }) => {
  await seedRedeemableHlc();
  const testClient = createTestClient({ chain: LOCAL_CHAIN, mode: "anvil", transport: http(RPC_URL) });
  const snapshot = await testClient.snapshot();
  const staleSeconds = 90 * 24 * 60 * 60 + 1;
  await testClient.increaseTime({ seconds: staleSeconds });
  await testClient.mine({ blocks: 1 });
  await page.addInitScript(({ seconds }) => {
    const realNow = Date.now;
    Date.now = () => realNow() + seconds * 1000;
  }, { seconds: staleSeconds });

  await page.goto("/health");
  await expect(page.getByRole("status", { name: "Overall deployment health" })).toContainText("Blocking");
  await expect(page.getByText("CPI report freshness")).toBeVisible();
  await expect(page.getByText("The accepted CPI report is older than the contract freshness window.")).toBeVisible();

  await installAnvilProvider(page);
  await page.goto("/psm");
  const connectButton = page.getByTestId("rk-connect-button");
  if (await connectButton.count()) await connectButton.click();
  await expect(page.getByRole("button", { name: /0xf3.*2266/i })).toBeVisible();
  await expect(page.getByText("New PSM deposits are paused")).toBeVisible();
  await expect(page.getByText("The CPI source report is stale. Deposits are paused until the updater publishes fresh data.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Deposits paused until the protocol is healthy" })).toBeDisabled();
  expect(await page.evaluate(() => (window as Window & { __lastTransaction?: unknown }).__lastTransaction)).toBeUndefined();

  await testClient.revert({ id: snapshot });
});

test("withdraws through the real HLC permit flow on disposable Anvil state", async ({ page }) => {
  await seedRedeemableHlc();
  await installAnvilProvider(page);
  await page.goto("/psm");

  const connectButton = page.getByTestId("rk-connect-button");
  if (await connectButton.count()) await connectButton.click();
  await expect(page.getByRole("button", { name: /0xf3.*2266/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Not deployed on this network" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Deposit" }).first()).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("textbox", { name: "Amount to deposit" })).toBeVisible();

  await page.getByRole("button", { name: "Withdraw" }).click();
  await expect(page.getByRole("button", { name: "Withdraw" }).first()).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("textbox", { name: "Amount to withdraw" })).toBeVisible();
  await page.locator("input[placeholder='0.0']").first().fill("100");
  await expect(page.getByRole("button", { name: "Sign & withdraw in one transaction" })).toBeVisible();
  await page.getByRole("button", { name: "Sign & withdraw in one transaction" }).click();
  const transactionHash = await expect
    .poll(() => page.evaluate(() => (window as Window & { __lastTransaction?: string }).__lastTransaction), {
      timeout: 30_000,
    })
    .toBeTruthy()
    .then(() => page.evaluate(() => (window as Window & { __lastTransaction?: string }).__lastTransaction));
  const permit = await page.evaluate(() => {
    const state = window as Window & { __permitSignature?: string; __permitData?: string };
    return { signature: state.__permitSignature, data: state.__permitData ? JSON.parse(state.__permitData) : undefined };
  });
  expect(permit.signature).toMatch(/^0x[0-9a-f]{130}$/i);
  const { v } = parseSignature(permit.signature as `0x${string}`);
  expect(v === 27n || v === 28n, `unexpected permit recovery id: ${v}`).toBe(true);
  const recovered = await recoverTypedDataAddress({ ...permit.data, signature: permit.signature });
  expect(recovered.toLowerCase()).toBe(ANVIL_ACCOUNT);
  const publicClient = createPublicClient({ chain: LOCAL_CHAIN, transport: http(RPC_URL) });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash as `0x${string}` });
  expect(receipt.status, `permit transaction reverted: ${transactionHash}`).toBe("success");
});

test("fails closed when CPI movement makes the quoted minimum withdrawal impossible", async ({ page }) => {
  await seedRedeemableHlc();
  await installAnvilProvider(page);
  await page.goto("/psm");

  const connectButton = page.getByTestId("rk-connect-button");
  if (await connectButton.count()) await connectButton.click();
  await expect(page.getByRole("button", { name: /0xf3.*2266/i })).toBeVisible();
  await page.getByRole("button", { name: "Withdraw" }).click();
  await page.locator("input[placeholder='0.0']").first().fill("100");
  await expect(page.getByText(/Minimum received \(/)).toBeVisible();

  // A 10% CPI decrease makes the old quoted reserve minimum unsafe; the bounded contract call
  // must revert instead of silently paying an unbounded amount from the stale quote.
  const testClient = createTestClient({ chain: LOCAL_CHAIN, mode: "anvil", transport: http(RPC_URL) });
  const updaterWallet = createWalletClient({ account: ANVIL_UPDATER_ACCOUNT, chain: LOCAL_CHAIN, transport: http(RPC_URL) });
  const publicClient = createPublicClient({ chain: LOCAL_CHAIN, transport: http(RPC_URL) });
  await testClient.increaseTime({ seconds: 25 * 24 * 60 * 60 + 1 });
  await testClient.mine({ blocks: 1 });
  const block = await publicClient.getBlock({ blockTag: "latest" });
  const env = readLocalEnv();
  const reportHash = await updaterWallet.writeContract({
    account: ANVIL_UPDATER_ACCOUNT,
    address: env.NEXT_PUBLIC_HLC_PSM_31337 as `0x${string}`,
    abi: PSM_ABI,
    functionName: "updateCPIWithTimestamp",
    args: [900_000n, block.timestamp],
  });
  await publicClient.waitForTransactionReceipt({ hash: reportHash });

  await page.getByRole("button", { name: "Sign & withdraw in one transaction" }).click();
  const transactionHash = await expect
    .poll(() => page.evaluate(() => (window as Window & { __lastTransaction?: string }).__lastTransaction), {
      timeout: 30_000,
    })
    .toBeTruthy()
    .then(() => page.evaluate(() => (window as Window & { __lastTransaction?: string }).__lastTransaction));
  await expect(page.getByText("Transaction failed")).toBeVisible();
  await expect(page.getByText("Withdrawal confirmed.")).toHaveCount(0);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash as `0x${string}` });
  expect(receipt.status, `unsafe quoted withdrawal unexpectedly succeeded: ${transactionHash}`).toBe("reverted");
});

test("fails closed when the cached withdrawal deadline expires", async ({ page }) => {
  await seedRedeemableHlc();
  await installAnvilProvider(page);
  await page.goto("/psm");

  const connectButton = page.getByTestId("rk-connect-button");
  if (await connectButton.count()) await connectButton.click();
  await expect(page.getByRole("button", { name: /0xf3.*2266/i })).toBeVisible();
  await page.getByRole("button", { name: "Withdraw" }).click();
  await page.locator("input[placeholder='0.0']").first().fill("100");
  await expect(page.getByRole("button", { name: "Sign & withdraw in one transaction" })).toBeVisible();

  // Advance the disposable chain beyond the UI's cached 15-minute deadline before signing.
  await advanceLocalTime(15 * 60 + 1);
  await page.getByRole("button", { name: "Sign & withdraw in one transaction" }).click();
  const transactionHash = await expect
    .poll(() => page.evaluate(() => (window as Window & { __lastTransaction?: string }).__lastTransaction), {
      timeout: 30_000,
    })
    .toBeTruthy()
    .then(() => page.evaluate(() => (window as Window & { __lastTransaction?: string }).__lastTransaction));
  await expect(page.getByText("Transaction failed")).toBeVisible();
  await expect(page.getByText("Withdrawal confirmed.")).toHaveCount(0);

  const publicClient = createPublicClient({ chain: LOCAL_CHAIN, transport: http(RPC_URL) });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash as `0x${string}` });
  expect(receipt.status, `expired withdrawal unexpectedly succeeded: ${transactionHash}`).toBe("reverted");
});

test("transfers HLC and redemption credit through the ordinary approval flow", async ({ page }) => {
  await seedRedeemableHlc();
  const env = readLocalEnv();
  const publicClient = createPublicClient({ chain: LOCAL_CHAIN, transport: http(RPC_URL) });
  const recipient = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8" as const;
  const amount = 100n * 10n ** 18n;
  const senderCreditBefore = await publicClient.readContract({
    address: env.NEXT_PUBLIC_HLC_PSM_31337 as `0x${string}`,
    abi: PSM_ABI,
    functionName: "redeemableBalance",
    args: [ANVIL_ACCOUNT],
  });
  const recipientCreditBefore = await publicClient.readContract({
    address: env.NEXT_PUBLIC_HLC_PSM_31337 as `0x${string}`,
    abi: PSM_ABI,
    functionName: "redeemableBalance",
    args: [recipient],
  });
  const senderBalanceBefore = await publicClient.readContract({
    address: env.NEXT_PUBLIC_HLC_TOKEN_31337 as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [ANVIL_ACCOUNT],
  });
  const recipientBalanceBefore = await publicClient.readContract({
    address: env.NEXT_PUBLIC_HLC_TOKEN_31337 as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [recipient],
  });

  await installAnvilProvider(page);
  await page.goto("/psm");
  const connectButton = page.getByTestId("rk-connect-button");
  if (await connectButton.count()) await connectButton.click();
  await expect(page.getByRole("button", { name: /0xf3.*2266/i })).toBeVisible();
  await page.locator("#redeemable-recipient").fill(recipient);
  await page.locator("#redeemable-amount").fill("100");
  await page.getByRole("button", { name: "Approve HLC first" }).click();
  await expect(page.getByText("HLC approval confirmed.")).toBeVisible();
  await page.getByRole("button", { name: "Transfer redemption credit" }).click();
  const transactionHash = await expect
    .poll(() => page.evaluate(() => (window as Window & { __lastTransaction?: string }).__lastTransaction), {
      timeout: 30_000,
    })
    .toBeTruthy()
    .then(() => page.evaluate(() => (window as Window & { __lastTransaction?: string }).__lastTransaction));
  await expect(page.getByText("HLC and redemption credit transferred.")).toBeVisible();

  const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash as `0x${string}` });
  expect(receipt.status, `redemption-credit transfer reverted: ${transactionHash}`).toBe("success");
  expect(
    await publicClient.readContract({
      address: env.NEXT_PUBLIC_HLC_PSM_31337 as `0x${string}`,
      abi: PSM_ABI,
      functionName: "redeemableBalance",
      args: [ANVIL_ACCOUNT],
    }),
  ).toBe(senderCreditBefore - amount);
  expect(
    await publicClient.readContract({
      address: env.NEXT_PUBLIC_HLC_PSM_31337 as `0x${string}`,
      abi: PSM_ABI,
      functionName: "redeemableBalance",
      args: [recipient],
    }),
  ).toBe(recipientCreditBefore + amount);
  expect(
    await publicClient.readContract({
      address: env.NEXT_PUBLIC_HLC_TOKEN_31337 as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [ANVIL_ACCOUNT],
    }),
  ).toBe(senderBalanceBefore - amount);
  expect(
    await publicClient.readContract({
      address: env.NEXT_PUBLIC_HLC_TOKEN_31337 as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [recipient],
    }),
  ).toBe(recipientBalanceBefore + amount);
});

test("retires a redeemable claim through the ordinary approval flow", async ({ page }) => {
  await seedRedeemableHlc();
  const env = readLocalEnv();
  const publicClient = createPublicClient({ chain: LOCAL_CHAIN, transport: http(RPC_URL) });
  const amount = 100n * 10n ** 18n;
  const creditBefore = await publicClient.readContract({
    address: env.NEXT_PUBLIC_HLC_PSM_31337 as `0x${string}`,
    abi: PSM_ABI,
    functionName: "redeemableBalance",
    args: [ANVIL_ACCOUNT],
  });
  const balanceBefore = await publicClient.readContract({
    address: env.NEXT_PUBLIC_HLC_TOKEN_31337 as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [ANVIL_ACCOUNT],
  });
  const supplyBefore = await publicClient.readContract({
    address: env.NEXT_PUBLIC_HLC_TOKEN_31337 as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "totalSupply",
  });

  await installAnvilProvider(page);
  await page.goto("/psm");
  const connectButton = page.getByTestId("rk-connect-button");
  if (await connectButton.count()) await connectButton.click();
  await expect(page.getByRole("button", { name: /0xf3.*2266/i })).toBeVisible();
  await page.locator("#redeemable-amount").fill("100");
  await page.getByRole("button", { name: "Approve HLC first" }).click();
  await expect(page.getByText("HLC approval confirmed.")).toBeVisible();
  await page.getByRole("button", { name: "Retire claim without reserve" }).click();
  const transactionHash = await expect
    .poll(() => page.evaluate(() => (window as Window & { __lastTransaction?: string }).__lastTransaction), {
      timeout: 30_000,
    })
    .toBeTruthy()
    .then(() => page.evaluate(() => (window as Window & { __lastTransaction?: string }).__lastTransaction));
  await expect(page.getByText("HLC burned and redemption claim retired.")).toBeVisible();

  const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash as `0x${string}` });
  expect(receipt.status, `claim retirement reverted: ${transactionHash}`).toBe("success");
  expect(
    await publicClient.readContract({
      address: env.NEXT_PUBLIC_HLC_PSM_31337 as `0x${string}`,
      abi: PSM_ABI,
      functionName: "redeemableBalance",
      args: [ANVIL_ACCOUNT],
    }),
  ).toBe(creditBefore - amount);
  expect(
    await publicClient.readContract({
      address: env.NEXT_PUBLIC_HLC_TOKEN_31337 as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [ANVIL_ACCOUNT],
    }),
  ).toBe(balanceBefore - amount);
  expect(
    await publicClient.readContract({
      address: env.NEXT_PUBLIC_HLC_TOKEN_31337 as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "totalSupply",
    }),
  ).toBe(supplyBefore - amount);
});

test("blocks health when the adapter and PSM report watermarks diverge", async ({ page }) => {
  await submitDivergentPsmReport();
  await page.goto("/health");

  await expect(page.getByRole("status", { name: "Overall deployment health" })).toContainText("Blocking");
  await expect(page.getByText("Signed CPI adapter")).toBeVisible();
  await expect(page.getByText("Adapter quorum, ownership, source identity, or report watermark diverges from the deployment.")).toBeVisible();
});
