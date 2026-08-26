// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title HalalVesting
/// @notice Linear vesting with an optional cliff for a single beneficiary, funded once at deployment
/// with a fixed `totalAllocation` (rather than reading live balance, so accounting stays correct even
/// after a revoke sweeps unvested tokens out). One instance is deployed per beneficiary (team, treasury).
contract HalalVesting {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public immutable dao;
    uint64 public immutable start;
    uint64 public immutable cliff;
    uint64 public immutable duration;
    uint256 public immutable totalAllocation;
    bool public immutable revocable;

    address public beneficiary;
    address public pendingBeneficiary;
    uint256 public released;
    bool public revoked;
    uint256 public revokedVestedAmount;

    event Released(address indexed beneficiary, uint256 amount);
    event Revoked(uint256 vestedAmount, uint256 unvestedAmountReturned);
    event BeneficiaryTransferProposed(address indexed oldBeneficiary, address indexed proposedBeneficiary);
    event BeneficiaryUpdated(address indexed oldBeneficiary, address indexed newBeneficiary);

    error ZeroAddress();
    error NotContract();
    error ZeroAllocation();
    error ZeroDuration();
    error CliffExceedsDuration();
    error ScheduleOverflow();
    error NotDAO();
    error NotBeneficiary();
    error NotPendingBeneficiary();
    error NotRevocable();
    error AlreadyRevoked();
    error NothingToRelease();

    modifier onlyDAO() {
        if (msg.sender != dao) revert NotDAO();
        _;
    }

    /// @param token_ HLC token address.
    /// @param beneficiary_ Recipient of vested tokens.
    /// @param dao_ DAO timelock address; the only account that can call `revoke`.
    /// @param start_ Unix timestamp vesting begins.
    /// @param cliff_ Seconds after `start_` before any tokens vest.
    /// @param duration_ Total seconds for the linear schedule (measured from `start_`, cliff included).
    /// @param totalAllocation_ Exact amount this contract will be funded with; used for the vesting curve
    /// instead of `token.balanceOf(this)` so a `revoke` sweep doesn't retroactively change past math.
    /// @param revocable_ Whether the DAO may revoke unvested tokens (team: true, treasury: false).
    constructor(
        address token_,
        address beneficiary_,
        address dao_,
        uint64 start_,
        uint64 cliff_,
        uint64 duration_,
        uint256 totalAllocation_,
        bool revocable_
    ) {
        if (token_ == address(0) || beneficiary_ == address(0) || dao_ == address(0)) {
            revert ZeroAddress();
        }
        if (token_.code.length == 0 || dao_.code.length == 0) revert NotContract();
        if (totalAllocation_ == 0) revert ZeroAllocation();
        if (duration_ == 0) revert ZeroDuration();
        if (cliff_ > duration_) revert CliffExceedsDuration();
        if (start_ > type(uint64).max - duration_) revert ScheduleOverflow();

        token = IERC20(token_);
        beneficiary = beneficiary_;
        dao = dao_;
        start = start_;
        cliff = cliff_;
        duration = duration_;
        totalAllocation = totalAllocation_;
        revocable = revocable_;
    }

    /// @notice Amount vested as of `timestamp`, ignoring what has already been released.
    function vestedAmount(uint64 timestamp) public view returns (uint256) {
        if (revoked) return revokedVestedAmount;
        if (timestamp < start + cliff) return 0;
        if (timestamp >= start + duration) return totalAllocation;
        return Math.mulDiv(totalAllocation, timestamp - start, duration);
    }

    /// @notice Amount currently claimable by the beneficiary.
    function releasable() public view returns (uint256) {
        return vestedAmount(uint64(block.timestamp)) - released;
    }

    /// @notice Sends all currently-vested, not-yet-released tokens to the beneficiary. Callable by anyone
    /// (funds always go to `beneficiary`, so there's no incentive to restrict the caller).
    function release() external {
        uint256 amount = releasable();
        if (amount == 0) revert NothingToRelease();
        released += amount;
        token.safeTransfer(beneficiary, amount);
        emit Released(beneficiary, amount);
    }

    /// @notice Freezes vesting at the currently-vested amount and returns the remainder to the DAO
    /// treasury. Only callable on revocable schedules (team vesting), and only once.
    function revoke() external onlyDAO {
        if (!revocable) revert NotRevocable();
        if (revoked) revert AlreadyRevoked();

        uint256 vested = vestedAmount(uint64(block.timestamp));
        uint256 unvested = totalAllocation - vested;

        revoked = true;
        revokedVestedAmount = vested;

        if (unvested > 0) {
            token.safeTransfer(dao, unvested);
        }

        emit Revoked(vested, unvested);
    }

    /// @notice First step of rotating the beneficiary address (e.g. migrating multisigs). Two-step
    /// (propose + accept) rather than a single write, so a typo'd address can't permanently misdirect
    /// future vested tokens -- the new address must actively accept before it takes effect.
    function proposeBeneficiary(address newBeneficiary) external {
        if (msg.sender != beneficiary) revert NotBeneficiary();
        if (newBeneficiary == address(0)) revert ZeroAddress();
        pendingBeneficiary = newBeneficiary;
        emit BeneficiaryTransferProposed(beneficiary, newBeneficiary);
    }

    /// @notice Second step: the proposed address confirms it controls itself and is ready to receive
    /// future releases.
    function acceptBeneficiary() external {
        if (msg.sender != pendingBeneficiary) revert NotPendingBeneficiary();
        emit BeneficiaryUpdated(beneficiary, msg.sender);
        beneficiary = msg.sender;
        pendingBeneficiary = address(0);
    }
}
