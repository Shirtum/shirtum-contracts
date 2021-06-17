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

  describe('Others claims', function () {

    it('Not participant', async function() {
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

      assert.equal(
        ((await this.shirtumSale.getClaimableTokens(accounts[1])).valueOf()).toString(),
        '923076000000000000000000',
        'Account not has correct claimable tokens amount'
      );

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: Crowdsale must be successful'
      );

      await time.increase(time.duration.days(5));

      assert.equal(await this.shirtumSale.isFailed(), false, "Sale isFailed status must be false");
      assert.equal(await this.shirtumSale.isSuccessful(), true, "Sale isSuccessful status must be true");
      assert.equal(await this.shirtumSale.isActive(), false, "Sale isActive status must be false");

      /** CLAIM ACCOUNT **/

      assert.equal(
        (await this.shirtumSale.pendingClaimable(accounts[5])).toString(),
        '0',
        'Account 5 pending to claim not has correct tokens value'
      );

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[5] }),
        'ShirtumSale: All claimed'
      );
    });

  });

  describe('General claim with hardcap', function () {

    it('Only one claim by month', async function() {
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

      await this.shirtumSale.enableClaim({ from: accounts[0] });

      assert.equal(await this.shirtumSale.isFailed(), false, "Sale isFailed status must be false");
      assert.equal(await this.shirtumSale.isSuccessful(), true, "Sale isSuccessful status must be true");
      assert.equal(await this.shirtumSale.isActive(), false, "Sale isActive status must be false");

      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '0',
        'Account 1 not has correct tokens amount'
      );

      /** CLAIM **/

      await this.shirtumSale.claim({ from: accounts[1] });
      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '369230600000000000000000',
        'Account 1 not has correct tokens amount'
      );

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'Nothing to claim for now'
      );
    });

    it('Claim all month by month', async function() {
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

      assert.equal(await this.shirtumSale.isFailed(), false, "Sale isFailed status must be false");
      assert.equal(await this.shirtumSale.isSuccessful(), true, "Sale isSuccessful status must be true");
      assert.equal(await this.shirtumSale.isActive(), false, "Sale isActive status must be false");

      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '0',
        'Account 1 not has correct tokens amount'
      );

      /** CLAIM ACCOUNT **/

      await this.shirtumSale.claim({ from: accounts[1] });
      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '369230600000000000000000',
        'Account 1 not has correct tokens amount'
      );

      await time.increase(time.duration.days(30));

      await this.shirtumSale.claim({ from: accounts[1] });
      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '738461200000000000000000',
        'Account 1 not has correct tokens amount'
      );

      await time.increase(time.duration.days(30));

      await this.shirtumSale.claim({ from: accounts[1] });
      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '1107691800000000000000000',
        'Account 1 not has correct tokens amount'
      );

      await time.increase(time.duration.days(30));

      await this.shirtumSale.claim({ from: accounts[1] });
      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '1476922400000000000000000',
        'Account 1 not has correct tokens amount'
      );

      await time.increase(time.duration.days(30));

      await this.shirtumSale.claim({ from: accounts[1] });
      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '1846153000000000000000000',
        'Account 1 not has correct tokens amount'
      );

      await time.increase(time.duration.days(30));

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: All claimed'
      );
    });

    it('Random claim times', async function() {
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

      assert.equal(await this.shirtumSale.isFailed(), false, "Sale isFailed status must be false");
      assert.equal(await this.shirtumSale.isSuccessful(), true, "Sale isSuccessful status must be true");
      assert.equal(await this.shirtumSale.isActive(), false, "Sale isActive status must be false");

      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '0',
        'Account 1 not has correct tokens amount'
      );

      /** CLAIM ACCOUNT **/

      assert.equal(
        ((await this.shirtumSale.remainToClaim(accounts[1])).valueOf()).toString(),
        '1846153000000000000000000',
        'Account 1 not has correct tokens amount'
      );

      await this.shirtumSale.claim({ from: accounts[1] });
      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '369230600000000000000000',
        'Account 1 not has correct tokens amount'
      );

      await time.increase(time.duration.days(60));

      await this.shirtumSale.claim({ from: accounts[1] });
      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '1107691800000000000000000',
        'Account 1 not has correct tokens amount'
      );

      assert.equal(
        ((await this.shirtumSale.remainToClaim(accounts[1])).valueOf()).toString(),
        '738461200000000000000000',
        'Account 1 not has correct tokens amount'
      );

      await time.increase(time.duration.days(15));

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: Nothing to claim for now'
      );

      await time.increase(time.duration.days(60));

      await this.shirtumSale.claim({ from: accounts[1] });
      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '1846153000000000000000000',
        'Account 1 not has correct tokens amount'
      );

      await time.increase(time.duration.days(30));

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: All claimed'
      );

      await expectRevert(
        this.shirtumSale.remainToClaim(accounts[1]),
        'ShirtumSale: Nothing remains to claim'
      );
    });

    it('Claim all in six months', async function() {
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

      assert.equal(await this.shirtumSale.isFailed(), false, "Sale isFailed status must be false");
      assert.equal(await this.shirtumSale.isSuccessful(), true, "Sale isSuccessful status must be true");
      assert.equal(await this.shirtumSale.isActive(), false, "Sale isActive status must be false");

      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '0',
        'Account 1 not has correct tokens amount'
      );

      /** CLAIM ACCOUNT **/

      await time.increase(time.duration.days(180));

      await this.shirtumSale.claim({ from: accounts[1] });
      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '1846153000000000000000000',
        'Account 1 not has correct tokens amount'
      );

      await time.increase(time.duration.days(180));

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: All claimed'
      );
    });

  });

  describe('General claim with softcap', function () {

    it('Random claim times', async function() {
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

      assert.equal(
        ((await this.shirtumSale.getClaimableTokens(accounts[1])).valueOf()).toString(),
        '923076000000000000000000',
        'Account not has correct claimable tokens amount'
      );

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: Crowdsale must be successful'
      );

      await time.increase(time.duration.days(5));

      assert.equal(await this.shirtumSale.isFailed(), false, "Sale isFailed status must be false");
      assert.equal(await this.shirtumSale.isSuccessful(), true, "Sale isSuccessful status must be true");
      assert.equal(await this.shirtumSale.isActive(), false, "Sale isActive status must be false");

      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '0',
        'Account 1 not has correct tokens amount'
      );

      /** CLAIM **/

      assert.equal(
        (await this.shirtumSale.pendingClaimable(accounts[1])).toString(),
        '184615200000000000000000',
        'Account 1 pending to claim not has correct tokens value'
      );

      await this.shirtumSale.claim({ from: accounts[1] });
      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '184615200000000000000000',
        'Account 1 not has correct tokens amount'
      );

      await time.increase(time.duration.days(60));

      await this.shirtumSale.claim({ from: accounts[1] });
      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '553845600000000000000000',
        'Account 1 not has correct tokens amount'
      );

      await time.increase(time.duration.days(15));

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: Nothing to claim for now'
      );

      await time.increase(time.duration.days(60));

      await this.shirtumSale.claim({ from: accounts[1] });
      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '923076000000000000000000',
        'Account 1 not has correct tokens amount'
      );

      await time.increase(time.duration.days(30));

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: All claimed'
      );

      assert.equal(
        (await this.shirtumSale.pendingClaimable(accounts[1])).toString(),
        '0',
        'Account 1 pending to claim not has correct tokens value'
      );
    });

  });

  describe('Corporate claim with softcap', function () {

    it('Only one claim by month', async function() {
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

      assert.equal(await this.shirtumSale.isSuccessful(), false, "Sale isSuccessful status must be false");

      await expectRevert(
        this.shirtumSale.enableClaim({ from: accounts[0] }),
        'ShirtumSale: Sale not successful'
      );

      await time.increase(time.duration.days(2));

      await this.shirtumSale.enableClaim(
        { from: accounts[0] }
      );

      assert.equal(await this.shirtumSale.isFailed(), false, "Sale isFailed status must be false");
      assert.equal(await this.shirtumSale.isSuccessful(), true, "Sale isSuccessful status must be true");
      assert.equal(await this.shirtumSale.isActive(), false, "Sale isActive status must be false");

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: Claim is not yet possible'
      );

      await time.increase(time.duration.days(183));

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: Claim is not yet possible'
      );

      await expectRevert(
        this.shirtumSale.pendingClaimable(
          accounts[1],
          { from: accounts[1] }
        ),
        'ShirtumSale: Claim is not yet possible'
      );

      await time.increase(time.duration.days(183));

      /** CLAIM **/

      await this.shirtumSale.claim({ from: accounts[1] });
      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '618092275500000000000000',
        'Account 1 not has correct tokens amount'
      );

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'Nothing to claim for now'
      );

      await time.increase(time.duration.days(183));

      await this.shirtumSale.claim({ from: accounts[1] });
      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '4308922852500000000000000',
        'Account 1 not has correct tokens amount'
      );

      await time.increase(time.duration.days(183));

      await this.shirtumSale.claim({ from: accounts[1] });
      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '7384615000000000000000000',
        'Account 1 not has correct tokens amount'
      );

    });

    it('Claim all in 24 months', async function() {
      const amountOne = ether('96');
      const amountTwo = ether('97.5');
      const amountThree = ether('99');

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
        value: amountTwo
      });

      await this.shirtumSale.corpReceive({
        from: accounts[3],
        value: amountThree
      });

      assert.equal(
        ((await this.shirtumSale.getClaimableTokens(accounts[1])).valueOf()).toString(),
        '7384615000000000000000000',
        'Account 1 not has correct claimable tokens amount'
      );

      assert.equal(
        ((await this.shirtumSale.getClaimableTokens(accounts[2])).valueOf()).toString(),
        '7500000000000000000000000',
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

      assert.equal(await this.shirtumSale.isSuccessful(), false, "Sale isSuccessful status must be false");

      await expectRevert(
        this.shirtumSale.enableClaim({ from: accounts[0] }),
        'ShirtumSale: Sale not successful'
      );

      await time.increase(time.duration.days(2));

      await this.shirtumSale.enableClaim(
        { from: accounts[0] }
      );

      assert.equal(await this.shirtumSale.isFailed(), false, "Sale isFailed status must be false");
      assert.equal(await this.shirtumSale.isSuccessful(), true, "Sale isSuccessful status must be true");
      assert.equal(await this.shirtumSale.isActive(), false, "Sale isActive status must be false");

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: Claim is not yet possible'
      );

      await time.increase(time.duration.days(99));

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: Claim is not yet possible'
      );

      await expectRevert(
        this.shirtumSale.pendingClaimable(
          accounts[1],
          { from: accounts[1] }
        ),
        'ShirtumSale: Claim is not yet possible'
      );

      await time.increase(time.duration.days(633));

      /** CLAIM **/

      await this.shirtumSale.claim({ from: accounts[1] });
      assert.equal(
        ((await this.token.balanceOf(accounts[1])).valueOf()).toString(),
        '7384615000000000000000000',
        'Account 1 not has correct tokens amount'
      );

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: All claimed'
      );

      await time.increase(time.duration.days(183));

      await expectRevert(
        this.shirtumSale.claim({ from: accounts[1] }),
        'ShirtumSale: All claimed'
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
