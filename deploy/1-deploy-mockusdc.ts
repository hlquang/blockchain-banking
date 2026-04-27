import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("====================");
  console.log("Deploying MockUSDC");
  console.log("====================");

  await deploy("MockUSDC", {
    contract: "MockUSDC",
    args: [],
    from: deployer,
    log: true,
    autoMine: true,
  });
};

func.tags = ["MockUSDC"];
export default func;