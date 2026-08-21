'use strict';

const extension = require('./extension');
const { registerGitHubPullRequestProvider } = require('./src/github-pr-provider');

async function activate(context) {
  const result = await Promise.resolve(extension.activate(context));
  await registerGitHubPullRequestProvider(context);
  return result;
}

function deactivate() {
  return extension.deactivate();
}

module.exports = {
  ...extension,
  activate,
  deactivate
};
