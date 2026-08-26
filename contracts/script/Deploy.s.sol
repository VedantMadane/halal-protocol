// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { HalalToken } from "../src/HalalToken.sol";
import { HalalVesting } from "../src/HalalVesting.sol";
import { HalalPSM } from "../src/HalalPSM.sol";
import { HalalDAO } from "../src/HalalDAO.sol";
import { HalalTimelock } from "../src/HalalTimelock.sol";

/// @notice Deploys the full Halal system and wires every role to the DAO, leaving the deployer with
/// zero privileged access on any contract. Requires env vars:
///   PRIVATE_KEY            deployer key (broadcaster)
///   EXPECTED_CHAIN_ID      exact chain id returned by the selected RPC; deployment fails closed on mismatch
///   RESERVE_TOKEN          reserve asset for the PSM (e.g. DAI address on the target network)
///   TEAM_BENEFICIARY       team vesting beneficiary (should be a multisig, not the deployer)
///   TREASURY_BENEFICIARY   treasury vesting beneficiary (should be a multisig, not the deployer)
/// Optional env vars (defaults match docs/TECHNICAL-DOCS.md):
///   VOTING_DELAY_BLOCKS (1), VOTING_PERIOD_BLOCKS (chain-aware), PROPOSAL_THRESHOLD_WHOLE_HLC (100),
///   QUORUM_PERCENT (4), TIMELOCK_DELAY_SECONDS (172800), CPI_UPDATER (unset)
///
/// IMPORTANT: VOTING_PERIOD_BLOCKS is denominated in the target chain's blocks. The script uses
/// 2,419,200 blocks (about one week) on Arbitrum and 50,400 blocks elsewhere by default. Always
/// review the chosen value against the target chain's observed block cadence before deployment.
///
/// Deployment logic is split into small internal helpers (rather than one long `run()`) to stay
/// under Solidity's local-variable stack limit without needing `via_ir` -- via_ir's more aggressive
/// optimizations are deliberately kept off project-wide, see docs/DESIGN-DECISIONS.md for the
/// `block.timestamp`-caching bug that caused across cheatcode time-travel in test runs.
contract DeployHalalSystem is Script {
    error InvalidConfig();
    error InvalidWiring();

    struct DeployConfig {
        address deployer;
        address reserveToken;
        address teamBeneficiary;
        address treasuryBeneficiary;
        uint48 votingDelay;
        uint32 votingPeriod;
        uint256 proposalThreshold;
        uint256 quorumPercent;
        uint256 timelockDelay;
        address cpiUpdater;
    }

    function run()
        external
        virtual
        returns (
            HalalTimelock timelock,
            HalalToken token,
            HalalVesting teamVesting,
            HalalVesting treasuryVesting,
            HalalDAO dao,
            HalalPSM psm
        )
    {
        DeployConfig memory cfg = _loadConfig();

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        (timelock, token, teamVesting, treasuryVesting, dao, psm) = _deploySystem(cfg);

        vm.stopBroadcast();

        _logSummary(timelock, token, teamVesting, treasuryVesting, dao, psm, cfg.cpiUpdater);
    }

    /// @dev Shared deployment path used by the production deployment and the local demo script.
    /// Keeping the role wiring in one function prevents the demo from becoming a second, subtly
    /// different security model.
    function _deploySystem(DeployConfig memory cfg)
        internal
        returns (
            HalalTimelock timelock,
            HalalToken token,
            HalalVesting teamVesting,
            HalalVesting treasuryVesting,
            HalalDAO dao,
            HalalPSM psm
        )
    {
        (timelock, token) = _deployCore(cfg);
        (teamVesting, treasuryVesting) = _deployVesting(cfg, token, timelock);
        token.initialMint(address(teamVesting), address(treasuryVesting));
        dao = _deployGovernance(cfg, token, timelock);
        psm = new HalalPSM(cfg.reserveToken, address(token), address(timelock), cfg.cpiUpdater);
        _wireRoles(cfg.deployer, token, timelock, dao, psm);
        _assertWiring(
            cfg.deployer,
            cfg.teamBeneficiary,
            cfg.treasuryBeneficiary,
            cfg.cpiUpdater,
            token,
            teamVesting,
            treasuryVesting,
            dao,
            timelock,
            psm
        );
    }

    function _loadConfig() internal view returns (DeployConfig memory cfg) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        if (privateKey == 0) revert InvalidConfig();
        uint256 expectedChainId = vm.envOr("EXPECTED_CHAIN_ID", uint256(0));
        if (!_isExpectedChainId(expectedChainId, block.chainid)) revert InvalidConfig();
        cfg.deployer = vm.addr(privateKey);
        cfg.reserveToken = vm.envAddress("RESERVE_TOKEN");
        cfg.teamBeneficiary = vm.envAddress("TEAM_BENEFICIARY");
        cfg.treasuryBeneficiary = vm.envAddress("TREASURY_BENEFICIARY");
        uint256 votingDelay = vm.envOr("VOTING_DELAY_BLOCKS", uint256(1));
        uint256 votingPeriod = vm.envOr("VOTING_PERIOD_BLOCKS", _defaultVotingPeriod(block.chainid));
        uint256 thresholdWholeHlc = vm.envOr("PROPOSAL_THRESHOLD_WHOLE_HLC", uint256(100));
        cfg.quorumPercent = vm.envOr("QUORUM_PERCENT", uint256(4));
        cfg.timelockDelay = vm.envOr("TIMELOCK_DELAY_SECONDS", uint256(2 days));
        cfg.cpiUpdater = vm.envOr("CPI_UPDATER", address(0));

        if (
            votingDelay > type(uint48).max || votingPeriod == 0 || votingPeriod > type(uint32).max
                || thresholdWholeHlc == 0 || thresholdWholeHlc > type(uint256).max / 1e18 || cfg.quorumPercent == 0
                || cfg.quorumPercent > 100 || cfg.timelockDelay == 0 || cfg.reserveToken == address(0)
                || !_reserveTokenIsContract(cfg.reserveToken)
                || !_beneficiariesAreDistinct(cfg.teamBeneficiary, cfg.treasuryBeneficiary)
                || !_beneficiariesAreContracts(cfg.teamBeneficiary, cfg.treasuryBeneficiary)
                || cfg.teamBeneficiary == cfg.deployer || cfg.treasuryBeneficiary == cfg.deployer
                || cfg.cpiUpdater == cfg.deployer
        ) revert InvalidConfig();

        // forge-lint: disable-next-line(unsafe-typecast)
        cfg.votingDelay = uint48(votingDelay);
        // forge-lint: disable-next-line(unsafe-typecast)
        cfg.votingPeriod = uint32(votingPeriod);
        cfg.proposalThreshold = thresholdWholeHlc * 1e18;
    }

    /// @dev Kept separate so the chain-identity guard can be tested without reading process env vars.
    function _isExpectedChainId(uint256 expectedChainId, uint256 actualChainId) internal pure returns (bool) {
        return expectedChainId != 0 && expectedChainId == actualChainId;
    }

    function _beneficiariesAreDistinct(address teamBeneficiary, address treasuryBeneficiary)
        internal
        pure
        returns (bool)
    {
        return teamBeneficiary != address(0) && treasuryBeneficiary != address(0)
            && teamBeneficiary != treasuryBeneficiary;
    }

    /// @dev Production beneficiaries are expected to be deployed multisig/custody contracts. The
    /// local demo bypasses _loadConfig and intentionally permits disposable Anvil EOAs.
    function _beneficiariesAreContracts(address teamBeneficiary, address treasuryBeneficiary)
        internal
        view
        returns (bool)
    {
        return teamBeneficiary.code.length > 0 && treasuryBeneficiary.code.length > 0;
    }

    function _reserveTokenIsContract(address reserveToken) internal view returns (bool) {
        return reserveToken.code.length > 0;
    }

    function _defaultVotingPeriod(uint256 chainId) internal pure returns (uint256) {
        // Arbitrum's fast L2 block cadence makes the Ethereum-oriented 50,400-block default
        // dangerously short. Operators can still override this for a different governance policy.
        if (chainId == 42_161 || chainId == 421_614) return 2_419_200;
        return 50_400;
    }

    function _deployCore(DeployConfig memory cfg) internal returns (HalalTimelock timelock, HalalToken token) {
        address[] memory proposers = new address[](0);
        address[] memory executors = new address[](1);
        executors[0] = address(0); // open executor role: anyone can execute a queued proposal

        timelock = new HalalTimelock(cfg.timelockDelay, proposers, executors, cfg.deployer);
        token = new HalalToken(cfg.deployer);
    }

    function _deployVesting(DeployConfig memory cfg, HalalToken token, HalalTimelock timelock)
        internal
        returns (HalalVesting teamVesting, HalalVesting treasuryVesting)
    {
        teamVesting = new HalalVesting(
            address(token),
            cfg.teamBeneficiary,
            address(timelock),
            uint64(block.timestamp),
            365 days,
            4 * 365 days,
            token.TEAM_ALLOCATION(),
            true
        );

        treasuryVesting = new HalalVesting(
            address(token),
            cfg.treasuryBeneficiary,
            address(timelock),
            uint64(block.timestamp),
            0,
            3 * 365 days,
            token.TREASURY_ALLOCATION(),
            false
        );
    }

    function _deployGovernance(DeployConfig memory cfg, HalalToken token, HalalTimelock timelock)
        internal
        returns (HalalDAO dao)
    {
        dao = new HalalDAO(token, timelock, cfg.votingDelay, cfg.votingPeriod, cfg.proposalThreshold, cfg.quorumPercent);
    }

    function _wireRoles(address deployer, HalalToken token, HalalTimelock timelock, HalalDAO dao, HalalPSM psm)
        internal
    {
        // Token: PSM can mint and burn against collateral; timelock becomes admin; deployer exits.
        token.grantRole(token.MINTER_ROLE(), address(psm));
        token.grantRole(token.BURNER_ROLE(), address(psm));
        token.grantRole(token.DEFAULT_ADMIN_ROLE(), address(timelock));
        token.revokeRole(token.MINTER_ROLE(), deployer);
        token.revokeRole(token.DEFAULT_ADMIN_ROLE(), deployer);

        // Timelock: DAO becomes proposer; deployer gives up admin. No CANCELLER_ROLE grant here --
        // Governor's own cancel() only ever calls timelock.cancel() for a proposal that was both
        // already queued AND still passes _validateCancel's Pending-state check, which is
        // mutually exclusive with being queued. Granting CANCELLER_ROLE to the DAO would be dead
        // weight, not a safety net -- see docs/DESIGN-DECISIONS.md for why there's deliberately no
        // guardian/emergency-cancel path here instead (that would itself be an admin backdoor).
        timelock.grantRole(timelock.PROPOSER_ROLE(), address(dao));
        timelock.revokeRole(timelock.DEFAULT_ADMIN_ROLE(), deployer);
    }

    function _assertWiring(
        address deployer,
        address teamBeneficiary,
        address treasuryBeneficiary,
        address cpiUpdater,
        HalalToken token,
        HalalVesting teamVesting,
        HalalVesting treasuryVesting,
        HalalDAO dao,
        HalalTimelock timelock,
        HalalPSM psm
    ) internal view {
        if (
            !token.genesisMinted() || token.balanceOf(address(teamVesting)) != token.TEAM_ALLOCATION()
                || token.balanceOf(address(treasuryVesting)) != token.TREASURY_ALLOCATION()
                || teamVesting.beneficiary() != teamBeneficiary || treasuryVesting.beneficiary() != treasuryBeneficiary
                || teamVesting.cliff() != 365 days || teamVesting.duration() != 4 * 365 days || !teamVesting.revocable()
                || treasuryVesting.cliff() != 0 || treasuryVesting.duration() != 3 * 365 days
                || treasuryVesting.revocable() || !token.hasRole(token.MINTER_ROLE(), address(psm))
                || !token.hasRole(token.BURNER_ROLE(), address(psm))
                || !token.hasRole(token.DEFAULT_ADMIN_ROLE(), address(timelock))
                || token.hasRole(token.MINTER_ROLE(), deployer) || token.hasRole(token.DEFAULT_ADMIN_ROLE(), deployer)
                || !timelock.hasRole(timelock.PROPOSER_ROLE(), address(dao))
                || timelock.hasRole(timelock.DEFAULT_ADMIN_ROLE(), deployer)
                || !psm.hasRole(psm.DEFAULT_ADMIN_ROLE(), address(timelock))
                || !psm.hasRole(psm.PARAM_ROLE(), address(timelock))
                || (cpiUpdater != address(0) && !psm.hasRole(psm.UPDATER_ROLE(), cpiUpdater))
                || psm.hasRole(psm.UPDATER_ROLE(), deployer)
        ) revert InvalidWiring();
    }

    function _logSummary(
        HalalTimelock timelock,
        HalalToken token,
        HalalVesting teamVesting,
        HalalVesting treasuryVesting,
        HalalDAO dao,
        HalalPSM psm,
        address cpiUpdater
    ) internal view {
        console.log("HalalTimelock:      ", address(timelock));
        console.log("HalalToken (HLC):   ", address(token));
        console.log("Team Vesting:       ", address(teamVesting));
        console.log("Treasury Vesting:   ", address(treasuryVesting));
        console.log("HalalDAO:           ", address(dao));
        console.log("HalalPSM:           ", address(psm));
        console.log("Reserve token:      ", address(psm.reserve()));
        console.log("Team beneficiary:   ", teamVesting.beneficiary());
        console.log("Treasury beneficiary:", treasuryVesting.beneficiary());
        console.log("Deployment chain ID:", block.chainid);
        console.log("Deployment block:   ", block.number);
        console.log("");
        console.log("All roles transferred to the DAO. Deployer retains zero privileged access.");
        if (cpiUpdater != address(0)) {
            console.log("CPI updater bootstrapped: ", cpiUpdater);
        } else {
            console.log("No CPI updater bootstrapped -- grant UPDATER_ROLE to an oracle relayer via governance");
            console.log("before relying on updateCPI().");
        }
    }
}
