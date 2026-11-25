// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Timestamp a salted private reconciliation commitment under its publisher's address.
contract ReceiptAnchor {
    mapping(address publisher => mapping(bytes32 commitment => uint256 blockNumber)) public anchoredAt;

    error EmptyCommitment();
    event ReceiptAnchored(address indexed publisher, bytes32 indexed commitment);

    /// @dev Repeating an anchor returns its original block without publishing another event.
    function anchor(bytes32 commitment) external returns (uint256) {
        if (commitment == bytes32(0)) revert EmptyCommitment();
        uint256 previous = anchoredAt[msg.sender][commitment];
        if (previous != 0) return previous;
        anchoredAt[msg.sender][commitment] = block.number;
        emit ReceiptAnchored(msg.sender, commitment);
        return block.number;
    }
}
