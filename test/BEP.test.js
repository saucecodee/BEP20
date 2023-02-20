const { expect, assert } = require("chai");
const { ethers } = require("hardhat");

describe("BEP20 Token", function () {
  before(async function () {
    this.Bep = await ethers.getContractFactory('BEP');
    const signers = await ethers.getSigners();
    this.owner = signers[0]
    this.alice = signers[1]
    this.bob = signers[2]
    this.john = signers[3]
  });

  beforeEach(async function () {
    this.contract = await this.Bep.deploy();
    await this.contract.deployed();
  });

  const decimals = 18

  const token = (amount = 0) => ethers.utils.parseUnits(amount.toString(), decimals)

  describe('Initial State', function () {
    it('should deploy the contract correctly', async function () {
      expect(
        JSON.stringify({
          name: await this.contract.name(),
          symbol: await this.contract.symbol(),
          decimals: await this.contract.decimals(),
          totalSupply: await this.contract.totalSupply(),
          getOwner: await this.contract.getOwner()

        })
      ).to.be.equal(
        JSON.stringify({
          name: "BEP Token",
          symbol: "BEP",
          decimals,
          totalSupply: token("700000000"),
          getOwner: this.owner.address
        })
      );
    })
  })


  describe('balanceOf(_owner)', function () {
    it('should have correct initial balances', async function () {
      expect(await this.contract.balanceOf(this.owner.address)).to.be.equal(token(700000000))
      expect(await this.contract.balanceOf(this.alice.address)).to.be.equal(0)
      expect(await this.contract.balanceOf(this.bob.address)).to.be.equal(0)
      expect(await this.contract.balanceOf(this.john.address)).to.be.equal(0)
    })

    it('should return the correct balances', async function () {
      await this.contract.transfer(this.alice.address, token(10))
      expect(await this.contract.balanceOf(this.alice.address)).to.be.equal(token(10))
      expect(await this.contract.balanceOf(this.owner.address)).to.be.equal(token(699999990))

    })
  })


  describe('allowance(_owner, _spender)', function () {
    it('should have correct initial allowance', async function () {
      expect(await this.contract.allowance(this.alice.address, this.bob.address)).to.be.equal(token(0))
      expect(await this.contract.allowance(this.john.address, this.owner.address)).to.be.equal(token(0))
    })

    it('should return the correct allowance', async function () {
      await this.contract.connect(this.alice).approve(this.bob.address, token(1))
      await this.contract.connect(this.alice).approve(this.john.address, token(2))
      await this.contract.connect(this.bob).approve(this.john.address, token(3))
      await this.contract.connect(this.bob).approve(this.alice.address, token(4))
      await this.contract.connect(this.john).approve(this.alice.address, token(5))
      await this.contract.connect(this.john).approve(this.bob.address, token(6))

      expect(await this.contract.allowance(this.alice.address, this.bob.address)).to.be.equal(token(1))
      expect(await this.contract.allowance(this.alice.address, this.john.address)).to.be.equal(token(2))
      expect(await this.contract.allowance(this.bob.address, this.john.address)).to.be.equal(token(3))
      expect(await this.contract.allowance(this.bob.address, this.alice.address)).to.be.equal(token(4))
      expect(await this.contract.allowance(this.john.address, this.alice.address)).to.be.equal(token(5))
      expect(await this.contract.allowance(this.john.address, this.bob.address)).to.be.equal(token(6))
    })
  })


  describe('approve(_spender, _value)', function () {
    it('should return true when approving 0', async function () {
      assert.isTrue(await this.contract.connect(this.alice).callStatic.approve(this.bob.address, 0))
    })

    it('should return true when approving', async function () {
      assert.isTrue(await this.contract.connect(this.alice).callStatic.approve(this.bob.address, token(3)))
    })

    it('should return true when updating approval', async function () {
      assert.isTrue(await this.contract.connect(this.alice).callStatic.approve(this.bob.address, token(2)))
      await this.contract.connect(this.alice).callStatic.approve(this.bob.address, token(2))

      // test decreasing approval
      assert.isTrue(await this.contract.connect(this.alice).callStatic.approve(this.bob.address, token(1)))

      // test not-updating approval
      assert.isTrue(await this.contract.connect(this.alice).callStatic.approve(this.bob.address, token(2)))

      // test increasing approval
      assert.isTrue(await this.contract.connect(this.alice).callStatic.approve(this.bob.address, token(3)))
    })

    it('should return true when revoking approval', async function () {
      await this.contract.connect(this.alice).approve(this.bob.address, token(3))
      assert.isTrue(await this.contract.connect(this.alice).callStatic.approve(this.bob.address, token(0)))
    })

    it('should update allowance accordingly', async function () {
      await await this.contract.connect(this.alice).approve(this.bob.address, token(1))
      expect(await this.contract.allowance(this.alice.address, this.bob.address)).to.be.equal(token(1))

      await await this.contract.connect(this.alice).approve(this.bob.address, token(3))
      expect(await this.contract.allowance(this.alice.address, this.bob.address)).to.be.equal(token(3))

      await await this.contract.connect(this.alice).approve(this.bob.address, 0)
      expect(await this.contract.allowance(this.alice.address, this.bob.address)).to.be.equal('0')
    })

    it('should fire Approval event', async function () {
      await testApprovalEvent(this.contract, this.alice, this.bob.address, token(1))
      await testApprovalEvent(this.contract, this.bob, this.alice.address, token(2))
    })

    it('should fire Approval when allowance was set to 0', async function () {
      await this.contract.connect(this.alice).approve(this.bob.address, token(3))
      await testApprovalEvent(this.contract, this.alice, this.bob.address, 0)
    })

    it('should fire Approval even when allowance did not change', async function () {
      await testApprovalEvent(this.contract, this.alice, this.bob.address, 0)
      await this.contract.connect(this.alice).approve(this.bob.address, token(3))
      await testApprovalEvent(this.contract, this.alice, this.bob.address, token(3))
    })

    async function testApprovalEvent(contract, from, to, amount) {
      await expect(await contract.connect(from).approve(to, amount))
        .to.emit(contract, "Approval")
        .withArgs(from.address, to, amount);
    }
  })


  describe('transfer(_to, _value)', function () {
    it('should return true when called with amount of 0', async function () {
      assert.isTrue(await this.contract.connect(this.alice).callStatic.transfer(this.bob.address, 0))
    })

    it('should return true when transfer can be made, false otherwise', async function () {
      await credit(this.contract, this.alice.address, token(3))
      assert.isTrue(await this.contract.connect(this.alice).callStatic.transfer(this.bob.address, token(1)))
      assert.isTrue(await this.contract.connect(this.alice).callStatic.transfer(this.bob.address, token(2)))
      assert.isTrue(await this.contract.connect(this.alice).callStatic.transfer(this.bob.address, token(3)))

      await this.contract.connect(this.alice).transfer(this.bob.address, token(1))
      assert.isTrue(await this.contract.connect(this.alice).callStatic.transfer(this.bob.address, token(1)))
      assert.isTrue(await this.contract.connect(this.alice).callStatic.transfer(this.bob.address, token(2)))
    })

    it('should revert when trying to transfer something while having nothing', async function () {
      await expectRevertOrFail(this.contract.connect(this.alice).transfer(this.bob.address, token(1)))
    })

    it('should revert when trying to transfer more than balance', async function () {
      await credit(this.contract, this.alice.address, token(3))
      await expectRevertOrFail(this.contract.connect(this.alice).transfer(this.bob.address, token(4)))

      await this.contract.connect(this.alice).transfer('0x0000000000000000000000000000000000000001', token(1))
      await expectRevertOrFail(this.contract.connect(this.alice).transfer(this.bob.address, token(3)))
    })

    it('should not affect totalSupply', async function () {
      await credit(this.contract, this.alice.address, token(3))
      let supply1 = await this.contract.totalSupply()
      await this.contract.transfer(this.bob.address, token(3))
      let supply2 = await this.contract.totalSupply()
      expect(supply2).to.be.equal(supply1)
    })

    it('should update balances accordingly', async function () {
      await credit(this.contract, this.alice.address, token(3))
      let fromBalance1 = await this.contract.balanceOf(this.alice.address)
      let toBalance1 = await this.contract.balanceOf(this.bob.address)

      await this.contract.connect(this.alice).transfer(this.bob.address, token(1))
      let fromBalance2 = await this.contract.balanceOf(this.alice.address)
      let toBalance2 = await this.contract.balanceOf(this.bob.address)

      if (this.bob.address == this.alice.address) {
        expect(fromBalance2).to.be.equal(fromBalance1)
      }
      else {
        expect(fromBalance2).to.be.equal(fromBalance1.sub(token(1)))
        expect(toBalance2).to.be.equal(toBalance1.add(token(1)))
      }

      await this.contract.connect(this.alice).transfer(this.bob.address, token(2))
      let fromBalance3 = await this.contract.balanceOf(this.alice.address)
      let toBalance3 = await this.contract.balanceOf(this.bob.address)

      if (this.alice.address == this.bob.address) {
        expect(fromBalance3).to.be.equal(fromBalance2)
      }
      else {
        expect(fromBalance3).to.be.equal(fromBalance2.sub(token(2)))
        expect(toBalance3).to.be.equal(toBalance2.add(token(2)))
      }
    })

    it('should fire Transfer event', async function () {
      await testTransferEvent(this.contract, this.alice, this.bob, token(3))
    })

    it('should fire Transfer event when transferring amount of 0', async function () {
      await testTransferEvent(this.contract, this.alice, this.bob, 0)
    })

    async function testTransferEvent(contract, from, to, amount) {
      if (amount > 0) {
        await credit(contract, from.address, amount)
      }

      let tx = await contract.connect(from).transfer(to.address, amount)
      let log = await tx.wait()
      const event = log.events.find(event => event.event === 'Transfer');
      assert.equal(event.event, 'Transfer')
      assert.equal(event.args.from, from.address)
      assert.equal(event.args.to, to.address)
      expect(event.args.value).to.be.equal(amount)
    }
  })


  describe('transferFrom(_from, _to, _value)', function () {
    it('should revert when trying to transfer while not allowed at all', async function () {
      await credit(this.contract, this.alice.address, token(3))
      await expectRevertOrFail(this.contract.connect(this.bob).transferFrom(this.alice.address, this.bob.address, token(1)))
      await expectRevertOrFail(this.contract.connect(this.bob).transferFrom(this.alice.address, this.john.address, token(1)))
    })

    it('should fire Transfer event when transferring amount of 0 and sender is not approved', async function () {
      await testTransferEvent(this.contract, this.alice, this.bob, this.bob, 0)
    })

    beforeEach(async function () {
      await this.contract.connect(this.alice).approve(this.john.address, token(3))
    })

    it('should return true when called with amount of 0 and sender is approved', async function () {
      assert.isTrue(await this.contract.connect(this.john).callStatic.transferFrom(this.alice.address, this.bob.address, 0))
    })

    it('should return true when called with amount of 0 and sender is not approved', async function () {
      assert.isTrue(await this.contract.connect(this.john).callStatic.transferFrom(this.bob.address, this.alice.address, 0))
    })

    it('should return true when transfer can be made, false otherwise', async function () {
      await credit(this.contract, this.alice.address, token(3))
      assert.isTrue(await this.contract.connect(this.john).callStatic.transferFrom(this.alice.address, this.bob.address, token(1)))
      assert.isTrue(await this.contract.connect(this.john).callStatic.transferFrom(this.alice.address, this.bob.address, token(2)))
      assert.isTrue(await this.contract.connect(this.john).callStatic.transferFrom(this.alice.address, this.bob.address, token(3)))

      await this.contract.connect(this.john).transferFrom(this.alice.address, this.bob.address, token(1))
      assert.isTrue(await this.contract.connect(this.john).callStatic.transferFrom(this.alice.address, this.bob.address, token(1)))
      assert.isTrue(await this.contract.connect(this.john).callStatic.transferFrom(this.alice.address, this.bob.address, token(2)))
    })

    it('should revert when trying to transfer something while _from having nothing', async function () {
      await expectRevertOrFail(this.contract.connect(this.john).transferFrom(this.alice.address, this.bob.address, token(1)))
    })

    it('should revert when trying to transfer more than balance of _from', async function () {
      await credit(this.contract, this.alice.address, token(2))
      await expectRevertOrFail(this.contract.connect(this.john).transferFrom(this.alice.address, this.bob.address, token(3)))
    })

    it('should revert when trying to transfer more than allowed', async function () {
      await credit(this.contract, this.alice.address, token(4))
      await expectRevertOrFail(this.contract.connect(this.john).transferFrom(this.alice.address, this.bob.address, token(4)))
    })

    it('should not affect totalSupply', async function () {
      await credit(this.contract, this.alice.address, token(3))
      let supply1 = await this.contract.totalSupply()
      await this.contract.connect(this.john).transferFrom(this.alice.address, this.bob.address, token(3))
      let supply2 = await this.contract.totalSupply()
      expect(supply2).to.be.equal(supply1)
    })

    it('should update balances accordingly', async function () {
      await credit(this.contract, this.alice.address, token(3))
      let fromBalance1 = await this.contract.balanceOf(this.alice.address)
      let viaBalance1 = await this.contract.balanceOf(this.john.address)
      let toBalance1 = await this.contract.balanceOf(this.bob.address)

      await this.contract.connect(this.john).transferFrom(this.alice.address, this.bob.address, token(1))
      let fromBalance2 = await this.contract.balanceOf(this.alice.address)
      let viaBalance2 = await this.contract.balanceOf(this.john.address)
      let toBalance2 = await this.contract.balanceOf(this.bob.address)

      if (this.alice.address == this.bob.address) {
        expect(fromBalance2).to.be.equal(fromBalance1)
      }
      else {
        expect(fromBalance2).to.be.equal(fromBalance1.sub(token(1)))
        expect(toBalance2).to.be.equal(toBalance1.add(token(1)))
      }

      if (this.john.address != this.alice.address && this.john.address != this.bob.address) {
        expect(viaBalance2).to.be.equal(viaBalance1)
      }

      await this.contract.connect(this.john).transferFrom(this.alice.address, this.bob.address, token(2))
      let fromBalance3 = await this.contract.balanceOf(this.alice.address)
      let viaBalance3 = await this.contract.balanceOf(this.john.address)
      let toBalance3 = await this.contract.balanceOf(this.bob.address)

      if (this.alice.address == this.bob.address) {
        expect(fromBalance3).to.be.equal(fromBalance2)
      }
      else {
        expect(fromBalance3).to.be.equal(fromBalance2.sub(token(2)))
        expect(toBalance3).to.be.equal(toBalance2.add(token(2)))
      }

      if (this.john.address != this.alice.address && this.john.address != this.bob.address) {
        expect(viaBalance3).to.be.equal(viaBalance2)
      }
    })

    it('should update allowances accordingly', async function () {
      await credit(this.contract, this.alice.address, token(3))
      let viaAllowance1 = await this.contract.allowance(this.alice.address, this.john.address)
      let toAllowance1 = await this.contract.allowance(this.alice.address, this.bob.address)

      await this.contract.connect(this.john).transferFrom(this.alice.address, this.bob.address, token(2))
      let viaAllowance2 = await this.contract.allowance(this.alice.address, this.john.address)
      let toAllowance2 = await this.contract.allowance(this.alice.address, this.bob.address)

      expect(viaAllowance2).to.be.equal(viaAllowance1.sub(token(2)))

      if (this.bob.address != this.john.address) {
        expect(toAllowance2).to.be.equal(toAllowance1)
      }

      await this.contract.connect(this.john).transferFrom(this.alice.address, this.bob.address, token(1))
      let viaAllowance3 = await this.contract.allowance(this.alice.address, this.john.address)
      let toAllowance3 = await this.contract.allowance(this.alice.address, this.bob.address)

      expect(viaAllowance3).to.be.equal(viaAllowance2.sub(token(1)))

      if (this.bob.address != this.john.address) {
        expect(toAllowance3).to.be.equal(toAllowance1)
      }
    })

    it('should fire Transfer event', async function () {
      await testTransferEvent(this.contract, this.alice, this.john, this.bob, token(3))
    })

    it('should fire Transfer event when transferring amount of 0', async function () {
      await testTransferEvent(this.contract, this.alice, this.john, this.bob, 0)
    })


    async function testTransferEvent(contract, from, via, to, amount) {
      if (amount > 0) {
        await credit(contract, from.address, amount)
      }

      let tx = await contract.connect(via).transferFrom(from.address, to.address, amount)
      let log = await tx.wait()
      const event = log.events.find(event => event.event === 'Transfer');
      assert.equal(event.event, 'Transfer')
      assert.equal(event.args.from, from.address)
      assert.equal(event.args.to, to.address)
      expect(event.args.value).to.be.equal(amount)
    }
  })

});


/**
 * Transfer tokens from contract owner to account
 * @param {Contract} contract
 * @param {address} to
 * @param {BigNumber} amount
 */
async function credit(contract, to, amount) {
  return await contract.transfer(to, amount)
}

/**
 * Asserts that given promise will throw because of revert() or failed assertion.
 * @param {Promise} promise
 */
async function expectRevertOrFail(promise) {
  await expectError(promise, ['revert', 'invalid opcode'])
}

/**
 * Asserts that given promise will throw and that thrown message will contain one of the given
 * search strings.
 *
 * @param {Promise} promise The promise expecting to throw.
 * @param {string[]} messages List of expected thrown message search strings.
 */
async function expectError(promise, messages) {
  try {
    await promise
  } catch (error) {
    for (let i = 0; i < messages.length; i++) {
      if (error.message.search(messages[i]) >= 0) {
        return
      }
    }
    assert.fail("Expected revert, got '" + error + "' instead.")
  }
  assert.fail('Expected revert not received.')
}
