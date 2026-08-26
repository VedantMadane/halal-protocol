// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { CPIReportAdapter } from "../src/CPIReportAdapter.sol";
import { HalalPSM } from "../src/HalalPSM.sol";
import { HalalToken } from "../src/HalalToken.sol";
import { LocalDemoReserve } from "./DeployLocal.s.sol";

/// @notice Exercises the signed CPI adapter against a disposable 31337-only PSM.
/// @dev This harness grants roles directly from the deployer to keep the rehearsal short. It is
/// not a production deployment path; production wiring must use the DAO handoff and timelock.
contract LocalCPIAdapterDemo is Script {
    bytes32 internal constant SOURCE_ID = keccak256("local-demo-cpi-v1");

    error WrongChain();
    error InvalidSignerSet();

    function run() external returns (CPIReportAdapter adapter, HalalPSM psm) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        uint256 signerOneKey = vm.envUint("CPI_SIGNER_1_KEY");
        uint256 signerTwoKey = vm.envUint("CPI_SIGNER_2_KEY");
        if (block.chainid != 31_337) revert WrongChain();

        address deployer = vm.addr(deployerKey);
        address signerOne = vm.addr(signerOneKey);
        address signerTwo = vm.addr(signerTwoKey);
        if (signerOne == signerTwo || signerOne == address(0) || signerTwo == address(0)) {
            revert InvalidSignerSet();
        }

        vm.startBroadcast(deployerKey);
        LocalDemoReserve reserve = new LocalDemoReserve();
        HalalToken token = new HalalToken(deployer);
        psm = new HalalPSM(address(reserve), address(token), deployer, address(0));
        address[] memory signers = new address[](2);
        signers[0] = signerOne;
        signers[1] = signerTwo;
        adapter = new CPIReportAdapter(address(psm), deployer, signers, 2, SOURCE_ID);
        token.grantRole(token.MINTER_ROLE(), address(psm));
        token.grantRole(token.BURNER_ROLE(), address(psm));
        psm.grantRole(psm.UPDATER_ROLE(), address(adapter));
        psm.setSource("BLS-CPI");

        uint256 reportedAt = block.timestamp - 1;
        bytes[] memory signatures = _signReport(adapter, 1_000_000, reportedAt, signerOneKey, signerTwoKey);
        adapter.submitReport(1_000_000, reportedAt, signatures);
        vm.stopBroadcast();

        console.log("Local adapter demo complete");
        console.log("PSM:", address(psm));
        console.log("CPI adapter:", address(adapter));
        console.logBytes32(SOURCE_ID);
        console.log("Accepted CPI:", psm.cpiRate());
        console.log("Accepted report timestamp:", psm.lastReportTimestamp());
    }

    function _signReport(
        CPIReportAdapter target,
        uint256 reportedCPI,
        uint256 reportedAt,
        uint256 firstKey,
        uint256 secondKey
    ) internal view returns (bytes[] memory signatures) {
        address firstSigner = vm.addr(firstKey);
        address secondSigner = vm.addr(secondKey);
        signatures = new bytes[](2);
        if (firstSigner < secondSigner) {
            signatures[0] = _signature(target, reportedCPI, reportedAt, firstKey);
            signatures[1] = _signature(target, reportedCPI, reportedAt, secondKey);
        } else {
            signatures[0] = _signature(target, reportedCPI, reportedAt, secondKey);
            signatures[1] = _signature(target, reportedCPI, reportedAt, firstKey);
        }
    }

    function _signature(CPIReportAdapter target, uint256 reportedCPI, uint256 reportedAt, uint256 privateKey)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, target.reportDigest(reportedCPI, reportedAt));
        return abi.encodePacked(r, s, v);
    }
}
