// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Deployers } from "./utils/Deployers.sol";
import { HalalPSM } from "../src/HalalPSM.sol";
import { HalalToken } from "../src/HalalToken.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";
import { Test } from "forge-std/Test.sol";

/// @notice Stateful action handler used to exercise deposit, withdrawal, and redeemable-credit
/// transfer sequences rather than isolated calls. Every action is constrained to two known actors,
/// so the invariant can account for every address that can hold PSM redemption credit.
contract HalalPSMHandler is Test {
    HalalPSM internal immutable psm;
    HalalToken internal immutable token;
    MockERC20 internal immutable reserve;
    address internal immutable alice;
    address internal immutable bob;

    constructor(HalalPSM psm_, HalalToken token_, MockERC20 reserve_, address alice_, address bob_) {
        psm = psm_;
        token = token_;
        reserve = reserve_;
        alice = alice_;
        bob = bob_;
    }

    function deposit(uint256 actorSeed, uint256 amountSeed) external {
        address actor = _actor(actorSeed);
        uint256 amount = bound(amountSeed, 1, 1e24);
        reserve.mint(actor, amount);

        vm.startPrank(actor);
        reserve.approve(address(psm), amount);
        psm.deposit(amount);
        vm.stopPrank();
    }

    function withdraw(uint256 actorSeed, uint256 amountSeed) external {
        address actor = _actor(actorSeed);
        uint256 credit = psm.redeemableBalance(actor);
        uint256 balance = token.balanceOf(actor);
        uint256 maximum = credit < balance ? credit : balance;
        if (maximum == 0) return;

        uint256 amount = bound(amountSeed, 1, maximum);
        vm.startPrank(actor);
        token.approve(address(psm), amount);
        psm.withdraw(amount);
        vm.stopPrank();
    }

    function transferRedeemable(uint256 actorSeed, uint256 amountSeed) external {
        address from = _actor(actorSeed);
        address to = from == alice ? bob : alice;
        uint256 credit = psm.redeemableBalance(from);
        uint256 balance = token.balanceOf(from);
        uint256 maximum = credit < balance ? credit : balance;
        if (maximum == 0) return;

        uint256 amount = bound(amountSeed, 1, maximum);
        vm.startPrank(from);
        token.approve(address(psm), amount);
        psm.transferRedeemable(to, amount);
        vm.stopPrank();
    }

    function cancelRedeemable(uint256 actorSeed, uint256 amountSeed) external {
        address actor = _actor(actorSeed);
        uint256 credit = psm.redeemableBalance(actor);
        uint256 balance = token.balanceOf(actor);
        uint256 maximum = credit < balance ? credit : balance;
        if (maximum == 0) return;

        uint256 amount = bound(amountSeed, 1, maximum);
        vm.startPrank(actor);
        token.approve(address(psm), amount);
        psm.cancelRedeemable(amount);
        vm.stopPrank();
    }

    function knownRedeemableCredit() external view returns (uint256) {
        return psm.redeemableBalance(alice) + psm.redeemableBalance(bob);
    }

    function _actor(uint256 seed) private view returns (address) {
        return seed % 2 == 0 ? alice : bob;
    }
}

contract HalalPSMInvariantTest is Deployers {
    address internal alice = makeAddr("invariantAlice");
    address internal bob = makeAddr("invariantBob");
    HalalPSMHandler internal handler;

    function setUp() public {
        deployAll();
        handler = new HalalPSMHandler(psm, token, reserve, alice, bob);
        targetContract(address(handler));
    }

    function invariant_RedeemableCreditEqualsIssuedSupply() public view {
        assertEq(handler.knownRedeemableCredit(), psm.totalHlcIssued());
    }

    function invariant_PsmSupplyRemainsCollateralizedAtGenesisRate() public view {
        assertGe(reserve.balanceOf(address(psm)), psm.reserveRequired());
    }

    function invariant_TokenSupplyEqualsGenesisPlusPsmIssuance() public view {
        assertEq(token.totalSupply(), 10_000_000e18 + psm.totalHlcIssued());
    }
}
