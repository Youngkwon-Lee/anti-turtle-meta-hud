# Security policy

## Supported scope

This repository is an experimental prototype. The unauthenticated demo relay is not suitable for production health data.

## Reporting a vulnerability

Please use GitHub's private security-advisory feature for the repository instead of opening a public issue. Do not include real telemetry, credentials, personal identifiers, or patient information in a report.

## Deployment requirements

Before using this project beyond a local or controlled demo, add:

- authenticated senders and receivers;
- authorization for every session/channel;
- unguessable, non-identifying channel IDs;
- transport and storage encryption appropriate to the deployment;
- explicit retention and deletion rules;
- request rate limits and abuse monitoring;
- dependency and secret scanning;
- a documented incident-response owner.

No default deployment of this repository should be treated as a medical-device or clinical-data system.
