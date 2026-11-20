// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

interface ILendingPool {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function rateBps() external view returns (uint256);
    function utilizationBps() external view returns (uint256);
}
