import { BaseError, ContractFunctionRevertedError } from "viem";

/** Custom Solidity errors declared across the five Halal contracts, mapped to plain language. */
const KNOWN_ERRORS: Record<string, string> = {
  ZeroAmount: "Amount must be greater than zero.",
  ZeroAddress: "That address can't be the zero address.",
  ZeroAllocation: "Allocation must be greater than zero.",
  RateOutOfBounds: "That CPI rate is outside the allowed 0.1–2.0 range.",
  StepTooLarge: "That CPI change is larger than the 20% per-update limit.",
  UpdateTooSoon: "The minimum interval between CPI updates hasn't elapsed yet.",
  InsufficientReserve: "The PSM doesn't currently hold enough reserve to complete this withdrawal.",
  InsufficientRedeemableBalance:
    "You can only redeem HLC you personally minted through this PSM. Genesis/vesting HLC and PSM-minted HLC received from someone else can't be withdrawn here.",
  TransferFailed: "The token transfer failed.",
  NotDAO: "Only the DAO timelock can call this.",
  NotBeneficiary: "Only the vesting beneficiary can call this.",
  NotRevocable: "This vesting schedule isn't revocable.",
  AlreadyRevoked: "This vesting schedule has already been revoked.",
  NothingToRelease: "There's nothing vested and unreleased to claim yet.",
  GenesisAlreadyMinted: "The genesis token supply has already been minted.",
  ERC20InsufficientAllowance: "Insufficient token allowance — try approving again.",
  ERC20InsufficientBalance: "Insufficient token balance for this transaction.",
  GovernorInsufficientProposerVotes: "You don't have enough voting power to create a proposal.",
  GovernorUnexpectedProposalState: "This proposal isn't in the right state for that action yet.",
  GovernorAlreadyCastVote: "You've already voted on this proposal.",
  GovernorInvalidVoteType: "Invalid vote type.",
  GovernorNonexistentProposal: "That proposal doesn't exist.",
};

/**
 * Converts a wagmi/viem write or simulate error into a short, plain-language message safe to
 * show directly to end users. Falls back to viem's own short message, then a generic string.
 */
export function getFriendlyErrorMessage(error: unknown): string {
  if (error instanceof BaseError) {
    const revertError = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revertError instanceof ContractFunctionRevertedError) {
      const errorName = revertError.data?.errorName;
      if (errorName && KNOWN_ERRORS[errorName]) return KNOWN_ERRORS[errorName];
      if (errorName) return `Transaction reverted: ${errorName}.`;
      if (revertError.reason) return `Transaction reverted: ${revertError.reason}.`;
    }

    if (error.shortMessage?.toLowerCase().includes("user rejected")) {
      return "You rejected the transaction in your wallet.";
    }
    if (error.shortMessage?.toLowerCase().includes("insufficient funds")) {
      return "Insufficient funds to cover the transaction and gas.";
    }
    return error.shortMessage || error.message;
  }

  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
