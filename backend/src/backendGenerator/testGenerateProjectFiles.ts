import {
  generatePomXml,
  generateApplicationProperties,
  generateMainApplicationClass,
} from "./generateProjectFiles";

function run() {
  console.log("==================== pom.xml ====================");
  console.log(generatePomXml());

  console.log("============== application.properties ==============");
  console.log(generateApplicationProperties());

  console.log("========== GeneratedBackendApplication.java ==========");
  console.log(generateMainApplicationClass());
}

run();
