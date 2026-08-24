// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Script, console } from "forge-std/Script.sol";
import { DeployHalalSystem } from "./Deploy.s.sol";
import { HalalDAO } from "../src/HalalDAO.sol";
import { HalalPSM } from "../src/HalalPSM.sol";
import { HalalToken } from "../src/HalalToken.sol";
import { HalalVesting } from "../src/HalalVesting.sol";
import { HalalTimelock } from "../src/HalalTimelock.sol";

/// @notice Faucet reserve used only by the local demo deployment. Never deploy this token to a
/// public network: anyone may mint it by design.
contract LocalDemoReserve is ERC20 {
    constructor() ERC20("Local Demo DAI", "mDAI") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Deploys a complete local Anvil instance using the exact production role-wiring path,
/// plus a faucet reserve token and a large initial balance for the broadcaster.
///
/// Required environment variable:
///   PRIVATE_KEY — one of the Anvil account private keys.
/// Optional environment variables:
///   TEAM_BENEFICIARY and TREASURY_BENEFICIARY — default to the broadcaster.
contract DeployLocalHalalSystem is DeployHalalSystem {
    uint256 internal constant DEMO_RESERVE_BALANCE = 1_000_000_000e18;

    struct LocalDeployment {
        LocalDemoReserve reserve;
        HalalTimelock timelock;
        HalalToken token;
        HalalVesting teamVesting;
        HalalVesting treasuryVesting;
        HalalDAO dao;
        HalalPSM psm;
    }

    function run()
        external
        override
        returns (
            HalalTimelock timelock,
            HalalToken token,
            HalalVesting teamVesting,
            HalalVesting treasuryVesting,
            HalalDAO dao,
            HalalPSM psm
        )
    {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        LocalDeployment memory deployment = _deployLocal(privateKey);
        timelock = deployment.timelock;
        token = deployment.token;
        teamVesting = deployment.teamVesting;
        treasuryVesting = deployment.treasuryVesting;
        dao = deployment.dao;
        psm = deployment.psm;

        console.log("Local demo reserve: ", address(deployment.reserve));
        console.log("Funded broadcaster with mDAI:", DEMO_RESERVE_BALANCE);
        console.log("\nCopy this block into app/.env.local:\n");
        console.log("NEXT_PUBLIC_HLC_TOKEN_31337=", address(token));
        console.log("NEXT_PUBLIC_HLC_TEAM_VESTING_31337=", address(teamVesting));
        console.log("NEXT_PUBLIC_HLC_TREASURY_VESTING_31337=", address(treasuryVesting));
        console.log("NEXT_PUBLIC_HLC_PSM_31337=", address(psm));
        console.log("NEXT_PUBLIC_HLC_DAO_31337=", address(dao));
        console.log("NEXT_PUBLIC_HLC_TIMELOCK_31337=", address(timelock));
        console.log("NEXT_PUBLIC_HLC_RESERVE_TOKEN_31337=", address(deployment.reserve));
        console.log("NEXT_PUBLIC_HLC_RESERVE_SYMBOL_31337=mDAI");
        console.log("NEXT_PUBLIC_HLC_DEPLOYMENT_BLOCK_31337=", block.number);
    }

    function _deployLocal(uint256 privateKey) internal returns (LocalDeployment memory deployment) {
        address deployer = vm.addr(privateKey);
        address teamBeneficiary = vm.envOr("TEAM_BENEFICIARY", deployer);
        address treasuryBeneficiary = vm.envOr("TREASURY_BENEFICIARY", deployer);

        vm.startBroadcast(privateKey);
        deployment.reserve = new LocalDemoReserve();
        deployment.reserve.mint(deployer, DEMO_RESERVE_BALANCE);

        DeployConfig memory cfg = DeployConfig({
            deployer: deployer,
            reserveToken: address(deployment.reserve),
            teamBeneficiary: teamBeneficiary,
            treasuryBeneficiary: treasuryBeneficiary,
            votingDelay: 1,
            votingPeriod: 50_400,
            proposalThreshold: 100e18,
            quorumPercent: 4,
            timelockDelay: 2 days
        });

        (
            deployment.timelock,
            deployment.token,
            deployment.teamVesting,
            deployment.treasuryVesting,
            deployment.dao,
            deployment.psm
        ) = _deploySystem(cfg);
        vm.stopBroadcast();
    }
}
