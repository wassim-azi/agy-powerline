"use strict";

const { repository } = require("../../package.json");

const REPO_URL = repository.url.replace(/^git\+/, "").replace(/\.git$/, "");

module.exports = { REPO_URL };
