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
///   RESERVE_TOKEN          reserve asset for the PSM (e.g. DAI address on the target network)
///   TEAM_BENEFICIARY       team vesting beneficiary (should be a multisig)
///   TREASURY_BENEFICIARY   treasury vesting beneficiary (should be a multisig)
/// Optional env vars (defaults match docs/TECHNICAL-DOCS.md):
///   VOTING_DELAY_BLOCKS (1), VOTING_PERIOD_BLOCKS (50400), PROPOSAL_THRESHOLD_WHOLE_HLC (100),
///   QUORUM_PERCENT (4), TIMELOCK_DELAY_SECONDS (172800)
///
/// IMPORTANT: VOTING_PERIOD_BLOCKS is denominated in the target chain's blocks. 50,400 is only
/// "~1 week" on Ethereum L1 (~12s blocks); see docs/DESIGN-DECISIONS.md before deploying to a
/// fast L2 like Arbitrum, where the equivalent is closer to 2,419,200 blocks.
///
/// Deployment logic is split into small internal helpers (rather than one long `run()`) to stay
/// under Solidity's local-variable stack limit without needing `via_ir` -- via_ir's more aggressive
/// optimizations are deliberately kept off project-wide, see docs/DESIGN-DECISIONS.md for the
/// `block.timestamp`-caching bug that caused across cheatcode time-travel in test runs.
contract DeployHalalSystem is Script {
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
    }

    function run()
        external
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

        (timelock, token) = _deployCore(cfg);
        (teamVesting, treasuryVesting) = _deployVesting(cfg, token, timelock);
        token.initialMint(address(teamVesting), address(treasuryVesting));
        dao = _deployGovernance(cfg, token, timelock);
        psm = new HalalPSM(cfg.reserveToken, address(token), address(timelock));
        _wireRoles(cfg.deployer, token, timelock, dao, psm);

        vm.stopBroadcast();

        _logSummary(timelock, token, teamVesting, treasuryVesting, dao, psm);
    }

    function _loadConfig() internal view returns (DeployConfig memory cfg) {
        cfg.deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
        cfg.reserveToken = vm.envAddress("RESERVE_TOKEN");
        cfg.teamBeneficiary = vm.envAddress("TEAM_BENEFICIARY");
        cfg.treasuryBeneficiary = vm.envAddress("TREASURY_BENEFICIARY");
        cfg.votingDelay = uint48(vm.envOr("VOTING_DELAY_BLOCKS", uint256(1)));
        cfg.votingPeriod = uint32(vm.envOr("VOTING_PERIOD_BLOCKS", uint256(50_400)));
        cfg.proposalThreshold = vm.envOr("PROPOSAL_THRESHOLD_WHOLE_HLC", uint256(100)) * 1e18;
        cfg.quorumPercent = vm.envOr("QUORUM_PERCENT", uint256(4));
        cfg.timelockDelay = vm.envOr("TIMELOCK_DELAY_SECONDS", uint256(2 days));
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
        // Token: PSM can mint against collateral; timelock becomes admin; deployer exits.
        token.grantRole(token.MINTER_ROLE(), address(psm));
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

    function _logSummary(
        HalalTimelock timelock,
        HalalToken token,
        HalalVesting teamVesting,
        HalalVesting treasuryVesting,
        HalalDAO dao,
        HalalPSM psm
    ) internal pure {
        console.log("HalalTimelock:      ", address(timelock));
        console.log("HalalToken (HLC):   ", address(token));
        console.log("Team Vesting:       ", address(teamVesting));
        console.log("Treasury Vesting:   ", address(treasuryVesting));
        console.log("HalalDAO:           ", address(dao));
        console.log("HalalPSM:           ", address(psm));
        console.log("");
        console.log("All roles transferred to the DAO. Deployer retains zero privileged access.");
        console.log("PSM has PARAM_ROLE granted to the DAO only -- grant UPDATER_ROLE to an oracle");
        console.log("relayer via governance proposal before relying on updateCPI().");
    }
}
