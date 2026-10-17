# Azure app VM

Provisioned and SSH-verified 2026-10-17. Observed2 CPUs,3949052KiB RAM,32GiB Standard SSD. Public IP: `85.211.243.118`. Connect with `ssh -i ~/.ssh/id_ed25519 mandateadmin@85.211.243.118`.

Target: `mandate-app-demo` in resource group `mandate-demo-rg`, Malaysia West. ARM source: `app-vm.json`.

- Standard_B2als_v2: 2 vCPU / 4 GiB RAM; 32 GiB Standard SSD.
- Ubuntu24.04 LTS Gen2, pinned image `24.04.202610160`.
- Trusted Launch with Secure Boot/vTPM; password authentication disabled.
- SSH user `mandateadmin`, existing local Ed25519 public key; inbound22 restricted to the owner's configured public IP/32.
- Static Standard public IPv4; system-assigned identity with no added role assignments.
- No MPC shares, signing keys, application credentials, wallet deployment or application release in this provisioning step.

The template takes `sshPublicKey` and `sshSourceCidr`. Local parameter files are kept outside the repository. Re-run validation/deployment only for intentional infrastructure changes; an IP change requires updating the SSH rule.

## Inspect

```bash
az vm show -g mandate-demo-rg -n mandate-app-demo --show-details -o table
az vm get-instance-view -g mandate-demo-rg -n mandate-app-demo -o json
```

## Stop compute charges

```bash
az vm deallocate -g mandate-demo-rg -n mandate-app-demo
```

Deallocation retains disks and the static IP, which remain billable. No scheduled shutdown or deletion is configured. The approved estimate is approximately $3.70 for72hours or $37.30/month for compute/OS disk/IP; actual usage, backups, traffic and later services can change the total.

CI/CD activation, runtime setup, persistent database/TLS/roles, Key Vault, HTTPS/domain and product deployment are separate pending steps in [Automatic testnet delivery](../../docs/operations/AZURE-DELIVERY-DESIGN.md).
