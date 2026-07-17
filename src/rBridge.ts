import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

export interface RDataResult {
  fileType: string;
  objects: RObjectInfo[];
  error?: string;
}

export interface RObjectInfo {
  name: string;
  class: string[];
  typeof: string;
  viewType: string;
  nrow?: number;
  ncol?: number;
  length?: number;
  truncated?: boolean;
  columns?: { name: string; type: string; typeof: string }[];
  data?: Record<string, unknown>[];
  values?: unknown[];
  levels?: string[];
  tree?: unknown;
  value?: string;
}

/**
 * Find the Rscript executable path.
 */
function findRscript(): string {
  const config = vscode.workspace.getConfiguration('rdataPreview');
  const customPath = config.get<string>('rscriptPath', '');
  return customPath || 'Rscript';
}

/**
 * Read an RData/rds file by invoking Rscript.
 */
export function readRData(
  filePath: string,
  extensionPath: string,
  token?: vscode.CancellationToken
): Promise<RDataResult> {
  return new Promise((resolve, reject) => {
    const rscript = findRscript();
    const scriptPath = path.join(extensionPath, 'scripts', 'read_rdata.R');
    const maxRows = vscode.workspace
      .getConfiguration('rdataPreview')
      .get<number>('maxRows', 1000);

    const proc = cp.spawn(rscript, [scriptPath, filePath, String(maxRows)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    });

    if (token) {
      token.onCancellationRequested(() => proc.kill());
    }

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        // Check common error cases
        if (stderr.includes('Rscript') && stderr.includes('not found')) {
          reject(
            new Error(
              'Rscript not found. Please install R or set rdataPreview.rscriptPath in settings.'
            )
          );
        } else {
          try {
            const errResult = JSON.parse(stdout);
            reject(new Error(errResult.error || `Rscript exited with code ${code}`));
          } catch {
            reject(new Error(stderr || `Rscript exited with code ${code}`));
          }
        }
        return;
      }

      try {
        const result: RDataResult = JSON.parse(stdout);
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result);
        }
      } catch {
        reject(new Error(`Failed to parse Rscript output: ${stdout.slice(0, 200)}`));
      }
    });

    proc.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(
          new Error(
            'Rscript not found. Please install R or set rdataPreview.rscriptPath in settings.'
          )
        );
      } else {
        reject(err);
      }
    });
  });
}
