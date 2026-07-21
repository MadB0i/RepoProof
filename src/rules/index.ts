import { Rule } from "../types.js";

import { rule as todoFixme } from "./todo-fixme.js";
import { rule as notImplemented } from "./not-implemented.js";
import { rule as emptyFunction } from "./empty-function.js";
import { rule as placeholderText } from "./placeholder-text.js";
import { rule as commentedCode } from "./commented-code.js";
import { rule as mockData } from "./mock-data.js";
import { rule as disabledTests } from "./disabled-tests.js";
import { rule as missingTests } from "./missing-tests.js";
import { rule as emptyTestFiles } from "./empty-test-files.js";
import { rule as testEchoCommand } from "./test-echo-command.js";
import { rule as coverageExcludes } from "./coverage-excludes.js";
import { rule as hardcodedSecrets } from "./hardcoded-secrets.js";
import { rule as envTracked } from "./env-tracked.js";
import { rule as unsafeEval } from "./unsafe-eval.js";
import { rule as wildcardCors } from "./wildcard-cors.js";
import { rule as debugEnabled } from "./debug-enabled.js";
import { rule as missingGitignore } from "./missing-gitignore.js";
import { rule as emptyCatch } from "./empty-catch.js";
import { rule as noTimeout } from "./no-timeout.js";
import { rule as unboundedRetries } from "./unbounded-retries.js";
import { rule as processExit } from "./process-exit.js";
import { rule as readmeExists } from "./readme-exists.js";
import { rule as licenseExists } from "./license-exists.js";
import { rule as contributingExists } from "./contributing-exists.js";
import { rule as codeOfConduct } from "./code-of-conduct.js";
import { rule as changelogExists } from "./changelog-exists.js";
import { rule as ciWorkflow } from "./ci-workflow.js";
import { rule as lockfileExists } from "./lockfile-exists.js";
import { rule as envDocumented } from "./env-documented.js";
import { rule as packageMetadata } from "./package-metadata.js";
import { rule as brokenScripts } from "./broken-scripts.js";

export const rules: Rule[] = [
  todoFixme,
  notImplemented,
  emptyFunction,
  placeholderText,
  commentedCode,
  mockData,
  disabledTests,
  missingTests,
  emptyTestFiles,
  testEchoCommand,
  coverageExcludes,
  hardcodedSecrets,
  envTracked,
  unsafeEval,
  wildcardCors,
  debugEnabled,
  missingGitignore,
  emptyCatch,
  noTimeout,
  unboundedRetries,
  processExit,
  readmeExists,
  licenseExists,
  contributingExists,
  codeOfConduct,
  changelogExists,
  ciWorkflow,
  lockfileExists,
  envDocumented,
  packageMetadata,
  brokenScripts,
];
