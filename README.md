# OpenVADL Extension for Visual Studio Code

This extension provides IDE support for the processor description language VADL.

## Features

- Syntax highlighting for VADL
- Language server features (compiler errors, etc.) via the OpenVADL compiler

### Language server features

To provide advanced IDE features (like displaying compilation errors, go to definition, etc.) this extension communicates with a language server in the background. This language server is conveniently bundled together with the OpenVADL compiler.

You may need to set a custom path to your `openvadl` binary in Settings > Extensions > OpenVADL. Note that GraalVM native builds of OpenVADL are currently not supported.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md).

## Manual install

To install this Extension in VS Code, extract [this repository](https://github.com/OpenVADL/vscode-openvadl) to your users `.vscode/extensions/` directory.

The core of this extension is a [TextMate syntax highlighting definition](syntaxes/vadl.tmLanguage.json) which you may be able to use in other IDEs as well.
