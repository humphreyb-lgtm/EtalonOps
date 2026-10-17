#!/usr/bin/env bash
set -euo pipefail
umask 077
export AZURE_CONFIG_DIR=/workspace/.credentials/etalonops-azure
export AZURE_CORE_COLLECT_TELEMETRY=false
export REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
mkdir -p "$AZURE_CONFIG_DIR"
chmod 700 "$AZURE_CONFIG_DIR"
azure_cli=/workspace/.venvs/etalonops-azure/bin/az
# Invoke only once Microsoft sign-in/management networking has been activated.
# The owner signs in on Microsoft's page; never collect passwords/MFA in chat.
"$azure_cli" config set core.login_experience_v2=off --only-show-errors --output none
"$azure_cli" login --use-device-code --allow-no-subscriptions --output none
"$azure_cli" account list --query '[].{name:name,subscription:id,tenant:tenantId,isDefault:isDefault}' --output json
# This script contains no create, deploy, role-assignment, purchase or DNS action.
