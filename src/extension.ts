// SPDX-FileCopyrightText : © 2025 TU Wien <vadl@tuwien.ac.at>
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import { spawn } from 'child_process'
import { workspace, window, commands, Uri, ExtensionContext } from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    StreamInfo
} from 'vscode-languageclient/node';

let client: LanguageClient | null;

export async function activate(context: ExtensionContext) {
    await startClient(context);

    context.subscriptions.push(
        workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('openvadl')) {
                await stopClient();
                await startClient(context);
            }
        }),
        commands.registerCommand('openvadl.selectExecutable', async () => {
            const result = await window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                title: 'Select OpenVADL Executable',
                openLabel: 'Select',
            });
            if (result && result[0]) {
                const config = workspace.getConfiguration('openvadl');
                await config.update('customPath', result[0].fsPath, true);
            }
        })
    );
}

export async function deactivate(): Promise<void> {
    await stopClient();
}

async function stopClient(): Promise<void> {
    if (client) {
        await client.stop();
        client = null;
    }
}

async function startClient(context: ExtensionContext): Promise<void> {
    const config = workspace.getConfiguration('openvadl');
    const disableServer = config.get<boolean>('disableServer', false);
    const customPath = config.get<string>('customPath', '');
    const useTcp = config.get<boolean>('useTcpConnection', false);
    const tcpPort = config.get<number>('tcpPort', 10999);
    const dontStartServer = config.get<boolean>('dontStartServer', false);

    let serverOptions: ServerOptions;

    if (disableServer) {
        return;
    }

    if (useTcp && dontStartServer) {
        // TCP mode with external server — just connect, don't spawn anything
        serverOptions = () => {
            const socket = net.connect({ port: tcpPort });
            const result: StreamInfo = { writer: socket, reader: socket };
            return Promise.resolve(result);
        };
    } else {
        // Need to find the openvadl binary
        const executablePath = findOpenVadlExecutable(customPath);

        if (!executablePath) {
            showCompilerNotFoundNotification(customPath);
            return;
        }

        if (useTcp) {
            // Spawn server in TCP mode, then connect via socket
            serverOptions = () => {
                const serverProcess = spawn(executablePath, ['lsp', '--port', tcpPort.toString(), '--no-syntax-highlighting']);

                serverProcess.on('exit', (code: number | null) => {
                    if (code !== null && code !== 0) {
                        window.showErrorMessage(
                            `OpenVADL server terminated: The language server exited prematurely with code ${code}.`
                        );
                    }
                });

                // Give the server a moment to start listening
                return new Promise<StreamInfo>((resolve) => {
                    setTimeout(() => {
                        const socket = net.connect({ port: tcpPort });
                        resolve({ writer: socket, reader: socket });
                    }, 1000);
                });
            };
        } else {
            // Default: stdio mode
            serverOptions = {
                command: executablePath,
                args: ['lsp', '--no-syntax-highlighting'],
            };
        }
    }

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'vadl' }],
        synchronize: {
            fileEvents: workspace.createFileSystemWatcher('**/*.vadl')
        }
    };

    client = new LanguageClient(
        'openVADL-language-server',
        'OpenVADL Language Server',
        serverOptions,
        clientOptions
    );

    try {
        await client.start();
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        window.showErrorMessage(
            `OpenVADL server terminated: The language server exited prematurely. ${message}`
        );
        client = null;
    }
}

function findOpenVadlExecutable(customPath: string): string | null {
    // First, try custom path if configured
    if (customPath) {
        if (fs.existsSync(customPath) && isExecutable(customPath)) {
            return path.resolve(customPath);
        }
        return null;
    }

    // Fall back to PATH lookup
    return findInPath();
}

function findInPath(): string | null {
    const pathEnv = process.env['PATH'];
    if (!pathEnv) {
        return null;
    }

    const pathDirs = pathEnv.split(path.delimiter);
    const executableName = process.platform === 'win32' ? 'openvadl.exe' : 'openvadl';

    for (const dir of pathDirs) {
        const candidate = path.join(dir, executableName);
        if (fs.existsSync(candidate) && isExecutable(candidate)) {
            return candidate;
        }
    }

    return null;
}

function isExecutable(filePath: string): boolean {
    try {
        fs.accessSync(filePath, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

function showCompilerNotFoundNotification(customPath: string): void {
    const message = customPath
        ? `The 'openvadl' compiler was not found at '${customPath}'. Double check the provided path in the settings.`
        : "The 'openvadl' compiler was not found in your PATH. Please install OpenVADL or configure a custom path in settings.";

    window.showErrorMessage(message, 'Open Settings').then((action) => {
        if (action === 'Open Settings') {
            commands.executeCommand('workbench.action.openSettings', 'openvadl');
        }
    });
}
