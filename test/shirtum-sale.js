const { expectRevert, expectEvent, BN, time, ether, balance } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const Token = artifacts.require("Token");
const ShirtumSale = artifacts.require("ShirtumSaleMock");

contract('ShirtumSale', function (accounts) {

  beforeEach(async function () {
    this.token = await Token.new(
      { from: accounts[0] }
    );

    this.shirtumSale = await ShirtumSale.new(
      this.token.address,
      { from: accounts[0] }
    );

    this.shirtumSale.setMockData(
      '24000000000000000000', // 24 ETH
      '72000000000000000000', // 72 ETH
      { from: accounts[0] }
    );

    this.token.transfer(
      this.shirtumSale.address,
      '120000000000000000000000000', // 120.000.000,00
      { from: accounts[0] }
    );

    const date = new Date();

    this.shirtumSale.start(
      parseInt((date.getTime() / 1000) - 10000),
      parseInt((date.getTime() / 1000) + 10000),
      accounts[7],
      accounts[8],
      accounts[9],
      { from: accounts[0] }
    );

    await takeSnapshot();
  });

  afterEach(async function () {    
    await restoreSnapshot();
  });

  describe('Basics', function () {

    it('getToken', async function() {
      assert.equal(
        (await this.shirtumSale.getToken()).valueOf(),
        this.token.address,
        'Token address is wrong'
      );
    });

    it('getTime', async function() {
      const timeOne = await this.shirtumSale.getTime();
      
      await time.increase(time.duration.minutes(10));
      
      const timeTwo = await this.shirtumSale.getTime();
      
      assert.isTrue(
        timeTwo >= timeOne + '600',
        'getTime is working bad'
      );
    });

    // it('getGeneralVestingClaim', async function() {
    //   const vesting = await this.shirtumSale.getGeneralVestingClaim();

    //   assert.equal(
    //     vesting,
    //     [2000, 2000, 2000, 2000, 2000],
    //     'getGeneralVestingClaim is working bad'
    //   );
    // });

    // it('getCorplVestingClaim', async function() {
    //   const vesting = await this.shirtumSale.getCorplVestingClaim();
      
    //   assert.equal(
    //     vesting,
    //     [837, 833, 833, 833, 833, 833, 833, 833, 833, 833, 833, 833],
    //     'getCorplVestingClaim is working bad'
    //   );
    // });

  });

  describe('Force error', function () {

    it('buy less than minimum', async function() {
      const amount = ether('0.2');

      await expectRevert(
        this.shirtumSale.sendTransaction({
          from: accounts[1],
          value: amount
        }),
        'ShirtumSale: You must send more than the required minimum to participate'
      );
    });

    it('buy more than maximum', async function() {
      const amount = ether('25');

      await expectRevert(
        this.shirtumSale.sendTransaction({
          from: accounts[1],
          value: amount
        }),
        'ShirtumSale: You must send less than the required maximum to participate'
      );

    });

    it('parcitipate as corp when already done as general', async function() {
      const generalAmount = ether('0.24');
      const corpAmount = ether('96');

      await this.shirtumSale.sendTransaction({
        from: accounts[1],
        value: generalAmount
      });

      await expectRevert(
        this.shirtumSale.corpReceive({
          from: accounts[1],
          value: corpAmount
        }),
        'ShirtumSale: You already participated as general'
      );

    });

    it('parcitipate as general when already done as corp', async function() {
      const generalAmount = ether('0.24');
      const corpAmount = ether('96');

      await this.shirtumSale.corpReceive({
        from: accounts[1],
        value: corpAmount
      });

      await expectRevert(
        this.shirtumSale.sendTransaction({
          from: accounts[1],
          value: generalAmount
        }),
        'ShirtumSale: You already participated as corporation'
      );

    });

    it('set claim before successful', async function() {
      const amount = ether('24');

      await this.shirtumSale.sendTransaction({
        from: accounts[1],
        value: amount
      });

      await expectRevert(
        this.shirtumSale.enableClaim(
          { from: accounts[0] }
        ),
        'ShirtumSale: Sale not successful'
      );

    });

  });

  describe('Participating as general with equal participations', function () {

    it('Softcap not reached with one participator', async function() {
      const amount = ether('1');

      assert.equal(await this.shirtumSale.isFailed(), false, "Sale isFailed status must be false");
      assert.equal(await this.shirtumSale.isSuccessful(), false, "Sale isSuccessful status must be false");
      assert.equal(await this.shirtumSale.isActive(), true, "Sale isActive status must be true");
      
      const beforeBalance = await balance.current(accounts[1]);

      await this.shirtumSale.sendTransaction({
        from: accounts[1],
        value: amount
      });

      assert.equal(
        ((await this.shirtumSale.getClaimableTokens(accounts[1])).valueOf()).toString(),
        '76923000000000000000000',
        'Account not has correct claimable tokens amount'
      );

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: Crowdsale must be successful'
      );

      await time.increase(time.duration.days(2));

      assert.equal(await this.shirtumSale.isFailed(), true, "Sale isFailed status must be true");
      assert.equal(await this.shirtumSale.isSuccessful(), false, "Sale isSuccessful status must be false");
      assert.equal(await this.shirtumSale.isActive(), false, "Sale isActive status must be false");

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: Crowdsale must be successful'
      );

      const middleBalance = await balance.current(accounts[1]);

      assert.isTrue(
        BigInt(beforeBalance) > BigInt(middleBalance),
        "Account participation has not been deducted"
      );

      await this.shirtumSale.refund(
        { from: accounts[1] }
      );

      const afterBalance = await balance.current(accounts[1]);

      assert.isTrue(
        BigInt(afterBalance) > BigInt(middleBalance),
        "Account not refunded"
      );

      const contractBalance = await balance.current(this.shirtumSale.address);

      assert.isTrue(
        BigInt(contractBalance) === BigInt(0),
        "Contract remains balance after refund"
      );
    });

    it('Hardcap reached with various participants, owner sets claimable option to true', async function() {
      const amount = ether('24');

      assert.equal(await this.shirtumSale.isFailed(), false, "Sale isFailed status must be false");
      assert.equal(await this.shirtumSale.isSuccessful(), false, "Sale isSuccessful status must be false");
      assert.equal(await this.shirtumSale.isActive(), true, "Sale isActive status must be true");
      
      await this.shirtumSale.sendTransaction({
        from: accounts[1],
        value: amount
      });

      await this.shirtumSale.sendTransaction({
        from: accounts[2],
        value: amount
      });

      await this.shirtumSale.sendTransaction({
        from: accounts[3],
        value: amount
      });

      assert.equal(
        ((await this.shirtumSale.getClaimableTokens(accounts[1])).valueOf()).toString(),
        '1846153000000000000000000',
        'Account not has correct claimable tokens amount'
      );

      assert.equal(
        ((await this.shirtumSale.getClaimableTokens(accounts[2])).valueOf()).toString(),
        '1846153000000000000000000',
        'Account not has correct claimable tokens amount'
      );

      assert.equal(
        ((await this.shirtumSale.getClaimableTokens(accounts[3])).valueOf()).toString(),
        '1846153000000000000000000',
        'Account not has correct claimable tokens amount'
      );

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: Claim is not yet possible'
      );

      await this.shirtumSale.enableClaim(
        { from: accounts[0] }
      );

      assert.equal(await this.shirtumSale.isFailed(), false, "Sale isFailed status must be true");
      assert.equal(await this.shirtumSale.isSuccessful(), true, "Sale isSuccessful status must be false");
      assert.equal(await this.shirtumSale.isActive(), false, "Sale isActive status must be false");

      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '0',
        'Account 1 not has correct tokens amount'
      );

      assert.equal(
        ((await this.token.balanceOf(accounts[2])).valueOf()).toString(),
        '0',
        'Account 2 not has correct tokens amount'
      );

      assert.equal(
        ((await this.token.balanceOf(accounts[3])).valueOf()).toString(),
        '0',
        'Account 3 not has correct tokens amount'
      );

    });

    it('Softcap reached with various participants, claimable by time', async function() {
      const amount = ether('24');

      assert.equal(await this.shirtumSale.isFailed(), false, "Sale isFailed status must be false");
      assert.equal(await this.shirtumSale.isSuccessful(), false, "Sale isSuccessful status must be false");
      assert.equal(await this.shirtumSale.isActive(), true, "Sale isActive status must be true");
      
      await this.shirtumSale.sendTransaction({
        from: accounts[1],
        value: amount
      });

      await this.shirtumSale.sendTransaction({
        from: accounts[2],
        value: amount
      });

      await this.shirtumSale.sendTransaction({
        from: accounts[3],
        value: amount
      });

      assert.equal(
        ((await this.shirtumSale.getClaimableTokens(accounts[1])).valueOf()).toString(),
        '1846153000000000000000000',
        'Account not has correct claimable tokens amount'
      );

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: Claim is not yet possible'
      );

      await time.increase(time.duration.days(5));

      assert.equal(await this.shirtumSale.isFailed(), false, "Sale isFailed status must be true");
      assert.equal(await this.shirtumSale.isSuccessful(), true, "Sale isSuccessful status must be false");
      assert.equal(await this.shirtumSale.isActive(), false, "Sale isActive status must be false");

      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '0',
        'Account 1 not has correct tokens amount'
      );

      await this.shirtumSale.claim({ from: accounts[1] });

      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '369230600000000000000000',
        'Account 1 not has correct tokens amount'
      );
    });

  });

  describe('Participating as general with with not equal participations', function () {

    it('Hardcap reached with more than one participation by wallet', async function() {
      const amountOne = ether('6');
      const amountTwo = ether('12');
      const amountThree = ether('24');

      assert.equal(await this.shirtumSale.isFailed(), false, "Sale isFailed status must be false");
      assert.equal(await this.shirtumSale.isSuccessful(), false, "Sale isSuccessful status must be false");
      assert.equal(await this.shirtumSale.isActive(), true, "Sale isActive status must be true");
      
      await this.shirtumSale.sendTransaction({
        from: accounts[1],
        value: amountOne
      });

      await this.shirtumSale.sendTransaction({
        from: accounts[1],
        value: amountOne
      });

      await this.shirtumSale.sendTransaction({
        from: accounts[1],
        value: amountTwo
      });

      await this.shirtumSale.sendTransaction({
        from: accounts[2],
        value: amountTwo
      });

      await this.shirtumSale.sendTransaction({
        from: accounts[2],
        value: amountTwo
      });

      await this.shirtumSale.sendTransaction({
        from: accounts[3],
        value: amountThree
      });

      assert.equal(
        ((await this.shirtumSale.getClaimableTokens(accounts[1])).valueOf()).toString(),
        '1846152000000000000000000',
        'Account 1 not has correct claimable tokens amount'
      );

      assert.equal(
        ((await this.shirtumSale.getClaimableTokens(accounts[2])).valueOf()).toString(),
        '1846152000000000000000000',
        'Account 2 not has correct claimable tokens amount'
      );

      assert.equal(
        ((await this.shirtumSale.getClaimableTokens(accounts[3])).valueOf()).toString(),
        '1846153000000000000000000',
        'Account 3 not has correct claimable tokens amount'
      );

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: Claim is not yet possible'
      );

      await this.shirtumSale.enableClaim(
        { from: accounts[0] }
      );

      assert.equal(await this.shirtumSale.isFailed(), false, "Sale isFailed status must be true");
      assert.equal(await this.shirtumSale.isSuccessful(), true, "Sale isSuccessful status must be false");
      assert.equal(await this.shirtumSale.isActive(), false, "Sale isActive status must be false");

      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '0',
        'Account 1 not has correct tokens amount'
      );

      assert.equal(
        ((await this.token.balanceOf(accounts[2])).valueOf()).toString(),
        '0',
        'Account 2 not has correct tokens amount'
      );

      assert.equal(
        ((await this.token.balanceOf(accounts[3])).valueOf()).toString(),
        '0',
        'Account 3 not has correct tokens amount'
      );

      const fundingbalance = await balance.current(accounts[7]);
      const saleBalance = await balance.current(this.shirtumSale.address);

      await this.shirtumSale.withdraw(
        saleBalance,
        { from: accounts[0] }
      );

      assert.equal(
        (await balance.current(accounts[7])).toString(),
        sumStrings(saleBalance.toString(), fundingbalance.toString()),
        'Funding address not has correct ETH amount'
      );
    });

    it('Softcap reached and stop', async function() {
      const amount = ether('12');

      assert.equal(await this.shirtumSale.isFailed(), false, "Sale isFailed status must be false");
      assert.equal(await this.shirtumSale.isSuccessful(), false, "Sale isSuccessful status must be false");
      assert.equal(await this.shirtumSale.isActive(), true, "Sale isActive status must be true");
      
      await this.shirtumSale.sendTransaction({
        from: accounts[1],
        value: amount
      });

      await this.shirtumSale.sendTransaction({
        from: accounts[2],
        value: amount
      });

      await this.shirtumSale.sendTransaction({
        from: accounts[3],
        value: amount
      });

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: Crowdsale must be successful'
      );

      await this.shirtumSale.stop(
        { from: accounts[0] }
      );

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: Sale is stopped'
      );

      const saleBalance = await balance.current(this.shirtumSale.address);

      await expectRevert(
        this.shirtumSale.withdraw(
          saleBalance,
          { from: accounts[0] }
        ),
        'ShirtumSale: Sale is stopped'
      );

      const middleBalance = await balance.current(accounts[1]);

      await this.shirtumSale.refund(
        { from: accounts[1] }
      );

      const afterBalance = await balance.current(accounts[1]);

      assert.isTrue(
        BigInt(afterBalance) > BigInt(middleBalance),
        "Account not refunded"
      );
    });

    it('Hardcap reached and burnUnsold', async function() {
      const amountOne = ether('6');
      const amountTwo = ether('12');
      const amountThree = ether('24');

      assert.equal(await this.shirtumSale.isFailed(), false, "Sale isFailed status must be false");
      assert.equal(await this.shirtumSale.isSuccessful(), false, "Sale isSuccessful status must be false");
      assert.equal(await this.shirtumSale.isActive(), true, "Sale isActive status must be true");
      
      await this.shirtumSale.sendTransaction({
        from: accounts[1],
        value: amountOne
      });

      await this.shirtumSale.sendTransaction({
        from: accounts[1],
        value: amountOne
      });

      await this.shirtumSale.sendTransaction({
        from: accounts[1],
        value: amountTwo
      });

      await this.shirtumSale.sendTransaction({
        from: accounts[2],
        value: amountTwo
      });

      await this.shirtumSale.sendTransaction({
        from: accounts[2],
        value: amountTwo
      });

      await this.shirtumSale.sendTransaction({
        from: accounts[3],
        value: amountThree
      });

      assert.equal(
        ((await this.shirtumSale.getClaimableTokens(accounts[1])).valueOf()).toString(),
        '1846152000000000000000000',
        'Account 1 not has correct claimable tokens amount'
      );

      assert.equal(
        ((await this.shirtumSale.getClaimableTokens(accounts[2])).valueOf()).toString(),
        '1846152000000000000000000',
        'Account 2 not has correct claimable tokens amount'
      );

      assert.equal(
        ((await this.shirtumSale.getClaimableTokens(accounts[3])).valueOf()).toString(),
        '1846153000000000000000000',
        'Account 3 not has correct claimable tokens amount'
      );

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: Claim is not yet possible'
      );

      await this.shirtumSale.enableClaim(
        { from: accounts[0] }
      );

      assert.equal(await this.shirtumSale.isFailed(), false, "Sale isFailed status must be true");
      assert.equal(await this.shirtumSale.isSuccessful(), true, "Sale isSuccessful status must be false");
      assert.equal(await this.shirtumSale.isActive(), false, "Sale isActive status must be false");

      await this.shirtumSale.burnUnsold(
        { from: accounts[0] }
      );

      const afterTreasuryBalance = await this.token.balanceOf(accounts[8]);
      const afterBurningPoolBalance = await this.token.balanceOf(accounts[9]);

      assert.equal(
        afterTreasuryBalance.toString(),
        '57230771500000000000000000',
        'Account 3 not has correct claimable tokens amount'
      );

      assert.equal(
        afterBurningPoolBalance.toString(),
        '57230771500000000000000000',
        'Account 3 not has correct claimable tokens amount'
      );

      const saleBalance = await this.token.balanceOf(this.shirtumSale.address);
      
      assert.equal(
        saleBalance.toString(),
        '5538457000000000000000000',
        'Account 3 not has correct claimable tokens amount'
      );

    });

  });

  describe('Participating as corporation with with not equal participations', function () {

    it('Softcap reached with more than one participation by wallet', async function() {
      const amountOne = ether('96');
      const amountTwo = ether('99');

      this.shirtumSale.setMockData(
        '24000000000000000000', // 24 ETH
        '500000000000000000000', // 500 ETH
        { from: accounts[0] }
      );

      assert.equal(await this.shirtumSale.isFailed(), false, "Sale isFailed status must be false");
      assert.equal(await this.shirtumSale.isSuccessful(), false, "Sale isSuccessful status must be false");
      assert.equal(await this.shirtumSale.isActive(), true, "Sale isActive status must be true");

      await this.shirtumSale.corpReceive({
        from: accounts[1],
        value: amountOne
      });

      await this.shirtumSale.corpReceive({
        from: accounts[2],
        value: amountOne
      });

      await this.shirtumSale.corpReceive({
        from: accounts[3],
        value: amountTwo
      });

      assert.equal(
        ((await this.shirtumSale.getClaimableTokens(accounts[1])).valueOf()).toString(),
        '7384615000000000000000000',
        'Account 1 not has correct claimable tokens amount'
      );

      assert.equal(
        ((await this.shirtumSale.getClaimableTokens(accounts[2])).valueOf()).toString(),
        '7384615000000000000000000',
        'Account 2 not has correct claimable tokens amount'
      );

      assert.equal(
        ((await this.shirtumSale.getClaimableTokens(accounts[3])).valueOf()).toString(),
        '7615384000000000000000000',
        'Account 3 not has correct claimable tokens amount'
      );

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: Crowdsale must be successful'
      );

      await time.increase(time.duration.days(2));

      await this.shirtumSale.enableClaim(
        { from: accounts[0] }
      );
    });

  });

});

function sumStrings(a,b) { 
  return ((BigInt(a)) + BigInt(b)).toString();
}

function subStrings(a,b) { 
  return ((BigInt(a)) - BigInt(b)).toString();
}

restoreSnapshot = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({jsonrpc: "2.0", method: "evm_revert", params: [snapshotId]}, () => {
      resolve();
    });
  })
}

takeSnapshot = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({jsonrpc: "2.0", method: "evm_snapshot"}, (err, result) => {
      snapshotId = result.result;
      resolve();
    });
  })
}
