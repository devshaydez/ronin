// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AaveV3Adapter} from "../src/adapters/AaveV3Adapter.sol";

contract TestToken is ERC20 {
    constructor(string memory n) ERC20(n, n) {}

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }

    function burn(address from, uint256 a) external {
        _burn(from, a);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

/// Minimal stand-in for an Aave V3 Pool: supply / withdraw plus getReserveData with Aave's v3 legacy layout.
contract MockAavePool {
    struct ReserveData {
        uint256 configuration;
        uint128 liquidityIndex;
        uint128 currentLiquidityRate;
        uint128 variableBorrowIndex;
        uint128 currentVariableBorrowRate;
        uint128 currentStableBorrowRate;
        uint40 lastUpdateTimestamp;
        uint16 id;
        address aTokenAddress;
        address stableDebtTokenAddress;
        address variableDebtTokenAddress;
        address interestRateStrategyAddress;
        uint128 accruedToTreasury;
        uint128 unbacked;
        uint128 isolationModeTotalDebt;
    }

    TestToken public immutable underlying;
    TestToken public immutable aToken;
    TestToken public immutable varDebt;
    uint128 public liquidityRate;

    constructor(TestToken underlying_) {
        underlying = underlying_;
        aToken = new TestToken("aTOK");
        varDebt = new TestToken("vdTOK");
    }

    function setLiquidityRate(uint128 r) external {
        liquidityRate = r;
    }

    function setDebt(uint256 d) external {
        varDebt.mint(address(this), d);
    }

    function accrue(address to, uint256 interest) external {
        aToken.mint(to, interest); // simulates aToken rebasing
        underlying.mint(address(aToken), interest);
    }

    function supply(address, uint256 amount, address onBehalfOf, uint16) external {
        underlying.transferFrom(msg.sender, address(aToken), amount);
        aToken.mint(onBehalfOf, amount);
    }

    function withdraw(address, uint256 amount, address to) external returns (uint256) {
        aToken.burn(msg.sender, amount);
        underlying.transferFrom(address(aToken), to, amount);
        return amount;
    }

    function getReserveData(address) external view returns (ReserveData memory d) {
        d.currentLiquidityRate = liquidityRate;
        d.aTokenAddress = address(aToken);
        d.stableDebtTokenAddress = address(0);
        d.variableDebtTokenAddress = address(varDebt);
    }
}

contract AaveAdapterTest is Test {
    TestToken usdc;
    MockAavePool aave;
    AaveV3Adapter adapter;
    address vaultA = makeAddr("vaultA");
    address vaultB = makeAddr("vaultB");

    function setUp() public {
        usdc = new TestToken("USDC");
        aave = new MockAavePool(usdc);
        adapter = new AaveV3Adapter(address(aave), IERC20(address(usdc)), "Aave V3");
        // let the mock aToken pull underlying on withdraw
        vm.prank(address(aave.aToken()));
        usdc.approve(address(aave), type(uint256).max);
        usdc.mint(vaultA, 1_000e6);
        usdc.mint(vaultB, 1_000e6);
    }

    function _deposit(address who, uint256 amt) internal {
        vm.startPrank(who);
        usdc.approve(address(adapter), amt);
        adapter.deposit(amt);
        vm.stopPrank();
    }

    function test_depositAndBalance() public {
        _deposit(vaultA, 500e6);
        assertEq(adapter.balanceOf(vaultA), 500e6);
        assertEq(aave.aToken().balanceOf(address(adapter)), 500e6);
    }

    function test_interestAccruesToDepositorsProRata() public {
        _deposit(vaultA, 600e6);
        _deposit(vaultB, 400e6);
        aave.accrue(address(adapter), 100e6); // +10% on 1000
        assertEq(adapter.balanceOf(vaultA), 660e6);
        assertEq(adapter.balanceOf(vaultB), 440e6);
    }

    function test_withdrawReturnsFundsAndBurnsShares() public {
        _deposit(vaultA, 500e6);
        vm.prank(vaultA);
        adapter.withdraw(200e6);
        assertEq(usdc.balanceOf(vaultA), 700e6);
        assertEq(adapter.balanceOf(vaultA), 300e6);
    }

    function test_cannotWithdrawMoreThanOwned() public {
        _deposit(vaultA, 100e6);
        _deposit(vaultB, 900e6);
        vm.prank(vaultA);
        vm.expectRevert("insufficient balance");
        adapter.withdraw(200e6);
    }

    function test_withdrawEntireBalanceAfterInterest() public {
        _deposit(vaultA, 333e6);
        _deposit(vaultB, 667e6);
        aave.accrue(address(adapter), 37e6);
        uint256 bal = adapter.balanceOf(vaultA);
        vm.prank(vaultA);
        adapter.withdraw(bal); // must not revert on rounding
        assertLe(adapter.balanceOf(vaultA), 1);
    }

    function test_rateIsRayToBps() public {
        aave.setLiquidityRate(uint128(5e25)); // 5% APR in ray
        assertEq(adapter.rateBps(), 500);
    }

    function test_utilisationFromDebtAndLiquidity() public {
        _deposit(vaultA, 700e6);
        aave.setDebt(300e6); // liquidity in the aToken = 700, debt = 300 -> 30%
        assertEq(adapter.utilizationBps(), 3000);
    }
}
