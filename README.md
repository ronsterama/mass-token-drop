# Mass Token Drop

A Foundry VTT module that drops several tokens into a scene at once. Pick
actors in a quick-select dialog, set quantities, and place them in formation
or randomly.

## Install

In Foundry's **Add-on Modules → Install Module**, paste this manifest URL:

```
https://github.com/ronsterama/mass-token-drop/releases/latest/download/module.json
```

Future versions show up under **Check for Update**.

## Releasing a new version

Commit and push, then push a tag (`git tag vX.Y.Z`, `git push origin vX.Y.Z`).
`.github/workflows/release.yml` creates the release, stamps the version and URLs
into `module.json`, and attaches `module.zip`.
