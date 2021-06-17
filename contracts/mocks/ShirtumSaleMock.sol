pragma solidity 0.6.4;

import "../ShirtumSale.sol";

// This contract is for testing purposes only
contract ShirtumSaleMock is ShirtumSale {

    constructor (ERC20Burnable _token) public ShirtumSale(_token) {
    }

    function setMockData(uint256 mockSoftcap, uint256 mockHardcap) external {
        minimalGoal = mockSoftcap;
        hardCap = mockHardcap;
    }
}
