// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { HalalDAO } from "../src/HalalDAO.sol";
import { HalalToken } from "../src/HalalToken.sol";
import { HalalPSM } from "../src/HalalPSM.sol";
import { HalalVesting } from "../src/HalalVesting.sol";

/// @notice Proposal templates for common Halal DAO governance actions. Each is a standalone script;
/// run with `forge script script/Examples.s.sol:<ContractName> --rpc-url $RPC_URL --private-key
/// $PRIVATE_KEY --broadcast`. Requires DAO_ADDRESS in the environment, plus whichever target address
/// each template needs (PSM_ADDRESS, TOKEN_ADDRESS, or VESTING_ADDRESS).
abstract contract ProposalBase is Script {
    function _propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) internal returns (uint256 proposalId) {
        HalalDAO dao = HalalDAO(payable(vm.envAddress("DAO_ADDRESS")));
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        proposalId = dao.propose(targets, values, calldatas, description);
        vm.stopBroadcast();

        console.log("Proposal submitted:", description);
        console.log("proposalId:", proposalId);
    }
}

/// @notice Emergency/manual CPI override, bypassing the step and interval limits an UPDATER_ROLE
/// submission is normally held to. Use for disputed or failed oracle readings.
contract ExampleProposal_UpdateCPI is ProposalBase {
    function run() external returns (uint256 proposalId) {
        address psm = vm.envAddress("PSM_ADDRESS");
        uint256 newCPI = vm.envOr("NEW_CPI", uint256(1_020_000)); // default: +2%

        address[] memory targets = new address[](1);
        targets[0] = psm;
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeCall(HalalPSM.mockCPI, (newCPI));

        proposalId = _propose(targets, values, calldatas, "Update CPI (manual/emergency override)");
    }
}

/// @notice Switches the informational CPI data-source reference (e.g. documenting a move from a
/// US-CPI feed to a different index) recorded on the PSM.
contract ExampleProposal_SwitchCPISource is ProposalBase {
    function run() external returns (uint256 proposalId) {
        address psm = vm.envAddress("PSM_ADDRESS");
        string memory newSource = vm.envOr("NEW_SOURCE", string("https://example.com/cpi-china.js"));

        address[] memory targets = new address[](1);
        targets[0] = psm;
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeCall(HalalPSM.setSource, (newSource));

        proposalId = _propose(targets, values, calldatas, "Switch CPI data source");
    }
}

/// @notice Grants MINTER_ROLE on HalalToken to a new module contract -- the "permissions, not
/// upgrades" extension pattern from docs/AddingFeature.md (e.g. adding a lending or staking module).
contract ExampleProposal_GrantMinterRole is ProposalBase {
    function run() external returns (uint256 proposalId) {
        address token = vm.envAddress("TOKEN_ADDRESS");
        address newModule = vm.envAddress("NEW_MODULE_ADDRESS");

        address[] memory targets = new address[](1);
        targets[0] = token;
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeCall(IAccessControl.grantRole, (HalalToken(token).MINTER_ROLE(), newModule));

        proposalId = _propose(targets, values, calldatas, "Grant MINTER_ROLE to new module");
    }
}

/// @notice Grants UPDATER_ROLE on the PSM to an oracle relayer (e.g. a Chainlink Functions consumer
/// or Automation-triggered keeper) so routine CPI updates don't each require a governance vote --
/// see the "Chainlink Functions note" in HalalPSM.sol.
contract ExampleProposal_GrantUpdaterRole is ProposalBase {
    function run() external returns (uint256 proposalId) {
        address psm = vm.envAddress("PSM_ADDRESS");
        address relayer = vm.envAddress("RELAYER_ADDRESS");

        address[] memory targets = new address[](1);
        targets[0] = psm;
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeCall(IAccessControl.grantRole, (HalalPSM(psm).UPDATER_ROLE(), relayer));

        proposalId = _propose(targets, values, calldatas, "Grant UPDATER_ROLE to CPI oracle relayer");
    }
}

/// @notice Emergency revocation of the team vesting schedule, returning all unvested HLC to the DAO
/// treasury (timelock). Only works on revocable schedules -- treasury vesting is intentionally not
/// revocable, see docs/Treasury.md.
contract ExampleProposal_RevokeTeamVesting is ProposalBase {
    function run() external returns (uint256 proposalId) {
        address teamVesting = vm.envAddress("VESTING_ADDRESS");

        address[] memory targets = new address[](1);
        targets[0] = teamVesting;
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeCall(HalalVesting.revoke, ());

        proposalId = _propose(targets, values, calldatas, "EMERGENCY: Revoke team vesting");
    }
}
