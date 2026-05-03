import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("====================");
  console.log("Deploying SavingCore");
  console.log("====================");

  const mockUSDCDeployment = await deployments.get("MockUSDC");
  const vaultManagerDeployment = await deployments.get("VaultManager");

  console.log("MockUSDC address:", mockUSDCDeployment.address);
  console.log("VaultManager address:", vaultManagerDeployment.address);

  await deploy("SavingCore", {
    contract: "SavingCore",
    args: [mockUSDCDeployment.address, vaultManagerDeployment.address],
    from: deployer,
    log: true,
    autoMine: true,
  });
};

func.tags = ["SavingCore"];
func.dependencies = ["MockUSDC", "VaultManager"];
export default func;