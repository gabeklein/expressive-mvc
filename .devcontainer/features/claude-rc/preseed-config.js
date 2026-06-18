// Merge the non-secret Claude onboarding flags into .claude.json so `claude` and
// `claude remote-control` don't prompt for onboarding/theme, folder-trust, or the
// "Enable Remote Control?" dialog. Idempotent; preserves any existing state.
// Runs under bun or node. Args: <claude.json path> <project dir>
const fs = require("fs");
const [file, project] = process.argv.slice(2);

let c = {};
try { c = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* start fresh */ }

c.hasCompletedOnboarding = true;
c.remoteDialogSeen = true; // suppresses the "Enable Remote Control?" prompt

c.projects = c.projects || {};
c.projects[project] = c.projects[project] || {};
c.projects[project].hasTrustDialogAccepted = true; // "trust this folder"
if (!c.projects[project].projectOnboardingSeenCount)
  c.projects[project].projectOnboardingSeenCount = 1;

fs.writeFileSync(file, JSON.stringify(c, null, 2));
