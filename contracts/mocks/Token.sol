pragma solidity 0.6.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// This contract is for demo purposes only
contract Token is ERC20 {
    constructor () public ERC20("Token", "TKN") {
        _mint(msg.sender, 1000000000000000000000000000); // 1,000,000,000,000 000 000 000 000 000
    }

    function burn(uint256 amount) public virtual {
        _burn(msg.sender, amount);
    }
}
