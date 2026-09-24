# Running a Dash Core nightly with dashmate

A crash fix is already merged into Dash Core's development branch but is not in
v23.1.8 yet. If this crash affects your node and you don't want to wait for the
v24 release, you can point dashmate at a **nightly Core image** in the meantime.
This is optional. If your node runs fine on v23.1.8, stay on it.

> **Nightlies are pre-release software.** Automation builds them each day from
> Dash Core's `develop` branch. Change one node first and watch it before you
> change the rest. Switch back to the official image once v24 ships.

Running `dashd` directly, without dashmate? Use the
[Linux guide](dash-nightly-masternode-linux.md) instead.

This guide changes **only Dash Core**. Your Platform services (Drive,
Tenderdash, DAPI, gateway) stay on their current versions.

## Is this safe for mainnet?

- **Consensus stays the same.** The v24 hard fork can't activate on mainnet from
  these builds, so your node follows the same network rules as v23.1.8.
- **Platform needs one extra setting (step 2).** Without it, Platform on an
  evonode can't read some of Core's RPC responses.

## 1. Point Core at the nightly image

Images are published as `dashpay/dashd:<version>`. Use the newest dated nightly
tag, **2026.09.24 or later**, for example `24.0.0-nightly.2026.09.24`. The
available tags are listed at <https://hub.docker.com/r/dashpay/dashd/tags>.

```bash
dashmate config set core.docker.image dashpay/dashd:24.0.0-nightly.2026.09.24
```

Use the exact dated tag. Don't use `24-nightly` or `latest-nightly`, because
those change every night.

## 2. Keep the RPC fields Platform reads (required for evonodes)

v24 Core leaves out some older RPC fields unless it is told to keep them, and
current Platform releases still read those fields. Turn them back on:

```bash
dashmate config set core.docker.commandArgs '["-deprecatedrpc=service","-deprecatedrpc=softforks"]'
```

This is harmless on regular (non-evonode) masternodes, so it's simplest to
set it everywhere.

## 3. Restart

```bash
dashmate restart --safe
```

`--safe` waits until no DKG session is in progress before it stops the node,
which avoids disrupting DKG participation.

**If you have Insight enabled** (`core.insight.enabled`, which turns on
address, spent and timestamp indexes): on the first start, Core moves these
indexes into a new format. That can take 20–40 minutes or more, so the node
isn't stuck.

## 4. Check it's working

```bash
dashmate core cli "getnetworkinfo" | grep subversion      # should show 24.0.0
dashmate status core
dashmate status masternode                                # should reach READY
dashmate status platform                                  # evonodes: Drive/Tenderdash healthy
```

Evonodes: watch `dashmate status platform` for a few minutes. If Drive keeps
restarting or reports Core RPC errors, check that step 2 was applied:
`dashmate config get core.docker.commandArgs`.

## Already hit the crash?

If your node already stopped with `Assertion 'curDBTransaction.IsClean()' failed` and now
refuses to start with `Found EvoDB inconsistency, you must reindex to continue`, the
nightly prevents it from happening again but does not repair the existing damage.
Upgrade first, then reindex once (this takes several hours):

```bash
dashmate core reindex
```

## Going back to v23

```bash
dashmate config set core.docker.image dashpay/dashd:23
dashmate config set core.docker.commandArgs '[]'
dashmate restart --safe
```

If you had Insight enabled, v24 migrated its indexes, so v23 may need a
reindex: `dashmate core reindex`.

## When v24 is released

Switch to the official image and remove the override:

```bash
dashmate config set core.docker.image dashpay/dashd:24
dashmate config set core.docker.commandArgs '[]'
dashmate restart --safe
```

Keep the `commandArgs` override if the v24 release notes or your dashmate
version still say it's needed.
