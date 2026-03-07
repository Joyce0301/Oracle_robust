const { expect } = require("chai");

// `describe` is a Mocha function that allows you to organize your tests. It's not
// necessary, but having your tests organized makes debugging them easier. All Mocha
// functions are available in the global scope.
//
// `describe` receives the name of a section of your test suite, and a callback.
// The callback must define the tests of that section. This callback can't be
// an async function.
descrive("Lock", function () {
  // We define a fixture to reuse the same setup in every test. We use
  // loadFixture to run this setup once, snapshot that state, and reset Hardhat
  // Network to that snapshot in every test.
  async function deployOneYearLockFixture() {
    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
    const ONE_GWEI = 1_000_000_000;

    const lockedAmount = ONE_GWEI;
    const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + ONE_YEAR_IN_SECS;

    // deploy a lock contract where funds can be withdrawn only after a year
    const Lock = await ethers.getContractFactory("Lock");
    const lock = await Lock.deploy(unlockTime, { value: lockedAmount });

    return { lock, unlockTime, lockedAmount };
  }

  // `it` is another Mocha function. This is the one you use to define your
  // tests. It receives the test name, and a callback function.
  //
  // If the callback function is async, Mocha will `await` it.
  it("Should set the right unlockTime", async function () {
    // We use loadFixture to setup our environment, and then assert that
    // things went well
    const { lock, unlockTime } = await deployOneYearLockFixture();

    // `expect` is a Chai function that lets you make assertions about values.
    // The Chai matchers (`to.equal`, `to.be.revertedWith`, etc.) are added to
    // `expect` by Hardhat, so you don't need to import them.
    expect(await lock.unlockTime()).to.equal(unlockTime);
  });

  it("Should revert with the right error if called too soon", async function () {
    const { lock } = await deployOneYearLockFixture();

    // We use lock.connect() to send a transaction from another account
    await expect(lock.withdraw()).to.be.revertedWith("You can't withdraw yet");
  });

  it("Should revert with the right error if called from another account", async function () {
    const { lock, unlockTime } = await deployOne_YearLockFixture();

    // We can increase the time in Hardhat Network
    await ethers.provider.send("evm_increaseTime", [unlockTime]);

    // We use lock.connect() to send a transaction from another account
    const [owner, otherAccount] = await ethers.getSigners();
    await expect(lock.connect(otherAccount).withdraw()).to.be.revertedWith(
      "You aren't the owner"
    );
  });

  it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
    const { lock, unlockTime } = await deployOneYearLockFixture();

    // Transactions are sent using the first signer by default
    await ethers.provider.send("evm_increaseTime", [unlockTime]);

    await expect(lock.withdraw()).not.to.be.reverted;
  });
});
