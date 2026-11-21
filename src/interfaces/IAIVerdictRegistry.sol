// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

interface IAIVerdictRegistry {
    struct Verdict {
        uint8 action; // 1 = ACT, 2 = IGNORE, 3 = PAUSE
        uint16 confidenceBps; // 0..10000
        address targetPool; // pool the AI recommends (zero for IGNORE / PAUSE)
        bytes32 reasoningHash; // keccak256 of the reasoning text (text is emitted in VerdictReasoning)
        uint64 timestamp;
        uint256 requestId; // the Reactive-originated request this verdict answers
    }

    function getVerdict(uint256 id) external view returns (Verdict memory);
}
