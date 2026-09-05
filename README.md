# hanebox.github.io

Han's portfolio and blog, built with Jekyll and hosted on GitHub Pages.

## Run locally

```sh
bundle install
bundle exec jekyll serve
```

Open <http://localhost:4000>.

## Local-time appearance

The shared layout loads `assets/time-theme.js` before the page renders. The
visitor's local clock selects one of 24 hourly palettes: dawn at 06:00, daylight,
golden afternoon light, dusk at 18:00, and cool moonlight overnight. The light
theme runs from 06:00 through 17:59; the dark theme runs from 18:00 through 05:59.
No location permission is needed; these are clock-based hours, not astronomical
sunrise and sunset times.

Colors, light intensity, and shadow direction are sampled from the stops in
`assets/time-theme.js` at whole hours. They update at the next hour boundary and
when the tab is resumed. Both the WebGL shader and its CSS fallback use the same
palette, including when reduced motion is enabled.

The homepage also shows the time in the site's configured timezone (Asia/Jakarta)
beside the visitor's local time. These clocks refresh at each minute boundary.

## Add a blog post

Create a Markdown file in `_posts` named `YYYY-MM-DD-post-title.md`:

```md
---
layout: post
title: Post title
description: A short summary shown on the blog page.
date: YYYY-MM-DD HH:MM:SS +0700
---

Write the post here.
```
