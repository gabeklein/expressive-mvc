const github = require('@changesets/changelog-github').default;

module.exports = {
  getDependencyReleaseLine: github.getDependencyReleaseLine,
  async getReleaseLine(changeset, type, options) {
    const line = await github.getReleaseLine(changeset, type, options);
    return line.replace(/Thanks \[@[^\]]+\]\([^)]+\)! ?- /, '');
  },
};
