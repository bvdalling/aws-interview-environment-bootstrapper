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

export function renderCodeServerScript(
  templates: Templates,
  opts: { codeServerPassword: string },
): string {
  return templates.setupCodeServerTemplate.replace(
    '__CODE_SERVER_PASSWORD__',
    opts.codeServerPassword,
  );
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

/** Nginx $http_* suffix for a header, e.g. X-Origin-Verify → x_origin_verify */
export function toNginxHeaderVariableName(headerName: string): string {
  return headerName.toLowerCase().replace(/-/g, '_');
}

export function renderNginxConfig(templates: Templates): string {
  return templates.nginxConfigTemplate;
}

export function renderFetchBundleScript(
  templates: Templates,
  opts: { projectBucketName: string; projectZipKey: string },
): string {
  return templates.fetchInterviewBundleTemplate
    .replace(/__PROJECT_BUCKET__/g, opts.projectBucketName)
    .replace(/__PROJECT_ZIP_KEY__/g, opts.projectZipKey);
}

