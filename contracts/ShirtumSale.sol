pragma solidity 0.6.4;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract ShirtumSale is ReentrancyGuard, Ownable {

    using SafeMath for uint256;
    using Address for address payable;

    uint256 public buyPrice;
    uint256 public minimalGoal;
    uint256 public hardCap;

    mapping(address => uint256) public claimableTokens;
    mapping(address => uint256) public claimedTokens;

    ERC20Burnable crowdsaleToken;

    uint256 tokenDecimals = 18;

    event SellToken(address indexed recepient, uint tokensSold, uint value);
    event ClaimToken(address indexed recepient, uint tokensClaimed, uint256 date);

    address payable fundingAddress;
    address payable treasuryAddress;
    address payable burningPoolAddress;
    uint256 public totalCollected;
    uint256 public startTimestamp;
    uint256 public endTimestamp;
    uint256 public totalTokens;
    uint256 public totalSold;
    bool started;
    bool stopped;
    bool public claimEnabled = false;

     // General conditions
    uint256 public generalMinBuy = 20000000000000000; // 0.02 ETH
    uint256 public generalMaxBuy = 200000000000000000; // 0.2 ETH
    uint256 public generalClaimMaxWaitTime = 10 minutes;
    uint256 public claimTiming = 10 minutes;
    uint256[] public generalVestingClaim = [2000, 2000, 2000, 2000, 2000];
    mapping(address => uint256) public generalParticipants;

    // Corportative conditions
    uint256 public corpMinBuy = 20000000000000000;
    uint256 public corpMaxBuy = 200000000000000000;
    uint256 public corpClaimWaitTime = 10 minutes;
    uint256[] public corpVestingClaim = [837, 833, 833, 833, 833, 833, 833, 833, 833, 833, 833, 833];
    mapping(address => uint256) public corpParticipants;

    constructor(
        ERC20Burnable _token
    ) public {
        minimalGoal = 200000000000000000;    // 0.2 ETH
        hardCap = 500000000000000000;   // 0.5 ETH
        buyPrice = 13000000000000;  // 0.000013 ETH = 0.0275 EUR
        totalTokens = 120000000000000000000000000;  // 120,000,000.00 TOKEN
        crowdsaleToken = _token;

        // Config checks
        uint256 generalTotal = 0;
        for (uint8 i = 0; i < generalVestingClaim.length; i++) {
            generalTotal += generalVestingClaim[i];
        }
        require(generalVestingClaim.length <= 12, "ShirtumSale: corpVestingClaim length must be max 12");
        require(generalTotal == 10000, "ShirtumSale: corpVestingClaim percentages sum must be 100%");

        uint256 corpTotal = 0;
        for (uint8 i = 0; i < corpVestingClaim.length; i++) {
            corpTotal += corpVestingClaim[i];
        }
        require(corpVestingClaim.length <= 12, "ShirtumSale: corpVestingClaim length must be max 12");
        require(corpTotal == 10000, "ShirtumSale: corpVestingClaim percentages sum must be 100%");
    }

    function getToken()
        external
        view
        returns(address)
    {
        return address(crowdsaleToken);
    }

    function getClaimableTokens(address wallet)
        external 
        view
        returns(uint256)
    {
        return claimableTokens[wallet];
    }

    receive() external payable {
        require(msg.value >= generalMinBuy, "ShirtumSale: You must send more than the required minimum to participate");
        require(msg.value <= generalMaxBuy, "ShirtumSale: You must send less than the required maximum to participate");
        require(corpParticipants[msg.sender] == 0, "ShirtumSale: You already participated as corporation");
        require(generalParticipants[msg.sender].add(msg.value) <= generalMaxBuy, "ShirtumSale: You must send less than the required maximum to participate");

        sell(msg.sender, msg.value, false);
    }

    function corpReceive() external payable {
        require(msg.value >= corpMinBuy, "ShirtumSale: You must send more than the required minimum to participate");
        require(msg.value <= corpMaxBuy, "ShirtumSale: You must send less than the required maximum to participate");
        require(generalParticipants[msg.sender] == 0, "ShirtumSale: You already participated as general");
        require(corpParticipants[msg.sender].add(msg.value) <= corpMaxBuy, "ShirtumSale: You must send less than the required maximum to participate");

        sell(msg.sender, msg.value, true);
    }

    function claim() 
        external 
        nonReentrant 
        hasntStopped()
        whenCrowdsaleSuccessful()
        returns (uint256) 
    {
        require(claimableTokens[msg.sender] > claimedTokens[msg.sender], "ShirtumSale: All claimed");

        if (generalParticipants[msg.sender] > 0) {
            require(generalCanClaim(), "ShirtumSale: Claim is not yet possible");
        }
        if (corpParticipants[msg.sender] > 0) {
            require(corpCanClaim(), "ShirtumSale: Claim is not yet possible");
        }

        uint256 pending = pendingClaimable(msg.sender);
        claimedTokens[msg.sender] += pending;

        require(pending > 0, "ShirtumSale: Nothing to claim for now");
        require(crowdsaleToken.transfer(msg.sender, pending), "ShirtumSale: Error transfering");

        emit ClaimToken(msg.sender, pending, getTime());

        return pending;
    }

    function generalCanClaim() public view returns (bool) {
        return claimEnabled || block.timestamp > (endTimestamp + generalClaimMaxWaitTime);
    }

    function corpCanClaim() public view returns (bool) {
        return block.timestamp > (endTimestamp + corpClaimWaitTime);
    }

    function getGeneralVestingClaim() public view returns (uint256[] memory)  {
        return generalVestingClaim;
    }

    function getCorplVestingClaim() public view returns (uint256[] memory)  {
        return corpVestingClaim;
    }

    function pendingClaimable(address wallet) public view returns (uint256) {
        uint256[] memory vestingClaim;
        uint256 delay = 0;
        if (generalParticipants[wallet] > 0) {
            vestingClaim = generalVestingClaim;
        }
        if (corpParticipants[wallet] > 0) {
            vestingClaim = corpVestingClaim;
            delay = corpClaimWaitTime;
        }

        require(getTime() >= endTimestamp + delay, "ShirtumSale: Claim is not yet possible");

        if (claimedTokens[wallet] == claimableTokens[wallet]) return 0;

        uint256 current = getTime();
        uint256 secondsElapsed = current.sub(endTimestamp + delay);
        uint256 monthsElapsed = secondsElapsed.div(claimTiming);

        if (monthsElapsed >= vestingClaim.length) {
            monthsElapsed = vestingClaim.length - 1;
        }

        uint256 index;
        uint256 totalPercentage = 0;
        for (index = 0; index <= monthsElapsed; index += 1) {
            totalPercentage += vestingClaim[index];
        }

        uint256 claimable = claimableTokens[wallet].mul(totalPercentage).div(10000);
        require(claimable > claimedTokens[wallet], "ShirtumSale: Nothing to claim for now");

        return claimable.sub(claimedTokens[wallet]);
    }

    function remainToClaim(address wallet) public view returns (uint256) {
        require(claimableTokens[wallet] >= claimedTokens[wallet], "ShirtumSale: Nothing remains to claim");
        return claimableTokens[wallet].sub(claimedTokens[wallet]);
    }

    function sell(address payable _recepient, uint256 _value, bool corp) internal
        nonReentrant
        hasBeenStarted()
        hasntStopped()
        whenCrowdsaleAlive()
    {
        uint256 newTotalCollected = totalCollected.add(_value);

        if (hardCap < newTotalCollected) {
            // Refund anything above the hard cap
            uint256 refund = newTotalCollected.sub(hardCap);
            uint256 diff = _value.sub(refund);
            _recepient.sendValue(refund);
            _value = diff;
            newTotalCollected = totalCollected.add(_value);
        }

        // Token amount per price
        uint256 tokensSold = (_value).div(buyPrice).mul(10 ** tokenDecimals);

        // Set how much tokens the user can claim
        claimableTokens[_recepient] = claimableTokens[_recepient].add(tokensSold);

        emit SellToken(_recepient, tokensSold, _value);

        if (corp) {
            corpParticipants[_recepient] = corpParticipants[_recepient].add(_value);
        } else {
            generalParticipants[_recepient] = generalParticipants[_recepient].add(_value);
        }

        totalCollected = totalCollected.add(_value);
        
        fundingAddress.sendValue(_value);
        
        totalSold = totalSold.add(tokensSold);
    }

    function enableClaim()
        external
        onlyOwner()
    {
        require(isSuccessful(), "ShirtumSale: Sale not successful");
        claimEnabled = true;
        endTimestamp = getTime();
    }

    // Called to withdraw the ETH only if the TGE was successful
    function withdraw(
        uint256 _amount
    )
        external
        nonReentrant
        onlyOwner()
        hasntStopped()
        whenCrowdsaleSuccessful()
    {
        require(_amount <= address(this).balance, "ShirtumSale: Not enough funds");
        fundingAddress.sendValue(_amount);
    }

    function burnUnsold()
        external
        nonReentrant
        onlyOwner()
        hasntStopped()
        whenCrowdsaleSuccessful()
    {
        uint256 unsold = totalTokens.sub(totalSold);
        uint256 treasury = unsold.div(2);
        uint256 burningPool = unsold.sub(treasury);
        
        ERC20(crowdsaleToken).transfer(treasuryAddress, treasury);
        ERC20(crowdsaleToken).transfer(burningPoolAddress, burningPool);
    }

    // Called to refund user's ETH if the TGE has failed
    function refund()
        external
        nonReentrant
    {
        require(stopped || isFailed(), "ShirtumSale: Not cancelled or failed");
        uint256 amount = generalParticipants[msg.sender];

        require(amount > 0, "ShirtumSale: Only once");
        generalParticipants[msg.sender] = 0;

        msg.sender.sendValue(amount);
    }

    // Cancels the TGE
    function stop() public onlyOwner() hasntStopped()  {
        if (started) {
            require(!isFailed(), "ShirtumSale: Sale was failed");
            require(!isSuccessful(), "ShirtumSale: Sale was successful");
        }
        stopped = true;
    }

    // Called to setup start and end time of TGE as well the addresses
    function start(
        uint256 _startTimestamp,
        uint256 _endTimestamp,
        address payable _fundingAddress,
        address payable _treasuryAddress,
        address payable _burningPoolAddress
    )
        public
        onlyOwner()
        hasntStarted()
        hasntStopped()
    {
        require(_fundingAddress != address(0), "ShirtumSale: FundingAddress can't be 0x0");
        require(_treasuryAddress != address(0), "ShirtumSale: TreasuryAddress can't be 0x0");
        require(_burningPoolAddress != address(0), "ShirtumSale: BurningPoolAddress can't be 0x0");
        require(_endTimestamp > _startTimestamp, "ShirtumSale: EndTimestamp must be later than StartTimestamp");
        require(crowdsaleToken.balanceOf(address(this)) >= hardCap.div(buyPrice).mul(10 ** tokenDecimals), "ShirtumSale: Not enough tokens transfered for the sale");

        startTimestamp = _startTimestamp;
        endTimestamp = _endTimestamp;
        fundingAddress = _fundingAddress;
        treasuryAddress = _treasuryAddress;
        burningPoolAddress = _burningPoolAddress;
        started = true;
    }

    function getTime()
        public
        view
        returns(uint256)
    {
        return block.timestamp;
    }

    function isFailed()
        public
        view
        returns(bool)
    {
        return (
            started &&
            getTime() >= endTimestamp &&
            totalCollected < minimalGoal
        );
    }

    function isActive()
        public
        view
        returns(bool)
    {
        return (
            started &&
            totalCollected < hardCap &&
            getTime() >= startTimestamp &&
            getTime() < endTimestamp
        );
    }

    function isSuccessful()
        public
        view
        returns(bool)
    {
        return (
            totalCollected >= hardCap ||
            (getTime() >= endTimestamp && totalCollected >= minimalGoal)
        );
    }

    modifier whenCrowdsaleAlive() {
        require(isActive(), 'ShirtumSale: Sale is not active');
        _;
    }

    modifier whenCrowdsaleSuccessful() {
        require(isSuccessful(), 'ShirtumSale: Crowdsale must be successful');
        _;
    }

    modifier hasntStopped() {
        require(!stopped, 'ShirtumSale: Sale is stopped');
        _;
    }

    modifier hasntStarted() {
        require(!started, 'ShirtumSale: Sale is started');
        _;
    }

    modifier hasBeenStarted() {
        require(started, 'ShirtumSale: Sale is not started');
        _;
    }
}
