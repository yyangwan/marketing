const releaseDir = process.env.CONTENTOS_RELEASE_DIR;

if (!releaseDir) {
  throw new Error("CONTENTOS_RELEASE_DIR is required");
}

module.exports = {
  apps: [
    {
      name: "genilink-content",
      script: "server.js",
      cwd: releaseDir,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: "4002",
      },
    },
  ],
};
