import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("====================");
  console.log("Deploying VaultManager");
  console.log("====================");

  const mockUSDC = await ethers.getContract("MockUSDC");
  console.log("MockUSDC address:", mockUSDC.address);

  await deploy("VaultManager", {
    contract: "VaultManager",
    args: [mockUSDC.address],
    from: deployer,
    log: true,
    autoMine: true,
  });
};

func.tags = ["VaultManager"];
func.dependencies = ["MockUSDC"];
export default func;