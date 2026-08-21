// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { HalalToken } from "./HalalToken.sol";

/// @title HalalPSM (Peg Stability Module)
/// @notice Mints HLC against a reserve asset (e.g. DAI) at a CPI-adjusted rate, and burns HLC to
/// return reserve on withdrawal. HLC minted here is fully collateralized 1:1 by the reserve asset
/// held in this contract, so PSM issuance does not affect the fixed genesis supply held by vesting.
///
/// CPI rate design: `cpiRate` tracks the price of 1 HLC in reserve-asset terms, scaled by
/// `CPI_PRECISION`. As CPI (inflation) rises, `cpiRate` rises, so each HLC buys more reserve on
/// withdrawal and each unit of reserve mints fewer HLC on deposit -- HLC's real purchasing power is
/// held roughly constant while its reserve-asset price floats with inflation.
///
/// Redemption rights are per-depositor, not per-token: HLC is a single fungible ERC20 shared with
/// the genesis team/treasury allocation (see HalalToken), which was never backed by any reserve.
/// If `withdraw` let *any* HLC holder redeem against the shared reserve, genesis/vesting HLC --
/// costless to acquire -- could drain reserve contributed by actual depositors. `redeemableBalance`
/// tracks, per address, how much HLC that address itself minted via `deposit` and hasn't yet
/// redeemed; `withdraw` can never pull more than the caller's own credit, regardless of how much
/// HLC they hold. The tradeoff: PSM-minted HLC transferred to another address loses its redemption
/// right at this PSM (the recipient can hold/spend it like any HLC, just not `withdraw` it here) --
/// deliberate, see docs/DESIGN-DECISIONS.md.
///
/// Chainlink Functions note: the original design calls for an on-chain Chainlink Functions request in
/// `updateCPI()`. To keep this repo self-contained and testable without a live Functions
/// subscription, `updateCPI` here is a bounds- and rate-limited *report submission* function gated by
/// `UPDATER_ROLE`. In production, grant `UPDATER_ROLE` to a Chainlink Functions consumer (or Chainlink
/// Automation-triggered relayer) that fetches CPI off-chain and submits it here -- routine monthly
/// updates then don't require a full 9-day governance cycle, while who is allowed to submit, and the
/// bounds/step-limit those submissions are checked against, remain governance-controlled.
contract HalalPSM is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant PARAM_ROLE = keccak256("PARAM_ROLE");
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");

    uint256 public constant CPI_PRECISION = 1_000_000; // 1.0 == 1_000_000
    uint256 public constant MIN_CPI = 100_000; // 0.1
    uint256 public constant MAX_CPI = 2_000_000; // 2.0
    uint256 public constant MAX_CPI_STEP_BPS = 2_000; // 20% max move per updateCPI() call

    IERC20 public immutable reserve;
    HalalToken public immutable hlc;
    uint8 private immutable _reserveDecimals;
    uint8 private constant HLC_DECIMALS = 18;

    uint256 public cpiRate = CPI_PRECISION;
    uint256 public previousCPI = CPI_PRECISION;
    uint256 public lastUpdated;
    uint256 public minUpdateInterval = 25 days;
    uint256 public totalHlcIssued;
    string public source;

    /// @dev HLC amount each address minted via `deposit` and hasn't yet redeemed via `withdraw`.
    /// Sum over all addresses always equals `totalHlcIssued`. See the contract-level NatSpec for why
    /// this exists.
    mapping(address => uint256) public redeemableBalance;

    event Deposited(address indexed user, uint256 reserveIn, uint256 hlcOut);
    event Withdrawn(address indexed user, uint256 hlcIn, uint256 reserveOut);
    event CPIUpdated(uint256 previousCPI, uint256 newCPI, bool viaUpdater);
    event SourceUpdated(string newSource);
    event MinUpdateIntervalUpdated(uint256 newInterval);
    event ReserveDeposited(address indexed from, uint256 amount);
    event ReserveWithdrawn(address indexed to, uint256 amount);

    error ZeroAmount();
    error ZeroAddress();
    error RateOutOfBounds();
    error StepTooLarge();
    error UpdateTooSoon();
    error InsufficientReserve();
    error TransferFailed();
    error InsufficientRedeemableBalance();

    /// @param reserve_ Reserve asset (e.g. DAI). Any ERC20Metadata-compliant token works; decimals
    /// are normalized against HLC's 18 decimals.
    /// @param hlc_ HalalToken address. This contract must be granted `HalalToken.MINTER_ROLE` for
    /// deposits to work.
    /// @param dao DAO timelock; receives `DEFAULT_ADMIN_ROLE` and `PARAM_ROLE`.
    constructor(address reserve_, address hlc_, address dao) {
        if (reserve_ == address(0) || hlc_ == address(0) || dao == address(0)) revert ZeroAddress();

        reserve = IERC20(reserve_);
        hlc = HalalToken(hlc_);
        _reserveDecimals = IERC20Metadata(reserve_).decimals();
        lastUpdated = block.timestamp;

        _grantRole(DEFAULT_ADMIN_ROLE, dao);
        _grantRole(PARAM_ROLE, dao);
    }

    // ── User-facing ──────────────────────────────────────────────────────

    /// @notice Deposits reserve asset, mints the CPI-adjusted amount of HLC to the caller. Mints
    /// against the actual balance received, not the requested amount, so a fee-on-transfer or
    /// otherwise non-standard reserve token can't cause HLC to be minted against reserve the PSM
    /// never actually received.
    function deposit(uint256 reserveAmount) external nonReentrant {
        if (reserveAmount == 0) revert ZeroAmount();
        uint256 balanceBefore = reserve.balanceOf(address(this));
        reserve.safeTransferFrom(msg.sender, address(this), reserveAmount);
        uint256 received = reserve.balanceOf(address(this)) - balanceBefore;

        uint256 hlcOut = _reserveToHlc(received);
        totalHlcIssued += hlcOut;
        redeemableBalance[msg.sender] += hlcOut;
        hlc.mint(msg.sender, hlcOut);
        emit Deposited(msg.sender, received, hlcOut);
    }

    /// @notice Burns HLC from the caller (requires prior `approve`), returns the CPI-adjusted amount
    /// of reserve asset. Capped by the caller's own `redeemableBalance` -- only redeems HLC the
    /// caller itself minted here via `deposit`, never genesis/vesting HLC or PSM-minted HLC received
    /// from someone else's deposit (see the contract-level NatSpec for why).
    function withdraw(uint256 hlcAmount) external nonReentrant {
        if (hlcAmount == 0) revert ZeroAmount();
        if (redeemableBalance[msg.sender] < hlcAmount) revert InsufficientRedeemableBalance();
        uint256 reserveOut = _hlcToReserve(hlcAmount);
        if (reserve.balanceOf(address(this)) < reserveOut) revert InsufficientReserve();

        totalHlcIssued -= hlcAmount;
        redeemableBalance[msg.sender] -= hlcAmount;
        bool ok = hlc.transferFrom(msg.sender, address(this), hlcAmount);
        if (!ok) revert TransferFailed();
        hlc.burn(hlcAmount);
        reserve.safeTransfer(msg.sender, reserveOut);
        emit Withdrawn(msg.sender, hlcAmount, reserveOut);
    }

    /// @notice Reserve balance the PSM would need on hand to fully redeem all outstanding
    /// PSM-issued HLC at the current CPI rate. Because deposits lock in reserve at the CPI rate
    /// prevailing *at deposit time* while withdrawals pay out at the rate prevailing *at withdrawal
    /// time*, a rising CPI increases this requirement over time -- the DAO/treasury must keep the
    /// reserve topped up (fees, treasury allocations, `depositReserve`) to stay ahead of it. `deposit`
    /// itself is always exactly self-funding; the gap, if any, comes from CPI having risen since
    /// existing holders minted.
    function reserveRequired() public view returns (uint256) {
        return _hlcToReserve(totalHlcIssued);
    }

    /// @notice Actual reserve balance minus `reserveRequired()`. Negative means the PSM cannot
    /// currently redeem all outstanding PSM-issued HLC at the current rate (individual withdrawals
    /// up to the shortfall will still succeed on a first-come-first-served basis; `withdraw` always
    /// reverts safely rather than paying out from insufficient funds).
    function reserveSurplus() external view returns (int256) {
        return int256(reserve.balanceOf(address(this))) - int256(reserveRequired());
    }

    function previewDeposit(uint256 reserveAmount) external view returns (uint256) {
        return _reserveToHlc(reserveAmount);
    }

    function previewWithdraw(uint256 hlcAmount) external view returns (uint256) {
        return _hlcToReserve(hlcAmount);
    }

    // ── Oracle / rate management ─────────────────────────────────────────

    /// @notice Submits a new CPI reading. Rate- and step-limited so a malfunctioning or compromised
    /// updater cannot move the peg further than `MAX_CPI_STEP_BPS` or more often than
    /// `minUpdateInterval`.
    function updateCPI(uint256 reportedCPI) external onlyRole(UPDATER_ROLE) {
        // validator timestamp manipulation is bounded to seconds, negligible against a multi-day interval
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < lastUpdated + minUpdateInterval) revert UpdateTooSoon();
        _setCPI(reportedCPI, true);
        emit CPIUpdated(previousCPI, cpiRate, true);
    }

    /// @notice DAO-gated emergency/manual override, bypassing the step and interval limits (still
    /// bounded to [MIN_CPI, MAX_CPI]). Intended for governance-approved corrections, e.g. oracle
    /// failure or a disputed reading.
    function mockCPI(uint256 newCPI) external onlyRole(PARAM_ROLE) {
        _setCPI(newCPI, false);
        emit CPIUpdated(previousCPI, cpiRate, false);
    }

    function setSource(string calldata newSource) external onlyRole(PARAM_ROLE) {
        source = newSource;
        emit SourceUpdated(newSource);
    }

    function setMinUpdateInterval(uint256 newInterval) external onlyRole(PARAM_ROLE) {
        minUpdateInterval = newInterval;
        emit MinUpdateIntervalUpdated(newInterval);
    }

    /// @notice DAO-approved top-up of reserves (e.g. bootstrapping liquidity from the treasury).
    function depositReserve(uint256 amount) external onlyRole(PARAM_ROLE) {
        if (amount == 0) revert ZeroAmount();
        reserve.safeTransferFrom(msg.sender, address(this), amount);
        emit ReserveDeposited(msg.sender, amount);
    }

    /// @notice DAO-approved reserve withdrawal (e.g. reallocating idle reserve, winding down a
    /// deprecated PSM). Left deliberately simple; a production deployment may want a reserve-ratio
    /// floor check here.
    function withdrawReserve(address to, uint256 amount) external onlyRole(PARAM_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        reserve.safeTransfer(to, amount);
        emit ReserveWithdrawn(to, amount);
    }

    // ── Internal ─────────────────────────────────────────────────────────

    function _setCPI(uint256 newCPI, bool enforceStepLimit) internal {
        if (newCPI < MIN_CPI || newCPI > MAX_CPI) revert RateOutOfBounds();
        if (enforceStepLimit) {
            uint256 delta = newCPI > cpiRate ? newCPI - cpiRate : cpiRate - newCPI;
            if (delta > (cpiRate * MAX_CPI_STEP_BPS) / 10_000) revert StepTooLarge();
        }
        previousCPI = cpiRate;
        cpiRate = newCPI;
        lastUpdated = block.timestamp;
    }

    function _reserveToHlc(uint256 reserveAmount) internal view returns (uint256) {
        uint256 at18 = _scaleTo18(reserveAmount, _reserveDecimals);
        return (at18 * CPI_PRECISION) / cpiRate;
    }

    function _hlcToReserve(uint256 hlcAmount) internal view returns (uint256) {
        uint256 at18 = (hlcAmount * cpiRate) / CPI_PRECISION;
        return _scaleFrom18(at18, _reserveDecimals);
    }

    function _scaleTo18(uint256 amount, uint8 decimals) internal pure returns (uint256) {
        if (decimals == HLC_DECIMALS) return amount;
        if (decimals < HLC_DECIMALS) return amount * (10 ** (HLC_DECIMALS - decimals));
        return amount / (10 ** (decimals - HLC_DECIMALS));
    }

    function _scaleFrom18(uint256 amount, uint8 decimals) internal pure returns (uint256) {
        if (decimals == HLC_DECIMALS) return amount;
        if (decimals < HLC_DECIMALS) return amount / (10 ** (HLC_DECIMALS - decimals));
        return amount * (10 ** (decimals - HLC_DECIMALS));
    }
}
