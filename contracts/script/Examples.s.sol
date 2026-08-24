// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { HalalDAO } from "../src/HalalDAO.sol";
import { HalalPSM } from "../src/HalalPSM.sol";
import { HalalToken } from "../src/HalalToken.sol";
import { HalalVesting } from "../src/HalalVesting.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

/// @notice Small, broadcastable examples for submitting proposals to an already deployed HalalDAO.
///
/// These scripts submit a proposal transaction; they do not vote, queue, or execute it. Set the
/// environment variables documented on each contract and ensure the broadcaster has at least the
/// DAO proposal threshold in delegated HLC voting power. Run without `--broadcast` first to dry-run
/// against an RPC endpoint.
abstract contract ProposalExample is Script {
    function _submit(
        address daoAddress,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) internal returns (uint256 proposalId) {
        vm.startBroadcast();
        proposalId = HalalDAO(payable(daoAddress)).propose(targets, values, calldatas, description);
        vm.stopBroadcast();

        console.log("Proposal submitted:");
        console.logUint(proposalId);
    }

    function _singleAction(address target, bytes memory calldata_)
        internal
        pure
        returns (address[] memory targets, uint256[] memory values, bytes[] memory calldatas)
    {
        targets = new address[](1);
        targets[0] = target;
        values = new uint256[](1);
        calldatas = new bytes[](1);
        calldatas[0] = calldata_;
    }
}

/// @notice DAO-gated manual CPI override. Set DAO_ADDRESS, PSM_ADDRESS, and optionally NEW_CPI.
contract ExampleProposal_UpdateCPI is ProposalExample {
    function run() external returns (uint256 proposalId) {
        address daoAddress = vm.envAddress("DAO_ADDRESS");
        address psmAddress = vm.envAddress("PSM_ADDRESS");
        uint256 newCPI = vm.envOr("NEW_CPI", uint256(1_050_000));
        string memory description = vm.envOr("PROPOSAL_DESCRIPTION", string("Update PSM CPI rate"));

        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas) =
            _singleAction(psmAddress, abi.encodeCall(HalalPSM.mockCPI, (newCPI)));
        proposalId = _submit(daoAddress, targets, values, calldatas, description);
    }
}

/// @notice Changes the PSM's human-readable CPI source. Set DAO_ADDRESS, PSM_ADDRESS, and CPI_SOURCE.
contract ExampleProposal_SetSource is ProposalExample {
    function run() external returns (uint256 proposalId) {
        address daoAddress = vm.envAddress("DAO_ADDRESS");
        address psmAddress = vm.envAddress("PSM_ADDRESS");
        string memory source = vm.envString("CPI_SOURCE");
        string memory description = vm.envOr("PROPOSAL_DESCRIPTION", string("Update CPI source"));

        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas) =
            _singleAction(psmAddress, abi.encodeCall(HalalPSM.setSource, (source)));
        proposalId = _submit(daoAddress, targets, values, calldatas, description);
    }
}

/// @notice Grants HLC minting permission to a new module. Set DAO_ADDRESS, TOKEN_ADDRESS, and MODULE_ADDRESS.
contract ExampleProposal_GrantMinter is ProposalExample {
    function run() external returns (uint256 proposalId) {
        address daoAddress = vm.envAddress("DAO_ADDRESS");
        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
        address moduleAddress = vm.envAddress("MODULE_ADDRESS");
        string memory description = vm.envOr("PROPOSAL_DESCRIPTION", string("Grant HLC minter role"));

        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas) = _singleAction(
            tokenAddress,
            abi.encodeCall(IAccessControl.grantRole, (HalalToken(tokenAddress).MINTER_ROLE(), moduleAddress))
        );
        proposalId = _submit(daoAddress, targets, values, calldatas, description);
    }
}

/// @notice Revokes the team vesting schedule. Set DAO_ADDRESS and TEAM_VESTING_ADDRESS.
/// This is irreversible for that vesting instance and should only be used after careful review.
contract ExampleProposal_RevokeTeamVesting is ProposalExample {
    function run() external returns (uint256 proposalId) {
        address daoAddress = vm.envAddress("DAO_ADDRESS");
        address vestingAddress = vm.envAddress("TEAM_VESTING_ADDRESS");
        string memory description = vm.envOr("PROPOSAL_DESCRIPTION", string("Revoke team vesting"));

        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas) =
            _singleAction(vestingAddress, abi.encodeCall(HalalVesting.revoke, ()));
        proposalId = _submit(daoAddress, targets, values, calldatas, description);
    }
}
