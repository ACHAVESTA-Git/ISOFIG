# isofig as a Claude Code plugin

The repository is also a Claude Code marketplace. The `isofig` plugin installs the skill that writes isofig specs,
without copying files by hand.

## 1. Install

In a terminal:

```sh
claude plugin marketplace add ACHAVESTA-Git/ISOFIG
claude plugin install isofig@isofig
```

Inside a Claude Code session, the same steps are:

```text
/plugin marketplace add ACHAVESTA-Git/ISOFIG
/plugin install isofig@isofig
```

When you install, choose the scope: user (all your projects), project or local. If you already copied the skill by
hand to `~/.claude/skills/isofig`, delete it: otherwise the skill will show up twice.

To build the figures, the skill uses the npm package: if the project does not have it, the skill will ask you to run
`npm i github:ACHAVESTA-Git/ISOFIG#v0.10.1`.

## 2. Invoke the skill

- Ask in natural language, for example: "make an isometric figure of how a rate limiter works". Claude loads the skill
  when the task matches its description.
- Type `/isofig:isofig` (the format is `/<plugin>:<skill>`).

To check that it is active, type `/` and look for `isofig`, or run `claude plugin list` in the terminal.

## 3. Update

```sh
claude plugin marketplace update isofig
claude plugin update isofig@isofig
```

Then run `/reload-plugins` in the open session, or restart Claude Code.

The plugin pins its version (`version` in `.claude-plugin/plugin.json`): an update arrives when the repository
publishes a new version. To update it automatically when Claude Code starts, open `/plugin`, go to **Marketplaces**,
select `isofig` and turn on **Enable auto-update**. It is off by default for third-party marketplaces.

## Uninstall

```sh
claude plugin uninstall isofig@isofig
```
