# Renderfarm

<p align="center">
    <img src="./doc/img/icon.png">
</p>

<br>

Complete blender renderfarm. School project.

[![Releases](https://badgen.net/github/release/Arkanic/renderfarm)](https://github.com/Arkanic/renderfarm/releases)
[![Commits](https://badgen.net/github/watchers/Arkanic/renderfarm)](https://github.com/Arkanic/renderfarm)

Web interface | Simple usage | Contained workers
--- | --- | ---
![Image 1](./doc/img/readme-dashboard.png) | ![Image 2](./doc/img/server-logs.png) | ![Image 3](./doc/img/worker-logs.png)

For installation and other questions [read the docs](./doc/README.md)


Full software solution for distributing renders between a cluster-like set of computers. A master server computer with a web dashboard accepts people uploading blender projects, and distributes tasks between workers.

## Features
- Web dashboard for complete management of network
- Easily upload blender project via web interface
- Simple contained system for the worker, can easily be turned on/off
- Designed to be left unattended
- Theoretically works on any device running linux that meets blenders' minimum requirements

## Intended Usage
This project was started to find a use for a collection of old Mini PCs and a network switch, whilst also solving a real problem.

## Docs & Contact
[Documentation](./doc/README.md)

For troubleshooting and issues, open a [GitHub issue](https://github.com/Arkanic/renderfarm/issues/new)