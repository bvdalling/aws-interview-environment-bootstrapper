import * as fs from 'fs';
import * as path from 'path';

export type Templates = {
  bootstrapBase: string;
  setupCloudWatchAgentTemplate: string;
  setupCodeServerTemplate: string;
  fetchInterviewBundleTemplate: string;
  nginxConfigTemplate: string;
};

export function loadTemplates(): Templates {
  return {
    bootstrapBase: fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'bootstrap-base.sh'),
      'utf8',
    ),
    setupCloudWatchAgentTemplate: fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'setup-cloudwatch-agent.sh'),
      'utf8',
    ),
    setupCodeServerTemplate: fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'setup-code-server.sh'),
      'utf8',
    ),
    fetchInterviewBundleTemplate: fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'fetch-interview-bundle.sh'),
      'utf8',
    ),
    nginxConfigTemplate: fs.readFileSync(
      path.join(__dirname, '..', 'config', 'nginx-code-server.conf'),
      'utf8',
    ),
  };
}

/** Safe single-quoted literal for POSIX sh. */
function shellSingleQuoted(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function renderCodeServerExtensionInstallBlock(extensions: string[]): string {
  if (extensions.length === 0) {
    return '';
  }
  const list = extensions.map(shellSingleQuoted).join(' ');
  return `# Install extensions (Open VSX ids)
for ext in ${list}; do
  sudo -u ubuntu env HOME=/home/ubuntu "$CODE_SERVER_BIN" --install-extension "$ext"
done
`;
}

export function renderCodeServerScript(
  templates: Templates,
  opts: {
    codeServerBasePath: string;
    cloudFrontHost: string;
    workspaceFolder: string;
    extensions: string[];
  },
): string {
  const extBlock = renderCodeServerExtensionInstallBlock(opts.extensions);
  return templates.setupCodeServerTemplate
    .replace(/__CODE_SERVER_BASE_PATH__/g, opts.codeServerBasePath)
    .replace(/__CLOUDFRONT_HOST__/g, opts.cloudFrontHost)
    .replace(/__CODE_SERVER_WORKSPACE_FOLDER__/g, opts.workspaceFolder)
    .replace(/__CODE_SERVER_INSTALL_EXTENSIONS__/g, extBlock);
}

export function renderSetupCloudWatchAgentScript(
  templates: Templates,
  opts: { logGroupName: string },
): string {
  return templates.setupCloudWatchAgentTemplate.replace(
    /__LOG_GROUP_NAME__/g,
    opts.logGroupName,
  );
}

export function renderNginxConfig(
  templates: Templates,
  opts: { basePath: string; originVerifyExpected: string },
): string {
  return templates.nginxConfigTemplate
    .replace(/__NGINX_BASE_PATH__/g, opts.basePath)
    .replace(/__ORIGIN_VERIFY_EXPECTED__/g, opts.originVerifyExpected);
}

export function renderFetchBundleScript(
  templates: Templates,
  opts: {
    projectBucketName: string;
    projectZipKey: string;
    workspaceFolder: string;
  },
): string {
  const zipPath = `${opts.workspaceFolder}.zip`;
  return templates.fetchInterviewBundleTemplate
    .replace(/__PROJECT_BUCKET__/g, opts.projectBucketName)
    .replace(/__PROJECT_ZIP_KEY__/g, opts.projectZipKey)
    .replace(/__WORKSPACE_FOLDER__/g, opts.workspaceFolder)
    .replace(/__WORKSPACE_ZIP_PATH__/g, zipPath);
}

