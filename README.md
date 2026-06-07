# FrostVista Wiki

FrostVista Wiki is a Zensical-based documentation site for
[FrostVistaOS](https://github.com/AuroBreeze/FrostVistaOS).

The current site is a learning-path skeleton. The navigation is defined in
`zensical.toml`, and source pages live under `docs/`.

## Local Preview

Install Zensical:

```bash
pip install zensical
```

Serve locally:

```bash
zensical serve
```

Build the static site:

```bash
zensical build --clean
```

The generated output is written to `site/` and is ignored by git.

## Structure

```text
zensical.toml   Site configuration and navigation
docs/           Markdown source pages
docs/getting-started/  Getting started pages
docs/chapters/         Tutorial chapters
docs/labs/             Lab guides
docs/debugging/        Debugging notes
docs/reference/        Reference pages
site/           Generated static site output
```
