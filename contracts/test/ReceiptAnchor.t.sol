// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ReceiptAnchor} from "../ReceiptAnchor.sol";

contract Publisher {
    function publish(ReceiptAnchor registry, bytes32 commitment) external returns (uint256) {
        return registry.anchor(commitment);
    }
}

contract ReceiptAnchorTest {
    function testRepeatedAnchorRemainsAtOriginalBlock() external {
        ReceiptAnchor registry = new ReceiptAnchor();
        bytes32 commitment = sha256("private evidence");
        uint256 first = registry.anchor(commitment);
        require(first == block.number && first > 0, "unexpected block");
        require(registry.anchor(commitment) == first, "changed prior block");
        require(registry.anchoredAt(address(this), commitment) == first, "missing anchor");
    }

    function testAnotherPublisherCannotCreateYourAnchor() external {
        ReceiptAnchor registry = new ReceiptAnchor();
        Publisher thirdParty = new Publisher();
        bytes32 commitment = sha256("private evidence");
        thirdParty.publish(registry, commitment);
        require(registry.anchoredAt(address(thirdParty), commitment) > 0, "missing publisher anchor");
        require(registry.anchoredAt(address(this), commitment) == 0, "attributed to wrong publisher");
    }

    function testEmptyCommitmentReverts() external {
        ReceiptAnchor registry = new ReceiptAnchor();
        try registry.anchor(bytes32(0)) { revert("zero accepted"); }
        catch (bytes memory reason) {
            require(bytes4(reason) == ReceiptAnchor.EmptyCommitment.selector, "wrong error");
        }
    }
}
