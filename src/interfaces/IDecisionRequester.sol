// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

interface IDecisionRequester {
    /// @return timestamp the Reactive contract requested decision `id` (0 if it never did)
    function requestedAt(uint256 id) external view returns (uint64);
}
