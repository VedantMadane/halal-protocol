import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, parseSignature, parseUnits, recoverTypedDataAddress } from "viem";

const RPC_URL = "http://127.0.0.1:18545";
const ANVIL_ACCOUNT = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266" as const;
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
] as const;
const PSM_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [{ name: "reserveAmount", type: "uint256" }],
    outputs: [],
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

async function installAnvilProvider(page: Page) {
  await page.addInitScript(({ rpcUrl, account }) => {
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    const provider = {
      isMetaMask: true,
      request: async ({ method, params = [] }: { method: string; params?: unknown[] }) => {
        if (method === "eth_accounts" || method === "eth_requestAccounts") return [account];
        if (method === "eth_chainId") return "0x7a69";
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
    Object.defineProperty(window, "ethereum", { configurable: false, value: provider });
  }, { rpcUrl: RPC_URL, account: ANVIL_ACCOUNT });
}

test("renders deployment health without a wallet provider", async ({ page }) => {
  await page.goto("/health");

  await expect(page.getByRole("heading", { name: "Deployment health" })).toBeVisible();
  await expect(page.getByText("Read-only checks from the selected chain.")).toBeVisible();
  await expect(page.getByText("Deployment checks")).toBeVisible();
  await expect(page.getByRole("status", { name: "Overall deployment health" })).toContainText(/Healthy|Review|Blocking|Checking/);
  await expect(page.getByText("Chain ID:").locator("..")).toContainText("31337");
  await expect(page.getByText("Contract wiring and roles")).toBeVisible();
  await expect(page.getByText("CPI report freshness")).toBeVisible();
  await expect(page.getByText("PSM reserve coverage")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open protocol dashboard" })).toHaveAttribute("href", "/");
});

test("withdraws through the real HLC permit flow on disposable Anvil state", async ({ page }) => {
  await seedRedeemableHlc();
  await installAnvilProvider(page);
  await page.goto("/psm");

  const connectButton = page.getByTestId("rk-connect-button");
  if (await connectButton.count()) await connectButton.click();
  await expect(page.getByRole("button", { name: /0xf3.*2266/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Not deployed on this network" })).toHaveCount(0);

  await page.getByRole("button", { name: "Withdraw" }).click();
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
