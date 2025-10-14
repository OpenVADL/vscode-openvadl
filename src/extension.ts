// SPDX-FileCopyrightText : © 2025 TU Wien <vadl@tuwien.ac.at>
// SPDX-License-Identifier: Apache-2.0

import * as net from 'net';
import { workspace, ExtensionContext } from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    StreamInfo
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    // Connect to language server via socket
    // - https://medium.com/nerd-for-tech/integrate-language-server-with-vs-code-extension-ffe8f33a79cf

    const port: number = 10999;
    let serverOptions: ServerOptions = () => {
        let socket = net.connect({port: port});
        let result: StreamInfo = {
            writer: socket,
            reader: socket
        }
        return Promise.resolve(result);
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'vadl' }],
        synchronize: {
            fileEvents: workspace.createFileSystemWatcher('**/.vadl')
        }
    };

    client = new LanguageClient(
        'openVADL-language-server',
        'openVADL Language Server',
        serverOptions,
        clientOptions
    );
    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
